"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  uploadRecording,
  subscribeRecordings,
  RecordingPointer,
  RECORDING_TTL_MS,
} from "@/lib/vocabRecordings";
import { checkSpeechMatch } from "@/lib/vocabUtils";
import { tPlain } from "@/lib/i18n";
import { playUrl } from "@/lib/audioBus";
import {
  createRecordingController,
  browserRecordingEnv,
  isRecordingSupported,
  RECORDING_LIMIT_MS,
  type RecordingController,
  type RecordingEnv,
  type RecordingPhase,
  type BlobLike,
} from "@/lib/recordingSession";

/**
 * 발음 연습 녹음 — X03 재작성.
 *
 * 바뀐 것은 두 가지다.
 *  1) 녹음 자원(recorder·15초 타이머·마이크 트랙·objectURL·STT 요청)을
 *     `lib/recordingSession.ts` 의 세션으로 옮겼다. 이 컴포넌트는 더 이상
 *     타이머나 트랙을 직접 들고 있지 않는다. 예문이 바뀌거나 화면이 닫히면
 *     세션을 cancel 하고, 늦게 도착한 응답은 전부 폐기된다.
 *  2) 화면 순서를 **말해 보기 → 들어 보기 → 다시 말하기/저장** 으로 세웠고,
 *     넓은 화면에서는 두 단계를 좌우로 나란히 둔다(세로로 늘린 휴대폰 금지).
 *
 * 형식은 고정하지 않는다 — 브라우저가 고른 `rec.mimeType` 이 Blob type 과
 * 업로드 contentType 으로 그대로 간다.
 */

interface Props {
  sentenceText: string;
  wordForms?: string[];          // 선택 — 있으면 활용형 포함 여부도 체크, 없으면 유사도만
  onOriginalPlay: () => void;
  onComplete: () => void;
  roomCode: string;
  clientId: string;
  wordId: string;
  sentenceIdx: number;
  /** 버튼 라벨 언어. 기존 호출부는 넘기지 않으므로 한국어가 기본이다. */
  lang?: string;
  /** 개발용 fixture 전용 주입 — 마이크·네트워크 없이 화면을 그리기 위한 것. */
  recordingEnv?: RecordingEnv;
}

interface CheckResult {
  passed: boolean;
  recognized: string;
  similarity: number;
  hasForm: boolean;
}

interface Captured {
  url: string;
  blob: BlobLike;
  durationMs: number;
  mimeType: string;
}

const LIMIT_SEC = Math.round(RECORDING_LIMIT_MS / 1000);

export default function VocabRecorder({
  sentenceText, wordForms = [], onOriginalPlay, onComplete,
  roomCode, clientId, wordId, sentenceIdx, lang = "ko", recordingEnv,
}: Props) {
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [savedPtr, setSavedPtr] = useState<RecordingPointer | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [sttSkipped, setSttSkipped] = useState(false);
  const [attempts, setAttempts] = useState(0); // 현재 예문에서 시도 횟수
  const [supported, setSupported] = useState(true);
  const whyId = useId();

  // fixture 주입이 들어오면 서버·Firebase 경로를 타지 않는다 — 개발 화면이
  // 운영 데이터를 건드리지 않게 하는 유일한 분기다.
  const fixtureMode = !!recordingEnv;
  const controllerRef = useRef<RecordingController | null>(null);
  // 판정 기준은 항상 '지금 화면의 예문' 이어야 한다 — 클로저에 굳히지 않는다.
  const targetRef = useRef({ sentenceText, wordForms });
  targetRef.current = { sentenceText, wordForms };

  /* ── 저장된 녹음 포인터 구독 (예문 전환 시 새로고침) ───────────────── */
  useEffect(() => {
    setSavedPtr(null);
    if (fixtureMode) return;
    const unsub = subscribeRecordings(roomCode, clientId, wordId, (byIdx) => {
      setSavedPtr(byIdx[sentenceIdx] ?? null);
    });
    return () => unsub();
  }, [fixtureMode, roomCode, clientId, wordId, sentenceIdx]);

  /* ── 녹음 세션 컨트롤러 ─────────────────────────────────────────── */
  useEffect(() => {
    if (!recordingEnv && !isRecordingSupported()) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const c = createRecordingController(recordingEnv ?? browserRecordingEnv(), {
      onPhase: (p) => setPhase(p),
      onCaptured: (r) => {
        setCaptured({ url: r.url, blob: r.blob, durationMs: r.durationMs, mimeType: r.mimeType });
        setSttSkipped(false);
      },
      onStt: (r) => {
        const { sentenceText: target, wordForms: forms } = targetRef.current;
        if (!r.ok) {
          // 인식 자체가 실패했다. 발음을 '틀렸다' 고 말하지 않는다 —
          // 확인하지 못했다고 정직하게 쓰고 저장은 막지 않는다.
          setCheckResult(null);
          setSttSkipped(true);
          setAttempts((n) => n + 1);
          return;
        }
        const check = checkSpeechMatch({
          recognized: r.text, target, wordForms: forms, threshold: 0.55, pass: "either",
        });
        setCheckResult({
          passed: check.passed, recognized: r.text,
          similarity: check.similarity, hasForm: check.hasForm,
        });
        setAttempts((n) => n + 1);
      },
      onDenied: () => { /* phase 가 denied 로 오므로 화면이 안내한다 */ },
    });
    controllerRef.current = c;
    return () => {
      c.dispose();
      controllerRef.current = null;
    };
  }, [recordingEnv]);

  /* ── 예문/단어가 바뀌면 진행 중인 녹음은 취소 ─────────────────────── */
  useEffect(() => {
    controllerRef.current?.cancel("context-change");
    setPhase("idle");
    setElapsed(0);
    setCaptured(null);
    setUploadError(null);
    setCheckResult(null);
    setSttSkipped(false);
    setAttempts(0);
  }, [wordId, sentenceIdx]);

  /* ── 초 표시 ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "recording") return;
    setElapsed(Math.floor((controllerRef.current?.elapsedMs() ?? 0) / 1000));
    const id = window.setInterval(() => {
      setElapsed(Math.floor((controllerRef.current?.elapsedMs() ?? 0) / 1000));
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  const start = useCallback(() => {
    setUploadError(null);
    setCheckResult(null);
    setSttSkipped(false);
    setCaptured(null);
    void controllerRef.current?.start();
  }, []);

  const stop = useCallback(() => controllerRef.current?.stop(), []);
  const cancelCheck = useCallback(() => {
    controllerRef.current?.cancelStt();
    setSttSkipped(true);
    setCheckResult(null);
  }, []);

  async function uploadAndComplete() {
    if (!captured || uploading) return;
    setUploading(true);
    setUploadError(null);
    const params = {
      roomCode, clientId, wordId, sentenceIdx,
      blob: captured.blob as unknown as Blob,
      duration: captured.durationMs / 1000,
    };
    try {
      try {
        if (fixtureMode) await new Promise((r) => setTimeout(r, 150));
        else await uploadRecording(params);
      } catch (first) {
        // 일시적 네트워크 오류 대비 1회 자동 재시도 (설계서 항목 8)
        console.warn("[vocab-recorder] 업로드 1차 실패 — 재시도", first);
        await new Promise((r) => setTimeout(r, 1200));
        await uploadRecording(params);
      }
    } catch (err) {
      // 녹음 저장에 최종 실패해도 발음 통과 자체는 인정 —
      // 업로드 실패가 학습 진행을 막지 않는다 (설계서 항목 8).
      console.warn("[vocab-recorder] 업로드 최종 실패 — 통과는 인정하고 진행", err);
      setUploadError("녹음 저장은 실패했지만, 발음 연습은 통과로 인정했어요");
    }
    setUploading(false);
    // 세션 자원(objectURL) 회수는 컨트롤러가 한다.
    controllerRef.current?.cancel("context-change");
    setCaptured(null);
    onComplete();
  }

  const savedDaysLeft = savedPtr
    ? Math.max(0, Math.ceil((savedPtr.timestamp + RECORDING_TTL_MS - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  const canComplete = !!captured && (checkResult?.passed === true || sttSkipped || attempts >= 3);
  const mercyPass = !!captured && checkResult?.passed === false && attempts >= 3;
  const blockedReason = !captured
    ? "먼저 말해 보고 나면 저장할 수 있어요"
    : !canComplete
      ? `아직 저장할 수 없어요 · 통과하거나 ${3 - attempts}번 더 말해 보면 저장돼요`
      : "";

  const recording = phase === "recording" || phase === "stopping";
  const checking = phase === "checking";
  const requesting = phase === "requesting";

  const label = useMemo(() => ({
    listen: tPlain("vocabListen", lang),
    speak: tPlain("postRecordStart", lang),
    stop: tPlain("postRecordStop", lang),
  }), [lang]);

  if (!supported) {
    return (
      <div className="vr-wrap" data-ux-surface="panel">
        <p data-ux-role="body" style={{ textAlign: "center", color: "var(--ux-ink-soft)", margin: 0 }}>
          이 브라우저는 녹음을 지원하지 않아요. 크롬/사파리 최신 버전을 사용해 주세요.
        </p>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </div>
    );
  }

  return (
    <div className="vr-wrap" data-ux-surface="panel" data-vr-phase={phase}>
      <div className="vr-grid">
        {/* ── 1단계: 말해 보기 ─────────────────────────────────── */}
        <section className="vr-col" aria-label="1단계 말해 보기">
          <p data-ux-role="label" className="vr-step">
            <span className="vr-num" aria-hidden="true">1</span> 말해 보기
          </p>

          <button
            type="button"
            data-ux-role="control"
            className="vr-line"
            onClick={onOriginalPlay}
          >
            <span aria-hidden="true">🔊</span>
            <span>{label.listen} · 선생님 소리</span>
          </button>

          <div className="vr-mic-area">
            {recording ? (
              <button
                type="button"
                data-ux-role="action"
                className="vr-mic vr-mic-stop"
                onClick={stop}
              >
                <span aria-hidden="true" className="vr-mic-icon">⏹</span>
                <span className="vr-mic-label">{label.stop}</span>
                <span data-ux-role="secondary" className="vr-mic-sub">
                  {elapsed}초 / {LIMIT_SEC}초
                </span>
              </button>
            ) : (
              <button
                type="button"
                data-ux-role="action"
                className="vr-mic vr-mic-go"
                onClick={start}
                aria-disabled={phase === "denied" || requesting}
              >
                <span aria-hidden="true" className="vr-mic-icon">🎙️</span>
                <span className="vr-mic-label">
                  {captured || savedPtr ? "다시 " : ""}{label.speak}
                </span>
                <span data-ux-role="secondary" className="vr-mic-sub">
                  {requesting ? "마이크를 준비하고 있어요" : `${LIMIT_SEC}초까지 녹음돼요`}
                </span>
              </button>
            )}
          </div>

          {phase === "denied" && (
            <p data-ux-role="body" className="vr-alert" role="alert">
              마이크를 쓸 수 없어요. 주소창 옆 자물쇠에서 마이크를 허용해 주세요.
            </p>
          )}
        </section>

        {/* ── 2·3단계: 들어 보기 → 다시 말하기 / 저장 ──────────── */}
        <section className="vr-col" aria-label="2단계 들어 보기와 저장">
          <p data-ux-role="label" className="vr-step">
            <span className="vr-num" aria-hidden="true">2</span> 들어 보기
          </p>

          {captured ? (
            <div className="vr-row">
              <button
                type="button"
                data-ux-role="control"
                className="vr-line vr-grow"
                onClick={() => { void playUrl(captured.url); }}
              >
                <span aria-hidden="true">🔊</span>
                <span>내 소리 {label.listen}</span>
              </button>
              <button
                type="button"
                data-ux-role="control"
                className="vr-line vr-grow"
                onClick={onOriginalPlay}
              >
                <span aria-hidden="true">🔊</span>
                <span>선생님 소리</span>
              </button>
            </div>
          ) : (
            <p data-ux-role="body" className="vr-hint">
              말하고 나면 여기에서 내 소리를 들어 볼 수 있어요.
            </p>
          )}

          {savedPtr && (
            <div className="vr-saved">
              <button
                type="button"
                data-ux-role="control"
                className="vr-line vr-grow"
                onClick={() => { void playUrl(savedPtr.audioUrl); }}
              >
                <span aria-hidden="true">💾</span>
                <span>저장한 소리 {label.listen}</span>
              </button>
              {savedDaysLeft !== null && (
                <span data-ux-role="secondary" className="vr-saved-note">
                  {savedDaysLeft}일 뒤에 저절로 지워져요
                </span>
              )}
            </div>
          )}

          {/* STT 분석 상태 + 취소 */}
          {checking && (
            <div className="vr-checking" role="status">
              <span data-ux-role="body" className="vr-checking-text">
                <span aria-hidden="true">🎧</span> 무슨 말인지 듣고 있어요…
              </span>
              <button type="button" data-ux-role="control" className="vr-line" onClick={cancelCheck}>
                <span aria-hidden="true">✕</span>
                <span>그만 듣기</span>
              </button>
            </div>
          )}

          {captured && !checking && (checkResult || sttSkipped) && (
            <div
              className={"vr-result " + (checkResult?.passed && !sttSkipped ? "is-pass" : "is-retry")}
              role="status"
            >
              <p data-ux-role="label" className="vr-result-head">
                {sttSkipped
                  ? "이번에는 확인하지 못했어요"
                  : checkResult?.passed
                    ? "잘 말했어요!"
                    : `한 번 더 해 볼까요 (${attempts}/3)`}
              </p>
              {!sttSkipped && checkResult && (
                <>
                  <p data-ux-role="body" className="vr-result-line">
                    이렇게 들렸어요: “{checkResult.recognized || "소리가 작았어요"}”
                  </p>
                  <p data-ux-role="secondary" className="vr-result-line">
                    말할 문장: “{sentenceText}” · 닮은 정도 {Math.round(checkResult.similarity * 100)}%
                    {!checkResult.hasForm && " · 중요한 낱말이 빠졌어요"}
                  </p>
                  {!checkResult.passed && attempts >= 2 && (
                    <p data-ux-role="body" className="vr-tip">
                      천천히 또박또박 “{sentenceText}”
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {uploadError && (
            <p data-ux-role="body" className="vr-alert" role="alert">{uploadError}</p>
          )}

          <p data-ux-role="label" className="vr-step">
            <span className="vr-num" aria-hidden="true">3</span> 다시 말하기 · 저장
          </p>
          <div className="vr-row">
            <button
              type="button"
              data-ux-role="control"
              className="vr-line vr-grow"
              onClick={start}
            >
              <span aria-hidden="true">↻</span>
              <span>다시 {label.speak}</span>
            </button>
            <button
              type="button"
              data-ux-role="action"
              className={"vr-save vr-grow" + (canComplete ? "" : " is-off")}
              aria-disabled={!canComplete || uploading}
              aria-describedby={blockedReason ? whyId : undefined}
              onClick={() => { if (canComplete && !uploading) void uploadAndComplete(); }}
            >
              <span aria-hidden="true">{uploading ? "⟳" : "💾"}</span>
              <span>
                {uploading
                  ? "저장하고 있어요"
                  : sttSkipped
                    ? "확인 없이 저장하기"
                    : mercyPass
                      ? "다음 낱말로 가기"
                      : "저장하고 끝내기"}
              </span>
            </button>
          </div>
          {blockedReason && (
            <p id={whyId} data-ux-role="secondary" className="vr-why">{blockedReason}</p>
          )}
        </section>
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/**
 * 인라인 style 로는 미디어 쿼리를 쓸 수 없어서 문자열로 둔다.
 * 전역 `[data-ux-role="control"]` 을 덮는 자리는 속성까지 함께 건다.
 */
const CSS = `
.vr-wrap{
  background: var(--ux-surface-sunk);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-4);
}
.vr-grid{ display: grid; gap: var(--ux-space-4); }
/* 넓은 화면에서는 '말하기' 와 '들어 보기·저장' 을 좌우로 — 세로로 늘리지 않는다. */
@media (min-width: 860px){
  .vr-grid{ grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); align-items: start; }
}
.vr-col{ display: grid; gap: var(--ux-space-3); align-content: start; min-width: 0; }
.vr-step{ display: flex; align-items: center; gap: var(--ux-space-2); margin: 0; font-weight: 800; color: var(--ux-ink); }
.vr-num{
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.75em; height: 1.75em; border-radius: 50%;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-weight: 900;
}
.vr-line[data-ux-role="control"]{
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--ux-space-2);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 700;
  white-space: normal; word-break: keep-all;
}
.vr-row{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); }
.vr-grow{ flex: 1 1 12ch; }
.vr-mic-area{ display: flex; justify-content: center; }
.vr-mic[data-ux-role="action"]{
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--ux-space-1);
  width: 100%; min-height: 8.5rem;
  font-family: inherit; font-weight: 800;
  border-radius: var(--ux-radius-panel);
  white-space: normal; word-break: keep-all; text-align: center;
}
.vr-mic-go[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 3px solid var(--ux-primary-border);
}
.vr-mic-stop[data-ux-role="action"]{
  background: var(--ux-surface); color: var(--ux-error);
  border: 3px solid var(--ux-error);
}
.vr-mic-icon{ font-size: var(--ux-font-title); line-height: 1; }
.vr-mic-label{ font-size: var(--ux-font-body-emphasis); }
.vr-mic-sub{ color: inherit; opacity: .85; }
.vr-mic[aria-disabled="true"]{ opacity: .55; cursor: default; }
.vr-hint{ margin: 0; color: var(--ux-ink-soft); }
.vr-saved{ display: grid; gap: var(--ux-space-1); }
.vr-saved-note{ color: var(--ux-ink-soft); }
.vr-checking{
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--ux-space-2);
  background: var(--ux-surface); border: 2px dashed var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-3);
}
.vr-checking-text{ margin: 0; flex: 1 1 14ch; }
.vr-result{
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3);
  background: var(--ux-surface);
  display: grid; gap: var(--ux-space-1);
}
.vr-result.is-pass{ border: 3px solid var(--ux-success); }
.vr-result.is-retry{ border: 3px solid var(--ux-error); }
.vr-result-head{ margin: 0; font-weight: 900; }
.vr-result-line{ margin: 0; }
.vr-tip{
  margin: 0; padding: var(--ux-space-2);
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface);
}
.vr-alert{ margin: 0; color: var(--ux-error); font-weight: 700; }
.vr-save[data-ux-role="action"]{
  display: inline-flex; align-items: center; justify-content: center; gap: var(--ux-space-2);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800;
  white-space: normal; word-break: keep-all;
}
.vr-save.is-off[data-ux-role="action"]{
  background: var(--ux-surface); color: var(--ux-ink-soft);
  border: 2px dashed var(--ux-ink-soft); cursor: default;
}
.vr-why{ margin: 0; color: var(--ux-ink-soft); }
`;

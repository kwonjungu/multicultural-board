"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { speakVia, stopAll as stopAllAudio } from "@/lib/audioBus";
import ScopedStyle from "./ui/child/ScopedStyle";

type SideState = "idle" | "listening" | "translating" | "done" | "error";
type SideValue = { original: string; translation: string };

const TTS_LANG_MAP: Record<string, string> = {
  ko: "ko-KR", en: "en-US", vi: "vi-VN", zh: "zh-CN", fil: "fil-PH",
  ja: "ja-JP", th: "th-TH", km: "km-KH", mn: "mn-MN", ru: "ru-RU",
  uz: "uz-UZ", hi: "hi-IN", id: "id-ID", ar: "ar-SA", my: "my-MM",
};
const WEB_SPEECH_SUPPORTED = new Set(["ko", "en", "vi", "zh", "ja", "th", "ru", "hi", "id", "ar"]);

/**
 * 통역 음성은 전부 audioBus 를 통과한다 (X19 / ADD-TTS-01).
 *
 * 옛 코드는 WebSpeech 분기로 들어가기 전에 이전 HTMLAudio 를 멈추지 않아서,
 * 서버 폴백으로 크메르어를 읽는 도중 한국어로 바꾸면 **두 목소리가 겹쳤다**.
 * 이제 버스가 양쪽을 함께 소유하므로 새 재생 전에 둘 다 멈춘다. '소리 끄기'
 * 설정이 켜져 있으면 이 함수는 아무 소리도 내지 않는다.
 */
async function speakText(text: string, lang: string) {
  if (typeof window === "undefined" || !text) return;
  await speakVia({
    text,
    lang,
    bcp47: TTS_LANG_MAP[lang] || "en-US",
    allowWebSpeech: WEB_SPEECH_SUPPORTED.has(lang),
    audioUrl: (t2, l) =>
      `/api/tts?lang=${encodeURIComponent(l)}&text=${encodeURIComponent(t2.slice(0, 200))}`,
  });
}

/**
 * 통역 화면 스타일.
 *
 * 예전 화면의 문제(실측·캡처로 확인):
 *  - 크롬북 1366px 인데 오른쪽 560px 서랍에 갇히고 왼쪽 800px 은 빈 회색.
 *    마주 보고 쓰는 도구인데 넓은 화면을 전혀 쓰지 않았다(04 §1 Q5).
 *  - 다크 네이비 + 파랑/노랑 그라디언트 + 육각형 SVG 장식 — 앱의 크림·꿀빛
 *    토큰과 무관해 이 화면만 겉돌았다.
 *  - 44px 미만 조작 3개, 14px 미만 글자 7~9개, data-ux-role 0개.
 *  - 390px 과 1366px 의 측정값이 완전히 동일 = 반응형 재배치가 없었다.
 *
 * 고친 방향: 색·크기를 전부 토큰으로 돌리고, 폭이 생기면 좌우로 나눈다.
 * 마이크가 화면의 주인공이고, 번역문이 그다음이다.
 */
const ITP_CSS = `
.itp-scrim{
  /* 게임 중에도 통역을 열 수 있어야 하므로 게임룸(460) 위. */
  position: fixed; inset: 0; z-index: 480;
  background: rgba(41,37,31,.45);
  opacity: 0; pointer-events: none; transition: opacity .2s;
}
.itp-scrim.on{ opacity: 1; pointer-events: auto; }

.itp-sheet{
  position: fixed; inset: 0; z-index: 481;
  display: flex; flex-direction: column;
  background: var(--ux-bg);
  transform: translateY(100%); transition: transform .28s cubic-bezier(.22,.61,.36,1);
  /* 닫힌 시트는 반드시 화면에서 '없는 것'이어야 한다. transform/opacity 만으로
     숨기면 fixed 판이 그대로 남아 그 아래 화면의 클릭을 전부 삼킨다 — 실제로
     860px 이상에서 홈 허브가 통째로 안 눌리는 사고가 났다(2026-09-13).
     visibility 는 포커스·스크린리더에서도 함께 빼 준다. */
  visibility: hidden; pointer-events: none;
  transition: transform .28s cubic-bezier(.22,.61,.36,1), visibility 0s linear .28s;
}
.itp-sheet.on{
  transform: none;
  visibility: visible; pointer-events: auto;
  transition: transform .28s cubic-bezier(.22,.61,.36,1);
}
@media (min-width: 860px){
  /* 넓은 화면에서는 전체를 덮지 않고 가운데 큰 판으로 — 교실에서 책상에
     올려놓고 마주 보는 물건처럼. */
  .itp-sheet{
    inset: 3vh 4vw; border-radius: var(--ux-radius-panel);
    border: 3px solid var(--ux-primary-border);
    box-shadow: 0 24px 60px rgba(41,37,31,.3);
    transform: translateY(8px) scale(.98); opacity: 0;
    transition: transform .28s cubic-bezier(.22,.61,.36,1), opacity .2s,
                visibility 0s linear .28s;
  }
  .itp-sheet.on{
    transform: none; opacity: 1;
    transition: transform .28s cubic-bezier(.22,.61,.36,1), opacity .2s;
  }
}

.itp-head{
  display: flex; align-items: center; gap: var(--ux-space-3);
  padding: var(--ux-space-3) var(--ux-space-4);
  border-bottom: 2px solid var(--ux-surface-sunk); flex-shrink: 0;
}
.itp-title{ margin: 0; flex: 1; text-align: center; color: var(--ux-ink); }
.itp-close, .itp-reset{
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 800;
}

.itp-pair{
  display: flex; align-items: center; justify-content: center; gap: var(--ux-space-3);
  padding: var(--ux-space-2) var(--ux-space-4) var(--ux-space-3);
  flex-wrap: wrap; flex-shrink: 0;
}
.itp-pair-me, .itp-pair-other{ display: inline-flex; align-items: center; gap: 6px; }
.itp-pair-arrow{ color: var(--ux-ink-soft); font-weight: 900; }

/* 마주 보기 무대 */
.itp-stagewrap{ flex: 1; display: flex; flex-direction: column; min-height: 0; }
.itp-divider{
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  padding: var(--ux-space-2);
  border-top: 2px dashed var(--ux-surface-sunk);
  border-bottom: 2px dashed var(--ux-surface-sunk);
  background: var(--ux-bg);
}
@media (min-width: 860px){
  /* 폭이 생기면 좌우로. 글자를 뒤집을 필요가 없어진다. */
  .itp-stagewrap{ flex-direction: row; }
  /* 좌우 배치에서는 얇은 선만 남긴다. 세로로 세운 글자는 읽기 어렵다. */
  .itp-divider{
    border: none; border-left: 2px dashed var(--ux-surface-sunk);
    padding: 0; width: 0;
  }
  .itp-divider > *{ display: none; }
}

.itp-side{
  flex: 1; min-height: 0; min-width: 0;
  display: flex; flex-direction: column; justify-content: space-between;
  gap: var(--ux-space-3);
  padding: var(--ux-space-4);
  background: var(--ux-surface);
}
/* 두 사람을 색이 아니라 **자리와 라벨**로 나눈다. 은은한 바탕 차이만 준다. */
.itp-side.other{ background: var(--ux-hint-mint); }
/* 위아래로 쌓이는 좁은 화면에서만 친구 쪽을 뒤집는다. 좌우로 나란히 놓이면
   뒤집을 이유가 없다 — 그리고 이 규칙을 미디어쿼리보다 **뒤에** 두면
   같은 특이도라 나중 것이 이겨서 넓은 화면에서도 뒤집힌다(실제로 그랬다). */
@media (max-width: 859px){
  .itp-side.flip{ transform: rotate(180deg); }
}

.itp-top{ display: flex; align-items: center; gap: var(--ux-space-2); flex-shrink: 0; }
.itp-flag{ font-size: 1.6em; line-height: 1; }
.itp-who{ display: grid; min-width: 0; }
.itp-lang{ color: var(--ux-ink); font-weight: 800; }
.itp-pick{ margin-left: auto; }
.itp-select{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 700;
  max-width: 46vw;
}
/* 스크린리더 전용 라벨 — 화면에서는 숨기되 이름은 남긴다. */
.itp-sr{
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.itp-body{
  flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
  text-align: center;
}
.itp-hint, .itp-error{ margin: 0; color: var(--ux-ink-soft); }
.itp-error{ color: var(--ux-error); font-weight: 800; }

.itp-result{ display: grid; gap: var(--ux-space-2); width: 100%; }
/* 상대가 읽을 번역문이 주인공. 읽기 폭은 제한한다. */
.itp-translation{
  margin: 0 auto; max-width: 26ch; color: var(--ux-ink); font-weight: 700;
}
.itp-original{ margin: 0; color: var(--ux-ink-soft); }

.itp-status{ display: grid; gap: var(--ux-space-2); justify-items: center; }
.itp-status-text{ color: var(--ux-ink-soft); font-weight: 800; }
.itp-wave{ display: inline-flex; align-items: center; gap: 5px; height: 36px; }
.itp-wave i{
  width: 6px; height: 100%; border-radius: 999px; background: var(--ux-primary-border);
  animation: itpWave .8s ease-in-out infinite alternate;
}
.itp-dots{ display: inline-flex; gap: 8px; }
.itp-dots i{
  width: 10px; height: 10px; border-radius: 50%; background: var(--ux-primary-border);
  animation: itpDot 1.1s infinite;
}
@keyframes itpWave { from { transform: scaleY(.35); } to { transform: scaleY(1); } }
@keyframes itpDot { 0%,80%,100% { transform: scale(.6); opacity: .5; } 40% { transform: scale(1); opacity: 1; } }

.itp-actions{
  display: flex; align-items: center; justify-content: center;
  gap: var(--ux-space-3); flex-shrink: 0; flex-wrap: wrap;
}
.itp-replay{
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 800;
}
/* 마이크가 이 화면의 주인공 — 가장 크고 가장 눈에 띈다. */
.itp-mic{
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; min-width: 112px; min-height: 76px;
  padding: var(--ux-space-2) var(--ux-space-6);
  border-radius: var(--ux-radius-pill);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 3px solid var(--ux-primary-border);
  font-family: inherit; cursor: pointer;
  box-shadow: 0 6px 16px rgba(137,83,0,.22);
}
.itp-mic-ico{ font-size: 1.8em; line-height: 1; }
/* 녹음 중은 색만이 아니라 글자(멈추기)와 테두리로도 알린다. */
.itp-mic.on{
  background: var(--ux-error); color: #fff; border-color: var(--ux-error);
  animation: itpRec 1.3s ease-in-out infinite;
}
@keyframes itpRec {
  0%,100% { box-shadow: 0 6px 16px rgba(179,38,30,.35), 0 0 0 0 rgba(179,38,30,.4); }
  50%     { box-shadow: 0 6px 16px rgba(179,38,30,.35), 0 0 0 12px rgba(179,38,30,0); }
}
.itp-mic[aria-disabled="true"]{ opacity: .6; cursor: wait; }
`;

interface SideProps {
  side: "me" | "other";
  lang: string;
  value: SideValue | null;
  state: SideState;
  onStart: () => void;
  onStop: () => void;
  onReplay: () => void;
  flipped: boolean;
  errorMsg?: string;
  availableLangs: string[];
  onLangChange?: (lang: string) => void;
}

function InterpreterSide({ side, lang, value, state, onStart, onStop, onReplay, flipped, errorMsg, availableLangs, onLangChange }: SideProps) {
  const info = LANGUAGES[lang] || LANGUAGES.ko;
  const isMe = side === "me";

  const listening = state === "listening";
  const translating = state === "translating";
  const done = state === "done" && !!value;
  const err = state === "error";

  return (
    <div className={`itp-side ${isMe ? "me" : "other"}${flipped ? " flip" : ""}`} data-state={state}>
      {/* 위: 누구 차례인지 + 언어 */}
      <div className="itp-top">
        <span aria-hidden className="itp-flag">{info.flag}</span>
        <span className="itp-who">
          <span data-ux-role="secondary" className="itp-role">{isMe ? "나" : "친구"}</span>
          <span data-ux-role="label" className="itp-lang" lang={lang}>{info.label}</span>
        </span>
        {onLangChange && (
          <span className="itp-pick">
            {/* 지원 언어가 15개라 카드로 다 펴면 통역 화면을 덮는다. 네이티브
                컨트롤을 쓰되 조작 크기와 이름은 토큰·라벨로 맞춘다. */}
            <label className="itp-sr" htmlFor={`itp-lang-${side}`}>언어 바꾸기</label>
            <select
              id={`itp-lang-${side}`}
              data-ux-role="control"
              className="itp-select"
              value={lang}
              onChange={(e) => onLangChange(e.target.value)}
            >
              {availableLangs.map((k) => (
                <option key={k} value={k}>{LANGUAGES[k]?.label}</option>
              ))}
            </select>
          </span>
        )}
      </div>

      {/* 가운데: 말한 내용 */}
      <div className="itp-body">
        {listening ? (
          <div className="itp-status">
            <span aria-hidden className="itp-wave">
              {Array.from({ length: 5 }).map((_, i) => (
                <i key={i} style={{ animationDelay: `${i * 0.09}s` }} />
              ))}
            </span>
            <span data-ux-role="body-emphasis" className="itp-status-text">듣고 있어요</span>
          </div>
        ) : translating ? (
          <div className="itp-status">
            <span aria-hidden className="itp-dots">
              {[0, 1, 2].map((i) => <i key={i} style={{ animationDelay: `${i * 0.16}s` }} />)}
            </span>
            <span data-ux-role="body-emphasis" className="itp-status-text">바꾸는 중</span>
          </div>
        ) : done && value ? (
          <div className="itp-result">
            {/* 상대가 읽을 번역문이 주인공 — 크게. */}
            <p data-ux-role="learn-sentence" className="itp-translation">{value.translation}</p>
            {/* 내가 말한 원문은 확인용 — 작게, 하지만 지우지 않는다. */}
            <p data-ux-role="secondary" className="itp-original">{value.original}</p>
          </div>
        ) : err ? (
          <p data-ux-role="body" className="itp-error" role="status">
            {errorMsg || "다시 한 번 말해 볼까요?"}
          </p>
        ) : (
          <p data-ux-role="body" className="itp-hint">
            {isMe ? "누르고 말해 보세요" : "친구가 말할 차례예요"}
          </p>
        )}
      </div>

      {/* 아래: 마이크가 이 화면의 주인공이다 */}
      <div className="itp-actions">
        {done && (
          <button type="button" data-ux-role="control" className="itp-replay" onClick={onReplay}>
            <span aria-hidden>🔊</span>
            <span data-ux-role="label">다시 듣기</span>
          </button>
        )}
        <button
          type="button"
          className={listening ? "itp-mic on" : "itp-mic"}
          onClick={listening ? onStop : onStart}
          aria-disabled={translating}
          aria-label={listening ? "녹음 멈추기" : `${info.label}로 말하기`}
          onClickCapture={(e) => { if (translating) e.preventDefault(); }}
        >
          <span aria-hidden className="itp-mic-ico">{listening ? "■" : "🎤"}</span>
          <span data-ux-role="label" className="itp-mic-label">{listening ? "멈추기" : "말하기"}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 개발용 fixture 주입구 (HARNESS §2 G0). 통역은 마이크 권한과 /api/stt·번역이
 * 있어야 상태가 진행돼서, 없으면 '듣는 중·바꾸는 중·완료·오류' 화면을 아예
 * 검수할 수 없다. 값이 있으면 녹음도 원격 호출도 하지 않고 그 상태로 그린다.
 */
export interface InterpreterFixture {
  meState?: SideState;
  otherState?: SideState;
  meValue?: SideValue | null;
  otherValue?: SideValue | null;
  errMsg?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  viewerLang: string;
  availableLangs: string[];
  fixture?: InterpreterFixture;
}

export default function InterpreterDrawer({ open, onClose, viewerLang, availableLangs, fixture }: Props) {
  /** fixture 가 주입되면 마이크·네트워크 경계를 통째로 끈다. */
  const offline = !!fixture;
  const defaultPartner = availableLangs.find((l) => l !== viewerLang) || "vi";
  const [partnerLang, setPartnerLang] = useState<string>(defaultPartner);
  const [meState, setMeState] = useState<SideState>(fixture?.meState ?? "idle");
  const [otherState, setOtherState] = useState<SideState>(fixture?.otherState ?? "idle");
  const [meValue, setMeValue] = useState<SideValue | null>(fixture?.meValue ?? null);
  const [otherValue, setOtherValue] = useState<SideValue | null>(fixture?.otherValue ?? null);
  const [errMsg, setErrMsg] = useState<string>(fixture?.errMsg ?? "");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const activeSideRef = useRef<"me" | "other" | null>(null);

  function reset() {
    cancelRecording();
    stopAllAudio(); // 닫기·초기화 후 활성 음성 0개 (ADD-TTS-01)
    setMeState("idle"); setOtherState("idle");
    setMeValue(null); setOtherValue(null);
    setErrMsg("");
  }

  useEffect(() => { if (!open && !offline) reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, offline]);
  useEffect(() => () => { cancelRecording(); stopAllAudio(); }, []);

  function cancelRecording() {
    const r = recorderRef.current;
    try { if (r && r.state !== "inactive") r.stop(); } catch {}
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    activeSideRef.current = null;
  }

  async function startRecording(side: "me" | "other") {
    // fixture: 마이크를 켜지 않는다. 주입된 상태 그대로 둔다.
    if (offline) return;
    if (meState === "listening" || otherState === "listening" || meState === "translating" || otherState === "translating") return;
    setErrMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      activeSideRef.current = side;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        chunksRef.current = [];
        if (blob.size < 1500) {
          // too short
          if (side === "me") setMeState("idle"); else setOtherState("idle");
          return;
        }
        await transcribeAndTranslate(blob, side);
      };
      recorderRef.current = rec;
      rec.start();
      if (side === "me") setMeState("listening"); else setOtherState("listening");
    } catch (err) {
      console.error("mic error:", err);
      setErrMsg("마이크를 켤 수 없어요");
      if (side === "me") setMeState("error"); else setOtherState("error");
    }
  }

  function stopRecording(side: "me" | "other") {
    if (activeSideRef.current !== side) return;
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      if (side === "me") setMeState("translating"); else setOtherState("translating");
      try { r.stop(); } catch {}
    }
  }

  async function transcribeAndTranslate(blob: Blob, side: "me" | "other") {
    const speaker = side === "me" ? viewerLang : partnerLang;
    const target = side === "me" ? partnerLang : viewerLang;
    try {
      // 1) STT
      const fd = new FormData();
      fd.append("audio", new File([blob], "clip.webm", { type: blob.type || "audio/webm" }));
      fd.append("lang", speaker);
      const sttRes = await fetch("/api/stt", { method: "POST", body: fd });
      if (!sttRes.ok) throw new Error("stt 실패");
      const { text: original } = (await sttRes.json()) as { text?: string };
      if (!original || !original.trim()) throw new Error("목소리를 못 알아들었어요");

      // 2) Translate
      const trRes = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: original,
          fromLang: speaker,
          targetLangs: [target],
          cardType: "comment",
          authorName: "interpreter",
          isTeacher: false,
          paletteIdx: 0,
        }),
      });
      if (!trRes.ok) throw new Error("번역 실패");
      const { translations } = (await trRes.json()) as { translations?: Record<string, string> };
      const translation = translations?.[target] || original;

      const value: SideValue = { original, translation };
      if (side === "me") {
        setMeValue(value); setMeState("done"); setOtherState("done");
      } else {
        setOtherValue(value); setOtherState("done"); setMeState("done");
      }
      speakText(translation, target);
    } catch (e) {
      console.error("interpreter error:", e);
      setErrMsg((e as Error).message || "처리 중 문제가 생겼어요");
      if (side === "me") setMeState("error"); else setOtherState("error");
    }
  }

  const partnerOptions = availableLangs.filter((k) => k !== viewerLang);

  return (
    <>
      <ScopedStyle css={ITP_CSS} />
      <div
        className={open ? "itp-scrim on" : "itp-scrim"}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        data-ux-root
        role="dialog" aria-modal="true" aria-label="통역 도우미"
        className={open ? "itp-sheet on" : "itp-sheet"}
      >
        {/* 머리: 닫기 · 제목 · 처음부터 */}
        <div className="itp-head">
          <button type="button" data-ux-role="control" className="itp-close" onClick={onClose}>
            <span aria-hidden>✕</span>
            <span data-ux-role="label">닫기</span>
          </button>
          <h2 data-ux-role="title" className="itp-title">통역</h2>
          <button type="button" data-ux-role="control" className="itp-reset" onClick={reset}>
            <span aria-hidden>↻</span>
            <span data-ux-role="label">처음부터</span>
          </button>
        </div>

        {/* 두 사람의 언어 — 무엇이 무엇으로 바뀌는지 한 줄로 */}
        <div className="itp-pair">
          <span className="itp-pair-me">
            <span aria-hidden>{LANGUAGES[viewerLang]?.flag}</span>
            <span data-ux-role="label" lang={viewerLang}>{LANGUAGES[viewerLang]?.label}</span>
          </span>
          <span aria-hidden className="itp-pair-arrow">⇄</span>
          <span className="itp-pair-other">
            <label className="itp-sr" htmlFor="itp-partner">친구 언어 고르기</label>
            <select
              id="itp-partner"
              data-ux-role="control"
              className="itp-select"
              value={partnerLang}
              onChange={(e) => { setPartnerLang(e.target.value); reset(); }}
            >
              {partnerOptions.map((k) => (
                <option key={k} value={k}>{LANGUAGES[k]?.label}</option>
              ))}
            </select>
          </span>
        </div>

        {/*
          마주 보기 배치.
          - 세로(태블릿 세로·폰): 위아래. 위쪽(친구)만 180° 돌려 마주 본 사람이
            바로 읽게 한다.
          - 가로(태블릿 가로·크롬북·노트북): **좌우로 나란히**. 넓은 화면에서
            위아래로 쌓으면 각자 몫이 납작해지고, 글자를 뒤집을 필요도 없다.
            07·04 §5 의 "폭이 생기면 옆으로" 와 같은 원칙이다.
        */}
        <div className="itp-stagewrap">
          <InterpreterSide
            side="other"
            lang={partnerLang}
            value={meValue}
            state={otherState}
            onStart={() => startRecording("other")}
            onStop={() => stopRecording("other")}
            onReplay={() => meValue && speakText(meValue.translation, partnerLang)}
            flipped={true}
            errorMsg={errMsg}
            availableLangs={partnerOptions}
            onLangChange={(l) => { setPartnerLang(l); reset(); }}
          />

          <div className="itp-divider">
            <span data-ux-role="secondary">마주 보고 번갈아 말해요</span>
          </div>

          <InterpreterSide
            side="me"
            lang={viewerLang}
            value={otherValue}
            state={meState}
            onStart={() => startRecording("me")}
            onStop={() => stopRecording("me")}
            onReplay={() => otherValue && speakText(otherValue.translation, viewerLang)}
            flipped={false}
            errorMsg={errMsg}
            availableLangs={[viewerLang]}
          />
        </div>
      </div>
    </>
  );
}

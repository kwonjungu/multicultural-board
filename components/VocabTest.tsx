"use client";

import { useState, useRef, useEffect } from "react";
import { isAnswerCorrect } from "@/lib/vocabTest";
import { checkSpeechMatch } from "@/lib/vocabUtils";
import type { QuizItem, ClozeItem, Mc4Item, Mc4ImageItem, MatchingItem, ListeningItem } from "@/lib/quizFormats";
import { FORMAT_ICON } from "@/lib/quizFormats";
import { logAttempt } from "@/lib/vocabAttempts";
import {
  XP_PER_CORRECT, comboBonus, loseHeart, awardXp, recordLessonResult,
  subscribeLearner, effectiveHearts, MAX_HEARTS, type LearnerState,
} from "@/lib/lms";
import SessionResultScreen from "./SessionResultScreen";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";
const GREEN = "#10B981";
const GREEN_DARK = "#059669";
const RED = "#EF4444";

let serverTtsAudio: HTMLAudioElement | null = null;
async function speakKorean(text: string) {
  if (typeof window === "undefined") return;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const hasVoice = voices.some((v) => v.lang.startsWith("ko"));
  if (hasVoice) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    window.speechSynthesis.speak(u);
    return;
  }
  try {
    if (serverTtsAudio) { serverTtsAudio.pause(); serverTtsAudio = null; }
    const url = `/api/tts?lang=ko&text=${encodeURIComponent(text.slice(0, 200))}`;
    const audio = new Audio(url);
    serverTtsAudio = audio;
    await audio.play();
  } catch { /* silent */ }
}

interface Props {
  questions: QuizItem[];
  onWordResult: (wordId: string, passed: boolean) => void;
  onClose: () => void;
  roomCode: string;
  clientId: string;
  studentName: string;
  // Duolingo 스타일 — 레슨 컨텍스트
  lessonId?: string;
  lessonTitle?: string;
}

type QPhase = "answering" | "checking" | "feedback";

export default function VocabTest({
  questions, onWordResult, onClose, roomCode, clientId, studentName, lessonId, lessonTitle,
}: Props) {
  const [queue, setQueue] = useState<QuizItem[]>(() => questions);
  const [qIdx, setQIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<QPhase>("answering");
  const [lastCorrect, setLastCorrect] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finishedCount, setFinishedCount] = useState(0);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [matchSelLeft, setMatchSelLeft] = useState<number | null>(null);
  const [matchPaired, setMatchPaired] = useState<Record<number, number>>({}); // leftIdx → rightIdx
  const [matchRevealed, setMatchRevealed] = useState(false);
  const [matchShake, setMatchShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qStartRef = useRef<number>(Date.now());

  // ── Duolingo 상태 ──
  const [learner, setLearner] = useState<LearnerState | null>(null);
  const [combo, setCombo] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [outOfHearts, setOutOfHearts] = useState(false);
  const [awardResult, setAwardResult] = useState<Awaited<ReturnType<typeof awardXp>> | null>(null);
  const [lessonStars, setLessonStars] = useState<1 | 2 | 3 | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    const unsub = subscribeLearner(roomCode, clientId, setLearner);
    return unsub;
  }, [roomCode, clientId]);

  const currentQ = queue[qIdx];
  const total = questions.length;
  const allDone = !currentQ;

  // Question change reset
  useEffect(() => {
    qStartRef.current = Date.now();
    setTyped("");
    setAttempts(0);
    setPhase("answering");
    setLastCorrect(false);
    setPickedIdx(null);
    setMatchSelLeft(null);
    setMatchPaired({});
    setMatchRevealed(false);
    const id = window.setTimeout(() => inputRef.current?.focus(), 250);
    return () => window.clearTimeout(id);
  }, [qIdx, queue.length]);

  // ── Cloze 전용 — 녹음 ──
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRec() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        await transcribeAndFill(blob);
      };
      mediaRecRef.current = rec;
      chunksRef.current = [];
      startRef.current = Date.now();
      setRecElapsed(0);
      tickRef.current = window.setInterval(() => {
        setRecElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 200);
      rec.start();
      setRecording(true);
      setTimeout(() => {
        if (mediaRecRef.current && mediaRecRef.current.state === "recording") stopRec();
      }, 8000);
    } catch { /* silent */ }
  }

  function stopRec() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    const r = mediaRecRef.current;
    if (r && r.state !== "inactive") r.stop();
    setRecording(false);
  }

  async function transcribeAndFill(blob: Blob) {
    setPhase("checking");
    try {
      const form = new FormData();
      form.append("audio", new File([blob], "rec.webm", { type: blob.type || "audio/webm" }));
      form.append("lang", "ko");
      const res = await fetch("/api/stt", { method: "POST", body: form });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { text?: string };
      const recognized = (j.text ?? "").trim();
      setTyped(recognized);
      submitCloze(recognized, "voice");
    } catch {
      setPhase("answering");
    }
  }

  // ── 공통 채점 결과 처리 ──
  function recordAttempt(correct: boolean, opts: { inputMode?: "type" | "voice" | "tap"; pickedWordId?: string }) {
    if (!currentQ) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setLastCorrect(correct);
    setPhase("feedback");

    const isFinal = correct || newAttempts >= 3;
    if (isFinal) {
      if (correct) {
        setCorrectCount((c) => c + 1);
        // 콤보/XP 적립
        const nextCombo = combo + 1;
        const earned = XP_PER_CORRECT + comboBonus(nextCombo);
        setCombo(nextCombo);
        setSessionXp((x) => x + earned);
      } else {
        setCombo(0);
        // 하트 차감 (final fail only)
        loseHeart(roomCode, clientId).then((s) => {
          const live = effectiveHearts(s);
          if (live <= 0) setOutOfHearts(true);
        }).catch(() => undefined);
      }
      setFinishedCount((c) => c + 1);
      onWordResult(currentQ.wordId, correct);
      const sentenceIdx = "sentenceIdx" in currentQ ? currentQ.sentenceIdx : undefined;
      logAttempt({
        roomCode,
        clientId,
        studentName,
        format: currentQ.format,
        wordId: currentQ.wordId,
        sentenceIdx,
        correct,
        attempts: newAttempts,
        durationMs: Date.now() - qStartRef.current,
        inputMode: opts.inputMode,
        pickedWordId: opts.pickedWordId,
      }).catch(() => undefined);
    }
  }

  // 세션 완료 시 XP 일괄 적립 + 레슨 결과 기록
  async function finalizeSession() {
    if (finalizing) return;
    setFinalizing(true);
    try {
      if (sessionXp > 0) {
        const res = await awardXp(roomCode, clientId, sessionXp);
        setAwardResult(res);
      }
      if (lessonId) {
        const r = await recordLessonResult(roomCode, clientId, lessonId, correctCount, total);
        setLessonStars(r.stars);
      }
    } catch (err) {
      console.warn("[VocabTest] finalize 실패", err);
    } finally {
      setFinalizing(false);
    }
  }

  // 큐 끝나거나 하트 0 이면 종료 후 적립
  useEffect(() => {
    if (allDone || outOfHearts) {
      finalizeSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, outOfHearts]);

  // ── 클로즈 제출 ──
  function submitCloze(value?: string, inputMode: "type" | "voice" = "type") {
    if (!currentQ || currentQ.format !== "cloze" || phase === "feedback") return;
    const given = (value ?? typed).trim();
    if (!given) { setPhase("answering"); return; }
    const exact = isAnswerCorrect(given, currentQ.acceptedAnswers);
    const fuzzy = checkSpeechMatch({
      recognized: given,
      target: currentQ.answer,
      wordForms: currentQ.acceptedAnswers,
      threshold: 0.6,
    });
    recordAttempt(exact || fuzzy.passed, { inputMode });
  }

  // ── 4지선다 / 듣고 고르기 제출 ──
  function submitChoice(idx: number) {
    if (!currentQ || phase === "feedback") return;
    if (currentQ.format !== "mc4" && currentQ.format !== "mc4-image" && currentQ.format !== "listening") return;
    setPickedIdx(idx);
    const picked = currentQ.choices[idx];
    const correct = idx === currentQ.correctIdx;
    recordAttempt(correct, { inputMode: "tap", pickedWordId: picked.wordId });
  }

  // ── 매칭: 왼쪽 단어 ↔ 오른쪽 힌트 ──
  function pickMatchingLeft(leftIdx: number) {
    if (matchRevealed || phase === "feedback") return;
    if (matchPaired[leftIdx] !== undefined) return; // 이미 매칭됨
    setMatchSelLeft(leftIdx);
  }
  function pickMatchingRight(rightIdx: number) {
    if (matchRevealed || phase === "feedback") return;
    if (currentQ?.format !== "matching") return;
    if (matchSelLeft === null) return;
    // 우측이 이미 다른 좌측과 매칭되었는지 체크
    if (Object.values(matchPaired).includes(rightIdx)) return;
    const leftPair = currentQ.pairs[matchSelLeft];
    const rightPair = (currentQ as MatchingItem).pairs;
    // 표시된 우측 인덱스 → 원본 pairs 인덱스로 변환 후 wordId 비교
    const origIdx = matchRightOrder[rightIdx];
    const rightWordId = (typeof origIdx === "number" && rightPair[origIdx])
      ? rightPair[origIdx].wordId
      : null;
    const isPairCorrect = rightWordId !== null && leftPair.wordId === rightWordId;
    if (isPairCorrect) {
      const next = { ...matchPaired, [matchSelLeft]: rightIdx };
      setMatchPaired(next);
      setMatchSelLeft(null);
      // 4쌍 모두 매칭 → 정답 처리
      if (Object.keys(next).length === currentQ.pairs.length) {
        recordAttempt(true, { inputMode: "tap" });
      }
    } else {
      // 오답 — 시도 카운트만 늘리고 selection 해제
      setMatchSelLeft(null);
      setMatchShake(true);
      setTimeout(() => setMatchShake(false), 320);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setMatchRevealed(true);
        recordAttempt(false, { inputMode: "tap" });
      }
    }
  }

  // 매칭 오른쪽 셔플 순서 — 좌측은 pairs 순서대로 보여주고, 우측은 셔플.
  // 문제 진입 시마다 새 셔플. 채점과 표시 모두 이 단일 상태를 사용.
  const [matchRightOrder, setMatchRightOrder] = useState<number[]>([]);
  useEffect(() => {
    if (currentQ?.format !== "matching") return;
    const n = currentQ.pairs.length;
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    setMatchRightOrder(idx);
  }, [qIdx, currentQ?.format]);

  function proceedAfterFeedback() {
    if (!currentQ) return;
    const advance = lastCorrect || attempts >= 3 || currentQ.format === "matching";
    if (advance) {
      setQIdx((i) => i + 1);
    } else {
      setTyped("");
      setPickedIdx(null);
      setPhase("answering");
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }

  // ── 완료 / 하트 소진 화면 ──
  if (allDone || outOfHearts) {
    return (
      <Shell onClose={onClose}>
        <SessionResultScreen
          outOfHearts={outOfHearts && !allDone}
          finalizing={finalizing}
          correct={correctCount}
          total={total}
          sessionXp={sessionXp}
          combo={combo}
          award={awardResult}
          stars={lessonStars}
          lessonTitle={lessonTitle}
          onRetry={() => {
            setQueue(questions);
            setQIdx(0);
            setCorrectCount(0);
            setFinishedCount(0);
            setCombo(0);
            setSessionXp(0);
            setAwardResult(null);
            setLessonStars(null);
          }}
          onClose={onClose}
        />
      </Shell>
    );
  }

  const liveHearts = learner ? effectiveHearts(learner) : MAX_HEARTS;

  // ── 헤더 + 진행바 (공통) ──
  return (
    <Shell onClose={onClose}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, paddingBottom: 10, borderBottom: `2px solid ${PURPLE_LIGHT}`,
      }}>
        <button
          onClick={onClose}
          aria-label="나가기"
          style={{
            background: PURPLE_LIGHT, border: "none", borderRadius: 10,
            padding: "6px 10px", fontSize: 16, fontWeight: 900, color: PURPLE_DARK,
            cursor: "pointer", fontFamily: "inherit", minWidth: 36,
          }}
        >✕</button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
          <div style={{
            background: PURPLE_LIGHT, color: PURPLE_DARK,
            fontSize: 11, fontWeight: 900, padding: "3px 8px", borderRadius: 999,
            whiteSpace: "nowrap",
          }}>
            {FORMAT_ICON[currentQ.format]} {finishedCount + 1}/{total}
          </div>
          {combo >= 3 && (
            <div style={{
              background: "linear-gradient(135deg, #FB923C, #EA580C)",
              color: "#fff", fontSize: 11, fontWeight: 900,
              padding: "3px 8px", borderRadius: 999,
              animation: "comboPop 0.4s ease",
            }}>🔥 콤보 {combo}</div>
          )}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "#FEF2F2", border: "1.5px solid #FCA5A5",
          padding: "3px 8px", borderRadius: 999,
        }}>
          <span style={{ fontSize: 14 }}>❤️</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: "#B91C1C" }}>{liveHearts}</span>
        </div>
      </div>

      <div style={{
        height: 8, background: PURPLE_LIGHT, borderRadius: 999,
        overflow: "hidden", margin: "10px 0 14px",
      }}>
        <div style={{
          height: "100%", background: `linear-gradient(90deg, ${PURPLE}, ${PURPLE_DARK})`,
          width: `${(finishedCount / total) * 100}%`,
          transition: "width 0.3s ease",
        }} />
      </div>

      {/* 포맷별 본문 */}
      {currentQ.format === "cloze" && (
        <ClozeBody
          q={currentQ}
          typed={typed}
          setTyped={setTyped}
          phase={phase}
          attempts={attempts}
          lastCorrect={lastCorrect}
          recording={recording}
          recElapsed={recElapsed}
          onRec={() => (recording ? stopRec() : startRec())}
          onSubmit={() => submitCloze()}
          onProceed={proceedAfterFeedback}
          inputRef={inputRef}
        />
      )}

      {(currentQ.format === "mc4" || currentQ.format === "mc4-image" || currentQ.format === "listening") && (
        <ChoiceBody
          q={currentQ}
          phase={phase}
          attempts={attempts}
          lastCorrect={lastCorrect}
          pickedIdx={pickedIdx}
          onPick={submitChoice}
          onProceed={proceedAfterFeedback}
        />
      )}

      {currentQ.format === "matching" && (
        <MatchingBody
          q={currentQ}
          rightOrder={matchRightOrder}
          paired={matchPaired}
          selLeft={matchSelLeft}
          attempts={attempts}
          revealed={matchRevealed}
          shake={matchShake}
          onPickLeft={pickMatchingLeft}
          onPickRight={pickMatchingRight}
          phase={phase}
          lastCorrect={lastCorrect}
          onProceed={proceedAfterFeedback}
        />
      )}
    </Shell>
  );
}

// ════════════════════════════════════════
//                  CLOZE
// ════════════════════════════════════════

function ClozeBody({
  q, typed, setTyped, phase, attempts, lastCorrect, recording, recElapsed,
  onRec, onSubmit, onProceed, inputRef,
}: {
  q: ClozeItem;
  typed: string;
  setTyped: (s: string) => void;
  phase: QPhase;
  attempts: number;
  lastCorrect: boolean;
  recording: boolean;
  recElapsed: number;
  onRec: () => void;
  onSubmit: () => void;
  onProceed: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <>
      <SentenceImage wordId={q.wordId} sentenceIdx={q.sentenceIdx} />
      <WordIconHeader wordId={q.wordId} subcategory={q.word.subcategory} />

      <div style={{
        background: `linear-gradient(135deg, #fff, ${PURPLE_LIGHT})`,
        border: `3px solid ${PURPLE_DARK}`,
        borderRadius: 18, padding: "18px 16px",
        textAlign: "center",
        fontSize: 22, fontWeight: 900, color: "#1F2937",
        letterSpacing: -0.3, lineHeight: 1.6, marginBottom: 14,
      }}>
        {q.cloze}
      </div>

      {attempts >= 2 && phase !== "feedback" && (
        <div style={{
          background: "#FEF3C7", border: "2px dashed #F59E0B",
          borderRadius: 12, padding: "10px 14px", marginBottom: 10,
          fontSize: 14, fontWeight: 800, color: "#92400E", textAlign: "center",
        }}>
          💡 힌트: 첫 글자는 "{q.answer[0]}"
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
          placeholder="정답을 입력하거나 🎤 눌러 말해요"
          disabled={phase !== "answering"}
          style={{
            flex: 1, padding: "12px 14px",
            fontSize: 18, fontWeight: 800,
            border: `2px solid ${PURPLE}55`, borderRadius: 12,
            fontFamily: "inherit", color: "#1F2937", outline: "none",
            background: phase === "answering" ? "#fff" : "#F9FAFB",
          }}
        />
        <button
          onClick={onRec}
          disabled={phase !== "answering"}
          aria-label="음성 입력"
          style={{
            background: recording
              ? `linear-gradient(135deg, ${RED}, #DC2626)`
              : `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
            color: "#fff", border: "none", borderRadius: 12,
            padding: "0 16px", fontSize: 20, fontWeight: 900,
            cursor: phase === "answering" ? "pointer" : "not-allowed",
            fontFamily: "inherit", minWidth: 60,
            opacity: phase !== "answering" ? 0.5 : 1,
          }}
        >
          {recording ? `⏹${recElapsed}s` : "🎤"}
        </button>
      </div>

      {phase === "answering" && (
        <button
          onClick={onSubmit}
          disabled={!typed.trim()}
          style={{
            width: "100%",
            background: typed.trim()
              ? `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`
              : "#E5E7EB",
            color: typed.trim() ? "#fff" : "#9CA3AF",
            border: "none", borderRadius: 14,
            padding: "14px", fontSize: 16, fontWeight: 900,
            cursor: typed.trim() ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >확인</button>
      )}

      {phase === "checking" && (
        <div style={{ textAlign: "center", padding: "14px", fontSize: 14, fontWeight: 800, color: PURPLE_DARK }}>
          🎧 인식 중…
        </div>
      )}

      {phase === "feedback" && (
        <FeedbackBox
          correct={lastCorrect}
          typed={typed}
          answer={q.answer}
          fullSentence={q.word.sentences[q.sentenceIdx].ko}
          attempts={attempts}
          maxedOut={attempts >= 3 && !lastCorrect}
          onPlayOriginal={() => speakKorean(q.word.sentences[q.sentenceIdx].ko)}
          onProceed={onProceed}
        />
      )}
    </>
  );
}

// ════════════════════════════════════════
//             4지선다 / 듣기
// ════════════════════════════════════════

function ChoiceBody({
  q, phase, attempts, lastCorrect, pickedIdx, onPick, onProceed,
}: {
  q: Mc4Item | Mc4ImageItem | ListeningItem;
  phase: QPhase;
  attempts: number;
  lastCorrect: boolean;
  pickedIdx: number | null;
  onPick: (idx: number) => void;
  onProceed: () => void;
}) {
  const isListening = q.format === "listening";
  const isImage = q.format === "mc4-image";
  const maxedOut = attempts >= 3 && !lastCorrect;
  const showAnswer = phase === "feedback";
  const sentenceIdx = "sentenceIdx" in q ? q.sentenceIdx : 0;

  return (
    <>
      <SentenceImage wordId={q.wordId} sentenceIdx={(sentenceIdx as 0 | 1 | 2) ?? 0} hideOnListening={isListening} />
      <WordIconHeader wordId={q.wordId} subcategory={q.word.subcategory} hideIcon={isListening || isImage} />

      {/* 안내 / 듣기 버튼 */}
      {isListening ? (
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <button
            onClick={() => speakKorean((q as ListeningItem).ttsText)}
            style={{
              background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
              color: "#fff", border: "none", borderRadius: 999,
              padding: "16px 28px", fontSize: 16, fontWeight: 900,
              cursor: "pointer", boxShadow: `0 10px 24px ${PURPLE}66`,
            }}
          >🔊 다시 듣기</button>
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "#6B7280" }}>
            {q.prompt}
          </div>
        </div>
      ) : (
        <div style={{
          background: `linear-gradient(135deg, #fff, ${PURPLE_LIGHT})`,
          border: `3px solid ${PURPLE_DARK}`,
          borderRadius: 18, padding: "16px",
          textAlign: "center",
          fontSize: 18, fontWeight: 900, color: "#1F2937",
          lineHeight: 1.6, marginBottom: 14,
        }}>
          {q.prompt}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: isImage ? "repeat(2, 1fr)" : "1fr",
        gap: 10,
      }}>
        {q.choices.map((c, i) => {
          const isCorrect = i === q.correctIdx;
          const isPicked = pickedIdx === i;
          const reveal = showAnswer || maxedOut;
          let bg = "#fff";
          let border = `2px solid ${PURPLE}33`;
          let color = "#1F2937";
          if (reveal && isCorrect) { bg = "#ECFDF5"; border = `2.5px solid ${GREEN}`; color = GREEN_DARK; }
          else if (reveal && isPicked && !isCorrect) { bg = "#FEF2F2"; border = `2.5px solid ${RED}`; color = "#B91C1C"; }
          else if (isPicked) { bg = PURPLE_LIGHT; border = `2.5px solid ${PURPLE_DARK}`; color = PURPLE_DARK; }
          return (
            <button
              key={`${c.wordId}-${i}`}
              onClick={() => onPick(i)}
              disabled={phase !== "answering"}
              style={{
                background: bg, border, color, borderRadius: 14,
                padding: isImage ? "10px" : "14px",
                fontSize: isImage ? 14 : 16, fontWeight: 900,
                cursor: phase === "answering" ? "pointer" : "default",
                fontFamily: "inherit",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                minHeight: isImage ? 110 : 56,
                transition: "transform 0.12s, background 0.15s",
              }}
              onMouseDown={(e) => { if (phase === "answering") e.currentTarget.style.transform = "scale(0.96)"; }}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              {isImage && c.iconUrl && (
                <img
                  src={c.iconUrl}
                  alt=""
                  aria-hidden="true"
                  style={{ width: 56, height: 56, objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span>{c.label}</span>
              {reveal && isCorrect && <span style={{ fontSize: 12 }}>✓ 정답</span>}
            </button>
          );
        })}
      </div>

      {phase === "feedback" && (
        <div style={{ marginTop: 14 }}>
          <FeedbackBox
            correct={lastCorrect}
            typed={pickedIdx !== null ? q.choices[pickedIdx].label : ""}
            answer={q.choices[q.correctIdx].label}
            fullSentence={isListening ? (q as ListeningItem).ttsText : q.word.sentences[(sentenceIdx as 0 | 1 | 2) ?? 0]?.ko ?? q.word.ko}
            attempts={attempts}
            maxedOut={maxedOut}
            onPlayOriginal={() => speakKorean(isListening ? (q as ListeningItem).ttsText : (q.word.sentences[(sentenceIdx as 0 | 1 | 2) ?? 0]?.ko ?? q.word.ko))}
            onProceed={onProceed}
          />
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════
//               MATCHING
// ════════════════════════════════════════

function MatchingBody({
  q, rightOrder, paired, selLeft, attempts, revealed, shake,
  onPickLeft, onPickRight, phase, lastCorrect, onProceed,
}: {
  q: MatchingItem;
  rightOrder: number[];
  paired: Record<number, number>;
  selLeft: number | null;
  attempts: number;
  revealed: boolean;
  shake: boolean;
  onPickLeft: (i: number) => void;
  onPickRight: (i: number) => void;
  phase: QPhase;
  lastCorrect: boolean;
  onProceed: () => void;
}) {
  const order = rightOrder.length ? rightOrder : q.pairs.map((_, i) => i);
  return (
    <>
      <div style={{
        background: `linear-gradient(135deg, #fff, ${PURPLE_LIGHT})`,
        border: `3px solid ${PURPLE_DARK}`,
        borderRadius: 18, padding: "12px 16px",
        textAlign: "center",
        fontSize: 15, fontWeight: 900, color: "#1F2937",
        marginBottom: 14,
      }}>
        🔗 단어와 어울리는 상황을 찾아 짝지어요 ({Object.keys(paired).length} / {q.pairs.length})
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
        animation: shake ? "shake 0.32s" : undefined,
      }}>
        {/* 좌측: 단어 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.pairs.map((p, i) => {
            const isPaired = paired[i] !== undefined;
            const isSel = selLeft === i;
            let bg = "#fff", border = `2px solid ${PURPLE}33`, color = "#1F2937";
            if (isPaired) { bg = "#ECFDF5"; border = `2px solid ${GREEN}`; color = GREEN_DARK; }
            else if (isSel) { bg = PURPLE_LIGHT; border = `2.5px solid ${PURPLE_DARK}`; color = PURPLE_DARK; }
            return (
              <button
                key={p.wordId}
                onClick={() => onPickLeft(i)}
                disabled={isPaired || revealed || phase === "feedback"}
                style={{
                  background: bg, border, color, borderRadius: 12,
                  padding: "12px 10px", fontSize: 15, fontWeight: 900,
                  cursor: isPaired ? "default" : "pointer", fontFamily: "inherit",
                  textAlign: "center", minHeight: 52,
                }}
              >
                {p.ko}
              </button>
            );
          })}
        </div>
        {/* 우측: 힌트 (셔플) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {order.map((origIdx, displayIdx) => {
            const pair = q.pairs[origIdx];
            const matchedLeftIdx = Object.entries(paired).find(([, r]) => Number(r) === displayIdx)?.[0];
            const isPaired = matchedLeftIdx !== undefined;
            let bg = "#fff", border = `2px solid ${PURPLE}33`, color = "#1F2937";
            if (isPaired) { bg = "#ECFDF5"; border = `2px solid ${GREEN}`; color = GREEN_DARK; }
            else if (revealed) { bg = "#FEF2F2"; border = `2px solid ${RED}77`; color = "#7F1D1D"; }
            return (
              <button
                key={`r-${displayIdx}`}
                onClick={() => onPickRight(displayIdx)}
                disabled={isPaired || revealed || selLeft === null || phase === "feedback"}
                style={{
                  background: bg, border, color, borderRadius: 12,
                  padding: "12px 10px", fontSize: 13, fontWeight: 800,
                  cursor: isPaired || selLeft === null ? "default" : "pointer", fontFamily: "inherit",
                  textAlign: "center", minHeight: 52, lineHeight: 1.3,
                  opacity: selLeft === null && !isPaired ? 0.5 : 1,
                }}
              >
                {pair.hint}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{
        marginTop: 10, textAlign: "center",
        fontSize: 12, fontWeight: 700, color: attempts >= 2 ? "#B91C1C" : "#6B7280",
      }}>
        {phase !== "feedback" && `시도 ${attempts} / 3${attempts >= 2 ? " (다음에 틀리면 답이 공개돼요)" : ""}`}
      </div>

      {phase === "feedback" && (
        <div style={{ marginTop: 14 }}>
          <FeedbackBox
            correct={lastCorrect}
            typed=""
            answer={`4쌍 모두 맞춰야 정답`}
            fullSentence={revealed ? q.pairs.map((p) => `${p.ko} ↔ ${p.hint}`).join("\n") : ""}
            attempts={attempts}
            maxedOut={attempts >= 3 && !lastCorrect}
            onPlayOriginal={() => speakKorean(q.pairs.map((p) => p.ko).join(", "))}
            onProceed={onProceed}
          />
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>
    </>
  );
}

// ════════════════════════════════════════
//             공통 작은 컴포넌트
// ════════════════════════════════════════

function SentenceImage({ wordId, sentenceIdx, hideOnListening }: { wordId: string; sentenceIdx: 0 | 1 | 2; hideOnListening?: boolean }) {
  if (hideOnListening) return null;
  return (
    <div style={{
      borderRadius: 18, overflow: "hidden",
      background: PURPLE_LIGHT,
      border: `3px solid ${PURPLE}33`,
      aspectRatio: "16/9",
      boxShadow: "0 10px 26px rgba(139, 92, 246, 0.2)",
    }}>
      <img
        src={`/vocab-images/sentences/${wordId}_${sentenceIdx}.png`}
        alt=""
        aria-hidden="true"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}

function WordIconHeader({ wordId, subcategory, hideIcon }: { wordId: string; subcategory: string; hideIcon?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 8px" }}>
      {!hideIcon && (
        <img
          src={`/vocab-images/icons/${wordId}.png`}
          alt=""
          aria-hidden="true"
          style={{
            width: 40, height: 40, objectFit: "contain",
            borderRadius: 10, background: PURPLE_LIGHT, padding: 3,
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div style={{ fontSize: 12, fontWeight: 800, color: PURPLE_DARK }}>
        {subcategory}
      </div>
    </div>
  );
}

function FeedbackBox({
  correct, typed, answer, fullSentence, attempts, maxedOut,
  onPlayOriginal, onProceed,
}: {
  correct: boolean; typed: string; answer: string; fullSentence: string;
  attempts: number; maxedOut: boolean;
  onPlayOriginal: () => void; onProceed: () => void;
}) {
  return (
    <div style={{
      background: correct ? "#ECFDF5" : "#FEF2F2",
      border: `2.5px solid ${correct ? GREEN : RED}`,
      borderRadius: 14, padding: "14px",
      animation: "fbIn 0.25s ease",
    }}>
      <div style={{
        fontSize: 18, fontWeight: 900,
        color: correct ? GREEN_DARK : "#B91C1C",
        marginBottom: 8,
      }}>
        {correct ? "✓ 정답!" : maxedOut ? "😊 다음 문제로 넘어가요" : `✗ 다시 해봐요 (${attempts}/3)`}
      </div>

      {!correct && typed && (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#4B5563", lineHeight: 1.5 }}>
          네 답: &ldquo;{typed}&rdquo;<br/>
          정답: <span style={{ color: GREEN_DARK, fontWeight: 900 }}>&ldquo;{answer}&rdquo;</span>
        </div>
      )}

      {(correct || maxedOut) && fullSentence && (
        <div style={{
          marginTop: 8,
          fontSize: 13, fontWeight: 700, color: "#1F2937",
          background: "#fff", padding: "8px 12px", borderRadius: 8,
          whiteSpace: "pre-line",
        }}>
          {fullSentence}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {(correct || maxedOut) && (
          <button
            onClick={onPlayOriginal}
            style={{
              background: PURPLE_LIGHT, color: PURPLE_DARK, border: "none",
              borderRadius: 10, padding: "10px 14px",
              fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}
          >🔊 듣기</button>
        )}
        <button
          onClick={onProceed}
          style={{
            flex: 1,
            background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
            color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 14px", fontSize: 14, fontWeight: 900,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 4px 10px rgba(139, 92, 246, 0.35)",
          }}
        >
          {correct || maxedOut ? "다음 →" : "↻ 다시 시도"}
        </button>
      </div>
    </div>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(15, 10, 40, 0.78)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "'Noto Sans KR', sans-serif",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560,
          background: "#fff", borderRadius: "24px 24px 0 0",
          padding: "14px 18px 22px",
          boxShadow: "0 -16px 48px rgba(0,0,0,0.3)",
          maxHeight: "96vh", overflow: "auto",
          animation: "slideUp 0.25s ease",
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(60px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes fbIn { from { transform: translateY(6px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes comboPop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

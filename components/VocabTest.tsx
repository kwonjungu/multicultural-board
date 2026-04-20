"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { QuizQuestion, isAnswerCorrect } from "@/lib/vocabTest";
import { checkSpeechMatch } from "@/lib/vocabUtils";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";
const GREEN = "#10B981";
const GREEN_DARK = "#059669";
const RED = "#EF4444";

const TTS_LANG_MAP: Record<string, string> = {
  ko: "ko-KR",
};

let serverTtsAudio: HTMLAudioElement | null = null;
async function speakKorean(text: string) {
  if (typeof window === "undefined") return;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const hasVoice = voices.some((v) => v.lang.startsWith("ko"));
  if (hasVoice) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = TTS_LANG_MAP.ko;
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
  questions: QuizQuestion[];
  onWordResult: (wordId: string, passed: boolean) => void;
  onClose: () => void;
}

type QPhase = "answering" | "checking" | "feedback";

export default function VocabTest({ questions, onWordResult, onClose }: Props) {
  // 큐 — 틀리면 뒤에 다시 넣을 수 있게 가변
  const [queue, setQueue] = useState<QuizQuestion[]>(() => questions);
  const [qIdx, setQIdx] = useState(0);         // 현재 큐 내 위치
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<QPhase>("answering");
  const [lastCorrect, setLastCorrect] = useState(false);
  const [attempts, setAttempts] = useState(0); // 현재 문제 시도 수
  const [correctCount, setCorrectCount] = useState(0);
  const [finishedCount, setFinishedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentQ = queue[qIdx];
  const total = questions.length;
  const allDone = !currentQ;

  // 문제 전환 시 입력 초기화
  useEffect(() => {
    setTyped("");
    setAttempts(0);
    setPhase("answering");
    setLastCorrect(false);
    // 자동 포커스
    const id = window.setTimeout(() => inputRef.current?.focus(), 250);
    return () => window.clearTimeout(id);
  }, [qIdx, queue.length]);

  // 녹음 상태
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
      // 안전 8초
      setTimeout(() => {
        if (mediaRecRef.current && mediaRecRef.current.state === "recording") {
          stopRec();
        }
      }, 8000);
    } catch { /* 권한 거부 등 — 조용히 */ }
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
      // 인식 결과를 입력창에 넣고 자동 제출
      setTyped(recognized);
      submitAnswer(recognized);
    } catch {
      // STT 실패 — 인식 실패로 처리, 사용자가 다시 시도
      setPhase("answering");
    }
  }

  function submitAnswer(value?: string) {
    if (!currentQ || phase === "feedback") return;
    const given = (value ?? typed).trim();
    if (!given) { setPhase("answering"); return; }

    // 1차: 정확 매칭 (accepted forms 중 하나 포함)
    const exact = isAnswerCorrect(given, currentQ.acceptedAnswers);
    // 2차: 소리 기반 (STT 결과인 경우) — 유사도 70%+ 면 관대
    const fuzzy = checkSpeechMatch({
      recognized: given,
      target: currentQ.answer,
      wordForms: currentQ.acceptedAnswers,
      threshold: 0.6,
    });
    const correct = exact || fuzzy.passed;

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setLastCorrect(correct);
    setPhase("feedback");

    if (correct) {
      setCorrectCount((c) => c + 1);
      setFinishedCount((c) => c + 1);
      onWordResult(currentQ.wordId, true);
    } else if (newAttempts >= 3) {
      // 3번 틀리면 이력 기록 + 다음 문제 (틀린 것으로)
      setFinishedCount((c) => c + 1);
      onWordResult(currentQ.wordId, false);
    }
    // 1~2번 틀렸을 땐 phase=feedback 이지만 onWordResult 는 아직 호출 안 함
  }

  function proceedAfterFeedback() {
    if (lastCorrect || attempts >= 3) {
      // 다음 문제로
      setQIdx((i) => i + 1);
    } else {
      // 같은 문제 재시도
      setTyped("");
      setPhase("answering");
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }

  // 완료 화면
  if (allDone) {
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <Shell onClose={onClose}>
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 72, marginBottom: 8 }}>
            {pct === 100 ? "🏆" : pct >= 60 ? "🎉" : "💪"}
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#1F2937", marginBottom: 6 }}>
            수고했어요!
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: PURPLE_DARK, marginBottom: 20 }}>
            {correctCount} / {total} 정답 ({pct}%)
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => {
                setQueue(questions);
                setQIdx(0);
                setCorrectCount(0);
                setFinishedCount(0);
              }}
              style={{
                background: "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")",
                color: "#fff", border: "none", borderRadius: 14,
                padding: "14px 24px", fontSize: 15, fontWeight: 900,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >↻ 다시 풀기</button>
            <button
              onClick={onClose}
              style={{
                background: "#F3F4F6", color: "#374151", border: "none",
                borderRadius: 14, padding: "14px 24px", fontSize: 15, fontWeight: 900,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >닫기</button>
          </div>
        </div>
      </Shell>
    );
  }

  // 문제 화면
  return (
    <Shell onClose={onClose}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: 10, borderBottom: "2px solid " + PURPLE_LIGHT,
      }}>
        <button
          onClick={onClose}
          style={{
            background: PURPLE_LIGHT, border: "none", borderRadius: 10,
            padding: "6px 12px", fontSize: 13, fontWeight: 800, color: PURPLE_DARK,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >← 나가기</button>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#6B7280" }}>
          📝 {finishedCount + 1} / {total}
        </div>
        <div style={{
          background: "linear-gradient(135deg, #FDE68A, #F59E0B)",
          color: "#78350F", fontSize: 12, fontWeight: 900,
          padding: "4px 10px", borderRadius: 999,
        }}>🏆 {correctCount}</div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8, background: PURPLE_LIGHT, borderRadius: 999,
        overflow: "hidden", margin: "10px 0 14px",
      }}>
        <div style={{
          height: "100%", background: "linear-gradient(90deg, " + PURPLE + ", " + PURPLE_DARK + ")",
          width: `${((finishedCount) / total) * 100}%`,
          transition: "width 0.3s ease",
        }} />
      </div>

      {/* Question image */}
      <div style={{
        borderRadius: 18, overflow: "hidden",
        background: PURPLE_LIGHT,
        border: "3px solid " + PURPLE + "33",
        aspectRatio: "16/9",
        boxShadow: "0 10px 26px rgba(139, 92, 246, 0.2)",
      }}>
        <img
          src={`/vocab-images/sentences/${currentQ.wordId}_${currentQ.sentenceIdx}.png`}
          alt=""
          aria-hidden="true"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      {/* Word icon + category (hint context) */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        margin: "14px 0 8px",
      }}>
        <img
          src={`/vocab-images/icons/${currentQ.wordId}.png`}
          alt=""
          aria-hidden="true"
          style={{
            width: 40, height: 40, objectFit: "contain",
            borderRadius: 10, background: PURPLE_LIGHT, padding: 3,
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <div style={{ fontSize: 12, fontWeight: 800, color: PURPLE_DARK }}>
          {currentQ.word.subcategory}
        </div>
      </div>

      {/* Cloze sentence */}
      <div style={{
        background: "linear-gradient(135deg, #fff, " + PURPLE_LIGHT + ")",
        border: "3px solid " + PURPLE_DARK,
        borderRadius: 18, padding: "18px 16px",
        textAlign: "center",
        fontSize: 22, fontWeight: 900, color: "#1F2937",
        letterSpacing: -0.3, lineHeight: 1.6,
        marginBottom: 14,
      }}>
        {currentQ.cloze}
      </div>

      {/* Hint after 2 attempts */}
      {attempts >= 2 && phase !== "feedback" && (
        <div style={{
          background: "#FEF3C7", border: "2px dashed #F59E0B",
          borderRadius: 12, padding: "10px 14px", marginBottom: 10,
          fontSize: 14, fontWeight: 800, color: "#92400E",
          textAlign: "center",
        }}>
          💡 힌트: 첫 글자는 "{currentQ.answer[0]}"
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitAnswer(); }}
          placeholder="정답을 입력하거나 🎤 눌러 말해요"
          disabled={phase !== "answering"}
          style={{
            flex: 1,
            padding: "12px 14px",
            fontSize: 18, fontWeight: 800,
            border: "2px solid " + PURPLE + "55",
            borderRadius: 12,
            fontFamily: "inherit",
            color: "#1F2937",
            outline: "none",
            background: phase === "answering" ? "#fff" : "#F9FAFB",
          }}
        />
        <button
          onClick={recording ? stopRec : startRec}
          disabled={phase !== "answering"}
          aria-label="음성 입력"
          style={{
            background: recording
              ? "linear-gradient(135deg, " + RED + ", #DC2626)"
              : "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")",
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

      {/* Submit / Feedback */}
      {phase === "answering" && (
        <button
          onClick={() => submitAnswer()}
          disabled={!typed.trim()}
          style={{
            width: "100%",
            background: typed.trim()
              ? "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")"
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
        <div style={{
          textAlign: "center", padding: "14px",
          fontSize: 14, fontWeight: 800, color: PURPLE_DARK,
        }}>🎧 인식 중…</div>
      )}

      {phase === "feedback" && (
        <FeedbackBox
          correct={lastCorrect}
          typed={typed}
          answer={currentQ.answer}
          fullSentence={currentQ.word.sentences[currentQ.sentenceIdx].ko}
          attempts={attempts}
          maxedOut={attempts >= 3 && !lastCorrect}
          onPlayOriginal={() => speakKorean(currentQ.word.sentences[currentQ.sentenceIdx].ko)}
          onProceed={proceedAfterFeedback}
        />
      )}
    </Shell>
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
      border: "2.5px solid " + (correct ? GREEN : RED),
      borderRadius: 14, padding: "14px",
      animation: "fbIn 0.25s ease",
    }}>
      <div style={{
        fontSize: 18, fontWeight: 900,
        color: correct ? GREEN_DARK : "#B91C1C",
        marginBottom: 8,
      }}>
        {correct
          ? "✓ 정답!"
          : maxedOut
            ? "😊 다음 문제로 넘어가요"
            : `✗ 다시 해봐요 (${attempts}/3)`}
      </div>

      {!correct && (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#4B5563", lineHeight: 1.5 }}>
          네 답: "{typed || "(빈 답)"}"<br/>
          정답: <span style={{ color: GREEN_DARK, fontWeight: 900 }}>"{answer}"</span>
        </div>
      )}

      {(correct || maxedOut) && (
        <div style={{
          marginTop: 8,
          fontSize: 14, fontWeight: 700, color: "#1F2937",
          background: "#fff", padding: "8px 12px", borderRadius: 8,
        }}>
          전체 문장: "{fullSentence}"
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
            background: "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")",
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
      `}</style>
    </div>
  );
}

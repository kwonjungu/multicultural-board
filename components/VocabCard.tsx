"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { VocabWord } from "@/lib/vocabWords";
import { t } from "@/lib/i18n";
import VocabRecorder from "./VocabRecorder";
import DrawingCanvas from "./DrawingCanvas";

const TTS_LANG_MAP: Record<string, string> = {
  ko: "ko-KR", en: "en-US", vi: "vi-VN", zh: "zh-CN", fil: "fil-PH",
  ja: "ja-JP", th: "th-TH", km: "km-KH", mn: "mn-MN", ru: "ru-RU",
  uz: "uz-UZ", hi: "hi-IN", id: "id-ID", ar: "ar-SA", my: "my-MM",
};

const WEB_SPEECH_SUPPORTED = new Set(["ko", "en", "vi", "zh", "ja", "th", "ru", "hi", "id", "ar"]);

let serverTtsAudio: HTMLAudioElement | null = null;

async function speakKorean(text: string, rate = 1) {
  if (typeof window === "undefined") return;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const hasVoice = voices.some((v) => v.lang.startsWith("ko"));
  if (WEB_SPEECH_SUPPORTED.has("ko") && hasVoice) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = TTS_LANG_MAP.ko;
    u.rate = rate;
    window.speechSynthesis.speak(u);
    return;
  }
  try {
    window.speechSynthesis?.cancel();
    if (serverTtsAudio) { serverTtsAudio.pause(); serverTtsAudio = null; }
    const url = `/api/tts?lang=ko&text=${encodeURIComponent(text.slice(0, 200))}`;
    const audio = new Audio(url);
    audio.playbackRate = rate;
    serverTtsAudio = audio;
    await audio.play();
  } catch {
    // silent
  }
}

type Mode = "listen" | "speak" | "write";

interface Props {
  word: VocabWord;
  lang: string;
  doneSentences: number[];
  onSentenceDone: (idx: number) => void;
  onListenBump: () => void;
  onClose: () => void;
}

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";

export default function VocabCard({
  word, lang, doneSentences, onSentenceDone, onListenBump, onClose,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [rate, setRate] = useState(1);
  const [mode, setMode] = useState<Mode>("listen");

  const sentence = word.sentences[idx];
  const doneSet = useMemo(() => new Set(doneSentences), [doneSentences]);
  const isDone = doneSet.has(idx);
  const mastered = doneSet.size >= 3;

  // 모드 변경 / 예문 변경 시 상태 리셋
  function switchMode(m: Mode) { setMode(m); }
  function switchIdx(i: number) { setIdx(i); setMode("listen"); }

  function handleDone() {
    onSentenceDone(idx);
    if (idx < 2) setTimeout(() => { setIdx((p) => Math.min(2, p + 1)); setMode("listen"); }, 300);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15, 10, 40, 0.72)",
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
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: 8, borderBottom: "2px solid " + PURPLE_LIGHT,
        }}>
          <button onClick={onClose} aria-label="닫기" style={headerBtnStyle}>
            {t("vocabBack", lang)}
          </button>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#6B7280" }}>
            {idx + 1} / 3
          </div>
        </div>

        {/* Word title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 10px" }}>
          <img
            src={`/vocab-images/icons/${word.id}.png`}
            alt={word.ko}
            style={{
              width: 56, height: 56, objectFit: "contain",
              borderRadius: 14, background: PURPLE_LIGHT,
              padding: 4, flexShrink: 0,
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
              {word.ko}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: PURPLE_DARK, marginTop: 2 }}>
              {word.subcategory} · {word.category}
            </div>
          </div>
          {mastered && (
            <div style={{
              background: "linear-gradient(135deg, #FDE68A, #F59E0B)",
              color: "#78350F", fontSize: 12, fontWeight: 900,
              padding: "6px 10px", borderRadius: 999, flexShrink: 0,
              boxShadow: "0 4px 10px rgba(245,158,11,0.35)",
            }}>{t("vocabMastered", lang)}</div>
          )}
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "6px 0 14px" }}>
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => switchIdx(i)}
              aria-label={`예문 ${i + 1}`}
              style={{
                width: i === idx ? 28 : 16, height: 10, borderRadius: 999, border: "none",
                cursor: "pointer",
                background: doneSet.has(i) ? PURPLE : (i === idx ? PURPLE_DARK : "#E5E7EB"),
                transition: "width 0.2s, background 0.2s",
              }}
            />
          ))}
        </div>

        {/* Illustration */}
        <div style={{
          borderRadius: 20, overflow: "hidden", background: PURPLE_LIGHT,
          border: "3px solid " + PURPLE + "33",
          aspectRatio: "16/9",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 10px 30px rgba(139, 92, 246, 0.18)",
        }}>
          <img
            src={`/vocab-images/sentences/${word.id}_${idx}.png`}
            alt={sentence.ko}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Korean sentence */}
        <div style={{
          margin: "18px 0 10px",
          background: "linear-gradient(135deg, #FFFFFF, " + PURPLE_LIGHT + ")",
          border: "3px solid " + PURPLE_DARK,
          borderRadius: 18, padding: "18px 16px",
          textAlign: "center",
          fontSize: 24, fontWeight: 900, color: "#1F2937",
          letterSpacing: -0.3, lineHeight: 1.5,
          boxShadow: "0 6px 16px rgba(109, 40, 217, 0.15)",
        }}>
          {sentence.ko}
        </div>

        {/* Situation */}
        <div style={{
          fontSize: 13, color: PURPLE_DARK, fontWeight: 700,
          textAlign: "center", margin: "6px 0 16px", padding: "0 8px",
          lineHeight: 1.5,
        }}>
          {t("vocabSituation", lang)}: {sentence.situation}
        </div>

        {/* Mode tabs */}
        <div style={{
          display: "flex", gap: 4, background: "#F3F4F6", padding: 4,
          borderRadius: 12, marginBottom: 14,
        }}>
          {([
            { k: "listen" as Mode, icon: "👂", label: "듣기" },
            { k: "speak" as Mode, icon: "🎤", label: "말하기" },
            { k: "write" as Mode, icon: "✏️", label: "쓰기" },
          ]).map((m) => (
            <button
              key={m.k}
              onClick={() => switchMode(m.k)}
              style={{
                flex: 1,
                background: mode === m.k
                  ? "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")"
                  : "transparent",
                color: mode === m.k ? "#fff" : "#374151",
                border: "none", borderRadius: 10,
                padding: "10px 6px", fontSize: 13, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                boxShadow: mode === m.k ? "0 6px 14px rgba(139, 92, 246, 0.35)" : "none",
              }}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Mode content */}
        {mode === "listen" && (
          <ListenPanel
            rate={rate}
            setRate={setRate}
            onPlay={() => { speakKorean(sentence.ko, rate); onListenBump(); }}
            onDone={handleDone}
            isDone={isDone}
            lang={lang}
          />
        )}

        {mode === "speak" && (
          <VocabRecorder
            sentenceText={sentence.ko}
            onOriginalPlay={() => { speakKorean(sentence.ko, rate); onListenBump(); }}
            onComplete={handleDone}
          />
        )}

        {mode === "write" && (
          <WritePanel
            sentenceText={sentence.ko}
            onDone={handleDone}
            isDone={isDone}
            lang={lang}
          />
        )}

        {/* Nav */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={() => { setIdx((p) => Math.max(0, p - 1)); setMode("listen"); }}
            disabled={idx === 0}
            style={navBtnStyle(idx === 0)}
          >◀ {t("vocabPrev", lang)}</button>
          <button
            onClick={() => { setIdx((p) => Math.min(2, p + 1)); setMode("listen"); }}
            disabled={idx === 2}
            style={navBtnStyle(idx === 2)}
          >{t("vocabNext", lang)} ▶</button>
        </div>

        {/* Conjugations */}
        {word.conjugations.length > 0 && (
          <div style={{
            marginTop: 16, padding: "10px 14px",
            background: "#FAFAFA", borderRadius: 12,
            fontSize: 13, color: "#4B5563", fontWeight: 700,
            textAlign: "center", lineHeight: 1.8,
          }}>
            <span style={{ color: PURPLE_DARK, fontWeight: 900 }}>활용: </span>
            {word.conjugations.join(" · ")}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(60px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}

// ────────────── Listen panel ──────────────

function ListenPanel({
  rate, setRate, onPlay, onDone, isDone, lang,
}: {
  rate: number; setRate: (r: number) => void;
  onPlay: () => void; onDone: () => void; isDone: boolean; lang: string;
}) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        marginBottom: 14,
      }}>
        <button
          onClick={onPlay}
          style={{
            background: "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")",
            color: "#fff", border: "none", borderRadius: 16,
            padding: "14px 28px", fontSize: 18, fontWeight: 900,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 8px 20px rgba(139, 92, 246, 0.4)",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          🔊 {t("vocabListen", lang)}
        </button>
        <div style={{ display: "flex", gap: 4, background: PURPLE_LIGHT, padding: 4, borderRadius: 10 }}>
          {[
            { v: 0.75, label: "느림" },
            { v: 1, label: "보통" },
            { v: 1.25, label: "빠름" },
          ].map((r) => (
            <button
              key={r.v}
              onClick={() => setRate(r.v)}
              style={{
                background: rate === r.v ? PURPLE : "transparent",
                color: rate === r.v ? "#fff" : PURPLE_DARK,
                border: "none", borderRadius: 8,
                padding: "6px 10px", fontSize: 11, fontWeight: 900,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >{r.label}</button>
          ))}
        </div>
      </div>
      <button onClick={onDone} style={doneBtnStyle(isDone)}>
        {isDone ? "✓ 이미 완료" : "✓ " + t("vocabDone", lang)}
      </button>
    </div>
  );
}

// ────────────── Write panel ──────────────

function WritePanel({
  sentenceText, onDone, isDone, lang,
}: {
  sentenceText: string; onDone: () => void; isDone: boolean; lang: string;
}) {
  const [typed, setTyped] = useState("");
  const [showHint, setShowHint] = useState(true);
  const [usedCanvas, setUsedCanvas] = useState(false);
  const timerRef = useRef<number | null>(null);

  // 힌트 3초 뒤 숨김
  useEffect(() => {
    setShowHint(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShowHint(false), 3000);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [sentenceText]);

  const similarity = useMemo(() => compareStrings(typed, sentenceText), [typed, sentenceText]);
  const typedGood = typed.length >= Math.max(4, Math.floor(sentenceText.length * 0.6)) && similarity >= 0.7;

  return (
    <div style={{
      background: "#FAFAFA",
      border: "2px dashed " + PURPLE + "44",
      borderRadius: 16,
      padding: "16px 14px",
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#4B5563", textAlign: "center", marginBottom: 10 }}>
        ✏️ 예문을 따라 써 보세요
      </div>

      {/* Hint */}
      <div style={{
        background: showHint ? PURPLE_LIGHT : "#F3F4F6",
        border: showHint ? "2px solid " + PURPLE : "2px dashed #D1D5DB",
        borderRadius: 12, padding: "10px 14px", marginBottom: 12,
        textAlign: "center",
        fontSize: 15, fontWeight: showHint ? 800 : 600,
        color: showHint ? PURPLE_DARK : "#9CA3AF",
        transition: "all 0.3s",
        minHeight: 42, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {showHint ? sentenceText : "힌트 숨김 · 기억해서 써 보세요"}
      </div>

      {!showHint && (
        <button
          onClick={() => { setShowHint(true); if (timerRef.current) window.clearTimeout(timerRef.current); timerRef.current = window.setTimeout(() => setShowHint(false), 3000); }}
          style={{
            width: "100%", background: "transparent", color: PURPLE_DARK,
            border: "1.5px dashed " + PURPLE, borderRadius: 10,
            padding: "6px", fontSize: 12, fontWeight: 800, cursor: "pointer",
            fontFamily: "inherit", marginBottom: 12,
          }}
        >👁️ 다시 보기 (3초)</button>
      )}

      {/* Typed input */}
      <textarea
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="여기에 예문을 따라 써 보세요..."
        rows={2}
        style={{
          width: "100%", boxSizing: "border-box",
          border: "2px solid " + PURPLE + "55", borderRadius: 12,
          padding: "10px 12px", fontSize: 16, fontWeight: 700,
          fontFamily: "inherit", color: "#1F2937",
          resize: "vertical", outline: "none",
          background: "#fff",
        }}
      />

      {typed.length > 0 && (
        <div style={{
          marginTop: 6, fontSize: 12, fontWeight: 800,
          color: typedGood ? "#059669" : "#B45309",
        }}>
          {typedGood
            ? "👍 좋아요! 거의 똑같아요"
            : `유사도 ${Math.round(similarity * 100)}% — 더 비슷하게 써볼까요?`}
        </div>
      )}

      {/* Canvas option */}
      <details style={{ marginTop: 12 }}>
        <summary style={{
          cursor: "pointer", fontSize: 13, fontWeight: 800, color: PURPLE_DARK,
          padding: "6px 0",
        }}>
          ✍️ 손으로 써 보기
        </summary>
        <div style={{ marginTop: 8 }}>
          <DrawingCanvas onDone={() => setUsedCanvas(true)} />
          {usedCanvas && (
            <div style={{ fontSize: 12, fontWeight: 800, color: "#059669", marginTop: 6 }}>
              👍 손글씨도 완성했어요!
            </div>
          )}
        </div>
      </details>

      <button
        onClick={onDone}
        disabled={!isDone && !typedGood && !usedCanvas}
        style={{
          ...doneBtnStyle(isDone),
          marginTop: 12,
          opacity: !isDone && !typedGood && !usedCanvas ? 0.5 : 1,
          cursor: !isDone && !typedGood && !usedCanvas ? "default" : "pointer",
        }}
      >
        {isDone ? "✓ 이미 완료" : "✓ " + t("vocabDone", lang)}
      </button>
    </div>
  );
}

// ────────────── Similarity (Jaccard on characters + length ratio) ──────────────

function compareStrings(a: string, b: string): number {
  if (!a || !b) return 0;
  const normA = a.replace(/\s+/g, "").replace(/[.!?,]/g, "");
  const normB = b.replace(/\s+/g, "").replace(/[.!?,]/g, "");
  if (!normA || !normB) return 0;
  const setA = new Set(normA.split(""));
  const setB = new Set(normB.split(""));
  const arrA = Array.from(setA);
  const arrB = Array.from(setB);
  const common = arrA.filter((c) => setB.has(c)).length;
  const union = new Set(arrA.concat(arrB)).size;
  const jaccard = common / union;
  const lenRatio = Math.min(normA.length, normB.length) / Math.max(normA.length, normB.length);
  return jaccard * 0.7 + lenRatio * 0.3;
}

// ────────────── Shared styles ──────────────

const headerBtnStyle: React.CSSProperties = {
  background: PURPLE_LIGHT, border: "none", borderRadius: 10,
  padding: "6px 12px", fontSize: 14, fontWeight: 800, color: PURPLE_DARK,
  cursor: "pointer", fontFamily: "inherit",
};

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: disabled ? "#F3F4F6" : PURPLE_LIGHT,
    color: disabled ? "#9CA3AF" : PURPLE_DARK,
    border: "none", borderRadius: 12,
    padding: "12px", fontSize: 14, fontWeight: 800,
    cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
  };
}

function doneBtnStyle(isDone: boolean): React.CSSProperties {
  return {
    width: "100%",
    background: isDone
      ? "linear-gradient(135deg, #10B981, #059669)"
      : "linear-gradient(135deg, #F59E0B, #D97706)",
    color: "#fff", border: "none", borderRadius: 14,
    padding: "14px", fontSize: 16, fontWeight: 900,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 6px 16px rgba(245, 158, 11, 0.3)",
  };
}

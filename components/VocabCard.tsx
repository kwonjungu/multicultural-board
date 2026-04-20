"use client";

import { useState, useMemo } from "react";
import { VocabWord } from "@/lib/vocabWords";
import { t } from "@/lib/i18n";

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

interface Props {
  word: VocabWord;
  lang: string;                            // 학생의 모국어 (UI 라벨용)
  doneSentences: number[];                 // 이미 완료한 예문 인덱스
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

  const sentence = word.sentences[idx];
  const doneSet = useMemo(() => new Set(doneSentences), [doneSentences]);
  const isDone = doneSet.has(idx);
  const allDone = doneSet.size + (isDone ? 0 : 1) >= 3; // 현재 완료 눌렀을 때 3개 채워지는지

  const mastered = doneSet.size >= 3;

  function handleListen() {
    speakKorean(sentence.ko, rate);
    onListenBump();
  }
  function handleDone() {
    onSentenceDone(idx);
    // 다음 예문으로 자동 진행 (마지막이면 그대로)
    if (idx < 2) setTimeout(() => setIdx((p) => Math.min(2, p + 1)), 250);
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
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: PURPLE_LIGHT, border: "none", borderRadius: 10,
              padding: "6px 12px", fontSize: 14, fontWeight: 800, color: PURPLE_DARK,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >{t("vocabBack", lang)}</button>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#6B7280" }}>
            {idx + 1} / 3
          </div>
        </div>

        {/* Word title */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          margin: "14px 0 10px",
        }}>
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
              onClick={() => setIdx(i)}
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
          aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 10px 30px rgba(139, 92, 246, 0.18)",
        }}>
          <img
            src={`/vocab-images/sentences/${word.id}_${idx}.png`}
            alt={sentence.ko}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = "none";
              const parent = el.parentElement;
              if (parent && !parent.querySelector(".vocab-img-fallback")) {
                const fb = document.createElement("div");
                fb.className = "vocab-img-fallback";
                fb.style.cssText = "font-size:64px;color:" + PURPLE_DARK + ";";
                fb.textContent = "📖";
                parent.appendChild(fb);
              }
            }}
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

        {/* Listen controls */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          margin: "0 0 14px",
        }}>
          <button
            onClick={handleListen}
            aria-label={t("vocabListen", lang)}
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

        {/* Done button + nav */}
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <button
            onClick={() => setIdx((p) => Math.max(0, p - 1))}
            disabled={idx === 0}
            style={{
              background: "#F3F4F6", color: idx === 0 ? "#9CA3AF" : "#374151",
              border: "none", borderRadius: 14, padding: "14px 16px",
              fontSize: 15, fontWeight: 800, cursor: idx === 0 ? "default" : "pointer",
              fontFamily: "inherit", minWidth: 80,
            }}
          >◀</button>

          <button
            onClick={handleDone}
            style={{
              flex: 1,
              background: isDone
                ? "linear-gradient(135deg, #10B981, #059669)"
                : "linear-gradient(135deg, #F59E0B, #D97706)",
              color: "#fff", border: "none", borderRadius: 14,
              padding: "14px 16px", fontSize: 17, fontWeight: 900,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 6px 16px rgba(245, 158, 11, 0.35)",
            }}
          >
            {isDone ? "✓ " + t("vocabDone", lang) : "✓ " + t("vocabDone", lang)}
            {allDone && !mastered ? " 🎉" : ""}
          </button>

          <button
            onClick={() => setIdx((p) => Math.min(2, p + 1))}
            disabled={idx === 2}
            style={{
              background: "#F3F4F6", color: idx === 2 ? "#9CA3AF" : "#374151",
              border: "none", borderRadius: 14, padding: "14px 16px",
              fontSize: 15, fontWeight: 800, cursor: idx === 2 ? "default" : "pointer",
              fontFamily: "inherit", minWidth: 80,
            }}
          >▶</button>
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

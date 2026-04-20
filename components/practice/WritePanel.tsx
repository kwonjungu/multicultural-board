"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { sentenceSimilarity } from "@/lib/vocabUtils";
import { t } from "@/lib/i18n";
import DrawingCanvas from "../DrawingCanvas";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";

interface Props {
  sentenceText: string;
  onDone: () => void;
  isDone: boolean;
  lang: string;
}

export default function WritePanel({ sentenceText, onDone, isDone, lang }: Props) {
  const [typed, setTyped] = useState("");
  const [showHint, setShowHint] = useState(true);
  const [usedCanvas, setUsedCanvas] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setShowHint(true);
    setTyped("");
    setUsedCanvas(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShowHint(false), 3000);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [sentenceText]);

  const similarity = useMemo(() => sentenceSimilarity(typed, sentenceText), [typed, sentenceText]);
  const typedGood = typed.length >= Math.max(4, Math.floor(sentenceText.length * 0.6)) && similarity >= 0.7;

  return (
    <div style={{
      background: "#FAFAFA",
      border: "2px dashed " + PURPLE + "44",
      borderRadius: 16,
      padding: "16px 14px",
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#4B5563", textAlign: "center", marginBottom: 10 }}>
        ✏️ 문장을 따라 써 보세요
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
          onClick={() => {
            setShowHint(true);
            if (timerRef.current) window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => setShowHint(false), 3000);
          }}
          style={{
            width: "100%", background: "transparent", color: PURPLE_DARK,
            border: "1.5px dashed " + PURPLE, borderRadius: 10,
            padding: "6px", fontSize: 12, fontWeight: 800, cursor: "pointer",
            fontFamily: "inherit", marginBottom: 12,
          }}
        >👁️ 다시 보기 (3초)</button>
      )}

      <textarea
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="여기에 문장을 따라 써 보세요..."
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
          width: "100%",
          background: isDone
            ? "linear-gradient(135deg, #10B981, #059669)"
            : "linear-gradient(135deg, #F59E0B, #D97706)",
          color: "#fff", border: "none", borderRadius: 14,
          padding: "14px", fontSize: 16, fontWeight: 900,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 6px 16px rgba(245, 158, 11, 0.3)",
          marginTop: 12,
          opacity: !isDone && !typedGood && !usedCanvas ? 0.5 : 1,
        }}
      >
        {isDone ? "✓ 이미 완료" : "✓ " + t("vocabDone", lang)}
      </button>
    </div>
  );
}

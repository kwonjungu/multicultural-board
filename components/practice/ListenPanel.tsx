"use client";

import { t } from "@/lib/i18n";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";

interface Props {
  rate: number;
  setRate: (r: number) => void;
  onPlay: () => void;
  onDone: () => void;
  isDone: boolean;
  lang: string;
}

export default function ListenPanel({ rate, setRate, onPlay, onDone, isDone, lang }: Props) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        marginBottom: 14, flexWrap: "wrap",
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
      <button
        onClick={onDone}
        style={{
          width: "100%",
          background: isDone
            ? "linear-gradient(135deg, #10B981, #059669)"
            : "linear-gradient(135deg, #F59E0B, #D97706)",
          color: "#fff", border: "none", borderRadius: 14,
          padding: "14px", fontSize: 16, fontWeight: 900,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 6px 16px rgba(245, 158, 11, 0.3)",
        }}
      >
        {isDone ? "✓ 이미 완료" : "✓ " + t("vocabDone", lang)}
      </button>
    </div>
  );
}

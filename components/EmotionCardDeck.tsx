"use client";
import { useState } from "react";
import { EXPRESS_EMOTIONS, type EmotionId } from "@/lib/emotions";

interface Props {
  lang: string;
  onPick: (emotionId: EmotionId, intensity: 1 | 2 | 3) => void | Promise<void>;
  // true 면 강도 선택을 생략(원탭) — 그림책 응답 탭처럼 빠른 입력에 사용.
  quick?: boolean;
  busy?: boolean;
}

export default function EmotionCardDeck({ lang, onPick, quick = false, busy = false }: Props) {
  const [pending, setPending] = useState<EmotionId | null>(null);

  async function handlePick(id: EmotionId, intensity: 1 | 2 | 3) {
    setPending(id);
    try {
      await onPick(id, intensity);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {EXPRESS_EMOTIONS.map((e) => {
          const label = e.label[lang] ?? e.label.en ?? e.label.ko ?? e.id;
          const isPending = pending === e.id;
          return (
            <button
              key={e.id}
              onClick={() => handlePick(e.id, quick ? 2 : 2)}
              disabled={busy || pending !== null}
              aria-label={label}
              style={{
                position: "relative",
                padding: "12px 6px 10px",
                borderRadius: 16,
                border: "2px solid rgba(0,0,0,0.06)",
                background: `linear-gradient(135deg, ${e.hue}22, ${e.hue}44)`,
                cursor: busy || pending !== null ? "not-allowed" : "pointer",
                opacity: busy && !isPending ? 0.55 : 1,
                transition: "transform 0.12s, box-shadow 0.12s",
                boxShadow: isPending
                  ? `0 0 0 3px ${e.hue}, 0 6px 16px ${e.hue}55`
                  : "0 2px 6px rgba(0,0,0,0.06)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minHeight: 84,
              }}
              onMouseDown={(ev) => {
                if (!busy && pending === null) ev.currentTarget.style.transform = "scale(0.94)";
              }}
              onMouseUp={(ev) => (ev.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(ev) => (ev.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{ fontSize: 32, lineHeight: 1 }} aria-hidden>
                {e.emoji}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "#1F2937",
                  lineHeight: 1.2,
                  textAlign: "center",
                  letterSpacing: -0.2,
                }}
              >
                {label}
              </div>
            </button>
          );
        })}
      </div>
      {!quick && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "#6B7280",
            textAlign: "center",
          }}
        >
          카드를 눌러 지금 내 감정을 친구에게 보여주세요
        </div>
      )}
    </div>
  );
}

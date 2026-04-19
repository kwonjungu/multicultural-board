"use client";

import { CSSProperties } from "react";
import type { CultureCardData } from "@/lib/yutTypes";
import { REGION_EMOJI, REGION_NAME } from "@/lib/yutData";

interface Props {
  data: CultureCardData;
  viewerLang: string;
  onClose: () => void;
}

// Pronounce helper: use SpeechSynthesis if available.
function speak(text: string, lang: string): void {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    synth.cancel();
    synth.speak(u);
  } catch {
    /* noop */
  }
}

export function CultureCard({ data, viewerLang, onClose }: Props): JSX.Element {
  const regionName = REGION_NAME[data.region][viewerLang] ?? REGION_NAME[data.region].ko;

  return (
    <div style={backdrop} role="dialog" aria-modal="true" aria-label="문화 카드">
      <div style={card}>
        <div style={header}>
          <span style={flag}>{REGION_EMOJI[data.region]}</span>
          <strong style={title}>{regionName}</strong>
        </div>
        <div style={list}>
          {data.greetings.map((g, i) => (
            <button
              key={i}
              type="button"
              onClick={() => speak(g.greet, g.lang)}
              style={row}
              aria-label={`${g.lang} 인사말 듣기`}
            >
              <span style={langChip}>{g.lang.toUpperCase()}</span>
              <span style={greetText}>{g.greet}</span>
              {g.roman && <span style={romanText}>{g.roman}</span>}
              <span style={speakerIcon} aria-hidden>
                🔊
              </span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} style={closeBtn}>
          계속 →
        </button>
      </div>
    </div>
  );
}

const backdrop: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(120, 53, 15, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  borderRadius: 24,
};

const card: CSSProperties = {
  background: "#FFFBEB",
  border: "3px solid #F59E0B",
  borderRadius: 20,
  padding: "18px 18px 14px",
  width: "min(92%, 360px)",
  boxShadow: "0 8px 28px rgba(120,53,15,0.35)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
};

const flag: CSSProperties = {
  fontSize: 36,
};

const title: CSSProperties = {
  fontSize: 20,
  color: "#7C2D12",
};

const list: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginBottom: 14,
};

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  background: "#FEF3C7",
  border: "2px solid #FDE68A",
  borderRadius: 12,
  cursor: "pointer",
  color: "#7C2D12",
  fontWeight: 700,
  textAlign: "left",
};

const langChip: CSSProperties = {
  fontSize: 11,
  background: "#B45309",
  color: "#FFFBEB",
  borderRadius: 999,
  padding: "2px 8px",
  fontWeight: 900,
  letterSpacing: 0.5,
};

const greetText: CSSProperties = {
  fontSize: 18,
  flex: 1,
};

const romanText: CSSProperties = {
  fontSize: 12,
  color: "#92400E",
  fontWeight: 500,
};

const speakerIcon: CSSProperties = {
  fontSize: 18,
};

const closeBtn: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#B45309",
  color: "#FFFBEB",
  border: "none",
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
};

"use client";

import { CSSProperties } from "react";

type Mood = "happy" | "cheer" | "think" | "wave" | "sleep";

export default function BeeMascot({
  size = 96,
  mood = "happy",
  flying = true,
  style,
}: {
  size?: number;
  mood?: Mood;
  flying?: boolean;
  style?: CSSProperties;
}) {
  const eye = mood === "sleep" ? "—" : mood === "think" ? "•" : "●";
  const mouth =
    mood === "cheer" ? "M26 44 Q32 52 38 44"
    : mood === "think" ? "M28 46 L36 46"
    : mood === "wave" ? "M26 44 Q32 50 38 44"
    : "M26 44 Q32 48 38 44";

  return (
    <div
      style={{
        display: "inline-block",
        width: size, height: size,
        animation: flying ? "beeHover 2.6s ease-in-out infinite" : undefined,
        filter: "drop-shadow(0 6px 16px rgba(245,158,11,0.35))",
        ...style,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <radialGradient id="beeBody" cx="0.45" cy="0.35" r="0.75">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="60%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>
          <radialGradient id="beeWing" cx="0.3" cy="0.3" r="0.8">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.75" />
          </radialGradient>
        </defs>

        {/* Wings */}
        <g style={{ transformOrigin: "24px 20px", animation: "beeWingL 0.18s ease-in-out infinite alternate" }}>
          <ellipse cx="22" cy="18" rx="12" ry="8" fill="url(#beeWing)" stroke="#60A5FA" strokeWidth="0.6" opacity="0.85"/>
        </g>
        <g style={{ transformOrigin: "40px 20px", animation: "beeWingR 0.18s ease-in-out infinite alternate" }}>
          <ellipse cx="42" cy="18" rx="12" ry="8" fill="url(#beeWing)" stroke="#60A5FA" strokeWidth="0.6" opacity="0.85"/>
        </g>

        {/* Body */}
        <ellipse cx="32" cy="36" rx="20" ry="16" fill="url(#beeBody)" />
        {/* Stripes */}
        <path d="M18 32 Q32 38 46 32" stroke="#1F2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M16 40 Q32 48 48 40" stroke="#1F2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Antennae */}
        <path d="M26 22 Q24 14 20 12" stroke="#1F2937" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M38 22 Q40 14 44 12" stroke="#1F2937" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="20" cy="12" r="1.8" fill="#1F2937" />
        <circle cx="44" cy="12" r="1.8" fill="#1F2937" />
        {/* Eyes */}
        <text x="26" y="34" textAnchor="middle" fontSize="7" fontWeight="700" fill="#1F2937">{eye}</text>
        <text x="38" y="34" textAnchor="middle" fontSize="7" fontWeight="700" fill="#1F2937">{eye}</text>
        {/* Cheeks */}
        <circle cx="22" cy="40" r="2.4" fill="#FB7185" opacity="0.55" />
        <circle cx="42" cy="40" r="2.4" fill="#FB7185" opacity="0.55" />
        {/* Mouth */}
        <path d={mouth} stroke="#1F2937" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* Stinger */}
        <path d="M32 52 L30 56 L32 55 L34 56 Z" fill="#1F2937" />
      </svg>

      <style jsx>{`
        @keyframes beeHover {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-6px) rotate(3deg); }
        }
        @keyframes beeWingL {
          from { transform: rotate(-18deg); }
          to { transform: rotate(4deg); }
        }
        @keyframes beeWingR {
          from { transform: rotate(18deg); }
          to { transform: rotate(-4deg); }
        }
      `}</style>
    </div>
  );
}

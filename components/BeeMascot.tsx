"use client";

import { CSSProperties } from "react";

export type Mood =
  | "happy" | "cheer" | "think" | "wave" | "sleep"
  | "welcome" | "loading" | "success" | "oops" | "confused" | "celebrate" | "shh";

type EyeShape = "normal" | "line" | "dot" | "happy" | "star" | "x";

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
  const eyeShape: EyeShape = (() => {
    switch (mood) {
      case "sleep": return "line";
      case "think":
      case "confused": return "dot";
      case "celebrate":
      case "success": return "star";
      case "wave":
      case "welcome":
      case "cheer": return "happy";
      case "oops": return "x";
      default: return "normal";
    }
  })();

  const mouthPath = (() => {
    switch (mood) {
      case "cheer":
      case "celebrate":
      case "success":
      case "welcome": return "M25 43 Q32 53 39 43";
      case "think": return "M28 46 L36 46";
      case "wave": return "M26 44 Q32 50 38 44";
      case "sleep": return "M29 46 Q32 48 35 46";
      case "oops": return "M27 48 Q32 43 37 48";
      case "confused": return "M27 46 Q31 50 33 46 Q35 42 37 46";
      case "shh": return "M30 46 L34 46";
      default: return "M26 44 Q32 48 38 44";
    }
  })();

  const showSweatDrop = mood === "oops";
  const showThinkBubble = mood === "confused" || mood === "think";
  const showSparkle = mood === "success" || mood === "celebrate";
  const showZzz = mood === "sleep";
  const showHeart = mood === "success";
  const showConfetti = mood === "celebrate";
  const showFinger = mood === "shh";
  const showHand = mood === "wave" || mood === "welcome";
  const showHoneyPot = mood === "loading";
  const cheekOpacity =
    mood === "cheer" || mood === "celebrate" || mood === "success" || mood === "welcome" ? 0.8 : 0.55;

  const wingAnim = mood === "sleep" ? undefined : "beeWingL 0.18s ease-in-out infinite alternate";
  const wingAnimR = mood === "sleep" ? undefined : "beeWingR 0.18s ease-in-out infinite alternate";

  return (
    <div
      style={{
        display: "inline-block",
        width: size, height: size,
        animation: flying ? "beeHover 2.6s ease-in-out infinite" : undefined,
        filter: "drop-shadow(0 8px 20px rgba(245,158,11,0.4))",
        ...style,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 72" width={size} height={size} style={{ overflow: "visible" }}>
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

        {showConfetti && (
          <g>
            <rect x="6" y="8" width="3" height="6" fill="#FB7185" transform="rotate(20 7.5 11)" />
            <rect x="54" y="6" width="3" height="6" fill="#5EEAD4" transform="rotate(-20 55.5 9)" />
            <rect x="10" y="2" width="2.5" height="5" fill="#A78BFA" transform="rotate(10 11 4)" />
            <rect x="50" y="14" width="2.5" height="5" fill="#FACC15" transform="rotate(-15 51 16)" />
            <circle cx="2" cy="18" r="1.6" fill="#F472B6" />
            <circle cx="60" cy="20" r="1.6" fill="#60A5FA" />
          </g>
        )}

        {showSparkle && (
          <g>
            <path d="M54 6 L55 10 L59 11 L55 12 L54 16 L53 12 L49 11 L53 10 Z" fill="#FACC15" />
            <path d="M8 10 L8.5 12.5 L11 13 L8.5 13.5 L8 16 L7.5 13.5 L5 13 L7.5 12.5 Z" fill="#FACC15" />
          </g>
        )}

        {showZzz && (
          <g style={{ animation: "zzzFloat 2s ease-in-out infinite" }}>
            <text x="48" y="10" fontSize="8" fontWeight="800" fill="#60A5FA">Z</text>
            <text x="54" y="4" fontSize="6" fontWeight="800" fill="#93C5FD">z</text>
          </g>
        )}

        {showThinkBubble && (
          <g>
            <circle cx="52" cy="10" r="5" fill="#fff" stroke="#E5E7EB" strokeWidth="1" />
            <text x="52" y="13" textAnchor="middle" fontSize="7" fontWeight="900" fill="#6B7280">?</text>
            <circle cx="46" cy="16" r="1.5" fill="#fff" stroke="#E5E7EB" strokeWidth="0.8" />
          </g>
        )}

        {showHeart && (
          <g style={{ animation: "heartPop 1.2s ease-out infinite" }}>
            <path d="M8 8 C8 5 10 4 11 6 C12 4 14 5 14 8 C14 10 11 12 11 12 C11 12 8 10 8 8 Z" fill="#FB7185" />
          </g>
        )}

        {showHoneyPot && (
          <g>
            <ellipse cx="52" cy="16" rx="5" ry="4" fill="#D97706" />
            <rect x="47.5" y="13" width="9" height="2" fill="#92400E" />
            <path d="M52 12 Q54 9 52 6" stroke="#F59E0B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        )}

        {showSweatDrop && <path d="M50 18 Q48 22 50 24 Q52 22 50 18 Z" fill="#60A5FA" />}

        <g style={{ transformOrigin: "24px 20px", animation: wingAnim }}>
          <ellipse cx="22" cy="18" rx="12" ry="8" fill="url(#beeWing)" stroke="#60A5FA" strokeWidth="0.6" opacity="0.85" />
        </g>
        <g style={{ transformOrigin: "40px 20px", animation: wingAnimR }}>
          <ellipse cx="42" cy="18" rx="12" ry="8" fill="url(#beeWing)" stroke="#60A5FA" strokeWidth="0.6" opacity="0.85" />
        </g>

        <ellipse cx="32" cy="36" rx="20" ry="16" fill="url(#beeBody)" />
        <path d="M18 32 Q32 38 46 32" stroke="#1F2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M16 40 Q32 48 48 40" stroke="#1F2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M26 22 Q24 14 20 12" stroke="#1F2937" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M38 22 Q40 14 44 12" stroke="#1F2937" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="20" cy="12" r="1.8" fill="#1F2937" />
        <circle cx="44" cy="12" r="1.8" fill="#1F2937" />

        {eyeShape === "normal" && (
          <>
            <circle cx="26" cy="34" r="1.6" fill="#1F2937" />
            <circle cx="38" cy="34" r="1.6" fill="#1F2937" />
            <circle cx="26.5" cy="33.5" r="0.5" fill="#fff" />
            <circle cx="38.5" cy="33.5" r="0.5" fill="#fff" />
          </>
        )}
        {eyeShape === "line" && (
          <>
            <path d="M23 34 L29 34" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M35 34 L41 34" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}
        {eyeShape === "dot" && (
          <>
            <circle cx="26" cy="34" r="1" fill="#1F2937" />
            <circle cx="38" cy="34" r="1" fill="#1F2937" />
          </>
        )}
        {eyeShape === "happy" && (
          <>
            <path d="M23 34 Q26 31 29 34" stroke="#1F2937" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M35 34 Q38 31 41 34" stroke="#1F2937" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </>
        )}
        {eyeShape === "star" && (
          <>
            <path d="M26 31 L27 33 L29 34 L27 35 L26 37 L25 35 L23 34 L25 33 Z" fill="#1F2937" />
            <path d="M38 31 L39 33 L41 34 L39 35 L38 37 L37 35 L35 34 L37 33 Z" fill="#1F2937" />
          </>
        )}
        {eyeShape === "x" && (
          <>
            <path d="M24 32 L28 36 M28 32 L24 36" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M36 32 L40 36 M40 32 L36 36" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}

        <circle cx="22" cy="40" r="2.4" fill="#FB7185" opacity={cheekOpacity} />
        <circle cx="42" cy="40" r="2.4" fill="#FB7185" opacity={cheekOpacity} />
        <path d={mouthPath} stroke="#1F2937" strokeWidth="1.6" fill="none" strokeLinecap="round" />

        {showFinger && (
          <g>
            <path d="M32 42 L32 50" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="50" r="2" fill="#FDE68A" />
          </g>
        )}

        {showHand && (
          <g style={{ transformOrigin: "54px 32px", animation: "handWave 0.7s ease-in-out infinite" }}>
            <circle cx="54" cy="32" r="4" fill="#FDE68A" stroke="#D97706" strokeWidth="1" />
          </g>
        )}

        <path d="M32 52 L30 56 L32 55 L34 56 Z" fill="#1F2937" />
      </svg>

      <style jsx>{`
        @keyframes beeHover {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-6px) rotate(3deg); }
        }
        @keyframes beeWingL { from { transform: rotate(-18deg); } to { transform: rotate(4deg); } }
        @keyframes beeWingR { from { transform: rotate(18deg); } to { transform: rotate(-4deg); } }
        @keyframes handWave {
          0%, 100% { transform: rotate(-20deg); }
          50% { transform: rotate(20deg); }
        }
        @keyframes zzzFloat {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-3px); opacity: 0.6; }
        }
        @keyframes heartPop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

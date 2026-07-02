"use client";

import { CSSProperties, useEffect, useState } from "react";

export interface DicePanelProps {
  a: number;
  b: number;
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  /** Compact sizing for the in-board center card. */
  compact?: boolean;
}

// Pip positions for each of the 6 faces. Coordinates are on a 3x3 grid:
// (col, row) with 0-indexed top-left, so (1,1) is center, (0,0) top-left.
const PIPS: ReadonlyArray<ReadonlyArray<[number, number]>> = [
  // 1: center
  [[1, 1]],
  // 2: top-left + bottom-right
  [
    [0, 0],
    [2, 2],
  ],
  // 3: top-left, center, bottom-right
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  // 4: four corners
  [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  // 5: four corners + center
  [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  // 6: 2 columns of 3
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
];

function clampFace(n: number): number {
  return Math.max(1, Math.min(6, Math.round(n)));
}

/**
 * Flat 2D die face (설계서 항목 6). The previous CSS 3D cube
 * (preserve-3d + backface-hidden) collapsed on some tablet
 * browsers/webviews and rendered as an EMPTY white square — pips ended up
 * on hidden faces. A flat face with a shake animation has no 3D dependency
 * and always shows its pips.
 *
 * While `rolling`, the shown face cycles randomly every ~90ms and the die
 * shakes; when rolling ends it settles on the real value.
 */
function Die({
  value,
  rolling,
  size,
}: {
  value: number;
  rolling: boolean;
  size: number;
}) {
  const [shown, setShown] = useState(() => clampFace(value));

  useEffect(() => {
    if (!rolling) {
      setShown(clampFace(value));
      return;
    }
    const id = setInterval(() => {
      setShown(1 + Math.floor(Math.random() * 6));
    }, 90);
    return () => clearInterval(id);
  }, [rolling, value]);

  const pipSize = Math.max(6, Math.round(size * 0.16));
  const pad = Math.round(size * 0.12);

  const faceStyle: CSSProperties = {
    width: size,
    height: size,
    background: "linear-gradient(135deg, #ffffff 0%, #FEF3C7 100%)",
    border: "2px solid #111827",
    borderRadius: Math.round(size * 0.14),
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gridTemplateRows: "1fr 1fr 1fr",
    padding: pad,
    boxShadow: "inset 0 0 8px rgba(180,83,9,0.15), 0 3px 6px rgba(0,0,0,0.12)",
    animation: rolling ? "marbleDiceShake 0.22s ease-in-out infinite" : "none",
  };

  return (
    <span
      style={{ display: "inline-block" }}
      aria-label={`주사위 ${clampFace(rolling ? shown : value)}`}
      role="img"
    >
      <span style={faceStyle}>
        {PIPS[clampFace(rolling ? shown : value) - 1].map(([col, row], i) => (
          <span
            key={i}
            style={{
              gridColumn: (col + 1) as 1 | 2 | 3,
              gridRow: (row + 1) as 1 | 2 | 3,
              width: pipSize,
              height: pipSize,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 30% 30%, #1F2937, #000)",
              justifySelf: "center",
              alignSelf: "center",
              boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
            }}
          />
        ))}
      </span>
    </span>
  );
}

export function DicePanel({
  a,
  b,
  rolling,
  canRoll,
  onRoll,
  compact = false,
}: DicePanelProps) {
  const wrap: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: compact ? 8 : 12,
  };

  // 원격 개선(주사위 크게) 유지 — 58/84 사이징
  const diceRow: CSSProperties = {
    display: "flex",
    gap: compact ? 14 : 20,
    padding: compact ? "10px 18px" : "14px 24px",
  };

  const size = compact ? 58 : 84;

  const buttonPad = compact ? "10px 18px" : "12px 26px";
  const buttonFontSize = compact ? 14 : 16;

  return (
    <div style={wrap}>
      <div style={diceRow} aria-live="polite">
        <Die value={a} rolling={rolling} size={size} />
        <Die value={b} rolling={rolling} size={size} />
      </div>
      <button
        type="button"
        aria-label="주사위 굴리기"
        onClick={onRoll}
        disabled={!canRoll || rolling}
        style={{
          background:
            canRoll && !rolling
              ? "linear-gradient(135deg,#FBBF24,#F59E0B)"
              : "#E5E7EB",
          color: canRoll && !rolling ? "#fff" : "#9CA3AF",
          border: "none",
          padding: buttonPad,
          borderRadius: 999,
          fontWeight: 900,
          fontSize: buttonFontSize,
          cursor: canRoll && !rolling ? "pointer" : "not-allowed",
          boxShadow:
            canRoll && !rolling
              ? "0 6px 16px rgba(245,158,11,0.4)"
              : "none",
          transition: "transform 0.1s ease-out",
        }}
      >
        {rolling ? "🎲 구르는 중…" : "🎲 굴리기"}
      </button>
      <style>{`
        @keyframes marbleDiceShake {
          0%   { transform: translate(0, 0) rotate(0deg); }
          25%  { transform: translate(-2px, 1px) rotate(-7deg); }
          50%  { transform: translate(2px, -1px) rotate(6deg); }
          75%  { transform: translate(-1px, -2px) rotate(-4deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}

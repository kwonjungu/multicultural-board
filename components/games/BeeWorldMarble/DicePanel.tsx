"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";

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

// Per-face CSS transforms for a cube of the given size. Face N is positioned
// so that the "resting" transform of the cube shows face 1 toward the viewer.
function faceTransforms(size: number): Record<1 | 2 | 3 | 4 | 5 | 6, string> {
  const d = size / 2;
  return {
    1: `rotateY(0deg) translateZ(${d}px)`,
    6: `rotateY(180deg) translateZ(${d}px)`,
    3: `rotateY(90deg) translateZ(${d}px)`,
    4: `rotateY(-90deg) translateZ(${d}px)`,
    2: `rotateX(90deg) translateZ(${d}px)`,
    5: `rotateX(-90deg) translateZ(${d}px)`,
  };
}

// Rotation that brings face N to the front. Inverse of the face's placement.
function restRotationFor(face: 1 | 2 | 3 | 4 | 5 | 6): string {
  switch (face) {
    case 1:
      return "rotateX(0deg) rotateY(0deg)";
    case 6:
      return "rotateY(-180deg)";
    case 3:
      return "rotateY(-90deg)";
    case 4:
      return "rotateY(90deg)";
    case 2:
      return "rotateX(-90deg)";
    case 5:
      return "rotateX(90deg)";
  }
}

// Each roll picks a random extra number of full rotations so the animation
// feels like a real tumble.
function spinRotationFor(face: 1 | 2 | 3 | 4 | 5 | 6, salt: number): string {
  // Use salt to vary the spin so consecutive rolls of the same face still move.
  const xTurns = 2 + ((salt * 3) % 3); // 2..4 full turns on X
  const yTurns = 2 + ((salt * 5 + 1) % 3); // 2..4 full turns on Y
  const rest = restRotationFor(face);
  return `rotateX(${xTurns * 360}deg) rotateY(${yTurns * 360}deg) ${rest}`;
}

function Die({
  value,
  rolling,
  size,
  rollKey,
}: {
  value: number;
  rolling: boolean;
  size: number;
  /** Changes every time a new roll starts so CSS transitions re-run. */
  rollKey: number;
}) {
  const face = clampFace(value) as 1 | 2 | 3 | 4 | 5 | 6;
  const transforms = useMemo(() => faceTransforms(size), [size]);

  const cubeStyle: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    transformStyle: "preserve-3d",
    transform: rolling
      ? spinRotationFor(face, rollKey)
      : restRotationFor(face),
    transition: rolling
      ? "transform 0.7s cubic-bezier(0.22, 0.61, 0.36, 1)"
      : "transform 0.25s ease-out",
  };

  const wrapStyle: CSSProperties = {
    width: size,
    height: size,
    perspective: size * 4,
    display: "inline-block",
  };

  const pipSize = Math.max(6, Math.round(size * 0.16));
  const pad = Math.round(size * 0.12);

  const faceBase: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(135deg, #ffffff 0%, #FEF3C7 100%)",
    border: "2px solid #111827",
    borderRadius: Math.round(size * 0.14),
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gridTemplateRows: "1fr 1fr 1fr",
    padding: pad,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    boxShadow: "inset 0 0 8px rgba(180,83,9,0.15)",
  };

  return (
    <span
      style={wrapStyle}
      aria-label={`주사위 ${face}`}
      role="img"
    >
      <span style={cubeStyle}>
        {([1, 2, 3, 4, 5, 6] as const).map((n) => (
          <span
            key={n}
            style={{ ...faceBase, transform: transforms[n] }}
          >
            {PIPS[n - 1].map(([col, row], i) => (
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
  // A counter that increments when a new "rolling" phase starts. It feeds into
  // spinRotationFor so even rolling the same face again produces a fresh spin.
  const [rollKey, setRollKey] = useState(0);
  useEffect(() => {
    if (rolling) setRollKey((k) => k + 1);
  }, [rolling]);

  const wrap: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: compact ? 8 : 12,
  };

  const diceRow: CSSProperties = {
    display: "flex",
    gap: compact ? 10 : 16,
    padding: compact ? "4px 0" : "8px 0",
  };

  const size = compact ? 44 : 60;

  const buttonPad = compact ? "10px 18px" : "12px 26px";
  const buttonFontSize = compact ? 14 : 16;

  return (
    <div style={wrap}>
      <div style={diceRow} aria-live="polite">
        <Die value={a} rolling={rolling} size={size} rollKey={rollKey} />
        <Die value={b} rolling={rolling} size={size} rollKey={rollKey + 1} />
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
    </div>
  );
}

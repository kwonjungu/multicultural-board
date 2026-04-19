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

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function face(n: number): string {
  return DICE_FACES[Math.max(1, Math.min(6, n)) - 1];
}

export function DicePanel({
  a,
  b,
  rolling,
  canRoll,
  onRoll,
  compact = false,
}: DicePanelProps) {
  const [flicker, setFlicker] = useState<{ a: number; b: number }>({ a, b });

  // While rolling, show a quick face animation so the dice feel alive.
  useEffect(() => {
    if (!rolling) {
      setFlicker({ a, b });
      return;
    }
    const id = setInterval(() => {
      setFlicker({
        a: 1 + Math.floor(Math.random() * 6),
        b: 1 + Math.floor(Math.random() * 6),
      });
    }, 90);
    return () => clearInterval(id);
  }, [rolling, a, b]);

  const wrap: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: compact ? 6 : 8,
  };

  const diceRow: CSSProperties = {
    display: "flex",
    gap: compact ? 6 : 10,
  };

  const dieSize = compact ? "clamp(28px, 7vw, 44px)" : 52;
  const dieFontSize = compact ? "clamp(22px, 5.5vw, 36px)" : 38;

  const die: CSSProperties = {
    width: dieSize,
    height: dieSize,
    background: "#fff",
    color: "#111827",
    border: "2.5px solid #F59E0B",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: dieFontSize,
    lineHeight: 1,
    fontFamily: "serif",
    boxShadow: "0 4px 10px rgba(245,158,11,0.3)",
  };

  const buttonPad = compact ? "8px 16px" : "12px 24px";
  const buttonFontSize = compact ? "clamp(12px, 2vw, 14px)" : 16;

  return (
    <div style={wrap}>
      <div style={diceRow} aria-live="polite">
        <span aria-label={`주사위 A ${flicker.a}`} style={die}>{face(flicker.a)}</span>
        <span aria-label={`주사위 B ${flicker.b}`} style={die}>{face(flicker.b)}</span>
      </div>
      <button
        type="button"
        aria-label="주사위 굴리기"
        onClick={onRoll}
        disabled={!canRoll || rolling}
        style={{
          background: canRoll && !rolling
            ? "linear-gradient(135deg,#FBBF24,#F59E0B)"
            : "#E5E7EB",
          color: canRoll && !rolling ? "#fff" : "#9CA3AF",
          border: "none",
          padding: buttonPad,
          borderRadius: 999,
          fontWeight: 900,
          fontSize: buttonFontSize,
          cursor: canRoll && !rolling ? "pointer" : "not-allowed",
          boxShadow: canRoll && !rolling
            ? "0 6px 16px rgba(245,158,11,0.4)"
            : "none",
        }}
      >
        {rolling ? "🎲 …" : "🎲 굴리기"}
      </button>
    </div>
  );
}

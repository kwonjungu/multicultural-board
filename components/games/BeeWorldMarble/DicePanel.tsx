"use client";

import { CSSProperties, useEffect, useState } from "react";

export interface DicePanelProps {
  a: number;
  b: number;
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
}

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function face(n: number): string {
  return DICE_FACES[Math.max(1, Math.min(6, n)) - 1];
}

export function DicePanel({ a, b, rolling, canRoll, onRoll }: DicePanelProps) {
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
    gap: 8,
  };

  const diceRow: CSSProperties = {
    display: "flex",
    gap: 10,
  };

  const die: CSSProperties = {
    width: 52,
    height: 52,
    background: "#fff",
    color: "#111827",
    border: "3px solid #F59E0B",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 38,
    lineHeight: 1,
    fontFamily: "serif",
    boxShadow: "0 4px 10px rgba(245,158,11,0.3)",
  };

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
          padding: "12px 24px",
          borderRadius: 999,
          fontWeight: 900,
          fontSize: 16,
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

"use client";

// 윷가락 4개 + 던지기 버튼. 결과는 먼저 계산하고 애니메이션이 끝난 뒤
// 부모에 전달한다 (더블탭은 로컬 가드 + disabled 로 차단).

import React, { useEffect, useRef, useState } from "react";
import { throwSticks, type StickThrow } from "@/lib/yutLogic";
import type { Throw } from "@/lib/yutTypes";
import { sfx } from "./yutSfx";

const THROW_LABEL: Record<string, string> = {
  "-1": "백도", "1": "도", "2": "개", "3": "걸", "4": "윷", "5": "모",
};

export default function YutSticks({
  enabled, accent, onResult,
}: {
  enabled: boolean;
  accent: string;            // 현재 팀 색
  onResult: (value: Throw) => void;
}) {
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState<StickThrow | null>(null);
  const [flicker, setFlicker] = useState<boolean[]>([true, false, true, false]);
  const busyRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => { timersRef.current.forEach((t) => window.clearTimeout(t)); }, []);

  function handleThrow() {
    if (!enabled || busyRef.current) return;
    busyRef.current = true;
    const result = throwSticks();
    setShown(null);
    setSpinning(true);
    sfx.throwSticks();
    // 굴러가는 동안 깜빡임
    for (let i = 1; i <= 5; i++) {
      timersRef.current.push(window.setTimeout(() => {
        setFlicker([0, 0, 0, 0].map(() => Math.random() < 0.5));
      }, i * 130));
    }
    timersRef.current.push(window.setTimeout(() => {
      setSpinning(false);
      setShown(result);
      onResult(result.value);
      busyRef.current = false;
    }, 780));
  }

  const sticks = spinning ? flicker : (shown?.sticks ?? [true, true, false, false]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: 10 }}>
        {sticks.map((up, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              width: 34, height: 96,
              filter: spinning
                ? "drop-shadow(0 8px 18px rgba(0,0,0,0.3))"
                : "drop-shadow(0 3px 8px rgba(0,0,0,0.2))",
              transform: spinning ? `translateY(-${6 + (i % 2) * 6}px) rotate(${(i - 1.5) * 8}deg)` : "none",
              transition: "transform 0.13s",
            }}
          >
            <img
              src={up ? "/yut/stick-flat.png" : "/yut/stick-round.png"}
              alt=""
              aria-hidden="true"
              onError={(e) => {
                // 이미지 없으면 기존 CSS 막대로 폴백
                const el = e.currentTarget;
                el.style.display = "none";
                const parent = el.parentElement!;
                parent.style.borderRadius = "13px";
                parent.style.border = "2.5px solid #78350F";
                parent.style.background = up
                  ? "linear-gradient(180deg, #FDE68A, #D4A95C)"
                  : "linear-gradient(180deg, #92400E, #6B3410)";
              }}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
            {/* 백도 표시 가락 (첫 번째) */}
            {i === 0 && up && !spinning && (
              <span style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: 15, fontWeight: 900, color: "#92400E",
              }}>✕</span>
            )}
          </div>
        ))}
      </div>

      <div style={{ minHeight: 30, display: "flex", alignItems: "center" }}>
        {shown && !spinning && (
          <div style={{
            fontSize: 20, fontWeight: 900, color: accent,
            animation: "yutPop 0.35s ease",
          }}>
            {THROW_LABEL[String(shown.value)]}!
            {(shown.value === 4 || shown.value === 5) && (
              <span style={{ fontSize: 13, marginLeft: 6, color: "#92400E" }}>한 번 더 🎉</span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleThrow}
        disabled={!enabled || spinning}
        style={{
          background: enabled && !spinning
            ? `linear-gradient(135deg, ${accent}, ${accent}CC)`
            : "#E5E7EB",
          color: enabled && !spinning ? "#fff" : "#9CA3AF",
          border: "none", borderRadius: 99,
          padding: "14px 40px", fontSize: 17, fontWeight: 900,
          cursor: enabled && !spinning ? "pointer" : "default",
          boxShadow: enabled && !spinning ? `0 8px 20px ${accent}66` : "none",
          fontFamily: "inherit",
        }}
      >
        🪵 윷 던지기
      </button>

      <style>{`
        @keyframes yutPop {
          0% { transform: scale(0.4); opacity: 0; }
          70% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

"use client";

// 윷가락 4개 + 던지기 버튼. 결과는 먼저 계산하고 애니메이션이 끝난 뒤
// 부모에 전달한다 (더블탭은 로컬 가드 + aria-disabled 로 차단).

import React, { useEffect, useRef, useState } from "react";
import { throwSticks, type StickThrow } from "@/lib/yutLogic";
import type { Throw } from "@/lib/yutTypes";
import ScopedStyle from "../../ui/child/ScopedStyle";
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

  // unmount 시 예약된 깜빡임/결과 타이머를 남기지 않는다.
  useEffect(() => {
    return () => { timersRef.current.forEach((t) => window.clearTimeout(t)); timersRef.current = []; };
  }, []);

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
  const canThrow = enabled && !spinning;

  return (
    <div className="ys-root">
      <ScopedStyle css={YS_CSS} />
      <div className="ys-sticks" aria-hidden>
        {sticks.map((up, i) => (
          <div
            key={i}
            className="ys-stick"
            data-up={up ? "" : undefined}
            data-spinning={spinning ? "" : undefined}
            style={{ transform: spinning ? `translateY(-${6 + (i % 2) * 6}px) rotate(${(i - 1.5) * 8}deg)` : undefined }}
          >
            {/* 백도 표시 가락 (첫 번째) */}
            {i === 0 && up && !spinning ? "✕" : ""}
          </div>
        ))}
      </div>

      <div className="ys-resultslot">
        {shown && !spinning && (
          <p data-ux-role="body-emphasis" className="ys-result" style={{ color: accent }} role="status">
            {THROW_LABEL[String(shown.value)]}!
            {(shown.value === 4 || shown.value === 5) && (
              <span data-ux-role="secondary" className="ys-again"> 한 번 더 🎉</span>
            )}
          </p>
        )}
      </div>

      <button
        data-ux-role="action"
        className="ys-throw"
        aria-disabled={!canThrow}
        onClick={() => { if (canThrow) handleThrow(); }}
        style={canThrow ? { background: accent, color: "#fff", borderColor: accent } : undefined}
      >
        🪵 윷 던지기
      </button>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const YS_CSS = `
.ys-root{ display: grid; justify-items: center; gap: var(--ux-space-3); width: 100%; }
.ys-sticks{ display: flex; gap: var(--ux-space-3); }
.ys-stick{
  width: 26px; height: 84px; border-radius: 13px;
  background: linear-gradient(180deg, #6B3410, #4A2409);
  border: 2px solid #4A2409;
  box-shadow: 0 3px 8px rgba(41,37,31,.2);
  transition: transform var(--ux-motion-press) var(--ux-motion-ease), background var(--ux-motion-press) var(--ux-motion-ease);
  display: flex; align-items: center; justify-content: center;
  font-size: var(--ux-font-secondary); font-weight: 900; color: #FFF3D0;
}
.ys-stick[data-up]{ background: linear-gradient(180deg, #FFE6A3, #C79B4E); color: #4A2409; }
.ys-stick[data-spinning]{ box-shadow: 0 8px 18px rgba(41,37,31,.3); }
.ys-resultslot{ min-height: var(--ux-space-8); display: flex; align-items: center; }
.ys-result{ margin: 0; font-weight: 900; animation: ysPop .35s ease; }
.ys-again{ margin-left: var(--ux-space-2); color: var(--ux-primary-ink); }
@keyframes ysPop{
  0%{ transform: scale(.4); opacity: 0; }
  70%{ transform: scale(1.2); }
  100%{ transform: scale(1); opacity: 1; }
}
.ys-throw[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 900; padding-left: var(--ux-space-8); padding-right: var(--ux-space-8);
}
.ys-throw[aria-disabled="true"]{ opacity: .55; cursor: default; }
`;

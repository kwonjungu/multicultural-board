"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import type { Throw } from "@/lib/yutTypes";
import { throwLabel } from "@/lib/yutData";

interface Props {
  onResult: (value: Throw) => void;
  disabled: boolean;
  // When the parent wants us to play the throw animation with a specific
  // predetermined value (so probabilities stay in the reducer), pass it in.
  // We animate ~600ms then call onResult.
  pendingValue: Throw | null;
  onAnimationDone: () => void;
}

// Four sticks shown as horizontal capsules. Each stick has a "flat" or
// "round" side. We randomise a display during spin and snap to the final
// sides once the parent signals a pendingValue.
//
// Final-side derivation: count flats (F) where
//   value=-1 (백도)  → 1 flat (special, visually identical to 도)
//   value=1  (도)    → 1 flat
//   value=2  (개)    → 2 flats
//   value=3  (걸)    → 3 flats
//   value=4  (윷)    → 4 flats
//   value=5  (모)    → 0 flats
function flatsForThrow(v: Throw): number {
  switch (v) {
    case -1: return 1;
    case 1:  return 1;
    case 2:  return 2;
    case 3:  return 3;
    case 4:  return 4;
    case 5:  return 0;
    default: return 2;
  }
}

// Pick which 4-bit pattern shows N flats. Just take the first 2^0..2^4 mask
// with popcount(N).
function maskWithFlats(n: number): boolean[] {
  const out = [false, false, false, false];
  for (let i = 0; i < n && i < 4; i += 1) out[i] = true;
  return out;
}

export function YutSticks({ onResult, disabled, pendingValue, onAnimationDone }: Props): JSX.Element {
  const [spin, setSpin] = useState(false);
  const [faces, setFaces] = useState<boolean[]>([true, false, true, false]);
  const raf = useRef<number | null>(null);
  const deadline = useRef<number>(0);

  // Animate until deadline, then snap to pendingValue.
  useEffect(() => {
    if (!spin || pendingValue === null) return;
    const tick = () => {
      setFaces([
        Math.random() < 0.5,
        Math.random() < 0.5,
        Math.random() < 0.5,
        Math.random() < 0.5,
      ]);
      if (performance.now() < deadline.current) {
        raf.current = window.requestAnimationFrame(tick);
      } else {
        // snap
        setFaces(maskWithFlats(flatsForThrow(pendingValue)));
        setSpin(false);
        onResult(pendingValue);
        onAnimationDone();
      }
    };
    raf.current = window.requestAnimationFrame(tick);
    return () => {
      if (raf.current) window.cancelAnimationFrame(raf.current);
    };
  }, [spin, pendingValue, onResult, onAnimationDone]);

  // Public: parent calls startSpin by setting pendingValue + we kick off.
  useEffect(() => {
    if (pendingValue !== null && !spin) {
      deadline.current = performance.now() + 600;
      setSpin(true);
    }
  }, [pendingValue, spin]);

  return (
    <div style={wrap} aria-label="윷가락">
      <div style={sticksRow}>
        {faces.map((flat, i) => (
          <div
            key={i}
            style={{
              ...stick,
              background: flat ? "#FBBF24" : "#92400E",
              transform: spin ? `rotate(${(i % 2 === 0 ? 1 : -1) * 20}deg)` : "rotate(0deg)",
              transition: spin ? "transform 80ms linear" : "transform 200ms ease-out",
            }}
          >
            <span style={stickText}>{flat ? "🟡" : "🪵"}</span>
          </div>
        ))}
      </div>
      {pendingValue !== null && !spin && (
        <div style={resultBadge}>{throwLabel(pendingValue)}</div>
      )}
      {disabled && !spin && <div style={hint}>대기중…</div>}
    </div>
  );
}

const wrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  padding: "10px 0",
};

const sticksRow: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const stick: CSSProperties = {
  width: 34,
  height: 90,
  borderRadius: 18,
  border: "2px solid #92400E",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
};

const stickText: CSSProperties = {
  fontSize: 18,
};

const resultBadge: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#B45309",
  background: "#FEF3C7",
  padding: "4px 14px",
  borderRadius: 999,
  border: "2px solid #F59E0B",
};

const hint: CSSProperties = {
  fontSize: 13,
  color: "#92400E",
};

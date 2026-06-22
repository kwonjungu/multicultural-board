"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "uiFontScale";

const OPTIONS = [
  { label: "작게", value: 0.9, sample: 13 },
  { label: "보통", value: 1, sample: 15 },
  { label: "크게", value: 1.15, sample: 18 },
  { label: "아주 크게", value: 1.3, sample: 21 },
];

/** 저장된 배율을 문서 전체에 적용 (zoom: px 기반 인라인 스타일까지 함께 확대/축소) */
export function applyFontScale(v: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("zoom", String(v));
}

export function readFontScale(): number {
  if (typeof window === "undefined") return 1;
  const saved = Number(localStorage.getItem(STORAGE_KEY) || "1");
  return Number.isFinite(saved) && saved > 0 ? saved : 1;
}

/**
 * 글자 크기 설정 버튼 (교사·학생 공통). 헤더에 두는 자체 완결형 위젯.
 * 선택값은 localStorage 에 저장되고 문서 전체 zoom 으로 적용된다.
 */
export default function FontSizeButton() {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = readFontScale();
    setScale(v);
    applyFontScale(v);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(v: number) {
    setScale(v);
    applyFontScale(v);
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch {}
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="글자 크기 설정"
        aria-expanded={open}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          width: 48, borderRadius: 12, border: "2px solid #FDE68A",
          background: "#fff", color: "#92400E", cursor: "pointer",
          padding: "5px 0",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>가</span>
        <span style={{ fontSize: 10, fontWeight: 800, lineHeight: 1 }}>글자</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
            background: "#fff", borderRadius: 16, border: "2px solid #FDE68A",
            boxShadow: "0 12px 36px rgba(180,83,9,0.2)", padding: 8, minWidth: 168,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 1, padding: "6px 8px 8px" }}>
            글자 크기
          </div>
          {OPTIONS.map((o) => {
            const active = Math.abs(scale - o.value) < 0.001;
            return (
              <button
                key={o.value}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(o.value)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 10, padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                  border: active ? "2px solid #F59E0B" : "2px solid transparent",
                  background: active ? "#FEF3C7" : "transparent",
                  color: "#1F2937", fontFamily: "inherit", textAlign: "left",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#FFFBEB"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span style={{ fontWeight: 800, fontSize: o.sample }}>{o.label}</span>
                {active && <span style={{ color: "#F59E0B", fontWeight: 900, fontSize: 14 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

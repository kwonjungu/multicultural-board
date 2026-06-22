"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/constants";

interface Props {
  currentLang: string;
  availableLangs: string[];
  onChange: (lang: string) => void;
}

/**
 * 보기 언어 전환 버튼 (교사·학생 공통).
 * 입장 후에도 헤더에서 자기 언어를 바꿀 수 있게 한다 — 선택 시 onChange 로
 * UserConfig.myLang 을 갱신(상위에서 localStorage 저장).
 */
export default function LangSwitchButton({ currentLang, availableLangs, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const cur = LANGUAGES[currentLang];
  const langs = availableLangs.length ? availableLangs : Object.keys(LANGUAGES);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="언어 설정"
        aria-expanded={open}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          width: 48, borderRadius: 12, border: "2px solid #FDE68A",
          background: "#fff", color: "#92400E", cursor: "pointer", padding: "5px 0",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{cur?.flag || "🌐"}</span>
        <span style={{ fontSize: 10, fontWeight: 800, lineHeight: 1 }}>언어</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
            background: "#fff", borderRadius: 16, border: "2px solid #FDE68A",
            boxShadow: "0 12px 36px rgba(180,83,9,0.2)", padding: 8, minWidth: 188,
            maxHeight: 340, overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 1, padding: "6px 8px 8px" }}>
            언어 선택
          </div>
          {langs.map((code) => {
            const info = LANGUAGES[code];
            if (!info) return null;
            const active = code === currentLang;
            return (
              <button
                key={code}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { onChange(code); setOpen(false); }}
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
                <span style={{ fontWeight: 700, fontSize: 14 }}>{info.flag} {info.label}</span>
                {active && <span style={{ color: "#F59E0B", fontWeight: 900, fontSize: 14 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

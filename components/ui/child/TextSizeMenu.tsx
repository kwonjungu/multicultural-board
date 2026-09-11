"use client";

import { useEffect, useRef, useState } from "react";
import { setChildUx, useChildUx } from "@/lib/childUx/useChildUx";
import type { TextSize } from "@/lib/childUx/tokens";
import type { MotionPref } from "@/lib/childUx/settings";

const SIZES: { value: TextSize; label: string; sample: number }[] = [
  { value: "basic", label: "보통", sample: 17 },
  { value: "large", label: "크게", sample: 22 },
];

/**
 * 헤더의 글자 크기 · 움직임 설정. 옛 FontSizeButton 의 document zoom 을 대체한다.
 * 값은 lib/childUx 한 곳에만 저장되고, 적용도 그쪽 applyChildUx 만 한다.
 */
export default function TextSizeMenu() {
  const settings = useChildUx();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const motionReduced = settings.motion === "reduced";

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="글자 크기와 움직임 설정"
        aria-expanded={open}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
          minWidth: "var(--ux-control-min)", minHeight: "var(--ux-control-min)",
          borderRadius: "var(--ux-radius-surface)",
          border: "2px solid var(--ux-primary-border)",
          background: "var(--ux-surface)", color: "var(--ux-ink)",
          cursor: "pointer", fontFamily: "inherit", padding: "var(--ux-space-1)",
        }}
      >
        <span style={{ fontSize: "var(--ux-font-label)", fontWeight: 900, lineHeight: 1 }}>가</span>
        <span style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 700, lineHeight: 1 }}>글자</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="화면 보기 설정"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
            background: "var(--ux-surface)", borderRadius: "var(--ux-radius-surface)",
            border: "2px solid var(--ux-primary-border)",
            boxShadow: "0 12px 36px rgba(137,83,0,.20)",
            padding: "var(--ux-space-2)", minWidth: 232,
            display: "grid", gap: "var(--ux-space-2)",
          }}
        >
          <div data-ux-role="secondary" style={{ padding: "0 var(--ux-space-2)", fontWeight: 800 }}>글자 크기</div>
          {SIZES.map((o) => {
            const active = settings.textSize === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                data-ux-role="control"
                onClick={() => { setChildUx({ textSize: o.value }); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: "var(--ux-space-3)", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  border: active ? "3px solid var(--ux-selected-border)" : "2px solid var(--ux-ink-soft)",
                  background: "var(--ux-surface)", color: "var(--ux-ink)",
                }}
              >
                <span style={{ fontWeight: 800, fontSize: o.sample }}>{o.label}</span>
                {active && <span aria-hidden style={{ fontWeight: 900 }}>✓</span>}
              </button>
            );
          })}

          <div data-ux-role="secondary" style={{ padding: "0 var(--ux-space-2)", fontWeight: 800 }}>움직임</div>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={motionReduced}
            data-ux-role="control"
            onClick={() => setChildUx({ motion: motionReduced ? "system" : "reduced" })}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: "var(--ux-space-3)", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              border: motionReduced ? "3px solid var(--ux-selected-border)" : "2px solid var(--ux-ink-soft)",
              background: "var(--ux-surface)", color: "var(--ux-ink)",
            }}
          >
            <span style={{ fontWeight: 800 }}>움직임 줄이기</span>
            {motionReduced && <span aria-hidden style={{ fontWeight: 900 }}>✓</span>}
          </button>
        </div>
      )}
    </div>
  );
}

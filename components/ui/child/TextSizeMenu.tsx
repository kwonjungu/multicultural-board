"use client";

import { useEffect, useRef, useState } from "react";
import { setChildUx, useChildUx } from "@/lib/childUx/useChildUx";
import type { TextSize } from "@/lib/childUx/tokens";
import { setSoundPref } from "@/lib/audioBus";

const SIZES: { value: TextSize; label: string; sample: number }[] = [
  { value: "basic", label: "보통", sample: 17 },
  { value: "large", label: "크게", sample: 22 },
];

/**
 * 헤더의 화면 보기 설정 — **글자 크기 / 소리 / 움직임 줄이기 / 집중 모드** 넷뿐이다(X19).
 * 옛 FontSizeButton 의 document zoom 을 대체한다. 값은 lib/childUx 한 곳에만
 * 저장되고 적용도 그쪽 applyChildUx 만 한다.
 *
 * 소리 항목은 표시만 바꾸지 않는다 — `setSoundPref` 로 audioBus 에 직접 알려
 * 지금 나고 있는 말소리까지 멈춘다. 아무 일도 하지 않는 토글은 만들지 않는다.
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
  const soundOn = settings.sound === "on";
  const focusOn = settings.focus === true;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="화면 보기 설정 — 글자 크기, 소리, 움직임, 집중"
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

          <div data-ux-role="secondary" style={{ padding: "0 var(--ux-space-2)", fontWeight: 800 }}>소리</div>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={soundOn}
            data-ux-role="control"
            onClick={() => {
              const next = soundOn ? "off" : "on";
              // 저장 전에 버스를 먼저 멈춘다 — 재생 중이던 말소리가 남으면 안 된다.
              setSoundPref(next);
              setChildUx({ sound: next });
            }}
            style={toggleStyle(soundOn)}
          >
            <span style={{ fontWeight: 800 }}>{soundOn ? "소리 켜짐" : "소리 꺼짐"}</span>
            <span data-ux-role="secondary" style={{ fontWeight: 800 }}>
              {soundOn ? "읽어 주는 소리가 나요" : "소리가 나지 않아요"}
            </span>
          </button>

          <div data-ux-role="secondary" style={{ padding: "0 var(--ux-space-2)", fontWeight: 800 }}>움직임</div>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={motionReduced}
            data-ux-role="control"
            onClick={() => setChildUx({ motion: motionReduced ? "system" : "reduced" })}
            style={toggleStyle(motionReduced)}
          >
            <span style={{ fontWeight: 800 }}>움직임 줄이기</span>
            {motionReduced && <span aria-hidden style={{ fontWeight: 900 }}>✓</span>}
          </button>

          <div data-ux-role="secondary" style={{ padding: "0 var(--ux-space-2)", fontWeight: 800 }}>집중</div>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={focusOn}
            data-ux-role="control"
            onClick={() => setChildUx({ focus: !focusOn })}
            style={toggleStyle(focusOn)}
          >
            <span style={{ fontWeight: 800 }}>집중 모드</span>
            <span data-ux-role="secondary" style={{ fontWeight: 800 }}>
              {focusOn ? "꾸밈이 조용해요" : "공부에만 집중해요"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/** 메뉴 안 토글 공통 모양. 켜진 항목은 테두리로 구분한다(색만으로 구분하지 않는다). */
function toggleStyle(active: boolean): React.CSSProperties {
  return {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "var(--ux-space-3)", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
    border: active ? "3px solid var(--ux-selected-border)" : "2px solid var(--ux-ink-soft)",
    background: "var(--ux-surface)", color: "var(--ux-ink)",
  };
}

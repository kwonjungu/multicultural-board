"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "@/lib/gameData";
import { MENU_BY_ID, STEPS, STEP_BY_ID } from "./cafeData";
import type { MenuId, Role, StepId } from "./types";

interface Props {
  langA: string;
  langB: string;
  roleA: Role;
  menuId: MenuId;
  stepOrder: StepId[];
  onAdd: (id: StepId) => void;
  onRemove: (idx: number) => void;
  onReorder: (from: number, to: number) => void;
  onServe: () => void;
}

type Mode = "drag" | "tap";

interface DragState {
  from: number;
  pointerId: number;
  startY: number;
  currentY: number;
  itemHeight: number;
}

export default function StepSequencer({
  langA,
  langB,
  roleA,
  menuId,
  stepOrder,
  onAdd,
  onRemove,
  onReorder,
  onServe,
}: Props) {
  const chefLang = roleA === "chef" ? langA : langB;
  const menu = MENU_BY_ID[menuId];
  const [mode, setMode] = useState<Mode>("drag");
  const [tapSource, setTapSource] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Pointer-move / up listeners are attached to window so the drag keeps
  // tracking even if the finger leaves the original chip.
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      setDrag((d) => {
        if (!d || e.pointerId !== d.pointerId) return d;
        return { ...d, currentY: e.clientY };
      });
    },
    [],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      setDrag((d) => {
        if (!d || e.pointerId !== d.pointerId) return d;
        const delta = d.currentY - d.startY;
        const slots = Math.round(delta / Math.max(1, d.itemHeight));
        const to = Math.max(
          0,
          Math.min(stepOrder.length - 1, d.from + slots),
        );
        if (to !== d.from) onReorder(d.from, to);
        return null;
      });
    },
    [onReorder, stepOrder.length],
  );

  useEffect(() => {
    if (!drag) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [drag, handlePointerMove, handlePointerUp]);

  const startDrag = (e: React.PointerEvent, idx: number) => {
    if (mode !== "drag") return;
    const list = listRef.current;
    const itemHeight = list
      ? Math.max(48, list.clientHeight / Math.max(1, stepOrder.length))
      : 56;
    setDrag({
      from: idx,
      pointerId: e.pointerId,
      startY: e.clientY,
      currentY: e.clientY,
      itemHeight,
    });
  };

  const handleTapChip = (idx: number) => {
    if (mode !== "tap") return;
    if (tapSource === null) {
      setTapSource(idx);
    } else {
      if (tapSource !== idx) onReorder(tapSource, idx);
      setTapSource(null);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 14px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 800 }}>
          2/2 · 조리 순서 / Arrange steps
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>
          {menu.emoji} {tr(menu.name, chefLang)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <button
          onClick={() => {
            setMode("drag");
            setTapSource(null);
          }}
          aria-label="Drag mode"
          style={modeBtn(mode === "drag")}
        >
          ✋ 드래그
        </button>
        <button
          onClick={() => {
            setMode("tap");
            setDrag(null);
          }}
          aria-label="Tap-to-swap mode"
          style={modeBtn(mode === "tap")}
        >
          👉 탭 2회
        </button>
      </div>

      {/* Selected-order list (draggable) */}
      <div
        ref={listRef}
        style={{
          minHeight: 80,
          padding: 10,
          borderRadius: 14,
          background: "#F9FAFB",
          border: "1px dashed #E5E7EB",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {stepOrder.length === 0 && (
          <div
            style={{
              color: "#9CA3AF",
              fontSize: 13,
              textAlign: "center",
              padding: 16,
            }}
          >
            아래에서 조리 단계를 눌러 추가하세요
          </div>
        )}

        {stepOrder.map((id, idx) => {
          const s = STEP_BY_ID[id];
          const active = drag?.from === idx;
          const dragOffset =
            drag && drag.from === idx ? drag.currentY - drag.startY : 0;
          const picked = tapSource === idx;
          return (
            <div
              key={`${id}-${idx}`}
              onPointerDown={(e) => {
                if (mode === "drag") {
                  (e.currentTarget as HTMLElement).setPointerCapture?.(
                    e.pointerId,
                  );
                  startDrag(e, idx);
                }
              }}
              onClick={() => handleTapChip(idx)}
              style={{
                position: "relative",
                transform: `translateY(${dragOffset}px)`,
                transition: active ? "none" : "transform 0.15s",
                padding: "10px 12px",
                borderRadius: 12,
                background: active || picked ? "#FDE68A" : "#fff",
                border: picked
                  ? "2px solid #F59E0B"
                  : active
                    ? "2px solid #F59E0B"
                    : "1px solid #E5E7EB",
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: mode === "drag" ? "grab" : "pointer",
                touchAction: "none",
                userSelect: "none",
                boxShadow: active ? "0 6px 14px rgba(0,0,0,0.12)" : "none",
                zIndex: active ? 5 : 1,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "#F59E0B",
                  width: 20,
                }}
              >
                {idx + 1}
              </div>
              <div style={{ fontSize: 22 }}>{s.emoji}</div>
              <div style={{ flex: 1, fontWeight: 700 }}>
                {tr(s.name, chefLang)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(idx);
                }}
                aria-label={`Remove step ${tr(s.name, chefLang)}`}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#9CA3AF",
                  fontSize: 18,
                  cursor: "pointer",
                  padding: "2px 6px",
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Palette of all 15 steps */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontSize: 11,
            color: "#6B7280",
            fontWeight: 800,
            marginBottom: 6,
          }}
        >
          탭해서 추가 / Tap to add
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
            gap: 6,
          }}
        >
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => onAdd(s.id)}
              aria-label={`Add step ${tr(s.name, chefLang)}`}
              style={{
                padding: "8px 4px",
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                background: "#fff",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22 }}>{s.emoji}</div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>
                {tr(s.name, chefLang)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 18 }}>
        <button
          onClick={onServe}
          disabled={stepOrder.length === 0}
          aria-label="Serve dish"
          style={{
            padding: "12px 28px",
            borderRadius: 14,
            border: "none",
            background:
              stepOrder.length === 0
                ? "#E5E7EB"
                : "linear-gradient(180deg,#FBBF24,#F59E0B)",
            color: stepOrder.length === 0 ? "#9CA3AF" : "#111",
            fontWeight: 900,
            fontSize: 15,
            cursor: stepOrder.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          🛎️ 내놓기 / Serve
        </button>
      </div>
    </div>
  );
}

function modeBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 10,
    border: active ? "2px solid #F59E0B" : "1px solid #E5E7EB",
    background: active ? "#FEF3C7" : "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  };
}

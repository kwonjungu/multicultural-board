"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import ScopedStyle from "../../ui/child/ScopedStyle";
import { gp } from "../plainText";
import { gt } from "../uiText";
import { MENU_BY_ID, STEPS, STEP_BY_ID } from "./cafeData";
import { CAFE } from "./cafeText";
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

// 넓은 화면에서는 왼쪽 '내 조리 순서'(+ 내놓기), 오른쪽 '단계 고르기' 격자로
// 나눠 순서를 보면서 단계를 담을 수 있게 한다.
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
  const empty = stepOrder.length === 0;

  // Pointer-move / up listeners are attached to window so the drag keeps
  // tracking even if the finger leaves the original chip.
  const handlePointerMove = useCallback((e: PointerEvent) => {
    setDrag((d) => {
      if (!d || e.pointerId !== d.pointerId) return d;
      return { ...d, currentY: e.clientY };
    });
  }, []);

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      // setDrag updater 내부에서 onReorder 를 호출하면 StrictMode 의
      // updater 이중 호출 시 재정렬이 두 번 적용됨 → updater 밖에서 계산
      if (!drag || e.pointerId !== drag.pointerId) return;
      const delta = drag.currentY - drag.startY;
      const slots = Math.round(delta / Math.max(1, drag.itemHeight));
      const to = Math.max(0, Math.min(stepOrder.length - 1, drag.from + slots));
      if (to !== drag.from) onReorder(drag.from, to);
      setDrag(null);
    },
    [drag, onReorder, stepOrder.length],
  );

  /** 손가락이 화면 밖으로 나가거나 시스템이 제스처를 가져가면 제자리로 되돌린다. */
  const handlePointerCancel = useCallback(
    (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      setDrag(null);
    },
    [drag],
  );

  useEffect(() => {
    if (!drag) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [drag, handlePointerMove, handlePointerUp, handlePointerCancel]);

  const startDrag = (e: React.PointerEvent, idx: number) => {
    if (mode !== "drag") return;
    // 실제 칩 높이를 기준으로 한 칸을 센다 (브라우저 확대·글씨 크기와 무관).
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const list = listRef.current;
    const itemHeight = rect.height > 0
      ? rect.height
      : list
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

  // 끌기를 못 하는 아이를 위한 대체 조작: 옮길 단계를 누르고 → 놓을 자리를 누른다.
  const handleTapChip = (idx: number) => {
    if (mode !== "tap") return;
    if (tapSource === null) {
      setTapSource(idx);
    } else {
      if (tapSource !== idx) onReorder(tapSource, idx);
      setTapSource(null);
    }
  };

  const tapHint =
    tapSource === null ? gt(CAFE.tapPickFirst, langA) : gt(CAFE.tapPickTarget, langA);

  return (
    <div className="ss-wrap">
      <ScopedStyle css={SS_CSS} />

      <section className="ss-side" data-ux-surface="panel">
        <p data-ux-role="secondary" className="ss-step">{gt(CAFE.stepSteps, langA)}</p>
        <div className="ss-dish">
          <span className="ss-emoji" aria-hidden="true">{menu.emoji}</span>
          <span data-ux-role="body-emphasis" className="ss-dishname">
            <GameText map={menu.name} lang={chefLang} />
          </span>
        </div>

        <h3 data-ux-role="label" className="ss-h">📋 {gt(CAFE.myOrderList, langA)}</h3>

        <div className="ss-modes">
          <button
            data-ux-role="control"
            className="ss-mode"
            data-on={mode === "drag" ? "" : undefined}
            aria-pressed={mode === "drag"}
            onClick={() => {
              setMode("drag");
              setTapSource(null);
            }}
          >
            ✋ {gp(CAFE.modeDrag, langA)}
          </button>
          <button
            data-ux-role="control"
            className="ss-mode"
            data-on={mode === "tap" ? "" : undefined}
            aria-pressed={mode === "tap"}
            onClick={() => {
              setMode("tap");
              setDrag(null);
            }}
          >
            👉 {gp(CAFE.modeTap, langA)}
          </button>
        </div>
        {mode === "tap" && (
          <p data-ux-role="secondary" className="ss-taphint" role="status">{tapHint}</p>
        )}

        <div ref={listRef} className="ss-list">
          {empty && (
            <p data-ux-role="body" className="ss-empty">{gt(CAFE.emptyOrder, langA)}</p>
          )}

          {stepOrder.map((id, idx) => {
            const s = STEP_BY_ID[id];
            const active = drag?.from === idx;
            const dragOffset =
              drag && drag.from === idx ? drag.currentY - drag.startY : 0;
            const chosen = tapSource === idx;
            return (
              <div
                key={`${id}-${idx}`}
                className="ss-row"
                data-active={active ? "" : undefined}
                data-chosen={chosen ? "" : undefined}
                data-mode={mode}
                style={{ transform: `translateY(${dragOffset}px)` }}
                onPointerDown={(e) => {
                  if (mode === "drag") {
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                    startDrag(e, idx);
                  }
                }}
                onClick={() => handleTapChip(idx)}
              >
                <span data-ux-role="label" className="ss-idx">{idx + 1}</span>
                <span className="ss-rowemoji" aria-hidden="true">{s.emoji}</span>
                <span data-ux-role="body" className="ss-rowname">
                  <GameText map={s.name} lang={chefLang} />
                </span>
                <button
                  data-ux-role="control"
                  className="ss-remove"
                  aria-label={`${tr(s.name, chefLang)} · ${gp(CAFE.remove, langA)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(idx);
                  }}
                >
                  ✕ {gp(CAFE.remove, langA)}
                </button>
              </div>
            );
          })}
        </div>

        {empty && (
          <p data-ux-role="body" className="ss-reason" role="status">
            {gt(CAFE.needStep, langA)}
          </p>
        )}
        <button
          data-ux-role="action"
          className="bc-primary ss-serve"
          aria-disabled={empty}
          onClick={() => {
            if (empty) return; // 이유는 위 안내 문구로 보인다
            onServe();
          }}
        >
          🛎️ {gp(CAFE.serve, langA)}
        </button>
      </section>

      <section className="ss-palette">
        <h3 data-ux-role="label" className="ss-h">➕ {gt(CAFE.tapToAdd, langA)}</h3>
        <div className="ss-grid">
          {STEPS.map((s) => (
            <button
              key={s.id}
              data-ux-role="control"
              className="ss-item"
              aria-label={tr(s.name, chefLang)}
              onClick={() => onAdd(s.id)}
            >
              <span className="ss-itememoji" aria-hidden="true">{s.emoji}</span>
              <span data-ux-role="label" className="ss-itemname">
                <GameText map={s.name} lang={chefLang} />
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const SS_CSS = `
.ss-wrap{ display: grid; gap: var(--ux-space-4); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1024px){
  .ss-wrap{ grid-template-columns: minmax(320px, 440px) minmax(0, 1fr); align-items: start; }
}
.ss-side{
  display: grid; gap: var(--ux-space-3); align-content: start;
  padding: var(--ux-space-4); background: var(--ux-surface);
}
.ss-step{ margin: 0; font-weight: 800; }
.ss-dish{ display: flex; align-items: center; gap: var(--ux-space-3); flex-wrap: wrap; }
.ss-emoji{ font-size: calc(var(--ux-font-title) * 1.6); line-height: 1; }
.ss-dishname{ font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }
.ss-h, .ss-empty, .ss-reason, .ss-taphint{ margin: 0; word-break: keep-all; overflow-wrap: anywhere; }

.ss-modes{ display: grid; gap: var(--ux-space-2); grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.ss-mode[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-surface-sunk);
  font-family: inherit; font-weight: 800;
  word-break: keep-all; overflow-wrap: anywhere;
}
.ss-mode[data-on]{ border-color: var(--ux-selected-border); background: var(--ux-hint-lavender); }

.ss-list{
  display: grid; gap: var(--ux-space-2);
  padding: var(--ux-space-3); min-height: 5rem;
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-panel);
}
.ss-empty{ color: var(--ux-ink-soft); text-align: center; }
.ss-row{
  position: relative; z-index: 1;
  display: flex; align-items: center; gap: var(--ux-space-2);
  padding: var(--ux-space-2) var(--ux-space-3);
  background: var(--ux-surface); border: 2px solid transparent;
  border-radius: var(--ux-radius-surface);
  touch-action: none; user-select: none;
  transition: transform var(--ux-motion-state) var(--ux-motion-ease);
}
.ss-row[data-mode="drag"]{ cursor: grab; }
.ss-row[data-mode="tap"]{ cursor: pointer; }
.ss-row[data-active]{
  z-index: 5; transition: none; cursor: grabbing;
  border-color: var(--ux-selected-border); background: var(--ux-hint-apricot);
}
.ss-row[data-chosen]{ border-color: var(--ux-selected-border); background: var(--ux-hint-apricot); }
.ss-idx{ font-weight: 900; color: var(--ux-ink-soft); min-width: 2ch; }
.ss-rowemoji{ font-size: calc(var(--ux-font-body) * 1.3); line-height: 1; }
.ss-rowname{ flex: 1; font-weight: 800; min-width: 0; word-break: keep-all; overflow-wrap: anywhere; }
.ss-remove[data-ux-role="control"]{
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  border: 2px solid transparent; font-family: inherit; font-weight: 800;
  padding: var(--ux-space-1) var(--ux-space-3); white-space: nowrap;
}

.ss-palette{ display: grid; gap: var(--ux-space-3); align-content: start; }
.ss-grid{ display: grid; gap: var(--ux-space-2); grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
@media (min-width: 1024px){
  .ss-grid{ grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
}
.ss-item[data-ux-role="control"]{
  display: grid; justify-items: center; gap: var(--ux-space-1);
  padding: var(--ux-space-3) var(--ux-space-2);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-surface-sunk);
  border-radius: var(--ux-radius-surface);
  font-family: inherit; font-weight: 700; text-align: center;
  transition: border-color var(--ux-motion-state) var(--ux-motion-ease);
}
.ss-item:hover, .ss-item:focus-visible{ border-color: var(--ux-primary-border); }
.ss-itememoji{ font-size: calc(var(--ux-font-title) * 1.2); line-height: 1; }
.ss-itemname{ word-break: keep-all; overflow-wrap: anywhere; }
.ss-serve{ justify-self: stretch; }
`;

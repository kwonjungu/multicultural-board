"use client";

// 공용 멀티툴 그림판 — 화이트보드와 그림책 그림 모드가 같은 엔진을 쓴다.
// 도구: 펜·형광펜·직선·사각형·원·화살표·글자·지우개 + 되돌리기 + 색/굵기.
//  - onChange(dataUrl): 변화가 생길 때(획 끝/도형/글자/지우기/되돌리기) 디바운스 후 호출 → 라이브 스트리밍용
//  - ref.getDataUrl(): 제출 시점의 최종 이미지(즉시) — 디바운스 대기와 무관

import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from "react";
import ScopedStyle from "./ui/child/ScopedStyle";
import { CHILD_UX } from "@/lib/childUx/tokens";

export type ToolId = "pen" | "highlighter" | "line" | "rect" | "ellipse" | "arrow" | "text" | "eraser";

const TOOLS: { id: ToolId; icon: string; label: string }[] = [
  { id: "pen",         icon: "✏️", label: "펜" },
  { id: "highlighter", icon: "🖊️", label: "형광펜" },
  { id: "line",        icon: "📏", label: "직선" },
  { id: "rect",        icon: "▭",  label: "사각형" },
  { id: "ellipse",     icon: "◯",  label: "원" },
  { id: "arrow",       icon: "➶",  label: "화살표" },
  { id: "text",        icon: "🅰",  label: "글자" },
  { id: "eraser",      icon: "🧽", label: "지우개" },
];
const SHAPE_TOOLS: ToolId[] = ["line", "rect", "ellipse", "arrow"];
const COLORS = ["#1a1a1a", "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#e91e63", "#ffffff"];
const SIZES = [3, 8, 16];
const UNDO_LIMIT = 8;
/** 가로(landscape) 화면에서 도구를 세로 rail 로 돌리는 폭 하한. 이보다 좁게
 *  주어진 컨테이너(예: 토론 화면의 460px 그림 응답칸)에서는 rail 이 캔버스를
 *  더 좁게 만들 뿐이라 그대로 쌓아 둔다. */
const RAIL_MIN_WIDTH = 560;

/**
 * 도구 줄 CSS — U-DRAW01 (04 §5).
 *
 * 이전에는 도구 두 줄(펜 8종 + 색·굵기·되돌리기)이 인라인 px 로 캔버스 위에
 * 항상 쌓여, 1366x768 가로 화면에서 137px(뷰포트 세로의 18%)를 먹고 캔버스
 * 아래가 실제로 잘렸다(before-creative 실측). 캔버스가 우선이라는 원칙에
 * 따라 고친다:
 *  - 가로로 넓고 짧은 화면(=태블릿/크롬북 가로, orientation:landscape)에서는
 *    도구를 캔버스 옆 세로 rail 로 돌려 세로 공간을 캔버스에 돌려준다.
 *    세로로 긴 화면(태블릿 세로)에서는 세로 공간이 넉넉하므로 기존처럼
 *    캔버스 위에 짧게 쌓는다 — rail 로 바꾸면 캔버스 폭만 줄어든다.
 *  - 도구 버튼은 아이콘+글자 라벨을 항상 같이 보여준다 — 툴팁 없이도 뜻을
 *    알 수 있어야 한다(04 §5).
 *  - 조작 영역 크기는 인라인 px 가 아니라 [data-ux-role="control"] 토큰이
 *    정한다. 크기를 지키되 굵은 테두리를 항상 두르지는 않는다(선택된
 *    도구만 강조).
 */
const DB_CSS = `
.db-root{ display:flex; flex-direction:column; gap: var(--ux-space-3); }
.db-body{ display:flex; flex-direction:column; gap: var(--ux-space-3); min-width:0; }
.db-toolbar{ display:flex; flex-direction:column; gap: var(--ux-space-2); flex-shrink:0; }
.db-tools{ display:flex; flex-wrap:wrap; gap: var(--ux-space-2); }
.db-tool{
  display:inline-flex; align-items:center; justify-content:center; gap:4px;
  background: var(--ux-surface); color: var(--ux-ink-soft); font-family:inherit; font-weight:800;
  border: 2px solid transparent;
}
.db-tool[data-ux-role="control"]{ padding: var(--ux-space-2) var(--ux-space-3); }
/* 선택 강조색은 accent prop(인라인 style) 이 정한다 — 화면마다 다른 accent
   계약(그림책 파랑 등)을 지키기 위해서다. 여기서는 미선택 기본값만 둔다. */
.db-tool-ico{ font-size: 1.2em; line-height:1; }
.db-tool-lb{ white-space:nowrap; }

.db-swatchrow{ display:flex; flex-wrap:wrap; gap: var(--ux-space-2); align-items:center; }
.db-divider{ width:2px; align-self:stretch; background: var(--ux-primary-border); opacity:.3; border-radius:2px; }
.db-swatch{
  display:inline-flex; align-items:center; justify-content:center;
  background: var(--ux-surface); border: 2px solid transparent; padding:0;
}
.db-swatch[data-ux-role="control"]{ width: var(--ux-control-min); padding:0; }
.db-swatch[aria-pressed="true"]{ border-color: var(--ux-selected-border); background: var(--ux-hint-apricot); }
.db-swatch-dot{ width:22px; height:22px; border-radius:50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); flex-shrink:0; }
.db-size-dot{ border-radius:50%; background: var(--ux-ink); flex-shrink:0; }

.db-history{ display:flex; gap: var(--ux-space-2); justify-content: space-between; align-items:center; }
.db-btn{
  background: transparent; border: 2px solid transparent; color: var(--ux-ink-soft);
  font-family:inherit; font-weight:800; display:inline-flex; align-items:center; gap:6px;
}
.db-btn[data-ux-role="control"]{ padding: var(--ux-space-2) var(--ux-space-3); }
.db-btn:hover, .db-btn:focus-visible{ background: var(--ux-surface-sunk); color: var(--ux-ink); }
.db-btn:disabled{ opacity:.5; cursor:default; }
.db-btn.danger{ color: var(--ux-error); }
.db-btn.danger:hover, .db-btn.danger:focus-visible{ background: #FEF2F2; }

.db-canvaswrap{ position:relative; min-width:0; flex:1; }
.db-canvas{
  width:100%; display:block; border-radius: var(--ux-radius-surface);
  border: 2px solid var(--ux-primary-border); background:#fff; touch-action:none;
}
.db-text-input{
  position:absolute; min-width:120px; padding:2px 6px; border-radius:6px; outline:none;
  border: 2px dashed var(--ux-selected-border); background: rgba(255,255,255,.95);
  font-family:inherit; font-weight:700;
}
.db-hint{ margin-top:2px; }

/* 가로로 넓고 짧은 화면에서만 rail 로 — 세로로 긴 화면은 그대로 쌓는다. */
[data-db-layout="rail"] .db-body{ flex-direction: row; align-items: stretch; }
/* rail 을 **한 줄로 세우면 캔버스보다 훨씬 길어진다.** 실측 116x1208px 로
   캔버스(736px)보다 472px 더 길었고, 그만큼 화면이 세로로 늘어졌다
   (사용자 지적: "이거 반응형으로 이상하네"). 도구는 2열, 색은 3열로 접어
   rail 높이를 캔버스 안에 들어오게 한다. */
[data-db-layout="rail"] .db-toolbar{
  flex-direction: column; width: 152px; overflow-y: auto;
  padding-right: var(--ux-space-1);
}
[data-db-layout="rail"] .db-tools{
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
}
[data-db-layout="rail"] .db-tool{ flex-direction: column; width: 100%; gap:2px; }
[data-db-layout="rail"] .db-swatchrow{
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center; justify-items: center;
}
[data-db-layout="rail"] .db-swatchrow .db-divider{ grid-column: 1 / -1; width: 100%; }
[data-db-layout="rail"] .db-divider{ width: auto; height:2px; margin: 2px 0; }
[data-db-layout="rail"] .db-history{ flex-direction: column; align-items: stretch; }
/* rail 로도 폭이 남으면 3:2 캔버스가 세로로 화면을 넘칠 수 있다(예: 1366x768).
   세로 예산을 넘지 않게 높이로도 한 번 더 잡아 준다 — 캔버스가 잘리는 것보다
   살짝 작아지는 편이 낫다. */
[data-db-layout="rail"] .db-canvaswrap{ max-height: calc(100svh - var(--ux-space-8)); }
[data-db-layout="rail"] .db-canvas{ width: auto; height: 100%; max-width: 100%; }
`;

interface Pt { x: number; y: number }
interface TextEntry { cssX: number; cssY: number; cx: number; cy: number; fontCss: number; value: string }

export interface DrawBoardHandle {
  /** 현재 캔버스의 JPEG dataURL (제출용). */
  getDataUrl: (quality?: number) => string;
  /** 캔버스를 흰색으로 비운다. */
  reset: () => void;
}

/**
 * 개발용 fixture 주입구 (HARNESS §2 G0). DrawBoard 는 그 자체로 Firebase/네트워크를
 * 쓰지 않는 순수 캔버스 엔진이다 — 여기의 fixture 는 네트워크 차단이 아니라
 * "빈 캔버스로 시작하지 않게" 초기 그림을 심어주는 용도다. 검수 화면에서 캔버스가
 * 비어 보이면 실제로 그려진 상태인지 확인할 수 없기 때문.
 */
export interface DrawBoardFixture {
  /** 마운트 시 캔버스에 그려 넣을 초기 이미지(데이터 URL). 없으면 기존처럼 흰 배경. */
  initialImageDataUrl?: string;
}

export interface DrawBoardProps {
  width?: number;
  height?: number;
  /** 강조색(선택 도구 하이라이트). 기본은 공통 디자인 토큰의 선택 강조색 —
   *  그림책처럼 자기 accent 를 넘기는 화면은 그 색을 그대로 쓴다. */
  accent?: string;
  /** 변화 디바운스 후 최신 dataURL 콜백 — 라이브 스트리밍용. */
  onChange?: (dataUrl: string) => void;
  /** onChange 디바운스(ms). 기본 600. */
  debounceMs?: number;
  fixture?: DrawBoardFixture;
}

const DrawBoard = forwardRef<DrawBoardHandle, DrawBoardProps>(function DrawBoard(
  // 기본 accent 는 공통 디자인 토큰의 선택 강조색 — 화이트보드·토론처럼 accent 를
  // 따로 넘기지 않는 화면은 자동으로 공통 규칙을 따른다. 그림책처럼 자기 accent 를
  // 넘기는 화면(StorybookRoom·PostModal)의 계약은 그대로 유지된다 — 건드리지 않는다.
  { width = 720, height = 480, accent = CHILD_UX.palette["selected-border"], onChange, debounceMs = 600, fixture },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolId>("pen");
  const [color, setColor] = useState("#1a1a1a");
  const [size, setSize] = useState(8);
  const [canUndo, setCanUndo] = useState(false);
  const [textEntry, setTextEntry] = useState<TextEntry | null>(null);

  // 도구 rail 전환: 실제로 주어진 폭(부모가 정함 — 그리기 엔진 자신의 콘텐츠가
  // 아니다)과 화면 방향(가로/세로)을 함께 본다. 폭만 보면 세로로 긴 태블릿도
  // rail 이 되어 버리고, 방향만 보면 토론 화면의 좁은 460px 그림칸까지 rail
  // 이 되어 캔버스가 더 좁아진다.
  const [railWidth, setRailWidth] = useState(0);
  const [landscape, setLandscape] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setRailWidth(box.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const update = () => setLandscape(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const railLayout = landscape && railWidth >= RAIL_MIN_WIDTH;

  const drawingRef = useRef(false);
  const startRef = useRef<Pt | null>(null);
  const lastRef = useRef<Pt | null>(null);
  const committedRef = useRef<ImageData | null>(null);
  const undoRef = useRef<ImageData[]>([]);
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // onChange 최신 참조(이펙트 의존성 없이 호출)
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useImperativeHandle(ref, () => ({
    getDataUrl: (quality = 0.7) => canvasRef.current?.toDataURL("image/jpeg", quality) ?? "",
    reset: () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      undoRef.current = [];
      setCanUndo(false);
      emitChange();
    },
  }));

  // 흰 배경 초기화 + 최초 1회 emit. fixture 가 초기 이미지를 주면 그 위에 그려 넣는다
  // (검수용 — 빈 캔버스가 아니라 실제 그려진 상태를 보여줘야 하므로).
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (fixture?.initialImageDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        emitChange();
      };
      img.src = fixture.initialImageDataUrl;
    } else {
      emitChange();
    }
    return () => { if (changeTimer.current) clearTimeout(changeTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ctx2d() { return canvasRef.current!.getContext("2d")!; }

  function emitChange() {
    if (!onChangeRef.current) return;
    if (changeTimer.current) clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => {
      const url = canvasRef.current?.toDataURL("image/jpeg", 0.6);
      if (url) onChangeRef.current?.(url);
    }, debounceMs);
  }

  function pushUndo() {
    const snap = ctx2d().getImageData(0, 0, width, height);
    undoRef.current.push(snap);
    if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift();
    setCanUndo(true);
  }
  function undo() {
    const prev = undoRef.current.pop();
    if (!prev) return;
    ctx2d().putImageData(prev, 0, 0);
    setCanUndo(undoRef.current.length > 0);
    emitChange();
  }

  function canvasPos(e: React.MouseEvent | React.TouchEvent): Pt {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const p = "touches" in e ? (e.touches[0] || e.changedTouches[0]) : (e as React.MouseEvent);
    return { x: (p.clientX - rect.left) * sx, y: (p.clientY - rect.top) * sy };
  }

  function applyStroke(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 1;
    if (tool === "eraser") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = size * 3;
    } else if (tool === "highlighter") {
      ctx.strokeStyle = color;
      ctx.lineWidth = size * 3;
      ctx.globalAlpha = 0.3;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }
  }

  function drawShape(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (tool === "line") {
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else if (tool === "rect") {
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    } else if (tool === "ellipse") {
      ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool === "arrow") {
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const head = Math.max(12, size * 3);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(ang - Math.PI / 6), b.y - head * Math.sin(ang - Math.PI / 6));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(ang + Math.PI / 6), b.y - head * Math.sin(ang + Math.PI / 6));
      ctx.stroke();
    }
  }

  function onDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const pos = canvasPos(e);
    if (tool === "text") {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const p = "touches" in e ? (e.touches[0] || e.changedTouches[0]) : (e as React.MouseEvent);
      const scale = rect.width / canvas.width;
      setTextEntry({
        cssX: p.clientX - rect.left,
        cssY: p.clientY - rect.top,
        cx: pos.x, cy: pos.y,
        fontCss: (14 + size * 2.5) * scale,
        value: "",
      });
      return;
    }
    pushUndo();
    drawingRef.current = true;
    startRef.current = pos;
    lastRef.current = pos;
    const ctx = ctx2d();
    if (SHAPE_TOOLS.includes(tool)) {
      committedRef.current = ctx.getImageData(0, 0, width, height);
    } else {
      applyStroke(ctx);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  }

  function onMove(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const pos = canvasPos(e);
    const ctx = ctx2d();
    if (SHAPE_TOOLS.includes(tool)) {
      if (committedRef.current) ctx.putImageData(committedRef.current, 0, 0);
      drawShape(ctx, startRef.current!, pos);
    } else {
      applyStroke(ctx);
      ctx.beginPath();
      ctx.moveTo(lastRef.current!.x, lastRef.current!.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastRef.current = pos;
  }

  function onUp(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return;
    const pos = canvasPos(e);
    const ctx = ctx2d();
    if (SHAPE_TOOLS.includes(tool)) {
      if (committedRef.current) ctx.putImageData(committedRef.current, 0, 0);
      drawShape(ctx, startRef.current!, lastRef.current ?? pos);
      committedRef.current = null;
    }
    ctx.globalAlpha = 1;
    drawingRef.current = false;
    startRef.current = null;
    lastRef.current = null;
    emitChange();
  }

  function commitText() {
    if (!textEntry) return;
    const val = textEntry.value.trim();
    if (val) {
      pushUndo();
      const ctx = ctx2d();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.font = `700 ${14 + size * 2.5}px 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif`;
      ctx.fillText(val, textEntry.cx, textEntry.cy);
      emitChange();
    }
    setTextEntry(null);
  }

  function clearAll() {
    pushUndo();
    const ctx = ctx2d();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    emitChange();
  }

  return (
    <div ref={rootRef} className="db-root" data-db-layout={railLayout ? "rail" : "stack"}>
      <ScopedStyle css={DB_CSS} />
      <div className="db-body">
        <div className="db-toolbar" role="toolbar" aria-label="그리기 도구">
          {/* 도구 선택 — 아이콘+글자를 항상 같이 보여줘 툴팁 없이도 뜻이 남는다. */}
          <div className="db-tools">
            {TOOLS.map((tl) => (
              <button
                key={tl.id}
                type="button"
                data-ux-role="control"
                className="db-tool"
                onClick={() => setTool(tl.id)}
                aria-pressed={tool === tl.id}
                title={tl.label}
                // 선택 강조색은 accent prop 을 따른다 — 그림책·게시판처럼 자기
                // 색을 넘기는 화면의 기존 계약(파랑/칼럼색 강조)을 지킨다.
                style={tool === tl.id ? { borderColor: accent, background: `${accent}22`, color: accent } : undefined}
              >
                <span aria-hidden className="db-tool-ico">{tl.icon}</span>
                <span className="db-tool-lb">{tl.label}</span>
              </button>
            ))}
          </div>

          {/* 색·굵기 */}
          <div className="db-swatchrow">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                data-ux-role="control"
                className="db-swatch"
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                aria-label={`색상 ${c}`}
              >
                <span
                  aria-hidden
                  className="db-swatch-dot"
                  style={{ background: c }}
                />
              </button>
            ))}
            <div className="db-divider" />
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                data-ux-role="control"
                className="db-swatch"
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                aria-label={`굵기 ${s}`}
              >
                <span aria-hidden className="db-size-dot" style={{ width: s, height: s }} />
              </button>
            ))}
          </div>

          {/* 되돌리기(보조·낮은 강조) · 전체 지우기(오른쪽) */}
          <div className="db-history">
            <button
              type="button"
              data-ux-role="control"
              className="db-btn"
              onClick={undo}
              disabled={!canUndo}
            >↩︎ 되돌리기</button>
            <button
              type="button"
              data-ux-role="control"
              className="db-btn danger"
              onClick={clearAll}
            >🗑 전체 지우기</button>
          </div>
        </div>

        {/* 캔버스 (글자 입력창은 이 래퍼 기준 절대배치) */}
        <div className="db-canvaswrap">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="db-canvas"
            style={{
              cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : "crosshair",
            }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            onTouchStart={onDown}
            onTouchMove={onMove}
            onTouchEnd={onUp}
          />
          {textEntry && (
            <input
              autoFocus
              value={textEntry.value}
              onChange={(e) => setTextEntry({ ...textEntry, value: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextEntry(null); }}
              onBlur={commitText}
              placeholder="글자 입력 후 Enter"
              className="db-text-input"
              style={{
                left: textEntry.cssX, top: textEntry.cssY,
                // 캔버스에 실제로 찍힐 글자 크기를 그대로 보여줘야 하는 값이라
                // 역할 토큰이 아니라 붓 굵기에서 계산한다(commitText 와 같은 공식).
                fontSize: Math.max(14, textEntry.fontCss), color,
              }}
            />
          )}
        </div>
      </div>
      <div data-ux-role="secondary" className="db-hint">
        {tool === "text" ? "캔버스를 눌러 글자 위치를 정하고 입력하세요."
          : SHAPE_TOOLS.includes(tool) ? "끌어서 도형을 그려요. 놓으면 그려집니다."
          : "자유롭게 그려보세요."}
      </div>
    </div>
  );
});

export default DrawBoard;

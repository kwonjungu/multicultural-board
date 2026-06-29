"use client";

// 공용 멀티툴 그림판 — 화이트보드와 그림책 그림 모드가 같은 엔진을 쓴다.
// 도구: 펜·형광펜·직선·사각형·원·화살표·글자·지우개 + 되돌리기 + 색/굵기.
//  - onChange(dataUrl): 변화가 생길 때(획 끝/도형/글자/지우기/되돌리기) 디바운스 후 호출 → 라이브 스트리밍용
//  - ref.getDataUrl(): 제출 시점의 최종 이미지(즉시) — 디바운스 대기와 무관

import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from "react";

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

interface Pt { x: number; y: number }
interface TextEntry { cssX: number; cssY: number; cx: number; cy: number; fontCss: number; value: string }

export interface DrawBoardHandle {
  /** 현재 캔버스의 JPEG dataURL (제출용). */
  getDataUrl: (quality?: number) => string;
  /** 캔버스를 흰색으로 비운다. */
  reset: () => void;
}

export interface DrawBoardProps {
  width?: number;
  height?: number;
  /** 강조색(선택 도구 하이라이트). 기본 청록. */
  accent?: string;
  /** 변화 디바운스 후 최신 dataURL 콜백 — 라이브 스트리밍용. */
  onChange?: (dataUrl: string) => void;
  /** onChange 디바운스(ms). 기본 600. */
  debounceMs?: number;
}

const DrawBoard = forwardRef<DrawBoardHandle, DrawBoardProps>(function DrawBoard(
  { width = 720, height = 480, accent = "#14B8A6", onChange, debounceMs = 600 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<ToolId>("pen");
  const [color, setColor] = useState("#1a1a1a");
  const [size, setSize] = useState(8);
  const [canUndo, setCanUndo] = useState(false);
  const [textEntry, setTextEntry] = useState<TextEntry | null>(null);

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

  // 흰 배경 초기화 + 최초 1회 emit
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    emitChange();
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
    <div>
      {/* 도구 선택 */}
      <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
        {TOOLS.map((tl) => (
          <button
            key={tl.id}
            type="button"
            onClick={() => setTool(tl.id)}
            aria-pressed={tool === tl.id}
            title={tl.label}
            style={{
              minWidth: 44, height: 40, padding: "0 8px", borderRadius: 10,
              border: `2px solid ${tool === tl.id ? accent : "#e5e5e5"}`,
              background: tool === tl.id ? `${accent}22` : "#fff",
              color: tool === tl.id ? accent : "#374151",
              fontSize: 13, fontWeight: 800, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <span style={{ fontSize: 16 }}>{tl.icon}</span>{tl.label}
          </button>
        ))}
      </div>

      {/* 색·굵기·되돌리기·전체지우기 */}
      <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`색상 ${c}`}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              border: color === c ? "3px solid #1F2937" : "2px solid transparent",
              background: c, cursor: "pointer", flexShrink: 0,
              boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #ddd" : "none",
            }}
          />
        ))}
        <div style={{ width: 1, height: 22, background: "#e5e5e5", margin: "0 2px" }} />
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            aria-label={`굵기 ${s}`}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              border: size === s ? "2px solid #1F2937" : "2px solid transparent",
              background: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div style={{ width: s, height: s, borderRadius: "50%", background: "#333" }} />
          </button>
        ))}
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          style={{
            marginLeft: "auto", padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800,
            border: "2px solid #e5e5e5", background: canUndo ? "#fff" : "#F3F4F6",
            color: canUndo ? "#374151" : "#9CA3AF", cursor: canUndo ? "pointer" : "default",
          }}
        >↩︎ 되돌리기</button>
        <button
          type="button"
          onClick={clearAll}
          style={{
            padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800,
            border: "2px solid #FECACA", background: "#fff", color: "#B91C1C", cursor: "pointer",
          }}
        >🗑 전체 지우기</button>
      </div>

      {/* 캔버스 (글자 입력창은 이 래퍼 기준 절대배치) */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            width: "100%", display: "block", borderRadius: 12, border: "2px solid #e5e5e5",
            cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : "crosshair",
            touchAction: "none", background: "#fff",
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
            style={{
              position: "absolute",
              left: textEntry.cssX, top: textEntry.cssY,
              minWidth: 120, padding: "2px 6px",
              fontSize: Math.max(14, textEntry.fontCss), fontWeight: 700, color,
              border: `2px dashed ${accent}`, borderRadius: 6, outline: "none",
              background: "rgba(255,255,255,0.95)", fontFamily: "inherit",
            }}
          />
        )}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginTop: 6 }}>
        {tool === "text" ? "캔버스를 눌러 글자 위치를 정하고 입력하세요."
          : SHAPE_TOOLS.includes(tool) ? "끌어서 도형을 그려요. 놓으면 그려집니다."
          : "자유롭게 그려보세요."}
      </div>
    </div>
  );
});

export default DrawBoard;

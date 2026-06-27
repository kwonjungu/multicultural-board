"use client";

// [#6] 실시간 화이트보드 — 하이러닝식 멀티툴 보드 (모니터링 + 프롬프트)
//   학생: 펜·형광펜·직선·사각형·원·화살표·글자·지우개 + 되돌리기로 그리면
//         스냅샷이 자동 업로드.
//   교사: 전 학생 보드를 갤러리로 실시간 모니터링 + 확대 + 공통 주제 내려주기.

import { useEffect, useRef, useState } from "react";
import type { UserConfig } from "@/lib/types";
import { useBackLayer } from "@/lib/backStack";
import {
  setWhiteboardPrompt,
  subscribeWhiteboardMeta,
  pushWhiteboardSnapshot,
  subscribeWhiteboardBoards,
  clearWhiteboardBoards,
  type WhiteboardBoard,
} from "@/lib/whiteboard";

const COLORS = ["#1a1a1a", "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#e91e63", "#ffffff"];
const SIZES = [3, 8, 16];
const CANVAS_W = 720;
const CANVAS_H = 480;
const UNDO_LIMIT = 8;
const PAGE_BG = "linear-gradient(rgba(255,251,235,0.9), rgba(253,230,138,0.9)), url('/landing/game-canyon.webp') center / cover no-repeat";

type ToolId = "pen" | "highlighter" | "line" | "rect" | "ellipse" | "arrow" | "text" | "eraser";
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

interface Props {
  user: UserConfig;
  roomCode: string;
  myClientId: string;
  onBack: () => void;
}

export default function WhiteboardRoom({ user, roomCode, myClientId, onBack }: Props) {
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const unsub = subscribeWhiteboardMeta(roomCode, (m) => setPrompt(m.prompt || ""));
    return () => unsub();
  }, [roomCode]);

  return (
    <div style={{
      minHeight: "100vh", background: PAGE_BG, backgroundAttachment: "fixed",
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
      padding: "16px 12px 32px",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* 헤더 */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: "12px 14px",
          border: "2px solid #FDE68A", boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
          display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
        }}>
          <button
            onClick={onBack}
            aria-label="back"
            style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: "#fff", border: "2px solid #FDE68A",
              fontSize: 16, fontWeight: 900, color: "#92400E", cursor: "pointer",
            }}
          >←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
              🖍️ 실시간 화이트보드
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#B45309", marginTop: 1 }}>
              {user.isTeacher ? "학생들의 그림을 실시간으로 모니터링" : "그림을 그리면 선생님이 실시간으로 봐요"}
            </div>
          </div>
        </div>

        {user.isTeacher ? (
          <TeacherWhiteboard roomCode={roomCode} prompt={prompt} />
        ) : (
          <StudentWhiteboard roomCode={roomCode} myClientId={myClientId} name={user.myName} prompt={prompt} />
        )}
      </div>
    </div>
  );
}

// ════════════════════ 교사: 갤러리 + 프롬프트 ════════════════════
function TeacherWhiteboard({ roomCode, prompt }: { roomCode: string; prompt: string }) {
  const [boards, setBoards] = useState<WhiteboardBoard[]>([]);
  const [draft, setDraft] = useState(prompt);
  const [saving, setSaving] = useState(false);
  const [enlarged, setEnlarged] = useState<WhiteboardBoard | null>(null);

  useEffect(() => { setDraft(prompt); }, [prompt]);

  useEffect(() => {
    const unsub = subscribeWhiteboardBoards(roomCode, setBoards);
    return () => unsub();
  }, [roomCode]);

  useBackLayer(enlarged !== null, () => setEnlarged(null));

  async function savePrompt() {
    setSaving(true);
    try { await setWhiteboardPrompt(roomCode, draft.trim()); } catch { /* noop */ }
    setSaving(false);
  }

  async function clearAll() {
    if (!window.confirm("모든 학생의 그림을 지웁니다. 계속할까요?")) return;
    try { await clearWhiteboardBoards(roomCode); } catch { /* noop */ }
  }

  return (
    <>
      {/* 프롬프트 편집 */}
      <div style={{
        background: "#fff", borderRadius: 18, padding: "14px 16px",
        border: "2px solid #FDE68A", boxShadow: "0 6px 18px rgba(180,83,9,0.1)", marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#92400E", marginBottom: 8 }}>
          ✏️ 오늘의 그리기 주제 (학생 화면에 표시)
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="예: 우리 가족을 그려보세요"
            style={{
              flex: 1, minHeight: 44, padding: "8px 12px", borderRadius: 12,
              border: "2px solid #FDE68A", fontSize: 14, fontWeight: 600, color: "#1F2937",
              fontFamily: "inherit", outline: "none", background: "#FFFBEB",
            }}
          />
          <button
            onClick={savePrompt}
            disabled={saving}
            style={{
              minHeight: 44, padding: "0 16px", borderRadius: 12, border: "none",
              background: saving ? "#E5E7EB" : "linear-gradient(135deg, #F59E0B, #D97706)",
              color: saving ? "#9CA3AF" : "#fff", fontSize: 14, fontWeight: 900, cursor: saving ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >저장</button>
        </div>
      </div>

      {/* 통계 + 비우기 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{
          padding: "5px 12px", background: "#fff", border: "2px solid #FDE68A",
          borderRadius: 999, fontSize: 12, fontWeight: 900, color: "#B45309",
        }}>🖼️ {boards.length}명 그리는 중</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={clearAll}
          style={{
            padding: "8px 14px", borderRadius: 12, border: "2px solid #FECACA",
            background: "#fff", color: "#B91C1C", fontSize: 12, fontWeight: 900, cursor: "pointer",
          }}
        >🗑 전체 비우기</button>
      </div>

      {/* 갤러리 */}
      {boards.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "50px 20px", background: "rgba(255,255,255,0.85)",
          borderRadius: 18, border: "2px dashed #FDE68A", color: "#92400E", fontWeight: 700,
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🐝</div>
          아직 그림을 그리는 학생이 없어요.
        </div>
      ) : (
        <div style={{
          display: "grid", gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        }}>
          {boards.map((b) => (
            <button
              key={b.clientId}
              onClick={() => setEnlarged(b)}
              style={{
                background: "#fff", border: "2px solid #FDE68A", borderRadius: 16,
                padding: 8, cursor: "pointer", textAlign: "left",
                boxShadow: "0 6px 16px rgba(180,83,9,0.12)",
              }}
            >
              <img
                src={b.dataUrl}
                alt={`${b.name} 그림`}
                style={{ width: "100%", borderRadius: 10, display: "block", background: "#fff", aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, objectFit: "cover" }}
              />
              <div style={{ fontSize: 12, fontWeight: 900, color: "#1F2937", marginTop: 6, paddingLeft: 2 }}>
                {b.name}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 확대 모달 */}
      {enlarged && (
        <div
          onClick={() => setEnlarged(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 450,
            background: "rgba(9,7,30,0.8)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 22, padding: 16, maxWidth: 820, width: "100%",
            boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1, fontSize: 16, fontWeight: 900, color: "#1F2937" }}>
                🖍️ {enlarged.name}
              </div>
              <button
                onClick={() => setEnlarged(null)}
                aria-label="close"
                style={{
                  width: 36, height: 36, borderRadius: 10, border: "2px solid #FDE68A",
                  background: "#fff", color: "#92400E", fontSize: 16, fontWeight: 900, cursor: "pointer",
                }}
              >✕</button>
            </div>
            <img src={enlarged.dataUrl} alt={`${enlarged.name} 그림`} style={{ width: "100%", borderRadius: 12, background: "#fff" }} />
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════ 학생: 멀티툴 캔버스 + 자동 업로드 ════════════════════
interface Pt { x: number; y: number }
interface TextEntry { cssX: number; cssY: number; cx: number; cy: number; fontCss: number; value: string }

function StudentWhiteboard({
  roomCode, myClientId, name, prompt,
}: { roomCode: string; myClientId: string; name: string; prompt: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<ToolId>("pen");
  const [color, setColor] = useState("#1a1a1a");
  const [size, setSize] = useState(8);
  const [synced, setSynced] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [textEntry, setTextEntry] = useState<TextEntry | null>(null);

  const drawingRef = useRef(false);
  const startRef = useRef<Pt | null>(null);
  const lastRef = useRef<Pt | null>(null);
  const committedRef = useRef<ImageData | null>(null); // 도형 미리보기용 스냅샷
  const undoRef = useRef<ImageData[]>([]);
  const uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 흰 배경 초기화 + 최초 1회 빈 보드 업로드(교사 갤러리에 등장)
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    uploadSnapshot();
    return () => { if (uploadTimer.current) clearTimeout(uploadTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ctx2d() { return canvasRef.current!.getContext("2d")!; }

  function uploadSnapshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    pushWhiteboardSnapshot(roomCode, myClientId, name, dataUrl)
      .then(() => setSynced(true))
      .catch(() => { /* noop */ });
  }
  function scheduleUpload() {
    if (uploadTimer.current) clearTimeout(uploadTimer.current);
    uploadTimer.current = setTimeout(uploadSnapshot, 800);
  }

  function pushUndo() {
    const snap = ctx2d().getImageData(0, 0, CANVAS_W, CANVAS_H);
    undoRef.current.push(snap);
    if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift();
    setCanUndo(true);
  }
  function undo() {
    const prev = undoRef.current.pop();
    if (!prev) return;
    ctx2d().putImageData(prev, 0, 0);
    setCanUndo(undoRef.current.length > 0);
    scheduleUpload();
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
      // 클릭 위치에 글자 입력창을 띄운다
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
      committedRef.current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
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
    scheduleUpload();
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
      scheduleUpload();
    }
    setTextEntry(null);
  }

  function clearAll() {
    pushUndo();
    const ctx = ctx2d();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    scheduleUpload();
  }

  return (
    <div style={{
      background: "#fff", borderRadius: 20, padding: "14px 16px",
      border: "2px solid #FDE68A", boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
    }}>
      {/* 주제 */}
      {prompt && (
        <div style={{
          background: "#FEF3C7", border: "2px solid #FDE68A", borderRadius: 14,
          padding: "10px 14px", marginBottom: 12, fontSize: 15, fontWeight: 900, color: "#92400E",
        }}>
          ✏️ {prompt}
        </div>
      )}

      {/* 동기화 표시 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: synced ? "#10B981" : "#D1D5DB" }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>
          {synced ? "선생님이 보고 있어요" : "연결 중…"}
        </span>
      </div>

      {/* 도구 선택 */}
      <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
        {TOOLS.map((tl) => (
          <button
            key={tl.id}
            onClick={() => setTool(tl.id)}
            aria-pressed={tool === tl.id}
            title={tl.label}
            style={{
              minWidth: 44, height: 40, padding: "0 8px", borderRadius: 10,
              border: `2px solid ${tool === tl.id ? "#14B8A6" : "#e5e5e5"}`,
              background: tool === tl.id ? "#CCFBF1" : "#fff",
              color: tool === tl.id ? "#0F766E" : "#374151",
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
          onClick={undo}
          disabled={!canUndo}
          style={{
            marginLeft: "auto", padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800,
            border: "2px solid #e5e5e5", background: canUndo ? "#fff" : "#F3F4F6",
            color: canUndo ? "#374151" : "#9CA3AF", cursor: canUndo ? "pointer" : "default",
          }}
        >↩︎ 되돌리기</button>
        <button
          onClick={clearAll}
          style={{
            padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800,
            border: "2px solid #FECACA", background: "#fff", color: "#B91C1C", cursor: "pointer",
          }}
        >🗑 전체 지우기</button>
      </div>

      {/* 캔버스 (글자 입력창은 이 래퍼 기준으로 절대배치) */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
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
              border: "2px dashed #14B8A6", borderRadius: 6, outline: "none",
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
}

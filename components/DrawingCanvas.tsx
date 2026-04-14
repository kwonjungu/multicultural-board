"use client";

import { useRef, useState, useEffect } from "react";

const COLORS = ["#1a1a1a", "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#e91e63", "#ffffff"];
const SIZES = [3, 8, 15];

interface Props {
  onDone: (dataUrl: string) => void;
}

export default function DrawingCanvas({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#1a1a1a");
  const [size, setSize] = useState(8);
  const [isEraser, setIsEraser] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawing || !lastPos.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);

    ctx.beginPath();
    ctx.strokeStyle = isEraser ? "#ffffff" : color;
    ctx.lineWidth = isEraser ? size * 3 : size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function endDraw() {
    setIsDrawing(false);
    lastPos.current = null;
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div>
      {/* 툴바 */}
      <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => { setColor(c); setIsEraser(false); }}
            aria-label={`색상 ${c}`}
            aria-pressed={!isEraser && color === c}
            style={{
              width: 26, height: 26, borderRadius: "50%",
              border: !isEraser && color === c ? "2px solid #1F2937" : "2px solid transparent",
              background: c, cursor: "pointer", flexShrink: 0,
              boxShadow: !isEraser && color === c
                ? "0 0 0 3px rgba(0,0,0,0.08)"
                : c === "#ffffff" ? "inset 0 0 0 1px #ddd" : "none",
              transition: "border-color 0.12s, box-shadow 0.12s",
            }}
          />
        ))}

        <div style={{ width: 1, height: 22, background: "#e5e5e5", margin: "0 2px" }} />

        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => { setSize(s); setIsEraser(false); }}
            aria-label={`브러시 크기 ${s}`}
            aria-pressed={!isEraser && size === s}
            style={{
              width: 26, height: 26, borderRadius: "50%",
              border: !isEraser && size === s ? "2px solid #1F2937" : "2px solid transparent",
              background: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: !isEraser && size === s ? "0 0 0 3px rgba(0,0,0,0.08)" : "none",
              transition: "border-color 0.12s, box-shadow 0.12s",
            }}
          >
            <div style={{ width: s, height: s, borderRadius: "50%", background: "#333" }} />
          </button>
        ))}

        <button
          onClick={() => setIsEraser((v) => !v)}
          aria-label="지우개"
          aria-pressed={isEraser}
          style={{
            padding: "4px 10px", borderRadius: 8, fontSize: 11,
            border: `2px solid ${isEraser ? "#1F2937" : "#e5e5e5"}`,
            background: isEraser ? "#f0f0f0" : "#fff",
            cursor: "pointer", fontWeight: isEraser ? 700 : 400,
          }}
        >
          지우개
        </button>

        <button
          onClick={clear}
          aria-label="전체 지우기"
          style={{
            padding: "4px 10px", borderRadius: 8, fontSize: 11,
            border: "2px solid #e5e5e5", background: "#fff", cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          전체 지우기
        </button>
      </div>

      {/* 캔버스 */}
      <canvas
        ref={canvasRef}
        width={480}
        height={280}
        style={{
          width: "100%", display: "block",
          borderRadius: 12, border: "2px solid #e5e5e5",
          cursor: isEraser ? "cell" : "crosshair",
          touchAction: "none",
        }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />

      <button
        onClick={() => {
          const canvas = canvasRef.current;
          if (canvas) onDone(canvas.toDataURL("image/jpeg", 0.85));
        }}
        style={{
          marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12,
          background: "linear-gradient(135deg, #6C63FF, #9B59B6)",
          color: "#fff", fontWeight: 900, fontSize: 14, border: "none", cursor: "pointer",
        }}
      >
        그림 완성 ✓
      </button>
    </div>
  );
}

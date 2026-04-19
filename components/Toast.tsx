"use client";

import { useEffect } from "react";

interface Props {
  message: string | null;
  tone?: "success" | "error";
  onDismiss: () => void;
  durationMs?: number;
}

export default function Toast({ message, tone = "success", onDismiss, durationMs = 2200 }: Props) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  const color = tone === "error"
    ? { fg: "#991B1B", bd: "#EF4444", bg: "#FEF2F2", icon: "⚠" }
    : { fg: "#065F46", bd: "#10B981", bg: "#fff", icon: "✓" };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: `translateX(-50%) translateY(${message ? 0 : -60}px)`,
        opacity: message ? 1 : 0,
        background: color.bg,
        color: color.fg,
        padding: "12px 22px",
        borderRadius: 999,
        boxShadow: "0 12px 32px rgba(16,185,129,0.22)",
        border: `2px solid ${color.bd}`,
        zIndex: 500,
        pointerEvents: "none",
        fontSize: 15,
        fontWeight: 900,
        letterSpacing: -0.2,
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s",
        whiteSpace: "nowrap",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      {color.icon} {message}
    </div>
  );
}

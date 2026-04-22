"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import type { LogEntry } from "@/lib/marbleReducer";

export interface LogTickerProps {
  log: LogEntry[];
  /**
   * Display style:
   *  - "footer":  a 1–2 line bottom bar with expand toggle (default).
   *  - "mini":    up to 3 most-recent lines, no scroll, for embedding in the center card.
   */
  variant?: "footer" | "mini";
}

export function LogTicker({ log, variant = "footer" }: LogTickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log.length, expanded]);

  if (variant === "mini") {
    const recent = log.slice(-3);
    return (
      <div
        aria-live="polite"
        aria-label="최근 게임 로그"
        style={{
          background: "rgba(31,41,55,0.92)",
          color: "#F9FAFB",
          borderRadius: 8,
          padding: "4px 8px",
          fontSize: "clamp(9px, 1.2vw, 11px)",
          fontWeight: 700,
          lineHeight: 1.35,
          width: "100%",
          maxHeight: "30%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          boxSizing: "border-box",
        }}
      >
        {recent.length === 0 ? (
          <div style={{ opacity: 0.6 }}>—</div>
        ) : (
          recent.map((l) => (
            <div
              key={l.ts + l.text}
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              · {l.text}
            </div>
          ))
        )}
      </div>
    );
  }

  // Footer variant.
  const wrap: CSSProperties = {
    background: "#1F2937",
    color: "#F9FAFB",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    maxHeight: expanded ? 160 : 44,
    overflowY: expanded ? "auto" : "hidden",
    scrollBehavior: "smooth",
    lineHeight: 1.5,
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
  };

  const button: CSSProperties = {
    background: "#fff",
    color: "#92400E",
    border: "2px solid #FDE68A",
    borderRadius: 10,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
    alignSelf: "stretch",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "stretch",
        width: "100%",
      }}
    >
      <div ref={ref} style={wrap} aria-live="polite" aria-label="게임 로그">
        {log.length === 0 ? (
          <div style={{ opacity: 0.6 }}>—</div>
        ) : (expanded ? log : log.slice(-2)).map((l) => (
          <div
            key={l.ts + l.text}
            style={{
              whiteSpace: expanded ? "normal" : "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            · {l.text}
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-label={expanded ? "로그 접기" : "로그 더보기"}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        style={button}
      >
        {expanded ? "▼" : "▲"}
      </button>
    </div>
  );
}

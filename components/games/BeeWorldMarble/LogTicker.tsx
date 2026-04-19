"use client";

import { CSSProperties, useEffect, useRef } from "react";
import type { LogEntry } from "@/lib/marbleReducer";

export interface LogTickerProps {
  log: LogEntry[];
}

export function LogTicker({ log }: LogTickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log.length]);

  const wrap: CSSProperties = {
    background: "#1F2937",
    color: "#F9FAFB",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    maxHeight: 80,
    overflowY: "auto",
    scrollBehavior: "smooth",
    lineHeight: 1.5,
  };

  return (
    <div ref={ref} style={wrap} aria-live="polite">
      {log.length === 0 ? (
        <div style={{ opacity: 0.6 }}>—</div>
      ) : (
        log.map((l) => (
          <div key={l.ts + l.text}>· {l.text}</div>
        ))
      )}
    </div>
  );
}

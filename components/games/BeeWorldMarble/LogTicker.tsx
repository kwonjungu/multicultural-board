"use client";

import { useEffect, useRef, useState } from "react";
import ScopedStyle from "../../ui/child/ScopedStyle";
import type { LogEntry } from "@/lib/marbleReducer";

export interface LogTickerProps {
  log: LogEntry[];
  /**
   * Display style:
   *  - "footer":  a 1–2 line bottom bar with expand toggle (default).
   *  - "mini":    up to 2 most-recent lines, no scroll, for embedding in the center card.
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
    // 보드 한가운데 좁은 자리 — 최근 2줄만, 자체 스크롤 없이.
    const recent = log.slice(-2);
    return (
      <div className="mb-logmini" aria-live="polite" aria-label="최근 게임 로그">
        <ScopedStyle css={LOG_CSS} />
        {recent.length === 0 ? (
          <div className="mb-logempty">—</div>
        ) : (
          recent.map((l) => <div key={l.ts + l.text}>· {l.text}</div>)
        )}
      </div>
    );
  }

  // Footer variant.
  return (
    <div className="mb-logbar">
      <ScopedStyle css={LOG_CSS} />
      <div
        ref={ref}
        className="mb-logbody"
        data-expanded={expanded ? "" : undefined}
        aria-live="polite"
        aria-label="게임 로그"
      >
        {log.length === 0 ? (
          <p data-ux-role="secondary" className="mb-logempty">—</p>
        ) : (expanded ? log : log.slice(-2)).map((l) => (
          <p key={l.ts + l.text} data-ux-role="secondary" className="mb-logline">· {l.text}</p>
        ))}
      </div>
      <button
        data-ux-role="control"
        className="mb-logtoggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "접기" : "더보기"}
      </button>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const LOG_CSS = `
.mb-logmini{
  background: rgba(41,37,31,.92); color: #F7F3EC;
  border-radius: 8px; padding: var(--ux-space-1) var(--ux-space-2);
  font-size: var(--ux-font-secondary); font-weight: 700; line-height: var(--ux-lh-tight);
  width: 100%; max-height: 34%; overflow: hidden;
  display: flex; flex-direction: column; box-sizing: border-box;
}
.mb-logmini > div{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-logbar{ display: flex; gap: var(--ux-space-2); align-items: stretch; width: 100%; }
.mb-logbody{
  background: var(--ux-ink); color: #F7F3EC;
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-2) var(--ux-space-3);
  flex: 1; min-width: 0; box-sizing: border-box;
  max-height: 76px; overflow: hidden;
  display: grid; gap: var(--ux-space-1); align-content: start;
}
.mb-logbody[data-expanded]{ max-height: 200px; overflow-y: auto; scroll-behavior: smooth; }
.mb-logbody [data-ux-role="secondary"]{ color: inherit; }
.mb-logline{ margin: 0; overflow-wrap: anywhere; }
.mb-logempty{ margin: 0; opacity: .6; }
.mb-logtoggle[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
  flex-shrink: 0; white-space: nowrap;
}
`;

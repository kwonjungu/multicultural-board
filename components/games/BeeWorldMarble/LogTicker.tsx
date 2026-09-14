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
/* 예전에는 거의 검은 상자(rgba(41,37,31,.92))에 크림색 글씨였다. 옆에 나란히
   선 '더보기'·'처음부터' 는 크림 표면에 갈색 테두리라, 이 상자만 새까매서
   화면에서 혼자 튀었다(캡처로 확인). 같은 표면 토큰으로 맞춘다. */
.mb-logmini{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  border-radius: 8px; padding: var(--ux-space-1) var(--ux-space-2);
  font-size: var(--ux-font-secondary); font-weight: 700; line-height: var(--ux-lh-tight);
  width: 100%; max-height: 34%; overflow: hidden;
  display: flex; flex-direction: column; box-sizing: border-box;
}
.mb-logmini > div{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 로그와 버튼 두 개가 한 줄에 들어가려다 로그가 62px 로 눌려, 한 줄짜리 글이
   네 줄로 쪼개지고 잘렸다(캡처로 확인). 좁으면 로그가 제 줄을 갖도록 접는다. */
.mb-logbar{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); align-items: stretch; width: 100%; }
/* 펼친 로그도 같은 이유로 표면 토큰에 맞춘다. */
.mb-logbody{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-2) var(--ux-space-3);
  /* 140px 아래로는 줄지 않는다 — 그보다 좁으면 글이 글자 단위로 쪼개진다.
     들어갈 자리가 없으면 위 flex-wrap 이 로그를 제 줄로 내려 준다. */
  flex: 1 1 180px; min-width: 140px; box-sizing: border-box;
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

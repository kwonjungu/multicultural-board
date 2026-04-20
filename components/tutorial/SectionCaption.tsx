"use client";

import { useEffect, useState } from "react";
import { beePng } from "@/lib/assets";
import type { BeeExpression } from "./BeeGuide";

type CaptionKey = "board" | "games" | "interpreter" | "praise" | "vocab";

interface CaptionMeta {
  key: CaptionKey;
  title: string;
  body: string;
  expression: BeeExpression;
}

const CAPTIONS: Record<CaptionKey, CaptionMeta> = {
  board: {
    key: "board",
    title: "소통창이야!",
    body: "여기 글을 쓰면 친구들 나라말로 자동 번역돼~ 🧡",
    expression: "cheer",
  },
  games: {
    key: "games",
    title: "소통의 게임 🎮",
    body: "친구들이랑 같이 놀면서 말을 배워봐. 내가 심판 볼게!",
    expression: "celebrate",
  },
  interpreter: {
    key: "interpreter",
    title: "실시간 통역 🎙️",
    body: "말을 하면 다른 나라말로 바로 바뀌어. 수업 시간에 써봐~",
    expression: "think",
  },
  praise: {
    key: "praise",
    title: "칭찬 꿀벌집 🍯",
    body: "친구의 좋은 점을 클릭해서 스티커를 선물해줘!",
    expression: "welcome",
  },
  vocab: {
    key: "vocab",
    title: "단어 카드 📚",
    body: "새 단어를 그림이랑 소리로 배울 수 있어~",
    expression: "think",
  },
};

const STORAGE_KEY = "honey.tutorial.caption.seen.v1";

function loadSeen(): Set<CaptionKey> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as CaptionKey[]);
  } catch {
    return new Set();
  }
}

function saveSeen(set: Set<CaptionKey>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch { /* noop */ }
}

interface Props {
  /** Which section this caption is for. Determines content + dedup key. */
  section: CaptionKey;
  /** How long before auto-dismiss (ms). Default 9000. */
  autoDismissMs?: number;
  /** Optional offset from top-right corner. Default { top: 16, right: 16 }. */
  offset?: { top?: number; right?: number };
}

/**
 * A tiny first-entry hint that floats in the top-right when the user enters a
 * section for the first time. Non-blocking, auto-dismisses, and never reappears
 * for the same section once shown. For secondary tutorials — the main hub
 * uses the full TutorialHost experience.
 */
export default function SectionCaption({
  section,
  autoDismissMs = 9000,
  offset = {},
}: Props) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const seen = loadSeen();
    if (seen.has(section)) return;
    // small delay so the section has rendered
    const t = window.setTimeout(() => {
      seen.add(section);
      saveSeen(seen);
      setVisible(true);
    }, 450);
    return () => window.clearTimeout(t);
  }, [section]);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => dismiss(), autoDismissMs);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function dismiss() {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), 260);
  }

  if (!visible) return null;

  const meta = CAPTIONS[section];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: offset.top ?? 16,
        right: offset.right ?? 16,
        width: 260,
        background: "rgba(255, 251, 235, 0.97)",
        backdropFilter: "blur(6px)",
        border: "2px solid #FDE68A",
        borderRadius: 16,
        padding: "10px 34px 10px 12px",
        boxShadow: "0 10px 28px rgba(180, 83, 9, 0.22)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        zIndex: 100,
        fontFamily: "'Noto Sans KR', sans-serif",
        transform: leaving ? "translateX(calc(100% + 40px))" : "translateX(0)",
        opacity: leaving ? 0 : 1,
        transition: "transform 260ms cubic-bezier(0.4, 0, 0.2, 1), opacity 260ms ease",
        animation: leaving ? undefined : "captionSlideIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
      }}
    >
      <img
        src={beePng(meta.expression)}
        alt=""
        width={36}
        height={36}
        aria-hidden="true"
        style={{
          flexShrink: 0,
          filter: "drop-shadow(0 3px 6px rgba(245,158,11,0.35))",
          animation: "heroBeeFloat 2.6s ease-in-out infinite",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 900, color: "#92400E",
          letterSpacing: -0.1, marginBottom: 2,
        }}>
          {meta.title}
        </div>
        <div style={{
          fontSize: 11.5, lineHeight: 1.4, color: "#374151", fontWeight: 600,
        }}>
          {meta.body}
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="닫기"
        style={{
          position: "absolute",
          top: 6, right: 6,
          width: 22, height: 22,
          border: "none",
          background: "transparent",
          color: "#92400E",
          fontSize: 14, fontWeight: 900,
          cursor: "pointer",
          borderRadius: 6,
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      {/* progress line — gives a subtle sense of auto-dismiss */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 10, right: 10, bottom: 4,
          height: 2, borderRadius: 2,
          background: "#FDE68A",
          overflow: "hidden",
        }}
      >
        <div style={{
          width: "100%", height: "100%",
          background: "#F59E0B",
          animation: `captionProgress ${autoDismissMs}ms linear both`,
          transformOrigin: "left center",
        }} />
      </div>
    </div>
  );
}

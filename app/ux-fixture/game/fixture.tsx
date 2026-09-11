"use client";

import { useEffect, useState } from "react";
import HoneyTaboo from "@/components/games/HoneyTaboo";
import NumberTap from "@/components/games/NumberTap";
import WordMemory from "@/components/games/WordMemory";

/**
 * 이번 라운드에 손댄 게임만 올린다. 나머지 게임은 아직 토큰으로 옮기지 않았고,
 * 검증하지 않은 것을 검증한 것처럼 보이게 하지 않는다.
 * `?game=taboo|number|memory` 로 하나만 열 수 있다 (측정 스크립트가 쓰는 경로).
 */
const GAMES = {
  taboo: { label: "꿀벌 금칙어", cmp: HoneyTaboo },
  number: { label: "숫자 빨리 누르기", cmp: NumberTap },
  memory: { label: "기억 카드", cmp: WordMemory },
} as const;

type Key = keyof typeof GAMES;

export default function GameFixture() {
  const [key, setKey] = useState<Key>("taboo");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("game");
    if (q && q in GAMES) setKey(q as Key);
  }, []);

  const Active = GAMES[key].cmp;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ux-bg)" }}>
      <nav
        data-testid="fixture-nav"
        style={{ display: "flex", gap: 8, padding: 8, flexWrap: "wrap", background: "var(--ux-surface-sunk)" }}
      >
        {(Object.keys(GAMES) as Key[]).map((k) => (
          <button
            key={k}
            onClick={() => setKey(k)}
            aria-pressed={key === k}
            style={{
              padding: "10px 14px", borderRadius: 12, fontFamily: "inherit",
              border: key === k ? "3px solid var(--ux-selected-border)" : "2px solid var(--ux-ink-soft)",
              background: "var(--ux-surface)", color: "var(--ux-ink)", cursor: "pointer",
            }}
          >{GAMES[k].label}</button>
        ))}
      </nav>
      {/* 게임 쪽 data-ux-root 가 화면당 하나가 되도록 여기서는 달지 않는다. */}
      <Active langA="ko" langB="vi" />
    </div>
  );
}

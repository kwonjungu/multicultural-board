"use client";

import { CSSProperties, ReactNode, useMemo } from "react";
import { TILES } from "@/lib/marbleData";
import type { GameState, PlayerId } from "@/lib/marbleReducer";
import { Tile } from "./Tile";

export interface BoardProps {
  state: GameState;
  viewerLang: string;
  friendLang: string;
  /** Central card to render inside the ring (dice / prompts / etc.). */
  center?: ReactNode;
  /** Full-board overlay (e.g. chance / quiz card). Rendered above everything. */
  overlay?: ReactNode;
}

// ─────────────────────────────────────────────────────────────
// Square ring layout (Monopoly-style)
//
//   Corners (4):  top-left=0, top-right=8, bottom-right=15, bottom-left=23
//   Top edge (7): idx 1..7    between corners 0 and 8
//   Right edge (6): idx 9..14 between corners 8 and 15
//   Bottom edge (7): idx 16..22 between corners 15 and 23
//   Left edge (6): idx 24..29 between corners 23 and 0
//   Total: 4 + 7 + 6 + 7 + 6 = 30 ✓
//
//   All positions are expressed as % of the square board, so the board is
//   100% responsive inside its `aspect-ratio: 1/1` container.
// ─────────────────────────────────────────────────────────────

const CORNER_PCT = 13.5;                   // each corner is 13.5% wide/tall
const EDGE_H = 100 - 2 * CORNER_PCT;       // horizontal edge span = 73%
const EDGE_V = 100 - 2 * CORNER_PCT;       // vertical edge span   = 73%
const TOP_STEP = EDGE_H / 7;               // top has 7 intermediate tiles
const RIGHT_STEP = EDGE_V / 6;             // right has 6 intermediate tiles
const BOT_STEP = EDGE_H / 7;               // bottom has 7 intermediate tiles
const LEFT_STEP = EDGE_V / 6;              // left has 6 intermediate tiles

interface Slot {
  left: number;   // % from left
  top: number;    // % from top
  width: number;  // % of board
  height: number; // % of board
}

function slotFor(idx: number): Slot {
  // Corners
  if (idx === 0) {
    return { left: 0, top: 0, width: CORNER_PCT, height: CORNER_PCT };
  }
  if (idx === 8) {
    return {
      left: 100 - CORNER_PCT, top: 0,
      width: CORNER_PCT, height: CORNER_PCT,
    };
  }
  if (idx === 15) {
    return {
      left: 100 - CORNER_PCT, top: 100 - CORNER_PCT,
      width: CORNER_PCT, height: CORNER_PCT,
    };
  }
  if (idx === 23) {
    return {
      left: 0, top: 100 - CORNER_PCT,
      width: CORNER_PCT, height: CORNER_PCT,
    };
  }

  // Top edge: idx 1..7 → between corners 0 and 8
  if (idx >= 1 && idx <= 7) {
    const i = idx - 1; // 0..6
    return {
      left: CORNER_PCT + i * TOP_STEP,
      top: 0,
      width: TOP_STEP,
      height: CORNER_PCT,
    };
  }

  // Right edge: idx 9..14
  if (idx >= 9 && idx <= 14) {
    const i = idx - 9; // 0..5
    return {
      left: 100 - CORNER_PCT,
      top: CORNER_PCT + i * RIGHT_STEP,
      width: CORNER_PCT,
      height: RIGHT_STEP,
    };
  }

  // Bottom edge: idx 16..22 — right-to-left travel order
  if (idx >= 16 && idx <= 22) {
    const i = idx - 16; // 0..6, starts just left of bottom-right corner
    return {
      left: 100 - CORNER_PCT - (i + 1) * BOT_STEP,
      top: 100 - CORNER_PCT,
      width: BOT_STEP,
      height: CORNER_PCT,
    };
  }

  // Left edge: idx 24..29 — bottom-to-top travel order
  if (idx >= 24 && idx <= 29) {
    const i = idx - 24; // 0..5, starts just above bottom-left corner
    return {
      left: 0,
      top: 100 - CORNER_PCT - (i + 1) * LEFT_STEP,
      width: CORNER_PCT,
      height: LEFT_STEP,
    };
  }

  // Fallback (shouldn't happen for a 30-tile ring)
  return { left: 0, top: 0, width: CORNER_PCT, height: CORNER_PCT };
}

export function Board({
  state,
  viewerLang,
  friendLang,
  center,
  overlay,
}: BoardProps) {
  // Precompute per-tile occupants & owners for cheap lookups.
  const occupants = useMemo(() => {
    const map = new Map<number, PlayerId[]>();
    for (const pid of state.playerIds) {
      const p = state.players[pid];
      if (p.bankrupt) continue;
      const list = map.get(p.pos) ?? [];
      list.push(pid);
      map.set(p.pos, list);
    }
    return map;
  }, [state.players, state.playerIds]);

  const owners = useMemo(() => {
    const map = new Map<number, PlayerId[]>();
    for (const pid of state.playerIds) {
      for (const idx of state.players[pid].owned) {
        const list = map.get(idx) ?? [];
        list.push(pid);
        map.set(idx, list);
      }
    }
    return map;
  }, [state.players, state.playerIds]);

  const highlighted: number | null = (() => {
    const ph = state.phase;
    if (ph.kind === "moving") return ph.to;
    if (
      ph.kind === "landed" || ph.kind === "buyPrompt" ||
      ph.kind === "tollPaid" || ph.kind === "quiz" ||
      ph.kind === "festival"
    ) {
      return "tile" in ph ? ph.tile : null;
    }
    return null;
  })();

  /**
   * 판 자체. 기울이지 않는다 — 30칸의 작은 글씨가 원근으로 찌그러지면
   * 06 §2 가 금지한 "글씨가 기울어 읽기 어려워지는" 상태가 된다.
   * 깊이는 아래쪽 두께(옆면)와 책상에 닿는 그림자로만 만든다.
   */
  const outer: CSSProperties = {
    width: "min(96vw, 720px)",
    aspectRatio: "1 / 1",
    margin: "0 auto",
    position: "relative",
    background: "linear-gradient(#FFFBEB, #FEF3C7)",
    border: "3px solid #F59E0B",
    borderRadius: 16,
    boxSizing: "border-box",
    boxShadow: [
      // 판의 옆면 — 아래로 갈수록 어두워지는 얇은 띠가 두께로 읽힌다.
      "0 6px 0 #E8A63A",
      "0 10px 0 #C9821F",
      // 책상에 닿는 접촉 그림자 — 가까운 쪽은 진하고 좁게, 먼 쪽은 넓게.
      "0 14px 10px -6px rgba(120,53,15,.35)",
      "0 26px 34px -12px rgba(120,53,15,.28)",
    ].join(", "),
    overflow: "hidden",
  };

  const centerWrap: CSSProperties = {
    position: "absolute",
    left: `${CORNER_PCT}%`,
    top: `${CORNER_PCT}%`,
    width: `${100 - 2 * CORNER_PCT}%`,
    height: `${100 - 2 * CORNER_PCT}%`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2%",
    boxSizing: "border-box",
    pointerEvents: "none",
  };

  const centerInner: CSSProperties = {
    width: "100%",
    height: "100%",
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    // 두께와 접촉 그림자가 판 밖으로 나가므로 바깥에 여백을 준다.
    // 이 여백이 없으면 그림자가 잘려 판이 종이처럼 보인다.
    <div style={{ padding: "0 0 30px" }}>
    <div style={outer} aria-label="비마블 보드">
      {/* 벌 토큰 통통 튀는 모션 (이동 중인 타일에서) */}
      <style jsx global>{`
        @keyframes marbleBeeHop {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-22%); }
        }
      `}</style>
      {TILES.map((tile) => {
        const slot = slotFor(tile.idx);
        const cellStyle: CSSProperties = {
          position: "absolute",
          left: `${slot.left}%`,
          top: `${slot.top}%`,
          width: `${slot.width}%`,
          height: `${slot.height}%`,
          padding: "0.4%",
          boxSizing: "border-box",
        };
        return (
          <div key={tile.idx} style={cellStyle}>
            <Tile
              tile={tile}
              owners={owners.get(tile.idx) ?? []}
              occupants={occupants.get(tile.idx) ?? []}
              viewerLang={viewerLang}
              friendLang={friendLang}
              highlight={highlighted === tile.idx}
              skinOf={(id) => state.players[id]?.skin}
            />
          </div>
        );
      })}

      {center && (
        <div style={centerWrap}>
          <div style={centerInner}>{center}</div>
        </div>
      )}

      {overlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4%",
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(2px)",
            zIndex: 10,
            boxSizing: "border-box",
          }}
          role="dialog"
          aria-modal="true"
        >
          {overlay}
        </div>
      )}
    </div>
    </div>
  );
}

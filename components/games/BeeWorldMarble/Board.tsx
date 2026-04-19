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

  const outer: CSSProperties = {
    width: "min(96vw, 720px)",
    aspectRatio: "1 / 1",
    margin: "0 auto",
    position: "relative",
    background: "#FEF3C7",
    border: "3px solid #F59E0B",
    borderRadius: 14,
    boxSizing: "border-box",
    boxShadow: "0 8px 20px rgba(245,158,11,0.2)",
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
    <div style={outer} aria-label="비마블 보드">
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
  );
}

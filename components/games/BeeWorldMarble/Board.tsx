"use client";

import { CSSProperties, useMemo } from "react";
import {
  GRID_COLS,
  GRID_ROWS,
  TILES,
  tileCoord,
} from "@/lib/marbleData";
import type { GameState, PlayerId } from "@/lib/marbleReducer";
import { Tile } from "./Tile";

export interface BoardProps {
  state: GameState;
  viewerLang: string;
  friendLang: string;
}

export function Board({ state, viewerLang, friendLang }: BoardProps) {
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
    if (ph.kind === "landed" || ph.kind === "buyPrompt" || ph.kind === "tollPaid"
        || ph.kind === "quiz" || ph.kind === "festival") {
      return "tile" in ph ? ph.tile : null;
    }
    return null;
  })();

  const grid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
    gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
    width: "100%",
    aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
    gap: 2,
    background: "#FEF3C7",
    border: "3px solid #F59E0B",
    borderRadius: 12,
    padding: 4,
    boxSizing: "border-box",
    position: "relative",
  };

  // We render 30 tiles into specific grid cells; the center of the board
  // stays empty and hosts the dice / action panel overlay.
  const cells = TILES.map((tile) => {
    const { row, col } = tileCoord(tile.idx);
    const cellStyle: CSSProperties = {
      gridRow: row + 1,
      gridColumn: col + 1,
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
          size={TILE_SIZE_PX}
        />
      </div>
    );
  });

  return <div style={grid}>{cells}</div>;
}

// Nominal size — the tile scales via 100% width in the grid cell.
// Components inside use it to size icons proportionally.
const TILE_SIZE_PX = 70;

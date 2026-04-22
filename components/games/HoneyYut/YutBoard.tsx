"use client";

import { CSSProperties, useMemo } from "react";
import { TILE_GRAPH } from "@/lib/yutData";
import type { GameState, PieceId } from "@/lib/yutTypes";
import { YutPiece } from "./YutPiece";

interface Props {
  state: GameState;
  // When in chooseBranch, highlight the option tiles so players can tap them.
  highlightOptions: number[] | null;
  onNodeClick: ((node: number) => void) | null;
  // When in choosePiece for the current team, highlight the pieces that
  // could be moved with `currentThrow`.
  movableIds: PieceId[];
  onPieceClick: ((id: PieceId) => void) | null;
}

// Edges drawn under the nodes for visual guidance.
function makeEdges(): Array<{ a: number; b: number; dashed: boolean }> {
  const edges: Array<{ a: number; b: number; dashed: boolean }> = [];
  // Outer ring
  for (let i = 0; i < 20; i += 1) edges.push({ a: i, b: (i + 1) % 20, dashed: false });
  // Shortcuts (marked dashed)
  const shortcutPairs: Array<[number, number]> = [
    [5, 21], [21, 22], [22, 23],
    [10, 24], [24, 23],
    [23, 25], [25, 26], [26, 17],
    [23, 27], [27, 28], [28, 17],
  ];
  for (const [a, b] of shortcutPairs) edges.push({ a, b, dashed: true });
  return edges;
}

export function YutBoard({
  state,
  highlightOptions,
  onNodeClick,
  movableIds,
  onPieceClick,
}: Props): JSX.Element {
  const edges = useMemo(makeEdges, []);
  const nodes = TILE_GRAPH;

  // Group pieces by node for stacking render.
  const byNode = new Map<number, PieceId[]>();
  for (const p of Object.values(state.pieces)) {
    if (typeof p.node === "number") {
      const arr = byNode.get(p.node) ?? [];
      arr.push(p.id);
      byNode.set(p.node, arr);
    }
  }

  return (
    <div style={wrap}>
      <svg viewBox="0 0 1000 1000" style={svg} aria-label="윷놀이 판">
        <defs>
          <radialGradient id="hy-bg" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="100%" stopColor="#FDE68A" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={1000} height={1000} fill="url(#hy-bg)" rx={36} ry={36} />
        {/* Edges */}
        {edges.map((e, i) => {
          const a = nodes[e.a];
          const b = nodes[e.b];
          if (!a || !b) return null;
          return (
            <line
              key={`e-${i}`}
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              stroke={e.dashed ? "#F59E0B" : "#B45309"}
              strokeWidth={e.dashed ? 5 : 7}
              strokeDasharray={e.dashed ? "14 10" : undefined}
              strokeLinecap="round"
              opacity={0.55}
            />
          );
        })}
        {/* Nodes */}
        {nodes.map((n) => {
          if (n.idx === 20) return null; // placeholder slot
          const isCorner = n.kind === "corner" || n.kind === "start";
          const isCenter = n.kind === "center";
          const isHighlighted = highlightOptions?.includes(n.idx) ?? false;
          const r = isCenter ? 64 : isCorner ? 56 : 42;
          const fill = n.kind === "start"
            ? "#FEF3C7"
            : isCorner
              ? "#FCD34D"
              : isCenter
                ? "#FBBF24"
                : n.kind === "shortcut"
                  ? "#FEF3C7"
                  : "#FFFBEB";
          const stroke = isHighlighted ? "#16A34A" : isCorner || isCenter ? "#B45309" : "#D97706";
          const sw = isHighlighted ? 7 : 3;
          return (
            <g
              key={`n-${n.idx}`}
              onClick={onNodeClick ? () => onNodeClick(n.idx) : undefined}
              style={{ cursor: onNodeClick && isHighlighted ? "pointer" : "default" }}
            >
              <circle
                cx={n.x} cy={n.y} r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={sw}
              />
              {n.kind === "start" && (
                <text x={n.x} y={n.y + 8} textAnchor="middle" fontSize={36} fontWeight={800} fill="#B45309">
                  출발
                </text>
              )}
              {n.kind === "corner" && (
                <text x={n.x} y={n.y + 10} textAnchor="middle" fontSize={36} fontWeight={800} fill="#B45309">
                  {n.cornerRegion === "south" ? "남" : n.cornerRegion === "west" ? "서" : "북"}
                </text>
              )}
              {n.kind === "center" && (
                <text x={n.x} y={n.y + 12} textAnchor="middle" fontSize={40} fontWeight={900} fill="#7C2D12">
                  🐝
                </text>
              )}
            </g>
          );
        })}
        {/* Pieces */}
        {Array.from(byNode.entries()).map(([nodeIdx, ids]) => {
          const n = nodes[nodeIdx];
          if (!n) return null;
          return ids.map((id, i) => {
            const p = state.pieces[id];
            // Offset stacked pieces in a small cluster around the tile center.
            const angle = (i / Math.max(ids.length, 1)) * Math.PI * 2;
            const radius = ids.length === 1 ? 0 : 20;
            const cx = n.x + Math.cos(angle) * radius;
            const cy = n.y + Math.sin(angle) * radius;
            return (
              <YutPiece
                key={id}
                piece={p}
                x={cx}
                y={cy}
                size={50}
                isMovable={movableIds.includes(id)}
                onClick={onPieceClick ? () => onPieceClick(id) : undefined}
              />
            );
          });
        })}
      </svg>
    </div>
  );
}

const wrap: CSSProperties = {
  width: "100%",
  maxWidth: 560,
  margin: "0 auto",
  aspectRatio: "1 / 1",
  minWidth: 280,
};

const svg: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  borderRadius: 24,
  boxShadow: "0 6px 22px rgba(180, 83, 9, 0.15)",
};


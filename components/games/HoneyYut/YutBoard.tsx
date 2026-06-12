"use client";

// 윷놀이 보드 (SVG). 보드 + 말 + 홈 트레이 + 골 카운터를 모두 그린다.
// 말은 "같은 노드의 같은 팀"을 한 묶음으로 그리고 개수 배지를 붙인다.

import React from "react";
import { YUT_NODES, YUT_EDGES } from "@/lib/yutData";
import { movablePieceIds } from "@/lib/yutLogic";
import type { GameState, PieceId, TeamId, Throw } from "@/lib/yutTypes";

export const TEAM_COLOR: Record<TeamId, string> = { A: "#F59E0B", B: "#3B82F6" };
export const TEAM_IMG: Record<TeamId, string> = {
  A: "/stickers/skins/stage-4-bee-orange.png",
  B: "/stickers/skins/stage-4-bee-sky.png",
};

interface BoardGroup {
  team: TeamId;
  node: number;
  ids: PieceId[];
}

export default function YutBoard({
  state, selectedValue, onPickPiece,
}: {
  state: GameState;
  selectedValue: Throw | null;
  onPickPiece: (id: PieceId) => void;
}) {
  const canPick = state.phase === "move" && selectedValue !== null;
  const movable = new Set(canPick ? movablePieceIds(state, selectedValue!) : []);

  // 보드 위 말 묶음
  const groups = new Map<string, BoardGroup>();
  for (const p of Object.values(state.pieces)) {
    if (p.pos.kind !== "board") continue;
    const key = `${p.team}-${p.pos.node}`;
    const g = groups.get(key) ?? { team: p.team, node: p.pos.node, ids: [] };
    g.ids.push(p.id);
    groups.set(key, g);
  }

  const homePieces = (team: TeamId) =>
    Object.values(state.pieces).filter((p) => p.team === team && p.pos.kind === "home");
  const goalCount = (team: TeamId) =>
    Object.values(state.pieces).filter((p) => p.team === team && p.pos.kind === "goal").length;

  return (
    <svg
      viewBox="0 0 1000 1000"
      style={{ width: "min(94vw, 560px)", height: "auto", display: "block", touchAction: "manipulation" }}
      role="img"
      aria-label="윷놀이 판"
    >
      {/* 바탕 */}
      <rect x={30} y={30} width={940} height={940} rx={48}
        fill="#FFF7E0" stroke="#D4A95C" strokeWidth={7} />

      {/* 연결선 */}
      {YUT_EDGES.map(([a, b], i) => {
        const na = YUT_NODES[a], nb = YUT_NODES[b];
        return (
          <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke="#E2C58A" strokeWidth={9} strokeLinecap="round" />
        );
      })}

      {/* 노드 */}
      {YUT_NODES.map((n) => {
        const big = n.kind === "start" || n.kind === "corner" || n.kind === "center";
        return (
          <g key={n.idx}>
            <circle cx={n.x} cy={n.y} r={big ? 34 : 22}
              fill={n.kind === "start" ? "#FDE68A" : n.kind === "center" ? "#FECACA" : "#fff"}
              stroke={big ? "#B45309" : "#D4A95C"}
              strokeWidth={big ? 6 : 4} />
            {n.kind === "start" && (
              <text x={n.x} y={n.y + 7} textAnchor="middle" fontSize={22} fontWeight={900} fill="#92400E">출발</text>
            )}
            {n.kind === "center" && (
              <text x={n.x} y={n.y + 8} textAnchor="middle" fontSize={24}>🌸</text>
            )}
            {n.kind === "corner" && (
              <text x={n.x} y={n.y + 8} textAnchor="middle" fontSize={24}>🍯</text>
            )}
          </g>
        );
      })}

      {/* 홈 트레이 — B 는 위 삼각 영역, A 는 아래 삼각 영역 */}
      <HomeTray
        team="B"
        pieces={homePieces("B").map((p) => p.id)}
        movable={movable}
        cx={500} cy={235}
        goal={goalCount("B")}
        isTurn={state.turn === "B"}
        onPick={onPickPiece}
      />
      <HomeTray
        team="A"
        pieces={homePieces("A").map((p) => p.id)}
        movable={movable}
        cx={500} cy={765}
        goal={goalCount("A")}
        isTurn={state.turn === "A"}
        onPick={onPickPiece}
      />

      {/* 보드 위 말 묶음 — 두 팀이 같은 노드를 공유할 일은 없음(잡힘) */}
      {Array.from(groups.values()).map((g) => {
        const n = YUT_NODES[g.node];
        const isMovable = g.ids.some((id) => movable.has(id));
        return (
          <g
            key={`${g.team}-${g.node}`}
            onClick={() => { if (isMovable) onPickPiece(g.ids[0]); }}
            style={{ cursor: isMovable ? "pointer" : "default" }}
          >
            {isMovable && (
              <circle cx={n.x} cy={n.y} r={46} fill="none"
                stroke={TEAM_COLOR[g.team]} strokeWidth={6} strokeDasharray="10 7">
                <animateTransform attributeName="transform" type="rotate"
                  from={`0 ${n.x} ${n.y}`} to={`360 ${n.x} ${n.y}`} dur="6s" repeatCount="indefinite" />
              </circle>
            )}
            <image
              href={TEAM_IMG[g.team]}
              x={n.x - 38} y={n.y - 44} width={76} height={76}
              style={{ filter: `drop-shadow(0 4px 8px ${TEAM_COLOR[g.team]}88)` }}
            />
            {g.ids.length > 1 && (
              <g>
                <circle cx={n.x + 28} cy={n.y - 30} r={17} fill={TEAM_COLOR[g.team]} stroke="#fff" strokeWidth={3.5} />
                <text x={n.x + 28} y={n.y - 23} textAnchor="middle" fontSize={20} fontWeight={900} fill="#fff">
                  {g.ids.length}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function HomeTray({
  team, pieces, movable, cx, cy, goal, isTurn, onPick,
}: {
  team: TeamId;
  pieces: PieceId[];
  movable: Set<PieceId>;
  cx: number; cy: number;
  goal: number;
  isTurn: boolean;
  onPick: (id: PieceId) => void;
}) {
  const color = TEAM_COLOR[team];
  const W = 320, H = 120;
  return (
    <g>
      <rect x={cx - W / 2} y={cy - H / 2} width={W} height={H} rx={24}
        fill={isTurn ? `${color}22` : "#FFFFFFAA"}
        stroke={color} strokeWidth={isTurn ? 6 : 3.5}
        strokeDasharray={isTurn ? "none" : "12 8"} />
      <text x={cx - W / 2 + 18} y={cy - H / 2 + 32} fontSize={22} fontWeight={900} fill={color}>
        {team}팀
      </text>
      <text x={cx + W / 2 - 18} y={cy - H / 2 + 32} textAnchor="end" fontSize={20} fontWeight={900} fill="#92400E">
        🏁 {goal}/4
      </text>
      {pieces.map((id, i) => {
        const px = cx - W / 2 + 56 + i * 62;
        const py = cy + 16;
        const isMov = movable.has(id);
        return (
          <g key={id} onClick={() => { if (isMov) onPick(id); }}
            style={{ cursor: isMov ? "pointer" : "default" }}>
            {isMov && (
              <circle cx={px} cy={py} r={32} fill="none" stroke={color} strokeWidth={5} strokeDasharray="8 6">
                <animateTransform attributeName="transform" type="rotate"
                  from={`0 ${px} ${py}`} to={`360 ${px} ${py}`} dur="6s" repeatCount="indefinite" />
              </circle>
            )}
            <image href={TEAM_IMG[team]} x={px - 27} y={py - 30} width={54} height={54}
              opacity={isMov ? 1 : 0.75} />
          </g>
        );
      })}
    </g>
  );
}

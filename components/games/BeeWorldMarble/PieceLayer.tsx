"use client";

import { CSSProperties, useState } from "react";
import type { GameState, PlayerId } from "@/lib/marbleReducer";
import { PLAYER_COLOR } from "./Tile";
import { slotCenter } from "./Board";
import { useReduceMotion } from "./useReduceMotion";

/**
 * 말 레이어 — 보드 **위에 떠 있는 한 층**에 모든 말을 그린다 (U10 / 06 §2).
 *
 * 예전에는 말이 각 타일 컴포넌트 **안에** 그려졌다. 그래서
 *  - 칸이 바뀌면 말이 한 칸에서 사라지고 다음 칸에 나타났다. 칸 사이를 지나는
 *    움직임이 없어서, 아이가 "내 말이 여섯 칸을 갔다" 를 눈으로 따라갈 수 없었다.
 *  - 같은 칸에 여러 말이 서면 타일 구석의 좁은 자리에 겹쳐 쌓였다.
 *
 * 말을 보드 좌표계(퍼센트)로 올리면 위치가 CSS transition 으로 이어져 칸 사이를
 * 미끄러지고, 같은 칸의 말은 서로 비켜 앉힐 수 있다.
 *
 * 규칙은 건드리지 않는다 — 위치는 reducer 의 `player.pos` 를 그대로 읽는다.
 * 이 층은 06 §3 이 말하는 "render adapter → visual layer" 의 visual layer 다.
 */

export interface PieceLayerProps {
  state: GameState;
}

/**
 * 같은 칸에 선 말들을 서로 비켜 앉히는 자리(보드 폭 대비 %).
 *
 * 칸 하나가 보드의 약 10~13% 라 ±2.9% 면 말끼리 닿지 않으면서도 같은 칸 안에
 * 머문다. 넷까지는 2×2 로 앉고, 그 이상은 가운데로 겹치되 순서대로 살짝
 * 어긋나게 둔다(마블은 최대 4인이라 실제로는 2×2 로 끝난다).
 */
const SPREAD = 2.9;
function offsetFor(i: number, total: number): { dx: number; dy: number } {
  if (total <= 1) return { dx: 0, dy: 0 };
  /**
   * 둘일 때는 **좌우로만** 비킨다.
   *
   * 예전에는 둘도 2×2 자리표를 썼다. 그런데 둘이면 언제나 첫 줄(row 0)만 차서
   * dy 가 둘 다 -2.9 — 두 말이 나란히 **위로** 밀려 칸 위쪽 테두리를 넘어갔다.
   * 마블은 2인 대전이 가장 흔하므로 이게 평소 모습이었다. 좌우로만 비키면
   * 세로 중심은 칸 한가운데에 남는다.
   */
  if (total === 2) return { dx: (i === 0 ? -1 : 1) * SPREAD, dy: 0 };
  if (total <= 4) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    return { dx: (col === 0 ? -1 : 1) * SPREAD, dy: (row === 0 ? -1 : 1) * SPREAD };
  }
  const k = i - 4;
  return { dx: (k % 2 ? 1 : -1) * SPREAD * 0.6, dy: SPREAD * 1.6 };
}

export function PieceLayer({ state }: PieceLayerProps) {
  const reduceMotion = useReduceMotion();

  // 칸별로 누가 서 있는지 — 비켜 앉힐 순서를 정하려면 필요하다.
  const perTile = new Map<number, PlayerId[]>();
  for (const pid of state.playerIds) {
    const p = state.players[pid];
    if (!p || p.bankrupt) continue;
    const list = perTile.get(p.pos) ?? [];
    list.push(pid);
    perTile.set(p.pos, list);
  }

  const movingWho = state.phase.kind === "moving" ? state.phase.who : null;

  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}
    >
      {state.playerIds.map((pid) => {
        const p = state.players[pid];
        if (!p || p.bankrupt) return null;
        const here = perTile.get(p.pos) ?? [pid];
        const { dx, dy } = offsetFor(here.indexOf(pid), here.length);
        const c = slotCenter(p.pos);
        return (
          <Piece
            key={pid}
            id={pid}
            skin={p.skin}
            tile={p.pos}
            stack={here.length}
            left={c.left + dx}
            top={c.top + dy}
            moving={movingWho === pid}
            reduceMotion={reduceMotion}
          />
        );
      })}
    </div>
  );
}

function Piece({
  id, skin, tile, stack, left, top, moving, reduceMotion,
}: {
  id: PlayerId;
  skin?: string;
  /** 지금 선 칸 번호. 화면에는 안 쓰고 data-* 로만 나간다(검수용). */
  tile: number;
  /** 이 칸에 같이 선 말 수. 2 이상이면 겹친 말 상태다. */
  stack: number;
  left: number;
  top: number;
  moving: boolean;
  reduceMotion: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const color = PLAYER_COLOR[id];

  /**
   * 칸 사이를 미끄러지는 시간. 이동 틱은 칸당 90~200ms 라(06 §5 예산) 150ms 면
   * 다음 틱이 오기 전에 대체로 도착하면서도 뚝뚝 끊기지 않는다.
   * 움직임 줄이기에서는 전환 없이 도착 자리에 바로 놓는다.
   */
  const wrap: CSSProperties = {
    position: "absolute",
    left: `${left}%`,
    top: `${top}%`,
    transform: "translate(-50%, -50%)",
    transition: reduceMotion ? "none" : "left .15s linear, top .15s linear",
    width: "clamp(20px, 4.2vw, 34px)",
    height: "clamp(20px, 4.2vw, 34px)",
    display: "grid",
    placeItems: "center",
  };

  /* 말이 판에 닿아 있다는 느낌 — 발밑의 작은 접촉 그림자. 06 §2 "접촉 그림자". */
  const shadow: CSSProperties = {
    position: "absolute",
    left: "50%",
    bottom: "-14%",
    transform: "translateX(-50%)",
    width: "70%",
    height: "22%",
    borderRadius: "50%",
    background: "rgba(120,53,15,.30)",
    filter: "blur(1.5px)",
  };

  const body: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    background: skin && !failed ? "#fff" : color,
    border: `2.5px solid ${color}`,
    boxShadow: "0 2px 4px rgba(0,0,0,.28)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    // 이동 중인 말만 통통 튄다 — 지금 누가 가고 있는지 한눈에 보인다.
    animation: !reduceMotion && moving ? "marbleBeeHop 0.42s ease-in-out infinite" : undefined,
  };

  return (
    /* data-* 는 검수 스크립트가 '어느 말이 어느 칸에 몇 개로 서 있는지'를
       내부 state 를 훔쳐보지 않고 알아내는 유일한 길이다(06 §8 "실제 존재하는
       상태를 inventory 에서 확인"). 화면에는 아무 영향이 없다. */
    <span style={wrap} data-mb-piece={id} data-mb-tile={tile} data-mb-stack={stack}>
      <span aria-hidden="true" style={shadow} />
      <span style={body}>
        {skin && !failed ? (
          <img
            src={`/stickers/skin-${skin}.png`}
            alt=""
            aria-hidden="true"
            onError={() => setFailed(true)}
            style={{ width: "86%", height: "86%", objectFit: "contain" }}
          />
        ) : null}
      </span>
    </span>
  );
}

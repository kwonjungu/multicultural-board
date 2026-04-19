"use client";

import { CSSProperties, useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import type { PlayerId, PlayerState } from "@/lib/marbleReducer";
import { PLAYER_COLOR } from "./Tile";

export interface PlayerHudProps {
  players: Record<PlayerId, PlayerState>;
  playerIds: PlayerId[];
  turn: PlayerId;
  viewerLang: string;
  /** When true, stacks vertically for sidebar / desktop layout. */
  stacked?: boolean;
}

export function PlayerHud({
  players,
  playerIds,
  turn,
  stacked = false,
}: PlayerHudProps) {
  const wrap: CSSProperties = stacked
    ? {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
      }
    : {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        width: "100%",
      };

  return (
    <div style={wrap}>
      {playerIds.map((pid) => (
        <PlayerRow
          key={pid}
          player={players[pid]}
          active={pid === turn}
          stacked={stacked}
          count={playerIds.length}
        />
      ))}
    </div>
  );
}

function PlayerRow({
  player,
  active,
  stacked,
  count,
}: {
  player: PlayerState;
  active: boolean;
  stacked: boolean;
  count: number;
}) {
  const [imgFail, setImgFail] = useState(false);
  const color = PLAYER_COLOR[player.id];
  const lang = LANGUAGES[player.lang];

  // On horizontal mode: each player is an equal-flex row pill.
  const wrap: CSSProperties = {
    background: "#fff",
    border: `2px solid ${active ? color : "#E5E7EB"}`,
    borderRadius: 10,
    padding: "4px 8px",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    boxShadow: active ? `0 4px 10px ${color}44` : "none",
    opacity: player.bankrupt ? 0.45 : 1,
    position: "relative",
    minWidth: 0,
    flex: stacked ? "0 0 auto" : `1 1 calc(${100 / count}% - 6px)`,
    width: stacked ? "100%" : undefined,
    boxSizing: "border-box",
  };

  return (
    <div
      style={wrap}
      aria-label={`플레이어 ${player.name || player.id}${active ? " (내 차례)" : ""}`}
    >
      {active && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -7,
            right: -4,
            background: color,
            color: "#fff",
            borderRadius: 999,
            padding: "1px 6px",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: 0.5,
          }}
        >
          TURN
        </div>
      )}

      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: `${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${color}`,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {imgFail ? (
          <span style={{ fontSize: 16 }}>🐝</span>
        ) : (
          <img
            src={`/stickers/skin-${player.skin || "classic"}.png`}
            alt=""
            aria-hidden="true"
            onError={() => setImgFail(true)}
            style={{ width: "90%", height: "90%", objectFit: "contain" }}
          />
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          flex: 1,
          lineHeight: 1.15,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            color: "#1F2937",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {lang?.flag ?? "🏳️"} {player.name || player.id}
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color,
            display: "flex",
            gap: 6,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <span>💰{player.cash}</span>
          <span style={{ color: "#6B7280" }}>🏘️{player.owned.length}</span>
          {player.inJail > 0 && (
            <span style={{ color: "#6B7280" }}>🏝️{player.inJail}</span>
          )}
          {player.skipNext && (
            <span style={{ color: "#6B7280" }}>🛌</span>
          )}
        </div>
      </div>
    </div>
  );
}

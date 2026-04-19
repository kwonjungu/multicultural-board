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
}

export function PlayerHud({ players, playerIds, turn }: PlayerHudProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(4, playerIds.length)}, minmax(0, 1fr))`,
        gap: 6,
        width: "100%",
      }}
    >
      {playerIds.map((pid) => (
        <PlayerCard
          key={pid}
          player={players[pid]}
          active={pid === turn}
        />
      ))}
    </div>
  );
}

function PlayerCard({
  player,
  active,
}: {
  player: PlayerState;
  active: boolean;
}) {
  const [imgFail, setImgFail] = useState(false);
  const color = PLAYER_COLOR[player.id];
  const lang = LANGUAGES[player.lang];

  const wrap: CSSProperties = {
    background: "#fff",
    border: `3px solid ${active ? color : "#E5E7EB"}`,
    borderRadius: 12,
    padding: "6px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    boxShadow: active ? `0 6px 14px ${color}55` : "none",
    opacity: player.bankrupt ? 0.45 : 1,
    position: "relative",
    minWidth: 0,
  };

  return (
    <div style={wrap} aria-label={`플레이어 ${player.id}`}>
      {active && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -8,
            right: -6,
            background: color,
            color: "#fff",
            borderRadius: 999,
            padding: "1px 6px",
            fontSize: 10,
            fontWeight: 900,
          }}
        >
          TURN
        </div>
      )}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: `${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${color}`,
          overflow: "hidden",
        }}
      >
        {imgFail ? (
          <span aria-hidden="true" style={{ fontSize: 22 }}>🐝</span>
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
          fontSize: 12,
          fontWeight: 900,
          color: "#1F2937",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
      >
        {player.name || player.id}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#6B7280",
        }}
      >
        {lang?.flag ?? "🏳️"} {lang?.label ?? player.lang}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: color,
        }}
      >
        💰 {player.cash}
      </div>
      <div style={{ fontSize: 10, color: "#6B7280" }}>
        🏘️ {player.owned.length}
        {player.inJail > 0 ? ` · 🏝️${player.inJail}` : ""}
        {player.skipNext ? " · 🛌" : ""}
      </div>
    </div>
  );
}

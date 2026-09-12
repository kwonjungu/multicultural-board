"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import ScopedStyle from "../../ui/child/ScopedStyle";
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
  return (
    <div className="mb-hud" data-stacked={stacked ? "" : undefined}>
      <ScopedStyle css={HUD_CSS} />
      {playerIds.map((pid) => (
        <PlayerRow
          key={pid}
          player={players[pid]}
          active={pid === turn}
        />
      ))}
    </div>
  );
}

function PlayerRow({
  player,
  active,
}: {
  player: PlayerState;
  active: boolean;
}) {
  const [imgFail, setImgFail] = useState(false);
  const color = PLAYER_COLOR[player.id];
  const lang = LANGUAGES[player.lang];

  return (
    <div
      className="mb-hudrow"
      data-active={active ? "" : undefined}
      data-bankrupt={player.bankrupt ? "" : undefined}
      style={{ borderColor: active ? color : undefined }}
      aria-label={`플레이어 ${player.name || player.id}${active ? " (내 차례)" : ""}`}
    >
      {active && (
        <span data-ux-role="secondary" className="mb-hudturn" style={{ background: color }}>
          내 차례
        </span>
      )}

      <span className="mb-hudavatar" style={{ borderColor: color, background: `${color}22` }} aria-hidden="true">
        {imgFail ? (
          <span className="mb-hudbee">🐝</span>
        ) : (
          <img
            src={`/stickers/skin-${player.skin || "classic"}.png`}
            alt=""
            aria-hidden="true"
            onError={() => setImgFail(true)}
          />
        )}
      </span>

      <span className="mb-hudtext">
        <span data-ux-role="label" className="mb-hudname">
          {lang?.flag ?? "🏳️"} {player.name || player.id}
        </span>
        <span data-ux-role="secondary" className="mb-hudstats" style={{ color }}>
          <span>💰{player.cash}</span>
          <span className="mb-hudmuted">🏘️{player.owned.length}</span>
          {player.inJail > 0 && <span className="mb-hudmuted">🏝️{player.inJail}</span>}
          {player.skipNext && <span className="mb-hudmuted">🛌</span>}
        </span>
      </span>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const HUD_CSS = `
/* 좁은 화면에서 4명을 한 줄에 밀어 넣으면 이름이 잘린다 — 2열로 접는다. */
.mb-hud{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ux-space-2); width: 100%; }
@media (min-width: 700px){ .mb-hud{ grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.mb-hud[data-stacked]{ grid-template-columns: 1fr; }

.mb-hudrow{
  background: var(--ux-surface);
  border: 2px solid var(--ux-ink-soft);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2) var(--ux-space-3);
  display: flex; align-items: center; gap: var(--ux-space-2);
  position: relative; min-width: 0; box-sizing: border-box;
}
.mb-hudrow[data-active]{ border-width: 3px; }
.mb-hudrow[data-bankrupt]{ opacity: .45; }
.mb-hudturn{
  position: absolute; top: calc(-1 * var(--ux-space-3)); right: var(--ux-space-2);
  color: #fff; border-radius: var(--ux-radius-pill);
  padding: 0 var(--ux-space-2); font-weight: 900; white-space: nowrap;
}
.mb-hudavatar{
  width: 34px; height: 34px; border-radius: 50%;
  border: 2px solid currentColor; display: flex; align-items: center; justify-content: center;
  overflow: hidden; flex-shrink: 0;
}
.mb-hudavatar img{ width: 90%; height: 90%; object-fit: contain; }
.mb-hudbee{ font-size: var(--ux-font-label); line-height: 1; }
.mb-hudtext{ display: grid; gap: var(--ux-space-1); min-width: 0; flex: 1; }
.mb-hudname{ font-weight: 900; overflow-wrap: anywhere; }
.mb-hudstats{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; font-weight: 800; }
.mb-hudmuted{ color: var(--ux-ink-soft); }
`;

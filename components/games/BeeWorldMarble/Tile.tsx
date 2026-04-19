"use client";

import { CSSProperties, useState } from "react";
import { tr } from "@/lib/gameData";
import {
  COLOR_GROUP_BG,
  COUNTRY_LANDMARK_IMG,
  Tile as TileData,
} from "@/lib/marbleData";
import type { PlayerId } from "@/lib/marbleReducer";

export interface TileProps {
  tile: TileData;
  owners: PlayerId[];          // tile owners (usually 0 or 1)
  occupants: PlayerId[];       // players currently on this tile
  viewerLang: string;
  friendLang: string;
  highlight?: boolean;
  size: number;                // pixels
}

const TYPE_EMOJI: Record<string, string> = {
  start: "🏁",
  city: "🏙️",
  chance: "🃏",
  key: "🗝️",
  tax: "💸",
  festival: "🎉",
  jail: "🏝️",
  space: "🚀",
};

const TYPE_BG: Record<string, string> = {
  start: "#FEF3C7",
  chance: "#FDE68A",
  key: "#FDBA74",
  tax: "#FECACA",
  festival: "#FBCFE8",
  jail: "#D1D5DB",
  space: "#C7D2FE",
  city: "#FFFFFF",
};

const TILE_IMG: Record<string, string> = {
  start: "/marble/tiles/start.png",
  chance: "/marble/tiles/chance.png",
  key: "/marble/tiles/goldkey.png",
  tax: "/marble/tiles/tax.png",
  festival: "/marble/tiles/festival.png",
  jail: "/marble/tiles/island.png",
  space: "/marble/tiles/space.png",
};

const PLAYER_COLOR: Record<PlayerId, string> = {
  A: "#F59E0B",
  B: "#3B82F6",
  C: "#10B981",
  D: "#EF4444",
};

export function Tile({
  tile,
  owners,
  occupants,
  viewerLang,
  friendLang,
  highlight,
  size,
}: TileProps) {
  const [imgFail, setImgFail] = useState(false);

  const bg =
    tile.type === "city" && tile.color
      ? COLOR_GROUP_BG[tile.color]
      : TYPE_BG[tile.type] ?? "#FFFFFF";

  const ownerId = owners[0];
  const ownerColor = ownerId ? PLAYER_COLOR[ownerId] : undefined;

  const isCity = tile.type === "city";
  const landmarkImg =
    isCity && tile.country ? COUNTRY_LANDMARK_IMG[tile.country] : undefined;

  const primaryLabel = tile.landmark ? tr(tile.landmark, viewerLang) : "";
  const secondaryLabel =
    tile.landmark && friendLang !== viewerLang
      ? tr(tile.landmark, friendLang)
      : "";

  const style: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    aspectRatio: "1 / 1",
    background: bg,
    border: highlight ? "3px solid #F59E0B" : "1px solid #D1D5DB",
    borderRadius: 6,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 2,
    overflow: "hidden",
    boxShadow: highlight ? "0 0 10px rgba(245,158,11,0.6)" : undefined,
    boxSizing: "border-box",
    fontSize: Math.max(8, size * 0.14),
  };

  return (
    <div style={style} aria-label={`타일 ${tile.idx}`}>
      {/* Owner color bar (city) */}
      {isCity && ownerColor && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 4,
            background: ownerColor,
          }}
        />
      )}

      {/* Top: type icon */}
      <div
        aria-hidden="true"
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: Math.max(10, size * 0.28),
          lineHeight: 1,
          marginTop: 2,
        }}
      >
        {isCity ? (
          landmarkImg && !imgFail ? (
            <img
              src={landmarkImg}
              alt=""
              aria-hidden="true"
              onError={() => setImgFail(true)}
              style={{
                width: size * 0.5,
                height: size * 0.5,
                objectFit: "contain",
              }}
            />
          ) : (
            <span>{tile.country ? "🏙️" : "🏞️"}</span>
          )
        ) : (
          !imgFail && TILE_IMG[tile.type] ? (
            <img
              src={TILE_IMG[tile.type]}
              alt=""
              aria-hidden="true"
              onError={() => setImgFail(true)}
              style={{
                width: size * 0.55,
                height: size * 0.55,
                objectFit: "contain",
              }}
            />
          ) : (
            <span>{TYPE_EMOJI[tile.type]}</span>
          )
        )}
      </div>

      {/* Bottom: tile label */}
      <div
        style={{
          width: "100%",
          fontSize: Math.max(7, size * 0.11),
          fontWeight: 800,
          textAlign: "center",
          color: "#1F2937",
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          padding: "0 2px",
        }}
      >
        {isCity ? primaryLabel : labelForType(tile.type)}
      </div>
      {secondaryLabel && (
        <div
          style={{
            width: "100%",
            fontSize: Math.max(6, size * 0.09),
            textAlign: "center",
            color: "#6B7280",
            fontWeight: 700,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            padding: "0 2px",
          }}
        >
          {secondaryLabel}
        </div>
      )}

      {/* Occupants — small player dots bottom-right */}
      {occupants.length > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            maxWidth: "60%",
            justifyContent: "flex-end",
          }}
        >
          {occupants.map((p) => (
            <span
              key={p}
              style={{
                width: Math.max(8, size * 0.18),
                height: Math.max(8, size * 0.18),
                borderRadius: "50%",
                background: PLAYER_COLOR[p],
                border: "2px solid #fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function labelForType(t: string): string {
  switch (t) {
    case "start":    return "START";
    case "chance":   return "찬스";
    case "key":      return "황금열쇠";
    case "tax":      return "세금";
    case "festival": return "축제";
    case "jail":     return "무인도";
    case "space":    return "우주";
    default:         return "";
  }
}

// re-export for sibling files that want the player color palette
export { PLAYER_COLOR };

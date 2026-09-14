"use client";

import { CSSProperties, useState } from "react";
import { useGameText } from "@/lib/gameI18n";
import {
  COLOR_GROUP_BG,
  COUNTRY_LANDMARK_IMG,
  Tile as TileData,
} from "@/lib/marbleData";
import type { PlayerId } from "@/lib/marbleReducer";

export interface TileProps {
  tile: TileData;
  owners: PlayerId[];          // tile owners (usually 0 or 1)
  viewerLang: string;
  friendLang: string;
  highlight?: boolean;
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
  viewerLang,
  friendLang,
  highlight,
}: TileProps) {
  // Two-step fallback for city art: first try tile.image (city-specific),
  // then the generic country landmark, finally the emoji glyph.
  const [cityImgFail, setCityImgFail] = useState(false);
  const [imgFail, setImgFail] = useState(false);

  const bg =
    tile.type === "city" && tile.color
      ? COLOR_GROUP_BG[tile.color]
      : TYPE_BG[tile.type] ?? "#FFFFFF";

  const ownerId = owners[0];
  const ownerColor = ownerId ? PLAYER_COLOR[ownerId] : undefined;

  const isCity = tile.type === "city";
  const countryImg =
    isCity && tile.country ? COUNTRY_LANDMARK_IMG[tile.country] : undefined;
  // Prefer per-city art; fall back to per-country landmark on load failure.
  const cityImg = isCity && tile.image && !cityImgFail ? tile.image : undefined;
  const landmarkImg = cityImg ?? countryImg;

  // 설계서 항목 12: 미보유 언어는 영어 폴백 대신 ko→번역 캐시로 채운다
  const primaryText = useGameText(tile.landmark, viewerLang);
  const friendText = useGameText(tile.landmark, friendLang);
  const primaryLabel = tile.landmark ? primaryText : "";
  const secondaryLabel =
    tile.landmark && friendLang !== viewerLang && friendText !== primaryText
      ? friendText
      : "";

  /**
   * 칸은 판 위에 놓인 **낮은 블록**이다(06 §2 "작은 입체 랜드마크·높이 차").
   * 아래 모서리를 어둡게 한 띠가 두께로 읽히고, 상태에 따라 높이가 달라진다.
   *   기본 → 1px 두께
   *   내가 가진 칸 → 2px (조금 솟음)
   *   지금 도착한 칸 → 3px + 위로 이동 + 빛 (색만으로 알리지 않게 테두리도 함께)
   * 글씨는 판과 같은 평면에 그대로 둔다 — 기울이지 않는다.
   */
  const lift = highlight ? 3 : ownerColor ? 2 : 1;
  const style: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    background: bg,
    border: highlight ? "2.5px solid #F59E0B" : "1px solid #D1D5DB",
    borderRadius: 6,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4%",
    overflow: "hidden",
    boxShadow: [
      `0 ${lift}px 0 rgba(120,53,15,.28)`,
      `0 ${lift + 2}px ${lift + 3}px -1px rgba(120,53,15,.22)`,
      highlight ? "0 0 12px rgba(245,158,11,.65)" : "",
    ].filter(Boolean).join(", "),
    transform: highlight ? "translateY(-2px)" : undefined,
    transition: "transform .16s ease, box-shadow .16s ease",
    boxSizing: "border-box",
    fontSize: "clamp(9px, 1.4vw, 12px)",
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
            height: "10%",
            minHeight: 3,
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
          fontSize: "clamp(12px, 2.8vw, 22px)",
          lineHeight: 1,
          flex: "1 1 auto",
          minHeight: 0,
        }}
      >
        {isCity ? (
          landmarkImg && !imgFail ? (
            <img
              // Re-mount the <img> when swapping from city art to country
              // art so onError fires cleanly for the new source.
              key={landmarkImg}
              src={landmarkImg}
              alt=""
              aria-hidden="true"
              onError={() => {
                // Cascade: city-specific → country-landmark → emoji.
                if (cityImg && !cityImgFail) setCityImgFail(true);
                else setImgFail(true);
              }}
              style={{
                maxWidth: "70%",
                maxHeight: "70%",
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
                maxWidth: "80%",
                maxHeight: "80%",
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
          fontSize: "clamp(8px, 1.2vw, 11px)",
          fontWeight: 800,
          textAlign: "center",
          color: "#1F2937",
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          padding: "0 1px",
        }}
      >
        {isCity ? primaryLabel : labelForType(tile.type)}
      </div>
      {secondaryLabel && (
        <div
          style={{
            width: "100%",
            fontSize: "clamp(7px, 1vw, 10px)",
            textAlign: "center",
            color: "#6B7280",
            fontWeight: 700,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            padding: "0 1px",
          }}
        >
          {secondaryLabel}
        </div>
      )}

      {/* Occupants — 실제 벌 토큰(스킨 PNG). 로드 실패 시 색 점으로 폴백. */}
      {/* 말은 여기서 그리지 않는다 — 보드 위 PieceLayer 가 그린다.
          타일 안에 두면 칸 사이 이동이 보이지 않고 같은 칸에서 겹친다. */}
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

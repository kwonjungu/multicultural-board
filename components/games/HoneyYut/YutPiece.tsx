"use client";

import { useState } from "react";
import type { Piece } from "@/lib/yutTypes";

interface Props {
  piece: Piece;
  x: number;
  y: number;
  size: number;
  isMovable: boolean;
  onClick?: () => void;
}

// Team skins:
//   A = stage-4-bee.png (classic, gold/black body) — no "-classic" variant
//       exists in /public/stickers/skins, so we fall back to the base asset.
//   B = stage-4-bee-sky.png
const SKIN_A_PRIMARY = "/stickers/skins/stage-4-bee-classic.png"; // may 404 → onError fallback
const SKIN_A_FALLBACK = "/stickers/stage-4-bee.png";
const SKIN_B = "/stickers/skins/stage-4-bee-sky.png";

export function YutPiece({ piece, x, y, size, isMovable, onClick }: Props): JSX.Element {
  const [aBroken, setABroken] = useState(false);
  const skinA = aBroken ? SKIN_A_FALLBACK : SKIN_A_PRIMARY;
  const href = piece.team === "A" ? skinA : SKIN_B;

  const stackCount = piece.stackedWith.length;
  const showStack = stackCount > 0;

  return (
    <g
      transform={`translate(${x - size / 2}, ${y - size / 2})`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      {/* Pulsing halo when this piece is movable. */}
      {isMovable && (
        <circle
          cx={size / 2} cy={size / 2} r={size / 2 + 4}
          fill="none"
          stroke={piece.team === "A" ? "#F59E0B" : "#2563EB"}
          strokeWidth={4}
          strokeOpacity={0.85}
        >
          <animate
            attributeName="r"
            values={`${size / 2 + 2};${size / 2 + 10};${size / 2 + 2}`}
            dur="1.2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <image
        href={href}
        x={0} y={0}
        width={size} height={size}
        onError={() => {
          if (piece.team === "A" && !aBroken) setABroken(true);
        }}
      />
      {/* Stack badge */}
      {showStack && (
        <g>
          <circle cx={size - 6} cy={6} r={11} fill="#7C2D12" />
          <text
            x={size - 6}
            y={10}
            textAnchor="middle"
            fontSize={14}
            fontWeight={900}
            fill="#FFFBEB"
          >
            +{stackCount}
          </text>
        </g>
      )}
    </g>
  );
}

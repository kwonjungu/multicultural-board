"use client";

import { CSSProperties } from "react";
import { tr } from "@/lib/gameData";
import type { ChanceCard as ChanceCardData } from "@/lib/marbleData";

export interface ChanceCardProps {
  card: ChanceCardData;
  langA: string;
  langB: string;
  onDone: () => void;
}

export function ChanceCard({ card, langA, langB, onDone }: ChanceCardProps) {
  const titleA = tr(card.title, langA);
  const titleB = tr(card.title, langB);
  const bodyA = tr(card.body, langA);
  const bodyB = tr(card.body, langB);

  const wrap: CSSProperties = {
    background: "linear-gradient(160deg, #FEF3C7 0%, #FCD34D 100%)",
    border: "3px solid #F59E0B",
    borderRadius: 22,
    padding: 18,
    maxWidth: 380,
    width: "92%",
    textAlign: "center",
    boxShadow: "0 20px 40px rgba(245,158,11,0.45)",
  };

  return (
    <div style={wrap} role="dialog" aria-modal="true" aria-label="찬스 카드">
      <div style={{ fontSize: 52, marginBottom: 6 }} aria-hidden="true">🃏</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#78350F", marginBottom: 4 }}>
        {titleA}
      </div>
      {langA !== langB && (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 10 }}>
          {titleB}
        </div>
      )}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "10px 12px",
          fontSize: 14,
          fontWeight: 700,
          color: "#1F2937",
          margin: "10px 0",
          lineHeight: 1.45,
        }}
      >
        {bodyA}
        {langA !== langB && (
          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4, fontWeight: 600 }}>
            {bodyB}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="확인"
        onClick={onDone}
        style={{
          background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
          color: "#fff",
          border: "none",
          padding: "12px 28px",
          borderRadius: 999,
          fontWeight: 900,
          fontSize: 15,
          cursor: "pointer",
          boxShadow: "0 6px 14px rgba(245,158,11,0.45)",
        }}
      >
        ✅ 확인
      </button>
    </div>
  );
}

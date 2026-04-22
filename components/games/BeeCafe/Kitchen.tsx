"use client";

import { tr } from "@/lib/gameData";
import { INGREDIENTS, MENU_BY_ID } from "./cafeData";
import type { IngredientId, MenuId, Role } from "./types";

interface Props {
  langA: string;
  langB: string;
  roleA: Role;
  menuId: MenuId;
  picked: IngredientId[];
  onToggle: (id: IngredientId) => void;
  onNext: () => void;
}

// Chef's view: clickable palette of 20 ingredient chips. The picked set is
// toggled (no ordering constraint here — only correctness matters for the
// ingredient accuracy score).
export default function Kitchen({
  langA,
  langB,
  roleA,
  menuId,
  picked,
  onToggle,
  onNext,
}: Props) {
  const chefLang = roleA === "chef" ? langA : langB;
  const menu = MENU_BY_ID[menuId];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 14px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 800 }}>
          1/2 · 재료 고르기 / Pick ingredients
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>
          {menu.emoji} {tr(menu.name, chefLang)}
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
          선택됨 / Selected: <b>{picked.length}</b>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
          gap: 8,
        }}
      >
        {INGREDIENTS.map((ing) => {
          const on = picked.includes(ing.id);
          return (
            <button
              key={ing.id}
              onClick={() => onToggle(ing.id)}
              aria-label={`Toggle ingredient ${tr(ing.name, chefLang)}`}
              aria-pressed={on}
              style={{
                padding: "10px 4px",
                borderRadius: 14,
                border: on ? "2px solid #F59E0B" : "1px solid #E5E7EB",
                background: on ? "#FEF3C7" : "#fff",
                cursor: "pointer",
                transition: "transform 0.1s",
                boxShadow: on
                  ? "0 4px 10px rgba(245,158,11,0.25)"
                  : "0 2px 4px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ fontSize: 28 }}>{ing.emoji}</div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  marginTop: 2,
                  lineHeight: 1.2,
                  wordBreak: "keep-all",
                }}
              >
                {tr(ing.name, chefLang)}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ textAlign: "center", marginTop: 18 }}>
        <button
          onClick={onNext}
          disabled={picked.length === 0}
          aria-label="Proceed to cooking steps"
          style={{
            padding: "12px 26px",
            borderRadius: 14,
            border: "none",
            background:
              picked.length === 0
                ? "#E5E7EB"
                : "linear-gradient(180deg,#FBBF24,#F59E0B)",
            color: picked.length === 0 ? "#9CA3AF" : "#111",
            fontWeight: 900,
            cursor: picked.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          다음: 조리 순서 →
        </button>
      </div>
    </div>
  );
}

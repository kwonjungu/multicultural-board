"use client";

import { tr } from "@/lib/gameData";
import { MENU_BY_ID } from "./cafeData";
import type { MenuId, Role } from "./types";

interface Props {
  langA: string;
  langB: string;
  roleA: Role;
  roleB: Role;
  openCards: MenuId[];
  onPick: (id: MenuId) => void;
  completedCount: number;
}

// The customer chooses. The customer's language is whichever player holds
// role "customer"; we show menu cards in the *chef's* language (so the
// customer has to read across). This matches the planner note that the
// customer orders in "상대 언어" — but the pick happens here (their view).
function customerLang(roleA: Role, langA: string, langB: string): string {
  return roleA === "customer" ? langA : langB;
}

function chefLang(roleA: Role, langA: string, langB: string): string {
  return roleA === "chef" ? langA : langB;
}

export default function MenuDeck({
  langA,
  langB,
  roleA,
  roleB,
  openCards,
  onPick,
  completedCount,
}: Props) {
  const cLang = customerLang(roleA, langA, langB);
  const hLang = chefLang(roleA, langA, langB);
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 14px" }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 800 }}>
          라운드 {completedCount + 1} / 3 · Customer picks
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 900, margin: "4px 0 0" }}>
          🧑‍💼 {cLang.toUpperCase()} → 👨‍🍳 {hLang.toUpperCase()}
        </h3>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
          메뉴 3장 중 하나를 고르세요 / Pick 1 of 3
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {openCards.map((id) => {
          const menu = MENU_BY_ID[id];
          return (
            <button
              key={id}
              onClick={() => onPick(id)}
              aria-label={`Pick menu ${tr(menu.name, cLang)}`}
              style={{
                padding: "18px 12px",
                borderRadius: 18,
                border: "1px solid #E5E7EB",
                background: "#fff",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                textAlign: "center",
                transition: "transform 0.15s",
              }}
              onMouseDown={(e) =>
                (e.currentTarget.style.transform = "scale(0.97)")
              }
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{ fontSize: 54 }}>{menu.emoji}</div>
              <div style={{ fontWeight: 900, marginTop: 6 }}>
                {tr(menu.name, cLang)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#6B7280",
                  marginTop: 2,
                }}
              >
                {tr(menu.name, hLang)} · {menu.origin}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

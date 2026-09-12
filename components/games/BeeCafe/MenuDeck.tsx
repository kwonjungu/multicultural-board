"use client";

import { tr } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import ScopedStyle from "../../ui/child/ScopedStyle";
import { gt, UI } from "../uiText";
import { MENU_BY_ID } from "./cafeData";
import { CAFE, roleEmoji, roleName } from "./cafeText";
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
  void roleB; // 역할 쌍은 roleA 로 결정된다 (props 는 호출부 호환용).

  return (
    <div className="md-wrap">
      <ScopedStyle css={MD_CSS} />

      <section className="md-side" data-ux-surface="panel">
        <p data-ux-role="secondary" className="md-round">
          {gt(UI.round, langA)} {completedCount + 1} / 3
        </p>
        <h3 data-ux-role="body-emphasis" className="md-h">
          {roleEmoji("customer")} {gt(CAFE.customerPicks, langA)}
        </h3>
        <p data-ux-role="body" className="md-note">
          {gt(CAFE.pickOneOfThree, langA)}
        </p>
        <p data-ux-role="secondary" className="md-flow">
          {roleEmoji("customer")} {tr(roleName("customer"), cLang)} ({cLang.toUpperCase()})
          {" → "}
          {roleEmoji("chef")} {tr(roleName("chef"), hLang)} ({hLang.toUpperCase()})
        </p>
      </section>

      <div className="md-grid">
        {openCards.map((id) => {
          const menu = MENU_BY_ID[id];
          return (
            <button
              key={id}
              data-ux-role="control"
              className="md-card"
              onClick={() => onPick(id)}
              aria-label={tr(menu.name, cLang)}
            >
              <span className="md-emoji" aria-hidden="true">{menu.emoji}</span>
              <span data-ux-role="body-emphasis" className="md-name">
                <GameText map={menu.name} lang={cLang} />
              </span>
              <span data-ux-role="secondary" className="md-alt">
                <GameText map={menu.name} lang={hLang} /> · {menu.origin}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const MD_CSS = `
.md-wrap{ display: grid; gap: var(--ux-space-4); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1024px){
  .md-wrap{ grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); align-items: start; }
}
.md-side{
  display: grid; gap: var(--ux-space-2); align-content: start;
  padding: var(--ux-space-4); background: var(--ux-surface);
}
.md-round{ margin: 0; font-weight: 800; }
.md-h, .md-note, .md-flow{ margin: 0; word-break: keep-all; overflow-wrap: anywhere; }

.md-grid{ display: grid; gap: var(--ux-space-3); grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.md-card[data-ux-role="control"]{
  display: grid; justify-items: center; gap: var(--ux-space-1);
  padding: var(--ux-space-6) var(--ux-space-3);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-surface-sunk);
  border-radius: var(--ux-radius-panel);
  font-family: inherit; text-align: center;
  transition: border-color var(--ux-motion-state) var(--ux-motion-ease),
              background var(--ux-motion-state) var(--ux-motion-ease);
}
.md-card:hover, .md-card:focus-visible{ border-color: var(--ux-primary-border); }
.md-card:active{ background: var(--ux-hint-apricot); }
.md-emoji{ font-size: calc(var(--ux-font-title) * 2); line-height: 1; }
.md-name{ font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }
.md-alt{ word-break: keep-all; overflow-wrap: anywhere; }
`;

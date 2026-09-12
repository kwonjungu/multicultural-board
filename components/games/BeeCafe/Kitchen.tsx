"use client";

import { tr } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import ScopedStyle from "../../ui/child/ScopedStyle";
import { gp } from "../plainText";
import { gt } from "../uiText";
import { INGREDIENTS, INGR_BY_ID, MENU_BY_ID } from "./cafeData";
import { CAFE } from "./cafeText";
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
//
// 넓은 화면에서는 왼쪽에 '주문받은 메뉴 + 담은 재료', 오른쪽에 재료 격자를
// 두어 무엇을 만드는 중인지 보면서 고를 수 있게 한다.
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
  const empty = picked.length === 0;

  return (
    <div className="kt-wrap">
      <ScopedStyle css={KT_CSS} />

      <section className="kt-side" data-ux-surface="panel">
        <p data-ux-role="secondary" className="kt-step">{gt(CAFE.stepIngr, langA)}</p>

        <div className="kt-dish">
          <span className="kt-emoji" aria-hidden="true">{menu.emoji}</span>
          <span data-ux-role="body-emphasis" className="kt-dishname">
            <GameText map={menu.name} lang={chefLang} />
          </span>
        </div>

        <h3 data-ux-role="label" className="kt-h">
          🧺 {gt(CAFE.basket, langA)} · {picked.length}
        </h3>
        {empty ? (
          <p data-ux-role="secondary" className="kt-none">{gt(CAFE.basketEmpty, langA)}</p>
        ) : (
          <ul className="kt-chips">
            {picked.map((id) => (
              <li key={id} data-ux-role="secondary" className="kt-chip">
                {INGR_BY_ID[id].emoji} <GameText map={INGR_BY_ID[id].name} lang={chefLang} />
              </li>
            ))}
          </ul>
        )}

        {empty && (
          <p data-ux-role="body" className="kt-reason" role="status">
            {gt(CAFE.needIngredient, langA)}
          </p>
        )}
        <button
          data-ux-role="action"
          className="bc-primary kt-next"
          aria-disabled={empty}
          onClick={() => {
            if (empty) return; // 이유는 위 안내 문구로 보인다
            onNext();
          }}
        >
          {gp(CAFE.goSteps, langA)} →
        </button>
      </section>

      <div className="kt-grid">
        {INGREDIENTS.map((ing) => {
          const on = picked.includes(ing.id);
          return (
            <button
              key={ing.id}
              data-ux-role="control"
              className="kt-item"
              data-on={on ? "" : undefined}
              aria-pressed={on}
              aria-label={tr(ing.name, chefLang)}
              onClick={() => onToggle(ing.id)}
            >
              <span className="kt-itememoji" aria-hidden="true">{ing.emoji}</span>
              <span data-ux-role="label" className="kt-itemname">
                <GameText map={ing.name} lang={chefLang} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const KT_CSS = `
.kt-wrap{ display: grid; gap: var(--ux-space-4); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1024px){
  .kt-wrap{ grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); align-items: start; }
}
.kt-side{
  display: grid; gap: var(--ux-space-3); align-content: start;
  padding: var(--ux-space-4); background: var(--ux-surface);
}
.kt-step{ margin: 0; font-weight: 800; }
.kt-dish{ display: flex; align-items: center; gap: var(--ux-space-3); flex-wrap: wrap; }
.kt-emoji{ font-size: calc(var(--ux-font-title) * 1.6); line-height: 1; }
.kt-dishname{ font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }
.kt-h, .kt-none, .kt-reason{ margin: 0; word-break: keep-all; overflow-wrap: anywhere; }
.kt-chips{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); margin: 0; padding: 0; list-style: none; }
.kt-chip{
  padding: var(--ux-space-1) var(--ux-space-3);
  background: var(--ux-hint-mint); border-radius: var(--ux-radius-pill);
  color: var(--ux-ink); word-break: keep-all;
}
.kt-reason{
  padding: var(--ux-space-3); background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-surface);
}

.kt-grid{ display: grid; gap: var(--ux-space-2); grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
@media (min-width: 1024px){
  .kt-grid{ grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
}
.kt-item[data-ux-role="control"]{
  display: grid; justify-items: center; gap: var(--ux-space-1);
  padding: var(--ux-space-3) var(--ux-space-2);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-surface-sunk);
  border-radius: var(--ux-radius-surface);
  font-family: inherit; font-weight: 700; text-align: center;
  transition: border-color var(--ux-motion-state) var(--ux-motion-ease),
              background var(--ux-motion-state) var(--ux-motion-ease);
}
.kt-item[data-on]{ border-color: var(--ux-selected-border); background: var(--ux-hint-apricot); }
.kt-itememoji{ font-size: calc(var(--ux-font-title) * 1.2); line-height: 1; }
.kt-itemname{ word-break: keep-all; overflow-wrap: anywhere; }
.kt-next{ justify-self: stretch; }
`;

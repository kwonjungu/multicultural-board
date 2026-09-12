"use client";

import { GameText } from "@/lib/gameI18n";
import ScopedStyle from "../../ui/child/ScopedStyle";
import { gp } from "../plainText";
import { gt } from "../uiText";
import { INGR_BY_ID, MENU_BY_ID, STEP_BY_ID } from "./cafeData";
import { CAFE } from "./cafeText";
import type {
  IngredientId,
  MenuId,
  Role,
  ScoreResult,
  StepId,
} from "./types";

interface Props {
  langA: string;
  langB: string;
  roleA: Role;
  menuId: MenuId;
  picked: IngredientId[];
  stepOrder: StepId[];
  score: ScoreResult;
  isLast: boolean;
  onNext: () => void;
  onReset: () => void;
}

export default function ServeResult({
  langA,
  langB,
  roleA,
  menuId,
  picked,
  stepOrder,
  score,
  isLast,
  onNext,
  onReset,
}: Props) {
  const chefLang = roleA === "chef" ? langA : langB;
  const custLang = roleA === "customer" ? langA : langB;
  const menu = MENU_BY_ID[menuId];

  const answerIngr = new Set<IngredientId>(menu.ingredients);
  const answerSteps = menu.steps;

  // 틀린 곳을 경고하지 않는다 — 별 개수에 맞춰 차분하게 다음 행동만 말한다.
  const feedback =
    score.stars === 3
      ? gt(CAFE.perfect, langA)
      : score.stars === 2
        ? gt(CAFE.nice, langA)
        : gt(CAFE.tryAgain, langA);

  return (
    <div className="sr-wrap">
      <ScopedStyle css={SR_CSS} />

      <section className="sr-card" data-ux-surface="panel">
        <span className="sr-emoji" aria-hidden="true">{menu.emoji}</span>
        <p data-ux-role="title" className="sr-name">
          <GameText map={menu.name} lang={chefLang} />
        </p>
        <p data-ux-role="secondary" className="sr-alt">
          <GameText map={menu.name} lang={custLang} />
        </p>

        <p className="sr-stars" role="status">
          <span className="sr-starson" aria-hidden="true">{"⭐".repeat(score.stars)}</span>
          <span className="sr-starsoff" aria-hidden="true">{"⭐".repeat(3 - score.stars)}</span>
          <span className="sr-sronly">{score.stars} / 3</span>
        </p>
        <p data-ux-role="body-emphasis" className="sr-feedback">{feedback}</p>
        <p data-ux-role="secondary" className="sr-detail">{score.detail}</p>

        <div className="sr-btns">
          <button data-ux-role="control" className="bc-secondary" onClick={onReset}>
            🏠 {gp(CAFE.home, langA)}
          </button>
          <button data-ux-role="action" className="bc-primary sr-next" onClick={onNext}>
            {isLast ? `🏁 ${gp(CAFE.seeResult, langA)}` : `➡ ${gp(CAFE.nextMenu, langA)}`}
          </button>
        </div>
      </section>

      <div className="sr-compare">
        <section className="sr-panel" data-ux-surface="panel">
          <h3 data-ux-role="label" className="sr-h">🧺 {gt(CAFE.ingrCompare, langA)}</h3>
          <ul className="sr-chips">
            {menu.ingredients.map((id) => {
              const got = picked.includes(id);
              const ing = INGR_BY_ID[id];
              return (
                <li
                  key={`ans-${id}`}
                  data-ux-role="label"
                  className="sr-chip"
                  data-tone={got ? "ok" : "miss"}
                >
                  {ing.emoji} <GameText map={ing.name} lang={chefLang} /> {got ? "✓" : "·"}
                </li>
              );
            })}
            {picked
              .filter((id) => !answerIngr.has(id))
              .map((id) => {
                const ing = INGR_BY_ID[id];
                return (
                  <li
                    key={`extra-${id}`}
                    data-ux-role="label"
                    className="sr-chip"
                    data-tone="extra"
                  >
                    {ing.emoji} <GameText map={ing.name} lang={chefLang} /> +
                  </li>
                );
              })}
          </ul>
        </section>

        <section className="sr-panel" data-ux-surface="panel">
          <h3 data-ux-role="label" className="sr-h">✅ {gt(CAFE.correctOrder, langA)}</h3>
          <ul className="sr-chips">
            {answerSteps.map((id, i) => {
              const s = STEP_BY_ID[id];
              return (
                <li key={`ans-step-${i}`} data-ux-role="label" className="sr-chip" data-tone="answer">
                  {i + 1}. {s.emoji} <GameText map={s.name} lang={chefLang} />
                </li>
              );
            })}
          </ul>

          <h3 data-ux-role="label" className="sr-h">📋 {gt(CAFE.myOrder, langA)}</h3>
          <ul className="sr-chips">
            {stepOrder.map((id, i) => {
              const s = STEP_BY_ID[id];
              const same = answerSteps[i] === id;
              return (
                <li
                  key={`mine-${i}`}
                  data-ux-role="label"
                  className="sr-chip"
                  data-tone={same ? "ok" : "miss"}
                >
                  {i + 1}. {s.emoji} <GameText map={s.name} lang={chefLang} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const SR_CSS = `
.sr-wrap{ display: grid; gap: var(--ux-space-4); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1024px){
  .sr-wrap{ grid-template-columns: minmax(300px, 400px) minmax(0, 1fr); align-items: start; }
}
.sr-card{
  display: grid; justify-items: center; gap: var(--ux-space-2);
  padding: var(--ux-space-6) var(--ux-space-4);
  background: var(--ux-surface); text-align: center;
}
.sr-emoji{ font-size: calc(var(--ux-font-title) * 2.2); line-height: 1; }
.sr-name, .sr-alt, .sr-feedback, .sr-detail, .sr-stars{ margin: 0; word-break: keep-all; overflow-wrap: anywhere; }
.sr-name{ font-weight: 900; }
.sr-stars{ font-size: calc(var(--ux-font-title) * 1.4); line-height: 1.1; }
.sr-starsoff{ opacity: .25; }
.sr-sronly{
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}
.sr-btns{
  display: grid; gap: var(--ux-space-2); width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin-top: var(--ux-space-2);
}

.sr-compare{ display: grid; gap: var(--ux-space-3); align-content: start; }
@media (min-width: 1280px){
  .sr-compare{ grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
}
.sr-panel{
  display: grid; gap: var(--ux-space-2); align-content: start;
  padding: var(--ux-space-4); background: var(--ux-surface);
}
.sr-h{ margin: 0; color: var(--ux-ink-soft); }
.sr-chips{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); margin: 0; padding: 0; list-style: none; }
.sr-chip{
  padding: var(--ux-space-1) var(--ux-space-3);
  border-radius: var(--ux-radius-pill);
  background: var(--ux-surface-sunk); color: var(--ux-ink);
  font-weight: 700; word-break: keep-all; overflow-wrap: anywhere;
}
.sr-chip[data-tone="ok"]{ background: color-mix(in srgb, var(--ux-success) 18%, var(--ux-surface)); }
.sr-chip[data-tone="miss"]{ background: var(--ux-surface-sunk); }
.sr-chip[data-tone="extra"]{ background: var(--ux-hint-apricot); }
.sr-chip[data-tone="answer"]{ background: var(--ux-hint-mint); }
`;

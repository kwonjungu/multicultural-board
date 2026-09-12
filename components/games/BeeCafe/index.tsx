"use client";

import { useEffect, useReducer } from "react";
import ScopedStyle from "../../ui/child/ScopedStyle";
import { gp } from "../plainText";
import { gt, UI } from "../uiText";
import Kitchen from "./Kitchen";
import MenuDeck from "./MenuDeck";
import OrderScene from "./OrderScene";
import RoleSelect from "./RoleSelect";
import ServeResult from "./ServeResult";
import StepSequencer from "./StepSequencer";
import { CAFE } from "./cafeText";
import { INITIAL_STATE, reducer } from "./cafeLogic";
import type { Difficulty } from "./types";

interface Props {
  langA: string;
  langB: string;
}

// BeeCafe — cooperative cooking game: 2 players take customer/chef roles,
// play 3 rounds of {pick menu → order TTS → pick ingredients → arrange
// steps → serve}. See planner spec for scoring rules (cafeLogic.scoreRecipe).
//
// 화면 구조: 이 파일만 `data-ux-root` 를 단다 (하위 화면은 절대 달지 않는다).
// 하위 컴포넌트는 셸 안에서 교체되는 '내용' 이고, 헤더/폭/배경은 여기 것이다.
export default function BeeCafe({ langA, langB }: Props) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Timer tick while cooking. Auto-serves when timer hits 0 in timed modes.
  // cleanup 이 unmount·phase 전환 모두에서 인터벌을 지운다 (유령 타이머 0개).
  useEffect(() => {
    if (state.phase !== "cook-ingr" && state.phase !== "cook-steps") return;
    const id = window.setInterval(() => {
      dispatch({ type: "TICK" });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  useEffect(() => {
    if (
      !state.unlimited &&
      state.timer === 0 &&
      (state.phase === "cook-ingr" || state.phase === "cook-steps") &&
      state.chosenMenu
    ) {
      dispatch({ type: "SERVE" });
    }
  }, [state.timer, state.phase, state.unlimited, state.chosenMenu]);

  const cooking = state.phase === "cook-ingr" || state.phase === "cook-steps";
  const timerLevel =
    state.timer <= 10 ? "low" : state.timer <= 25 ? "mid" : "ok";

  const header =
    state.phase === "role" ? null : (
      <div className="bc-header">
        <span data-ux-role="label" className="bc-brand">
          ☕️ BeeCafe · {gp(UI.round, langA)} {Math.min(3, state.completedCount + 1)}/3
        </span>
        <span className="bc-headright">
          {!state.unlimited && cooking && (
            <span
              data-ux-role="label"
              className="bc-timer"
              data-level={timerLevel}
              role="status"
            >
              ⏱ {state.timer}s
            </span>
          )}
          <span data-ux-role="label" className="bc-stars">
            ⭐ {gp(CAFE.starsLabel, langA)} {state.totalStars}
          </span>
        </span>
      </div>
    );

  // Phase switch ----------------------------------------------------------
  let body = <div />;

  if (state.phase === "role") {
    body = (
      <RoleSelect
        langA={langA}
        langB={langB}
        roleA={state.roleA}
        roleB={state.roleB}
        difficulty={state.difficulty}
        onSwap={() => dispatch({ type: "SWAP_ROLE" })}
        onDifficulty={(d: Difficulty) =>
          dispatch({ type: "SET_DIFFICULTY", diff: d })
        }
        onStart={() => dispatch({ type: "DEAL" })}
      />
    );
  } else if (state.phase === "menu") {
    body = (
      <MenuDeck
        langA={langA}
        langB={langB}
        roleA={state.roleA}
        roleB={state.roleB}
        openCards={state.openCards}
        completedCount={state.completedCount}
        onPick={(id) => dispatch({ type: "PICK_MENU", id })}
      />
    );
  } else if (state.phase === "order" && state.chosenMenu) {
    // Entering "order" → when chef is ready, we go to cook-ingr. The timer
    // only starts in cook phases (see TICK guard in reducer).
    body = (
      <OrderScene
        langA={langA}
        langB={langB}
        roleA={state.roleA}
        menuId={state.chosenMenu}
        onReady={() => dispatch({ type: "BEGIN_COOK" })}
      />
    );
  } else if (state.phase === "cook-ingr" && state.chosenMenu) {
    body = (
      <Kitchen
        langA={langA}
        langB={langB}
        roleA={state.roleA}
        menuId={state.chosenMenu}
        picked={state.pickedIngredients}
        onToggle={(id) => dispatch({ type: "TOGGLE_INGR", id })}
        onNext={() => dispatch({ type: "GOTO_STEPS" })}
      />
    );
  } else if (state.phase === "cook-steps" && state.chosenMenu) {
    body = (
      <StepSequencer
        langA={langA}
        langB={langB}
        roleA={state.roleA}
        menuId={state.chosenMenu}
        stepOrder={state.stepOrder}
        onAdd={(id) => dispatch({ type: "ADD_STEP", id })}
        onRemove={(idx) => dispatch({ type: "REMOVE_STEP", idx })}
        onReorder={(from, to) => dispatch({ type: "REORDER_STEP", from, to })}
        onServe={() => dispatch({ type: "SERVE" })}
      />
    );
  } else if (state.phase === "result" && state.chosenMenu && state.lastScore) {
    body = (
      <ServeResult
        langA={langA}
        langB={langB}
        roleA={state.roleA}
        menuId={state.chosenMenu}
        picked={state.pickedIngredients}
        stepOrder={state.stepOrder}
        score={state.lastScore}
        isLast={state.completedCount >= 2}
        onNext={() => dispatch({ type: "NEXT" })}
        onReset={() => dispatch({ type: "RESET" })}
      />
    );
  } else if (state.phase === "done") {
    body = (
      <div className="bc-done" data-ux-surface="panel">
        <div className="bc-done-emoji" aria-hidden="true">🏆</div>
        <h2 data-ux-role="title" className="bc-done-title">
          {gt(UI.allDone, langA)}
        </h2>
        <p data-ux-role="body-emphasis" className="bc-done-score">
          ⭐ {state.totalStars} / 9
        </p>
        <p data-ux-role="body" className="bc-done-note">
          {gt(CAFE.coursesDone, langA)}
        </p>
        <button
          data-ux-role="action"
          className="bc-primary"
          onClick={() => dispatch({ type: "RESET" })}
        >
          🔁 {gp(UI.playAgain, langA)}
        </button>
      </div>
    );
  }

  return (
    <div data-ux-root className="bc-root">
      <ScopedStyle css={BC_CSS} />
      <div className="bc-shell">
        {header}
        {body}
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const BC_CSS = `
.bc-root{ color: var(--ux-ink); background: var(--ux-bg); }
.bc-shell{
  width: 100%; max-width: 1180px; margin: 0 auto;
  padding: var(--ux-space-3) var(--ux-space-4) var(--ux-space-8);
  display: grid; gap: var(--ux-space-4); align-content: start;
}
.bc-header{
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--ux-space-3);
  justify-content: space-between;
  padding: var(--ux-space-2) var(--ux-space-3);
  background: var(--ux-surface); border-radius: var(--ux-radius-panel);
}
.bc-brand{ font-weight: 800; }
.bc-headright{ display: flex; align-items: center; gap: var(--ux-space-3); flex-wrap: wrap; }
.bc-timer{
  font-weight: 800; padding: var(--ux-space-1) var(--ux-space-3);
  border-radius: var(--ux-radius-pill); background: var(--ux-hint-mint);
  border: 2px solid transparent;
}
.bc-timer[data-level="mid"]{ background: var(--ux-hint-apricot); }
.bc-timer[data-level="low"]{ background: var(--ux-hint-apricot); border-color: var(--ux-primary-border); }
.bc-stars{ color: var(--ux-ink-soft); font-weight: 800; }

.bc-done{
  display: grid; justify-items: center; gap: var(--ux-space-3);
  padding: var(--ux-space-8) var(--ux-space-4);
  text-align: center; background: var(--ux-surface);
}
.bc-done-emoji{ font-size: calc(var(--ux-font-title) * 2.4); line-height: 1; }
.bc-done-title, .bc-done-score, .bc-done-note{ margin: 0; }
.bc-done-score{ font-weight: 900; }
.bc-done-note{ color: var(--ux-ink-soft); word-break: keep-all; overflow-wrap: anywhere; }

/* 게임 전역에서 쓰는 주 행동 버튼 (하위 화면도 같은 클래스를 쓴다). */
.bc-primary[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 900;
  word-break: keep-all; overflow-wrap: anywhere;
}
.bc-primary[aria-disabled="true"]{
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  border-color: var(--ux-surface-sunk);
}
.bc-secondary[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800;
  word-break: keep-all; overflow-wrap: anywhere;
}
`;

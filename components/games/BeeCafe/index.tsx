"use client";

import { useEffect, useReducer } from "react";
import Kitchen from "./Kitchen";
import MenuDeck from "./MenuDeck";
import OrderScene from "./OrderScene";
import RoleSelect from "./RoleSelect";
import ServeResult from "./ServeResult";
import StepSequencer from "./StepSequencer";
import { INITIAL_STATE, reducer } from "./cafeLogic";
import type { Difficulty } from "./types";

interface Props {
  langA: string;
  langB: string;
}

// BeeCafe — cooperative cooking game: 2 players take customer/chef roles,
// play 3 rounds of {pick menu → order TTS → pick ingredients → arrange
// steps → serve}. See planner spec for scoring rules (cafeLogic.scoreRecipe).
export default function BeeCafe({ langA, langB }: Props) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Timer tick while cooking. Auto-serves when timer hits 0 in timed modes.
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

  // Header shared across phases ------------------------------------------
  const header = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: 720,
        margin: "0 auto",
        padding: "10px 14px 0",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 800 }}>
        ☕️ BeeCafe · {state.completedCount}/3
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {!state.unlimited &&
          (state.phase === "cook-ingr" || state.phase === "cook-steps") && (
            <div
              style={{
                padding: "4px 10px",
                borderRadius: 10,
                background:
                  state.timer <= 10
                    ? "#FEE2E2"
                    : state.timer <= 25
                      ? "#FEF3C7"
                      : "#D1FAE5",
                fontWeight: 900,
              }}
            >
              ⏱ {state.timer}s
            </div>
          )}
        <div style={{ color: "#6B7280" }}>⭐ {state.totalStars}</div>
      </div>
    </div>
  );

  // Phase switch ----------------------------------------------------------
  if (state.phase === "role") {
    return (
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
  }

  if (state.phase === "menu") {
    return (
      <>
        {header}
        <MenuDeck
          langA={langA}
          langB={langB}
          roleA={state.roleA}
          roleB={state.roleB}
          openCards={state.openCards}
          completedCount={state.completedCount}
          onPick={(id) => dispatch({ type: "PICK_MENU", id })}
        />
      </>
    );
  }

  if (state.phase === "order" && state.chosenMenu) {
    // Entering "order" → when chef is ready, we go to cook-ingr. The timer
    // only starts in cook phases (see TICK guard in reducer).
    return (
      <>
        {header}
        <OrderScene
          langA={langA}
          langB={langB}
          roleA={state.roleA}
          menuId={state.chosenMenu}
          onReady={() => dispatch({ type: "BEGIN_COOK" })}
        />
      </>
    );
  }

  if (state.phase === "cook-ingr" && state.chosenMenu) {
    return (
      <>
        {header}
        <Kitchen
          langA={langA}
          langB={langB}
          roleA={state.roleA}
          menuId={state.chosenMenu}
          picked={state.pickedIngredients}
          onToggle={(id) => dispatch({ type: "TOGGLE_INGR", id })}
          onNext={() => dispatch({ type: "GOTO_STEPS" })}
        />
      </>
    );
  }

  if (state.phase === "cook-steps" && state.chosenMenu) {
    return (
      <>
        {header}
        <StepSequencer
          langA={langA}
          langB={langB}
          roleA={state.roleA}
          menuId={state.chosenMenu}
          stepOrder={state.stepOrder}
          onAdd={(id) => dispatch({ type: "ADD_STEP", id })}
          onRemove={(idx) => dispatch({ type: "REMOVE_STEP", idx })}
          onReorder={(from, to) =>
            dispatch({ type: "REORDER_STEP", from, to })
          }
          onServe={() => dispatch({ type: "SERVE" })}
        />
      </>
    );
  }

  if (state.phase === "result" && state.chosenMenu && state.lastScore) {
    return (
      <>
        {header}
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
      </>
    );
  }

  if (state.phase === "done") {
    return (
      <div
        style={{
          textAlign: "center",
          padding: 40,
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: 64 }}>🏆</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: "8px 0" }}>
          All done! / 모두 완성!
        </h2>
        <div style={{ fontSize: 32, fontWeight: 900, margin: "12px 0" }}>
          ⭐ {state.totalStars} / 9
        </div>
        <div style={{ color: "#6B7280", fontSize: 13 }}>
          3 courses served · 3 코스 완료
        </div>
        <button
          onClick={() => dispatch({ type: "RESET" })}
          aria-label="Play again"
          style={{
            marginTop: 22,
            padding: "12px 24px",
            borderRadius: 14,
            border: "none",
            background: "linear-gradient(180deg,#FBBF24,#F59E0B)",
            color: "#111",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          🔁 다시 하기
        </button>
      </div>
    );
  }

  return <div />;
}

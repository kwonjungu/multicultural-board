// BeeCafe — pure logic: scoring + reducer.

import { MENU_BY_ID, MENUS, shuffled } from "./cafeData";
import type {
  Action,
  GameState,
  IngredientId,
  MenuId,
  ScoreResult,
  StepId,
} from "./types";

// ---- LCS length between two ordered arrays (dynamic programming) ---------
export function lcsLength<T>(a: readonly T[], b: readonly T[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return 0;
  const row: number[] = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    let prevDiag = 0;
    for (let j = 1; j <= m; j++) {
      const temp = row[j];
      if (a[i - 1] === b[j - 1]) {
        row[j] = prevDiag + 1;
      } else {
        row[j] = Math.max(row[j], row[j - 1]);
      }
      prevDiag = temp;
    }
  }
  return row[m];
}

// ---- scoreRecipe (pure) --------------------------------------------------
// ingrAcc = (|sel ∩ ans| - 0.1 × |sel \ ans|) / |ans|      (clamped ≥ 0)
// stepAcc = LCS(ans, sel) / |ans|
// speedBonus = elapsed<45 → 1, <75 → 0.5, else 0
// total = 0.5·ingrAcc + 0.4·stepAcc + 0.1·speedBonus
// stars: ≥0.85 → 3, ≥0.6 → 2, else 1
export function scoreRecipe(args: {
  menuId: MenuId;
  pickedIngredients: readonly IngredientId[];
  stepOrder: readonly StepId[];
  elapsedSec: number;
}): ScoreResult {
  const menu = MENU_BY_ID[args.menuId];
  const answerIngr = new Set<IngredientId>(menu.ingredients);
  const selIngr = new Set<IngredientId>(args.pickedIngredients);

  let correct = 0;
  selIngr.forEach((id) => {
    if (answerIngr.has(id)) correct++;
  });
  const wrong = selIngr.size - correct;
  const ingrAccRaw = (correct - 0.1 * wrong) / Math.max(1, answerIngr.size);
  const ingrAcc = Math.max(0, Math.min(1, ingrAccRaw));

  const lcs = lcsLength(menu.steps, args.stepOrder);
  const stepAcc = Math.max(
    0,
    Math.min(1, lcs / Math.max(1, menu.steps.length)),
  );

  const speedBonus = args.elapsedSec < 45 ? 1 : args.elapsedSec < 75 ? 0.5 : 0;

  const total = 0.5 * ingrAcc + 0.4 * stepAcc + 0.1 * speedBonus;
  const stars: 1 | 2 | 3 = total >= 0.85 ? 3 : total >= 0.6 ? 2 : 1;

  const detail =
    `재료 ${correct}/${answerIngr.size}` +
    (wrong > 0 ? ` (오답 ${wrong})` : "") +
    ` · 순서 ${lcs}/${menu.steps.length}` +
    ` · ${args.elapsedSec}s`;

  return { stars, detail, ingrAcc, stepAcc, speedBonus, total };
}

// ---- initial state + difficulty presets ---------------------------------
export function initialTimerFor(
  difficulty: GameState["difficulty"],
): { timer: number; unlimited: boolean } {
  if (difficulty === "easy") return { timer: 0, unlimited: true };
  if (difficulty === "hard") return { timer: 45, unlimited: false };
  return { timer: 75, unlimited: false };
}

export const INITIAL_STATE: GameState = {
  phase: "role",
  roleA: "customer",
  roleB: "chef",
  difficulty: "normal",
  deck: [],
  openCards: [],
  chosenMenu: null,
  pickedIngredients: [],
  stepOrder: [],
  completedCount: 0,
  timer: 0,
  unlimited: false,
  elapsedForRound: 0,
  totalStars: 0,
};

function dealFresh(
  difficulty: GameState["difficulty"],
): {
  deck: MenuId[];
  openCards: MenuId[];
  timer: number;
  unlimited: boolean;
} {
  const ids = MENUS.map((m) => m.id);
  const deck = shuffled(ids);
  const openCards = deck.slice(0, 3);
  const rest = deck.slice(3);
  const { timer, unlimited } = initialTimerFor(difficulty);
  return { deck: rest, openCards, timer, unlimited };
}

// ---- reducer -------------------------------------------------------------
export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "DEAL": {
      const { deck, openCards, timer, unlimited } = dealFresh(state.difficulty);
      return {
        ...state,
        phase: "menu",
        deck,
        openCards,
        chosenMenu: null,
        pickedIngredients: [],
        stepOrder: [],
        timer,
        unlimited,
        elapsedForRound: 0,
        lastScore: undefined,
      };
    }

    case "PICK_MENU": {
      if (!state.openCards.includes(action.id)) return state;
      return {
        ...state,
        phase: "order",
        chosenMenu: action.id,
      };
    }

    case "SWAP_ROLE": {
      return {
        ...state,
        roleA: state.roleA === "customer" ? "chef" : "customer",
        roleB: state.roleB === "customer" ? "chef" : "customer",
      };
    }

    case "SET_DIFFICULTY": {
      return { ...state, difficulty: action.diff };
    }

    case "BEGIN_COOK": {
      if (state.phase !== "order") return state;
      return { ...state, phase: "cook-ingr" };
    }

    case "TOGGLE_INGR": {
      if (state.phase !== "cook-ingr") return state;
      const has = state.pickedIngredients.includes(action.id);
      const next = has
        ? state.pickedIngredients.filter((i) => i !== action.id)
        : [...state.pickedIngredients, action.id];
      return { ...state, pickedIngredients: next };
    }

    case "GOTO_STEPS": {
      if (state.phase !== "order" && state.phase !== "cook-ingr") return state;
      return { ...state, phase: "cook-steps" };
    }

    case "ADD_STEP": {
      if (state.phase !== "cook-steps") return state;
      if (state.stepOrder.length >= 8) return state;
      return { ...state, stepOrder: [...state.stepOrder, action.id] };
    }

    case "REMOVE_STEP": {
      if (state.phase !== "cook-steps") return state;
      const next = state.stepOrder.slice();
      if (action.idx < 0 || action.idx >= next.length) return state;
      next.splice(action.idx, 1);
      return { ...state, stepOrder: next };
    }

    case "REORDER_STEP": {
      if (state.phase !== "cook-steps") return state;
      const { from, to } = action;
      if (from === to) return state;
      const next = state.stepOrder.slice();
      if (from < 0 || from >= next.length) return state;
      const clampedTo = Math.max(0, Math.min(next.length - 1, to));
      const [moved] = next.splice(from, 1);
      next.splice(clampedTo, 0, moved);
      return { ...state, stepOrder: next };
    }

    case "SERVE": {
      if (!state.chosenMenu) return state;
      const presetTimer = initialTimerFor(state.difficulty).timer;
      const elapsed = state.unlimited
        ? state.elapsedForRound
        : Math.max(0, presetTimer - state.timer);
      const score = scoreRecipe({
        menuId: state.chosenMenu,
        pickedIngredients: state.pickedIngredients,
        stepOrder: state.stepOrder,
        elapsedSec: elapsed,
      });
      return {
        ...state,
        phase: "result",
        lastScore: score,
        totalStars: state.totalStars + score.stars,
      };
    }

    case "NEXT": {
      const nextCount = state.completedCount + 1;
      if (nextCount >= 3) {
        return { ...state, phase: "done", completedCount: nextCount };
      }
      const { deck, openCards, timer, unlimited } = dealFresh(state.difficulty);
      return {
        ...state,
        phase: "menu",
        completedCount: nextCount,
        deck,
        openCards,
        chosenMenu: null,
        pickedIngredients: [],
        stepOrder: [],
        lastScore: undefined,
        timer,
        unlimited,
        elapsedForRound: 0,
      };
    }

    case "TICK": {
      // Only meaningful during cook phases.
      if (state.phase !== "cook-ingr" && state.phase !== "cook-steps") {
        return state;
      }
      if (state.unlimited) {
        return { ...state, elapsedForRound: state.elapsedForRound + 1 };
      }
      if (state.timer <= 1) {
        // Auto-serve if timer drains. We keep it in same phase but set timer=0;
        // the main component will notice and dispatch SERVE.
        return { ...state, timer: 0 };
      }
      return { ...state, timer: state.timer - 1 };
    }

    case "RESET": {
      return { ...INITIAL_STATE };
    }
  }
}

// Convenience type guards.
export function isCooking(state: GameState): boolean {
  return state.phase === "cook-ingr" || state.phase === "cook-steps";
}

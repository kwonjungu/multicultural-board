// BeeCafe — shared type definitions.
//
// All game entities use LangMap so names/instructions can be shown in either
// langA (learner) or langB (counterpart). Ids are narrow string-literal unions
// so scoring / reducer logic stays exhaustive under TS strict mode.

import type { LangMap } from "@/lib/gameData";

// ---- 12 menu ids ---------------------------------------------------------
export type MenuId =
  | "kimchi-jjigae"
  | "bibimbap"
  | "pho"
  | "banh-mi"
  | "pad-thai"
  | "mango-sticky"
  | "curry-rice"
  | "dumpling"
  | "sushi"
  | "adobo"
  | "nasi-goreng"
  | "plov";

// ---- 20 ingredient ids ---------------------------------------------------
export type IngredientId =
  | "rice"
  | "noodle"
  | "kimchi"
  | "egg"
  | "tofu"
  | "pork"
  | "beef"
  | "chicken"
  | "shrimp"
  | "fish"
  | "garlic"
  | "onion"
  | "chili"
  | "carrot"
  | "cabbage"
  | "mushroom"
  | "cilantro"
  | "soy-sauce"
  | "curry-powder"
  | "mango";

// ---- 15 cook-step ids ----------------------------------------------------
export type StepId =
  | "wash"
  | "chop"
  | "marinate"
  | "boil"
  | "stir-fry"
  | "simmer"
  | "grill"
  | "steam"
  | "fry"
  | "mix"
  | "plate"
  | "season"
  | "garnish"
  | "serve"
  | "rest";

// ---- data shapes ---------------------------------------------------------
export interface MenuDef {
  id: MenuId;
  emoji: string;
  origin: string; // 2-letter region code for label e.g. "KR"
  name: LangMap;
  ingredients: IngredientId[]; // correct answer set
  steps: StepId[]; // correct answer sequence (ordered)
}

export interface IngredientDef {
  id: IngredientId;
  emoji: string;
  name: LangMap;
}

export interface StepDef {
  id: StepId;
  emoji: string;
  name: LangMap;
}

// ---- game state / actions -----------------------------------------------
export type Role = "customer" | "chef";
export type Difficulty = "easy" | "normal" | "hard";
export type Phase =
  | "role"
  | "menu"
  | "order"
  | "cook-ingr"
  | "cook-steps"
  | "result"
  | "done";

export interface ScoreResult {
  stars: 1 | 2 | 3;
  detail: string;
  ingrAcc: number;
  stepAcc: number;
  speedBonus: number;
  total: number;
}

export interface GameState {
  phase: Phase;
  roleA: Role; // player A
  roleB: Role; // player B
  difficulty: Difficulty;
  deck: MenuId[];
  openCards: MenuId[]; // 3 revealed
  chosenMenu: MenuId | null;
  pickedIngredients: IngredientId[];
  stepOrder: StepId[];
  completedCount: number; // 0..3
  timer: number; // seconds remaining (or elapsed if unlimited)
  unlimited: boolean;
  elapsedForRound: number; // seconds spent on current cooking round
  lastScore?: ScoreResult;
  totalStars: number;
}

export type Action =
  | { type: "DEAL" }
  | { type: "PICK_MENU"; id: MenuId }
  | { type: "SWAP_ROLE" }
  | { type: "SET_DIFFICULTY"; diff: Difficulty }
  | { type: "BEGIN_COOK" }
  | { type: "TOGGLE_INGR"; id: IngredientId }
  | { type: "GOTO_STEPS" }
  | { type: "REORDER_STEP"; from: number; to: number }
  | { type: "ADD_STEP"; id: StepId }
  | { type: "REMOVE_STEP"; idx: number }
  | { type: "SERVE" }
  | { type: "NEXT" }
  | { type: "TICK" }
  | { type: "RESET" };

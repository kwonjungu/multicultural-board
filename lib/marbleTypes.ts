// BeeWorldMarble — shared types used by the reducer, effects and UI.
// Kept separate so neither file has to re-import the other.

export type PlayerId = "A" | "B" | "C" | "D";

export interface PlayerState {
  id: PlayerId;
  lang: string;
  name: string;
  pos: number;           // 0..BOARD_SIZE-1
  cash: number;          // starts at 1500
  owned: number[];       // tile idx list
  inJail: 0 | 1 | 2 | 3; // turns remaining in jail (0 = free)
  inSpace: 0 | 1 | 2;    // turns remaining in space
  laps: number;
  skipNext: boolean;
  bankrupt: boolean;
  // Cosmetic setup (kept loose — renderer reads what's there).
  skin: string;
  hat: string | null;
  pet: string | null;
  country: string;
}

export type Phase =
  | { kind: "intro" }
  | { kind: "rolling"; who: PlayerId }
  | { kind: "moving"; who: PlayerId; from: number; to: number; step: number }
  | { kind: "landed"; who: PlayerId; tile: number }
  | { kind: "quiz"; who: PlayerId; tile: number; questionId: string; rewardBonus?: number }
  | { kind: "chance"; who: PlayerId; cardId: string }
  | { kind: "buyPrompt"; who: PlayerId; tile: number }
  | { kind: "tollPaid"; who: PlayerId; tile: number; amount: number }
  | { kind: "festival"; who: PlayerId; amount: number }
  // byAssets: 라운드 캡 도달로 총자산 승부가 난 경우 (파산 종료와 구분)
  | { kind: "gameover"; winner: PlayerId | null; byAssets?: boolean };

export interface LogEntry {
  ts: number;
  text: string;
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  playerIds: PlayerId[];
  turn: PlayerId;
  phase: Phase;
  diceA: number;
  diceB: number;
  isDouble: boolean;
  doubleStreak: number;
  festivalPot: number;
  log: LogEntry[];
  round: number;
}

export interface SetupPlayer {
  id: PlayerId;
  lang: string;
  name: string;
  skin: string;
  hat: string | null;
  pet: string | null;
  country: string;
}

export type Action =
  | { type: "start"; players: SetupPlayer[] }
  | { type: "rollDice" }
  | { type: "rollResult"; a: number; b: number }
  | { type: "advance" }
  | { type: "arrive" }
  | { type: "answerQuiz"; correct: boolean }
  | { type: "resolveChance" }
  | { type: "buyYes" }
  | { type: "buyNo" }
  | { type: "endTurn" }
  | { type: "payTax"; amount: number }
  | { type: "releaseJail"; via: "dice" | "pay" }
  | { type: "restart" };

export const START_CASH = 1500;
export const PASS_START_BONUS = 200;
export const TAX_AMOUNT = 120;
export const KEY_BONUS = 150;
export const JAIL_RELEASE_FEE = 80;
// 승리 조건이 파산뿐이면 게임이 사실상 끝나지 않는다 (시뮬 200판 전부
// 120라운드 캡 도달, 파산 0%). 수업 시간에 맞게 라운드 캡 + 총자산 승부.
// 15는 시뮬 게이트의 설계 목표(평균 15~30라운드) 하한에 맞춘 값.
export const MAX_ROUNDS = 15;

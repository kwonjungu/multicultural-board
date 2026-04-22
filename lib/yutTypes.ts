// HoneyYut — shared types used by the reducer, logic and UI.
// Kept separate so logic stays pure and components only import what they need.

// Result of throwing the 4 sticks. Positive = forward squares, -1 = backdo.
// 4 (윷) and 5 (모) grant an extra throw (handled by the reducer).
export type Throw = -1 | 1 | 2 | 3 | 4 | 5;

export type TeamId = "A" | "B";

export type CornerRegion = "east" | "south" | "west" | "north";

export type PieceId = string; // `${team}-${idx}` e.g. "A-0"

// A piece lives either in its home area (not yet started) or on the board
// graph at a node index. `stackedWith` holds ids of other pieces (same team)
// that are currently carried with this one — they always move & get captured
// together.
export interface Piece {
  id: PieceId;
  team: TeamId;
  node: number | "home" | "goal";
  stackedWith: PieceId[];
}

export type PhaseKind =
  | "idle"         // waiting for current team to throw
  | "throwing"     // stick animation in progress
  | "choosePiece"  // player must pick which piece to move (one or more throws available)
  | "chooseBranch" // piece is on a branch tile and must pick forward direction
  | "culture"      // culture card shown after corner landing, waits on "close"
  | "win";         // terminal

export interface BranchChoice {
  pieceId: PieceId;
  throwValue: Throw;
  from: number;
  options: number[]; // next-node candidates, >=2 entries when branch applies
}

export type LangMap = Record<string, string>;

export interface CultureCardData {
  region: CornerRegion;
  // Each entry: { lang, greeting, romanization? }
  greetings: Array<{ lang: string; greet: string; roman?: string }>;
}

export interface GameState {
  turn: TeamId;
  pieces: Record<PieceId, Piece>;
  throws: Throw[];                   // queued throws awaiting spend
  phase: { kind: PhaseKind };
  pendingBranch: BranchChoice | null;
  cultureCard: CultureCardData | null;
  log: string[];
  winner: TeamId | null;
  // How many consecutive extra-throw rolls (윷/모) in current turn — purely
  // cosmetic / for log display.
  extraThrowStreak: number;
}

export type Action =
  | { type: "throwResult"; value: Throw }
  | { type: "selectPiece"; pieceId: PieceId; throwValue: Throw }
  | { type: "selectBranch"; nextNode: number }
  | { type: "closeCulture" }
  | { type: "endTurn" }
  | { type: "restart" };

export const PIECES_PER_TEAM = 4;

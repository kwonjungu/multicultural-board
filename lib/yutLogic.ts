// HoneyYut — pure logic. No React, no side-effects.
// Every helper returns a new snapshot. Collision, goal and stacking rules
// all live here.

import {
  TILE_GRAPH,
  STICK_PROB,
  forwardOptions,
  backwardStep,
  cornerRegion,
  CORNER_GREETINGS,
  throwLabel,
} from "./yutData";
import type {
  Throw,
  TeamId,
  Piece,
  PieceId,
  GameState,
  CultureCardData,
  Action,
} from "./yutTypes";
import { PIECES_PER_TEAM } from "./yutTypes";

// --- Initial state --------------------------------------------------------

export function createInitialState(): GameState {
  const pieces: Record<PieceId, Piece> = {};
  (["A", "B"] as const).forEach((team) => {
    for (let i = 0; i < PIECES_PER_TEAM; i += 1) {
      const id: PieceId = `${team}-${i}`;
      pieces[id] = { id, team, node: "home", stackedWith: [] };
    }
  });
  return {
    turn: "A",
    pieces,
    throws: [],
    phase: { kind: "idle" },
    pendingBranch: null,
    cultureCard: null,
    log: ["🐝 꿀벌 윷놀이 시작! A팀부터"],
    winner: null,
    extraThrowStreak: 0,
  };
}

// --- Throw ----------------------------------------------------------------

/**
 * Roll the sticks. Uses cumulative-weight sampling over STICK_PROB.
 */
export function throwSticks(): Throw {
  const r = Math.random();
  let acc = 0;
  for (const o of STICK_PROB) {
    acc += o.weight;
    if (r < acc) return o.value;
  }
  return 3; // fallback (걸)
}

export function isExtraThrow(v: Throw): boolean {
  return v === 4 || v === 5;
}

// --- Piece selection / movement ------------------------------------------

function ownedPieces(state: GameState, team: TeamId): Piece[] {
  return Object.values(state.pieces).filter(p => p.team === team);
}

/**
 * Return pieces that CAN use this throw. A piece can move if:
 *   - throw > 0 and piece is on home OR on a real node,
 *   - throw === -1 (백도) and piece is already on the board
 *     (if no on-board pieces, 백도 is auto-spent with no effect).
 */
export function movablePieces(state: GameState, throwValue: Throw): Piece[] {
  const team = state.turn;
  const mine = ownedPieces(state, team).filter(p => p.node !== "goal");
  if (throwValue === -1) {
    // Only on-board pieces can back up; home/goal pieces skip.
    return mine.filter(p => p.node !== "home");
  }
  return mine;
}

// --- Path resolution ------------------------------------------------------

// Walk forward `steps` from `start`. Returns `landed` (single path), `goal`
// (reached 0 from 19), or `branch` when the first step (or a mid-walk arrival
// at node 23) offers multiple forward options.
export type WalkResult =
  | { kind: "landed"; node: number }
  | { kind: "goal" }
  | { kind: "branch"; from: number; options: number[]; remainingSteps: number };

export function walkForward(start: number, steps: number): WalkResult {
  if (steps <= 0) return { kind: "landed", node: start };

  let node = start;
  let left = steps;
  let firstStep = true;

  while (left > 0) {
    const opts = forwardOptions(node);
    if (opts.length > 1 && (firstStep || node === 23)) {
      return { kind: "branch", from: node, options: opts, remainingSteps: left };
    }
    const next = opts[0];
    // Goal = landing exactly on 0 from 19. Inner paths rejoin at idx 17 and
    // then walk 17->18->19->0 normally, so the same check covers both.
    if (node === 19 && next === 0 && left === 1) {
      return { kind: "goal" };
    }
    node = next;
    left -= 1;
    firstStep = false;
  }
  return { kind: "landed", node };
}

export function walkBackward(start: number): { kind: "landed"; node: number } | { kind: "home" } {
  if (start === 0) {
    // Can't backdo off the start — send the piece home for a do-over.
    return { kind: "home" };
  }
  return { kind: "landed", node: backwardStep(start) };
}

// --- Collision & stacking ------------------------------------------------

// Land the moving piece (with its carry-on group) at `node`:
//   - enemy occupant → entire enemy group goes home, returns captured:true
//   - friendly occupant → groups merge (stacking)
export interface LandingEffect {
  state: GameState;
  captured: boolean;
}

export function applyLanding(
  state: GameState,
  movingId: PieceId,
  node: number,
): LandingEffect {
  const next = { ...state, pieces: { ...state.pieces } };
  const movers = collectGroup(next.pieces, movingId);
  const team = next.pieces[movingId].team;

  // Find any existing occupant group (pick leader: any piece whose node===node
  // AND is not itself part of the moving group).
  const occupant = Object.values(next.pieces).find(
    p => p.node === node && !movers.includes(p.id),
  );

  if (!occupant) {
    // Plain landing.
    for (const id of movers) {
      next.pieces[id] = { ...next.pieces[id], node };
    }
    return { state: next, captured: false };
  }

  const occGroup = collectGroup(next.pieces, occupant.id);

  if (occupant.team === team) {
    // Stack: merge movers onto occupant leader.
    const leaderId = occupant.id;
    const combined = Array.from(new Set([...occGroup.filter(i => i !== leaderId), ...movers.filter(i => i !== leaderId)]));
    next.pieces[leaderId] = {
      ...next.pieces[leaderId],
      node,
      stackedWith: combined,
    };
    for (const id of movers) {
      if (id === leaderId) continue;
      next.pieces[id] = { ...next.pieces[id], node, stackedWith: [] };
    }
    // Also blank followers-of-leader's stackedWith to avoid duplication — the
    // leader owns the canonical list.
    for (const id of occGroup) {
      if (id === leaderId) continue;
      next.pieces[id] = { ...next.pieces[id], node, stackedWith: [] };
    }
    return { state: next, captured: false };
  }

  // Capture: whole enemy group sent home.
  for (const id of occGroup) {
    next.pieces[id] = { ...next.pieces[id], node: "home", stackedWith: [] };
  }
  for (const id of movers) {
    next.pieces[id] = { ...next.pieces[id], node };
  }
  // Make moving piece the leader, with its followers re-attached.
  next.pieces[movingId] = {
    ...next.pieces[movingId],
    node,
    stackedWith: movers.filter(id => id !== movingId),
  };
  for (const id of movers) {
    if (id === movingId) continue;
    next.pieces[id] = { ...next.pieces[id], node, stackedWith: [] };
  }
  return { state: next, captured: true };
}

function collectGroup(pieces: Record<PieceId, Piece>, id: PieceId): PieceId[] {
  const p = pieces[id];
  if (!p) return [];
  // Canonical group = all same-team pieces on the same node (leader-agnostic).
  if (p.node === "home" || p.node === "goal") return [id];
  const group: PieceId[] = [];
  for (const other of Object.values(pieces)) {
    if (other.team === p.team && other.node === p.node) group.push(other.id);
  }
  return group;
}

// --- Goal & win -----------------------------------------------------------

export function sendToGoal(state: GameState, movingId: PieceId): GameState {
  const next = { ...state, pieces: { ...state.pieces } };
  const movers = collectGroup(next.pieces, movingId);
  for (const id of movers) {
    next.pieces[id] = { ...next.pieces[id], node: "goal", stackedWith: [] };
  }
  return next;
}

export function checkWin(state: GameState): TeamId | null {
  for (const team of ["A", "B"] as const) {
    const mine = Object.values(state.pieces).filter(p => p.team === team);
    if (mine.every(p => p.node === "goal")) return team;
  }
  return null;
}

// --- Reducer --------------------------------------------------------------

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "throwResult": {
      if (state.winner) return state;
      const throws = [...state.throws, action.value];
      const extra = isExtraThrow(action.value);
      const nextLog = [
        ...state.log,
        `${turnEmoji(state.turn)} ${throwLabel(action.value)}${extra ? " — 한 번 더!" : ""}`,
      ];
      // Extra-throw (윷/모) → stay idle so the player throws again.
      // Otherwise move on to choosePiece — queued throws persist across that.
      return {
        ...state,
        throws,
        log: nextLog,
        extraThrowStreak: extra ? state.extraThrowStreak + 1 : state.extraThrowStreak,
        phase: extra ? { kind: "idle" } : { kind: "choosePiece" },
      };
    }

    case "selectPiece": {
      const { pieceId, throwValue } = action;
      const piece = state.pieces[pieceId];
      if (!piece || piece.team !== state.turn) return state;
      if (!state.throws.includes(throwValue)) return state;

      // Remove this throw from the queue now.
      const throws = removeOnce(state.throws, throwValue);

      // Resolve movement.
      if (throwValue === -1) {
        if (piece.node === "home" || piece.node === "goal") {
          // No effect; throw consumed.
          return finishThrow(state, throws, `⤵️ ${pieceId} 백도 — 제자리`);
        }
        const res = walkBackward(piece.node as number);
        if (res.kind === "home") {
          // Sent back to start tile 0 (not home).
          const { state: post } = applyLanding(state, pieceId, 0);
          return finishThrow({ ...post, throws }, throws, `⤵️ ${pieceId} 백도 → 시작으로`);
        }
        const landing = applyLanding(state, pieceId, res.node);
        const afterLog = [
          ...state.log,
          `⤵️ ${pieceId} 백도 → ${res.node}${landing.captured ? " (잡음!)" : ""}`,
        ];
        return postLanding(landing.state, throws, afterLog, res.node, landing.captured, false);
      }

      // Forward walk. Home-pieces enter at node 0 by consuming 1 pip.
      const walkStart = piece.node === "home" ? 0 : (piece.node as number);
      const steps = piece.node === "home" ? (throwValue as number) - 1 : (throwValue as number);
      const res = walkForward(walkStart, steps);
      return resolveWalk(state, pieceId, throwValue, throws, res, "➡️");
    }

    case "selectBranch": {
      if (!state.pendingBranch) return state;
      const { pieceId, throwValue, options } = state.pendingBranch;
      if (!options.includes(action.nextNode)) return state;
      const piece = state.pieces[pieceId];
      if (!piece) return state;
      const homeBase = piece.node === "home" ? 1 : 0;
      const remaining = (throwValue as number) - homeBase - 1;
      const chosenStart = action.nextNode;
      const cleared: GameState = { ...state, pendingBranch: null };
      const res: WalkResult = remaining <= 0
        ? { kind: "landed", node: chosenStart }
        : walkForward(chosenStart, remaining);
      return resolveWalk(cleared, pieceId, throwValue, cleared.throws, res, "↪️");
    }

    case "closeCulture": {
      // Culture card dismissed: if throws remain, go back to choosePiece;
      // otherwise end turn.
      if (state.throws.length > 0) {
        return { ...state, cultureCard: null, phase: { kind: "choosePiece" } };
      }
      return endTurnCore({ ...state, cultureCard: null });
    }

    case "endTurn": {
      return endTurnCore(state);
    }

    case "restart": {
      return createInitialState();
    }

    default:
      return state;
  }
}

// --- Reducer helpers ------------------------------------------------------

// Unified dispatcher for a WalkResult. Used by both selectPiece and
// selectBranch so the branch / goal / landed cases live in one place.
function resolveWalk(
  state: GameState,
  pieceId: PieceId,
  throwValue: Throw,
  throws: Throw[],
  res: WalkResult,
  prefix: string,
): GameState {
  if (res.kind === "branch") {
    return {
      ...state,
      throws,
      pendingBranch: { pieceId, throwValue, from: res.from, options: res.options },
      phase: { kind: "chooseBranch" },
    };
  }
  if (res.kind === "goal") {
    const reached = sendToGoal(state, pieceId);
    return checkAndFinish(
      { ...reached, throws, log: [...state.log, `🏁 ${pieceId} 도착!`] },
      throws,
      false,
    );
  }
  const landing = applyLanding(state, pieceId, res.node);
  const afterLog = [
    ...state.log,
    `${prefix} ${pieceId} → ${res.node}${landing.captured ? " (잡음! 🎯)" : ""}`,
  ];
  return postLanding(landing.state, throws, afterLog, res.node, landing.captured, false);
}

function removeOnce<T>(arr: T[], v: T): T[] {
  const i = arr.indexOf(v);
  if (i < 0) return arr;
  const out = arr.slice();
  out.splice(i, 1);
  return out;
}

function turnEmoji(team: TeamId): string {
  return team === "A" ? "🟡" : "🔵";
}

// After a landing: maybe fire a CultureCard (corner), grant a capture bonus
// throw, or advance phase / turn.
function postLanding(
  state: GameState,
  throws: Throw[],
  log: string[],
  node: number,
  captured: boolean,
  _fromHome: boolean,
): GameState {
  const winner = checkWin(state);
  if (winner) {
    return {
      ...state,
      throws,
      log: [...log, `🏆 ${winner}팀 승리!`],
      phase: { kind: "win" },
      winner,
    };
  }

  // Culture card trigger — only when a player actually lands on a corner.
  const region = cornerRegion(node);
  const cultureCard: CultureCardData | null = region
    ? { region, greetings: CORNER_GREETINGS[region] }
    : null;

  // Capture grants an extra throw (classic yut rule).
  if (captured) {
    log = [...log, "➕ 잡았으니 한 번 더!"];
  }

  // Culture card pauses the flow; closeCulture resumes.
  // v1 trade-off: we don't thread capture-extra through the culture pause
  // because capture + corner co-landing is rare.
  if (cultureCard) {
    return {
      ...state,
      throws,
      log,
      phase: { kind: "culture" },
      cultureCard,
    };
  }

  if (captured) {
    // Extra throw: go idle so player throws again.
    return { ...state, throws, log, phase: { kind: "idle" } };
  }

  if (throws.length > 0) {
    return { ...state, throws, log, phase: { kind: "choosePiece" } };
  }
  // No throws left and no bonus — end turn.
  return endTurnCore({ ...state, throws, log });
}

function checkAndFinish(state: GameState, throws: Throw[], captured: boolean): GameState {
  const winner = checkWin(state);
  if (winner) {
    return {
      ...state,
      throws,
      log: [...state.log, `🏆 ${winner}팀 승리!`],
      phase: { kind: "win" },
      winner,
    };
  }
  if (throws.length > 0 || captured) {
    return { ...state, throws, phase: throws.length > 0 ? { kind: "choosePiece" } : { kind: "idle" } };
  }
  return endTurnCore({ ...state, throws });
}

function finishThrow(state: GameState, throws: Throw[], logLine: string): GameState {
  const log = [...state.log, logLine];
  if (throws.length > 0) return { ...state, throws, log, phase: { kind: "choosePiece" } };
  return endTurnCore({ ...state, throws, log });
}

function endTurnCore(state: GameState): GameState {
  const nextTurn: TeamId = state.turn === "A" ? "B" : "A";
  return {
    ...state,
    turn: nextTurn,
    phase: { kind: "idle" },
    throws: [],
    pendingBranch: null,
    cultureCard: null,
    extraThrowStreak: 0,
    log: [...state.log, `— ${nextTurn}팀 차례 —`],
  };
}

// Convenience re-exports for consumers.
export { throwLabel, TILE_GRAPH };

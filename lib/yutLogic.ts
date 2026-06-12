// HoneyYut v2 — 순수 로직 + 리듀서.
//
// 핵심 설계: "멈춘 칸이 경로를 결정한다" (전통 룰).
//   - 5(첫 모서리)에 멈춤  → 다음 이동은 대각선 diagA (5→20→21→22→23→24→15)
//   - 10(둘째 모서리)에 멈춤 → 대각선 diagB (10→25→26→22→27→28→골)
//   - 22(중앙)에 멈춤      → 최단 출구 cut (22→27→28→골)
//   - 골은 "출발점을 밟거나 지나치면" 인정 (pass-over).
// 정규화(normalize) 덕분에 멈춘 말의 node 가 route 를 유일하게 결정하므로,
// "같은 노드에 멈춘 같은 팀 말 = 같은 pos = 자동 업기"가 성립한다.

import {
  CULTURE_NODES,
  PIECES_PER_TEAM,
  type Action,
  type GameState,
  type Piece,
  type PieceId,
  type PiecePos,
  type Route,
  type TeamId,
  type Throw,
} from "./yutTypes";

export type BoardPos = { node: number; route: Route };

// ── 한 걸음 전진. "goal" = 골 경계를 넘음 ──────────────────────────
export function stepForward(p: BoardPos): BoardPos | "goal" {
  const { node, route } = p;
  if (route === "outer") {
    // 0(출발칸)에 서 있는 말 = 백도로 돌아온 말. 한 걸음이라도 가면 골인.
    if (node === 0 || node === 19) return "goal";
    return { node: node + 1, route: "outer" };
  }
  if (route === "diagA") {
    // 5→20→21→22→23→24→15(이후 outer 합류)
    if (node === 5) return { node: 20, route };
    if (node === 24) return { node: 15, route: "outer" };
    return { node: node + 1, route }; // 20→21→22→23→24
  }
  if (route === "diagB") {
    // 10→25→26→22→27→28→골
    if (node === 10) return { node: 25, route };
    if (node === 26) return { node: 22, route };
    if (node === 22) return { node: 27, route };
    if (node === 28) return "goal";
    return { node: node + 1, route }; // 25→26, 27→28
  }
  // cut: 22→27→28→골
  if (node === 28) return "goal";
  if (node === 22) return { node: 27, route };
  return { node: 28, route }; // 27→28
}

// ── 멈춘 칸 정규화 — 지름길 진입 + 합류 구간 route 통일 ──────────────
export function normalize(p: BoardPos): BoardPos {
  if (p.node === 5) return { node: 5, route: "diagA" };
  if (p.node === 10) return { node: 10, route: "diagB" };
  if (p.node === 22) return { node: 22, route: "cut" };
  if (p.route === "diagA" && p.node >= 15 && p.node <= 19) {
    return { node: p.node, route: "outer" };
  }
  return p;
}

// ── 전진 이동 (steps ≥ 1). 골 경계를 넘으면 즉시 골 ──────────────────
export function walkForward(start: BoardPos, steps: number): BoardPos | "goal" {
  let cur: BoardPos = start;
  for (let i = 0; i < steps; i++) {
    const next = stepForward(cur);
    if (next === "goal") return "goal";
    cur = next;
  }
  return normalize(cur);
}

// ── 백도 한 걸음. 출발칸(0)에서 또 백도면 집으로 ─────────────────────
export function stepBackward(p: BoardPos): BoardPos | "home" {
  const { node, route } = p;
  if (route === "outer") {
    if (node === 0) return "home";
    return normalize({ node: node - 1, route: "outer" });
  }
  if (route === "diagA") {
    // 멈춘 diagA 노드: 5, 20, 21, 23, 24
    if (node === 5) return normalize({ node: 4, route: "outer" });
    if (node === 20) return { node: 5, route: "diagA" };
    if (node === 23) return { node: 22, route: "cut" };
    return normalize({ node: node - 1, route }); // 21→20, 24→23
  }
  if (route === "diagB") {
    // 멈춘 diagB 노드: 10, 25, 26, 27, 28
    if (node === 10) return normalize({ node: 9, route: "outer" });
    if (node === 25) return { node: 10, route: "diagB" };
    if (node === 27) return { node: 22, route: "cut" };
    return normalize({ node: node - 1, route }); // 26→25, 28→27
  }
  // cut 멈춘 노드: 22, 27, 28
  if (node === 22) return { node: 21, route: "diagA" }; // 가장 흔한 진입 경로로 복귀
  if (node === 27) return { node: 22, route: "cut" };
  return { node: 27, route: "cut" }; // 28
}

// ── 초기 상태 ──────────────────────────────────────────────────────
export function makeInitialState(): GameState {
  const pieces: Record<PieceId, Piece> = {};
  (["A", "B"] as TeamId[]).forEach((team) => {
    for (let i = 0; i < PIECES_PER_TEAM; i++) {
      const id = `${team}-${i}`;
      pieces[id] = { id, team, pos: { kind: "home" } };
    }
  });
  return {
    turn: "A",
    pieces,
    queue: [],
    phase: "needThrow",
    winner: null,
    cultureNode: null,
    log: ["🐝 윷놀이 시작! A팀부터 던져요."],
  };
}

const TEAM_LABEL: Record<TeamId, string> = { A: "A팀", B: "B팀" };
const THROW_LABEL: Record<string, string> = {
  "-1": "백도", "1": "도", "2": "개", "3": "걸", "4": "윷", "5": "모",
};

function pushLog(s: GameState, text: string): GameState {
  return { ...s, log: [...s.log.slice(-29), text] };
}

// ── 이동 가능 판정 ─────────────────────────────────────────────────
export function canMove(piece: Piece, value: Throw): boolean {
  if (piece.pos.kind === "goal") return false;
  if (piece.pos.kind === "home") return value > 0; // 백도로는 출발 불가
  return true;
}

function teamPieces(s: GameState, team: TeamId): Piece[] {
  return Object.values(s.pieces).filter((p) => p.team === team);
}

function anyUsable(s: GameState): boolean {
  const mine = teamPieces(s, s.turn);
  return s.queue.some((v) => mine.some((p) => canMove(p, v)));
}

/** 현재 선택한 던지기 값으로 움직일 수 있는 말 id 목록 (UI 하이라이트용) */
export function movablePieceIds(s: GameState, value: Throw): PieceId[] {
  return teamPieces(s, s.turn).filter((p) => canMove(p, value)).map((p) => p.id);
}

// 같은 칸에 멈춰 있는 같은 팀 말들 (업힌 묶음). home/goal 은 단독.
function groupOf(s: GameState, pieceId: PieceId): PieceId[] {
  const p = s.pieces[pieceId];
  if (p.pos.kind !== "board") return [pieceId];
  const node = p.pos.node;
  return Object.values(s.pieces)
    .filter((q) => q.team === p.team && q.pos.kind === "board" && q.pos.node === node)
    .map((q) => q.id);
}

function endTurn(s: GameState): GameState {
  const next: TeamId = s.turn === "A" ? "B" : "A";
  return { ...s, turn: next, queue: [], phase: "needThrow" };
}

// move phase 진입 — 쓸 수 있는 던지기가 하나도 없으면 자동으로 턴 넘김
function enterMove(s: GameState): GameState {
  if (!anyUsable(s)) {
    return endTurn(pushLog(s, `${TEAM_LABEL[s.turn]} 움직일 말이 없어요 — 턴 넘김`));
  }
  return { ...s, phase: "move" };
}

// ── 리듀서 ─────────────────────────────────────────────────────────
export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "restart":
      return makeInitialState();

    case "closeCulture":
      // 턴 흐름과 완전히 분리 — 두 번 닫혀도 무해 (v1 더블탭 버그 방지)
      return state.cultureNode === null ? state : { ...state, cultureNode: null };

    case "throwResult": {
      if (state.phase !== "needThrow" || state.winner) return state;
      const v = action.value;
      let s = { ...state, queue: [...state.queue, v] };
      s = pushLog(s, `${TEAM_LABEL[s.turn]} ${THROW_LABEL[String(v)]}!`);
      if (v === 4 || v === 5) {
        return pushLog(s, "✨ 한 번 더 던져요!");
      }
      return enterMove(s);
    }

    case "move": {
      if (state.phase !== "move" || state.winner) return state;
      const { pieceId, queueIndex } = action;
      const value = state.queue[queueIndex];
      if (value === undefined) return state;
      const piece = state.pieces[pieceId];
      if (!piece || piece.team !== state.turn || !canMove(piece, value)) return state;

      // 목적지 계산
      let dest: PiecePos;
      if (piece.pos.kind === "home") {
        // 집에서 출발: 첫 걸음이 1번 칸 (출발칸 0 은 밟지 않고 지나침)
        const r = value === 1
          ? normalize({ node: 1, route: "outer" })
          : walkForward({ node: 1, route: "outer" }, value - 1);
        dest = r === "goal" ? { kind: "goal" } : { kind: "board", ...r };
      } else if (piece.pos.kind === "board") {
        const from: BoardPos = { node: piece.pos.node, route: piece.pos.route };
        if (value === -1) {
          const r = stepBackward(from);
          dest = r === "home" ? { kind: "home" } : { kind: "board", ...r };
        } else {
          const r = walkForward(from, value);
          dest = r === "goal" ? { kind: "goal" } : { kind: "board", ...r };
        }
      } else {
        return state;
      }

      // 묶음(업힌 말들) 함께 이동
      const movers = groupOf(state, pieceId);
      const newPieces: Record<PieceId, Piece> = { ...state.pieces };
      for (const id of movers) {
        newPieces[id] = { ...newPieces[id], pos: dest };
      }

      let s: GameState = {
        ...state,
        pieces: newPieces,
        queue: state.queue.filter((_, i) => i !== queueIndex),
      };

      const stackNote = movers.length > 1 ? ` (${movers.length}개 업고)` : "";

      // 잡기 — 도착 노드의 상대 말 전부 집으로 + 한 번 더
      let captured = false;
      if (dest.kind === "board") {
        const node = dest.node;
        const enemies = Object.values(s.pieces).filter(
          (q) => q.team !== piece.team && q.pos.kind === "board" && q.pos.node === node,
        );
        if (enemies.length > 0) {
          captured = true;
          const np = { ...s.pieces };
          for (const e of enemies) np[e.id] = { ...e, pos: { kind: "home" } };
          s = { ...s, pieces: np };
          s = pushLog(s, `💥 ${TEAM_LABEL[piece.team]}이 상대 말 ${enemies.length}개를 잡았어요${stackNote} — 한 번 더!`);
        }
        // 같은 팀 말 위에 멈추면 자동 업기 (pos 동일화로 이미 묶임)
        const friends = Object.values(s.pieces).filter(
          (q) => q.team === piece.team && q.pos.kind === "board" && q.pos.node === node && !movers.includes(q.id),
        );
        if (friends.length > 0) {
          s = pushLog(s, `🤝 ${TEAM_LABEL[piece.team]} 말이 업혔어요! (${friends.length + movers.length}개)`);
        }
        // 문화카드 칸
        if ((CULTURE_NODES as readonly number[]).includes(node)) {
          s = { ...s, cultureNode: node };
        }
      }

      if (dest.kind === "goal") {
        s = pushLog(s, `🏁 ${TEAM_LABEL[piece.team]} 말 골인!${stackNote}`);
        const allGoal = teamPieces(s, piece.team).every((p) => p.pos.kind === "goal");
        if (allGoal) {
          return {
            ...pushLog(s, `🏆 ${TEAM_LABEL[piece.team]} 승리!`),
            phase: "win",
            winner: piece.team,
          };
        }
      }
      if (dest.kind === "home") {
        s = pushLog(s, `↩️ 백도로 출발점을 지나 집으로 돌아갔어요`);
      }

      if (captured) {
        // 잡기 보너스 — 즉시 한 번 더 던진다 (남은 큐는 유지)
        return { ...s, phase: "needThrow" };
      }
      if (s.queue.length === 0) {
        return endTurn(s);
      }
      return enterMove(s);
    }
  }
}

// ── 윷가락 던지기 (4개 시뮬레이션) ──────────────────────────────────
// 평평한 면이 위로 올 확률 0.55 (살짝 등이 무거운 실제 윷 느낌).
// 1개 위 = 도 (단, 표시된 가락[idx 0] 혼자 위면 백도), 2=개, 3=걸, 4=윷, 0=모.
export interface StickThrow {
  sticks: boolean[]; // true = 평평한 면(배)이 위
  value: Throw;
}

export function throwSticks(rand: () => number = Math.random): StickThrow {
  const sticks = [0, 1, 2, 3].map(() => rand() < 0.55);
  const up = sticks.filter(Boolean).length;
  let value: Throw;
  if (up === 0) value = 5;        // 모
  else if (up === 4) value = 4;   // 윷
  else if (up === 1) value = sticks[0] ? -1 : 1; // 백도 가락 혼자면 백도
  else value = up as Throw;       // 개(2) / 걸(3)
  return { sticks, value };
}

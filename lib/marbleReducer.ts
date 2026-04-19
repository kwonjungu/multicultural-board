// BeeWorldMarble — pure reducer & initial state.
// Types live in marbleTypes; tile/chance effects in marbleEffects.

import {
  BOARD_SIZE,
  CHANCES,
  JAIL_INDEX,
  START_INDEX,
  TILES,
} from "./marbleData";
import {
  applyChanceEffect,
  enterTile,
  findOwner,
  pushLog,
  tollFor,
} from "./marbleEffects";
import {
  JAIL_RELEASE_FEE,
  PASS_START_BONUS,
  START_CASH,
  type Action,
  type GameState,
  type LogEntry,
  type PlayerId,
  type PlayerState,
  type SetupPlayer,
} from "./marbleTypes";

// Re-export types & constants for sibling files that still do
// `import ... from "@/lib/marbleReducer"`.
export type {
  Action,
  GameState,
  LogEntry,
  PlayerId,
  PlayerState,
  SetupPlayer,
} from "./marbleTypes";
export {
  JAIL_RELEASE_FEE,
  PASS_START_BONUS,
  START_CASH,
  TAX_AMOUNT,
  KEY_BONUS,
} from "./marbleTypes";
export { findOwner, tollFor };

export function freshPlayer(sp: SetupPlayer): PlayerState {
  return {
    id: sp.id,
    lang: sp.lang,
    name: sp.name,
    pos: 0,
    cash: START_CASH,
    owned: [],
    inJail: 0,
    inSpace: 0,
    laps: 0,
    skipNext: false,
    bankrupt: false,
    skin: sp.skin,
    hat: sp.hat,
    pet: sp.pet,
    country: sp.country,
  };
}

function mkEmptyPlayers(): Record<PlayerId, PlayerState> {
  const stub: PlayerState = {
    id: "A", lang: "ko", name: "", pos: 0, cash: 0, owned: [],
    inJail: 0, inSpace: 0, laps: 0, skipNext: false, bankrupt: false,
    skin: "classic", hat: null, pet: null, country: "",
  };
  return { A: stub, B: stub, C: stub, D: stub };
}

export const initialState: GameState = {
  players: mkEmptyPlayers(),
  playerIds: [],
  turn: "A",
  phase: { kind: "intro" },
  diceA: 1,
  diceB: 1,
  isDouble: false,
  doubleStreak: 0,
  festivalPot: 0,
  log: [],
  round: 1,
};

function nextActivePlayer(s: GameState, from: PlayerId): PlayerId {
  const ids = s.playerIds;
  const idx = ids.indexOf(from);
  for (let step = 1; step <= ids.length; step++) {
    const next = ids[(idx + step) % ids.length];
    if (!s.players[next].bankrupt) return next;
  }
  return from;
}

// Kick off a move animation; caller drives advances via "advance".
function doMove(state: GameState, who: PlayerId, dist: number): GameState {
  const p = state.players[who];
  const to = (p.pos + dist) % BOARD_SIZE;
  return {
    ...state,
    phase: { kind: "moving", who, from: p.pos, to, step: 0 },
  };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "start": {
      const players = mkEmptyPlayers();
      const ids: PlayerId[] = [];
      for (const sp of action.players) {
        players[sp.id] = freshPlayer(sp);
        ids.push(sp.id);
      }
      const first = ids[0];
      return {
        ...initialState,
        players,
        playerIds: ids,
        turn: first,
        phase: { kind: "rolling", who: first },
        log: [{ ts: Date.now(), text: "🎲 게임 시작!" }],
      };
    }

    case "restart": {
      return { ...initialState };
    }

    case "rollDice": {
      // No-op; UI drives rollResult directly.
      return state;
    }

    case "rollResult": {
      if (state.phase.kind !== "rolling") return state;
      const who = state.phase.who;
      const p = state.players[who];
      const { a, b } = action;
      const isDouble = a === b;
      const doubleStreak = isDouble ? state.doubleStreak + 1 : 0;

      // Jailed players must roll doubles to escape; else decrement & stay.
      if (p.inJail > 0) {
        if (isDouble) {
          const np: PlayerState = { ...p, inJail: 0 };
          const next: GameState = {
            ...state,
            players: { ...state.players, [who]: np },
            diceA: a, diceB: b, isDouble, doubleStreak: 0,
          };
          return doMove(next, who, a + b);
        }
        const remaining = Math.max(0, p.inJail - 1) as PlayerState["inJail"];
        const np: PlayerState = { ...p, inJail: remaining };
        const next: GameState = {
          ...state,
          players: { ...state.players, [who]: np },
          diceA: a, diceB: b, isDouble: false, doubleStreak: 0,
        };
        const logged = pushLog(next, `${p.name} 🏝️ 무인도 (${remaining}턴 남음)`);
        return { ...logged, phase: { kind: "landed", who, tile: JAIL_INDEX } };
      }

      if (doubleStreak >= 3) {
        const np: PlayerState = { ...p, pos: JAIL_INDEX, inJail: 3 };
        const next: GameState = {
          ...state,
          players: { ...state.players, [who]: np },
          diceA: a, diceB: b, isDouble, doubleStreak: 0,
        };
        return {
          ...pushLog(next, `${p.name} 3더블! 🏝️ 무인도`),
          phase: { kind: "landed", who, tile: JAIL_INDEX },
        };
      }

      const nextBase: GameState = {
        ...state,
        diceA: a, diceB: b, isDouble, doubleStreak,
      };
      return doMove(nextBase, who, a + b);
    }

    case "advance": {
      if (state.phase.kind !== "moving") return state;
      const { who, to, step, from } = state.phase;
      const p = state.players[who];
      const nextPos = (p.pos + 1) % BOARD_SIZE;
      let cash = p.cash;
      let laps = p.laps;
      if (nextPos === START_INDEX) {
        cash += PASS_START_BONUS;
        laps += 1;
      }
      const np: PlayerState = { ...p, pos: nextPos, cash, laps };
      const ns: GameState = {
        ...state,
        players: { ...state.players, [who]: np },
      };
      const nextStep = step + 1;
      if (nextPos === to) {
        return enterTile(ns, who, to);
      }
      return {
        ...ns,
        phase: { kind: "moving", who, from, to, step: nextStep },
      };
    }

    case "arrive":
      return state;

    case "answerQuiz": {
      if (state.phase.kind !== "quiz") return state;
      const { who, tile } = state.phase;
      const reward = state.phase.rewardBonus ?? 0;
      const p = state.players[who];
      if (action.correct) {
        const np: PlayerState = { ...p, inSpace: 0, cash: p.cash + reward };
        const ns: GameState = { ...state, players: { ...state.players, [who]: np } };
        return {
          ...pushLog(ns, `${p.name} 🎯 정답${reward ? ` +${reward}` : ""}`),
          phase: { kind: "landed", who, tile },
        };
      }
      if (TILES[tile].type === "space") {
        const np: PlayerState = { ...p, skipNext: true };
        const ns: GameState = { ...state, players: { ...state.players, [who]: np } };
        return {
          ...pushLog(ns, `${p.name} 🚀 우주 표류 — 다음 턴 쉬기`),
          phase: { kind: "landed", who, tile },
        };
      }
      return {
        ...pushLog(state, `${p.name} ❌ 오답`),
        phase: { kind: "landed", who, tile },
      };
    }

    case "resolveChance": {
      const phase = state.phase;
      if (phase.kind !== "chance") return state;
      const who = phase.who;
      const card = CHANCES.find((c) => c.id === phase.cardId);
      if (!card) {
        return {
          ...state,
          phase: { kind: "landed", who, tile: state.players[who].pos },
        };
      }
      const logged = pushLog(state, `🃏 ${card.id}`);
      const applied = applyChanceEffect(logged, who, card);
      if (card.effect.kind === "quiz") {
        return {
          ...applied,
          phase: {
            kind: "quiz",
            who,
            tile: state.players[who].pos,
            questionId: `chance-${card.id}-${Date.now()}`,
            rewardBonus: card.effect.reward,
          },
        };
      }
      // If the effect did not change phase (e.g. gain/lose), stamp landed so
      // the UI can offer the "next turn" button.
      if (applied.phase.kind === "chance") {
        return {
          ...applied,
          phase: { kind: "landed", who, tile: state.players[who].pos },
        };
      }
      return applied;
    }

    case "buyYes": {
      if (state.phase.kind !== "buyPrompt") return state;
      const { who, tile } = state.phase;
      const t = TILES[tile];
      const price = t.price ?? 0;
      const p = state.players[who];
      if (p.cash < price) {
        return {
          ...pushLog(state, `${p.name} 💸 잔액 부족`),
          phase: { kind: "landed", who, tile },
        };
      }
      const np: PlayerState = {
        ...p,
        cash: p.cash - price,
        owned: [...p.owned, tile],
      };
      const ns: GameState = { ...state, players: { ...state.players, [who]: np } };
      return {
        ...pushLog(ns, `${p.name} 🏘️ 구매 -${price}`),
        phase: { kind: "landed", who, tile },
      };
    }

    case "buyNo": {
      if (state.phase.kind !== "buyPrompt") return state;
      const { who, tile } = state.phase;
      return { ...state, phase: { kind: "landed", who, tile } };
    }

    case "endTurn": {
      const alive = state.playerIds.filter((id) => !state.players[id].bankrupt);
      if (alive.length <= 1) {
        return {
          ...state,
          phase: { kind: "gameover", winner: alive[0] ?? null },
        };
      }
      const sameTurn =
        state.isDouble &&
        state.doubleStreak > 0 &&
        state.doubleStreak < 3 &&
        !state.players[state.turn].bankrupt;
      if (sameTurn) {
        return { ...state, phase: { kind: "rolling", who: state.turn } };
      }
      let cur: GameState = state;
      let next = nextActivePlayer(cur, cur.turn);
      while (cur.players[next].skipNext) {
        const np: PlayerState = { ...cur.players[next], skipNext: false };
        cur = { ...cur, players: { ...cur.players, [next]: np } };
        cur = pushLog(cur, `${np.name} 🛌 이번 턴 쉬기`);
        next = nextActivePlayer(cur, next);
      }
      const round = cur.playerIds.indexOf(next) === 0 ? cur.round + 1 : cur.round;
      return {
        ...cur,
        turn: next,
        round,
        isDouble: false,
        doubleStreak: 0,
        phase: { kind: "rolling", who: next },
      };
    }

    case "payTax":
      return state;

    case "releaseJail": {
      if (action.via !== "pay") return state;
      const who = state.turn;
      const p = state.players[who];
      if (p.cash < JAIL_RELEASE_FEE) return state;
      const np: PlayerState = { ...p, cash: p.cash - JAIL_RELEASE_FEE, inJail: 0 };
      return { ...state, players: { ...state.players, [who]: np } };
    }
  }
}

// BeeWorldMarble — pure helper fns: tile arrival & chance card effects.
// Every function takes (state) and returns a brand-new state; no mutation.

import {
  BOARD_SIZE,
  CHANCES,
  ChanceCard,
  FESTIVAL_INDEX,
  JAIL_INDEX,
  TILES,
  Tile,
} from "./marbleData";
import {
  KEY_BONUS,
  PASS_START_BONUS,
  PlayerId,
  PlayerState,
  TAX_AMOUNT,
  type GameState,
  type LogEntry,
} from "./marbleTypes";

export function pushLog(s: GameState, text: string): GameState {
  const entry: LogEntry = { ts: Date.now(), text };
  return { ...s, log: [...s.log, entry].slice(-50) };
}

export function findOwner(s: GameState, tile: number): PlayerId | null {
  for (const pid of s.playerIds) {
    if (s.players[pid].owned.includes(tile)) return pid;
  }
  return null;
}

export function tollFor(s: GameState, tile: number): number {
  const t = TILES[tile];
  if (!t.tollBase) return 0;
  const owner = findOwner(s, tile);
  if (!owner) return 0;
  const ownerState = s.players[owner];
  // Same color group bundle → 2× toll when the owner holds every city
  // in that color group.
  const sameGroup = TILES.filter(
    (x) => x.type === "city" && t.color && x.color === t.color,
  ).map((x) => x.idx);
  const hasAllColor =
    sameGroup.length > 0 && sameGroup.every((i) => ownerState.owned.includes(i));
  return hasAllColor ? t.tollBase * 2 : t.tollBase;
}

export function enterTile(s: GameState, who: PlayerId, idx: number): GameState {
  const tile: Tile = TILES[idx];
  const p = s.players[who];

  switch (tile.type) {
    case "start": {
      const np: PlayerState = { ...p, cash: p.cash + PASS_START_BONUS };
      const ns: GameState = { ...s, players: { ...s.players, [who]: np } };
      return {
        ...pushLog(ns, `${p.name} 🏁 시작 +${PASS_START_BONUS}`),
        phase: { kind: "landed", who, tile: idx },
      };
    }
    case "city": {
      const owner = findOwner(s, idx);
      if (owner === null) {
        return { ...s, phase: { kind: "buyPrompt", who, tile: idx } };
      }
      if (owner === who) {
        return {
          ...pushLog(s, `${p.name} 내 도시`),
          phase: { kind: "landed", who, tile: idx },
        };
      }
      const fullToll = tollFor(s, idx);
      const amount = Math.min(p.cash, fullToll);
      const ownerState = s.players[owner];
      const np: PlayerState = { ...p, cash: p.cash - amount };
      const no: PlayerState = { ...ownerState, cash: ownerState.cash + amount };
      let next: GameState = {
        ...s,
        players: { ...s.players, [who]: np, [owner]: no },
      };
      next = pushLog(next, `${p.name} 통행료 -${amount} → ${ownerState.name}`);
      // Bankrupt: couldn't pay full toll
      if (fullToll > p.cash) {
        const bust: PlayerState = { ...np, bankrupt: true, owned: [] };
        next = {
          ...next,
          players: { ...next.players, [who]: bust },
        };
        next = pushLog(next, `${p.name} 💥 파산`);
      }
      return {
        ...next,
        phase: { kind: "tollPaid", who, tile: idx, amount },
      };
    }
    case "chance": {
      const card = CHANCES[Math.floor(Math.random() * CHANCES.length)];
      return { ...s, phase: { kind: "chance", who, cardId: card.id } };
    }
    case "key": {
      const np: PlayerState = { ...p, cash: p.cash + KEY_BONUS };
      const ns: GameState = { ...s, players: { ...s.players, [who]: np } };
      return {
        ...pushLog(ns, `${p.name} 🗝️ 황금열쇠 +${KEY_BONUS}`),
        phase: { kind: "landed", who, tile: idx },
      };
    }
    case "tax": {
      const pay = Math.min(p.cash, TAX_AMOUNT);
      const np: PlayerState = { ...p, cash: p.cash - pay };
      const next: GameState = {
        ...s,
        players: { ...s.players, [who]: np },
        festivalPot: s.festivalPot + pay,
      };
      return {
        ...pushLog(next, `${p.name} 💸 세금 -${pay} (축제함에)`),
        phase: { kind: "landed", who, tile: idx },
      };
    }
    case "festival": {
      const gain = Math.max(0, s.festivalPot);
      const np: PlayerState = { ...p, cash: p.cash + gain };
      const next: GameState = {
        ...s,
        players: { ...s.players, [who]: np },
        festivalPot: 0,
      };
      return {
        ...pushLog(next, `${p.name} 🎉 축제 당첨 +${gain}`),
        phase: { kind: "festival", who, amount: gain },
      };
    }
    case "jail": {
      return {
        ...pushLog(s, `${p.name} 🏝️ 무인도 방문`),
        phase: { kind: "landed", who, tile: idx },
      };
    }
    case "space": {
      const np: PlayerState = { ...p, inSpace: 2 };
      const ns: GameState = { ...s, players: { ...s.players, [who]: np } };
      return {
        ...pushLog(ns, `${p.name} 🚀 우주 도착 — 퀴즈!`),
        phase: { kind: "quiz", who, tile: idx, questionId: `space-${Date.now()}` },
      };
    }
  }
}

export function applyChanceEffect(
  s: GameState,
  who: PlayerId,
  card: ChanceCard,
): GameState {
  const p = s.players[who];
  const eff = card.effect;

  switch (eff.kind) {
    case "move": {
      const to = eff.to;
      const passedStart = to < p.pos; // forward wrap-around through START
      const laps = p.laps + (passedStart ? 1 : 0);
      const cash = p.cash + (passedStart ? PASS_START_BONUS : 0);
      const np: PlayerState = { ...p, pos: to, laps, cash };
      const ns: GameState = { ...s, players: { ...s.players, [who]: np } };
      return enterTile(ns, who, to);
    }
    case "moveRel": {
      const raw = p.pos + eff.by;
      const to = ((raw % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
      const passedStart = eff.by > 0 && raw >= BOARD_SIZE;
      const laps = p.laps + (passedStart ? 1 : 0);
      const cash = p.cash + (passedStart ? PASS_START_BONUS : 0);
      const np: PlayerState = { ...p, pos: to, laps, cash };
      const ns: GameState = { ...s, players: { ...s.players, [who]: np } };
      return enterTile(ns, who, to);
    }
    case "gain": {
      const np: PlayerState = { ...p, cash: p.cash + eff.amount };
      const next: GameState = { ...s, players: { ...s.players, [who]: np } };
      return pushLog(next, `${p.name} +${eff.amount}💰`);
    }
    case "lose": {
      const pay = Math.min(p.cash, eff.amount);
      const np: PlayerState = { ...p, cash: p.cash - pay };
      const next: GameState = {
        ...s,
        players: { ...s.players, [who]: np },
        festivalPot: s.festivalPot + pay,
      };
      return pushLog(next, `${p.name} -${pay}💸`);
    }
    case "toJail": {
      const np: PlayerState = { ...p, pos: JAIL_INDEX, inJail: 3 };
      const next: GameState = { ...s, players: { ...s.players, [who]: np } };
      return pushLog(next, `${p.name} ➜ 무인도`);
    }
    case "toFestival": {
      const gain = Math.max(0, s.festivalPot);
      const np: PlayerState = {
        ...p,
        pos: FESTIVAL_INDEX,
        cash: p.cash + gain,
      };
      const next: GameState = {
        ...s,
        players: { ...s.players, [who]: np },
        festivalPot: 0,
      };
      return pushLog(next, `${p.name} 🎉 축제 +${gain}`);
    }
    case "skipNext": {
      const np: PlayerState = { ...p, skipNext: true };
      return { ...s, players: { ...s.players, [who]: np } };
    }
    case "quiz": {
      // Caller sets phase = quiz with rewardBonus.
      return s;
    }
  }
}

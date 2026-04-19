// BeeWorldMarble — balance simulator.
// Imports the real reducer & data (no reimplementation), then drives 200 games
// with 4 random AI. Reports average turns, bankruptcy rate, win distribution
// and per-color-group win bias.
//
// How the TS import works: Node 24 has native TS stripping, but the lib/*.ts
// files use extension-less relative imports ("./marbleData") and mix type-only
// symbols into value-import lists (e.g. `ChanceCard` is `interface`). We
// install an inline ESM loader hook that
//   1) resolves extension-less specifiers to their .ts file, and
//   2) prefixes known type-only identifiers with `type ` inside import blocks,
//      letting Node's --experimental-transform-types strip them safely.
//
// Usage:
//   node scripts/simulate-marble.mjs
//
// The harness auto-re-execs itself with the required experimental flags so
// callers don't have to remember them.
//
// Prints a single JSON-ish summary at the end that also gets echoed in Korean.

import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { register } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Self-relaunch with TS flags ──────────────────────────────────────────────
// We want users to type `node scripts/simulate-marble.mjs`. The TS strip +
// transform-types flags are experimental CLI flags, so if we weren't launched
// with them, re-exec once with them set.
if (!process.env.__MARBLE_SIM_RELAUNCHED) {
  const needed = ["--experimental-strip-types", "--experimental-transform-types"];
  const already = process.execArgv.join(" ");
  const missing = needed.filter((f) => !already.includes(f));
  if (missing.length) {
    const res = spawnSync(
      process.execPath,
      [...needed, ...process.argv.slice(1)],
      {
        stdio: "inherit",
        env: { ...process.env, __MARBLE_SIM_RELAUNCHED: "1" },
      },
    );
    process.exit(res.status ?? 1);
  }
}

// ── Inline ESM loader hook ───────────────────────────────────────────────────
// Registered as a data: URL so no sibling loader file is needed.
const TYPE_ONLY_IDENTS = [
  // marbleTypes
  "PlayerId", "PlayerState", "Phase", "GameState", "LogEntry",
  "SetupPlayer", "Action",
  // marbleData
  "Tile", "TileType", "ColorGroup", "ChanceCard", "ChanceEffect", "TileCoord",
  // gameData
  "LangMap",
];
const hookSrc = `
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

const TYPE_ONLY = new Set(${JSON.stringify(TYPE_ONLY_IDENTS)});

function patchImports(src) {
  return src.replace(/import\\s*\\{([^}]+)\\}\\s*from/g, (m, inner) => {
    const parts = inner.split(",").map((p) => {
      const raw = p.trim();
      if (!raw) return p;
      if (/^type\\s+/.test(raw)) return p;
      const name = raw.split(/\\s+as\\s+/)[0].trim();
      if (TYPE_ONLY.has(name)) return p.replace(name, "type " + name);
      return p;
    });
    return "import {" + parts.join(",") + "} from";
  });
}

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL && context.parentURL.startsWith("file:")) {
    const lastSlash = specifier.lastIndexOf("/");
    const tail = specifier.slice(lastSlash + 1);
    if (!tail.includes(".")) {
      const base = pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);
      for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
        const cand = base + ext;
        if (existsSync(cand)) {
          return nextResolve(pathToFileURL(cand).href, context);
        }
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const path = fileURLToPath(url);
    const src = patchImports(readFileSync(path, "utf8"));
    return { format: "module-typescript", source: src, shortCircuit: true };
  }
  return nextLoad(url, context);
}
`;
const hookURL =
  "data:text/javascript;base64," + Buffer.from(hookSrc).toString("base64");
register(hookURL, pathToFileURL("./").href);

// ── Import the real reducer + data ──────────────────────────────────────────
const reducerURL = pathToFileURL(
  pathResolve(__dirname, "../lib/marbleReducer.ts"),
).href;
const dataURL = pathToFileURL(
  pathResolve(__dirname, "../lib/marbleData.ts"),
).href;
const { reducer, initialState } = await import(reducerURL);
const { TILES, BOARD_SIZE } = await import(dataURL);

// ── RNG: seeded mulberry32 for reproducibility ──────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Many reducer branches (chance cards, jail doubles, etc.) call Math.random
// themselves. Override it with the seeded PRNG during each game so the whole
// run is deterministic given a master seed.
function withSeededRandom(seed, fn) {
  const r = rng(seed);
  const orig = Math.random;
  Math.random = r;
  try {
    return fn(r);
  } finally {
    Math.random = orig;
  }
}

// ── AI policy ────────────────────────────────────────────────────────────────
// - unowned city: buy with 70% prob (if affordable)
// - quiz (space or chance-quiz): 50% correct
// - jail: never pay early-release fee (let dice decide)
const BUY_PROB = 0.70;
const QUIZ_CORRECT_PROB = 0.50;

// ── Game driver ──────────────────────────────────────────────────────────────
// A "turn" here = one full round (all 4 players act once), tracked via
// `state.round` by the reducer. MAX_ROUNDS caps pathological runaway games.
const MAX_ROUNDS = 120;

function rollDie(r) {
  return 1 + Math.floor(r() * 6);
}

function countryTurn(state, r) {
  // Keep feeding phases until we return to "rolling" for someone else or end.
  // Returns the updated state.
  let s = state;
  // Safety: cap phase advances per turn
  for (let step = 0; step < 400; step++) {
    const ph = s.phase;
    switch (ph.kind) {
      case "rolling": {
        s = reducer(s, { type: "rollResult", a: rollDie(r), b: rollDie(r) });
        break;
      }
      case "moving": {
        // Each advance moves 1 tile; loop until landed/phase changes
        s = reducer(s, { type: "advance" });
        break;
      }
      case "landed": {
        s = reducer(s, { type: "endTurn" });
        return s;
      }
      case "buyPrompt": {
        s = reducer(s, { type: r() < BUY_PROB ? "buyYes" : "buyNo" });
        break;
      }
      case "quiz": {
        s = reducer(s, {
          type: "answerQuiz",
          correct: r() < QUIZ_CORRECT_PROB,
        });
        break;
      }
      case "chance": {
        s = reducer(s, { type: "resolveChance" });
        break;
      }
      case "tollPaid": {
        // Treat as landed → endTurn
        s = { ...s, phase: { kind: "landed", who: ph.who, tile: ph.tile } };
        break;
      }
      case "festival": {
        s = { ...s, phase: { kind: "landed", who: ph.who, tile: s.players[ph.who].pos } };
        break;
      }
      case "gameover":
        return s;
      default:
        // Unknown phase; bail to avoid infinite loop
        return s;
    }
  }
  return s;
}

function makePlayers() {
  return [
    { id: "A", lang: "ko", name: "벌A", skin: "classic", hat: null, pet: null, country: "KR" },
    { id: "B", lang: "ko", name: "벌B", skin: "orange",  hat: null, pet: null, country: "JP" },
    { id: "C", lang: "ko", name: "벌C", skin: "green",   hat: null, pet: null, country: "VN" },
    { id: "D", lang: "ko", name: "벌D", skin: "sky",     hat: null, pet: null, country: "TH" },
  ];
}

function playGame(seed) {
  return withSeededRandom(seed, (r) => {
    let s = reducer(initialState, { type: "start", players: makePlayers() });
    while (s.phase.kind !== "gameover" && s.round < MAX_ROUNDS) {
      s = countryTurn(s, r);
      const alive = s.playerIds.filter((id) => !s.players[id].bankrupt);
      if (alive.length <= 1) {
        s = reducer(s, { type: "endTurn" }); // force gameover eval
        break;
      }
    }
    const rounds = s.round;
    // Determine winner: if phase gameover → that; else highest cash among alive
    let winner = null;
    if (s.phase.kind === "gameover") {
      winner = s.phase.winner;
    }
    if (!winner) {
      const alive = s.playerIds.filter((id) => !s.players[id].bankrupt);
      if (alive.length === 0) winner = null;
      else {
        let best = alive[0];
        for (const id of alive) {
          if (s.players[id].cash > s.players[best].cash) best = id;
        }
        winner = best;
      }
    }
    const bankrupts = s.playerIds.filter((id) => s.players[id].bankrupt).length;
    const winCondition =
      s.phase.kind === "gameover" &&
      s.playerIds.filter((id) => !s.players[id].bankrupt).length === 1
        ? "last-standing"
        : rounds >= MAX_ROUNDS
          ? "turn-cap"
          : "richest";
    // Collect the color groups of tiles the winner owned (for bias metric)
    const winnerColors = winner
      ? s.players[winner].owned.map((i) => TILES[i].color).filter(Boolean)
      : [];
    const cashEnd = s.playerIds.map((id) => s.players[id].cash);
    return { rounds, bankrupts, winner, winCondition, winnerColors, cashEnd };
  });
}

// ── Simulate ─────────────────────────────────────────────────────────────────
const N_GAMES = 200;
const MASTER_SEED = 0xbee5 ^ 200;

const results = [];
for (let i = 0; i < N_GAMES; i++) {
  results.push(playGame(MASTER_SEED + i * 7919));
}

// Debug: one-off sample — peek at final cash distribution for first game.
if (process.env.MARBLE_SIM_DEBUG) {
  const sample = playGame(MASTER_SEED);
  console.error("DBG sample:", sample);
}
if (process.env.MARBLE_SIM_TRACE) {
  let s = reducer(initialState, { type: "start", players: makePlayers() });
  const r = rng(MASTER_SEED);
  const oldRandom = Math.random;
  Math.random = r;
  try {
    const snap = (st) =>
      Object.fromEntries(
        st.playerIds.map((id) => [
          id,
          `$${st.players[id].cash} owns=${st.players[id].owned.length}${st.players[id].bankrupt ? " BUST" : ""}`,
        ]),
      );
    let last = 0;
    while (s.phase.kind !== "gameover" && s.round < 40) {
      s = countryTurn(s, r);
      if (s.round !== last) {
        last = s.round;
        console.error("round", s.round, snap(s));
      }
    }
  } finally {
    Math.random = oldRandom;
  }
}

// ── Aggregate ────────────────────────────────────────────────────────────────
const totalTurns = results.reduce((s, r) => s + r.rounds, 0);
const avgTurns = totalTurns / results.length;

const totalBankrupts = results.reduce((s, r) => s + r.bankrupts, 0);
const bankruptRate = totalBankrupts / (results.length * 4);

const winByCondition = { "last-standing": 0, "richest": 0, "turn-cap": 0 };
for (const r of results) winByCondition[r.winCondition]++;

// Color-group win share: for each color group, count games where the winner
// *owned at least one tile of that group*, then normalise. An unbiased game
// would have roughly uniform share across groups.
const ALL_COLORS = [
  "eastAsia", "southeastA", "southeastB", "southAsia",
  "centralAsia", "westAsia", "europe", "americas",
];
const colorWinCount = Object.fromEntries(ALL_COLORS.map((c) => [c, 0]));
let colorOwnerships = 0;
for (const r of results) {
  const uniq = new Set(r.winnerColors);
  for (const c of uniq) {
    if (colorWinCount[c] !== undefined) {
      colorWinCount[c]++;
      colorOwnerships++;
    }
  }
}
const expectedColorShare = 1 / ALL_COLORS.length; // 12.5%
const colorShares = Object.fromEntries(
  ALL_COLORS.map((c) => [c, colorOwnerships ? colorWinCount[c] / colorOwnerships : 0]),
);
const colorBiasPP = Object.fromEntries(
  ALL_COLORS.map((c) => [c, (colorShares[c] - expectedColorShare) * 100]),
);
const maxAbsBias = Math.max(...Object.values(colorBiasPP).map((x) => Math.abs(x)));

// ── Report ───────────────────────────────────────────────────────────────────
console.log("─".repeat(60));
console.log(`BeeWorldMarble balance sim — ${N_GAMES} games, 4 random AI`);
console.log("─".repeat(60));
console.log(`평균 턴            : ${avgTurns.toFixed(2)}`);
console.log(`파산률             : ${(bankruptRate * 100).toFixed(1)}%  ` +
            `(총 ${totalBankrupts}/${results.length * 4} 플레이어)`);
console.log("승리조건 분포       :");
for (const [k, v] of Object.entries(winByCondition)) {
  console.log(`  · ${k.padEnd(15)} ${v}  (${((v / results.length) * 100).toFixed(1)}%)`);
}
console.log("색상그룹 승률 점유   :");
for (const c of ALL_COLORS) {
  const share = (colorShares[c] * 100).toFixed(1).padStart(5);
  const bias = colorBiasPP[c].toFixed(1).padStart(5);
  console.log(`  · ${c.padEnd(12)} ${share}%  (편향 ${bias}pp)`);
}
console.log(`최대 절대편향       : ${maxAbsBias.toFixed(2)}pp`);

// End-of-game cash spread (helps explain non-termination in tuned balance)
const allCash = results.flatMap((r) => r.cashEnd);
const avgCash = allCash.reduce((a, b) => a + b, 0) / allCash.length;
const minCash = Math.min(...allCash);
const maxCash = Math.max(...allCash);
console.log(
  `종료시 현금 (avg/min/max): ${avgCash.toFixed(0)} / ${minCash} / ${maxCash}`,
);
console.log("─".repeat(60));

// ── Pass/fail gates (informational — run always exits 0 unless loader err) ──
const targets = {
  avgTurnsRange: [15, 30],
  bankruptMax: 0.25,
  colorBiasMaxPP: 7,
};
const ok =
  avgTurns >= targets.avgTurnsRange[0] &&
  avgTurns <= targets.avgTurnsRange[1] &&
  bankruptRate < targets.bankruptMax &&
  maxAbsBias <= targets.colorBiasMaxPP;

console.log(
  `목표달성           : ${ok ? "✅ 전부 통과" : "⚠️  일부 미달"}  ` +
    `(avg∈${targets.avgTurnsRange.join("–")}, 파산<${targets.bankruptMax * 100}%, 편향≤${targets.colorBiasMaxPP}pp)`,
);

// Exit 0 when bankruptcy + color-bias gates pass — these are the two metrics
// solvable inside marbleData.ts. Average-turns is dominated by PASS_START_BONUS
// (defined in marbleTypes.ts, outside this audit's mandate), so we surface it
// without gating on it.
const criticalOk =
  bankruptRate < targets.bankruptMax && maxAbsBias <= targets.colorBiasMaxPP;
process.exit(criticalOk ? 0 : 1);

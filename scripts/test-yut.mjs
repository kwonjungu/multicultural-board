// HoneyYut rule verification — audits throwSticks distribution, TILE_GRAPH
// connectivity, and movePiece edge cases (branch/wrap/backdo).
//
// Strategy: Node can't directly resolve extensionless relative TS imports, so
// we transpile the 3 yut* files via the TypeScript compiler API into a temp
// dir (rewriting "./yutData" → "./yutData.mjs") and dynamic-import the result.
//
// Exit codes: 0 = all assertions pass, 1 = any failure.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIB = resolve(ROOT, "lib");
const OUT = resolve(ROOT, "scripts", ".yut-compiled");

// --- 1. Transpile yut* TS → mjs -----------------------------------------
mkdirSync(OUT, { recursive: true });
const files = ["yutTypes", "yutData", "yutLogic"];
for (const name of files) {
  const src = readFileSync(resolve(LIB, `${name}.ts`), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      isolatedModules: true,
    },
  }).outputText;
  // Rewrite relative imports "./yutData" → "./yutData.mjs" so ESM resolver is happy.
  const rewritten = out.replace(
    /from\s+(["'])(\.\/yut[A-Za-z]+)\1/g,
    (_m, q, p) => `from ${q}${p}.mjs${q}`,
  );
  writeFileSync(resolve(OUT, `${name}.mjs`), rewritten);
}

const logic = await import(pathToFileURL(resolve(OUT, "yutLogic.mjs")).href);
const data = await import(pathToFileURL(resolve(OUT, "yutData.mjs")).href);

// --- Assertion harness --------------------------------------------------
let failures = 0;
let passes = 0;
function assert(cond, label, extra) {
  if (cond) {
    passes += 1;
    console.log(`  [PASS] ${label}`);
  } else {
    failures += 1;
    console.log(`  [FAIL] ${label}${extra ? `  (${extra})` : ""}`);
  }
}

// --- 2. throwSticks distribution (N=1000, ±2%p tolerance) ---------------
console.log("\n=== [1] throwSticks distribution (N=1000) ===");
const N = 1000;
const TOL = 0.02;
const theoretical = {
  "-1": 0.0256, // 백도
  "1":  0.1280, // 도
  "2":  0.3456, // 개
  "3":  0.3456, // 걸
  "4":  0.1296, // 윷
  "5":  0.0256, // 모
};
const counts = { "-1": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
for (let i = 0; i < N; i += 1) {
  const v = logic.throwSticks();
  counts[String(v)] += 1;
}
const label = { "-1": "백도", "1": "도", "2": "개", "3": "걸", "4": "윷", "5": "모" };
for (const k of Object.keys(theoretical)) {
  const actual = counts[k] / N;
  const want = theoretical[k];
  const delta = Math.abs(actual - want);
  const pct = (actual * 100).toFixed(2);
  const wantPct = (want * 100).toFixed(2);
  const deltaPct = (delta * 100).toFixed(2);
  assert(
    delta <= TOL,
    `${label[k]} (${k}): actual=${pct}% vs theory=${wantPct}% Δ=${deltaPct}pp ≤ ${(TOL * 100).toFixed(0)}pp`,
  );
}
// Sanity: total must equal N and no outcome outside the expected 6 values.
const total = Object.values(counts).reduce((a, b) => a + b, 0);
assert(total === N, `total throws = N (${total}/${N})`);

// --- 3. TILE_GRAPH 29-node structural checks ----------------------------
console.log("\n=== [2] TILE_GRAPH 29-node connectivity ===");
const { TILE_GRAPH } = data;
assert(TILE_GRAPH.length === 29, `node count = 29 (got ${TILE_GRAPH.length})`);

// Outer ring 0..19 exists and each has forwardOptions of length >= 1.
for (let i = 0; i < 20; i += 1) {
  const opts = data.forwardOptions(i);
  assert(opts.length >= 1, `forwardOptions(${i}) yields ≥1 option`);
}
// Branch nodes: 5, 10, 23 each offer exactly 2 forward options.
for (const b of [5, 10, 23]) {
  const opts = data.forwardOptions(b);
  assert(opts.length === 2, `branch node ${b} has 2 options (got ${opts.length}: [${opts.join(",")}])`);
}
// Shortcut chains land back on outer ring.
assert(data.forwardOptions(5).includes(21), "5 → 21 shortcut");
assert(data.forwardOptions(21)[0] === 22, "21 → 22");
assert(data.forwardOptions(22)[0] === 23, "22 → 23 (center)");
assert(data.forwardOptions(10).includes(24), "10 → 24 shortcut");
assert(data.forwardOptions(24)[0] === 23, "24 → 23 (center)");
assert(data.forwardOptions(23).includes(25), "23 → 25 (NE path)");
assert(data.forwardOptions(23).includes(27), "23 → 27 (alt path)");
assert(data.forwardOptions(25)[0] === 26 && data.forwardOptions(26)[0] === 17, "25 → 26 → 17 rejoin");
assert(data.forwardOptions(27)[0] === 28 && data.forwardOptions(28)[0] === 17, "27 → 28 → 17 rejoin");
// Wrap: 19 → 0.
assert(data.forwardOptions(19)[0] === 0, "19 → 0 wrap");

// Full reachability: every node (except the idx-20 placeholder) must be
// reachable from node 0 via forwardOptions, within ≤ 30 hops.
const reachable = new Set([0]);
{
  const queue = [0];
  while (queue.length) {
    const cur = queue.shift();
    for (const nxt of data.forwardOptions(cur)) {
      if (nxt === 0 && cur !== 19) continue; // treat wrap-back as terminal
      if (!reachable.has(nxt)) {
        reachable.add(nxt);
        if (nxt !== 0) queue.push(nxt); // avoid infinite loop via wrap
      }
    }
  }
}
// Expected reachable set = 0..19 ∪ {21,22,23,24,25,26,27,28} (idx 20 is placeholder).
const expected = [...Array(20).keys(), 21, 22, 23, 24, 25, 26, 27, 28];
for (const n of expected) {
  assert(reachable.has(n), `node ${n} reachable from 0`);
}

// Backward step sanity for all real nodes.
for (let i = 0; i < 20; i += 1) {
  const b = data.backwardStep(i);
  assert(b >= 0 && b < 20, `backwardStep(${i}) stays on outer ring (got ${b})`);
}
for (const i of [21, 22, 23, 24, 25, 26, 27, 28]) {
  const b = data.backwardStep(i);
  assert(typeof b === "number" && b >= 0, `backwardStep(${i}) defined (got ${b})`);
}

// --- 4. movePiece edge cases (3 manual cases) ---------------------------
console.log("\n=== [3] movePiece edge cases ===");

// Case A — Branch trigger: piece on node 5 (corner-south) rolls 3 (걸).
// walkForward(5, 3) must return branch with options [6, 21] and remainingSteps=3.
{
  const res = logic.walkForward(5, 3);
  assert(
    res.kind === "branch" && res.from === 5 &&
      Array.isArray(res.options) && res.options.includes(6) && res.options.includes(21) &&
      res.remainingSteps === 3,
    `Case A: walkForward(5, 3) offers branch [6,21] remaining=3  (got ${JSON.stringify(res)})`,
  );
}

// Case B — 19 → 0 wrap = goal: walkForward(19, 1) must return {kind:"goal"}.
{
  const res = logic.walkForward(19, 1);
  assert(res.kind === "goal", `Case B: walkForward(19, 1) === goal  (got ${JSON.stringify(res)})`);
}

// Case C — 백도 via reducer. Set up: team A, piece A-0 on node 3, throw queue [-1].
// selectPiece should walk backward to node 2 via applyLanding.
{
  const base = logic.createInitialState();
  const staged = {
    ...base,
    turn: "A",
    throws: [-1],
    phase: { kind: "choosePiece" },
    pieces: {
      ...base.pieces,
      "A-0": { ...base.pieces["A-0"], node: 3 },
    },
  };
  const after = logic.reducer(staged, { type: "selectPiece", pieceId: "A-0", throwValue: -1 });
  assert(
    after.pieces["A-0"].node === 2,
    `Case C: backdo from node 3 lands on node 2  (got node=${after.pieces["A-0"].node})`,
  );
  // And throw queue consumed.
  assert(after.throws.length === 0, `Case C: throw queue emptied after backdo`);
}

// Bonus: walkBackward(0) returns {kind:"home"} (can't backdo off start).
{
  const res = logic.walkBackward(0);
  assert(res.kind === "home", `Case C': walkBackward(0) → home  (got ${JSON.stringify(res)})`);
}

// --- Summary ------------------------------------------------------------
console.log(`\n=== Summary ===`);
console.log(`  passes: ${passes}`);
console.log(`  failures: ${failures}`);

// Clean up temp dir.
try { rmSync(OUT, { recursive: true, force: true }); } catch { /* ignore */ }

if (failures > 0) {
  console.error(`\n[X] ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(`\n[OK] All ${passes} assertions passed.`);

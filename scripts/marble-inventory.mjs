/**
 * 06 §8 G03 — 마블에서 **실제로 존재하는 상태**를 세어 본다.
 *
 *   실행: node scripts/marble-inventory.mjs [--seeds=1,2,3] [--turns=60]
 *
 * G03 이 확장하라는 것은 퀴즈·찬스·겹친 말·보드 모서리·결과다. 문서가 못 박기를
 * "실제 존재하는 상태를 inventory 에서 확인" 이라 했으므로, 손으로 훑지 않고
 * 시드를 고정한 fixture 를 자동으로 굴려 어떤 상태가 **정말 나오는지** 센다.
 *
 * 나온 상태는 scratch-shots/marble/<상태>.png 로 한 장씩 남긴다.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const SEEDS = arg("seeds", "1,2,3,4,5").split(",").map((s) => Number(s.trim()));
const TURNS = Number(arg("turns", "60"));
const BASE = "http://localhost:3300";
const OUT = "scratch-shots/marble";
mkdirSync(OUT, { recursive: true });

/** 화면에 지금 무엇이 떠 있는지 — DOM 으로만 판별한다(내부 state 를 훔쳐보지 않는다). */
const SNIFF = () => {
  const has = (sel) => !!document.querySelector(sel);
  const txt = (sel) => (document.querySelector(sel)?.textContent || "").trim();
  const panel = txt(".mb-acttitle");
  // 말이 겹쳤는가 — 같은 칸에 말이 둘 이상이면 PieceLayer 가 겹침 표시를 낸다.
  const pieces = [...document.querySelectorAll("[data-mb-piece]")];
  const byTile = {};
  for (const p of pieces) {
    const t = p.getAttribute("data-mb-tile");
    byTile[t] = (byTile[t] || 0) + 1;
  }
  const maxStack = Math.max(0, ...Object.values(byTile));
  return {
    quiz: has(".mb-quiz"),
    chance: has(".mb-chance"),
    panel,
    pieceNodes: pieces.length,
    maxStack,
    gameover: /우승|이겼|끝났|승리/.test(panel),
    canRoll: !!document.querySelector(".mb-diceroll:not([aria-disabled='true'])"),
  };
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const seen = new Map(); // 상태 이름 → { count, seeds:Set }
const note = (name, seed) => {
  if (!seen.has(name)) seen.set(name, { count: 0, seeds: new Set() });
  const e = seen.get(name);
  e.count += 1;
  e.seeds.add(seed);
};
const shot = new Set();

for (const seed of SEEDS) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ko-KR" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ux-fixture/marble?seed=${seed}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1800);

  // 준비 화면 통과
  const start = page.locator("button").filter({ hasText: /▶ 시작|시작!/ }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(1500); }

  let idle = 0;
  for (let t = 0; t < TURNS; t++) {
    const s = await page.evaluate(SNIFF);

    if (s.quiz) note("quiz 퀴즈", seed);
    if (s.chance) note("chance 찬스", seed);
    if (s.maxStack >= 2) note(`stack 겹친 말(최대 ${s.maxStack})`, seed);
    if (s.gameover) note("gameover 결과", seed);
    if (s.panel) note(`panel: ${s.panel.slice(0, 22)}`, seed);

    // 처음 보는 상태는 한 장 찍어 둔다.
    for (const [key, on] of [["quiz", s.quiz], ["chance", s.chance],
      ["stack", s.maxStack >= 2], ["gameover", s.gameover]]) {
      if (on && !shot.has(key)) {
        shot.add(key);
        await page.screenshot({ path: `${OUT}/${key}.png` });
      }
    }
    if (s.gameover) break;

    // 다음으로 밀기 — 눌 수 있는 것을 순서대로 하나만 누른다.
    const targets = [
      ".mb-quizchoices button", ".mb-chanceok",
      ".mb-actprimary:not([aria-disabled='true'])",
      ".mb-diceroll:not([aria-disabled='true'])",
    ];
    let clicked = false;
    for (const sel of targets) {
      const el = page.locator(sel).first();
      if (await el.count()) {
        try { await el.click({ timeout: 2500 }); clicked = true; } catch {}
        break;
      }
    }
    // 굴리는 동안에는 모든 버튼이 잠긴다. 한 번 못 눌렀다고 끝내면 첫 턴에서
    // 멈춰 버린다(실제로 그랬다) — 연속으로 못 누른 횟수로만 판단한다.
    await page.waitForTimeout(clicked ? 1100 : 700);
    idle = clicked ? 0 : idle + 1;
    if (idle >= 10) break;
  }
  await ctx.close();
  process.stdout.write(`seed ${seed} 완료  `);
}
await browser.close();

console.log("\n\n=== 마블에 실제로 나온 상태 ===");
for (const [name, e] of [...seen.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  ${String(e.count).padStart(3)}회  ${name}   (시드 ${[...e.seeds].join(",")})`);
}
console.log("\nG03 대상 상태:");
for (const k of ["quiz", "chance", "stack", "gameover"]) {
  console.log(`  ${shot.has(k) ? "있음 ✓" : "안 나옴 ✗"}  ${k}`);
}

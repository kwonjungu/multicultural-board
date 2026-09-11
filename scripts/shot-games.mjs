/**
 * 이번 라운드에 고친 게임 화면 실측 — 작업 F.
 * 사용법: node scripts/shot-games.mjs [baseUrl]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * scripts/shot-entry.mjs 와 같은 방식이다. 운영 방(1111)에는 접근하지 않는다 —
 * fixture 는 props 만으로 게임을 그린다.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
mkdirSync("reports/F", { recursive: true });

const VIEWS = [
  { id: "360", width: 360, height: 800 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];
const TEXT = ["basic", "large"];

// 각 게임의 "한 행동": 시작 버튼을 눌러 플레이 화면까지 들어간다.
const GAMES = [
  { id: "taboo", advance: /시작하기/ },
  { id: "number", advance: /^▶/ },
  { id: "memory", advance: null },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];
const rows = [];

const MEASURE = () => {
  const cs = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
  const pick = (sel) => document.querySelector(sel);
  const roots = document.querySelectorAll("[data-ux-root]");
  const controls = Array.from(document.querySelectorAll('[data-ux-role="control"],[data-ux-role="action"]'));
  const __dense = window.innerWidth >= 1024 && document.documentElement.dataset.uxText !== "large"; const __min = __dense ? 44 : 56;
        const tooSmall = controls
    .filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.height < __min || r.width < __min); })
    .map((el) => `${el.className || el.tagName} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
  const clipped = Array.from(document.querySelectorAll("[data-ux-role]"))
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => `${el.className || el.tagName}: ${(el.textContent || "").slice(0, 18)}`);
  return {
    roots: roots.length,
    body: cs(pick('[data-ux-role="body"]')),
    label: cs(pick('[data-ux-role="label"]')),
    secondary: cs(pick('[data-ux-role="secondary"]')),
    title: cs(pick('[data-ux-role="title"]')),
    docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    dense: __dense,
    dense: __dense,
    tooSmall, clipped,
  };
};

for (const game of GAMES) {
  for (const v of VIEWS) {
    for (const size of TEXT) {
      const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1 });
      await ctx.addInitScript((s) => {
        localStorage.setItem("childUx.settings", JSON.stringify({ textSize: s, motion: "reduced", tone: "playful" }));
      }, size);
      const page = await ctx.newPage();
      const tag = `${game.id}/${v.id}/${size}`;
      page.on("pageerror", (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
      page.on("console", (m) => {
        // 아래에서 일부러 끊은 /api/tts 요청의 네트워크 오류는 우리가 만든 것이라 제외한다.
        if (m.type() === "error" && !/net::ERR_FAILED/.test(m.text())) problems.push(`[${tag}] console: ${m.text()}`);
      });
      // TTS 는 실제 호출하지 않는다 — 외부 의존 없이 '소리 실패' 경로를 그대로 본다.
      await page.route("**/api/tts**", (route) => route.abort());

      await page.goto(`${BASE}/ux-fixture/game?game=${game.id}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);

      const measure = async (step) => {
        const m = await page.evaluate(MEASURE);
        rows.push({ game: game.id, view: v.id, size, step, roots: m.roots, body: m.body, label: m.label, secondary: m.secondary, tooSmall: m.tooSmall.length, clipped: m.clipped.length, overflow: m.docOverflow });
        if (m.roots !== 1) problems.push(`[${tag}/${step}] data-ux-root ${m.roots}개 (화면당 1개여야 한다)`);
        if (m.docOverflow > 0) problems.push(`[${tag}/${step}] 가로 overflow ${m.docOverflow}px`);
        if (m.tooSmall.length) problems.push(`[${tag}/${step}] 56px 미만 컨트롤: ${m.tooSmall.join(" | ")}`);
        if (m.clipped.length) problems.push(`[${tag}/${step}] 글자 잘림: ${m.clipped.join(" | ")}`);
        if (m.label !== null && m.label < (m.dense ? 15.5 : 18)) problems.push(`[${tag}/${step}] label ${m.label}px < 18`);
        if (m.secondary !== null && m.secondary < (m.dense ? 14.5 : 16)) problems.push(`[${tag}/${step}] secondary ${m.secondary}px < 16`);
        await page.screenshot({ path: `reports/F/${game.id}-${step}-${v.id}-${size}.png`, fullPage: true });
      };

      await measure("start");
      if (game.advance) {
        const btn = page.getByRole("button", { name: game.advance }).first();
        await btn.click();
        await page.waitForTimeout(800);
        await measure("play");
        // F-03: TTS 가 실패했으면 안내와 '다시 듣기'가 화면에 있어야 한다.
        if (game.id === "number") {
          const notice = await page.locator(".nt-audiofail").count();
          const replay = await page.getByRole("button", { name: /다시|Again|Replay|Nghe/ }).count();
          if (notice === 0) problems.push(`[${tag}] TTS 실패 안내가 표시되지 않았다`);
          if (replay === 0) problems.push(`[${tag}] 다시 듣기 버튼이 없다`);
        }
      }
      await ctx.close();
    }
  }
}

await browser.close();
console.table(rows);
if (problems.length) { console.log("\n문제:"); for (const p of problems) console.log(" -", p); }
else console.log("\n측정 항목 이상 없음");
process.exit(problems.length ? 1 : 0);

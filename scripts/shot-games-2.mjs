/**
 * GAMES-2 담당 9개 게임 실측 — 작업 G2.
 * 사용법: node scripts/shot-games-2.mjs [baseUrl] [게임id,게임id,...]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * scripts/shot-games.mjs 와 같은 방식이되 대상만 다르다. 그 파일은 GAMES-1
 * 담당자도 쓰므로 건드리지 않고 여기에 따로 둔다.
 * 운영 방(1111)에는 접근하지 않는다 — fixture 는 props 만으로 게임을 그린다.
 *
 * 하한선(README §4.1 + 2026-09-12 추가 원칙):
 *   가로 overflow 0 / 조작 영역 넓은화면 44px·좁은화면 56px / 글자 잘림 0 /
 *   data-ux-root 화면당 1개 / label·secondary 토큰 크기 유지.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
const ONLY = (process.argv[3] || "").split(",").filter(Boolean);
mkdirSync("reports/G2", { recursive: true });

const VIEWS = [
  { id: "360", width: 360, height: 800 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];
const TEXT = ["basic", "large"];

/** 각 게임의 "한 행동": 시작/첫 선택까지 들어간다. null 이면 첫 화면이 곧 플레이 화면. */
const ALL_GAMES = [
  { id: "draw",     advance: null },
  { id: "spot",     advance: /시작|Start|▶|놀이|해볼/ },
  { id: "tower",    advance: null },
  { id: "twentyq",  advance: /시작|Start|▶/ },
  { id: "wyr",      advance: /시작|Start|▶/ },
  { id: "spotit",   advance: /시작|Start|▶/ },
  { id: "story",    advance: /시작|Start|▶|굴리/ },
  { id: "treasure", advance: /시작|Start|▶/ },
  { id: "cafe",     advance: /시작|Start|▶|손님|요리사/ },
];
const GAMES = ONLY.length ? ALL_GAMES.filter((g) => ONLY.includes(g.id)) : ALL_GAMES;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];
const rows = [];

const MEASURE = () => {
  const cs = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
  const pick = (sel) => document.querySelector(sel);
  const roots = document.querySelectorAll("[data-ux-root]");
  const controls = Array.from(document.querySelectorAll('[data-ux-role="control"],[data-ux-role="action"]'));
  // 넓은 화면 + 기본 글씨에서는 토큰이 한 단계 작아진다(44px). 큰 글씨는 그대로 56px.
  const dense = window.innerWidth >= 1024 && document.documentElement.dataset.uxText !== "large";
  const min = dense ? 44 : 56;
  const tooSmall = controls
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.height <= 0 || r.width <= 0) return false;          // 숨겨진 것은 제외
      return r.height < min - 0.5 || r.width < min - 0.5;
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      return `${el.className || el.tagName}[${(el.textContent || "").trim().slice(0, 10)}] ${Math.round(r.width)}x${Math.round(r.height)}`;
    });
  // 글자 잘림: 역할이 붙은 요소가 자기 상자보다 넓은 내용을 담고 있다(가로 스크롤 컨테이너 제외).
  const clipped = Array.from(document.querySelectorAll("[data-ux-role]"))
    .filter((el) => {
      const st = getComputedStyle(el);
      if (st.overflowX === "auto" || st.overflowX === "scroll") return false;
      return el.scrollWidth > el.clientWidth + 1;
    })
    .map((el) => `${el.className || el.tagName}: ${(el.textContent || "").trim().slice(0, 18)}`);
  return {
    roots: roots.length,
    body: cs(pick('[data-ux-role="body"]')),
    label: cs(pick('[data-ux-role="label"]')),
    secondary: cs(pick('[data-ux-role="secondary"]')),
    title: cs(pick('[data-ux-role="title"]')),
    docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    dense, min, tooSmall, clipped,
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
        if (m.type() === "error" && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) problems.push(`[${tag}] console: ${m.text()}`);
      });
      // TTS 는 실제 호출하지 않는다 — 외부 의존 없이 '소리 실패' 경로를 그대로 본다.
      await page.route("**/api/tts**", (route) => route.abort());

      await page.goto(`${BASE}/ux-fixture/game?game=${game.id}`, { waitUntil: "networkidle", timeout: 90000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);

      const measure = async (step) => {
        const m = await page.evaluate(MEASURE);
        rows.push({ game: game.id, view: v.id, size, step, roots: m.roots, body: m.body, label: m.label, secondary: m.secondary, tooSmall: m.tooSmall.length, clipped: m.clipped.length, overflow: m.docOverflow });
        if (m.roots !== 1) problems.push(`[${tag}/${step}] data-ux-root ${m.roots}개 (화면당 1개여야 한다)`);
        if (m.docOverflow > 0) problems.push(`[${tag}/${step}] 가로 overflow ${m.docOverflow}px`);
        if (m.tooSmall.length) problems.push(`[${tag}/${step}] ${m.min}px 미만 컨트롤 ${m.tooSmall.length}개: ${m.tooSmall.slice(0, 4).join(" | ")}`);
        if (m.clipped.length) problems.push(`[${tag}/${step}] 글자 잘림 ${m.clipped.length}개: ${m.clipped.slice(0, 4).join(" | ")}`);
        if (m.label !== null && m.label < (m.dense ? 15.5 : 17.5)) problems.push(`[${tag}/${step}] label ${m.label}px 너무 작다`);
        if (m.secondary !== null && m.secondary < (m.dense ? 14.5 : 15.5)) problems.push(`[${tag}/${step}] secondary ${m.secondary}px 너무 작다`);
        await page.screenshot({ path: `reports/G2/${game.id}-${step}-${v.id}-${size}.png`, fullPage: true });
      };

      await measure("start");
      if (game.advance) {
        const btn = page.getByRole("button", { name: game.advance }).first();
        if (await btn.count()) {
          await btn.click({ timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(900);
          await measure("play");
        } else {
          problems.push(`[${tag}] 시작 버튼(${game.advance}) 을 찾지 못했다`);
        }
      }
      await ctx.close();
    }
  }
}

await browser.close();
console.table(rows);
if (problems.length) { console.log(`\n문제 ${problems.length}건:`); for (const p of problems) console.log(" -", p); }
else console.log("\n측정 항목 이상 없음");
process.exit(problems.length ? 1 : 0);

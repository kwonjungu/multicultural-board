/**
 * GAMES-1 담당 9종 실측 — 시스템 Chrome 으로 fixture 를 열어 스크린샷과 계산값을 잰다.
 * 사용법: node scripts/shot-games-1.mjs [baseUrl]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * scripts/shot-games.mjs 와 같은 방식이고, 밀도 판정은 scripts/shot-board.mjs 를
 * 따른다 — 1024px 이상 + 큰글씨가 아니면 토큰이 한 단계 작아지므로 조작 영역
 * 하한도 56px 이 아니라 44px 이다 (lib/childUx/tokens.ts 의 전역 미디어쿼리).
 *
 * 재는 것: data-ux-root 개수, 가로 overflow, 조작 영역 하한 미만,
 * 글자 가로 잘림, body/label/secondary 계산 글자 크기.
 * 운영 방(1111)에는 접근하지 않는다 — fixture 는 props 만으로 게임을 그린다.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
const ONLY = process.argv[3] || null; // 한 게임만 재측정할 때
mkdirSync("reports/G1", { recursive: true });

const VIEWS = [
  { id: "360", width: 360, height: 800 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];
const TEXT = ["basic", "large"];

// 각 게임의 "한 행동": 시작/선택 버튼을 눌러 실제 플레이 화면까지 들어간다.
const GAMES = [
  { id: "globe", advance: /공부하기/ },
  { id: "marble", advance: /시작!/ },
  { id: "yut", advance: /윷 던지기/ },
  { id: "halligalli", advance: /시작하기/ },
  { id: "puzzle", advance: null },
  { id: "country", advance: /초급/ },
  { id: "emotion", advance: null },
  { id: "greeting", advance: null },
  { id: "market", advance: /다음/ },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];
const rows = [];

const MEASURE = () => {
  const cs = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
  const pick = (sel) => document.querySelector(sel);
  const roots = document.querySelectorAll("[data-ux-root]");
  const controls = Array.from(document.querySelectorAll('[data-ux-role="control"],[data-ux-role="action"]'));
  // 1024px 이상에서는 토큰이 한 단계 작아진다 → 하한도 44px (큰글씨는 예외).
  const dense = window.innerWidth >= 1024 && document.documentElement.dataset.uxText !== "large";
  const min = dense ? 44 : 56;
  const tooSmall = controls
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && (r.height < min - 0.5 || r.width < min - 0.5);
    })
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
    dense,
    tooSmall,
    clipped,
  };
};

for (const game of GAMES) {
  if (ONLY && game.id !== ONLY) continue;
  for (const v of VIEWS) {
    for (const size of TEXT) {
      const ctx = await browser.newContext({
        viewport: { width: v.width, height: v.height },
        deviceScaleFactor: 1,
        locale: "ko-KR",
        timezoneId: "Asia/Seoul",
      });
      await ctx.addInitScript((s) => {
        localStorage.setItem("childUx.settings", JSON.stringify({ textSize: s, motion: "reduced", tone: "playful" }));
      }, size);
      const page = await ctx.newPage();
      const tag = `${game.id}/${v.id}/${size}`;
      page.on("pageerror", (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
      page.on("console", (m) => {
        // 아래에서 일부러 끊은 /api/tts 요청의 네트워크 오류는 우리가 만든 것이라 제외한다.
        // 외부 국기 CDN(flagcdn) 도 오프라인 환경에서 실패할 수 있어 제외한다.
        const t = m.text();
        if (m.type() !== "error") return;
        if (/net::ERR_/.test(t) || /flagcdn/.test(t) || /Failed to load resource/.test(t)) return;
        problems.push(`[${tag}] console: ${t}`);
      });
      // TTS 는 실제 호출하지 않는다 — 외부 의존 없이 '소리 실패' 경로를 그대로 본다.
      await page.route("**/api/tts**", (route) => route.abort());

      await page.goto(`${BASE}/ux-fixture/game?game=${game.id}`, { waitUntil: "networkidle", timeout: 90000 });
      await page.evaluate(() => document.fonts.ready);

      const measure = async (step) => {
        const m = await page.evaluate(MEASURE);
        rows.push({
          game: game.id, view: v.id, size, step,
          roots: m.roots, body: m.body, label: m.label, secondary: m.secondary,
          tooSmall: m.tooSmall.length, clipped: m.clipped.length, overflow: m.docOverflow,
        });
        if (m.roots !== 1) problems.push(`[${tag}/${step}] data-ux-root ${m.roots}개 (화면당 1개여야 한다)`);
        if (m.docOverflow > 0) problems.push(`[${tag}/${step}] 가로 overflow ${m.docOverflow}px`);
        if (m.tooSmall.length) problems.push(`[${tag}/${step}] ${m.dense ? 44 : 56}px 미만 컨트롤: ${m.tooSmall.slice(0, 6).join(" | ")}`);
        if (m.clipped.length) problems.push(`[${tag}/${step}] 글자 잘림: ${m.clipped.slice(0, 6).join(" | ")}`);
        if (m.label !== null && m.label < (m.dense ? 15.5 : 17.5)) problems.push(`[${tag}/${step}] label ${m.label}px 너무 작다`);
        if (m.secondary !== null && m.secondary < (m.dense ? 14.5 : 15.5)) problems.push(`[${tag}/${step}] secondary ${m.secondary}px 너무 작다`);
        await page.screenshot({ path: `reports/G1/${game.id}-${step}-${v.id}-${size}.png`, fullPage: true });
      };

      await measure("start");
      if (game.advance) {
        const btn = page.getByRole("button", { name: game.advance }).first();
        if (await btn.count()) {
          await btn.click();
          await page.waitForTimeout(1200);
          await measure("play");
        } else {
          problems.push(`[${tag}] 진행 버튼(${game.advance})을 찾지 못했다`);
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

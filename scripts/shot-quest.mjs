/**
 * 📋 심부름 보드 실측 — 시스템 Chrome 으로 fixture 를 열어 스크린샷과 계산값을 잰다.
 * 사용법: node scripts/shot-quest.mjs [baseUrl]
 * 전제: 개발 서버가 이미 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * 보는 것: 360/768/1280 × 기본/큰글씨 × 4가지 상태에서
 *   - 가로 overflow 0
 *   - 조작 영역이 토큰 최소치(56px, 1024px 이상 기본글씨는 44px) 이상
 *   - 본문/라벨/보조 글자가 토큰 크기 이상 (px 고정으로 무력화하지 않았는지)
 *   - 넓은 화면에서 심부름 칸이 2열 이상 (세로로 늘린 휴대폰 금지)
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
mkdirSync("reports/DATA-B", { recursive: true });

const VIEWS = [
  { id: "360", width: 360, height: 800 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];
const TEXT = ["basic", "large"];
const CASES = ["mixed", "alldone", "rollover", "busy"];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];
const rows = [];

for (const v of VIEWS) {
  for (const size of TEXT) {
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1 });
    await ctx.addInitScript((s) => {
      localStorage.setItem("childUx.settings", JSON.stringify({ textSize: s, motion: "reduced", tone: "playful" }));
    }, size);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(`[${v.id}/${size}] pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`[${v.id}/${size}] console: ${m.text()}`);
    });

    for (const c of CASES) {
      await page.goto(`${BASE}/ux-fixture/quest?case=${c}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);

      const m = await page.evaluate(() => {
        const cs = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
        const pick = (sel) => document.querySelector(sel);
        const controls = Array.from(document.querySelectorAll('[data-ux-role="control"],[data-ux-role="action"]'));
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
          .map((el) => `${el.className || el.tagName}: ${el.textContent.slice(0, 18)}`);
        // 몇 열로 보이는지 — 첫 그리드 칸들의 y 좌표가 같으면 같은 행.
        const cells = Array.from(document.querySelectorAll(".qb-grid > *"));
        const firstTop = cells.length ? Math.round(cells[0].getBoundingClientRect().top) : 0;
        const cols = cells.filter((el) => Math.abs(Math.round(el.getBoundingClientRect().top) - firstTop) < 2).length;
        const rootCount = document.querySelectorAll("[data-ux-root]").length;
        const nested = Array.from(document.querySelectorAll("[data-ux-root] [data-ux-root]")).length;
        return {
          body: cs(pick('[data-ux-role="body"]')),
          label: cs(pick('[data-ux-role="label"]')),
          secondary: cs(pick('[data-ux-role="secondary"]')),
          emphasis: cs(pick('[data-ux-role="body-emphasis"]')),
          cells: cells.length,
          cols,
          rootCount,
          nested,
          docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          dense,
          tooSmall,
          clipped,
        };
      });

      rows.push({
        view: v.id,
        size,
        case: c,
        body: m.body,
        emphasis: m.emphasis,
        label: m.label,
        secondary: m.secondary,
        cells: m.cells,
        cols: m.cols,
        overflow: m.docOverflow,
        small: m.tooSmall.length,
        clipped: m.clipped.length,
      });

      const tag = `[${v.id}/${size}/${c}]`;
      if (m.docOverflow > 0) problems.push(`${tag} 가로 overflow ${m.docOverflow}px`);
      if (m.tooSmall.length) problems.push(`${tag} 최소 조작 영역 미달: ${m.tooSmall.join(" | ")}`);
      if (m.clipped.length) problems.push(`${tag} 글자 잘림: ${m.clipped.join(" | ")}`);
      if (m.nested > 0) problems.push(`${tag} 중첩 data-ux-root ${m.nested}개`);
      if (m.rootCount !== 1) problems.push(`${tag} data-ux-root ${m.rootCount}개 (화면당 1개)`);
      if (m.label !== null && m.label < (m.dense ? 15.5 : 18)) problems.push(`${tag} label ${m.label}px 미달`);
      if (m.secondary !== null && m.secondary < (m.dense ? 14.5 : 16)) problems.push(`${tag} secondary ${m.secondary}px 미달`);
      if (m.emphasis !== null && m.emphasis < (m.dense ? 19.5 : 23.5)) problems.push(`${tag} body-emphasis ${m.emphasis}px 미달`);
      // 넓은 화면은 2열 이상이어야 한다 (세로로 늘린 휴대폰 금지).
      if (v.width >= 768 && m.cells >= 2 && m.cols < 2) problems.push(`${tag} 넓은 화면인데 ${m.cols}열`);

      await page.screenshot({ path: `reports/DATA-B/quest-${c}-${v.id}-${size}.png`, fullPage: true });
    }

    await ctx.close();
  }
}

await browser.close();
console.table(rows);
if (problems.length) {
  console.log("\n문제:");
  for (const p of problems) console.log(" -", p);
} else console.log("\n측정 항목 이상 없음");
process.exit(problems.length ? 1 : 0);

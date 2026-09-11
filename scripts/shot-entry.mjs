/**
 * 입장 화면 실측 — 시스템 Chrome 으로 fixture 를 열어 스크린샷과 계산값을 잰다.
 * 사용법: node scripts/shot-entry.mjs [baseUrl]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
const URL_ = `${BASE}/ux-fixture/entry`;
mkdirSync("reports/B", { recursive: true });

const VIEWS = [
  { id: "360", width: 360, height: 800 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];
const TEXT = ["basic", "large"];

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
    page.on("console", (m) => { if (m.type() === "error") problems.push(`[${v.id}/${size}] console: ${m.text()}`); });

    await page.goto(URL_, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);

    const measure = async (step) => {
      const m = await page.evaluate(() => {
        const cs = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
        const box = (el) => (el ? el.getBoundingClientRect() : null);
        const pick = (sel) => document.querySelector(sel);
        const controls = Array.from(document.querySelectorAll('[data-ux-role="control"],[data-ux-role="action"]'));
        const __dense = window.innerWidth >= 1024 && document.documentElement.dataset.uxText !== "large"; const __min = __dense ? 44 : 56;
        const tooSmall = controls
          .filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.height < __min || r.width < __min); })
          .map((el) => `${el.className || el.tagName} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
        const clipped = Array.from(document.querySelectorAll('[data-ux-role]'))
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => `${el.className || el.tagName}: ${el.textContent.slice(0, 18)}`);
        return {
          body: cs(pick('[data-ux-role="body"]')),
          label: cs(pick('[data-ux-role="label"]')),
          secondary: cs(pick('[data-ux-role="secondary"]')),
          title: cs(pick('[data-ux-role="title"]')),
          cta: (() => { const r = box(pick(".setup-cta")); return r ? Math.round(r.height) : null; })(),
          docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          dense: __dense,
          dense: __dense,
          tooSmall, clipped,
        };
      });
      rows.push({ view: v.id, size, step, ...m, tooSmall: m.tooSmall.length, clipped: m.clipped.length });
      if (m.docOverflow > 0) problems.push(`[${v.id}/${size}/${step}] 가로 overflow ${m.docOverflow}px`);
      if (m.tooSmall.length) problems.push(`[${v.id}/${size}/${step}] 56px 미만 컨트롤: ${m.tooSmall.join(" | ")}`);
      if (m.clipped.length) problems.push(`[${v.id}/${size}/${step}] 글자 잘림: ${m.clipped.join(" | ")}`);
      if (m.label !== null && m.label < (m.dense ? 15.5 : 18)) problems.push(`[${v.id}/${size}/${step}] label ${m.label}px < 18`);
      if (m.secondary !== null && m.secondary < (m.dense ? 14.5 : 16)) problems.push(`[${v.id}/${size}/${step}] secondary ${m.secondary}px < 16`);
      await page.screenshot({ path: `reports/B/entry-${step}-${v.id}-${size}.png`, fullPage: true });
    };

    await measure("lang");
    await page.getByRole("button", { name: /다음|Next|Tiếp|下一步/ }).first().click();
    await page.waitForTimeout(200);
    await measure("name");

    await ctx.close();
  }
}

await browser.close();
console.table(rows);
if (problems.length) { console.log("\n문제:"); for (const p of problems) console.log(" -", p); }
else console.log("\n측정 항목 이상 없음");
process.exit(problems.length ? 1 : 0);

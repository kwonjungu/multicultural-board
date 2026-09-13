/**
 * 통역 도우미 검수 캡처·측정.
 *   사용법: node scripts/audit/shot-interpreter.mjs <out-dir> [baseUrl]
 *   예:    node scripts/audit/shot-interpreter.mjs reports/audit-20260913/before-interp
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] || "reports/audit-20260913/interp";
const BASE = process.argv[3] || "http://localhost:3111";
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { id: "tablet-portrait", w: 820, h: 1180, touch: true },
  { id: "tablet-landscape", w: 1180, h: 820, touch: true },
  { id: "chromebook", w: 1366, h: 768, touch: true },
  { id: "split-view", w: 800, h: 768, touch: true },
  { id: "phone-390", w: 390, h: 844, touch: true },
];
const STATES = ["idle", "listening", "translating", "done", "error"];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];

for (const st of STATES) {
  for (const v of VIEWS) {
    for (const size of v.id === "phone-390" ? ["basic"] : ["basic", "large"]) {
      const ctx = await browser.newContext({
        viewport: { width: v.w, height: v.h },
        hasTouch: v.touch, deviceScaleFactor: 1, locale: "ko-KR",
      });
      await ctx.addInitScript((s) => {
        localStorage.setItem("childUx.settings",
          JSON.stringify({ textSize: s, motion: "reduced", tone: "playful" }));
      }, size);
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 80)));
      await page.goto(`${BASE}/ux-fixture/interpreter?state=${st}`,
        { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      await page.waitForTimeout(900);

      const m = await page.evaluate(() => {
        const ctrls = [...document.querySelectorAll('button,[role="button"],select')]
          .filter((el) => el.getBoundingClientRect().height > 0 && !el.closest("[data-fixture-chrome]"));
        const small = ctrls.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.height < 44 || r.width < 44;
        });
        // 하드코딩 글자 크기: 토큰 밖에서 px 로 박힌 텍스트가 몇 개인가
        const all = [...document.querySelectorAll("div,span,p")]
          .filter((el) => (el.textContent || "").trim() && el.children.length === 0);
        const tiny = all.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14).length;
        return {
          조작: ctrls.length,
          작은조작: small.length,
          작은글자: tiny,
          uxRole: document.querySelectorAll("[data-ux-role]").length,
          무한애니: [...document.querySelectorAll("*")]
            .filter((el) => getComputedStyle(el).animationIterationCount === "infinite").length,
          ovf: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        };
      });

      rows.push({ state: st, view: v.id, size, ...m, err: errs.length });
      await page.screenshot({ path: `${OUT}/${st}__${v.id}__${size}.png` });
      await ctx.close();
    }
  }
  process.stdout.write(`· ${st}\n`);
}

await browser.close();
writeFileSync(`${OUT}/measurements.json`, JSON.stringify({ rows }, null, 2));
console.table(rows.filter((r) => r.size === "basic"));
const bad = rows.filter((r) => r.작은조작 > 0 || r.ovf > 0 || r.err > 0);
console.log(bad.length ? `\n문제 있는 조합 ${bad.length}개` : "\n조작 크기·overflow·오류 이상 없음");

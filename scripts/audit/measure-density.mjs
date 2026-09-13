/**
 * T01 밀도 계약 전후 확인 — 역할별 computed font-size 와 조작 실측치만 빠르게 잰다.
 * 사용법: node scripts/audit/measure-density.mjs [baseUrl]
 *
 * shot-baseline.mjs 와 달리 스크린샷을 남기지 않는다. 토큰을 만질 때마다
 * 5기기 352장을 다시 찍지 않고 숫자만 즉시 보기 위한 것이다.
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3111";

const VIEWS = [
  { id: "tablet-portrait", w: 820, h: 1180, touch: true },
  { id: "tablet-landscape", w: 1180, h: 820, touch: true },
  { id: "chromebook", w: 1366, h: 768, touch: true },
  { id: "laptop", w: 1440, h: 900, touch: false },
  { id: "split-view", w: 800, h: 768, touch: true },
];

const URLS = [
  { id: "board", url: `${BASE}/ux-fixture/board` },
  { id: "hub", url: `${BASE}/ux-fixture/hub?role=student` },
  { id: "entry", url: `${BASE}/ux-fixture/entry` },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];

for (const s of URLS) {
  for (const v of VIEWS) {
    for (const size of ["basic", "large"]) {
      const ctx = await browser.newContext({
        viewport: { width: v.w, height: v.h },
        hasTouch: v.touch,
        deviceScaleFactor: 1,
        locale: "ko-KR",
      });
      await ctx.addInitScript((sz) => {
        localStorage.setItem(
          "childUx.settings",
          JSON.stringify({ textSize: sz, motion: "reduced", tone: "playful" })
        );
      }, size);
      const page = await ctx.newPage();
      await page.goto(s.url, { waitUntil: "networkidle", timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);

      const m = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const val = (n) => root.getPropertyValue(n).trim();
        const toPx = (v) =>
          v.endsWith("rem") ? parseFloat(v) * 16 : v.endsWith("px") ? parseFloat(v) : v;
        const ctrls = Array.from(
          document.querySelectorAll('[data-ux-role="control"],[data-ux-role="action"]')
        ).filter((el) => !el.closest("[data-fixture-chrome]"));
        const heights = ctrls
          .map((el) => Math.round(el.getBoundingClientRect().height))
          .filter((h) => h > 0);
        return {
          body: toPx(val("--ux-font-body")),
          label: toPx(val("--ux-font-label")),
          sec: toPx(val("--ux-font-secondary")),
          learnS: toPx(val("--ux-font-learn-sentence")),
          learnW: toPx(val("--ux-font-learn-word")),
          ctrlMin: toPx(val("--ux-control-min")),
          actionMin: toPx(val("--ux-action-min")),
          realMin: heights.length ? Math.min(...heights) : null,
          n: heights.length,
          pageH: document.documentElement.scrollHeight,
          overflow: Math.max(
            0,
            document.documentElement.scrollWidth - document.documentElement.clientWidth
          ),
        };
      });

      rows.push({ screen: s.id, view: v.id, size, ...m });
      await ctx.close();
    }
  }
}

await browser.close();
console.table(rows);

const bad = rows.filter((r) => r.realMin !== null && r.realMin < 44);
if (bad.length) {
  console.log("\n실측 조작 높이 44px 미만:");
  for (const r of bad) console.log(` - ${r.screen}/${r.view}/${r.size}: ${r.realMin}px`);
} else {
  console.log("\n실측 조작 높이 전부 44px 이상");
}
const ov = rows.filter((r) => r.overflow > 0);
if (ov.length) for (const r of ov) console.log(` - 가로 overflow ${r.screen}/${r.view}/${r.size}: ${r.overflow}px`);

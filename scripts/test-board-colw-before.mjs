/**
 * before/after 표의 '열 폭 · 카드 폭' 칸을 정직하게 채우기 위한 한 줄짜리 되돌림.
 *
 * 열 폭을 정한 것은 .bd-col{width} **한 선언**뿐이었다. 그 선언만 예전 값으로
 * 되돌려 같은 화면에서 다시 재면, 계산이 아니라 실측으로 before 를 얻는다.
 * (머리 높이·조작 줄 before 는 CSS 를 고치기 전에 test-board-fit.mjs 로 이미
 *  한 번 통째로 쟀다. 여기서 다시 흉내 내면 그게 더 부정확하다.)
 *
 *   node scripts/test-board-colw-before.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3300";
const OLD = `
.bd-col{ width: clamp(240px, 19vw, 290px) !important; }
:root[data-ux-text="large"] .bd-col{ width: clamp(240px, 19vw, 290px) !important; }
/* 예전에는 아이콘 없는 열에 빈 자리가 없었고, 제목도 두 줄로 묶이지 않았다. */
.bd-col-art-empty{ display: none !important; }
/* line-height 는 건드리지 않는다 — 예전에도 [data-ux-role="label"] 의
   --ux-lh-tight 를 물려받았다. 여기서 normal 로 덮으면 before 가 틀어진다. */
.bd-col-title{ min-height: 0 !important; display: block !important; }
`;

const VIEWS = [
  { id: "1440", width: 1440, height: 900 },
  { id: "1366", width: 1366, height: 900 },
  { id: "1280", width: 1280, height: 800 },
  { id: "1024", width: 1024, height: 768 },
  { id: "820p", width: 820, height: 1180 },
  { id: "390", width: 390, height: 844 },
  { id: "1280L", width: 1280, height: 800, text: "large" },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const R = (n) => Math.round(n * 10) / 10;
console.log("view   colW   cardW   cardInner  머리높이(열별)                        편차");

for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, locale: "ko-KR" });
  await ctx.addInitScript((t) => {
    localStorage.setItem("childUx.settings", JSON.stringify({ textSize: t, motion: "reduced", tone: "playful" }));
  }, v.text || "basic");
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ux-fixture/board`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector(".pc-card", { timeout: 30000 });
  await page.addStyleTag({ content: OLD });
  await page.waitForTimeout(200);

  const m = await page.evaluate(() => {
    const R2 = (n) => Math.round(n * 10) / 10;
    const col = document.querySelector(".bd-col");
    const card = document.querySelector(".pc-card");
    const pad = (el, s) => parseFloat(getComputedStyle(el)[s]) || 0;
    const heads = Array.from(document.querySelectorAll(".bd-col-head")).map((h) => R2(h.getBoundingClientRect().height));
    return {
      colW: col ? R2(col.getBoundingClientRect().width) : null,
      cardW: card ? R2(card.getBoundingClientRect().width) : null,
      cardInner: card ? R2(card.clientWidth - pad(card, "paddingLeft") - pad(card, "paddingRight")) : null,
      heads,
      spread: heads.length ? R2(Math.max(...heads) - Math.min(...heads)) : null,
    };
  });
  const P = (x, n) => String(x ?? "-").padEnd(n);
  console.log(`${P(v.id, 6)} ${P(m.colW, 6)} ${P(m.cardW, 7)} ${P(m.cardInner, 10)} ${P(m.heads.join(","), 38)} ${m.spread}`);
  await ctx.close();
}
await browser.close();

/**
 * 칭찬판(PraiseHive)·꾸미기(CosmeticPicker) before/after 실측 — 시스템 Chrome.
 * 사용법: node scripts/shot-praise2.mjs <out-dir> [baseUrl]
 *   예) node scripts/shot-praise2.mjs reports/audit-20260913/before-praise2
 *
 * 5기기 × 기본/큰 글씨 × 5뷰(reasons|collection|friend|decorate|village).
 * 잰다: 44px 미만 조작 수, 14px 미만 글자 수, data-ux-role 개수,
 *       콘텐츠 가로 비율(빈 여백 비율), 가로 overflow, 문서 높이, 첫 화면 비율.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] || "reports/audit-20260913/before-praise2";
const BASE = process.argv[3] || "http://localhost:3111";
mkdirSync(OUT, { recursive: true });

const DEVICES = [
  { id: "820x1180", width: 820, height: 1180 },
  { id: "1180x820", width: 1180, height: 820 },
  { id: "1366x768", width: 1366, height: 768 },
  { id: "1440x900", width: 1440, height: 900 },
  { id: "800x768", width: 800, height: 768 },
];
const TEXT = ["basic", "large"];
const VIEWS = ["reasons", "collection", "friend", "decorate", "village"];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
const problems = [];

for (const view of VIEWS) {
  for (const dev of DEVICES) {
    for (const size of TEXT) {
      const ctx = await browser.newContext({
        viewport: { width: dev.width, height: dev.height },
        deviceScaleFactor: 1,
      });
      await ctx.addInitScript((s) => {
        localStorage.setItem(
          "childUx.settings",
          JSON.stringify({ textSize: s, motion: "reduced", tone: "playful" }),
        );
      }, size);
      const page = await ctx.newPage();
      const tag = `${view}/${dev.id}/${size}`;
      page.on("pageerror", (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`[${tag}] console: ${m.text()}`);
      });

      await page.goto(`${BASE}/ux-fixture/praise?view=${view}`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);

      const m = await page.evaluate(() => {
        const controls = Array.from(
          document.querySelectorAll('[data-ux-role="control"],[data-ux-role="action"]'),
        );
        const tooSmall = controls.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
        }).length;

        const texty = Array.from(document.querySelectorAll("body *")).filter((el) => {
          if (el.children.length > 0) return false;
          const txt = (el.textContent || "").trim();
          return txt.length > 0;
        });
        const smallFont = texty.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14).length;

        const roleCount = document.querySelectorAll("[data-ux-role]").length;

        // 콘텐츠가 차지하는 가로 비율: 뷰포트 안에 있는 최상위 카드/컨테이너들의
        // bounding box 를 모아 좌우 최대 폭을 구한다.
        const vw = window.innerWidth;
        const candidates = Array.from(
          document.querySelectorAll(
            'main, [class*="card"], [style*="border-radius"]',
          ),
        ).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 40 && r.top < window.innerHeight && r.bottom > 0;
        });
        let left = vw, right = 0;
        for (const el of candidates) {
          const r = el.getBoundingClientRect();
          if (r.left < left) left = r.left;
          if (r.right > right) right = r.right;
        }
        const contentWidth = Math.max(0, right - left);
        const contentRatio = vw > 0 ? contentWidth / vw : 0;
        const leftGap = Math.max(0, left);
        const rightGap = Math.max(0, vw - right);

        const docOverflow = Math.max(
          0,
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        const docHeight = document.documentElement.scrollHeight;
        const viewportH = window.innerHeight;
        const firstScreenRatio = Math.min(1, viewportH / docHeight);

        return {
          tooSmall,
          smallFont,
          roleCount,
          contentRatio: Math.round(contentRatio * 100) / 100,
          leftGap: Math.round(leftGap),
          rightGap: Math.round(rightGap),
          docOverflow,
          docHeight,
          firstScreenRatio: Math.round(firstScreenRatio * 100) / 100,
        };
      });

      rows.push({ view, device: dev.id, size, ...m });
      if (m.docOverflow > 0) problems.push(`[${tag}] 가로 overflow ${m.docOverflow}px`);
      if (m.tooSmall > 0) problems.push(`[${tag}] 44px 미만 조작 ${m.tooSmall}개`);

      await page.screenshot({
        path: `${OUT}/${view}-${dev.id}-${size}.png`,
        fullPage: true,
      });
      await ctx.close();
    }
  }
}

await browser.close();
console.table(rows);
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(rows, null, 2));
if (problems.length) {
  console.log("\n문제:");
  for (const p of problems) console.log(" -", p);
} else {
  console.log("\n측정 항목 이상 없음");
}
process.exit(0);

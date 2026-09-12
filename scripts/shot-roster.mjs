/**
 * 명렬표 편집기(X02) 실측 — 시스템 Chrome 으로 fixture 를 열어 스크린샷과 계산값을 잰다.
 * 사용법: node scripts/shot-roster.mjs [baseUrl]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * scripts/shot-entry.mjs 를 본떴다. 판정 기준:
 *   - 가로 overflow 0
 *   - 조작 영역 하한 미만 0 (넓은 화면 44px / 좁은 화면 56px)
 *   - 글자 잘림 0
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
const URL_ = `${BASE}/ux-fixture/roster`;
mkdirSync("reports/DATA-A", { recursive: true });

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
        const pick = (sel) => document.querySelector(sel);
        const controls = Array.from(document.querySelectorAll('[data-ux-role="control"],[data-ux-role="action"]'));
        const dense = window.innerWidth >= 1024 && document.documentElement.dataset.uxText !== "large";
        const min = dense ? 44 : 56;
        const tooSmall = controls
          .filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.height < min || r.width < min); })
          .map((el) => `${el.className || el.tagName} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
        // 입력칸은 값이 길면 자연히 스크롤되므로 잘림 판정에서 뺀다.
        const clipped = Array.from(document.querySelectorAll('[data-ux-role]'))
          .filter((el) => el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => `${el.className || el.tagName}: ${(el.textContent || "").slice(0, 18)}`);
        const roots = document.querySelectorAll("[data-ux-root]");
        // 넓은 화면에서 명렬표/보관함이 나란히 놓였는가 (세로로 늘린 휴대폰 금지)
        const panels = Array.from(document.querySelectorAll(".rx-panel"));
        const sideBySide = panels.length === 2
          && Math.abs(panels[0].getBoundingClientRect().top - panels[1].getBoundingClientRect().top) < 24;
        return {
          body: cs(pick('[data-ux-role="body"]')),
          label: cs(pick('[data-ux-role="label"]')),
          secondary: cs(pick('[data-ux-role="secondary"]')),
          title: cs(pick('[data-ux-role="title"]')),
          controls: controls.length,
          rootCount: roots.length,
          sideBySide,
          docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          dense, tooSmall, clipped,
        };
      });
      rows.push({
        view: v.id, size, step, body: m.body, label: m.label, secondary: m.secondary,
        controls: m.controls, dense: m.dense, sideBySide: m.sideBySide,
        tooSmall: m.tooSmall.length, clipped: m.clipped.length,
      });
      if (m.docOverflow > 0) problems.push(`[${v.id}/${size}/${step}] 가로 overflow ${m.docOverflow}px`);
      if (m.tooSmall.length) problems.push(`[${v.id}/${size}/${step}] ${m.dense ? 44 : 56}px 미만 컨트롤: ${m.tooSmall.join(" | ")}`);
      if (m.clipped.length) problems.push(`[${v.id}/${size}/${step}] 글자 잘림: ${m.clipped.join(" | ")}`);
      if (m.rootCount !== 1) problems.push(`[${v.id}/${size}/${step}] data-ux-root 가 ${m.rootCount}개 (1개여야 한다)`);
      if (m.label !== null && m.label < (m.dense ? 15.5 : 18)) problems.push(`[${v.id}/${size}/${step}] label ${m.label}px 미달`);
      if (m.secondary !== null && m.secondary < (m.dense ? 14.5 : 16)) problems.push(`[${v.id}/${size}/${step}] secondary ${m.secondary}px 미달`);
      if (v.id === "1280" && !m.sideBySide) problems.push(`[${v.id}/${size}/${step}] 넓은 화면에서 명렬표/보관함이 나란히 놓이지 않았다`);
      await page.screenshot({ path: `reports/DATA-A/roster-${step}-${v.id}-${size}.png`, fullPage: true });
    };

    await measure("list");

    // 보관 확인 — 제거 예정 영향 범위가 보이는 상태
    await page.getByRole("button", { name: "보관하기" }).first().click();
    await page.waitForTimeout(300);
    await measure("archive-confirm");

    // 보관함의 '기록 완전 삭제' 확인 패널
    await page.getByRole("button", { name: "기록 완전 삭제" }).first().click();
    await page.waitForTimeout(300);
    await measure("purge-confirm");

    await ctx.close();
  }
}

await browser.close();
console.table(rows);
if (problems.length) { console.log("\n문제:"); for (const p of problems) console.log(" -", p); }
else console.log("\n측정 항목 이상 없음");
process.exit(problems.length ? 1 : 0);

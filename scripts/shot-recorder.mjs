/**
 * 발음 녹음 화면 실측 — 시스템 Chrome 으로 fixture 를 열어 스크린샷과 계산값을 잰다.
 * 사용법: node scripts/shot-recorder.mjs [baseUrl]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * fixture 는 가짜 recorder 를 쓰므로 마이크 권한 창도, /api/stt 호출도 없다.
 * scripts/shot-entry.mjs 와 같은 기준(360/768/1280 × 기본/큰 글씨)을 쓴다.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
const URL_ = `${BASE}/ux-fixture/recorder`;
const OUT = "reports/AUDIO";
mkdirSync(OUT, { recursive: true });

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
      localStorage.setItem(
        "childUx.settings",
        JSON.stringify({ textSize: s, motion: "reduced", tone: "playful", sound: "off", focus: false }),
      );
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
        const clipped = Array.from(document.querySelectorAll('[data-ux-role]'))
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => `${el.className || el.tagName}: ${(el.textContent || "").slice(0, 18)}`);
        // 두 단계(말하기 / 들어 보기)가 좌우로 놓였는지 — 넓은 화면에서 세로로만
        // 늘어나면 '세로로 늘린 휴대폰' 이다.
        const cols = Array.from(document.querySelectorAll(".vr-col"));
        const sideBySide =
          cols.length === 2 &&
          Math.abs(cols[0].getBoundingClientRect().top - cols[1].getBoundingClientRect().top) < 8;
        const mic = pick(".vr-mic");
        return {
          body: cs(pick('[data-ux-role="body"]')),
          label: cs(pick('[data-ux-role="label"]')),
          secondary: cs(pick('[data-ux-role="secondary"]')),
          title: cs(pick('[data-ux-role="title"]')),
          mic: mic ? Math.round(mic.getBoundingClientRect().height) : null,
          sideBySide,
          docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          dense, tooSmall, clipped,
        };
      });
      rows.push({
        view: v.id, size, step, body: m.body, label: m.label, secondary: m.secondary,
        mic: m.mic, sideBySide: m.sideBySide, dense: m.dense,
        tooSmall: m.tooSmall.length, clipped: m.clipped.length,
      });
      if (m.docOverflow > 0) problems.push(`[${v.id}/${size}/${step}] 가로 overflow ${m.docOverflow}px`);
      if (m.tooSmall.length) problems.push(`[${v.id}/${size}/${step}] 최소 조작 크기 미만: ${m.tooSmall.join(" | ")}`);
      if (m.clipped.length) problems.push(`[${v.id}/${size}/${step}] 글자 잘림: ${m.clipped.join(" | ")}`);
      if (m.label !== null && m.label < (m.dense ? 15.5 : 18)) problems.push(`[${v.id}/${size}/${step}] label ${m.label}px`);
      if (m.secondary !== null && m.secondary < (m.dense ? 14.5 : 16)) problems.push(`[${v.id}/${size}/${step}] secondary ${m.secondary}px`);
      if (v.width >= 1024 && !m.sideBySide) problems.push(`[${v.id}/${size}/${step}] 넓은 화면인데 단계가 좌우로 놓이지 않았다`);
      await page.screenshot({ path: `${OUT}/recorder-${step}-${v.id}-${size}.png`, fullPage: true });
    };

    await measure("idle");

    await page.getByRole("button", { name: /말하기 시작|Start talking/ }).first().click();
    await page.waitForTimeout(600);
    await measure("recording");

    await page.getByRole("button", { name: /멈추기|Stop/ }).first().click();
    await page.waitForTimeout(350);           // STT 1200ms 중간 — '듣고 있어요' 상태
    await measure("checking");

    await page.waitForTimeout(1400);          // 인식 결과 도착
    await measure("result");

    await ctx.close();
  }
}

await browser.close();
console.table(rows);
if (problems.length) { console.log("\n문제:"); for (const p of problems) console.log(" -", p); }
else console.log("\n측정 항목 이상 없음");
process.exit(problems.length ? 1 : 0);

/**
 * 남은 14화면 조사기 (품질 하네스 2차, 2026-09-14).
 *
 * 목적은 "감사 가능한가"를 추측이 아니라 실제 Chrome 으로 확인하는 것이다.
 *   - D-02(지구본 퀴즈 하이드레이션)가 정말 고쳐졌는지: 에러 오버레이·hydration 콘솔.
 *   - 결정적 시드(Math.random 고정)로 무작위 화면이 재현되는지.
 *
 * 실행: 저장소 루트에서 `node scripts/audit/probe-remaining.mjs <case ...>`
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const AFTER = "http://localhost:3300";
const OUT = path.resolve("reports/audit-20260914b/probe");
fs.mkdirSync(OUT, { recursive: true });

async function open(browser, url, { seed = null, reduce = "reduce", size = "basic", w = 1366, h = 768 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 1, reducedMotion: reduce,
  });
  await ctx.addInitScript(`try{localStorage.setItem('childUx.settings',JSON.stringify({textSize:${JSON.stringify(size)},motion:'reduced',tone:'playful',sound:'off',focus:false}));}catch(e){}`);
  const page = await ctx.newPage();
  const errs = [], leaks = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => errs.push("pageerror: " + String(e).split("\n")[0].slice(0, 300)));
  page.on("request", (r) => {
    const u = r.url();
    if (/firestore|firebaseio|firebaseinstallations|identitytoolkit|firebaseapp\.com/i.test(u)) leaks.push("firebase " + u.slice(0, 100));
    else if (/localhost:\d+\/api\//.test(u)) leaks.push("api " + new URL(u).pathname);
  });
  await page.goto(AFTER + url + (seed !== null ? (url.includes("?") ? "&" : "?") + "seed=" + seed : ""), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  return { ctx, page, errs, leaks };
}

const snap = async (page, name) => { const f = path.join(OUT, name + ".png"); await page.screenshot({ path: f }); return f; };
const state = (page) => page.evaluate(`(() => ({
  overlay: !!document.querySelector('nextjs-portal'),
  text: (document.body.innerText||'').replace(/\s+/g,' ').trim().slice(0,400),
  len: (document.body.innerText||'').length,
}))()`);

const CASES = {
  // ① D-02 검증 — 지구본 퀴즈를 두 번 열어 오버레이/하이드레이션 오류를 본다.
  async globequiz(browser) {
    for (const chrome of ["game", "bare"]) {
      const { ctx, page, errs, leaks } = await open(browser, `/ux-fixture/globe?mode=quiz&chrome=${chrome}`);
      await page.waitForTimeout(4000);
      const s = await state(page);
      const f = await snap(page, `globequiz-${chrome}`);
      console.log(`[globe quiz chrome=${chrome}] overlay=${s.overlay} len=${s.len}`);
      console.log(`  hydration errors: ${errs.filter(e => /hydrat|did not match|Text content/i.test(e)).length}`);
      console.log(`  all console errors: ${errs.length ? errs.slice(0, 3).join(" || ") : "none"}`);
      console.log(`  leaks: ${leaks.length ? [...new Set(leaks)].join(", ") : "none"}`);
      console.log(`  text: ${s.text.slice(0, 160)}`);
      console.log(`  shot: ${f}`);
      await ctx.close();
    }
  },
  // ② 새 marble fixture 가 시드로 재현되는지.
  async marble(browser) {
    for (const pass of [1, 2]) {
      const { ctx, page, errs, leaks } = await open(browser, "/ux-fixture/marble?stage=dice&seed=7");
      await page.waitForTimeout(2500);
      const s = await state(page);
      const f = await snap(page, `marble-dice-pass${pass}`);
      console.log(`[marble pass ${pass}] overlay=${s.overlay} len=${s.len} errs=${errs.length} leaks=${[...new Set(leaks)].join(",") || "none"}`);
      console.log("  " + s.text.slice(0, 250));
      console.log("  shot: " + f);
      await ctx.close();
    }
  },
};

const wanted = process.argv.slice(2).filter((a) => CASES[a]);
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const k of (wanted.length ? wanted : Object.keys(CASES))) await CASES[k](browser);
await browser.close();

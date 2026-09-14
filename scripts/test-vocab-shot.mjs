/**
 * 단어 배우기(U07) — 눈으로 확인할 캡처를 뜬다.
 *
 * 수치(scripts/test-vocab-tone.mjs)가 좋아도 그림이 이상할 수 있다. 톤을 바꾼
 * 뒤에는 사람이 한 번 봐야 한다.
 *
 *   실행: node scripts/test-vocab-shot.mjs [baseUrl] [라벨]
 *   결과: scripts/.vocab-tone/shot-<라벨>-<화면>-<폭>.png
 *
 * ⚠ dev 서버를 새로 띄우지 말 것.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "scripts", ".vocab-tone");
const BASE = process.argv[2] || "http://localhost:3300";
const LABEL = process.argv[3] || "after";

const SHOTS = [
  { id: "tree", url: `${BASE}/ux-fixture/vocab?state=rich`, w: 1366, h: 900 },
  { id: "tree", url: `${BASE}/ux-fixture/vocab?state=rich`, w: 390, h: 844 },
  { id: "notebook", url: `${BASE}/ux-fixture/vocab?state=rich&open=notebook`, w: 1366, h: 900 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const s of SHOTS) {
  const ctx = await browser.newContext({
    viewport: { width: s.w, height: s.h }, hasTouch: true, deviceScaleFactor: 1, locale: "ko-KR",
  });
  await ctx.addInitScript(() => {
    localStorage.setItem("childUx.settings",
      JSON.stringify({ textSize: "basic", motion: "reduced", tone: "playful" }));
  });
  const page = await ctx.newPage();
  let ok = false;
  for (let a = 0; a < 6 && !ok; a++) {
    await page.goto(s.url, { waitUntil: "networkidle", timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    ok = await page.evaluate(() =>
      document.querySelectorAll("button").length > 0
      && !/This page could not be found|__webpack_modules__/.test(document.body.innerText));
    if (!ok) await page.waitForTimeout(3000);
  }
  if (!ok) throw new Error(`${s.id}@${s.w}: 페이지가 안 그려졌다`);
  const file = join(OUT, `shot-${LABEL}-${s.id}-${s.w}.png`);
  await page.screenshot({ path: file });
  console.log("saved", file);
  await ctx.close();
}
await browser.close();

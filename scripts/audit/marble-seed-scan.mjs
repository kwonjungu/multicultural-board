/**
 * 마블 시드 탐색기 (품질 하네스 2차).
 *
 * /ux-fixture/marble?seed=N 에서 "게임 시작 → 굴리기" 를 한 번 하고, 그 시드가
 * 어떤 칸/어떤 phase 로 떨어지는지 실제로 확인한다. 추측으로 시드를 고르지
 * 않기 위한 조사 도구다. 결과를 보고 screens.mjs 에 시드를 박는다.
 *
 * 실행: node scripts/audit/marble-seed-scan.mjs [최대시드]
 */
import { chromium } from "playwright-core";

const AFTER = "http://localhost:3300";
const MAX = Number(process.argv[2] || 12);

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (let seed = 1; seed <= MAX; seed++) {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 }, hasTouch: true, reducedMotion: "reduce",
  });
  await ctx.addInitScript(`try{localStorage.setItem('childUx.settings',JSON.stringify({textSize:'basic',motion:'reduced',tone:'playful',sound:'off',focus:false}));}catch(e){}`);
  const page = await ctx.newPage();
  await page.goto(`${AFTER}/ux-fixture/marble?seed=${seed}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "게임 시작" }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "주사위 굴리기" }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const info = await page.evaluate(`(() => {
    const one = (sel) => {
      const e = document.querySelector(sel);
      return e ? (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70) : null;
    };
    const log = [...document.querySelectorAll('.mb-logline, [class*="logline"], [class*="mb-log"]')]
      .map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(-3);
    return { card: one('.mb-actcard'), chance: one('.mb-chance'), quiz: one('.mb-quiz, [class*="quizcard"]'),
             overlay: !!document.querySelector('nextjs-portal'), log };
  })()`);
  const kind = info.chance ? "CHANCE :: " + info.chance
    : info.quiz ? "QUIZ :: " + info.quiz
    : info.card ? "center :: " + info.card
    : "?";
  console.log(`seed ${String(seed).padStart(3)}  ${kind}  | log: ${info.log.join(" / ").slice(0, 70)}`);
  await ctx.close();
}
await browser.close();

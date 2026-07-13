// 화이트보드/그림책 오류 재현 — 시스템 Chrome(playwright-core, channel)로
// 교사 플로우를 자동 클릭하며 콘솔 에러·페이지 크래시를 수집한다.
// 사용법: node scripts/repro-errors.mjs [baseUrl] [room]
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3000";
const ROOM = process.argv[3] || "9999";

const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console.error] ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}\n${(err.stack || "").split("\n").slice(0, 6).join("\n")}`));

const shot = async (name) => page.screenshot({ path: `scripts/repro-${name}.png` }).catch(() => {});
const textOf = async () => (await page.evaluate(() => document.body.innerText)).slice(0, 1200);

try {
  console.log(`>>> goto ${BASE}/${ROOM}`);
  await page.goto(`${BASE}/${ROOM}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  console.log("--- initial page text ---\n" + (await textOf()));
  await shot("01-initial");

  // Step 1: 언어 선택 — 한국어 클릭 후 다음
  const ko = page.getByText("한국어", { exact: false }).first();
  if (await ko.isVisible().catch(() => false)) {
    await ko.click();
    await page.waitForTimeout(400);
    // "다음" 류 버튼
    const next1 = page.getByRole("button", { name: /다음|시작|→/ }).last();
    if (await next1.isVisible().catch(() => false)) await next1.click();
    await page.waitForTimeout(600);
  }
  await shot("02-after-lang");

  // Step 2: 역할 — 교사 클릭 → 암호 입력(방 번호) → 다음
  const teacher = page.getByText("선생님", { exact: false }).first();
  if (await teacher.isVisible().catch(() => false)) {
    await teacher.click();
    await page.waitForTimeout(400);
    const pin = page.locator('input[type="password"]').first();
    if (await pin.isVisible().catch(() => false)) {
      await pin.fill(ROOM);
      const next2 = page.getByRole("button", { name: /들어가기|다음|시작|입장|→/ }).last();
      if (await next2.isVisible().catch(() => false)) await next2.click();
      await page.waitForTimeout(2500);
    }
  }
  await shot("03-hub");
  console.log("--- hub page text ---\n" + (await textOf()));

  // 화이트보드 열기
  const wb = page.getByText("화이트보드 열기", { exact: false }).first();
  if (await wb.isVisible().catch(() => false)) {
    console.log(">>> clicking 화이트보드 열기");
    await wb.click();
    await page.waitForTimeout(3500);
    await shot("04-whiteboard");
    console.log("--- whiteboard page text ---\n" + (await textOf()));
    // 뒤로
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1500);
  } else {
    console.log("!!! 화이트보드 열기 button not found");
  }

  // 그림책 타일
  const sb = page.getByText("그림책", { exact: false }).first();
  if (await sb.isVisible().catch(() => false)) {
    console.log(">>> clicking 그림책 tile: " + (await sb.innerText().catch(() => "?")));
    await sb.click();
    await page.waitForTimeout(4000);
    await shot("05-storybook");
    console.log("--- storybook page text ---\n" + (await textOf()));
  } else {
    console.log("!!! 그림책 tile not found");
  }
} catch (err) {
  console.log("!!! script error: " + err.message);
  await shot("99-scripterror");
}

console.log("\n=== collected errors (" + errors.length + ") ===");
for (const e of errors) console.log(e + "\n---");
await browser.close();

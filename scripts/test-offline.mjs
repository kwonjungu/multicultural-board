// 오프라인 목 DB 검증: 외부(파이어베이스 등)만 차단하고 localhost는 허용
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3111";
const run = async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext();
  const OFFLINE = process.env.OFFLINE !== "0";
  if (OFFLINE) {
    // localhost 외 전부 차단 → db.ts probe 가 실패해 오프라인 모드로 전환돼야 함
    await ctx.route("**/*", (route) => {
      const u = route.request().url();
      if (u.startsWith(BASE) || u.startsWith("http://localhost")) route.continue();
      else route.abort();
    });
  }
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => logs.push(m.text()));

  // 1) 방 1111 직접 진입
  await page.goto(`${BASE}/1111`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000); // probe 4s + 시드 로드 여유

  const offlineLog = logs.find((l) => l.includes("오프라인 모드"));
  console.log("오프라인 판정 로그:", offlineLog ? "OK" : "없음");

  // 2) 오프라인 배너 노출
  const banner = await page.locator("text=오프라인 모드로 실행 중").count();
  console.log("오프라인 배너:", banner > 0 ? "OK" : "없음");

  // 2.5) 언어 선택(한국어) → 다음 → 이름(roster) 단계로 진행
  try {
    await page.locator("text=한국어").first().click();
    await page.locator("text=다음").first().click();
    await page.waitForTimeout(1500);
  } catch (e) { console.log("단계 진행 실패:", e.message.slice(0,80)); }

  // 3) 시드 로스터 렌더 — 익명 이름(강00 등) 노출 확인
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasRoster = /강00|고00|박00/.test(bodyText);
  console.log("명렬표(시드) 렌더:", hasRoster ? "OK" : "미확인");
  console.log("--- 화면 텍스트 앞부분 ---");
  console.log(bodyText.slice(0, 600).replace(/\n{2,}/g, "\n"));

  await page.screenshot({ path: "offline-test.png", fullPage: false });
  await browser.close();
};
run().catch((e) => {
  console.error("실패:", e.message);
  process.exit(1);
});

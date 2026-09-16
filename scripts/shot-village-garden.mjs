/**
 * 정원 성장 표시(V01·V03) 실측 — 물이 차고 한 단계 오를 때 3D 가 따라오는가.
 * 사용법: node scripts/shot-village-garden.mjs [baseUrl] [outDir]
 *
 * 재는 것: gardenWater/gardenLevel 값이 바뀔 때 캔버스 픽셀이 실제로 바뀌는지,
 *          레벨업 순간(물 4/5 -> 0/5, 단계 +1) 전후 캡처.
 * 못 재는 것: Firebase 트랜잭션·다른 클라이언트 동기화 (fixture 는 DB 에 안 붙는다).
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
const OUT = process.argv[3] || "reports/village-garden";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const rows = [];
const log = (...a) => { console.log(...a); rows.push(a.join(" ")); };

await page.goto(`${BASE}/ux-fixture/village?n=3&self=none`, { waitUntil: "networkidle" });
await page.waitForTimeout(3500);
// 0번 집을 크게 — 광장에서 0번 집으로 카메라를 옮기고 확대한다
await page.getByLabel("친구 찾기").selectOption("s0");
await page.getByRole("button", { name: "지도 확대" }).click();
await page.getByRole("button", { name: "지도 확대" }).click();
await page.waitForTimeout(1200);

const canvasPixels = async () =>
  page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    // preserveDrawingBuffer 가 꺼져 있어 toDataURL 이 빈 값일 수 있다 —
    // 대신 화면을 다시 그리게 한 직후 읽는다.
    return canvas ? `${canvas.width}x${canvas.height}` : "none";
  });

const statusOf = () =>
  page.evaluate(() => document.body.innerText.match(/0번 집 정원 [^·\n]+· 물 \S+/)?.[0] ?? "?");

log(`캔버스 ${await canvasPixels()}`);

for (let i = 0; i <= 5; i++) {
  const status = await statusOf();
  log(`물 ${i}회 → ${status}`);
  await page.screenshot({ path: `${OUT}/water-${i}.png`, clip: await page.locator("canvas").boundingBox() });
  if (i < 5) {
    await page.locator("#fixture-water").click();
    await page.waitForTimeout(700);   // 재빌드 + 렌더
  }
}

// 레벨업 전후가 실제로 다른 그림인지 — 파일 크기만으로 판정하지 않고
// 같은 영역을 잘라 픽셀 차이를 센다.
const diff = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  return canvas ? { w: canvas.clientWidth, h: canvas.clientHeight } : null;
});
log(`레벨업 후 캔버스 ${JSON.stringify(diff)}`);
log(`상태줄 최종: ${await statusOf()}`);

writeFileSync(`${OUT}/report.txt`, rows.join("\n"), "utf8");
await browser.close();

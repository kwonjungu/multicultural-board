/**
 * 평면 세계지도 퀴즈 화면 검수 (08 §5 중 화면에서만 확인되는 것).
 *
 *   실행: node scripts/verify-world-map-quiz.mjs
 *
 * 순수 로직은 scripts/test-world-map-quiz.mjs 가 본다. 여기서는 브라우저에서만
 * 드러나는 것 — 클릭 좌표가 실제로 맞는지, 시험 중에 정답이 새지 않는지,
 * 끌기와 고르기가 갈리는지, 화면을 흔들어도 문제가 그대로인지 — 를 잰다.
 */
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync } from "node:fs";

const BASE = "http://localhost:3300";
const URL = (q = "") => `${BASE}/ux-fixture/world-map?seed=1${q}`;
mkdirSync("scratch-shots", { recursive: true });

const bundle = JSON.parse(readFileSync("public/maps/world-quiz.v1.json", "utf8"));
const byId = new Map(bundle.countries.map((c) => [c.countryId, c]));

const browser = await chromium.launch({ channel: "chrome", headless: true });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "  ✓" : "  ✗"} ${m}`); if (!c) fail++; };

async function open(width = 1366, height = 900, q = "") {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "ko-KR" });
  const page = await ctx.newPage();
  await page.goto(URL(q), { waitUntil: "load", timeout: 60000 });
  await page.locator(".wmq-map").waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}

/** 경위도 한 점을 화면 좌표로. 지도의 실제 viewBox 를 읽어 계산한다. */
async function clientOf(page, lng, lat) {
  return page.evaluate(([lng, lat]) => {
    const svg = document.querySelector(".wmq-map");
    const vb = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    const r = svg.getBoundingClientRect();
    // preserveAspectRatio="xMidYMid meet" — 여기서는 비율이 같아 여백이 0이다.
    const sx = r.width / vb[2], sy = r.height / vb[3];
    return { x: r.left + (lng + 180 - vb[0]) * sx, y: r.top + (90 - lat - vb[1]) * sy };
  }, [lng, lat]);
}

const question = () => (p) => p.locator(".wmq-target").innerText();

/* ── 1. 클릭이 실제로 그 나라를 고르는가 ── */
console.log("클릭 정확도 — 대표점을 누르면 그 나라가 골라지는가");
{
  const { ctx, page } = await open();
  const targets = ["KOR", "BRA", "AUS", "EGY", "JAM"]; // 큰 나라·작은 섬 섞어서
  for (const id of targets) {
    const c = byId.get(id);
    const pt = await clientOf(page, c.centroid[0], c.centroid[1]);
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(200);
    const txt = (await page.locator(".wmq-picked").innerText()).trim();
    ok(txt.includes("고른 곳"), `${id} 대표점 클릭 → ${txt.slice(0, 28)}`);
  }
  await ctx.close();
}

/* ── 2. 바다 클릭 ── */
console.log("\n바다 클릭 — 오답 처리하지 않고 고른 것도 지우지 않는가");
{
  const { ctx, page } = await open();
  const kor = byId.get("KOR");
  let pt = await clientOf(page, kor.centroid[0], kor.centroid[1]);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(200);
  const before = (await page.locator(".wmq-picked").innerText()).trim();

  pt = await clientOf(page, -140, 0); // 태평양 한가운데
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(250);
  const notice = await page.locator(".wmq-notice").count()
    ? (await page.locator(".wmq-notice").innerText()).trim() : "";
  const after = (await page.locator(".wmq-picked").innerText()).trim();
  ok(notice.includes("바다"), `바다 안내가 뜸: "${notice}"`);
  ok(after === before, "바다를 눌러도 고른 나라가 그대로 남음");
  ok(!/맞았|여기예요 —/.test(after), "바다 클릭이 오답으로 채점되지 않음");
  await ctx.close();
}

/* ── 3. 정답이 시험 중 새지 않는가 ── */
console.log("\n정답 노출 — 확정 전에 지도가 답을 알려주지 않는가");
{
  const { ctx, page } = await open();
  const labels = await page.locator(".wmq-label").count();
  ok(labels === 0, `확정 전 지도 라벨 ${labels}개`);
  const revealed = await page.locator(".wmq-land[data-answer]").count();
  ok(revealed === 0, `확정 전 정답 강조 ${revealed}개`);

  // 힌트 1·2단계에서도 정답 자체는 아직 나오면 안 된다.
  await page.locator("button:has-text('힌트')").click();
  await page.waitForTimeout(200);
  ok(await page.locator(".wmq-land[data-answer]").count() === 0, "힌트 1단계: 대륙만, 정답 아직");
  const hintTxt = (await page.locator(".wmq-hint").innerText()).trim();
  ok(/에 있어요/.test(hintTxt), `힌트 1단계 문구: "${hintTxt}"`);

  await page.locator("button:has-text('힌트')").click();
  await page.waitForTimeout(250);
  const region = await page.locator(".wmq-land[data-region]").count();
  ok(region > 0, `힌트 2단계: 지역 ${region}개국 강조`);
  ok(await page.locator(".wmq-land[data-answer]").count() === 0, "힌트 2단계: 정답은 아직");

  await page.locator("button:has-text('힌트')").click();
  await page.waitForTimeout(250);
  ok(await page.locator(".wmq-land[data-answer]").count() === 1, "힌트 3단계: 정답 위치 공개");
  await ctx.close();
}

/* ── 4. 끌기와 고르기 구분 ── */
console.log("\n끌기와 고르기 — 지도를 끌면 나라가 골라지지 않는가");
{
  const { ctx, page } = await open();
  const kor = byId.get("KOR");
  const pt = await clientOf(page, kor.centroid[0], kor.centroid[1]);
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await page.mouse.move(pt.x - 120, pt.y + 40, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const txt = (await page.locator(".wmq-picked").innerText()).trim();
  ok(!txt.includes("고른 곳"), `끌기 후 고른 나라 없음: "${txt.slice(0, 26)}"`);
  // 배율 1 에서는 끌 여백이 없다(지도가 딱 맞게 들어차 있다). 확대한 뒤에야
  // 이동이 의미가 있으므로, 확대해서 실제로 움직이는지까지 본다.
  ok((await page.locator(".wmq-map").getAttribute("viewBox")) === "0 0 360 180",
    "배율 1 에서는 끌어도 지도가 밀리지 않음 (밀 여백이 없다)");
  await page.locator("button[aria-label='지도 확대']").click();
  await page.waitForTimeout(250);
  const zoomed = await page.locator(".wmq-map").getAttribute("viewBox");
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await page.mouse.move(pt.x - 140, pt.y + 50, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const panned = await page.locator(".wmq-map").getAttribute("viewBox");
  ok(panned !== zoomed, `확대 뒤 끌면 지도가 움직임: ${zoomed} → ${panned}`);
  await ctx.close();
}

/* ── 5. 화면이 바뀌어도 문제가 그대로인가 ── */
console.log("\n문제 유지 — resize·큰 글씨가 문제를 다시 뽑지 않는가");
{
  const { ctx, page } = await open(1366, 900);
  const q1 = await page.locator(".wmq-target").innerText();
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(400);
  const q2 = await page.locator(".wmq-target").innerText();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const q3 = await page.locator(".wmq-target").innerText();
  ok(q1 === q2 && q2 === q3, `문제가 그대로: ${q1} → ${q2} → ${q3}`);

  // 큰 글씨에서 클릭 좌표가 깨지지 않는가 (08 §4)
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "24px"; });
  await page.waitForTimeout(400);
  const bra = byId.get("BRA");
  const pt = await clientOf(page, bra.centroid[0], bra.centroid[1]);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(250);
  const picked = (await page.locator(".wmq-picked").innerText()).trim();
  ok(picked.includes("고른 곳"), `큰 글씨에서도 클릭이 맞음: "${picked.slice(0, 26)}"`);
  await page.screenshot({ path: "scratch-shots/wmq-large.png" });
  await ctx.close();
}

/* ── 6. 한 판 끝까지 ── */
console.log("\n한 판 — 확정→다음→결과까지 가는가");
{
  const { ctx, page } = await open();
  let guard = 0;
  while ((await page.locator(".wmq-result").count()) === 0 && guard++ < 20) {
    const skip = page.locator("button:has-text('건너뛰기')");
    if (await skip.count()) { await skip.click(); await page.waitForTimeout(250); }
    const next = page.locator("button:has-text('다음')");
    if (await next.count()) { await next.click(); await page.waitForTimeout(250); }
  }
  ok(await page.locator(".wmq-result").count() === 1, "8문제 뒤 결과 화면에 도달");
  const rows = await page.locator(".wmq-resultrow").count();
  ok(rows === 8, `결과에 문제 ${rows}개 기록`);
  const body = await page.locator(".wmq-result").innerText();
  ok(/혼자 찾은 나라/.test(body), "힌트 쓴 문제를 따로 적음");
  await page.screenshot({ path: "scratch-shots/wmq-result.png" });
  await page.locator("button:has-text('다시 연습하기')").click();
  await page.waitForTimeout(400);
  ok(await page.locator(".wmq-map").count() === 1, "다시 연습하기로 처음 문제로 돌아감");
  await ctx.close();
}

/* ── 7. 격리 ── */
console.log("\nG0 격리 — Firebase·/api 로 나가지 않는가");
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ko-KR" });
  const page = await ctx.newPage();
  const outside = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/firebaseio|firestore|identitytoolkit|firebaseapp\.com/.test(u)) outside.push(u);
    else if (/\/api\//.test(u)) outside.push(u);
  });
  await page.goto(URL(), { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(2500);
  ok(outside.length === 0, `바깥 호출 ${outside.length}건${outside.length ? ": " + outside[0].slice(0, 60) : ""}`);
  await ctx.close();
}

await browser.close();
console.log(fail ? `\n미달 ${fail}건` : "\n전부 통과");
process.exit(fail ? 1 : 0);

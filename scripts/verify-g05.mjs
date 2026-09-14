/**
 * G05(윷놀이·할리갈리·문화 퍼즐) 깊이 작업 검증.
 *
 *   실행: node scripts/verify-g05.mjs   (저장소 뿌리에서)
 *
 * 06 §6 이 세 게임에 요구한 것을 **눈이 아니라 값으로** 확인한다.
 *  - 퍼즐: 조각에 두께(그림자)가 있고, 고른 조각이 실제로 떠오르는가
 *  - 할리갈리: 카드에 두께가 있고, 종이 :active 에 내려앉는가
 *  - 윷: 말 밑에 접촉 그림자 타원이 있고, 팀 색 후광이 사라졌는가
 * 그리고 세 화면 모두에서 캡처를 남긴다.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3300";
const OUT = "scratch-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fails.push(msg); };

async function open(label) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ko-KR" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ux-fixture/game`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator("button").filter({ hasText: label }).first().click();
  await page.waitForTimeout(2000);
  // 게임마다 준비 화면이 다르다 — 마블은 "▶ 시작!", 할리갈리는 카드 나눠주기.
  const start = page.locator("button").filter({ hasText: /^▶ 시작!/ }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(1800); }
  const deal = page.locator("button.hg-primary").first();
  if (await deal.count()) { await deal.click(); await page.waitForTimeout(1800); }
  return { ctx, page };
}

/* ── 1. 문화 퍼즐 ───────────────────────────────────────── */
console.log("\n문화 퍼즐");
{
  const { ctx, page } = await open("문화 퍼즐");
  const cell = page.locator(".cp-cell").first();
  await cell.waitFor({ timeout: 15000 });
  const rest = await cell.evaluate((el) => getComputedStyle(el).boxShadow);
  ok(rest !== "none" && rest.includes("rgb"), `쉴 때 두께 그림자 있음: ${rest.slice(0, 46)}…`);

  await cell.click();
  await page.waitForTimeout(320);
  const picked = await cell.evaluate((el) => ({
    t: getComputedStyle(el).transform,
    s: getComputedStyle(el).boxShadow,
  }));
  // matrix(a,b,c,d,tx,ty) — ty 가 음수면 위로 떠올랐다는 뜻.
  const ty = Number((picked.t.match(/matrix\(([^)]+)\)/)?.[1] || "").split(",")[5] ?? 0);
  ok(ty < -2, `집은 조각이 위로 떠오름: translateY ${ty.toFixed(1)}px`);
  ok(picked.s.includes("inset"), "집은 조각에 선택 테두리 유지");
  await page.screenshot({ path: `${OUT}/g05-puzzle.png` });
  await ctx.close();
}

/* ── 2. 할리갈리 ───────────────────────────────────────── */
console.log("\n할리갈리");
{
  const { ctx, page } = await open("할리갈리");
  // 빈 자리(.hg-cardempty)는 일부러 두께도 넘김도 없앴다. 실제 카드가 깔린 뒤에 재야
  // 한다 — 안 그러면 '없어야 정상'인 것을 재고 미달이라 우긴다.
  for (let i = 0; i < 6; i++) {
    if (await page.locator(".hg-card:not(.hg-cardempty)").count() >= 2) break;
    const flip = page.locator("button.hg-flip:not([aria-disabled='true'])").first();
    if (!(await flip.count())) break;
    try { await flip.click({ timeout: 2500 }); } catch { break; }
    await page.waitForTimeout(900);
  }
  const card = page.locator(".hg-card:not(.hg-cardempty)").first();
  await card.waitFor({ timeout: 15000 });
  ok(await page.locator(".hg-cardempty").evaluateAll(
    (els) => els.every((e) => getComputedStyle(e).boxShadow === "none")),
    "빈 자리에는 카드 두께가 없음");
  const cs = await card.evaluate((el) => getComputedStyle(el).boxShadow);
  ok((cs.match(/rgba?\(/g) || []).length >= 2, `카드 두께 = 그림자 ${(cs.match(/rgba?\(/g) || []).length}겹`);
  // 종을 치면 카드 더미가 넘어가 자리가 다시 비므로, 카드에 관한 것은 여기서 다 잰다.
  const anim = await card.evaluate((el) => getComputedStyle(el).animationName);
  ok(/hgFlipIn/.test(anim), `넘김 애니메이션 선언됨: ${anim}`);

  const bell = page.locator(".hg-bell").first();
  if (await bell.count()) {
    const before = await bell.evaluate((el) => getComputedStyle(el).boxShadow);
    ok(before.includes("rgb"), "종에 턱(그림자) 있음");
    const box = await bell.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(120);
    const active = await bell.evaluate((el) => getComputedStyle(el).transform);
    await page.mouse.up();
    const bty = Number((active.match(/matrix\(([^)]+)\)/)?.[1] || "").split(",")[5] ?? 0);
    ok(bty > 2, `누르면 종이 내려앉음: translateY +${bty.toFixed(1)}px`);
  } else {
    ok(false, "종 버튼을 찾지 못함");
  }
  await page.screenshot({ path: `${OUT}/g05-halligalli.png` });
  await ctx.close();
}

/* ── 3. 꿀벌 윷놀이 ───────────────────────────────────── */
console.log("\n꿀벌 윷놀이");
{
  const { ctx, page } = await open("윷");
  const stick = page.locator(".ys-stick").first();
  await stick.waitFor({ timeout: 15000 });
  const bg = await stick.evaluate((el) => getComputedStyle(el).backgroundImage);
  ok(bg.includes("90deg") || bg.split("linear-gradient").length > 2,
    "윷가락에 가로 결(둥근 단면) 있음");

  // 접촉 그림자는 **판 위에 올라온 말**에만 있다(대기 말은 꿀벌이 다 가려서 뺐다).
  // 그러니 말이 한 개라도 판에 오를 때까지 실제로 던지고 골라야 잴 수 있다.
  const onBoard = () => page.evaluate(() =>
    [...document.querySelectorAll("svg ellipse")].filter((e) => e.getAttribute("stroke") === "#fff").length);
  for (let turn = 0; turn < 14; turn++) {
    if (await onBoard() >= 1) break;
    const throwBtn = page.locator(".ys-throw").first();
    if (await throwBtn.count() && await throwBtn.isEnabled()) {
      try { await throwBtn.click({ timeout: 2500 }); } catch {}
      await page.waitForTimeout(1700);
    }
    const pick = page.locator("svg g").filter({ has: page.locator("circle[stroke-dasharray]") }).first();
    if (await pick.count()) { try { await pick.click({ timeout: 2500 }); } catch {} await page.waitForTimeout(1400); }
  }
  const plinths = await onBoard();
  ok(plinths > 0, `판 위 말이 팀 색 받침 위에 섬: ${plinths}개`);
  const svg = page.locator("svg").first();

  const halo = await svg.evaluate((el) =>
    [...el.querySelectorAll("image")].filter((i) => /drop-shadow/.test(i.style.filter || ""))
      .map((i) => i.style.filter));
  const colored = halo.filter((f) => !/rgba\(41,\s*37,\s*31/.test(f));
  ok(colored.length === 0, `팀 색 후광 남은 말 ${colored.length}개`);
  await page.screenshot({ path: `${OUT}/g05-yut.png` });
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\n미달 ${fails.length}건:\n- ${fails.join("\n- ")}` : "\n전부 통과");
process.exit(fails.length ? 1 : 0);

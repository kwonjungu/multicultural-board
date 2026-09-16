/**
 * 3D 꿀벌마을 실측 — 시스템 Chrome 으로 fixture 를 열어 캡처하고 수치를 잰다.
 * 사용법: node scripts/shot-village.mjs [baseUrl] [outDir]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * 재는 것: 가로 overflow, 조작 버튼 최소 크기, 유휴/산책 중 실제 renderer.render
 *          호출 수, 탭/드래그/핀치 구분, 키보드 도달, WebGL 실패 폴백.
 * 못 재는 것: 실기기 GPU 성능, 스크린리더 낭독, Firebase 연동 상태.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
const OUT = process.argv[3] || "reports/village";
mkdirSync(OUT, { recursive: true });

const rows = [];
const problems = [];
const log = (...a) => { console.log(...a); rows.push(a.join(" ")); };

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function open(query, view) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  await page.goto(`${BASE}/ux-fixture/village${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("canvas") !== null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return { ctx, page, errors };
}

const audit = (page) => page.evaluate(() => (window.__villageAudit || { calls: -1 }).calls);
const draws = (page) => page.evaluate(() => (window.__villageAudit || { draws: -1 }).draws);

// ── 1. 치수·겹침·캡처 ──────────────────────────────────────────
for (const [id, query, view] of [
  ["360-n12", "?n=12&long=1", { width: 360, height: 780 }],
  ["390-n30", "?n=30&long=1", { width: 390, height: 844 }],
  ["820-n30", "?n=30&facilities=3", { width: 820, height: 1180 }],
  ["1366-n12", "?n=12&facilities=2", { width: 1366, height: 768 }],
  ["1366-n1", "?n=1", { width: 1366, height: 768 }],
  ["1366-n0", "?n=0", { width: 1366, height: 768 }],
]) {
  const { ctx, page, errors } = await open(query, view);
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const small = [];
    document.querySelectorAll("button, select").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) return;
      if (r.height < 44 || r.width < 44) {
        small.push(`${el.textContent?.trim().slice(0, 12) || el.id}:${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });
    const canvas = document.querySelector("canvas");
    const cr = canvas?.getBoundingClientRect();
    return {
      overflowX: doc.scrollWidth > window.innerWidth,
      scrollW: doc.scrollWidth, innerW: window.innerWidth,
      small,
      canvas: cr ? `${Math.round(cr.width)}x${Math.round(cr.height)}` : "none",
    };
  });
  await page.screenshot({ path: `${OUT}/${id}.png` });
  log(`[size] ${id}`, JSON.stringify(m), errors.length ? `ERRORS=${JSON.stringify(errors)}` : "");
  if (m.overflowX) problems.push(`${id}: 가로 overflow ${m.scrollW}>${m.innerW}`);
  if (m.small.length) problems.push(`${id}: 44px 미만 조작 ${m.small.join(",")}`);
  if (errors.length) problems.push(`${id}: 콘솔/런타임 오류 ${errors[0]}`);
  await ctx.close();
}

// ── 2. 유휴 render 호출 수 ─────────────────────────────────────
{
  const { ctx, page } = await open("?n=30", { width: 1366, height: 768 });
  await page.waitForTimeout(3000);           // 텍스처 도착·카메라 정착 대기
  const before = await audit(page);
  const beforeDraws = await draws(page);
  await page.waitForTimeout(5000);
  const after = await audit(page);
  const afterDraws = await draws(page);
  log(`[idle] 유휴 5초 render 프레임=${after - before} · GPU draw=${afterDraws - beforeDraws}`);
  if (after - before > 2) problems.push(`유휴 5초에 render ${after - before}회 — 연속 렌더 의심`);
  await ctx.close();
}

// ── 3. 산책 중 render 호출 수 (이동 중 / 정지 후) ──────────────
{
  const { ctx, page } = await open("?n=12", { width: 1366, height: 768 });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /산책하기/ }).click();
  await page.waitForTimeout(500);
  const canvas = await page.locator("canvas").boundingBox();
  const moveStart = await audit(page);
  // 지면 빈 곳 탭 → 걸어가기
  await page.mouse.click(canvas.x + canvas.width * 0.25, canvas.y + canvas.height * 0.3);
  await page.waitForTimeout(1500);
  const moveEnd = await audit(page);
  // 도착·카메라 정착까지는 목적지 거리에 따라 달라진다. 고정 시간으로 기다리면
  // 아직 걷는 중을 '정지 후' 로 잘못 재게 된다 — 1초 버킷이 0 이 될 때까지 기다린다.
  let settleWait = 0;
  for (; settleWait < 20; settleWait++) {
    const a = await audit(page);
    await page.waitForTimeout(1000);
    if ((await audit(page)) - a === 0) break;
  }
  const idleStart = await audit(page);
  await page.waitForTimeout(5000);
  const idleEnd = await audit(page);
  const perSecond = ((moveEnd - moveStart) / 1.5).toFixed(0);
  log(`[walk] 이동 중 초당 프레임=${perSecond} · 정착까지 ${settleWait}초 · 정지 후 5초 프레임=${idleEnd - idleStart}`);
  if (Number(perSecond) > 75) problems.push(`산책 중 초당 ${perSecond}프레임 — 한 프레임에 render 가 두 번 도는지 확인`);
  if (idleEnd - idleStart > 2) problems.push(`산책 정지 5초에 render ${idleEnd - idleStart}회 — rAF 미중단`);
  await page.screenshot({ path: `${OUT}/walk.png` });
  await ctx.close();
}

// ── 4. 탭 / 드래그 / 핀치 구분 ─────────────────────────────────
{
  const { ctx, page } = await open("?n=12", { width: 1366, height: 768 });
  await page.waitForTimeout(2000);
  const box = await page.locator("canvas").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const picked = () => page.evaluate(() => document.body.innerText.match(/마지막 선택 (\S+)/)?.[1] ?? "?");

  // 드래그(회전) → 선택되면 안 된다
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 30, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(400);
  const afterDrag = await picked();
  log(`[input] 드래그 후 선택 = ${afterDrag}`);
  if (afterDrag !== "없음") problems.push(`드래그가 방문으로 인정됨 (${afterDrag})`);

  // 두 손가락(터치) 종료 → 선택되면 안 된다
  await page.evaluate(({ x, y }) => {
    const el = document.querySelector("canvas");
    const mk = (t, id, px) => el.dispatchEvent(new PointerEvent(t, {
      pointerId: id, pointerType: "touch", clientX: px, clientY: y, button: 0, bubbles: true,
    }));
    mk("pointerdown", 1, x); mk("pointerdown", 2, x + 60);
    mk("pointerup", 1, x); mk("pointerup", 2, x + 60);
  }, { x: cx, y: cy });
  await page.waitForTimeout(400);
  const afterPinch = await picked();
  log(`[input] 두 손가락 종료 후 선택 = ${afterPinch}`);
  if (afterPinch !== "없음") problems.push(`핀치 종료가 방문으로 인정됨 (${afterPinch})`);

  // pointercancel → 선택되면 안 된다
  await page.evaluate(({ x, y }) => {
    const el = document.querySelector("canvas");
    const mk = (t, id) => el.dispatchEvent(new PointerEvent(t, {
      pointerId: id, pointerType: "touch", clientX: x, clientY: y, button: 0, bubbles: true,
    }));
    mk("pointerdown", 7); mk("pointercancel", 7); mk("pointerup", 7);
  }, { x: cx, y: cy });
  await page.waitForTimeout(400);
  const afterCancel = await picked();
  log(`[input] pointercancel 후 선택 = ${afterCancel}`);
  if (afterCancel !== "없음") problems.push(`pointercancel 이 방문으로 인정됨 (${afterCancel})`);
  await ctx.close();
}

// ── 5. 키보드 도달 ────────────────────────────────────────────
{
  const { ctx, page } = await open("?n=12", { width: 1366, height: 768 });
  await page.waitForTimeout(1500);
  await page.getByLabel("친구 찾기").selectOption("s3");
  await page.getByRole("button", { name: "집 방문" }).click();
  await page.waitForTimeout(300);
  const picked = await page.evaluate(() => document.body.innerText.match(/마지막 선택 (\S+)/)?.[1]);
  const reach = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const a = document.activeElement;
      return a ? (a.getAttribute("aria-label") || a.textContent?.trim().slice(0, 12) || a.tagName) : "none";
    });
    if (!reach.includes(label)) reach.push(label);
  }
  log(`[keyboard] 목록 방문 결과=${picked} · Tab 도달=${reach.join(" > ")}`);
  if (picked !== "s3") problems.push(`목록에서 고른 친구 방문이 동작하지 않음 (${picked})`);
  await ctx.close();
}

// ── 6. WebGL 실패 폴백 ────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).includes("webgl")) return null;
      return original.call(this, type, ...rest);
    };
  });
  await page.goto(`${BASE}/ux-fixture/village?n=12`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const text = await page.evaluate(() => document.body.innerText.slice(0, 160));
  log(`[webgl-fail] ${JSON.stringify(text)}`);
  if (!text.includes("WebGL 실패")) problems.push("WebGL 실패 시 onFail 폴백이 동작하지 않음");
  await page.screenshot({ path: `${OUT}/webgl-fail.png` });
  await ctx.close();
}

// ── 7. 재진입 / 산책 반복 — 예외·누수 추세 ─────────────────────
{
  const { ctx, page, errors } = await open("?n=12", { width: 1366, height: 768 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 20; i++) {
    await page.getByRole("button", { name: /산책하기/ }).click();
    await page.waitForTimeout(120);
    await page.getByRole("button", { name: /산책 마치기/ }).click();
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1000);
  const shape = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    return { canvas: !!canvas, w: canvas?.width ?? 0, h: canvas?.height ?? 0 };
  });
  log(`[repeat] 산책 20회 반복 후 ${JSON.stringify(shape)} errors=${errors.length}`);
  if (errors.length) problems.push(`산책 반복 중 오류: ${errors[0]}`);
  await page.screenshot({ path: `${OUT}/after-20-walks.png` });
  await ctx.close();
}

await browser.close();

log("");
log(problems.length ? `문제 ${problems.length}건` : "문제 없음");
problems.forEach((p) => log(` - ${p}`));
writeFileSync(`${OUT}/report.txt`, rows.join("\n"), "utf8");
process.exit(problems.length ? 1 : 0);

/**
 * 작성 흐름 실측 — 시스템 Chrome 으로 fixture 를 열어 스크린샷과 계산값을 잰다.
 * 사용법: node scripts/shot-post.mjs [baseUrl]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * 자동 판정(HARNESS §4): 가로 overflow 0, control/action 56px 미만 0,
 * 글자 잘림 0, 본문 계산 font-size ≥ 20px, 라벨 ≥ 18px, 보조 ≥ 16px.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
const OUT = "reports/C-post";
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { id: "360x640", width: 360, height: 640 },
  { id: "844x390", width: 844, height: 390 },
  { id: "768x1024", width: 768, height: 1024 },
  { id: "1280x900", width: 1280, height: 900 },
];
const TEXT = ["basic", "large"];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];
const rows = [];

async function measure(page, v, size, step) {
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const px = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
    const all = (sel) => Array.from(document.querySelectorAll(sel));
    const minPx = (sel) => {
      const vals = all(sel).filter((el) => el.getClientRects().length).map(px).filter((n) => n != null);
      return vals.length ? Math.min(...vals) : null;
    };
    const controls = all('[data-ux-role="control"],[data-ux-role="action"]').filter((el) => el.getClientRects().length);
    const __dense = window.innerWidth >= 1024 && document.documentElement.dataset.uxText !== "large"; const __min = __dense ? 44 : 56;
        const tooSmall = controls
      .filter((el) => { const r = el.getBoundingClientRect(); return r.height < __min || r.width < __min; })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.className || el.tagName}"${(el.textContent || "").trim().slice(0, 12)}" ${Math.round(r.width)}x${Math.round(r.height)}`;
      });
    const clipped = all("[data-ux-role]")
      .filter((el) => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.className || el.tagName}: ${(el.textContent || "").trim().slice(0, 18)}`);
    const boxOverflow = (sel) => {
      const el = document.querySelector(sel);
      return el ? Math.max(0, el.scrollWidth - el.clientWidth) : 0;
    };
    const sheet = document.querySelector(".pm-sheet") || document.querySelector(".tc-panel");
    // 시트 전체가 실제로 스크롤로 닿는가 — 아래쪽이 잘려 올리기 버튼을 못 누르면 안 된다.
    const overlay = document.querySelector(".pm-overlay");
    const reachable = !overlay || !sheet
      ? true
      : sheet.getBoundingClientRect().height <= overlay.scrollHeight + 1;
    return {
      body: minPx('[data-ux-role="body"],[data-ux-role="body-emphasis"]'),
      label: minPx('[data-ux-role="label"]'),
      secondary: minPx('[data-ux-role="secondary"]'),
      controls: controls.length,
      docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      overlayOverflow: boxOverflow(".pm-overlay"),
      sheetOverflow: boxOverflow(".pm-sheet"),
      reachable,
      dense: __dense,
      tooSmall,
      clipped,
    };
  });
  const tag = `[${v.id}/${size}/${step}]`;
  if (m.docOverflow > 0) problems.push(`${tag} 문서 가로 overflow ${m.docOverflow}px`);
  if (m.overlayOverflow > 0) problems.push(`${tag} 오버레이 가로 overflow ${m.overlayOverflow}px`);
  if (m.sheetOverflow > 0) problems.push(`${tag} 시트 가로 overflow ${m.sheetOverflow}px`);
  if (!m.reachable) problems.push(`${tag} 시트 아래쪽이 스크롤로 닿지 않는다`);
  if (m.tooSmall.length) problems.push(`${tag} 56px 미만 컨트롤: ${m.tooSmall.join(" | ")}`);
  if (m.clipped.length) problems.push(`${tag} 글자 잘림: ${m.clipped.join(" | ")}`);
  if (m.body !== null && m.body < (m.dense ? 17 : 20)) problems.push(`${tag} body ${m.body}px < 20`);
  if (m.label !== null && m.label < (m.dense ? 15.5 : 18)) problems.push(`${tag} label ${m.label}px < 18`);
  if (m.secondary !== null && m.secondary < (m.dense ? 14.5 : 16)) problems.push(`${tag} secondary ${m.secondary}px < 16`);
  rows.push({
    view: v.id, size, step,
    body: m.body, label: m.label, secondary: m.secondary,
    controls: m.controls,
    overflow: m.docOverflow + m.overlayOverflow + m.sheetOverflow,
    tooSmall: m.tooSmall.length, clipped: m.clipped.length,
  });
  await page.screenshot({ path: `${OUT}/post-${step}-${v.id}-${size}.png` });
}

async function newPage(ctx, v, size, query) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${v.id}/${size}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`[${v.id}/${size}] console: ${m.text()}`); });
  await page.goto(`${BASE}/ux-fixture/post?${query}`, { waitUntil: "networkidle", timeout: 60000 });
  return page;
}

/** 첫 선택 → 글로 쓰기 → 문장 힌트 → 본문 → 확인. */
async function composeToPreview(page, v, size, { shots }) {
  if (shots) await measure(page, v, size, "1-ways");
  await page.getByRole("button", { name: "글로 쓰기" }).click();
  if (shots) await measure(page, v, size, "2-editor");
  await page.getByRole("button", { name: /나는 오늘 ___해서 기뻤어/ }).click();
  await page.locator("#pm-text").fill("나는 오늘 친구랑 공놀이를 해서 기뻤어");
  if (shots) await measure(page, v, size, "3-editor-hint");
  await page.getByRole("button", { name: "확인할래" }).click();
  if (shots) await measure(page, v, size, "4-preview");
}

for (const v of VIEWS) {
  for (const size of TEXT) {
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1 });
    await ctx.addInitScript((s) => {
      localStorage.clear();
      localStorage.setItem("childUx.settings", JSON.stringify({ textSize: s, motion: "reduced", tone: "playful" }));
    }, size);

    // ── 200 정상: 작성 → 확인 → 올리기 → 서버 확인 ──
    {
      const page = await newPage(ctx, v, size, "scenario=ok&open=1");
      await composeToPreview(page, v, size, { shots: true });
      await page.getByRole("button", { name: /🐝 올리기/ }).click();
      await page.getByText("올라갔어요!", { exact: false }).waitFor({ timeout: 10000 });
      await measure(page, v, size, "5-published");
      await page.close();
    }

    // ── 500 실패: 초안 보존 + 재시도 ──
    {
      const page = await newPage(ctx, v, size, "scenario=fail&open=1");
      await composeToPreview(page, v, size, { shots: false });
      await page.getByRole("button", { name: /🐝 올리기/ }).click();
      await page.getByRole("button", { name: "다시 올리기" }).waitFor({ timeout: 10000 });
      const kept = await page.locator("#pm-text").inputValue();
      if (kept !== "나는 오늘 친구랑 공놀이를 해서 기뻤어") {
        problems.push(`[${v.id}/${size}] 실패 후 본문이 사라졌다: "${kept}"`);
      }
      await measure(page, v, size, "6-failed");
      await page.close();
    }

    // ── 2초 지연 + 교사 승인: 보내는 중 → 검토 중 (공개 아님) ──
    {
      const page = await newPage(ctx, v, size, "scenario=slow&approval=1&open=1");
      await composeToPreview(page, v, size, { shots: false });
      await page.getByRole("button", { name: /🐝 올리기/ }).click();
      await page.getByText("보내는 중이에요", { exact: false }).first().waitFor({ timeout: 5000 });
      await measure(page, v, size, "7-sending");
      await page.getByText("선생님이 확인하고 있어요", { exact: false }).waitFor({ timeout: 15000 });
      const bodyText = await page.locator(".pm-sheet").innerText();
      if (/올라갔어요/.test(bodyText)) {
        problems.push(`[${v.id}/${size}] 승인 대기인데 공개 성공으로 표시된다 (POST-03)`);
      }
      await measure(page, v, size, "8-awaiting-review");
      await page.close();
    }

    // ── 결과 미보고(기존 PadletBoard 경로): 저장 완료라고 말하지 않는다 ──
    {
      const page = await newPage(ctx, v, size, "scenario=silent&open=1");
      await composeToPreview(page, v, size, { shots: false });
      await page.getByRole("button", { name: /🐝 올리기/ }).click();
      await page.getByText("보냈어요", { exact: false }).waitFor({ timeout: 10000 });
      const bodyText = await page.locator(".pm-sheet").innerText();
      if (/올라갔어요/.test(bodyText)) {
        problems.push(`[${v.id}/${size}] 결과를 모르는데 저장 완료로 표시된다 (POST-02)`);
      }
      await measure(page, v, size, "9-sent-unconfirmed");
      await page.close();
    }

    // ── 튜터 꿀비: 생성 중 멈추기 · 스트림 실패 재시도 · 접기 ──
    {
      const page = await newPage(ctx, v, size, "tutor=stream");
      await page.getByRole("button", { name: /꿀비에게 물어보기/ }).click();
      await measure(page, v, size, "T1-tutor-idle");
      await page.locator(".tc-input").fill("학교가 무슨 뜻이야?");
      await page.getByRole("button", { name: "보내기" }).click();
      await page.getByRole("button", { name: /멈추기/ }).waitFor({ timeout: 5000 });
      await page.waitForTimeout(1600);
      await measure(page, v, size, "T2-tutor-streaming");
      await page.getByRole("button", { name: /멈추기/ }).click();
      await page.getByRole("button", { name: "보내기" }).waitFor({ timeout: 5000 });
      // 멈춘 뒤 늦게 도착하는 스트림 조각이 화면을 다시 바꾸면 안 된다 (STREAM-01).
      const afterStop = await page.locator(".tc-log").innerText();
      await page.waitForTimeout(2500);
      const later = await page.locator(".tc-log").innerText();
      if (afterStop !== later) problems.push(`[${v.id}/${size}] 멈춘 뒤에도 스트림이 화면을 바꿨다`);
      await measure(page, v, size, "T3-tutor-stopped");
      await page.getByRole("button", { name: /접기/ }).click();
      await measure(page, v, size, "T4-tutor-collapsed");
      await page.close();
    }
    {
      const page = await newPage(ctx, v, size, "tutor=fail");
      await page.getByRole("button", { name: /꿀비에게 물어보기/ }).click();
      await page.locator(".tc-input").fill("답이 안 오는 질문");
      await page.getByRole("button", { name: "보내기" }).click();
      await page.getByRole("button", { name: "다시 물어보기" }).waitFor({ timeout: 10000 });
      await measure(page, v, size, "T5-tutor-failed");
      await page.close();
    }

    await ctx.close();
  }
}

// ── 결함 주입 재생표(순수 reducer)가 화면에서도 기대값과 같은지 ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ux-fixture/post`, { waitUntil: "networkidle", timeout: 60000 });
  const expect = {
    duplicate: "published", outOfOrder: "published",
    lateAfterAbort: "failed", retrySameId: "published", approval: "awaitingReview",
  };
  for (const [id, want] of Object.entries(expect)) {
    const got = (await page.locator(`[data-fx="replay-${id}"] [data-fx="phase"]`).innerText()).trim();
    if (got !== want) problems.push(`[replay/${id}] phase ${got} ≠ ${want}`);
  }
  await page.screenshot({ path: `${OUT}/post-0-fixture-replay.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.table(rows);
if (problems.length) { console.log("\n문제:"); for (const p of problems) console.log(" -", p); }
else console.log("\n측정 항목 이상 없음");
process.exit(problems.length ? 1 : 0);

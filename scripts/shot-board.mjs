/**
 * 소통창 실측 — 시스템 Chrome 으로 fixture 를 열어 스크린샷과 계산값을 잰다.
 * 사용법: node scripts/shot-board.mjs [baseUrl]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * 재는 것: 가로 overflow, control/action 56px 하한, 글자 가로 잘림,
 * body/label 계산 글자 크기. 기준은 README §4.1 / HARNESS §4.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
const URL_ = `${BASE}/ux-fixture/board`;
mkdirSync("reports/C", { recursive: true });

const VIEWS = [
  { id: "360", width: 360, height: 800 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];
const TEXT = ["basic", "large"];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];
const rows = [];

async function openPage(view, size, query) {
  const ctx = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: 1,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  await ctx.addInitScript((s) => {
    localStorage.setItem("childUx.settings", JSON.stringify({ textSize: s, motion: "reduced", tone: "playful" }));
  }, size);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${view.id}/${size}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // fixture 가 일부러 넣은 이미지 404 카드의 로드 실패는 기대된 입력이다.
    const url = m.location()?.url || "";
    if (url.includes("this-image-does-not-exist")) return;
    problems.push(`[${view.id}/${size}] console: ${m.text()} ${url}`);
  });
  await page.goto(URL_ + query, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector("[data-ux-root]", { timeout: 15000 });
  return { ctx, page };
}

/** 스크린샷은 아이가 실제로 보는 첫 화면 기준(뷰포트)이다. fullPage 는 sticky
 *  헤더/하단 버튼을 스크롤 0 위치에 겹쳐 그려 증거를 왜곡한다. */
async function measure(page, view, size, step) {
  const m = await page.evaluate(() => {
    const px = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
    const controls = Array.from(document.querySelectorAll('[data-ux-role="control"],[data-ux-role="action"]'));
    const __dense = window.innerWidth >= 1024 && document.documentElement.dataset.uxText !== "large"; const __min = __dense ? 44 : 56;
        const tooSmall = controls
      .filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.height < __min || r.width < __min); })
      .map((el) => `${el.className || el.tagName} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    // 가로로 잘린 글자만 잡는다. 세로 접기('더 읽기')는 의도된 상태다.
    const clipped = Array.from(document.querySelectorAll("[data-ux-role]"))
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.className || el.tagName}: ${(el.textContent || "").slice(0, 18)}`);
    const roots = document.querySelectorAll("[data-ux-root]").length;
    return {
      body: px(document.querySelector('[data-ux-role="body"]')),
      label: px(document.querySelector('[data-ux-role="label"]')),
      secondary: px(document.querySelector('[data-ux-role="secondary"]')),
      title: px(document.querySelector('[data-ux-role="title"]')),
      cards: document.querySelectorAll(".pc-card").length,
      roots,
      docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      dense: __dense,
      dense: __dense,
      tooSmall, clipped,
    };
  });
  rows.push({ view: view.id, size, step, body: m.body, label: m.label, secondary: m.secondary, title: m.title, cards: m.cards, tooSmall: m.tooSmall.length, clipped: m.clipped.length });
  const tag = `[${view.id}/${size}/${step}]`;
  if (m.docOverflow > 0) problems.push(`${tag} 가로 overflow ${m.docOverflow}px`);
  if (m.roots !== 1) problems.push(`${tag} data-ux-root ${m.roots}개 (1개여야 함)`);
  if (m.tooSmall.length) problems.push(`${tag} 56px 미만 컨트롤: ${m.tooSmall.slice(0, 6).join(" | ")}`);
  if (m.clipped.length) problems.push(`${tag} 글자 잘림: ${m.clipped.slice(0, 6).join(" | ")}`);
  if (m.body !== null && m.body < (m.dense ? 17 : 20)) problems.push(`${tag} body ${m.body}px < 20`);
  if (m.label !== null && m.label < (m.dense ? 15.5 : 18)) problems.push(`${tag} label ${m.label}px < 18`);
  if (m.secondary !== null && m.secondary < (m.dense ? 14.5 : 16)) problems.push(`${tag} secondary ${m.secondary}px < 16`);
  await page.screenshot({ path: `reports/C/board-${step}-${view.id}-${size}.png` });
}

for (const v of VIEWS) {
  for (const size of TEXT) {
    // ── 학생 기본 화면 ──
    const { ctx, page } = await openPage(v, size, "");

    // 넓은 화면의 기본은 '전체 한눈에 보기' 다. 그 상태를 먼저 재고,
    // 그다음 '한 주제' 로 바꿔 기존 단계들을 이어서 잰다.
    const viewSwitch = page.locator(".bd-viewswitch button");
    if (await viewSwitch.count()) {
      await measure(page, v, size, "allcolumns");
      await viewSwitch.nth(1).click();
      await page.waitForTimeout(200);
    }

    const topics = page.locator(".bd-topic");
    await topics.nth(0).click();
    await page.waitForTimeout(150);
    await measure(page, v, size, "one");      // 카드 1개

    await topics.nth(1).click();
    await page.waitForTimeout(200);
    await measure(page, v, size, "many");    // 카드 50개 + 2,000자·번역 실패·이미지 404·긴 이름

    // 긴 글 펼치기 + 원문 보기까지 연 상태도 잰다.
    const more = page.locator(".pc-card").first().getByRole("button", { name: /더 읽기|Read more/ });
    if (await more.count()) { await more.first().click(); await page.waitForTimeout(120); }
    const orig = page.locator(".pc-card").first().getByRole("button", { name: /원문 보기|Show original/ });
    if (await orig.count()) { await orig.first().click(); await page.waitForTimeout(120); }
    await measure(page, v, size, "open");

    // 상태별 증거: 번역 중 / 번역 실패 / 이미지 404 카드를 따로 찍는다.
    if (v.id !== "768") {
      for (const [name, needle] of [
        ["failed", "번역을 못 불러왔어요"],
        ["loading", "번역 중이에요"],
        ["img404", "그림을 불러오지 못했어요"],
      ]) {
        const el = page.locator(`.pc-card:has-text("${needle}")`).first();
        // 이미지 404 는 실제 응답을 기다려야 상태가 뜬다 — 즉시 count() 는 흔들린다.
        await el.waitFor({ state: "attached", timeout: 8000 }).catch(() => {});
        if (await el.count()) {
          await el.scrollIntoViewIfNeeded();
          await page.waitForTimeout(80);
          await el.screenshot({ path: `reports/C/board-state-${name}-${v.id}-${size}.png` });
        } else {
          problems.push(`[${v.id}/${size}] 상태 카드를 찾지 못했다: ${needle}`);
        }
      }
    }

    // 답장 패널(입력 + 보내기)도 한 장 남긴다.
    if (v.id === "360") {
      const reply = page.locator(".pc-card").first().getByRole("button", { name: /답장|Reply/ });
      if (await reply.count()) {
        await reply.first().click();
        await page.waitForTimeout(150);
        await measure(page, v, size, "reply");
      }
    }

    await topics.nth(2).click();
    await page.waitForTimeout(150);
    await measure(page, v, size, "empty");    // 카드 0개
    await ctx.close();

    // ── 교사 화면 (데스크톱에서만 전체 주제 보기가 나온다) ──
    const teacher = await openPage(v, size, "?role=teacher");
    await teacher.page.waitForTimeout(250);
    await measure(teacher.page, v, size, "teacher");
    await teacher.ctx.close();
  }
}

await browser.close();
console.table(rows);
if (problems.length) { console.log("\n문제:"); for (const p of problems) console.log(" -", p); }
else console.log("\n측정 항목 이상 없음");
process.exit(problems.length ? 1 : 0);

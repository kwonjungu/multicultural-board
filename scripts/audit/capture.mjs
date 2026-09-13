/**
 * 기기 5종 × 글자 크기 2종 실측 감사기 (품질 하네스, 2026-09-14).
 *
 * 하는 일 (화면 1개 × 칸 1개마다):
 *   1. before 를 3402(601a8f0) 에서, after 를 3300(HEAD 4dca8c5) 에서 실제로 캡처한다.
 *   2. after 에서 실측한다 — 가로 넘침, 첫 화면 콘텐츠 비율, 최소 조작 크기,
 *      본문 글자 크기, 에러 오버레이, 콘솔 오류, Firebase//api 누수.
 *   3. 키보드 Tab 과 실제 탭(클릭)을 넣어 조작이 먹는지 확인한다.
 *   4. 측정값과 조작 결과를 칸별 마크다운으로 남긴다 (= interactionEvidence).
 *   5. 문제를 issues[] 로 모은다. issues 가 비어야만 그 칸이 passed 가 된다.
 *
 * 글자 크기: localStorage 'childUx.settings' 의 textSize 를 페이지 로드 전에 심는다
 * (lib/childUx/settings.ts 의 단일 경로). 화면을 강제로 확대하지 않는다.
 *
 * 실행: 저장소 루트에서 `node scripts/audit/capture.mjs [화면id ...]`
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { SCREENS, BEFORE_ROUTES, FLOW_BEFORE } from "./screens.mjs";

const AFTER = "http://localhost:3300";
const BEFORE = "http://localhost:3402";
const OUT = path.resolve("reports/audit-20260914");
const DEVICES = [
  { id: "tablet-portrait", width: 820, height: 1180, touch: true },
  { id: "tablet-landscape", width: 1180, height: 820, touch: true },
  { id: "chromebook", width: 1366, height: 768, touch: true },
  { id: "laptop", width: 1440, height: 900, touch: false },
  { id: "split-view", width: 800, height: 768, touch: true },
];
const SIZES = ["basic", "large"];

/** 아이 손가락 기준 최소 조작 크기(04 문서 U02). 노트북 포인터는 44px 로 완화된다. */
const MIN_TAP = { touch: 48, mouse: 44 };

const bareUrl = (u) => u.split("?")[0];

/** 조작으로만 도달하는 화면들. 도달에 실패하면 그 칸은 통과시키지 않는다. */
const STEPS = {
  async entryToAnimal(page) {
    // SetupScreen 은 1/3 언어 → 2/3 이름 → 3/3 동물 3단계다. 각 단계마다
    // "다음 →" 를 눌러야 넘어간다 (조사로 확인).
    await page.getByRole("button", { name: /한국어/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(700);
    for (let step = 0; step < 3; step++) {
      const txt = await page.evaluate("document.body.innerText || ''");
      if (/3\/3|동물|여우|곰|토끼|고양이/.test(txt)) return;
      // 이름 단계면 명렬표에서 한 명 고르거나 직접 입력한다.
      const input = page.locator('input[type="text"], input:not([type]):not([type=checkbox])').first();
      if (await input.count()) {
        await input.fill("학생 02").catch(() => {});
        await page.waitForTimeout(250);
      } else {
        const roster = page.getByRole("button", { name: /^학생 02$/ }).first();
        if (await roster.count()) { await roster.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400); }
      }
      const next = page.getByRole("button", { name: /다음/ }).first();
      if (!(await next.count())) break;
      await next.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(900);
    }
    const txt = await page.evaluate("document.body.innerText || ''");
    if (!/3\/3|동물|여우|곰|토끼|고양이/.test(txt)) {
      throw new Error("동물 선택 단계에 도달하지 못함 (현재: " + txt.replace(/\s+/g, " ").slice(0, 80) + ")");
    }
  },
  async boardReaction(page) {
    await page.getByRole("button", { name: /React|마음|반응/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(800);
  },
  async halligalliStart(page) {
    await page.getByRole("button", { name: /시작하기/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(1200);
  },
  async globeExplore(page) {
    await page.getByRole("button", { name: /공부하기/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(2500);
  },
  async none() {},
};

/** 페이지 안에서 도는 실측기. 반환값이 그대로 증거 수치가 된다. */
const MEASURE = `
  (() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const de = document.documentElement;
    const isChrome = (el) => !!el.closest('[data-fixture-chrome]') || !!el.closest('nextjs-portal');

    // 가로 넘침 — 아이 화면에서 좌우 스크롤은 그 자체로 결함이다.
    const overflowX = Math.max(0, de.scrollWidth - vw);
    const wide = [];
    for (const el of document.querySelectorAll('body *')) {
      if (isChrome(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 2) {
        wide.push({ tag: el.tagName.toLowerCase(), cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 40), right: Math.round(r.right) });
        if (wide.length >= 5) break;
      }
    }

    // 첫 화면(fold) 안의 조작/콘텐츠 밀도.
    const controls = [];
    for (const el of document.querySelectorAll('button, [role="button"], a[href], input, textarea, select')) {
      if (isChrome(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
      const inFold = r.top < vh && r.bottom > 0;
      controls.push({
        label: (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().replace(/\\s+/g, ' ').slice(0, 30),
        w: Math.round(r.width), h: Math.round(r.height), inFold,
        min: Math.round(Math.min(r.width, r.height)),
      });
    }
    const foldControls = controls.filter(c => c.inFold);

    // 본문 글자 크기 — large 에서 실제로 커지는지 확인할 근거.
    const fontOf = (sel) => { const e = document.querySelector(sel); return e ? Math.round(parseFloat(getComputedStyle(e).fontSize) * 10) / 10 : null; };
    const bodyFonts = [];
    for (const el of document.querySelectorAll('p, li, span, div')) {
      if (isChrome(el)) continue;
      if (!el.textContent || !el.textContent.trim()) continue;
      if (el.children.length) continue;
      const r = el.getBoundingClientRect();
      if (r.top >= vh || r.bottom <= 0 || r.width < 8) continue;
      bodyFonts.push(parseFloat(getComputedStyle(el).fontSize));
      if (bodyFonts.length >= 120) break;
    }
    bodyFonts.sort((a, b) => a - b);
    const median = bodyFonts.length ? bodyFonts[Math.floor(bodyFonts.length / 2)] : null;

    return {
      viewport: { w: vw, h: vh },
      docScroll: { w: de.scrollWidth, h: de.scrollHeight },
      overflowX, wideOffenders: wide,
      uxText: de.dataset.uxText || '(unset)',
      controlCount: controls.length,
      foldControlCount: foldControls.length,
      minTapInFold: foldControls.length ? Math.min(...foldControls.map(c => c.min)) : null,
      smallTaps: foldControls.filter(c => c.min < 48).map(c => ({ label: c.label, w: c.w, h: c.h })).slice(0, 8),
      bodyFontMedian: median === null ? null : Math.round(median * 10) / 10,
      bodyFontMin: bodyFonts.length ? Math.round(bodyFonts[0] * 10) / 10 : null,
      titleFont: fontOf('h1') ?? fontOf('h2'),
      textLen: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().length,
      errorOverlay: !!document.querySelector('nextjs-portal'),
    };
  })()
`;

async function makeContext(browser, dev, size) {
  const ctx = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    hasTouch: dev.touch,
    isMobile: false,
    deviceScaleFactor: 1,
    reducedMotion: "reduce", // 캡처가 애니메이션 프레임마다 달라지지 않게 한다.
  });
  await ctx.addInitScript(`
    try {
      localStorage.setItem('childUx.settings', JSON.stringify({
        textSize: ${JSON.stringify(size)}, motion: 'reduced', tone: 'playful', sound: 'off', focus: false
      }));
    } catch (e) {}
  `);
  return ctx;
}

async function shoot(browser, origin, url, dev, size, file, steps) {
  const ctx = await makeContext(browser, dev, size);
  const page = await ctx.newPage();
  const leaks = [];
  const consoleErrors = [];
  page.on("request", (req) => {
    const u = req.url();
    if (/firestore|firebaseio|firebaseinstallations|identitytoolkit|firebaseapp\.com/i.test(u)) {
      leaks.push({ kind: "firebase", method: req.method(), url: u.slice(0, 120) });
    } else if (/localhost:\d+\/api\//.test(u)) {
      leaks.push({ kind: "api", method: req.method(), url: new URL(u).pathname });
    }
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/FIREBASE|firebase/i.test(t)) leaks.push({ kind: "firebase-console", url: t.slice(0, 120) });
    consoleErrors.push(t.slice(0, 180));
  });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e).split("\n")[0].slice(0, 180)));

  let stepError = null;
  let measured = null;
  try {
    await page.goto(origin + url, { waitUntil: "domcontentloaded", timeout: 45000 });
    // applyChildUx 가 <html data-ux-text> 를 다는 것은 마운트 후 effect 다.
    // 그 전에 재면 "글자 크기 미적용"이라는 거짓 결함이 나온다.
    await page.waitForFunction("!!document.documentElement.dataset.uxText", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1800);
    if (steps && STEPS[steps]) {
      try { await STEPS[steps](page); } catch (e) { stepError = String(e).split("\n")[0].slice(0, 160); }
    }
    await page.waitForTimeout(900);
    measured = await page.evaluate(MEASURE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file });
  } catch (e) {
    stepError = stepError || String(e).split("\n")[0].slice(0, 160);
  }
  await ctx.close();
  return { measured, leaks, consoleErrors: [...new Set(consoleErrors)].slice(0, 6), stepError, file };
}

/** 키보드 Tab 과 실제 탭이 먹는지 — 조작 증거의 실체. */
async function interact(browser, url, dev, size, steps) {
  const ctx = await makeContext(browser, dev, size);
  const page = await ctx.newPage();
  const log = [];
  try {
    await page.goto(AFTER + url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1800);
    if (steps && STEPS[steps]) { try { await STEPS[steps](page); } catch (e) { log.push("사전 조작 실패: " + e); } }
    await page.waitForTimeout(700);

    await page.keyboard.press("Tab");
    await page.waitForTimeout(250);
    const focus = await page.evaluate(`(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      const r = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      return { tag: a.tagName.toLowerCase(),
        label: (a.getAttribute('aria-label') || a.innerText || '').trim().replace(/\\s+/g,' ').slice(0,40),
        w: Math.round(r.width), h: Math.round(r.height),
        outline: cs.outlineStyle + ' ' + cs.outlineWidth, ring: cs.boxShadow.slice(0, 60),
        inChrome: !!a.closest('[data-fixture-chrome]') };
    })()`);
    log.push(`Tab 1회 → 포커스: ${focus ? `${focus.tag} "${focus.label}" ${focus.w}x${focus.h} outline=${focus.outline}${focus.inChrome ? " (fixture 껍데기)" : ""}` : "포커스 없음"}`);

    // 제품 버튼 하나를 실제로 눌러 화면이 반응하는지 본다.
    //
    // 주의: DOM 순서 첫 버튼을 그냥 누르면 안 된다. 단어 상세/쓰기처럼 모달
    // 오버레이가 덮인 화면에서는 첫 버튼이 "밑에 깔린 화면"의 버튼이라 클릭이
    // 타임아웃 나고, 그걸 제품 결함으로 잘못 적게 된다. 실제로 손가락이 닿는
    // (hit-test 로 자기 자신이 잡히는) 버튼만 고른다.
    const before = await page.evaluate("(document.body.innerText||'').length");
    // 고른 버튼에 표식을 달아 그 표식으로만 잡는다. 인덱스로 다시 찾으면
    // 선택자 집합이 달라져 엉뚱한 버튼을 누를 수 있다.
    const picked = await page.evaluate(`(() => {
      document.querySelectorAll('[data-audit-target]').forEach(e => e.removeAttribute('data-audit-target'));
      const btns = [...document.querySelectorAll('button, [role="button"]')]
        .filter(e => !e.closest('[data-fixture-chrome]') && !e.closest('nextjs-portal'));
      for (const el of btns) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (top && (top === el || el.contains(top))) {
          el.setAttribute('data-audit-target', '1');
          return (el.getAttribute('aria-label') || el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 30);
        }
      }
      return null;
    })()`);
    let clicked = "손가락이 닿는 제품 버튼이 첫 화면에 없음";
    if (picked !== null) {
      const target = page.locator("[data-audit-target]");
      const name = picked;
      try {
        await target.click({ timeout: 6000 });
        await page.waitForTimeout(900);
        const after = await page.evaluate("(document.body.innerText||'').length");
        clicked = `"${name}" 탭 → 본문 길이 ${before}→${after} (${before === after ? "변화 없음" : "화면 반응함"})`;
      } catch (e) { clicked = `"${name}" 탭 실패: ${String(e).split("\n")[0].slice(0, 90)}`; }
    }
    log.push(clicked);
  } catch (e) {
    log.push("조작 검사 실패: " + String(e).split("\n")[0].slice(0, 140));
  }
  await ctx.close();
  return log;
}

function judge(screen, dev, size, after, before, interactLog) {
  const issues = [];
  const m = after.measured;
  if (!m) { issues.push("after 캡처/측정 실패: " + (after.stepError || "알 수 없음")); return issues; }
  if (after.stepError) issues.push("조작 도달 실패: " + after.stepError);
  if (m.errorOverlay) issues.push("Next.js 에러 오버레이가 화면을 덮음");
  if (m.overflowX > 2) {
    issues.push(`가로 넘침 ${m.overflowX}px (문서 ${m.docScroll.w} > 뷰포트 ${m.viewport.w})` +
      (m.wideOffenders.length ? ` — ${m.wideOffenders.map(o => `${o.tag}.${o.cls}@${o.right}`).join(", ")}` : ""));
  }
  if (m.uxText !== size) issues.push(`글자 크기 설정이 적용되지 않음: data-ux-text=${m.uxText} (기대 ${size})`);
  if (m.textLen < 20) issues.push(`화면에 읽을 내용이 거의 없음 (본문 ${m.textLen}자) — 렌더 실패 의심`);
  const limit = dev.touch ? MIN_TAP.touch : MIN_TAP.mouse;
  if (m.minTapInFold !== null && m.minTapInFold < limit) {
    issues.push(`첫 화면 최소 조작 ${m.minTapInFold}px < ${limit}px — ${m.smallTaps.map(t => `"${t.label}"(${t.w}x${t.h})`).slice(0, 4).join(", ")}`);
  }
  const fb = after.leaks.filter(l => l.kind !== "api");
  if (fb.length) issues.push(`fixture 가 Firebase 로 나감: ${fb.slice(0, 2).map(l => l.url).join(" | ")}`);
  const api = after.leaks.filter(l => l.kind === "api");
  if (api.length) issues.push(`fixture 가 /api 로 나감: ${[...new Set(api.map(l => l.url))].join(", ")}`);
  if (!before || !before.measured) issues.push("before 캡처 실패 — 전후 비교 불가");
  if (interactLog.some(l => /실패/.test(l))) issues.push("조작 검사 실패: " + interactLog.find(l => /실패/.test(l)));
  return issues;
}

async function main() {
  const only = process.argv.slice(2);
  const targets = SCREENS.filter(s => s.status !== "none" && (!only.length || only.includes(s.id)));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  // 이미 찍어둔 화면 결과는 보존하고 이번에 찍은 것만 갈아끼운다.
  // (중간에 끊겨도 앞선 화면의 실측을 잃지 않게 한다.)
  const jsonPath = path.join(OUT, "capture.json");
  let out = [];
  if (fs.existsSync(jsonPath)) {
    try { out = JSON.parse(fs.readFileSync(jsonPath, "utf8")); } catch { out = []; }
  }
  const put = (rec) => {
    const i = out.findIndex((x) => x.id === rec.id);
    if (i >= 0) out[i] = rec; else out.push(rec);
  };

  for (const s of targets) {
    const beforeUrl = s.before === "same" ? s.url : FLOW_BEFORE;
    const beforeAvailable = s.before !== "none" && BEFORE_ROUTES.has(bareUrl(beforeUrl));
    const screenRec = { id: s.id, url: s.url, beforeUrl, beforeKind: s.before, childGoal: s.childGoal, checks: [] };

    for (const dev of DEVICES) {
      for (const size of SIZES) {
        const tag = `${s.id}__${dev.id}__${size}`;
        const afterFile = path.join(OUT, "after", `${tag}.png`);
        const beforeFile = path.join(OUT, "before", `${tag}.png`);

        const after = await shoot(browser, AFTER, s.url, dev, size, afterFile, s.steps);
        // before 는 그 시점에 실제로 있던 라우트만 찍는다. 없는 것을 만들어내지 않는다.
        // 신규 화면(before:"flow")의 before 는 601a8f0 당시 아이가 실제로 거치던 홈 허브다.
        const before = beforeAvailable
          ? await shoot(browser, BEFORE, beforeUrl, dev, size, beforeFile, s.before === "same" ? s.steps : null)
          : null;
        const ilog = await interact(browser, s.url, dev, size, s.steps);
        const issues = judge(s, dev, size, after, before, ilog);

        // 칸별 조작·측정 기록 = interactionEvidence 실체.
        const md = path.join(OUT, "interaction", `${tag}.md`);
        fs.mkdirSync(path.dirname(md), { recursive: true });
        const m = after.measured || {};
        fs.writeFileSync(md, [
          `# ${s.id} · ${dev.id} · 글자 ${size}`,
          ``,
          `- 측정 시각: ${new Date().toISOString()}`,
          `- after: ${AFTER}${s.url} (multicultural-board HEAD 4dca8c5)`,
          `- before: ${beforeAvailable ? BEFORE + beforeUrl + (s.before === "flow" ? "  ← 601a8f0 당시 실제 진입 흐름(이 화면은 이번 라운드 신규)" : "  ← 같은 라우트의 이전 상태") : "없음 (601a8f0 에 해당 라우트 없음)"}`,
          `- 입력 방식: ${dev.touch ? "터치 + 키보드" : "마우스 + 키보드"} (hasTouch=${dev.touch})`,
          ``,
          `## 실측`,
          `- 뷰포트 ${m.viewport ? `${m.viewport.w}x${m.viewport.h}` : "-"} / 문서 ${m.docScroll ? `${m.docScroll.w}x${m.docScroll.h}` : "-"}`,
          `- data-ux-text: \`${m.uxText}\``,
          `- 가로 넘침: ${m.overflowX ?? "-"}px`,
          `- 첫 화면 조작 ${m.foldControlCount ?? "-"}개 / 전체 ${m.controlCount ?? "-"}개`,
          `- 첫 화면 최소 조작 크기: ${m.minTapInFold ?? "-"}px (기준 ${dev.touch ? 48 : 44}px)`,
          `- 본문 글자 중앙값 ${m.bodyFontMedian ?? "-"}px / 최소 ${m.bodyFontMin ?? "-"}px / 제목 ${m.titleFont ?? "-"}px`,
          `- 본문 길이 ${m.textLen ?? "-"}자`,
          ``,
          `## 조작 검사`,
          ...ilog.map(l => `- ${l}`),
          ``,
          `## 콘솔 오류`,
          after.consoleErrors.length ? after.consoleErrors.map(e => `- ${e}`).join("\n") : "- 없음",
          ``,
          `## 네트워크 누수 (fixture 는 Firebase//api 로 나가면 안 된다)`,
          after.leaks.length ? after.leaks.map(l => `- ${l.kind} ${l.url}`).join("\n") : "- 없음",
          ``,
          `## 판정`,
          issues.length ? issues.map(i => `- FAIL ${i}`).join("\n") : "- 이 칸에서 발견한 문제 없음",
          ``,
        ].join("\n"), "utf8");

        screenRec.checks.push({
          device: dev.id, textSize: size,
          before: beforeAvailable ? beforeFile : "",
          after: fs.existsSync(afterFile) ? afterFile : "",
          interactionEvidence: md,
          inputMethod: dev.touch ? "터치(hasTouch) + 키보드 Tab 이동" : "마우스 포인터 + 키보드 Tab 이동",
          measured: m, leaks: after.leaks, consoleErrors: after.consoleErrors,
          interactLog: ilog, issues,
        });
        console.log(`${issues.length ? "FAIL" : "pass"} ${tag}${issues.length ? "  :: " + issues[0].slice(0, 90) : ""}`);
      }
    }
    put(screenRec);
    fs.writeFileSync(jsonPath, JSON.stringify(out, null, 1));
  }

  await browser.close();
  const all = out.flatMap(s => s.checks);
  console.log(`\n화면 ${out.length}개 / 칸 ${all.length}개 — 문제 없음 ${all.filter(c => !c.issues.length).length}, 문제 있음 ${all.filter(c => c.issues.length).length}`);
  console.log(`→ ${path.join(OUT, "capture.json")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

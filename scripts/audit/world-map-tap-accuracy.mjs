/**
 * 평면 세계지도 나라 찾기 — **클릭 좌표 정확도** 칸별 실측 (품질 하네스, 2026-09-14).
 *
 * capture.mjs 가 모든 화면에 공통으로 재는 것(넘침·조작 크기·글자 크기·Tab·탭 1회)
 * 위에, 이 화면에서만 뜻이 있는 것을 기기 5종 × 글자 2종으로 더 잰다.
 * 지도는 "누른 자리가 그 나라인가" 가 곧 기능이라, 버튼 하나를 눌러 본 것으로는
 * 감사가 끝나지 않는다. 특히 04 문서의 큰 글씨 계약은 이 화면에서
 * "글자를 키워도 지도 좌표가 어긋나지 않는가" 로 읽힌다 — 그래서 **basic 과 large
 * 양쪽에서 같은 대표점을 실제로 눌러** 같은 나라가 골라지는지 본다.
 *
 * 무엇을 어떻게 재는가:
 *   1. 대표점 클릭 5개(KOR·BRA·AUS·EGY·JAM — 큰 나라와 작은 섬을 섞는다).
 *      번들의 centroid 는 build-world-map.mjs 가 "그 나라 안에 있음"을 검증한
 *      대표점이다. 고른 나라는 **이름이 아니라 DOM 순서로** 확인한다 —
 *      WorldMapQuiz 가 bundle.countries 순서대로 <path class="wmq-land"> 를 그리고
 *      고른 나라에만 data-picked 를 달기 때문에, data-picked 의 인덱스가 곧
 *      countryId 다. 번역 이름에 기대지 않으므로 언어 설정과 무관하게 정확하다.
 *   2. 왕복 오차. 누른 화면 좌표를 화면 안에서 다시 경위도로 되돌려(컴포넌트가
 *      쓰는 getScreenCTM().inverse() 와 같은 경로) 의도한 경위도와의 차를 도 단위로
 *      적는다. 이 값이 커지면 "눌렀는데 옆 나라가 골라진다" 가 된다.
 *   3. 바다 클릭(태평양 -140,0): 오답이 아니라 안내가 뜨고, 이미 고른 나라가
 *      지워지지 않아야 한다(08 §3).
 *   4. 손가락 기기는 mouse 가 아니라 touchscreen.tap 으로 누른다 — 실제 입력 방식과
 *      같은 이벤트를 낸다.
 *
 * 결과는 capture.mjs 가 만든 칸별 interaction/*.md 뒤에 한 절로 덧붙인다.
 * 같은 절이 이미 있으면 지우고 다시 쓴다(두 번 돌려도 쌓이지 않는다).
 *
 * 실행: 저장소 루트에서 `node scripts/audit/world-map-tap-accuracy.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const AFTER = "http://localhost:3300";
const URL = "/ux-fixture/world-map?seed=1";
const OUT = path.resolve("reports/audit-20260914");
const ID = "advanced-world-map-quiz";
const HEAD_MARK = "## 지도 클릭 좌표 정확도";

const DEVICES = [
  { id: "tablet-portrait", width: 820, height: 1180, touch: true },
  { id: "tablet-landscape", width: 1180, height: 820, touch: true },
  { id: "chromebook", width: 1366, height: 768, touch: true },
  { id: "laptop", width: 1440, height: 900, touch: false },
  { id: "split-view", width: 800, height: 768, touch: true },
];
const SIZES = ["basic", "large"];
const TARGETS = ["KOR", "BRA", "AUS", "EGY", "JAM"];
const OCEAN = { lng: -140, lat: 0 }; // 태평양 한가운데

const bundle = JSON.parse(fs.readFileSync("public/maps/world-quiz.v1.json", "utf8"));
const order = bundle.countries.map((c) => c.countryId);
const byId = new Map(bundle.countries.map((c) => [c.countryId, c]));

/* page.evaluate 에 넘기는 것은 **문자열이 아니라 진짜 함수**다. 문자열 표현식에
   인자를 붙이면 Playwright 가 그 문자열을 평가한 결과(함수 객체)를 직렬화하려다
   undefined 를 돌려준다 — 실제로 그렇게 만들어 10칸이 전부 헛돌았다. */

/** 경위도 → 화면 좌표. 컴포넌트의 역변환과 같은 행렬(getScreenCTM)을 쓴다. */
const FORWARD = ([lng, lat]) => {
  const svg = document.querySelector(".wmq-map");
  const p = svg.createSVGPoint();
  p.x = lng + 180; p.y = 90 - lat;
  const s = p.matrixTransform(svg.getScreenCTM());
  return { x: s.x, y: s.y };
};

/** 화면 좌표 → 경위도 (컴포넌트 toLngLat 와 같은 경로). 왕복 오차 확인용. */
const INVERSE = ([x, y]) => {
  const svg = document.querySelector(".wmq-map");
  const p = svg.createSVGPoint();
  p.x = x; p.y = y;
  const q = p.matrixTransform(svg.getScreenCTM().inverse());
  return { lng: q.x - 180, lat: 90 - q.y };
};

/** 지금 골라진 나라의 countryId — 이름이 아니라 DOM 순서로 읽는다. */
const PICKED_INDEX = () =>
  [...document.querySelectorAll(".wmq-land")].findIndex((e) => e.hasAttribute("data-picked"));

const pickedText = async (page) =>
  (await page.locator(".wmq-picked").innerText()).trim().replace(/\s+/g, " ");

async function tap(page, dev, pt) {
  if (dev.touch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(220);
}

async function cell(browser, dev, size) {
  const ctx = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    hasTouch: dev.touch, isMobile: false, deviceScaleFactor: 1, reducedMotion: "reduce",
  });
  await ctx.addInitScript(`
    try { localStorage.setItem('childUx.settings', JSON.stringify({
      textSize: ${JSON.stringify(size)}, motion: 'reduced', tone: 'playful', sound: 'off', focus: false
    })); } catch (e) {}
  `);
  const page = await ctx.newPage();
  const lines = [];
  let allOk = true;
  try {
    await page.goto(AFTER + URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.locator(".wmq-map").waitFor({ timeout: 30000 });
    await page.locator(".wmq-target").waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);

    const geom = await page.evaluate(`(() => {
      const svg = document.querySelector('.wmq-map');
      const r = svg.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), vb: svg.getAttribute('viewBox'),
               uxText: document.documentElement.dataset.uxText,
               question: (document.querySelector('.wmq-target')||{}).innerText };
    })()`);
    lines.push(`- 지도 실제 크기 ${geom.w}x${geom.h}px, viewBox \`${geom.vb}\` → 경도 1도당 ${(geom.w / 360).toFixed(2)}px · 위도 1도당 ${(geom.h / 180).toFixed(2)}px`);
    lines.push(`- data-ux-text=\`${geom.uxText}\` · seed=1 의 1번 문제: ${String(geom.question).trim()}`);

    let maxErr = 0;
    for (const id of TARGETS) {
      const c = byId.get(id);
      const pt = await page.evaluate(FORWARD, [c.centroid[0], c.centroid[1]]);
      await tap(page, dev, pt);
      const idx = await page.evaluate(PICKED_INDEX);
      const got = idx >= 0 ? order[idx] : "(고른 것 없음)";
      const back = await page.evaluate(INVERSE, [pt.x, pt.y]);
      const err = Math.max(Math.abs(back.lng - c.centroid[0]), Math.abs(back.lat - c.centroid[1]));
      maxErr = Math.max(maxErr, err);
      const ok = got === id;
      if (!ok) allOk = false;
      lines.push(`- ${id} 대표점 (${c.centroid[0].toFixed(3)}, ${c.centroid[1].toFixed(3)}) → 화면 (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) ${dev.touch ? "탭" : "클릭"} → 고른 나라 \`${got}\` ${ok ? "일치" : "**어긋남**"} · 패널 "${await pickedText(page)}"`);
    }
    lines.push(`- 클릭 왕복 오차(누른 화면 좌표를 다시 경위도로): 최대 ${maxErr.toExponential(1)}도`);

    const beforeOcean = await page.evaluate(PICKED_INDEX);
    const opt = await page.evaluate(FORWARD, [OCEAN.lng, OCEAN.lat]);
    await tap(page, dev, opt);
    const afterOcean = await page.evaluate(PICKED_INDEX);
    const notice = (await page.locator(".wmq-notice").count())
      ? (await page.locator(".wmq-notice").innerText()).trim() : "(안내 없음)";
    const oceanOk = afterOcean === beforeOcean && /바다/.test(notice);
    if (!oceanOk) allOk = false;
    lines.push(`- 바다(${OCEAN.lng}, ${OCEAN.lat}) ${dev.touch ? "탭" : "클릭"} → 안내 "${notice}" · 고른 나라 \`${order[beforeOcean] ?? "-"}\` → \`${order[afterOcean] ?? "-"}\` (${afterOcean === beforeOcean ? "유지됨" : "**지워짐**"})`);
  } catch (e) {
    allOk = false;
    lines.push(`- 검사 실패: ${String(e).split("\n")[0].slice(0, 160)}`);
  }
  await ctx.close();
  return { lines, allOk };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
let bad = 0;
for (const dev of DEVICES) {
  for (const size of SIZES) {
    const { lines, allOk } = await cell(browser, dev, size);
    if (!allOk) bad++;
    const md = path.join(OUT, "interaction", `${ID}__${dev.id}__${size}.md`);
    const prev = fs.existsSync(md) ? fs.readFileSync(md, "utf8") : "";
    const cut = prev.indexOf(HEAD_MARK);
    const base = (cut >= 0 ? prev.slice(0, cut) : prev).replace(/\s+$/, "");
    fs.writeFileSync(md, `${base}\n\n${HEAD_MARK} (이 화면 고유 검사)\n${lines.join("\n")}\n- 판정: ${allOk ? "이 칸에서 누른 자리와 골라진 나라가 모두 일치" : "**어긋난 클릭이 있음**"}\n`, "utf8");
    console.log(`${allOk ? "pass" : "FAIL"} ${ID}__${dev.id}__${size}`);
  }
}
await browser.close();
console.log(bad ? `\n${bad}칸에서 클릭이 어긋났다.` : "\n10칸 전부에서 누른 자리와 골라진 나라가 일치했다.");

/**
 * U11 마무리 — 지구본 + 정보 패널 2열 배치 실측.
 *
 * 실제 Chrome 을 띄워 `/ux-fixture/globe?mode=explore&country=KR` (정보 패널이
 * 열린 상태)을 대표 viewport 에서 재고, 아래를 숫자로 뽑는다.
 *   1) .gq-stagewrap 이 2열(row)인지 1열(column)인지 — computed flex-direction
 *   2) canvas 실제 크기와 "왼쪽 열(.gq-stage)" 대비 채움 비율
 *   3) 패널이 캔버스를 덮지 않는지 — elementFromPoint(캔버스 중심)
 *   4) 가로 overflow 여부
 *
 * 실행: 저장소 루트에서 `node scripts/test-game-globe-layout.mjs`
 * (dev 서버가 떠 있어야 한다. 기본 http://localhost:3300)
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3300";
const OPEN = "/ux-fixture/globe?mode=explore&chrome=game&country=KR"; // 패널 열림
const CLOSED = "/ux-fixture/globe?mode=explore&chrome=game";          // 패널 닫힘

const VIEWPORTS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
  // 문턱 확인용 — 900px 경계와 "넓지만 세로로 긴 창".
  { name: "960x700", width: 960, height: 700 },
  { name: "880x700", width: 880, height: 700 },
  { name: "1000x1200", width: 1000, height: 1200 },
];

async function measure(page) {
  return page.evaluate(() => {
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {
        x: Math.round(b.x), y: Math.round(b.y),
        w: Math.round(b.width), h: Math.round(b.height),
      };
    };
    const wrap = document.querySelector(".gq-stagewrap");
    const stage = document.querySelector(".gq-stage");
    const panel = document.querySelector(".gq-panel");
    const canvas = document.querySelector(".gq-stage canvas");

    const cRect = canvas ? canvas.getBoundingClientRect() : null;
    let centerHit = null;
    let hitIsCanvas = null;
    if (cRect && cRect.width > 0) {
      const cx = Math.round(cRect.left + cRect.width / 2);
      const cy = Math.round(cRect.top + cRect.height / 2);
      const el = document.elementFromPoint(cx, cy);
      centerHit = el ? (el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "")) : null;
      hitIsCanvas = el === canvas;
    }

    // 뷰포트 밖으로 넘치는 제품 요소 (fixture 껍데기 제외)
    const overflow = [];
    document.querySelectorAll("body *").forEach((el) => {
      if (el.closest("[data-fixture-chrome]")) return;
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) return;
      if (b.right > window.innerWidth + 1 || b.left < -1) {
        overflow.push((el.tagName.toLowerCase() + "." + String(el.className || "").trim().split(/\s+/).join(".")).slice(0, 60));
      }
    });

    const wrapCS = wrap ? getComputedStyle(wrap) : null;
    return {
      wrap: r(wrap),
      stage: r(stage),
      panel: r(panel),
      canvas: r(canvas),
      flexDirection: wrapCS ? wrapCS.flexDirection : null,
      columns: wrapCS ? (wrapCS.flexDirection.startsWith("row") ? 2 : 1) : null,
      centerHit,
      hitIsCanvas,
      docScrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      overflow: Array.from(new Set(overflow)).slice(0, 8),
    };
  });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function run(urlPath) {
  const out = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(BASE + urlPath, { waitUntil: "networkidle" });
    // 지구 텍스처 로드 + ResizeObserver 안정화
    await page.waitForSelector(".gq-stage canvas", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1600);
    out.push({ viewport: vp.name, ...(await measure(page)) });
    await ctx.close();
  }
  return out;
}

const results = await run(OPEN);
const closed = await run(CLOSED);
await browser.close();

const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "n/a");

console.log("\n=== U11 지구본 2열 배치 실측 (" + OPEN + ") ===\n");
for (const r of results) {
  const canvasW = r.canvas ? r.canvas.w : 0;
  const canvasH = r.canvas ? r.canvas.h : 0;
  const stageW = r.stage ? r.stage.w : 0;
  const stageH = r.stage ? r.stage.h : 0;
  console.log(`[${r.viewport}]`);
  console.log(`  열 수            : ${r.columns} (flex-direction: ${r.flexDirection})`);
  console.log(`  stagewrap        : ${r.wrap ? r.wrap.w + "x" + r.wrap.h : "없음"}`);
  console.log(`  왼쪽 열 .gq-stage: ${stageW}x${stageH}`);
  console.log(`  canvas           : ${canvasW}x${canvasH}  (열 대비 폭 ${pct(canvasW, stageW)}, 높이 ${pct(canvasH, stageH)})`);
  console.log(`  canvas/viewport폭: ${pct(canvasW, r.innerW)}`);
  console.log(`  .gq-panel        : ${r.panel ? r.panel.w + "x" + r.panel.h + " @ x=" + r.panel.x + ",y=" + r.panel.y : "없음(패널 안 열림)"}`);
  console.log(`  캔버스 중심 히트 : ${r.hitIsCanvas ? "canvas 자기 자신 ✅" : "❌ " + r.centerHit}`);
  console.log(`  가로 overflow    : scrollW ${r.docScrollW} vs innerW ${r.innerW}${r.overflow.length ? " · " + r.overflow.join(", ") : ""}`);
  console.log("");
}

console.log("=== 패널 열기 전후 캔버스 크기 변화 (나라를 누른 순간 지구본이 튀는가) ===\n");
for (const r of results) {
  const c = closed.find((x) => x.viewport === r.viewport);
  const before = c && c.canvas ? c.canvas : { w: 0, h: 0 };
  const after = r.canvas ? r.canvas : { w: 0, h: 0 };
  const dw = before.w > 0 ? (((after.w - before.w) / before.w) * 100).toFixed(1) : "n/a";
  const dh = before.h > 0 ? (((after.h - before.h) / before.h) * 100).toFixed(1) : "n/a";
  console.log(
    `[${r.viewport}] 닫힘 ${before.w}x${before.h} → 열림 ${after.w}x${after.h}  (폭 ${dw}% · 높이 ${dh}%)` +
    `  열: ${c ? c.columns : "?"} → ${r.columns}`,
  );
}
console.log("");

const bad = results.filter((r) => r.hitIsCanvas === false);
if (bad.length) {
  console.log("FAIL 캔버스 중심이 다른 요소에 덮인 viewport: " + bad.map((b) => b.viewport).join(", "));
  process.exitCode = 1;
} else {
  console.log("OK 모든 viewport 에서 캔버스 중심이 캔버스 자신에게 히트됨");
}

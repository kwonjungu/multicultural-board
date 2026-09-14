/**
 * 단어 배우기(U07) — 화면이 실제로 요청하는 그림이 전부 있는지 검사.
 *
 * 꿀벌 큐레이션으로 바꾸면서 단원마다 꿀벌 얼굴이 붙었다. 경로를 손으로 적는
 * 자리라 오타 하나면 아이 화면에 깨진 그림이 남는다("있는 그림만 써라").
 * 그래서 코드를 읽지 않고 **브라우저가 실제로 요청한 URL** 을 모아 확인한다.
 *
 *   실행: node scripts/test-vocab-bee-assets.mjs [baseUrl]
 *
 * 두 가지를 본다:
 *   1) 응답이 200 이고 이미지인가 (네트워크 응답을 그대로 받는다)
 *   2) 실제로 디코딩됐는가 (naturalWidth > 0) — 200 이어도 0바이트면 안 보인다
 *
 * MoodArt 는 못 불러온 그림을 이모지로 조용히 대체하므로, 화면만 봐서는
 * 빠진 것을 못 찾는다. 이 검사가 그 자리를 메운다.
 *
 * ⚠ dev 서버를 새로 띄우지 말 것. 이미 떠 있는 포트를 읽기 전용으로 쓴다.
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3300";

const SCREENS = [
  { id: "tree", url: `${BASE}/ux-fixture/vocab?state=rich` },
  { id: "notebook", url: `${BASE}/ux-fixture/vocab?state=rich&open=notebook` },
  { id: "card", url: `${BASE}/ux-fixture/vocab?state=rich&word=happy&open=detail` },
];

/** 이 화면들이 쓰는 꿀벌 그림. 하나라도 빠지면 큐레이션이 반쪽이 된다. */
const REQUIRED = [
  "/ui-icons/v1/scene/bee-writing-256.png",
  "/ui-icons/v1/moods/happy-64.png",
  "/ui-icons/v1/moods/loved-64.png",
  "/ui-icons/v1/moods/curious-64.png",
  "/ui-icons/v1/moods/proud-64.png",
  "/ui-icons/v1/moods/excited-64.png",
  "/ui-icons/v1/moods/surprised-64.png",
  "/ui-icons/v1/moods/hopeful-64.png",
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const seen = new Map();   // url -> {status, type}
const broken = [];
const emojiFallback = [];

for (const s of SCREENS) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "ko-KR" });
  const page = await ctx.newPage();

  page.on("response", (res) => {
    const u = new URL(res.url());
    if (!/\.(png|webp|jpg|jpeg|svg)$/i.test(u.pathname)) return;
    seen.set(u.pathname, { status: res.status(), type: res.headers()["content-type"] || "" });
  });

  /* dev 는 첫 요청에서 컴파일한다. 그 사이 요청은 404/500 으로 떨어진다. */
  let ok = false;
  for (let a = 0; a < 6 && !ok; a++) {
    await page.goto(s.url, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(600);
    ok = await page.evaluate(() =>
      document.querySelectorAll("button").length > 0
      && !/This page could not be found|__webpack_modules__/.test(document.body.innerText));
    if (!ok) await page.waitForTimeout(3000);
  }
  if (!ok) throw new Error(`${s.id}: 페이지가 끝내 안 그려졌다 (${s.url})`);

  /* 디코딩까지 됐는지 — 200 이어도 0바이트면 naturalWidth 가 0 이다. */
  const imgs = await page.evaluate(() =>
    Array.from(document.images).map((im) => ({
      src: new URL(im.src, location.href).pathname,
      w: im.naturalWidth,
      shown: im.getBoundingClientRect().width > 0,
    })));
  for (const im of imgs) {
    if (im.shown && im.w === 0) broken.push(`${s.id} ${im.src} (naturalWidth=0)`);
  }

  /* MoodArt 가 이모지로 내려갔는지 — 내려갔다면 그림을 못 찾은 것이다. */
  const fell = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".vh-unitbee"))
      .filter((el) => el.tagName !== "IMG").length);
  if (fell > 0) emojiFallback.push(`${s.id}: 단원 꿀벌 ${fell}개가 이모지로 내려갔다`);

  await ctx.close();
}
await browser.close();

console.log("\n=== 화면이 실제로 요청한 그림 ===");
for (const [p, r] of [...seen].sort()) {
  const bad = r.status !== 200 || !r.type.startsWith("image/");
  console.log(`${bad ? "FAIL" : "ok  "} ${String(r.status).padEnd(4)} ${p}`);
  if (bad) broken.push(`${p} -> ${r.status} ${r.type}`);
}

console.log("\n=== 꿀벌 그림 필수 목록 ===");
for (const p of REQUIRED) {
  const r = seen.get(p);
  const bad = !r || r.status !== 200;
  console.log(`${bad ? "FAIL" : "ok  "} ${p}${r ? "" : "  (요청되지 않음)"}`);
  if (bad) broken.push(`${p} 미요청/실패`);
}

if (emojiFallback.length) {
  console.log("\n경고:");
  for (const m of emojiFallback) console.log("  " + m);
}

if (broken.length) {
  console.log(`\n실패 ${broken.length}건:`);
  for (const b of broken) console.log("  - " + b);
  process.exit(1);
}
console.log("\n모든 그림이 200 이고 디코딩됐다.");

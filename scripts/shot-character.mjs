/**
 * 캐릭터 합성 실측 — 시스템 Chrome 으로 fixture 를 열어 스크린샷을 남기고,
 * **계산값(plan) 대 실제 렌더 박스**의 오차를 DOM 에서 직접 잰다.
 *
 * 사용법: node scripts/shot-character.mjs [baseUrl]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * 목표(README §7.4): 320px 렌더 기준 접점 오차 3px 이내.
 * 이 수치가 통과해도 관통·공중에 뜸·피부색 불일치·잘림은 사람이 본다.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] || "http://localhost:3111";
const URL_ = `${BASE}/ux-fixture/character`;
const TOLERANCE = 3;
const OUT = resolve(ROOT, "reports/D");
mkdirSync(OUT, { recursive: true });

const manifest = JSON.parse(readFileSync(resolve(ROOT, "public/stickers/manifest-v2.json"), "utf8"));
const byId = new Map(manifest.assets.map((a) => [a.assetId, a]));

/** 계약(lib/childUx/renderPlanContract.ts)과 같은 식 — 검사기는 독립 계산한다. */
function contain(containerW, containerH, assetW, assetH) {
  const scale = Math.min(containerW / assetW, containerH / assetH);
  return { scale, offsetX: (containerW - assetW * scale) / 2, offsetY: (containerH - assetH * scale) / 2 };
}

const problems = [];
const envNotes = [];
const rows = [];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  // 측정 중 애니메이션 정지 + 결정적 설정(HARNESS §5).
  localStorage.setItem("childUx.settings", JSON.stringify({ textSize: "basic", motion: "reduced", tone: "playful" }));
});
const page = await ctx.newPage();
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
page.on("requestfailed", (r) => {
  // 외부 CDN 실패는 환경 사실이다 — 합성 검사의 합격 여부와 분리해 기록한다.
  (r.url().startsWith(BASE) ? problems : envNotes).push(`요청 실패: ${r.url()}`);
});

await page.goto(URL_, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(async () => {
  await Promise.all(
    Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))),
  );
});

const combos = await page.$$eval("[data-fixture-combo]", (els) => els.map((e) => e.getAttribute("data-fixture-combo")));

for (const combo of combos) {
  const section = page.locator(`[data-fixture-combo="${combo}"]`);
  await section.screenshot({ path: resolve(OUT, `character-${combo}.png`) });

  const measured = await page.evaluate((id) => {
    const out = [];
    const root = document.querySelector(`[data-fixture-combo="${id}"]`);
    for (const bgBox of root.querySelectorAll("[data-fixture-bg]")) {
      const bg = bgBox.getAttribute("data-fixture-bg");
      for (const sizeBox of bgBox.querySelectorAll('[data-fixture-size="320"]')) {
        const charRoot = sizeBox.querySelector("[data-ux-character]");
        if (!charRoot) continue;
        const rr = charRoot.getBoundingClientRect();
        const groups = charRoot.querySelectorAll("[data-ux-character-group]");
        const imgs = Array.from(charRoot.querySelectorAll("img[data-plan-box]"));
        const bodyIndex = imgs.findIndex((i) => i.getAttribute("data-layer-kind") === "body");
        const layers = imgs.map((img, index) => {
          const r = img.getBoundingClientRect();
          const [left, top, width, height] = img.getAttribute("data-plan-box").split(",").map(Number);
          return {
            kind: img.getAttribute("data-layer-kind"),
            assetId: img.getAttribute("data-layer-asset"),
            plan: { left, top, width, height },
            actual: { left: r.left - rr.left, top: r.top - rr.top, width: r.width, height: r.height },
            naturalWidth: img.naturalWidth,
            complete: img.complete,
            behindBody: bodyIndex >= 0 && index < bodyIndex,
          };
        });
        out.push({
          bg,
          status: charRoot.getAttribute("data-plan-status"),
          hash: charRoot.getAttribute("data-plan-hash"),
          resolved: charRoot.getAttribute("data-plan-asset"),
          rootSize: { w: rr.width, h: rr.height },
          groupCount: groups.length,
          layers,
        });
      }
    }
    return out;
  }, combo);

  // 배경 3종의 plan 이 서로 같아야 한다 — 배경색이 합성을 바꾸면 안 된다.
  const hashes = new Set(measured.map((m) => m.hash));
  if (hashes.size > 1) problems.push(`[${combo}] 배경별 planHash 가 다르다: ${[...hashes].join(", ")}`);

  for (const m of measured) {
    if (m.groupCount > 1) problems.push(`[${combo}/${m.bg}] 부유 그룹이 ${m.groupCount}개 — 몸과 착용물은 한 그룹이어야 한다(ART-04)`);
    const shadows = m.layers.filter((l) => l.kind === "environment-shadow");
    if (shadows.length > 1) problems.push(`[${combo}/${m.bg}] 그림자 ${shadows.length}개 — 장면 접지용 1개만`);

    for (const l of m.layers) {
      const dx = Math.abs(l.actual.left - l.plan.left);
      const dy = Math.abs(l.actual.top - l.plan.top);
      const dw = Math.abs(l.actual.width - l.plan.width);
      const dh = Math.abs(l.actual.height - l.plan.height);
      const worst = Math.max(dx, dy, dw, dh);
      rows.push({ combo, bg: m.bg, kind: l.kind, asset: l.assetId, 오차px: Math.round(worst * 100) / 100 });
      if (worst > TOLERANCE) {
        problems.push(`[${combo}/${m.bg}] ${l.kind} ${l.assetId} 렌더 박스가 계산값과 ${worst.toFixed(2)}px 어긋남`);
      }
      if (!l.complete || (l.naturalWidth === 0 && !l.assetId.startsWith("placeholder/"))) {
        problems.push(`[${combo}/${m.bg}] ${l.assetId} 이미지 로드 실패`);
      }
    }

    // 접점 검사: 몸 앵커 위에 착용물 자체 접점이 놓였는가 (320px 기준 3px).
    const body = m.layers.find((l) => l.kind === "body");
    const bodyAsset = body && byId.get(body.assetId);
    if (bodyAsset) {
      const t = contain(320, 320, bodyAsset.sourceWidth, bodyAsset.sourceHeight);
      for (const l of m.layers) {
        const asset = byId.get(l.assetId);
        if (!asset || !asset.attachTo || !asset.grip) continue;
        const target = bodyAsset.anchors[asset.attachTo];
        const grip = asset.anchors[asset.grip];
        if (!target || !grip) continue;
        const expected = { x: t.offsetX + target.x * t.scale, y: t.offsetY + target.y * t.scale };
        const q = l.actual.width / asset.sourceWidth;
        const got = { x: l.actual.left + grip.x * q, y: l.actual.top + grip.y * q };
        if (asset.placement === "ground-prop") {
          // 바닥 소품은 일부러 옆으로 비켜 세운다 — 공유하는 건 접지선(y)뿐이다.
          const errY = Math.abs(got.y - expected.y);
          rows.push({ combo, bg: m.bg, kind: "접지선:y", asset: l.assetId, 오차px: Math.round(errY * 100) / 100 });
          if (errY > TOLERANCE) {
            problems.push(`[${combo}/${m.bg}] ${l.assetId} 접지선 오차 ${errY.toFixed(2)}px > ${TOLERANCE}px`);
          }
          // 몸 앞을 가리면 '쥐고 있다'로 오해된다. 정사각 상자 안에는 소품이
          // 완전히 비켜설 자리가 없으므로, (1) 캐릭터 뒤에 그리고 (2) 왼쪽
          // 절반을 넘지 않는다는 두 조건으로 판정한다. 실루엣 bbox 와의 겹침은
          // 숫자로 남겨 시각 검수가 보게 한다.
          const bb = bodyAsset.alphaBounds;
          const bodyLeft = t.offsetX + bb.left * t.scale;
          const bodyCenter = t.offsetX + ((bb.left + bb.right + 1) / 2) * t.scale;
          const propContentRight = l.actual.left + (asset.alphaBounds.right + 1) * q;
          rows.push({ combo, bg: m.bg, kind: "소품-몸bbox겹침", asset: l.assetId, 오차px: Math.round((propContentRight - bodyLeft) * 100) / 100 });
          if (propContentRight > bodyCenter + TOLERANCE) {
            problems.push(`[${combo}/${m.bg}] ${l.assetId} 이 캐릭터 중앙(${bodyCenter.toFixed(1)}px)까지 덮었다 — 소품은 옆에 서야 한다`);
          }
          if (!l.behindBody) {
            problems.push(`[${combo}/${m.bg}] ${l.assetId} 이 몸보다 앞에 그려졌다 — 손 마스크 없이 전면 배치 금지`);
          }
          continue;
        }
        const err = Math.hypot(got.x - expected.x, got.y - expected.y);
        rows.push({ combo, bg: m.bg, kind: `접점:${asset.attachTo}`, asset: l.assetId, 오차px: Math.round(err * 100) / 100 });
        if (err > TOLERANCE) {
          problems.push(`[${combo}/${m.bg}] ${l.assetId} 접점(${asset.attachTo}) 오차 ${err.toFixed(2)}px > ${TOLERANCE}px`);
        }
      }
    }
  }

  const first = measured[0];
  if (first) {
    console.log(`${combo}: status=${first.status} asset=${first.resolved} hash=${first.hash} layers=${first.layers.map((l) => l.kind).join("+")}`);
  }
}

await page.screenshot({ path: resolve(OUT, "character-all.png"), fullPage: true });
await ctx.close();
await browser.close();

console.table(rows.filter((r) => r.오차px > 0.5).slice(0, 40));
console.log(`측정 ${rows.length}건, 최대 오차 ${Math.max(0, ...rows.map((r) => r.오차px))}px (허용 ${TOLERANCE}px)`);
console.log(`스크린샷: reports/D/`);
if (envNotes.length) {
  console.log("");
  console.log("환경 메모(합격 여부와 무관):");
  for (const n of new Set(envNotes)) console.log(" -", n);
}
if (problems.length) {
  console.log("\n문제:");
  for (const p of problems) console.log(" -", p);
} else {
  console.log("\n수치 항목 이상 없음 — 시각 판정은 스크린샷을 직접 볼 것");
}
process.exit(problems.length ? 1 : 0);

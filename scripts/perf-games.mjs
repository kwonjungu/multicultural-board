/**
 * 게임 성능 측정 — 06 문서 §7 "성능 예산과 fallback".
 *
 *   실행: node scripts/perf-games.mjs [--base=http://localhost:3300]
 *
 * 문서가 정한 목표(구현 목표이지 실측 성과가 아니라고 문서가 못 박아 두었다):
 *   - 지속 플레이 **30fps 이상**을 최소, 60fps 를 선호
 *   - **p95 frame time 약 33ms 이하**, 긴 프레임을 기록
 *   - 클릭/터치 시 **시각적 피드백 100ms 이내**
 *   - 한 턴 장시간 정지·다중 canvas/RAF 누수 없음
 *
 * ── 이 측정의 한계를 먼저 적는다 ─────────────────────────────────
 * 실기기(태블릿·크롬북)가 없다. 여기 수치는 전부 **개발 PC 의 headless
 * Chrome** 이고, 06 §7 이 허용한 "viewport/CPU throttle 대리 측정" 이다.
 * 그래서 저사양 기기를 흉내 내려고 CDP 로 CPU 를 4배 느리게 걸어 한 번 더
 * 잰다. **실기기 PASS 를 주장하지 않는다.**
 *
 * 또 하나: dev 서버는 소스맵·HMR·개발 전용 검사를 달고 돌기 때문에 프로덕션
 * 빌드보다 느리다. 여기 값은 **하한(이보다 나쁘지 않다)** 으로 읽어야 한다.
 */
import { chromium } from "playwright-core";

const baseArg = process.argv.find((a) => a.startsWith("--base="));
const BASE = baseArg ? baseArg.slice(7) : "http://localhost:3300";

/** 잴 대상. 게임 로비 fixture 에서 이름으로 찾아 들어간다. */
const TARGETS = [
  { id: "marble", label: "꿀벌 월드 마블", play: "roll" },
  { id: "globe", label: "다문화 지구본", play: "none" },
  { id: "halligalli", label: "할리갈리", play: "none" },
];

async function reachable(url) {
  try { return (await fetch(url)).ok; } catch { return false; }
}
if (!(await reachable(BASE))) {
  console.log(`건너뜀 — ${BASE} 에 dev 서버가 없다.`);
  process.exit(0);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

/** 한 판을 열고 프레임을 샘플링한다. */
async function measure(target, { throttle }) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "ko-KR" });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });

  await page.goto(`${BASE}/ux-fixture/game`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1800);
  await page.locator("button").filter({ hasText: target.label }).first().click();
  await page.waitForTimeout(2200);

  // 캐릭터 설정 같은 준비 화면 통과
  const start = page.locator("button").filter({ hasText: /^▶ 시작!/ }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(1800); }

  /* ── 입력 지연: 누른 순간 → 화면이 실제로 바뀐 첫 프레임 ── */
  let inputMs = null;
  const clickable = page.locator('[data-ux-role="control"], [data-ux-role="action"]').first();
  if (await clickable.count()) {
    await page.evaluate(() => {
      window.__firstPaintAfterInput = null;
      window.__armInput = () => {
        const t0 = performance.now();
        const obs = new MutationObserver(() => {
          if (window.__firstPaintAfterInput === null) {
            // 변화를 감지한 다음 프레임이 실제로 그려진 시점을 쓴다.
            requestAnimationFrame(() => {
              if (window.__firstPaintAfterInput === null) {
                window.__firstPaintAfterInput = performance.now() - t0;
              }
            });
          }
        });
        obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        window.setTimeout(() => obs.disconnect(), 2000);
      };
    });
    await page.evaluate(() => window.__armInput());
    await clickable.click();
    await page.waitForTimeout(1200);
    inputMs = await page.evaluate(() => window.__firstPaintAfterInput);
  }

  /* ── 프레임 샘플링 ── */
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    window.__rafOn = true;
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__rafOn) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // 놀이다운 부하를 준다 — 마블은 주사위를 굴려 말이 움직이게 한다.
  if (target.play === "roll") {
    const roll = page.locator(".mb-diceroll").first();
    for (let i = 0; i < 2 && (await roll.count()); i++) {
      try { await roll.click({ timeout: 3000 }); } catch { break; }
      await page.waitForTimeout(2600);
    }
  }
  await page.waitForTimeout(3000);

  const frames = await page.evaluate(() => { window.__rafOn = false; return window.__frames; });
  const canvases = await page.evaluate(() => document.querySelectorAll("canvas").length);
  await ctx.close();

  const clean = frames.slice(1).filter((d) => Number.isFinite(d) && d > 0);
  clean.sort((a, b) => a - b);
  const p = (q) => clean.length ? clean[Math.min(clean.length - 1, Math.floor(clean.length * q))] : NaN;
  const avg = clean.reduce((s, d) => s + d, 0) / (clean.length || 1);
  return {
    frames: clean.length,
    fps: +(1000 / avg).toFixed(1),
    p50: +p(0.5).toFixed(1),
    p95: +p(0.95).toFixed(1),
    longFrames: clean.filter((d) => d > 50).length,
    worst: +(clean[clean.length - 1] ?? 0).toFixed(1),
    inputMs: inputMs === null ? null : +inputMs.toFixed(1),
    canvases,
  };
}

console.log("측정 환경: headless Chrome, dev 서버(프로덕션보다 느리다), 1366x768");
console.log("06 §7 목표: 30fps 이상 · p95 33ms 이하 · 입력 피드백 100ms 이내\n");

for (const t of TARGETS) {
  for (const throttle of [1, 4]) {
    let r;
    try { r = await measure(t, { throttle }); }
    catch (e) { console.log(`${t.label} (CPU ${throttle}x) — 실패: ${String(e.message).split("\n")[0].slice(0, 70)}`); continue; }
    const okFps = r.fps >= 30 ? "✓" : "✗";
    const okP95 = r.p95 <= 33 ? "✓" : "✗";
    const okIn = r.inputMs === null ? "?" : r.inputMs <= 100 ? "✓" : "✗";
    console.log(
      `${t.label.padEnd(14)} CPU ${throttle}x | ` +
      `fps ${String(r.fps).padStart(5)} ${okFps} | ` +
      `p50 ${String(r.p50).padStart(5)}ms | p95 ${String(r.p95).padStart(5)}ms ${okP95} | ` +
      `긴프레임(>50ms) ${String(r.longFrames).padStart(3)} | 최악 ${String(r.worst).padStart(6)}ms | ` +
      `입력 ${r.inputMs === null ? "  -  " : String(r.inputMs).padStart(5) + "ms"} ${okIn} | ` +
      `canvas ${r.canvases} | 표본 ${r.frames}`,
    );
  }
}

await browser.close();
console.log("\n주의: 실기기 검수가 아니다. 06 §7 이 허용한 CPU throttle 대리 측정이며 실기기 PASS 를 주장하지 않는다.");

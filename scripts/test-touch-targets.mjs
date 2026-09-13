/**
 * 터치 영역 회귀 검사 (U02 / 04 §2).
 *
 *   실행: node scripts/test-touch-targets.mjs [--base=http://localhost:3300]
 *   (dev 서버가 떠 있어야 한다. 서버가 없으면 '건너뜀'으로 끝난다.)
 *
 * 계약: 손가락으로 누르는 기기(pointer: coarse)에서 모든 조작은 48px 이상.
 * 마우스(pointer: fine)에서는 44px 이상. 값은 lib/childUx/tokens.json 의
 * control-min 하나에서 나오므로 여기에 숫자를 다시 적지 않고 실제 계산값을
 * 브라우저에서 읽어 기준으로 쓴다.
 *
 * 왜 실행 검사인가: 이 계약은 **인라인 style 하나로 조용히 깨진다.**
 * `data-ux-role="control"` 이 붙어 있어도 같은 요소에 `width: 44, height: 44`
 * 를 박아 두면 인라인이 이겨 토큰 최소 크기가 무력화된다. 실제로 그림책·칭찬·
 * 단어 퀴즈에서 그렇게 깨져 있었고(44x44, 36x33), 소스만 훑는 검사로는
 * 잡히지 않았다.
 *
 * fixture 자신의 개발용 조작판은 제품 UI 가 아니므로 `data-fixture-chrome`
 * 표시가 붙은 것을 제외한다.
 */
import { chromium } from "playwright-core";

const baseArg = process.argv.find((a) => a.startsWith("--base="));
const BASE = baseArg ? baseArg.slice(7) : "http://localhost:3300";

/** 검사할 화면. fixture 가 있는 것만 넣는다. */
const SCREENS = [
  ["entry", "/"],
  ["hub", "/ux-fixture/hub"],
  ["board", "/ux-fixture/board"],
  ["post", "/ux-fixture/post?open=1"],
  ["storybook", "/ux-fixture/storybook"],
  ["discussion", "/ux-fixture/discussion"],
  ["praise", "/ux-fixture/praise"],
  ["quest", "/ux-fixture/quest"],
  ["character", "/ux-fixture/character"],
  ["roster", "/ux-fixture/roster"],
  ["drawing", "/ux-fixture/drawing"],
  ["whiteboard", "/ux-fixture/whiteboard"],
  ["recorder", "/ux-fixture/recorder"],
  ["interpreter", "/ux-fixture/interpreter"],
  ["game-lobby", "/ux-fixture/game-lobby"],
  ["globe", "/ux-fixture/globe?mode=explore&chrome=game&country=KR"],
  ["vocab-home", "/ux-fixture/vocab?state=rich"],
  ["vocab-detail", "/ux-fixture/vocab?state=rich&word=happy&open=detail"],
  ["vocab-quiz", "/ux-fixture/vocab?state=rich&word=happy&open=quiz"],
  ["vocab-review", "/ux-fixture/vocab?state=rich&word=happy&open=review"],
  ["vocab-notebook", "/ux-fixture/vocab?state=rich&open=notebook"],
];

async function reachable(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch { return false; }
}

if (!(await reachable(BASE))) {
  console.log(`건너뜀 — ${BASE} 에 dev 서버가 없다. 띄운 뒤 다시 실행할 것.`);
  process.exit(0);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

/** 한 기기 종류에서 모든 화면을 재고 미달 목록을 돌려준다. */
async function run(label, contextOpts) {
  const ctx = await browser.newContext({ locale: "ko-KR", ...contextOpts });
  const found = [];
  const skipped = [];
  for (const [name, path] of SCREENS) {
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + path, { waitUntil: "load", timeout: 45000 });
      await page.waitForTimeout(2200);
      const r = await page.evaluate(() => {
        const min = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--ux-control-min"),
        ) || 44;
        const bad = [];
        const sel = "button, a[href], [role=button], input[type=checkbox], input[type=radio], select";
        for (const el of document.querySelectorAll(sel)) {
          if (el.closest("[data-fixture-chrome]")) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const q = el.getBoundingClientRect();
          if (q.width < 4 || q.height < 4) continue;      // 접혀 있거나 숨은 것
          // 반올림 오차 1px 은 봐준다.
          if (q.width >= min - 1 && q.height >= min - 1) continue;
          bad.push({
            label: (el.innerText || el.getAttribute("aria-label") || el.tagName)
              .replace(/\s+/g, " ").trim().slice(0, 16),
            size: `${Math.round(q.width)}x${Math.round(q.height)}`,
          });
        }
        return { min, bad, coarse: window.matchMedia("(pointer: coarse)").matches };
      });
      if (r.bad.length) found.push({ name, min: r.min, coarse: r.coarse, bad: r.bad });
    } catch (e) {
      skipped.push(`${name}: ${String(e.message).split("\n")[0].slice(0, 60)}`);
    }
    await page.close();
  }
  await ctx.close();
  return { found, skipped };
}

let failed = 0;

for (const [label, opts] of [
  ["터치 (pointer: coarse)", { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true }],
  ["마우스 (pointer: fine)", { viewport: { width: 1366, height: 768 } }],
]) {
  const { found, skipped } = await run(label, opts);
  const total = found.reduce((n, f) => n + f.bad.length, 0);
  console.log(`\n== ${label} — 화면 ${SCREENS.length}개, 미달 ${total}건 ==`);
  for (const f of found) {
    console.log(`  ${f.name} (기준 ${f.min}px, coarse=${f.coarse})`);
    for (const x of f.bad.slice(0, 8)) console.log(`     ${x.size.padStart(8)}  ${x.label}`);
    if (f.bad.length > 8) console.log(`     … 외 ${f.bad.length - 8}건`);
  }
  if (skipped.length) {
    console.log(`  (열지 못한 화면 ${skipped.length}개)`);
    for (const s of skipped) console.log(`     ${s}`);
  }
  failed += total;
}

console.log(failed === 0
  ? "\n터치 영역 계약 통과 — 모든 화면의 조작이 최소 크기를 지킨다"
  : `\n실패 — 미달 ${failed}건`);
process.exitCode = failed === 0 ? 0 : 1;

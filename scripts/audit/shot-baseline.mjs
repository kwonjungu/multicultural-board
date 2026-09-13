/**
 * T00 baseline — 04_아동서비스_디자인검수와기기최적화.md §4 기기 매트릭스 실측.
 *
 * 사용법: node scripts/audit/shot-baseline.mjs [baseUrl]
 * 전제: 개발 서버가 떠 있어야 한다(fixture 는 production 에서 404).
 *
 * 재는 것: 뷰포트 첫 화면에 실제로 보이는 콘텐츠, 문서 가로 overflow,
 *          조작 영역 실측 bounding box, 글자 잘림, 역할별 computed font-size.
 * 못 재는 것: 실제 기기 터치감·스크린리더·회전. viewport 시뮬레이션임을 명시한다.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
const OUT = "reports/audit-20260913/baseline";
mkdirSync(OUT, { recursive: true });

/**
 * 기기 규격은 harness/contract.json 의 devices 와 **정확히 일치**해야 한다 —
 * gate 가 그 id 로 checks 행을 찾는다. 아래 5종이 필수이고, phone 은 04 §4 의
 * 보조 호환 대상이라 gate 밖 참고용으로만 함께 잰다.
 */
const VIEWS = [
  { id: "tablet-portrait", width: 820, height: 1180, klass: "태블릿세로", touch: true },
  { id: "tablet-landscape", width: 1180, height: 820, klass: "태블릿가로", touch: true },
  { id: "chromebook", width: 1366, height: 768, klass: "크롬북", touch: true },
  { id: "laptop", width: 1440, height: 900, klass: "노트북", touch: false },
  { id: "split-view", width: 800, height: 768, klass: "화면분할", touch: true },
  { id: "phone-390", width: 390, height: 844, klass: "보조폰(gate 밖)", touch: true },
];
/** gate 는 5기기 × 기본·큰 글씨를 모두 요구한다. 보조폰만 기본 글씨로 끝낸다. */
const LARGE_OFF = new Set(["phone-390"]);

const SCREENS = [
  { id: "root", url: `${BASE}/`, area: "입장" },
  { id: "entry", url: `${BASE}/ux-fixture/entry`, area: "입장" },
  { id: "hub-student", url: `${BASE}/ux-fixture/hub?role=student`, area: "홈" },
  { id: "hub-student-vi", url: `${BASE}/ux-fixture/hub?role=student&lang=vi`, area: "홈" },
  { id: "hub-teacher", url: `${BASE}/ux-fixture/hub?role=teacher&live=whiteboard`, area: "홈" },
  { id: "board", url: `${BASE}/ux-fixture/board`, area: "패들렛" },
  { id: "post", url: `${BASE}/ux-fixture/post`, area: "패들렛" },
  { id: "game", url: `${BASE}/ux-fixture/game`, area: "친구와놀기" },
  { id: "quest", url: `${BASE}/ux-fixture/quest`, area: "칭찬" },
  { id: "character", url: `${BASE}/ux-fixture/character`, area: "칭찬" },
  { id: "vocab-home-new", url: `${BASE}/ux-fixture/vocab?state=new`, area: "단어배우기" },
  { id: "vocab-home", url: `${BASE}/ux-fixture/vocab?state=progress`, area: "단어배우기" },
  { id: "vocab-home-rich", url: `${BASE}/ux-fixture/vocab?state=rich`, area: "단어배우기" },
  { id: "vocab-home-vi", url: `${BASE}/ux-fixture/vocab?state=rich&lang=vi`, area: "단어배우기" },
  { id: "recorder", url: `${BASE}/ux-fixture/recorder`, area: "단어배우기" },
  { id: "roster", url: `${BASE}/ux-fixture/roster`, area: "교사도구" },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
const problems = [];

for (const s of SCREENS) {
  for (const v of VIEWS) {
    const sizes = LARGE_OFF.has(v.id) ? ["basic"] : ["basic", "large"];
    for (const size of sizes) {
      const ctx = await browser.newContext({
        viewport: { width: v.width, height: v.height },
        deviceScaleFactor: 1,
        hasTouch: v.touch,
        isMobile: false,
        locale: "ko-KR",
        timezoneId: "Asia/Seoul",
      });
      await ctx.addInitScript((sz) => {
        localStorage.setItem(
          "childUx.settings",
          JSON.stringify({ textSize: sz, motion: "reduced", tone: "playful" })
        );
      }, size);
      const page = await ctx.newPage();
      const tag = `${s.id}/${v.id}/${size}`;
      const errs = [];
      page.on("pageerror", (e) => errs.push(`pageerror: ${e.message.slice(0, 160)}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") errs.push(`console: ${msg.text().slice(0, 160)}`);
      });

      try {
        await page.goto(s.url, { waitUntil: "networkidle", timeout: 60000 });
        await page.evaluate(() => document.fonts.ready);
      } catch (e) {
        problems.push(`[${tag}] 진입 실패: ${e.message.slice(0, 120)}`);
        await ctx.close();
        continue;
      }

      const m = await page.evaluate(() => {
        const px = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
        const q = (sel) => document.querySelector(sel);
        const vh = window.innerHeight;
        const nameOf = (el) => {
          const cls = (el.className && el.className.toString().split(" ")[0]) || "-";
          return `${el.tagName.toLowerCase()}.${cls}`.slice(0, 30);
        };

        // 첫 화면(뷰포트 안)에 실제로 보이는 것 — 04 §1 "5초 안에 할 일을 아는가"
        const inFold = (el) => {
          const r = el.getBoundingClientRect();
          return r.top < vh && r.bottom > 0 && r.width > 0 && r.height > 0;
        };

        // fixture 껍데기(개발용 스위치·누수 배너)는 제품 UI 가 아니므로 측정에서 뺀다.
        const isChrome = (el) => !!el.closest("[data-fixture-chrome]");
        const ctrlSel = '[data-ux-role="control"],[data-ux-role="action"],button,[role="button"]';
        const controls = Array.from(document.querySelectorAll(ctrlSel)).filter(
          (el) => el.getBoundingClientRect().height > 0 && !isChrome(el)
        );
        const foldControls = controls.filter(inFold);
        const smallHit = controls
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.height > 0 && (r.height < 44 || r.width < 44);
          })
          .map((el) => {
            const r = el.getBoundingClientRect();
            return `${nameOf(el)} ${Math.round(r.width)}x${Math.round(r.height)}`;
          });

        const clipped = Array.from(document.querySelectorAll("[data-ux-role]"))
          .filter((el) => !isChrome(el))
          .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
          .map((el) => `${nameOf(el)}: ${(el.textContent || "").trim().slice(0, 20)}`);

        // 장식 대 콘텐츠: 첫 화면에서 장식 레이어가 몇 개나 자리를 차지하는가
        const decor = Array.from(
          document.querySelectorAll('[data-ux-decor],[aria-hidden="true"]')
        ).filter((el) => inFold(el) && !isChrome(el)).length;

        return {
          docOverflow: Math.max(
            0,
            document.documentElement.scrollWidth - document.documentElement.clientWidth
          ),
          pageHeight: document.documentElement.scrollHeight,
          foldRatio: +(vh / Math.max(vh, document.documentElement.scrollHeight)).toFixed(2),
          controls: controls.length,
          foldControls: foldControls.length,
          smallHit,
          clipped,
          decor,
          body: px(q('[data-ux-role="body"]')),
          label: px(q('[data-ux-role="label"]')),
          secondary: px(q('[data-ux-role="secondary"]')),
          title: px(q('[data-ux-role="title"]')),
          uxRoots: document.querySelectorAll("[data-ux-root]").length,
          legacy: document.querySelectorAll("[data-ux-legacy]").length,
        };
      });

      await page.screenshot({ path: `${OUT}/${s.id}__${v.id}__${size}__fold.png` });
      await page.screenshot({ path: `${OUT}/${s.id}__${v.id}__${size}__full.png`, fullPage: true });

      rows.push({
        area: s.area, screen: s.id, view: v.id, size,
        overflow: m.docOverflow, pageH: m.pageHeight, fold: m.foldRatio,
        ctrl: m.controls, foldCtrl: m.foldControls, small: m.smallHit.length,
        clip: m.clipped.length, decor: m.decor,
        body: m.body, label: m.label, sec: m.secondary, title: m.title,
        roots: m.uxRoots, legacy: m.legacy, errs: errs.length,
      });

      if (m.docOverflow > 0) problems.push(`[${tag}] 가로 overflow ${m.docOverflow}px`);
      if (m.smallHit.length) problems.push(`[${tag}] 44px 미만 조작 ${m.smallHit.length}건: ${m.smallHit.slice(0, 6).join(" | ")}`);
      if (m.clipped.length) problems.push(`[${tag}] 글자 잘림 ${m.clipped.length}건: ${m.clipped.slice(0, 4).join(" | ")}`);
      if (m.uxRoots > 1) problems.push(`[${tag}] data-ux-root ${m.uxRoots}개 — 화면당 1개여야 이중 배율이 없다`);
      for (const e of errs.slice(0, 3)) problems.push(`[${tag}] ${e}`);

      await ctx.close();
    }
  }
  process.stdout.write(`· ${s.id} 완료\n`);
}

await browser.close();
writeFileSync(
  `${OUT}/measurements.json`,
  JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), rows, problems }, null, 2)
);
console.table(rows);
console.log(`\n측정 ${rows.length}건 / 문제 ${problems.length}건 → ${OUT}/measurements.json`);
for (const p of problems) console.log(" -", p);

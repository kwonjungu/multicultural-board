/**
 * 홈 허브 · 루트 진입 실측 — 시스템 Chrome 으로 열어 스크린샷과 계산값을 잰다.
 * 사용법: node scripts/shot-hub.mjs [baseUrl]
 * 전제: 개발 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 *
 * 재는 것: 가로 overflow, control/action 최소 56px, 글자 잘림, label/secondary 하한,
 *          활동 카드 수·열 수·최소 높이.
 * 못 재는 것: 실제 키보드 순서·스크린리더 낭독·세션 전환 회귀. 그건 Q 하네스 몫이다.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3111";
mkdirSync("reports/B", { recursive: true });

const VIEWS = [
  { id: "360", width: 360, height: 800 },
  { id: "768", width: 768, height: 1024 },
  { id: "1280", width: 1280, height: 900 },
];
const TEXT = ["basic", "large"];

/**
 * 화면 조합. lang=vi 는 t() 가 한국어를 병기해 가장 긴 문자열이 된다.
 * steps 는 첫 측정 뒤 이어서 재는 상태들이다(펼친 패널·모달까지 봐야 한다).
 */
const SCREENS = [
  {
    id: "root",
    url: `${BASE}/`,
    steps: [{ id: "create", click: "✨ 새 교실 만들기 선생님" }],
  },
  {
    id: "hub-student",
    url: `${BASE}/ux-fixture/hub?role=student`,
    steps: [{ id: "lang", click: "언어" }],
  },
  { id: "hub-student-vi", url: `${BASE}/ux-fixture/hub?role=student&lang=vi` },
  { id: "hub-live", url: `${BASE}/ux-fixture/hub?role=student&live=storybook` },
  {
    id: "hub-teacher",
    url: `${BASE}/ux-fixture/hub?role=teacher&live=whiteboard`,
    /* 관리 패널(RoomManagePanel)은 Firebase 구독이 본체라 fixture 에서 열 수 없다 —
       펼침 상태의 치수는 이 스크립트로 재지 못한다(보고서의 미검증 항목). */
    steps: [{ id: "qr", click: "입장 QR", closeKey: "Escape" }],
  },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];
const rows = [];

for (const screen of SCREENS) {
  for (const v of VIEWS) {
    for (const size of TEXT) {
      const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1 });
      await ctx.addInitScript((s) => {
        localStorage.setItem("childUx.settings", JSON.stringify({ textSize: s, motion: "reduced", tone: "playful" }));
      }, size);
      const page = await ctx.newPage();
      const base = `${screen.id}/${v.id}/${size}`;
      page.on("pageerror", (e) => problems.push(`[${base}] pageerror: ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error") problems.push(`[${base}] console: ${m.text()}`); });

      await page.goto(screen.url, { waitUntil: "networkidle", timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);

      const measure = async (step) => {
        const tag = `${base}/${step}`;
        const m = await page.evaluate(() => {
          const cs = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
          const pick = (sel) => document.querySelector(sel);
          const name = (el) => `${el.className || el.tagName}`.trim().slice(0, 34);
          const controls = Array.from(document.querySelectorAll('[data-ux-role="control"],[data-ux-role="action"]'));
          const tooSmall = controls
            .filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.height < 56 || r.width < 56); })
            .map((el) => { const r = el.getBoundingClientRect(); return `${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`; });
          // 글자 잘림: 역할 있는 요소가 제 내용보다 좁거나(가로) 낮으면(세로) 잘린 것이다.
          const clipped = Array.from(document.querySelectorAll('[data-ux-role]'))
            .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
            .map((el) => `${name(el)}: ${(el.textContent || "").trim().slice(0, 18)}`);
          const shortCards = Array.from(document.querySelectorAll('.hub-card'))
            .filter((el) => el.getBoundingClientRect().height < 112)
            .map((el) => `${name(el)} h=${Math.round(el.getBoundingClientRect().height)}`);
          const cardCols = (() => {
            const cards = Array.from(document.querySelectorAll('.hub-card'));
            if (!cards.length) return null;
            const tops = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top)));
            return Math.round(cards.length / tops.size);
          })();
          return {
            body: cs(pick('[data-ux-role="body"]')),
            label: cs(pick('[data-ux-role="label"]')),
            secondary: cs(pick('[data-ux-role="secondary"]')),
            title: cs(pick('[data-ux-role="title"]')),
            cards: document.querySelectorAll('.hub-card').length,
            cardCols,
            docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
            tooSmall, clipped, shortCards,
          };
        });

        rows.push({
          screen: screen.id, view: v.id, size, step,
          body: m.body, label: m.label, secondary: m.secondary, title: m.title,
          cards: m.cards, cols: m.cardCols,
          overflow: m.docOverflow, tooSmall: m.tooSmall.length, clipped: m.clipped.length,
        });
        if (m.docOverflow > 0) problems.push(`[${tag}] 가로 overflow ${m.docOverflow}px`);
        if (m.tooSmall.length) problems.push(`[${tag}] 56px 미만 컨트롤: ${m.tooSmall.join(" | ")}`);
        if (m.clipped.length) problems.push(`[${tag}] 글자 잘림: ${m.clipped.join(" | ")}`);
        if (m.shortCards.length) problems.push(`[${tag}] 카드 높이 112px 미만: ${m.shortCards.join(" | ")}`);
        if (m.label !== null && m.label < 18) problems.push(`[${tag}] label ${m.label}px < 18`);
        if (m.secondary !== null && m.secondary < 16) problems.push(`[${tag}] secondary ${m.secondary}px < 16`);
        // 열 수 계약: 360px 1열 / 600~1023px 2열 / 1024px 이상 3열
        const wantCols = v.width < 600 ? 1 : v.width < 1024 ? 2 : 3;
        if (m.cardCols !== null && m.cardCols !== wantCols) {
          problems.push(`[${tag}] 활동 카드 ${m.cardCols}열 — ${wantCols}열이어야 한다`);
        }
        if (screen.id.startsWith("hub") && m.cards !== 5) {
          problems.push(`[${tag}] 활동 카드가 ${m.cards}장 — 5장이어야 한다`);
        }
        await page.screenshot({ path: `reports/B/${screen.id}-${step}-${v.id}-${size}.png`, fullPage: true });
      };

      await measure("main");
      for (const st of screen.steps ?? []) {
        const btn = page.getByRole("button", { name: st.click }).first();
        if (await btn.count()) {
          await btn.click();
          await page.waitForTimeout(250);
          await measure(st.id);
          // 모달을 연 단계는 닫고 다음 단계로 — 열린 모달이 다음 클릭을 가로챈다.
          if (st.closeKey) { await page.keyboard.press(st.closeKey); await page.waitForTimeout(150); }
        } else {
          problems.push(`[${base}] '${st.click}' 버튼을 찾지 못해 ${st.id} 상태를 재지 못했다`);
        }
      }

      await ctx.close();
    }
  }
}

await browser.close();
console.table(rows);
if (problems.length) { console.log("\n문제:"); for (const p of problems) console.log(" -", p); }
else console.log("\n측정 항목 이상 없음");
process.exit(problems.length ? 1 : 0);

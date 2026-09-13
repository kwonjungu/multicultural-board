/**
 * 45개 계약 화면의 fixture 경로 실재 여부 조사기 (품질 하네스, 2026-09-14).
 *
 * 무엇을 하는가: 후보 URL 을 실제 Chrome 으로 열어 (1) 렌더 성공 여부,
 * (2) Next.js 에러 오버레이, (3) 화면에 보이는 조작 버튼 목록,
 * (4) fixture 가 Firebase/네트워크로 새는지를 기록한다.
 *
 * 왜 필요한가: contract.json 의 화면 이름만으로는 어떤 fixture 라우트가
 * 그 화면을 실제로 그리는지 알 수 없다. 추측으로 매핑하면 "감사했다"가
 * 거짓이 된다. 그래서 먼저 눈으로 확인할 자료를 모은다.
 *
 * 실행: 저장소 루트에서 `node scripts/audit/probe-routes.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { CANDIDATES, AFTER_ORIGIN } from "./route-map.mjs";

const OUT = path.resolve("reports/audit-20260914/probe");
fs.mkdirSync(OUT, { recursive: true });

/** 제품이 아닌 fixture 껍데기는 조작 목록에서 뺀다. */
const VISIBLE_CONTROLS = `
  (() => {
    const out = [];
    const els = document.querySelectorAll('button, [role="button"], a[href], input, textarea, select');
    for (const el of els) {
      if (el.closest('[data-fixture-chrome]')) continue;
      if (el.closest('nextjs-portal')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
      out.push({ tag: el.tagName.toLowerCase(), label, w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out.slice(0, 60);
  })()
`;

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];

  for (const cand of CANDIDATES) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();

    // 누수 감시: fixture 는 Firebase 에도 /api/* 에도 나가면 안 된다.
    const leaks = [];
    page.on("request", (req) => {
      const u = req.url();
      if (/firestore|firebaseio|firebaseinstallations|identitytoolkit|firebaseapp.com/i.test(u)) {
        leaks.push({ kind: "firebase", method: req.method(), url: u.slice(0, 160) });
      } else if (/\/api\//.test(u) && u.includes("localhost")) {
        leaks.push({ kind: "api", method: req.method(), url: new URL(u).pathname });
      }
    });
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));

    const url = AFTER_ORIGIN + cand.url;
    let status = 0;
    let record;
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      status = resp ? resp.status() : 0;
      await page.waitForTimeout(2500);

      const overlay = await page.locator("nextjs-portal").count();
      const bodyText = (await page.evaluate("document.body.innerText")) || "";
      const controls = await page.evaluate(VISIBLE_CONTROLS);
      const shot = path.join(OUT, `${cand.screen}__${cand.key || "main"}.png`);
      await page.screenshot({ path: shot });

      record = {
        screen: cand.screen,
        url: cand.url,
        status,
        errorOverlay: overlay > 0,
        textHead: bodyText.replace(/\s+/g, " ").trim().slice(0, 300),
        controls,
        leaks,
        consoleErrors: consoleErrors.slice(0, 5),
        pageErrors: pageErrors.slice(0, 5),
        shot,
      };
    } catch (e) {
      record = { screen: cand.screen, url: cand.url, status, error: String(e).slice(0, 300), leaks };
    }
    results.push(record);
    console.log(
      `${record.errorOverlay || record.error ? "FAIL" : "ok  "} ${cand.screen.padEnd(26)} ${cand.url}` +
        (record.leaks?.length ? `  LEAK:${record.leaks.length}` : "")
    );
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "probe.json"), JSON.stringify(results, null, 1));
  console.log(`\n${results.length}개 후보 조사 완료 → ${path.join(OUT, "probe.json")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

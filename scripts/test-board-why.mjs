/**
 * 왜 넘치는지 한 카드만 파고드는 탐침. test-board-fit.mjs 가 "어디가" 를
 * 알려 주면 여기서 "왜" 를 확인한다 — 어떤 규칙이 이겼는지(cascade)까지 본다.
 *
 *   node scripts/test-board-why.mjs [baseUrl] [width]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3300";
const W = Number(process.argv[3] || 1440);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, locale: "ko-KR" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto(`${BASE}/ux-fixture/board`, { waitUntil: "networkidle", timeout: 90000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForSelector(".pc-card");

console.log(await page.evaluate(() => {
  const R = (n) => Math.round(n * 10) / 10;
  const out = [];
  const g = (el, label) => {
    const c = getComputedStyle(el);
    out.push(`${label.padEnd(16)} client=${el.clientWidth} scroll=${el.scrollWidth} ` +
      `rect=${R(el.getBoundingClientRect().width)} ow=${c.overflowWrap} wb=${c.wordBreak} ` +
      `ws=${c.whiteSpace} disp=${c.display} minW=${c.minWidth} flex=${c.flexGrow},${c.flexShrink},${c.flexBasis} pad=${c.paddingLeft}/${c.paddingRight}`);
  };

  /* 1. 긴 이름 카드 */
  const nm = Array.from(document.querySelectorAll(".pc-name")).find((e) => e.textContent.length > 15);
  if (nm) {
    out.push("── 긴 이름 카드 ──");
    g(nm.closest(".pc-card"), ".pc-card");
    g(nm.closest(".pc-who"), ".pc-who");
    g(nm.closest(".pc-who-text"), ".pc-who-text");
    g(nm, ".pc-name");
    const meta = nm.closest(".pc-who-text").querySelector(".pc-meta");
    if (meta) g(meta, ".pc-meta");
    const av = nm.closest(".pc-who").querySelector(".pc-avatar");
    if (av) g(av, ".pc-avatar");
    out.push(`  .pc-name 의 data-ux-role = ${nm.getAttribute("data-ux-role")}`);
  }

  /* 2. 조작 줄 */
  out.push("── 조작 줄 ──");
  const row = document.querySelector(".pc-card > .pc-actions");
  if (row) {
    g(row, ".pc-actions");
    for (const grp of row.children) g(grp, "  " + grp.className);
    for (const b of row.querySelectorAll("button")) {
      const c = getComputedStyle(b);
      out.push(`   btn ${b.className.padEnd(18)} ${R(b.getBoundingClientRect().width)}x${R(b.getBoundingClientRect().height)} ` +
        `pad=${c.paddingLeft}/${c.paddingRight} minW=${c.minWidth} r=${c.borderTopLeftRadius} bw=${c.borderTopWidth} bg=${c.backgroundColor} bc=${c.borderTopColor}`);
    }
  }

  /* 3. 열 머리 */
  out.push("── 열 머리 ──");
  for (const col of document.querySelectorAll(".bd-col")) {
    const head = col.querySelector(".bd-col-head");
    const art = col.querySelector(".bd-col-art");
    const title = col.querySelector(".bd-col-title");
    out.push(`  ${art ? "🖼" : "  "} colW=${R(col.getBoundingClientRect().width)} headH=${R(head.getBoundingClientRect().height)} ` +
      `titleH=${R(title.getBoundingClientRect().height)} "${title.textContent.trim().slice(0, 18)}"`);
  }

  /* 4. 어느 style 태그가 뒤에 오는지 (특이도 같을 때 순서가 이긴다) */
  out.push("── style 태그 순서 ──");
  Array.from(document.querySelectorAll("style")).forEach((s, i) => {
    const t = s.textContent;
    out.push(`  ${i}: ${t.slice(0, 46).replace(/\s+/g, " ")}…  [data-ux-role]{overflow-wrap} 포함=${/\[data-ux-role\][^{]*\{[^}]*overflow-wrap/.test(t)}  .pc-name 포함=${t.includes(".pc-name")}`);
  });
  return out.join("\n");
}));

await browser.close();

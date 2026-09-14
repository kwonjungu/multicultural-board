/**
 * 소통창 카드 실측 — 잘림 · 조작 줄 한 행 · 열 폭 · 공감 패널.
 *
 * 왜 이 파일이 따로 있나: scripts/shot-board.mjs 는 [data-ux-role] 만 훑어서
 * 카드 안의 래퍼(.pc-who, .pc-alt, .pc-actions …)를 놓친다. 사용자가 실제로
 * 본 잘림은 그 래퍼에서 났다. 여기서는 **카드 안 모든 요소**를 훑는다.
 *
 *   실행(저장소 루트에서): node scripts/test-board-fit.mjs [baseUrl]
 *   전제: dev 서버가 떠 있어야 한다 (fixture 는 production 에서 404).
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3411";
const URL_ = `${BASE}/ux-fixture/board`;

const VIEWS = [
  { id: "1440", width: 1440, height: 900 },
  { id: "1366", width: 1366, height: 900 },
  { id: "1280", width: 1280, height: 800 },
  { id: "1024", width: 1024, height: 768 },
  { id: "820p", width: 820, height: 1180 },
  { id: "390", width: 390, height: 844 },
  /* '큰 글씨' 는 --ux-control-min 이 48 → 56px 이라 조작 줄이 더 넓어야 한다.
     기본 글씨만 재면 그 폭이 검사에서 통째로 빠진다. */
  { id: "1280L", width: 1280, height: 800, text: "large" },
  { id: "820pL", width: 820, height: 1180, text: "large" },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];
const rows = [];

async function open(view) {
  const ctx = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: 1, locale: "ko-KR", timezoneId: "Asia/Seoul",
  });
  await ctx.addInitScript((textSize) => {
    localStorage.setItem("childUx.settings", JSON.stringify({ textSize, motion: "reduced", tone: "playful" }));
  }, view.text || "basic");
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${view.id}] pageerror: ${e.message}`));
  await page.goto(URL_, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector(".pc-card", { timeout: 20000 });
  return { ctx, page };
}

const MEASURE = () => {
  const R = (n) => Math.round(n * 10) / 10;
  const name = (el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ").filter(Boolean).join(".")}`;

  const cards = Array.from(document.querySelectorAll(".pc-card"));

  /* 스크린리더 전용으로 접어 둔 글(1px 상자 + clip)은 잘림이 아니다.
     라벨을 접는 게 설계이므로 세면 진짜 잘림이 그 밑에 묻힌다
     (실측: 160건 중 159건이 이 가짜였다). */
  const srOnly = (el, cs) =>
    cs.position === "absolute" && el.clientWidth <= 1 &&
    (cs.clip !== "auto" || cs.clipPath !== "none");

  /* 1. 카드 안 모든 요소의 가로 잘림. 일부러 스크롤하는 상자는 뺀다. */
  const clipped = [];
  for (const card of cards) {
    for (const el of [card, ...card.querySelectorAll("*")]) {
      const cs = getComputedStyle(el);
      if (cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
      if (srOnly(el, cs)) continue;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        clipped.push({
          sel: name(el),
          client: el.clientWidth, scroll: el.scrollWidth,
          text: (el.textContent || "").trim().slice(0, 24),
          card: card.getAttribute("aria-label"),
          /* 왜 넘치는지까지 남긴다 — 추측 대신 이 값으로 원인을 고른다.
             (display:grid + 자식 min-width:auto, white-space:nowrap,
              word-break:keep-all + 공백 없는 긴 토막 … 서로 처방이 다르다) */
          why: (() => {
            const c = cs;
            return `${c.display}/${c.whiteSpace}/wb=${c.wordBreak}/ow=${c.overflowWrap}/minW=${c.minWidth}/flex=${c.flexGrow},${c.flexShrink},${c.flexBasis}`;
          })(),
        });
      }
    }
  }

  /* 2. 조작 줄 — 한 행인가, 겹치는가. 카드 본체 줄만 본다(답장 목록 제외). */
  const actionRows = [];
  for (const card of cards) {
    const row = Array.from(card.children).find((c) => c.classList.contains("pc-actions"));
    if (!row) continue;
    const btns = Array.from(row.querySelectorAll("button"));
    if (!btns.length) continue;
    const rr = row.getBoundingClientRect();
    const rects = btns.map((b) => b.getBoundingClientRect());
    const maxH = Math.max(...rects.map((r) => r.height));
    let overlaps = 0;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlaps++;
      }
    }
    const tops = rects.map((r) => R(r.top));
    actionRows.push({
      card: card.getAttribute("aria-label"),
      n: btns.length,
      rowH: R(rr.height), maxBtnH: R(maxH),
      singleRow: Math.abs(rr.height - maxH) <= 1 && Math.max(...tops) - Math.min(...tops) <= 1,
      overlaps,
      overflow: row.scrollWidth > row.clientWidth + 1 ? `${row.clientWidth}<${row.scrollWidth}` : "",
      btns: btns.map((b) => {
        const lb = b.querySelector(".pc-btn-lb");
        return {
          cls: (b.className || "").replace("pc-btn", "").trim(),
          w: R(b.getBoundingClientRect().width), h: R(b.getBoundingClientRect().height),
          r: getComputedStyle(b).borderTopLeftRadius,
          bw: getComputedStyle(b).borderTopWidth,
          bc: getComputedStyle(b).borderTopColor,
          bg: getComputedStyle(b).backgroundColor,
          lb: !!lb && getComputedStyle(lb).position !== "absolute",
        };
      }),
    });
  }

  /* 3. 하트 속 그림이 원 밖으로 나가지 않는지 */
  const icoFit = [];
  for (const card of cards) {
    for (const b of card.querySelectorAll(".pc-actions > * > button")) {
      const ico = b.querySelector(".pc-btn-ico");
      if (!ico) continue;
      const br = b.getBoundingClientRect(), ir = ico.getBoundingClientRect();
      if (ir.left < br.left - 0.5 || ir.right > br.right + 0.5 || ir.top < br.top - 0.5 || ir.bottom > br.bottom + 0.5)
        icoFit.push(`${b.className}: ico ${R(ir.width)}x${R(ir.height)} 가 버튼 ${R(br.width)}x${R(br.height)} 밖으로`);
    }
  }

  const col = document.querySelector(".bd-col");
  const card0 = cards[0];
  const de = document.documentElement;
  const pad = (el, s) => parseFloat(getComputedStyle(el)[s]) || 0;
  return {
    colW: col ? R(col.getBoundingClientRect().width) : null,
    colInner: col ? R(col.clientWidth - pad(col, "paddingLeft") - pad(col, "paddingRight")) : null,
    colCount: document.querySelectorAll(".bd-col").length,
    cardW: card0 ? R(card0.getBoundingClientRect().width) : null,
    cardInner: card0 ? R(card0.clientWidth - pad(card0, "paddingLeft") - pad(card0, "paddingRight")) : null,
    nCards: cards.length,
    // '큰 글씨' 가 정말 걸렸는지 눈으로 확인할 수 있게 함께 찍는다.
    textMode: de.getAttribute("data-ux-text") || "basic",
    ctrlMin: getComputedStyle(de).getPropertyValue("--ux-control-min").trim(),
    clipped, actionRows, icoFit,
    docOverflow: de.scrollWidth > de.clientWidth + 1 ? `${de.clientWidth}<${de.scrollWidth}` : "",
  };
};

/* ── 열 머리 정렬 ───────────────────────────────────────────────────
   사용자 신고: "초반 3개 열은 문제 없고 사용자가 추가한 열에서 레이아웃 이슈".
   기본 열 제목은 이모지로 시작해 아이콘이 붙고, 사용자가 만든 "새 칸" 은
   아이콘이 없다. 머리가 세로 배치라 아이콘 유무가 그대로 높이 차이가 된다.
   그래서 **열끼리** 머리 높이와 각 줄의 y 를 견준다. */
const COLUMNS = () => {
  const R = (n) => Math.round(n * 10) / 10;
  const cols = Array.from(document.querySelectorAll(".bd-col"));
  if (!cols.length) return null;
  const rows = cols.map((col) => {
    const head = col.querySelector(".bd-col-head");
    const art = col.querySelector(".bd-col-art");
    const title = col.querySelector(".bd-col-title");
    const count = col.querySelector(".bd-col-count");
    const tools = col.querySelector(".bd-col-tools");
    const body = col.querySelector(".bd-col-body");
    const cr = col.getBoundingClientRect();
    const y = (el) => (el ? R(el.getBoundingClientRect().top - cr.top) : null);
    return {
      title: (title?.textContent || "").trim().slice(0, 14),
      art: !!art,
      colW: R(cr.width),
      headH: head ? R(head.getBoundingClientRect().height) : null,
      titleY: y(title), titleH: title ? R(title.getBoundingClientRect().height) : null,
      countY: y(count), toolsY: y(tools), bodyY: y(body),
      titleLines: title
        ? Math.round(title.getBoundingClientRect().height / (parseFloat(getComputedStyle(title).lineHeight) || 1))
        : null,
      clipped: [head, title, count, tools].filter(
        (el) => el && el.scrollWidth > el.clientWidth + 1
      ).map((el) => `${el.className}:${el.clientWidth}<${el.scrollWidth}`),
    };
  });
  const spread = (k) => {
    const v = rows.map((r) => r[k]).filter((n) => n != null);
    return v.length ? R(Math.max(...v) - Math.min(...v)) : null;
  };
  return {
    n: cols.length, rows,
    headHSpread: spread("headH"),
    titleYSpread: spread("titleY"),
    countYSpread: spread("countY"),
    toolsYSpread: spread("toolsY"),
    bodyYSpread: spread("bodyY"),
  };
};

const PANEL = () => {
  const R = (n) => Math.round(n * 10) / 10;
  const p = document.querySelector(".pc-reactpanel");
  if (!p) return null;
  const card = p.closest(".pc-card");
  const pr = p.getBoundingClientRect();
  const reacts = Array.from(p.querySelectorAll(".pc-react"));
  const clipped = [];
  for (const el of [p, ...p.querySelectorAll("*")]) {
    const cs = getComputedStyle(el);
    if (cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
    // 접어 둔 스크린리더용 라벨은 잘림이 아니다 (MEASURE 와 같은 규칙).
    if (cs.position === "absolute" && el.clientWidth <= 1 && (cs.clip !== "auto" || cs.clipPath !== "none")) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
      clipped.push(`${el.className}: ${el.clientWidth}<${el.scrollWidth}`);
  }
  const row = p.querySelector(".pc-moodrow");
  return {
    w: R(pr.width), h: R(pr.height),
    maxH: getComputedStyle(p).maxHeight,
    scrolls: p.scrollHeight > p.clientHeight + 1,
    scrollH: p.scrollHeight, clientH: p.clientHeight,
    nReact: reacts.length,
    perRow: row ? R(row.children.length / new Set(Array.from(row.children).map((c) => Math.round(c.getBoundingClientRect().top))).size) : 0,
    escapesCard: card ? R(pr.right - card.getBoundingClientRect().right) : null,
    clipped,
  };
};

for (const view of VIEWS) {
  const { ctx, page } = await open(view);
  const m = await page.evaluate(MEASURE);
  const cols = await page.evaluate(COLUMNS);

  // 공감 패널을 하나 열어 재본다.
  await page.evaluate(() => {
    const h = document.querySelector(".pc-heart");
    if (h) h.click();
  });
  await page.waitForTimeout(300);
  const panel = await page.evaluate(PANEL);

  rows.push({ view: view.id, ...m, cols, panel });
  if (cols && cols.n >= 4) {
    /* 열이 4개 이상(기본 3 + 사용자 추가)일 때만 뜻이 있다.
       1px 은 서브픽셀 반올림 여유다. */
    if (cols.headHSpread > 1) problems.push(`[${view.id}] 열 머리 높이가 어긋난다 (편차 ${cols.headHSpread}px)`);
    if (cols.titleYSpread > 1) problems.push(`[${view.id}] 열 제목 y 가 어긋난다 (편차 ${cols.titleYSpread}px)`);
    if (cols.countYSpread > 1) problems.push(`[${view.id}] 열 개수 y 가 어긋난다 (편차 ${cols.countYSpread}px)`);
    if (cols.toolsYSpread > 1) problems.push(`[${view.id}] 열 도구 줄 y 가 어긋난다 (편차 ${cols.toolsYSpread}px)`);
    for (const r of cols.rows) for (const c of r.clipped) problems.push(`[${view.id}] 열 머리 잘림 ${c}`);
  }
  if (m.clipped.length) problems.push(`[${view.id}] 카드 안 가로 잘림 ${m.clipped.length}개`);
  if (m.docOverflow) problems.push(`[${view.id}] 문서 가로 넘침 ${m.docOverflow}`);
  for (const s of m.icoFit) problems.push(`[${view.id}] ${s}`);
  for (const a of m.actionRows) {
    if (!a.singleRow) problems.push(`[${view.id}] 조작 줄이 한 행이 아니다 (rowH ${a.rowH} vs btn ${a.maxBtnH}) — ${a.card}`);
    if (a.overlaps) problems.push(`[${view.id}] 조작 버튼 겹침 ${a.overlaps} — ${a.card}`);
    if (a.overflow) problems.push(`[${view.id}] 조작 줄 넘침 ${a.overflow} — ${a.card}`);
  }
  // 네 버튼 생김새 통일 검사 — 첫 카드 기준.
  const a0 = m.actionRows[0];
  if (a0) {
    const uniq = (k) => [...new Set(a0.btns.map((b) => b[k]))];
    if (uniq("h").length > 1) problems.push(`[${view.id}] 조작 버튼 높이가 제각각: ${uniq("h").join(", ")}`);
    if (uniq("r").length > 1) problems.push(`[${view.id}] 조작 버튼 모서리가 제각각: ${uniq("r").join(", ")}`);
    if (uniq("bw").length > 1) problems.push(`[${view.id}] 조작 버튼 테두리 두께가 제각각: ${uniq("bw").join(", ")}`);
    if (a0.btns.every((b) => !b.lb) && uniq("w").length > 1)
      problems.push(`[${view.id}] 라벨 접힌 상태에서 버튼 폭이 제각각: ${uniq("w").join(", ")}`);
  }
  await ctx.close();
}

await browser.close();

/* ── 출력 ─────────────────────────────────────────────────────────── */
const P = (v, n) => String(v ?? "-").padEnd(n);

console.log("\n== 열 · 카드 폭 ==");
console.log("view   글씨   ctrlMin cols  colW   colInner  cardW   cardInner  cards  docOverflow");
for (const r of rows)
  console.log(`${P(r.view, 6)} ${P(r.textMode, 6)} ${P(r.ctrlMin, 7)} ${P(r.colCount, 5)} ${P(r.colW, 6)} ${P(r.colInner, 9)} ${P(r.cardW, 7)} ${P(r.cardInner, 10)} ${P(r.nCards, 6)} ${r.docOverflow || "0"}`);

console.log("\n== 열 머리 정렬 (열 4개 이상일 때) ==");
console.log("view   열수  머리높이편차  제목y편차  개수y편차  도구y편차  본문y편차");
for (const r of rows) {
  const c = r.cols;
  if (!c) { console.log(`${P(r.view, 6)} (열 보기 아님 — 단일 주제 화면)`); continue; }
  console.log(`${P(r.view, 6)} ${P(c.n, 5)} ${P(c.headHSpread, 13)} ${P(c.titleYSpread, 10)} ${P(c.countYSpread, 10)} ${P(c.toolsYSpread, 10)} ${c.bodyYSpread}`);
  for (const x of c.rows)
    console.log(`        ${x.art ? "🖼 " : "   "} ${P(x.title, 15)} colW=${P(x.colW, 6)} headH=${P(x.headH, 6)} titleY=${P(x.titleY, 6)} 줄수=${P(x.titleLines, 3)} countY=${P(x.countY, 6)} toolsY=${x.toolsY}`);
}

console.log("\n== 카드 안 가로 잘림 (scrollWidth > clientWidth) ==");
for (const r of rows) {
  console.log(`-- ${r.view}: ${r.clipped.length}개`);
  const seen = new Map();
  for (const c of r.clipped) {
    const k = `${c.sel}  ${c.client}<${c.scroll}`;
    if (!seen.has(k)) seen.set(k, { n: 0, text: c.text, why: c.why });
    seen.get(k).n++;
  }
  for (const [k, v] of [...seen].slice(0, 12)) console.log(`   ${k}  x${v.n}   "${v.text}"\n        ${v.why}`);
}

console.log("\n== 조작 줄 (.pc-actions) ==");
console.log("view   rows  한행  겹침  넘침  rowH/maxBtnH");
for (const r of rows) {
  const bad = r.actionRows.filter((a) => !a.singleRow || a.overlaps || a.overflow).length;
  const a0 = r.actionRows[0];
  console.log(`${P(r.view, 6)} ${P(r.actionRows.length, 5)} ${P(bad ? "NO" : "yes", 4)} ${P(r.actionRows.reduce((s, a) => s + a.overlaps, 0), 5)} ${P(r.actionRows.filter((a) => a.overflow).length, 5)} ${a0 ? `${a0.rowH}/${a0.maxBtnH}` : "-"}`);
  if (a0) for (const b of a0.btns) console.log(`        ${P(b.cls, 12)} ${P(b.w + "x" + b.h, 14)} r=${P(b.r, 7)} bw=${P(b.bw, 5)} bg=${P(b.bg, 22)} 라벨=${b.lb ? "보임" : "접힘"}`);
}

console.log("\n== 공감 패널 (.pc-reactpanel) ==");
console.log("view   w      h      maxH                 스크롤  줄당   카드밖(px)  잘림");
for (const r of rows) {
  const p = r.panel;
  if (!p) { console.log(`${P(r.view, 6)} (열리지 않음)`); continue; }
  console.log(`${P(r.view, 6)} ${P(p.w, 6)} ${P(p.h, 6)} ${P(p.maxH, 20)} ${P(p.scrolls, 7)} ${P(p.perRow, 6)} ${P(p.escapesCard, 11)} ${p.clipped.length}`);
  for (const c of p.clipped.slice(0, 5)) console.log(`        ${c}`);
}

console.log(`\n== 문제 ${problems.length}건 ==`);
for (const p of problems) console.log(" ! " + p);
process.exitCode = problems.length ? 1 : 0;

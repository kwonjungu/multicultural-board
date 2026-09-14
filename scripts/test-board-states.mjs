/**
 * 상태·회귀 확인. 조작 줄 넷을 같은 원으로 통일하면서 특이도를 올렸는데,
 * 그 바람에 조용히 죽을 수 있는 규칙들을 실제로 눌러 보고 잰다:
 *
 *  1. 하트를 고르면 노란 채움(--ux-primary-fill)이 뜨는가
 *     (.pc-heart.on 은 (0,2,0) 이라 새 (0,4,0) 채움 규칙에 밀릴 수 있었다)
 *  2. 답장 목록의 '삭제' 는 빨간 테두리를 지키는가
 *     (.pc-btn.danger 가 새 원 규칙에 밀리면 안 된다 → .pc-card > 로 좁혔다)
 *  3. 교사 보기(?role=teacher)에서도 열 머리 높이가 열끼리 같은가
 *     (열 도구가 버튼 2개로 늘어난다)
 *  4. 공감 패널(무드미터 20종)이 열리고, 높이 상한과 안쪽 스크롤이 도는가
 *
 *   node scripts/test-board-states.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3300";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const fails = [];

async function open(role, width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "ko-KR" });
  await ctx.addInitScript(() => {
    localStorage.setItem("childUx.settings", JSON.stringify({ textSize: "basic", motion: "reduced", tone: "playful" }));
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fails.push(`pageerror(${role}): ${e.message}`));
  await page.goto(`${BASE}/ux-fixture/board${role === "teacher" ? "?role=teacher" : ""}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector(".pc-card", { timeout: 30000 });
  return { ctx, page };
}

/* ── 1·4. 학생 보기: 하트 선택 + 공감 패널 ── */
{
  const { ctx, page } = await open("student");

  const before = await page.evaluate(() => {
    const b = document.querySelector(".pc-card .pc-heart");
    const c = getComputedStyle(b);
    return { bg: c.backgroundColor, bw: c.borderTopWidth, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height };
  });
  await page.click(".pc-card .pc-heart");
  await page.waitForTimeout(250);
  /* 패널은 **반응을 고르기 전에** 잰다 — 고르면 패널이 닫힌다(설계대로). */
  const panelState = await page.evaluate(() => {
    const panel = document.querySelector(".pc-reactpanel");
    return panel ? { maxH: getComputedStyle(panel).maxHeight, scrolls: panel.scrollHeight > panel.clientHeight + 1, n: panel.querySelectorAll(".pc-react").length } : null;
  });
  // 이제 첫 반응을 실제로 고른다 — 고른 뒤의 채움을 봐야 한다.
  await page.evaluate(() => { const r = document.querySelector(".pc-reactpanel .pc-react"); if (r) r.click(); });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const b = document.querySelector(".pc-card .pc-heart");
    const c = getComputedStyle(b);
    return {
      bg: c.backgroundColor, bw: c.borderTopWidth, cls: b.className,
      w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height,
      fill: getComputedStyle(document.documentElement).getPropertyValue("--ux-primary-fill").trim(),
    };
  });
  after.panel = panelState;
  console.log("1) 하트 선택 전:", JSON.stringify(before));
  console.log("   하트 선택 후:", JSON.stringify(after));
  if (!/pc-heart on|on/.test(after.cls)) fails.push("하트를 골랐는데 .on 이 붙지 않았다");
  else if (after.bg === "rgb(255, 255, 255)" || after.bg === before.bg)
    fails.push(`하트를 골랐는데 채움이 안 바뀐다 (${before.bg} → ${after.bg}) — .pc-heart.on 이 특이도에서 밀렸다`);
  if (Math.abs(after.w - before.w) > 1 || Math.abs(after.h - before.h) > 1)
    fails.push(`선택 뒤 하트 크기가 바뀐다 ${before.w}x${before.h} → ${after.w}x${after.h} (box-sizing 확인)`);
  console.log("4) 공감 패널:", JSON.stringify(after.panel));
  if (!after.panel) fails.push("공감 패널이 열리지 않는다");
  else {
    if (after.panel.n < 20) fails.push(`무드미터가 ${after.panel.n}종밖에 없다 (20종이어야 한다)`);
    if (!/min\(|px/.test(after.panel.maxH)) fails.push(`패널 높이 상한이 사라졌다: ${after.panel.maxH}`);
    if (!after.panel.scrolls) fails.push("패널이 안에서 스크롤되지 않는다");
  }
  await ctx.close();
}

/* ── 2·3. 교사 보기: 답장 목록 danger 버튼 + 열 머리 정렬 ── */
{
  const { ctx, page } = await open("teacher");

  const cols = await page.evaluate(() => {
    const R = (n) => Math.round(n * 10) / 10;
    const heads = Array.from(document.querySelectorAll(".bd-col-head")).map((h) => R(h.getBoundingClientRect().height));
    const tools = Array.from(document.querySelectorAll(".bd-col")).map((c) => {
      const t = c.querySelector(".bd-col-tools");
      return R(t.getBoundingClientRect().top - c.getBoundingClientRect().top);
    });
    const sp = (a) => R(Math.max(...a) - Math.min(...a));
    return { n: heads.length, heads, headSpread: sp(heads), toolsSpread: sp(tools), toolBtns: document.querySelectorAll(".bd-col-tools button").length };
  });
  console.log("3) 교사 열 머리:", JSON.stringify(cols));
  if (cols.headSpread > 1) fails.push(`교사 보기에서 열 머리 높이가 어긋난다 (편차 ${cols.headSpread}px)`);
  if (cols.toolsSpread > 1) fails.push(`교사 보기에서 열 도구 줄 y 가 어긋난다 (편차 ${cols.toolsSpread}px)`);

  // 답장을 열어 목록 안 버튼을 본다 (승인/삭제는 교사에게만 보인다).
  const danger = await page.evaluate(async () => {
    const reply = document.querySelector(".pc-card .pc-reply");
    if (!reply) return { err: "답장 버튼이 없다" };
    reply.click();
    await new Promise((r) => setTimeout(r, 400));
    const d = document.querySelector(".pc-comments .pc-btn.danger, .pc-card .pc-comment .pc-btn.danger");
    const any = document.querySelector(".pc-card .pc-comment .pc-btn");
    if (!d) {
      /* fixture 에는 댓글이 없어 실제 노드가 안 나온다. 규칙이 살아 있는지는
         같은 구조를 만들어 넣고 computed 를 읽어 확인한다 — 카드 본체 조작
         줄(.pc-card > .pc-actions)에만 원 규칙이 걸렸다는 계약의 검사다. */
      const card = document.querySelector(".pc-card");
      const probe = document.createElement("div");
      probe.className = "pc-comments";
      probe.innerHTML = '<div class="pc-comment"><div class="pc-actions">' +
        '<button data-ux-role="control" class="pc-btn danger">지우기</button>' +
        '<button data-ux-role="control" class="pc-btn">승인</button></div></div>';
      card.appendChild(probe);
      const dd = probe.querySelector(".pc-btn.danger");
      const ok = probe.querySelector(".pc-btn:not(.danger)");
      const cd = getComputedStyle(dd), co = getComputedStyle(ok);
      const out = {
        synthetic: true,
        border: cd.borderTopColor, radius: cd.borderTopLeftRadius,
        w: Math.round(dd.getBoundingClientRect().width),
        plainW: Math.round(ok.getBoundingClientRect().width), plainRadius: co.borderTopLeftRadius,
        /* 원 규칙이 새 나갔는지의 진짜 신호: 좌우 여백을 0 으로 밀고 지름을
           박았는지다. 폭 자체는 글자 수에 따라 자연스럽게 달라진다. */
        plainPadL: co.paddingLeft, plainWidthDecl: co.width, plainHeight: co.height,
      };
      card.removeChild(probe);
      return out;
    }
    const c = getComputedStyle(d);
    return { border: c.borderTopColor, radius: c.borderTopLeftRadius, w: Math.round(d.getBoundingClientRect().width) };
  });
  console.log("2) 답장 목록 danger 버튼:", JSON.stringify(danger));
  if (danger.border && danger.border !== "rgb(179, 38, 30)")
    fails.push(`답장 목록 '삭제' 의 빨간 테두리(--ux-error)가 사라졌다: ${danger.border}`);
  // 답장 목록 버튼은 카드 본체와 달리 원이 되면 안 된다(글자 버튼이다).
  if (danger.plainPadL === "0px")
    fails.push(`답장 목록 버튼의 좌우 여백이 0 이 됐다 — 원 규칙이 .pc-card > 밖으로 샜다`);

  await ctx.close();
}

await browser.close();
console.log(`\n== 문제 ${fails.length}건 ==`);
for (const f of fails) console.log(" ! " + f);
process.exitCode = fails.length ? 1 : 0;

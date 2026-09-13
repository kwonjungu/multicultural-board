/**
 * U01 — 게임 플레이 화면 공용 헤더 실측.
 *
 * 실제 Chrome 으로 `/ux-fixture/game?game=<id>` 를 열어 각 게임의 **플레이 화면**
 * 까지 들어간 뒤(준비 화면이 있으면 눌러서 통과) 아래를 잰다.
 *   1) 공용 헤더(.ugh) 유무와 높이
 *   2) 헤더 3칸 계약 — 왼쪽 뒤로(aria-label="back") / 가운데 제목 / 오른쪽 상태
 *      가 그 순서·그 자리에 있는지 (x 좌표로 확인)
 *   3) 조작(button, [data-ux-role=control|action]) 중 44px 미만 개수 — 실제로 센다
 *   4) 뷰포트 밖으로 넘치는 요소 수
 *   5) document.elementFromPoint 로 각 조작이 자기 자신(또는 자기 자손)에게
 *      히트되는지 — 다른 요소가 덮고 있으면 실패로 센다
 *
 * 실행: 저장소 루트에서 `node scripts/test-game-headers.mjs`
 *       (dev 서버 필요. 기본 http://localhost:3300, BASE_URL 로 바꿀 수 있다)
 *       `GAMES=taboo,yut` 로 일부만 잴 수 있다.
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3300";

const ALL_GAMES = [
  "globe", "marble", "yut", "halligalli", "puzzle",
  "country", "emotion", "memory", "greeting", "market",
  "draw", "spot", "number", "tower", "twentyq",
  "taboo", "wyr", "spotit", "story", "treasure", "cafe",
];
const GAMES = (process.env.GAMES ? process.env.GAMES.split(",") : ALL_GAMES).map((s) => s.trim());

const VIEWPORTS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "390x844", width: 390, height: 844 },
];

/** 준비/설명 화면을 지나 플레이 화면(=.ugh 가 보이는 화면)까지 들어간다. */
async function reachPlay(page) {
  for (let step = 0; step < 6; step++) {
    const has = await page.evaluate(() => !!document.querySelector(".ugh"));
    if (has) return step;
    const clicked = await page.evaluate(() => {
      const vis = (el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && el.getAttribute("aria-disabled") !== "true" && !el.disabled;
      };
      const pick = (sel) =>
        Array.from(document.querySelectorAll(sel)).find(
          (el) => !el.closest("[data-fixture-chrome]") && vis(el),
        );
      // 준비 화면의 '시작' 은 거의 항상 action, 선택지는 control 이다.
      const el = pick('[data-ux-role="action"]') || pick('[data-ux-role="control"]');
      if (!el) return false;
      el.click();
      return true;
    });
    if (!clicked) return -1;
    await page.waitForTimeout(700);
  }
  return (await page.evaluate(() => !!document.querySelector(".ugh"))) ? 6 : -1;
}

async function measure(page) {
  return page.evaluate(() => {
    const round = (n) => Math.round(n * 10) / 10;
    const ugh = document.querySelector(".ugh");
    const back = document.querySelector('.ugh [aria-label="back"]');
    const title = document.querySelector(".ugh .ugh-title");
    const statusBox = document.querySelector(".ugh .ugh-status");
    const box = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: round(b.x), y: round(b.y), w: round(b.width), h: round(b.height) };
    };

    // 조작 목록 — fixture 껍데기와 화면 밖(숨김) 요소는 뺀다.
    const controls = Array.from(
      document.querySelectorAll('button, [data-ux-role="control"], [data-ux-role="action"], a[href]'),
    ).filter((el) => {
      if (el.closest("[data-fixture-chrome]")) return false;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return false;
      return true;
    });

    const small = [];
    const covered = [];
    for (const el of controls) {
      const b = el.getBoundingClientRect();
      // 최소 타깃은 '짧은 변' 기준이 아니라 높이·폭 각각 44px 을 본다.
      if (b.height < 44 || b.width < 44) {
        small.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || "").trim().slice(0, 40),
          label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24),
          w: round(b.width), h: round(b.height),
        });
      }
      // 화면 안에 있는 조작만 히트 테스트 (스크롤 밖은 의미가 없다)
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
      const hit = document.elementFromPoint(cx, cy);
      const ok = hit && (hit === el || el.contains(hit) || hit.contains(el));
      if (!ok) {
        covered.push({
          cls: String(el.className || "").trim().slice(0, 40),
          label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24),
          by: hit ? hit.tagName.toLowerCase() + "." + String(hit.className || "").trim().split(/\s+/).join(".").slice(0, 30) : "null",
        });
      }
    }

    const overflow = [];
    document.querySelectorAll("body *").forEach((el) => {
      if (el.closest("[data-fixture-chrome]")) return;
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) return;
      if (b.right > window.innerWidth + 1 || b.left < -1) {
        overflow.push(el.tagName.toLowerCase() + "." + String(el.className || "").trim().split(/\s+/).join(".").slice(0, 40));
      }
    });

    // 화면에 title 역할이 몇 개인지 (04: 화면 제목은 하나)
    const titles = Array.from(document.querySelectorAll('[data-ux-role="title"]'))
      .filter((el) => !el.closest("[data-fixture-chrome]")).length;

    return {
      hasHeader: !!ugh,
      header: box(ugh),
      back: box(back),
      title: box(title),
      status: box(statusBox),
      controlCount: controls.length,
      small,
      covered,
      overflow: Array.from(new Set(overflow)).slice(0, 6),
      docScrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      titleRoleCount: titles,
    };
  });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];

for (const vp of VIEWPORTS) {
  for (const game of GAMES) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    // TTS/이미지 등 외부 호출이 측정을 늦추지 않게 오래 기다리지 않는다.
    await page.goto(`${BASE}/ux-fixture/game?game=${game}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    const steps = await reachPlay(page);
    await page.waitForTimeout(500);
    const m = await measure(page);
    // 놀이 방법 안내를 접은 뒤의 '평상시' 헤더 높이도 잰다 — 처음 들어갔을 때
    // 안내가 펼쳐져 있는 게임(준비 화면이 없는 게임)의 높이와 구분해서 본다.
    const closed = await page.evaluate(() => {
      const btn = document.querySelector(".ugh-help[aria-expanded='true']");
      if (!btn) return null;
      btn.click();
      return true;
    });
    let steadyH = m.header ? m.header.h : null;
    if (closed) {
      await page.waitForTimeout(250);
      steadyH = await page.evaluate(() => {
        const u = document.querySelector(".ugh");
        return u ? Math.round(u.getBoundingClientRect().height * 10) / 10 : null;
      });
    }
    rows.push({ viewport: vp.name, game, steps, steadyH, guideOpenOnEntry: !!closed, ...m });
    await ctx.close();
  }
}
await browser.close();

let totalSmall = 0;
let totalCovered = 0;
let totalOverflow = 0;
let missingHeader = 0;

for (const vp of VIEWPORTS) {
  console.log(`\n================ ${vp.name} ================`);
  console.log("game        hdr  입장높이 평상높이 안내펼침 뒤로x  제목x  상태x  조작수 <44px 덮임 overflow title역할");
  for (const r of rows.filter((x) => x.viewport === vp.name)) {
    if (!r.hasHeader) missingHeader++;
    totalSmall += r.small.length;
    totalCovered += r.covered.length;
    totalOverflow += r.overflow.length;
    console.log(
      [
        r.game.padEnd(11),
        (r.hasHeader ? "O" : "X").padEnd(4),
        String(r.header ? r.header.h : "-").padEnd(8),
        String(r.steadyH ?? "-").padEnd(8),
        (r.guideOpenOnEntry ? "Y" : "n").padEnd(8),
        String(r.back ? r.back.x : "-").padEnd(6),
        String(r.title ? r.title.x : "-").padEnd(6),
        String(r.status ? r.status.x : "-").padEnd(6),
        String(r.controlCount).padEnd(7),
        String(r.small.length).padEnd(6),
        String(r.covered.length).padEnd(5),
        String(r.overflow.length).padEnd(9),
        String(r.titleRoleCount),
      ].join(" "),
    );
    if (r.small.length) {
      for (const s of r.small) console.log(`             · 44px 미만: ${s.tag}.${s.cls} "${s.label}" ${s.w}x${s.h}`);
    }
    if (r.covered.length) {
      for (const c of r.covered) console.log(`             · 덮임: .${c.cls} "${c.label}" ← ${c.by}`);
    }
    if (r.overflow.length) {
      for (const o of r.overflow) console.log(`             · overflow: ${o}`);
    }
  }
}

console.log("\n=== 합계 ===");
console.log(`헤더 없는 화면 : ${missingHeader}`);
console.log(`44px 미만 조작 : ${totalSmall}`);
console.log(`덮인 조작      : ${totalCovered}`);
console.log(`가로 overflow  : ${totalOverflow}`);
if (missingHeader || totalSmall || totalCovered || totalOverflow) process.exitCode = 1;

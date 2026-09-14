/**
 * U07 단어 배우기 — 톤/치수 실측 (before/after 비교용).
 *
 * 정적 검사(scripts/test-vocab-home.mjs)와 달리 실제 Chrome 에서 computed style 을
 * 읽는다. "톤을 맞췄다" 는 말 대신 숫자로 확인하기 위한 것이다.
 *
 *   실행: node scripts/test-vocab-tone.mjs [baseUrl] [라벨]
 *   예:   node scripts/test-vocab-tone.mjs http://localhost:3411 before
 *
 * 결과는 scripts/.vocab-tone/<라벨>.json 으로 남고, before.json 이 있으면
 * after 실행 때 표에 나란히 찍는다.
 *
 * ⚠ dev 서버를 **새로 띄우지 말 것**. 같은 디렉터리에서 next dev 를 두 개 돌리면
 *   .next 매니페스트가 깨져 404/500 이 난다(실제로 겪었다). 이미 떠 있는 포트를
 *   읽기 전용으로 쓴다.
 *
 * 재는 것 (요구 항목 그대로):
 *   - 글자 크기 분포: 12px 미만 / 14px 미만 개수 (문서 전체, 텍스트를 직접 가진 노드만)
 *   - 굵기 분포: 400 / 700 / 800 / 900 각 몇 개
 *   - 보라 계열: 칠해진 요소 수 + 실제 덮은 면적 비율(격자 표본, 합집합이라 100% 를 넘지 않는다)
 *   - 조작 최소 크기(터치 48px 계약), 가로 넘침, elementFromPoint 로 덮인 조작
 *   - 꿀색 밖 채도 높은 면 개수 (신호등 색이 남았는지)
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "scripts", ".vocab-tone");
const BASE = process.argv[2] || "http://127.0.0.1:3411";
const LABEL = process.argv[3] || "run";

/** 요구된 4폭. 터치 여부는 실제 기기를 따른다 — 1366 크롬북도 터치다. */
const VIEWS = [
  { id: "1366", w: 1366, h: 768 },
  { id: "1024", w: 1024, h: 768 },
  { id: "820", w: 820, h: 1180 },
  { id: "390", w: 390, h: 844 },
];

const SCREENS = [
  { id: "tree", url: `${BASE}/ux-fixture/vocab?state=rich` },
  { id: "notebook", url: `${BASE}/ux-fixture/vocab?state=rich&open=notebook` },
  { id: "card", url: `${BASE}/ux-fixture/vocab?state=rich&word=happy&open=detail` },
];

/* ────────────────────────────────────────────────────────────────
   브라우저 안에서 도는 계측기. 스크롤을 내려가며 화면마다 표본을 뜬다.
   ──────────────────────────────────────────────────────────────── */
const probe = () => {
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || "");
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    const a = p.length > 3 ? p[3] : 1;
    if (!(a > 0.05)) return null;              // 투명은 칠한 것이 아니다
    return { r: p[0], g: p[1], b: p[2], a };
  };
  const hsl = (c) => {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h;
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    return { h: (h + 360) % 360, s, l };
  };
  /** 보라 계열 — 하드코딩 #8B5CF6(258°)/#6D28D9(263°)/#F5F3FF(250°) 를 모두 잡는다. */
  const isPurple = (c) => {
    if (!c) return false;
    const { h, s, l } = hsl(c);
    return h >= 240 && h <= 300 && s > 0.15 && l < 0.995;
  };
  /** 꿀색 — 크림/허니옐로/코코아 hue 15~55°. 무채색·거의 흰색·거의 검정은 중립. */
  const isHoney = (c) => {
    const { h, s, l } = hsl(c);
    return s <= 0.12 || l > 0.97 || l < 0.06 || (h >= 15 && h <= 55);
  };
  const gradColors = (cs) => {
    const bi = cs.backgroundImage;
    if (!bi || bi === "none") return [];
    return (bi.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
  };

  const vw = window.innerWidth, vh = window.innerHeight;
  const inFixtureChrome = (el) => !!el.closest("[data-fixture-chrome]");
  const all = Array.from(document.querySelectorAll("body *")).filter((el) => !inFixtureChrome(el));
  const shown = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity !== 0;
  };

  /* ── 1) 글자 크기 / 굵기 — 문서 전체 (스크롤과 무관) ─────────── */
  const fonts = { lt12: 0, lt14: 0, total: 0 };
  const weights = {};
  const smallText = [], heavy900 = [];
  for (const el of all) {
    if (!shown(el)) continue;
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3 && n.textContent.trim().length)
      .map((n) => n.textContent.trim()).join(" ");
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    fonts.total++;
    if (fs < 12) { fonts.lt12++; smallText.push({ fs: +fs.toFixed(1), t: own.slice(0, 20) }); }
    if (fs < 14) fonts.lt14++;
    const w = String(parseInt(cs.fontWeight, 10) || 400);
    weights[w] = (weights[w] || 0) + 1;
    if (w === "900") heavy900.push(own.slice(0, 20));
  }

  /* ── 2) 보라·튀는색으로 칠해진 요소 (문서 전체) ──────────────── */
  let purpleCount = 0, offHueCount = 0;
  const offHues = {}, purpleWhat = [];
  for (const el of all) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    const cs = getComputedStyle(el);
    const bg = parse(cs.backgroundColor);
    const grads = gradColors(cs);
    const hasBorder = ["Top", "Right", "Bottom", "Left"]
      .some((s) => parseFloat(cs[`border${s}Width`]) > 0);
    const borders = hasBorder
      ? [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor].map(parse)
      : [];
    if (isPurple(bg) || grads.some(isPurple) || borders.some(isPurple)) {
      purpleCount++;
      if (purpleWhat.length < 6) purpleWhat.push((el.textContent || "").trim().slice(0, 16) || el.tagName);
    }
    /* 신호등 색 — 어느 정도 큰 면만 (1px 선·점은 뺀다) */
    if (r.width * r.height > 900) {
      const cands = [bg && bg.a > 0.5 ? bg : null, ...grads].filter(Boolean);
      for (const c of cands) {
        if (!isHoney(c)) {
          offHueCount++;
          const b = String(Math.round(hsl(c).h / 30) * 30);
          offHues[b] = (offHues[b] || 0) + 1;
          break;
        }
      }
    }
  }

  /* ── 3) 조작 크기 — 문서 전체 (스크롤 밖도 포함) ─────────────── */
  const controlsAll = Array.from(
    document.querySelectorAll("button, a[href], [role='button'], input, select, [data-ux-role='control'], [data-ux-role='action']")
  ).filter((el) => !inFixtureChrome(el) && shown(el))
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .filter((el) => !el.disabled);
  const sides = controlsAll.map((el) => {
    const r = el.getBoundingClientRect();
    return Math.min(r.width, r.height);
  });
  /* 47.5 = 소수점 반올림 여유. 계약은 터치 48px. */
  const under48 = sides.filter((s) => s < 47.5).length;
  const minSide = sides.length ? +Math.min(...sides).toFixed(1) : null;

  const de = document.documentElement;
  return {
    fonts, weights, purpleCount, offHueCount, offHues,
    controls: controlsAll.length, under48, minSide,
    pageH: de.scrollHeight,
    overflow: Math.max(0, Math.round(Math.max(de.scrollWidth, document.body.scrollWidth) - vw)),
    smallText: smallText.slice(0, 8),
    heavy900: heavy900.slice(0, 8),
    purpleWhat,
  };
};

/** 한 스크롤 위치에서: 보라 덮개 비율(격자 표본) + 가려진 조작 수. */
const probeViewport = () => {
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || "");
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    const a = p.length > 3 ? p[3] : 1;
    if (!(a > 0.05)) return null;
    return { r: p[0], g: p[1], b: p[2], a };
  };
  const hsl = (c) => {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h;
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    return { h: (h + 360) % 360, s, l };
  };
  const isPurple = (c) => {
    if (!c) return false;
    const { h, s, l } = hsl(c);
    return h >= 240 && h <= 300 && s > 0.15 && l < 0.995;
  };

  const vw = window.innerWidth, vh = window.innerHeight;
  /* 보라 덮개 — 격자점마다 위에서부터 처음 만나는 '칠해진' 조상의 색을 본다.
     겹친 상자를 각각 더하지 않으므로 100% 를 넘지 않는다. */
  const STEP = 12;
  let hits = 0, samples = 0;
  for (let y = STEP / 2; y < vh; y += STEP) {
    for (let x = STEP / 2; x < vw; x += STEP) {
      samples++;
      let el = document.elementFromPoint(x, y);
      while (el && el !== document.documentElement) {
        const cs = getComputedStyle(el);
        const bg = parse(cs.backgroundColor);
        const bi = cs.backgroundImage;
        const grads = bi && bi !== "none" ? (bi.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean) : [];
        if (bg && bg.a > 0.5) { if (isPurple(bg)) hits++; break; }
        if (grads.length) { if (grads.some(isPurple)) hits++; break; }
        el = el.parentElement;
      }
    }
  }

  /* 가려진 조작 — 중앙점이 자기(또는 자손/조상)가 아닌 것에 잡히면 덮인 것 */
  const ctrls = Array.from(
    document.querySelectorAll("button, a[href], [role='button'], input, select, [data-ux-role='control'], [data-ux-role='action']")
  ).filter((el) => !el.closest("[data-fixture-chrome]") && !el.disabled)
    .filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== "none" && cs.visibility !== "hidden"
        && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= vh;
    });
  let covered = 0; const coveredWhat = [];
  for (const el of ctrls) {
    const r = el.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
    if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
    const hit = document.elementFromPoint(x, y);
    if (!hit || (hit !== el && !el.contains(hit) && !hit.contains(el))) {
      covered++;
      if (coveredWhat.length < 5) coveredWhat.push((el.textContent || "").trim().slice(0, 16) || el.tagName);
    }
  }
  return { hits, samples, checked: ctrls.length, covered, coveredWhat };
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = {};
for (const s of SCREENS) {
  for (const v of VIEWS) {
    const ctx = await browser.newContext({
      viewport: { width: v.w, height: v.h },
      hasTouch: true, deviceScaleFactor: 1, locale: "ko-KR",
    });
    await ctx.addInitScript(() => {
      localStorage.setItem("childUx.settings",
        JSON.stringify({ textSize: "basic", motion: "reduced", tone: "playful" }));
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));

    /* dev 서버는 라우트를 요청받은 순간 컴파일한다. 그 사이에 들어온 요청은
       404/500 로 떨어진다 — 같은 저장소에서 다른 사람이 파일을 고치면 더 잦다.
       실제로 이걸 안 걸고 재다가 12개 화면이 전부 0 으로 나왔다. */
    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      await page.goto(s.url, { waitUntil: "networkidle", timeout: 120000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      ok = await page.evaluate(() =>
        document.querySelectorAll("button").length > 0
        && !/This page could not be found/.test(document.body.innerText));
      if (!ok) await page.waitForTimeout(2500);
    }
    if (!ok) throw new Error(`${s.id}@${v.id}: 페이지가 끝내 안 그려졌다 (${s.url})`);

    const m = await page.evaluate(probe);

    /* 스크롤을 내려가며 덮개·가림을 잰다. 첫 화면만 보면 아래쪽을 놓친다. */
    const steps = Math.min(6, Math.max(1, Math.ceil(m.pageH / v.h)));
    let hits = 0, samples = 0, covered = 0, checked = 0;
    const coveredWhat = [];
    for (let i = 0; i < steps; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * v.h);
      await page.waitForTimeout(150);
      const r = await page.evaluate(probeViewport);
      hits += r.hits; samples += r.samples; covered += r.covered; checked += r.checked;
      for (const w of r.coveredWhat) if (coveredWhat.length < 5) coveredWhat.push(w);
    }
    m.purpleCoverPct = samples ? +((hits / samples) * 100).toFixed(1) : 0;
    m.covered = covered;
    m.coveredChecked = checked;
    m.coveredWhat = coveredWhat;
    m.scrollSteps = steps;
    if (errs.length) m.pageErrors = errs.slice(0, 3);
    if (m.controls === 0) m.WARN = "조작이 0개 — 페이지가 안 그려졌을 수 있다";

    results[`${s.id}@${v.id}`] = m;
    await ctx.close();
  }
}
await browser.close();

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, `${LABEL}.json`), JSON.stringify(results, null, 2));

/* ── 표 출력 ───────────────────────────────────────────────── */
const W = (s, n) => String(s).padEnd(n);
const R = (s, n) => String(s).padStart(n);
const keys = Object.keys(results);
const prevPath = join(OUT, "before.json");
const prev = LABEL !== "before" && existsSync(prevPath)
  ? JSON.parse(readFileSync(prevPath, "utf8")) : null;

const wsum = (w) => `${w["400"] || 0}/${w["700"] || 0}/${w["800"] || 0}/${w["900"] || 0}`;
const cols = [
  ["screen@w", 16, () => ""],
  ["<12", 5, (m) => m.fonts.lt12],
  ["<14", 5, (m) => m.fonts.lt14],
  ["400/700/800/900", 16, (m) => wsum(m.weights)],
  ["purpleN", 8, (m) => m.purpleCount],
  ["purple%", 8, (m) => m.purpleCoverPct],
  ["offHue", 7, (m) => m.offHueCount],
  ["ctrl", 5, (m) => m.controls],
  ["<48", 5, (m) => m.under48],
  ["minPx", 6, (m) => m.minSide],
  ["cover", 6, (m) => m.covered],
  ["xOvf", 5, (m) => m.overflow],
];

console.log(`\n=== ${LABEL} @ ${BASE} ===`);
console.log(cols.map(([h, n]) => W(h, n)).join(" "));
console.log(cols.map(([, n]) => "-".repeat(n)).join(" "));
for (const k of keys) {
  const m = results[k];
  console.log([W(k, 16), ...cols.slice(1).map(([, n, f]) => R(f(m), n))].join(" "));
  if (prev && prev[k]) {
    const p = prev[k];
    console.log([W("  ↳ before", 16), ...cols.slice(1).map(([, n, f]) => R(f(p), n))].join(" "));
  }
}

const bad = keys.filter((k) => results[k].overflow > 0 || results[k].covered > 0 || results[k].under48 > 0);
console.log(`\n계약 위반(가로넘침·덮임·48px 미만) 화면: ${bad.length ? bad.join(", ") : "없음"}`);
const warn = keys.filter((k) => results[k].WARN || results[k].pageErrors);
if (warn.length) console.log(`경고: ${warn.map((k) => `${k}(${results[k].WARN || results[k].pageErrors[0]})`).join(" | ")}`);
console.log(`저장: scripts/.vocab-tone/${LABEL}.json`);

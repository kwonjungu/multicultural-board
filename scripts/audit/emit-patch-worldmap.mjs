/**
 * capture.mjs 의 실측 결과를 **하네스 패치 파일**로 내보낸다 (품질 하네스, 2026-09-14).
 *
 * record-state.mjs 와 같은 규칙·같은 문장 틀을 쓰되, state.json 을 직접 쓰지 않는다.
 * 지금 감사자가 셋이 동시에 돌고 있어 state.json 을 각자 쓰면 서로 덮어쓴다 —
 * 그래서 각자 patches/*.json 에 내고 합치는 일은 한 곳에서 한다.
 *
 * 실행: 저장소 루트에서
 *   node scripts/audit/emit-patch-worldmap.mjs <화면id[:device/size,...]> ...
 * 예:
 *   node scripts/audit/emit-patch-worldmap.mjs advanced-world-map-quiz storybook \
 *        praise:tablet-portrait/basic,... board:tablet-landscape/large,chromebook/large
 * 화면id 뒤에 칸 목록을 붙이면 **그 칸만** 패치에 넣는다(이미 passed 인 칸은 건드리지
 * 않는다는 뜻이다). 칸 목록이 없으면 그 화면의 10칸을 전부 넣는다.
 */
import fs from "node:fs";
import path from "node:path";
import { SCREENS, BY_ID } from "./screens.mjs";

const HARNESS = "C:/Users/권준구/Desktop/꿀벌소통창_Opus_실행설계_20260913/harness";
const CAPTURE = path.resolve("reports/audit-20260914/capture.json");
const OUT = path.join(HARNESS, "patches", "worldmap.json");

const okFile = (p) => {
  if (!p || typeof p !== "string" || !p.trim()) return false;
  try { const s = fs.statSync(path.resolve(HARNESS, p)); return s.isFile() && s.size > 0; } catch { return false; }
};

/** 그 칸을 실제로 찍은 커밋과 시각을 증거 파일에서 읽는다 (record-state.mjs 와 같은 경로). */
function provenanceOf(check) {
  const out = { head: null, at: null };
  if (!okFile(check.interactionEvidence)) return out;
  try {
    const md = fs.readFileSync(path.resolve(HARNESS, check.interactionEvidence), "utf8");
    out.head = (md.match(/multicultural-board HEAD ([0-9a-f]{7,40}|\(unknown\))/) || [])[1] || null;
    out.at = (md.match(/측정 시각: ([0-9T:.\-Z]+)/) || [])[1] || null;
  } catch { /* 못 읽으면 표기하지 않는다 */ }
  return out;
}

function observationOf(rec) {
  const cs = rec.checks;
  const m = (id, size) => cs.find((c) => c.device === id && c.textSize === size)?.measured || {};
  const cb = m("chromebook", "basic"), cl = m("chromebook", "large");
  const tp = m("tablet-portrait", "basic"), sv = m("split-view", "basic"), lp = m("laptop", "basic");
  const scrollOf = (x) => (x.docScroll && x.viewport ? (x.docScroll.h / x.viewport.h).toFixed(2) : "-");
  const tapMin = Math.min(...cs.map((c) => c.measured?.minTapInFold ?? 9999).filter((n) => n < 9999));
  const overflow = cs.filter((c) => (c.measured?.overflowX || 0) > 2);
  return [
    `크롬북 1366x768 기본 글씨에서 문서 높이가 뷰포트의 ${scrollOf(cb)}배(큰 글씨 ${scrollOf(cl)}배)이고,`,
    `첫 화면에 조작 ${cb.foldControlCount ?? "-"}개가 보인다. 본문 글자 중앙값은 기본 ${cb.bodyFontMedian ?? "-"}px,`,
    `큰 글씨 ${cl.bodyFontMedian ?? "-"}px 다.`,
    `태블릿 세로 820px 은 ${scrollOf(tp)}배, 화면 분할 800px 은 ${scrollOf(sv)}배, 노트북 1440px 은 ${scrollOf(lp)}배다.`,
    `10칸 전체에서 첫 화면 최소 조작 크기는 ${Number.isFinite(tapMin) ? tapMin + "px" : "측정 없음"}이고,`,
    overflow.length
      ? `${overflow.length}개 칸에서 가로 넘침이 났다(${overflow.map((c) => `${c.device}/${c.textSize} ${c.measured.overflowX}px`).join(", ")}).`
      : `어느 칸에서도 가로 넘침은 없었다.`,
  ].join(" ");
}

function changePlanOf(rec, extra) {
  const all = rec.checks.flatMap((c) => c.issues.map((i) => ({ cell: `${c.device}/${c.textSize}`, i })));
  if (all.length) {
    const uniq = [...new Set(all.map((a) => a.i))];
    return [
      `실측에서 나온 문제를 그대로 고친다:`,
      ...uniq.slice(0, 6).map((i, n) => `(${n + 1}) ${i}`),
      `해당 칸: ${[...new Set(all.map((a) => a.cell))].join(", ")}.`,
      `고친 뒤 같은 스크립트(scripts/audit/capture.mjs)로 같은 10칸을 다시 돌려 회귀를 확인한다.`,
      extra || "",
    ].filter(Boolean).join(" ");
  }
  return [
    `이번 측정에서 기기 5종 × 글자 2종 10칸 모두 가로 넘침 0px, 첫 화면 최소 조작 크기 기준(터치 48px · 포인터 44px) 충족,`,
    `Firebase//api 누수 0건, 콘솔 오류 0건이었다. 따라서 레이아웃 수정 계획이 아니라 유지 기준을 고정한다 —`,
    `이 화면을 고칠 때 위 네 값을 회귀 기준으로 삼고, 800px 분할 화면과 큰 글씨 조합을 반드시 같이 확인한다.`,
    `자동 측정이 증명하지 못하는 그림 품질·아동 이해도는 사람이 따로 본다(05 문서 "검사 한계").`,
    extra || "",
  ].filter(Boolean).join(" ");
}

/** 화면마다 before 를 어떻게 잡았는지. 이 화면들만의 사정을 여기에 적는다. */
function beforeNoteOf(rec) {
  if (rec.id === "advanced-world-map-quiz") {
    return [
      "before 는 601a8f0 당시 실제 진입 흐름(홈 허브 /ux-fixture/hub)이다 —",
      "이 화면은 4694dc7 에서 **새로 만든 화면**이라 '이전 판' 이라는 것이 존재하지 않는다.",
      "601a8f0 의 3402 에서 /ux-fixture/world-map 은 404 이고 제품에도 평면 세계지도 놀이가 없었다.",
      "그래서 screens.mjs 의 before 규약 중 same(같은 라우트의 이전 캡처)도 none(before 를 만들 수 없음)도 아닌 flow —",
      "\"그 시점 아이가 실제로 거치던 화면\" 을 before 로 쓴다. 즉 이 before 는 같은 화면의 예전 모습이 아니라,",
      "지도에서 나라를 찾고 싶은 아이가 그때 닿을 수 있던 마지막 화면(거기서 이 놀이로 가는 길은 없었다)이다.",
    ].join(" ");
  }
  if (rec.beforeKind === "flow") {
    return "before 는 601a8f0 당시 실제 진입 흐름(홈 허브)이다 — 이 화면은 이번 라운드에 새로 생긴 fixture 라 같은 라우트의 이전 캡처가 존재하지 않는다.";
  }
  if (rec.beforeUrl && rec.beforeUrl !== rec.url) {
    return `before 는 601a8f0 의 ${rec.beforeUrl} — 그 시점 같은 게임의 진입 경로다.`;
  }
  return "before 는 601a8f0 의 같은 fixture 라우트를 같은 뷰포트·같은 글자 크기로 찍은 것이다.";
}

/** 지도 화면의 칸별 클릭 정확도 한 줄 — interaction md 에서 실제 측정값을 읽어온다. */
function tapAccuracyOf(check) {
  if (!okFile(check.interactionEvidence)) return "";
  const md = fs.readFileSync(path.resolve(HARNESS, check.interactionEvidence), "utf8");
  const sec = md.split("## 지도 클릭 좌표 정확도")[1];
  if (!sec) return "";
  const hits = [...sec.matchAll(/- (\w{3}) 대표점 .*?고른 나라 `(\w+)` (일치|\*\*어긋남\*\*)/g)];
  const err = (sec.match(/최대 ([0-9.]+e[+-]?\d+)도/) || [])[1];
  const ocean = /유지됨/.test(sec);
  const size = (sec.match(/지도 실제 크기 (\d+x\d+)px/) || [])[1];
  if (!hits.length) return "";
  const bad = hits.filter((h) => h[3] !== "일치");
  return [
    `지도 클릭 정확도(이 화면 고유 검사): 지도 ${size ?? "-"}px 에서 대표점 ${hits.length}곳`,
    `(${hits.map((h) => h[1]).join("·")})을 실제로 눌러 ${bad.length ? `${bad.length}곳이 어긋났다(${bad.map((b) => b[1]).join(", ")})` : "전부 그 나라가 골라졌고"},`,
    `왕복 좌표 오차 최대 ${err ?? "-"}도, 바다 클릭에서 고른 나라가 ${ocean ? "유지됐다" : "지워졌다"}.`,
  ].join(" ");
}

function reviewOf(rec, c) {
  const m = c.measured || {};
  const prov = provenanceOf(c);
  return [
    `${c.device} ${m.viewport ? `${m.viewport.w}x${m.viewport.h}` : ""} 글자 ${c.textSize}:`,
    `문서 ${m.docScroll ? `${m.docScroll.w}x${m.docScroll.h}` : "-"}, 가로 넘침 ${m.overflowX ?? "-"}px,`,
    `첫 화면 조작 ${m.foldControlCount ?? "-"}개, 최소 조작 ${m.minTapInFold ?? "-"}px,`,
    `본문 글자 중앙값 ${m.bodyFontMedian ?? "-"}px, data-ux-text=${m.uxText ?? "-"}.`,
    (c.interactLog || []).join(" / ") + ".",
    rec.id === "advanced-world-map-quiz" ? tapAccuracyOf(c) : "",
    beforeNoteOf(rec),
    prov.head ? `이 칸은 ${prov.at ?? "시각 미상"} 에 HEAD ${prov.head} 에서 찍었다.` : "",
    c.issues.length ? `미해결: ${c.issues.join(" · ")}` : "",
  ].filter(Boolean).join(" ");
}

/* ── 본문 ──────────────────────────────────────────────── */

const EXTRA = {
  storybook:
    "이번 라운드에 실제로 고친 것: StorybookRoom 의 SessionHeader 뒤로 버튼이 width/height 40px 로 인라인 고정돼 " +
    "control 토큰의 최소 크기를 무력화하고 있었다(기본 글씨 5칸 전부 미달). 크기를 토큰에 맡기도록 바꿔 " +
    "기본 48px · 큰 글씨 70px 이 됐다 — 큰 글씨 칸의 최소 조작 크기가 50px 에서 70px 로 바뀐 것도 이 수정의 결과다.",
  praise:
    "1차 측정에서 미달이던 back/close 44x44 는 f8405c1 이후 48px 로 올라와 이번 재측정에서는 나오지 않는다.",
  board:
    "1차 측정에서 큰 글씨의 Listen 버튼이 36~39px 로 짓눌리던 것은 47226e7 이 .pc-btn 의 min-width 를 " +
    "var(--ux-control-min) 으로 되돌리면서 해소됐다 — 이번 재측정에서 56px 이다.",
  "reaction-picker":
    "1차 측정에서 큰 글씨의 Listen 버튼이 36~39px 로 짓눌리던 것은 47226e7 이 .pc-btn 의 min-width 를 " +
    "var(--ux-control-min) 으로 되돌리면서 해소됐다 — 이번 재측정에서 56px 이다.",
};

const cap = JSON.parse(fs.readFileSync(CAPTURE, "utf8"));
const byId = new Map(cap.map((s) => [s.id, s]));
/** 기존 증거 목록을 잃지 않으려고 state.json 을 **읽기만** 한다. */
const STATE_BY_ID = new Map(
  JSON.parse(fs.readFileSync(path.join(HARNESS, "state.json"), "utf8").replace(/^﻿/, ""))
    .screens.map((s) => [s.id, s]),
);
const args = process.argv.slice(2);
if (!args.length) { console.error("화면 id 를 하나 이상 주세요."); process.exit(1); }

const screens = [];
for (const arg of args) {
  const [id, cellSpec] = arg.split(":");
  const rec = byId.get(id);
  if (!rec) { console.error(`capture.json 에 ${id} 가 없습니다.`); process.exit(1); }
  const want = cellSpec
    ? new Set(cellSpec.split(",").map((s) => s.trim()))
    : null;

  // 지난 라운드의 증거(다른 보고서 폴더의 캡처·설계 감사 문서)를 잃지 않는다.
  // record-state.mjs 와 같게 — 기존 목록 중 **실제로 남아 있는 파일만** 앞에 두고
  // 이번에 찍은 것을 뒤에 붙인다. state.json 은 읽기만 한다(쓰지 않는다).
  const prior = (STATE_BY_ID.get(id)?.audit?.evidence || []).filter(okFile);
  const evidence = [...prior];
  for (const c of rec.checks) {
    if (okFile(c.after)) evidence.push(c.after);
    if (okFile(c.interactionEvidence)) evidence.push(c.interactionEvidence);
  }

  const checks = [];
  for (const c of rec.checks) {
    const key = `${c.device}/${c.textSize}`;
    if (want && !want.has(key)) continue;
    const filesOk = okFile(c.before) && okFile(c.after) && okFile(c.interactionEvidence) && c.before !== c.after;
    const clean = c.issues.length === 0;
    checks.push({
      device: c.device,
      textSize: c.textSize,
      status: clean && filesOk ? "passed" : "pending",
      before: okFile(c.before) ? c.before : "",
      after: okFile(c.after) ? c.after : "",
      review: reviewOf(rec, c),
      interactionEvidence: okFile(c.interactionEvidence) ? c.interactionEvidence : "",
      inputMethod: c.inputMethod,
      issues: c.issues.slice(),
    });
  }
  if (want) {
    const missing = [...want].filter((k) => !checks.some((c) => `${c.device}/${c.textSize}` === k));
    if (missing.length) { console.error(`${id}: 요청한 칸이 capture 에 없습니다 — ${missing.join(", ")}`); process.exit(1); }
  }

  screens.push({
    id,
    audit: {
      status: "reviewed",
      observation: observationOf(rec),
      childGoal: BY_ID.get(id)?.childGoal || "",
      changePlan: changePlanOf(rec, EXTRA[id]),
      evidence: [...new Set(evidence)],
    },
    checks,
  });
  console.log(`${id}: 칸 ${checks.length}개 (${checks.filter((c) => c.status === "passed").length} passed / ${checks.filter((c) => c.status !== "passed").length} pending)`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ screens }, null, 1), "utf8");
console.log(`\n→ ${OUT}`);

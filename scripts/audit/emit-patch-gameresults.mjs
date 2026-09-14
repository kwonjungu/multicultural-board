/**
 * 게임 결과 화면 4종의 실측 결과를 harness/patches/results.json 으로 내보낸다
 * (품질 하네스 3차 라운드, 2026-09-14).
 *
 * record-state.mjs 와 **같은 규칙·같은 문장 틀**을 쓰되 state.json 은 직접 쓰지
 * 않는다 — 감사자가 여럿 동시에 돌고 있어 각자 쓰면 서로 덮어쓴다. 합치는 일은
 * 한 곳에서 한다(emit-patch-worldmap.mjs 와 같은 방식, 파일만 다르다).
 *
 * 실행: 저장소 루트에서
 *   node scripts/audit/emit-patch-gameresults.mjs \
 *     reports/audit-20260914/capture-round3.json \
 *     reports/audit-20260914/capture-round3-yut.json \
 *     reports/audit-20260914/capture-round3-hg.json
 * 뒤에 오는 파일의 칸이 앞선 파일의 같은 칸을 대체한다.
 */
import fs from "node:fs";
import path from "node:path";

const HARNESS = "C:/Users/권준구/Desktop/꿀벌소통창_Opus_실행설계_20260913/harness";
const OUTFILE = path.join(HARNESS, "patches", "results.json");
const MINE = ["advanced-globe-results", "featured-globe-result", "featured-yut-result", "featured-halligalli-result"];
/** 할리갈리는 이번에 다시 찍은 칸만 내보낸다(나머지 9칸은 이미 통과). */
const ONLY_CELLS = { "featured-halligalli-result": [["tablet-landscape", "large"]] };

const { BY_ID } = await import("./screens.mjs");

const okFile = (p) => {
  if (!p || typeof p !== "string" || !p.trim()) return false;
  try { const s = fs.statSync(path.resolve(HARNESS, p)); return s.isFile() && s.size > 0; } catch { return false; }
};

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

function observationOf(cs) {
  const m = (id, size) => cs.find((c) => c.device === id && c.textSize === size)?.measured || {};
  const cb = m("chromebook", "basic"), cl = m("chromebook", "large");
  const tp = m("tablet-portrait", "basic"), sv = m("split-view", "basic"), lp = m("laptop", "basic");
  const scrollOf = (x) => (x.docScroll && x.viewport ? (x.docScroll.h / x.viewport.h).toFixed(2) : "-");
  const tapMin = Math.min(...cs.map((c) => c.measured?.minTapInFold ?? 9999).filter((n) => n < 9999));
  const overflow = cs.filter((c) => (c.measured?.overflowX || 0) > 2);
  return [
    `크롬북 1366x768 기본 글씨에서 문서 높이가 뷰포트의 ${scrollOf(cb)}배(큰 글씨 ${scrollOf(cl)}배)이고,`,
    `첫 화면에 조작 ${cb.foldControlCount ?? "-"}개가 보인다. 본문 글자 중앙값은 기본 ${cb.bodyFontMedian ?? "-"}px,`,
    // record-state.mjs 는 여기서 "로 실제로 커진다" 를 항상 붙인다. 이 화면들은
    // 글자 수가 적어 중앙값이 큰 그림 글자(예: 🏆 .gq-bigicon, clamp(...,6rem)
    // = 96px 고정)에 걸리는 칸이 있다 — 그럴 때 "커진다" 는 거짓이 되므로
    // 잰 값을 그대로 적고 커졌는지 아닌지는 최소 글자까지 보고 판단한다.
    `큰 글씨 ${cl.bodyFontMedian ?? "-"}px 이고, 본문 최소 글자는 ${cb.bodyFontMin ?? "-"}px → ${cl.bodyFontMin ?? "-"}px 다.`,
    (typeof cb.bodyFontMin === "number" && typeof cl.bodyFontMin === "number" && cl.bodyFontMin > cb.bodyFontMin)
      || (typeof cb.bodyFontMedian === "number" && typeof cl.bodyFontMedian === "number" && cl.bodyFontMedian > cb.bodyFontMedian)
      ? `큰 글씨 설정이 이 화면 글자를 실제로 키운다.`
      : `큰 글씨 설정이 이 화면 글자를 키우지 못했다 — 사람이 다시 봐야 한다.`,
    `태블릿 세로 820px 은 ${scrollOf(tp)}배, 화면 분할 800px 은 ${scrollOf(sv)}배, 노트북 1440px 은 ${scrollOf(lp)}배다.`,
    `10칸 전체에서 첫 화면 최소 조작 크기는 ${Number.isFinite(tapMin) ? tapMin + "px" : "측정 없음"}이고,`,
    overflow.length
      ? `${overflow.length}개 칸에서 가로 넘침이 났다(${overflow.map((c) => `${c.device}/${c.textSize} ${c.measured.overflowX}px`).join(", ")}).`
      : `어느 칸에서도 가로 넘침은 없었다.`,
  ].join(" ");
}

function changePlanOf(cs) {
  const all = cs.flatMap((c) => c.issues.map((i) => ({ cell: `${c.device}/${c.textSize}`, i })));
  if (!all.length) {
    return [
      `이번 측정에서 기기 5종 × 글자 2종 10칸 모두 가로 넘침 0px, 첫 화면 최소 조작 크기 기준(터치 48px · 포인터 44px) 충족,`,
      `Firebase//api 누수 0건, 콘솔 오류 0건이었다. 따라서 레이아웃 수정 계획이 아니라 유지 기준을 고정한다 —`,
      `이 화면을 고칠 때 위 네 값을 회귀 기준으로 삼고, 800px 분할 화면과 큰 글씨 조합을 반드시 같이 확인한다.`,
      `자동 측정이 증명하지 못하는 그림 품질·아동 이해도는 사람이 따로 본다(05 문서 "검사 한계").`,
    ].join(" ");
  }
  const uniq = [...new Set(all.map((a) => a.i))];
  return [
    `실측에서 나온 문제를 그대로 고친다:`,
    ...uniq.slice(0, 6).map((i, n) => `(${n + 1}) ${i}`),
    `해당 칸: ${[...new Set(all.map((a) => a.cell))].join(", ")}.`,
    `고친 뒤 같은 스크립트(scripts/audit/capture.mjs)로 같은 10칸을 다시 돌려 회귀를 확인한다.`,
  ].join(" ");
}

/** 이 라운드에서 새로 만든/바꾼 길을 그 화면의 review 에 한 줄로 남긴다. */
const ROUTE_NOTE = {
  "featured-yut-result": "이 결과 화면은 제품 경로 그대로 한 판을 끝까지 두어서 열었다(컴포넌트 수정 없음) — 시드 5 에서 던지기 58회·말 옮기기 57회·문화카드 11회를 거쳐 A팀이 이긴다. 세 가지 화면 모양(1366x768·820x1180·800x768)에서 이 숫자가 모두 같았고, 10칸 모두 본문 155자로 같은 결과 화면이 나왔다.",
  "advanced-globe-results": "이 결과 화면은 퀴즈 8라운드를 실제로 다 맞혀서 열었다 — GlobeQuest 에 fixture 전용 조준 훅(?pins=audit)만 달아 '그 나라 핀이 지금 화면 어디인지'를 알아냈고, 정답 판정·점수·시간은 제품이 그대로 정한다. 8라운드를 8번 눌러 다 맞혔고(지구를 돌린 횟수 0), 두 라우트·여러 화면 크기에서 결과 화면 글이 \"🏆 8 / 8 ⏱ 0:14\" 로 같았다.",
  "featured-globe-result": "이 결과 화면은 퀴즈 8라운드를 실제로 다 맞혀서 열었다 — GlobeQuest 에 fixture 전용 조준 훅(?pins=audit)만 달아 '그 나라 핀이 지금 화면 어디인지'를 알아냈고, 정답 판정·점수·시간은 제품이 그대로 정한다. 8라운드를 8번 눌러 다 맞혔고(지구를 돌린 횟수 0), 두 라우트·여러 화면 크기에서 결과 화면 글이 \"🏆 8 / 8 ⏱ 0:14\" 로 같았다.",
};

/**
 * before 설명을 화면별로 바로잡는다. record-state.mjs 의 기본 문장은 "after 라우트는
 * 무작위를 시드로 고정하려고 새로 만든 것" 이라고 적는데, 지구본 결과 화면은 라우트가
 * 같고 질의(?pins=audit)만 붙은 것이라 그 설명이 사실이 아니다.
 */
const BEFORE_NOTE = {
  "featured-globe-result":
    "before 는 601a8f0 의 /ux-fixture/game?game=globe — 같은 라우트의 이전 상태다. after 는 같은 라우트에 ?pins=audit 만 붙였다(핀 조준 훅). 그 질의는 이번 라운드에 생긴 것이라 601a8f0 에는 없다.",
};

const capFiles = process.argv.slice(2);
if (!capFiles.length) throw new Error("capture json 경로를 인자로 달라");
const recs = new Map();
for (const f of capFiles) {
  for (const r of JSON.parse(fs.readFileSync(f, "utf8"))) {
    if (!MINE.includes(r.id)) continue;
    const prev = recs.get(r.id);
    if (!prev) { recs.set(r.id, { ...r, checks: [...r.checks] }); continue; }
    // 나중 파일의 칸이 앞선 칸을 대체한다(같은 화면을 나눠 찍은 경우).
    for (const c of r.checks) {
      const i = prev.checks.findIndex((x) => x.device === c.device && x.textSize === c.textSize);
      if (i >= 0) prev.checks[i] = c; else prev.checks.push(c);
    }
    prev.url = r.url; prev.beforeUrl = r.beforeUrl; prev.beforeKind = r.beforeKind; prev.motion = r.motion;
  }
}

const screens = [];
const report = [];
let passed = 0, pending = 0;
for (const id of MINE) {
  const rec = recs.get(id);
  if (!rec) { report.push(`- ${id}: capture 결과 없음 → 내보내지 않음`); continue; }
  const meta = BY_ID.get(id);
  const evidence = [];
  for (const c of rec.checks) {
    if (okFile(c.after)) evidence.push(c.after);
    if (okFile(c.interactionEvidence)) evidence.push(c.interactionEvidence);
  }
  const audit = {
    status: "reviewed",
    observation: observationOf(rec.checks),
    childGoal: meta?.childGoal || "",
    changePlan: changePlanOf(rec.checks),
    evidence: [...new Set(evidence)],
  };

  const only = ONLY_CELLS[id];
  const checks = [];
  for (const c of rec.checks) {
    if (only && !only.some(([d, s]) => d === c.device && s === c.textSize)) continue;
    const filesOk = okFile(c.before) && okFile(c.after) && okFile(c.interactionEvidence) && c.before !== c.after;
    const clean = c.issues.length === 0;
    const m = c.measured || {};
    const beforeNote = BEFORE_NOTE[id] ? BEFORE_NOTE[id] : rec.beforeKind === "flow"
      ? "before 는 601a8f0 당시 실제 진입 흐름(홈 허브)이다 — 이 화면은 이번 라운드에 새로 생긴 fixture 라 같은 라우트의 이전 캡처가 존재하지 않는다."
      : rec.beforeUrl && rec.beforeUrl !== rec.url
        ? `before 는 601a8f0 의 ${rec.beforeUrl} — 그 시점 같은 게임의 진입 경로다. after 쪽 fixture 라우트(${rec.url})는 무작위를 시드로 고정하려고 이번 라운드에 새로 만든 것이라 601a8f0 에는 없다.`
        : "before 는 601a8f0 의 같은 fixture 라우트를 같은 뷰포트·같은 글자 크기로 찍은 것이다.";
    const prov = provenanceOf(c);
    const provNote = prov.head ? `이 칸은 ${prov.at ?? "시각 미상"} 에 HEAD ${prov.head} 에서 찍었다.` : "";
    const motionNote = rec.motion === "no-preference"
      ? "움직임 줄이기를 끈 상태(prefers-reduced-motion=no-preference / childUx.motion=full)로 쟀다 — 연출이 있는 쪽이 감사 대상인 화면이다."
      : "";
    const review = [
      `${c.device} ${m.viewport ? `${m.viewport.w}x${m.viewport.h}` : ""} 글자 ${c.textSize}:`,
      `문서 ${m.docScroll ? `${m.docScroll.w}x${m.docScroll.h}` : "-"}, 가로 넘침 ${m.overflowX ?? "-"}px,`,
      `첫 화면 조작 ${m.foldControlCount ?? "-"}개, 최소 조작 ${m.minTapInFold ?? "-"}px,`,
      `본문 글자 중앙값 ${m.bodyFontMedian ?? "-"}px, data-ux-text=${m.uxText ?? "-"}.`,
      (c.interactLog || []).join(" / ") + ".",
      ROUTE_NOTE[id] || "",
      motionNote,
      beforeNote,
      provNote,
      clean ? "" : `미해결: ${c.issues.join(" · ")}`,
    ].filter(Boolean).join(" ");
    const status = clean && filesOk ? "passed" : "pending";
    if (status === "passed") passed++; else { pending++; report.push(`- ${id}/${c.device}/${c.textSize}: pending — ${clean ? "증거 파일 부족" : c.issues[0]}`); }
    checks.push({
      device: c.device, textSize: c.textSize, status,
      before: okFile(c.before) ? c.before : "",
      after: okFile(c.after) ? c.after : "",
      review,
      interactionEvidence: okFile(c.interactionEvidence) ? c.interactionEvidence : "",
      inputMethod: c.inputMethod,
      issues: c.issues.slice(),
    });
  }
  screens.push({ id, audit, checks });
}

fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
fs.writeFileSync(OUTFILE, JSON.stringify({ screens }, null, 1), "utf8");
console.log(report.join("\n") || "(pending 없음)");
console.log(`\n화면 ${screens.length}개, 칸 passed ${passed} / pending ${pending}`);
console.log("→ " + OUTFILE);

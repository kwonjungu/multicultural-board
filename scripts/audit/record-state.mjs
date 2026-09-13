/**
 * capture.mjs 의 실측 결과를 harness/state.json 에 기록한다 (품질 하네스, 2026-09-14).
 *
 * 규칙 (05 문서 "실행하지 않은 것은 passed 로 바꾸지 않는다"):
 *   - 칸은 issues 가 비어 있고, before/after/interactionEvidence 파일이 실제로
 *     존재하며 크기가 0 이 아니고, before !== after 일 때에만 passed 로 적는다.
 *   - 하나라도 어긋나면 pending 으로 두고 issues 를 그대로 남긴다.
 *   - 감사하지 못한 화면(fixture 없음)은 audit 을 건드리지 않는다 — pending 그대로.
 *
 * 실행: 저장소 루트에서 `node scripts/audit/record-state.mjs [--write]`
 *       --write 없이 돌리면 무엇이 바뀔지만 출력한다(기본 dry-run).
 */
import fs from "node:fs";
import path from "node:path";
import { SCREENS, BY_ID } from "./screens.mjs";

const HARNESS = "C:/Users/권준구/Desktop/꿀벌소통창_Opus_실행설계_20260913/harness";
const STATE = path.join(HARNESS, "state.json");
const CAPTURE = path.resolve("reports/audit-20260914/capture.json");
const WRITE = process.argv.includes("--write");

const okFile = (p) => {
  if (!p || typeof p !== "string" || !p.trim()) return false;
  try { const s = fs.statSync(path.resolve(HARNESS, p)); return s.isFile() && s.size > 0; } catch { return false; }
};

const cap = JSON.parse(fs.readFileSync(CAPTURE, "utf8"));
const state = JSON.parse(fs.readFileSync(STATE, "utf8").replace(/^\uFEFF/, ""));
const byId = new Map(cap.map((s) => [s.id, s]));

/** 실측값에서 그 화면의 관찰문을 만든다 — 지어낸 말이 아니라 측정한 수치다. */
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
    `큰 글씨 ${cl.bodyFontMedian ?? "-"}px 로 실제로 커진다.`,
    `태블릿 세로 820px 은 ${scrollOf(tp)}배, 화면 분할 800px 은 ${scrollOf(sv)}배, 노트북 1440px 은 ${scrollOf(lp)}배다.`,
    `10칸 전체에서 첫 화면 최소 조작 크기는 ${Number.isFinite(tapMin) ? tapMin + "px" : "측정 없음"}이고,`,
    overflow.length
      ? `${overflow.length}개 칸에서 가로 넘침이 났다(${overflow.map((c) => `${c.device}/${c.textSize} ${c.measured.overflowX}px`).join(", ")}).`
      : `어느 칸에서도 가로 넘침은 없었다.`,
  ].join(" ");
}

/** 실측에서 나온 문제를 그대로 수정 계획으로 옮긴다. 문제가 없으면 유지 기준을 계획으로 적는다. */
function changePlanOf(rec) {
  const all = rec.checks.flatMap((c) => c.issues.map((i) => ({ cell: `${c.device}/${c.textSize}`, i })));
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

const report = [];
let passedCells = 0, pendingCells = 0, reviewedScreens = 0;

for (const target of state.screens) {
  const rec = byId.get(target.id);
  const meta = BY_ID.get(target.id);
  if (!rec) {
    report.push(`- ${target.id}: 감사 못 함 (${meta?.reason || "capture 결과 없음"}) → 손대지 않음`);
    continue;
  }

  // ── 화면 audit ─────────────────────────────────────────────────────────
  const evidence = [];
  for (const c of rec.checks) {
    if (okFile(c.after)) evidence.push(c.after);
    if (okFile(c.interactionEvidence)) evidence.push(c.interactionEvidence);
  }
  const uniqEvidence = [...new Set(evidence)];
  if (uniqEvidence.length) {
    target.audit.status = "reviewed";
    target.audit.childGoal = meta?.childGoal || target.audit.childGoal;
    target.audit.observation = observationOf(rec);
    target.audit.changePlan = changePlanOf(rec);
    target.audit.evidence = [...new Set([...(target.audit.evidence || []).filter(okFile), ...uniqEvidence])];
    reviewedScreens++;
  }

  // ── 칸별 checks ────────────────────────────────────────────────────────
  for (const c of rec.checks) {
    const row = target.checks.find((x) => x.device === c.device && x.textSize === c.textSize);
    if (!row) continue;
    const filesOk = okFile(c.before) && okFile(c.after) && okFile(c.interactionEvidence) && c.before !== c.after;
    const clean = c.issues.length === 0;
    row.issues = c.issues.slice();
    row.inputMethod = c.inputMethod;
    row.interactionEvidence = okFile(c.interactionEvidence) ? c.interactionEvidence : "";
    row.before = okFile(c.before) ? c.before : "";
    row.after = okFile(c.after) ? c.after : "";
    const m = c.measured || {};
    const beforeNote = rec.beforeKind === "flow"
      ? "before 는 601a8f0 당시 실제 진입 흐름(홈 허브)이다 — 이 화면은 이번 라운드에 새로 생긴 fixture 라 같은 라우트의 이전 캡처가 존재하지 않는다."
      : "before 는 601a8f0 의 같은 fixture 라우트를 같은 뷰포트·같은 글자 크기로 찍은 것이다.";
    row.review = [
      `${c.device} ${m.viewport ? `${m.viewport.w}x${m.viewport.h}` : ""} 글자 ${c.textSize}:`,
      `문서 ${m.docScroll ? `${m.docScroll.w}x${m.docScroll.h}` : "-"}, 가로 넘침 ${m.overflowX ?? "-"}px,`,
      `첫 화면 조작 ${m.foldControlCount ?? "-"}개, 최소 조작 ${m.minTapInFold ?? "-"}px,`,
      `본문 글자 중앙값 ${m.bodyFontMedian ?? "-"}px, data-ux-text=${m.uxText ?? "-"}.`,
      (c.interactLog || []).join(" / ") + ".",
      beforeNote,
      clean ? "" : `미해결: ${c.issues.join(" · ")}`,
    ].filter(Boolean).join(" ");

    if (clean && filesOk) { row.status = "passed"; passedCells++; }
    else {
      row.status = "pending";
      pendingCells++;
      report.push(`- ${target.id}/${c.device}/${c.textSize}: pending — ${clean ? "증거 파일 부족(before 없음 등)" : c.issues[0]}`);
    }
  }
}

state.repository = {
  path: "C:/Users/권준구/multicultural-board",
  head: "4dca8c5",
  branch: "main",
  note: "2026-09-14 품질 하네스 감사. after=3300(이 저장소 HEAD 4dca8c5), before=3402(git worktree C:/Users/권준구/mb-before-601a8f0, 601a8f0). 증거는 이 저장소 reports/audit-20260914/ 아래 절대경로.",
};

console.log(report.join("\n") || "(pending 없음)");
console.log(`\n화면 reviewed ${reviewedScreens} / 45, 칸 passed ${passedCells} / 450, pending ${pendingCells}`);
if (WRITE) {
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1), "utf8");
  console.log(`\nstate.json 갱신함: ${STATE}`);
} else {
  console.log("\n(dry-run — 실제로 쓰려면 --write)");
}

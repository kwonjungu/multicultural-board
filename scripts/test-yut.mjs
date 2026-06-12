// HoneyYut v2 로직 단위 테스트.
// 사용법: node scripts/test-yut.mjs
// (yutTypes/yutLogic/yutData 를 tsc 로 임시 컴파일한 뒤 검증한다)

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const out = mkdtempSync(join(tmpdir(), "yut-test-"));
try {
  execSync(
    `npx tsc lib/yutTypes.ts lib/yutLogic.ts lib/yutData.ts --outDir "${out}" --module commonjs --target es2022 --skipLibCheck`,
    { stdio: "inherit" },
  );
} catch {
  console.error("tsc 컴파일 실패");
  process.exit(1);
}

const require2 = createRequire(pathToFileURL(join(out, "noop.js")));
const L = require2(join(out, "yutLogic.js"));

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; }
  else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

// ── walkForward / normalize ──
eq("1+개 → 3", L.walkForward({ node: 1, route: "outer" }, 2), { node: 3, route: "outer" });
eq("4+도 → 5 = diagA 진입", L.walkForward({ node: 4, route: "outer" }, 1), { node: 5, route: "diagA" });
eq("4+개 → 6 (5 통과는 outer 유지)", L.walkForward({ node: 4, route: "outer" }, 2), { node: 6, route: "outer" });
eq("5(diagA)+걸 → 중앙 cut", L.walkForward({ node: 5, route: "diagA" }, 3), { node: 22, route: "cut" });
eq("5(diagA)+윷 → 23 (중앙 통과)", L.walkForward({ node: 5, route: "diagA" }, 4), { node: 23, route: "diagA" });
eq("5(diagA)+모 → 24", L.walkForward({ node: 5, route: "diagA" }, 5), { node: 24, route: "diagA" });
eq("24(diagA)+도 → 15 outer 합류", L.walkForward({ node: 24, route: "diagA" }, 1), { node: 15, route: "outer" });
eq("9+도 → 10 = diagB 진입", L.walkForward({ node: 9, route: "outer" }, 1), { node: 10, route: "diagB" });
eq("10(diagB)+걸 → 중앙 cut", L.walkForward({ node: 10, route: "diagB" }, 3), { node: 22, route: "cut" });
eq("10(diagB)+모 → 28", L.walkForward({ node: 10, route: "diagB" }, 5), { node: 28, route: "diagB" });
eq("28(diagB)+도 → 골", L.walkForward({ node: 28, route: "diagB" }, 1), "goal");
eq("28(diagB)+윷 → 골 (지나침)", L.walkForward({ node: 28, route: "diagB" }, 4), "goal");
eq("중앙 cut+개 → 28", L.walkForward({ node: 22, route: "cut" }, 2), { node: 28, route: "cut" });
eq("중앙 cut+걸 → 골", L.walkForward({ node: 22, route: "cut" }, 3), "goal");
eq("19+도 → 골", L.walkForward({ node: 19, route: "outer" }, 1), "goal");
eq("18+모 → 골 (지나침)", L.walkForward({ node: 18, route: "outer" }, 5), "goal");
eq("출발칸0+도 → 골", L.walkForward({ node: 0, route: "outer" }, 1), "goal");

// ── stepBackward ──
eq("백도: 1 → 0", L.stepBackward({ node: 1, route: "outer" }), { node: 0, route: "outer" });
eq("백도: 0 → 집", L.stepBackward({ node: 0, route: "outer" }), "home");
eq("백도: 6 → 5 diagA", L.stepBackward({ node: 6, route: "outer" }), { node: 5, route: "diagA" });
eq("백도: 20 → 5 diagA", L.stepBackward({ node: 20, route: "diagA" }), { node: 5, route: "diagA" });
eq("백도: 23 → 중앙 cut", L.stepBackward({ node: 23, route: "diagA" }), { node: 22, route: "cut" });
eq("백도: 27 → 중앙 cut", L.stepBackward({ node: 27, route: "diagB" }), { node: 22, route: "cut" });

// ── 리듀서 시나리오 ──
function fresh() { return L.makeInitialState(); }

// 던지기 → 큐 적립, 윷/모 추가 던지기
let s = fresh();
s = L.reducer(s, { type: "throwResult", value: 4 });
eq("윷 → 큐 [4], 다시 던지기", [s.queue, s.phase], [[4], "needThrow"]);
s = L.reducer(s, { type: "throwResult", value: 2 });
eq("개 → 큐 [4,2], move", [s.queue, s.phase], [[4, 2], "move"]);

// 집 + 모 = 5 → diagA, 문화카드
s = fresh();
s = L.reducer(s, { type: "throwResult", value: 5 });
s = L.reducer(s, { type: "throwResult", value: 1 });
s = L.reducer(s, { type: "move", pieceId: "A-0", queueIndex: 0 }); // 모 사용
eq("집+모 → 5칸 diagA", s.pieces["A-0"].pos, { kind: "board", node: 5, route: "diagA" });
eq("문화카드 발동", s.cultureNode, 5);
s = L.reducer(s, { type: "closeCulture" });
eq("문화카드 닫기", s.cultureNode, null);
eq("문화카드 더블 닫기 무해", L.reducer(s, { type: "closeCulture" }).cultureNode, null);

// 잡기 → 상대 집 + 한 번 더
s = fresh();
s.pieces["A-0"].pos = { kind: "board", node: 3, route: "outer" };
s.pieces["B-0"].pos = { kind: "board", node: 5, route: "diagA" };
s.queue = [2]; s.phase = "move";
s = L.reducer(s, { type: "move", pieceId: "A-0", queueIndex: 0 });
eq("잡기: B 말 집으로", s.pieces["B-0"].pos, { kind: "home" });
eq("잡기: 한 번 더", s.phase, "needThrow");
eq("잡기: 턴 유지", s.turn, "A");

// diagA 이동
s = fresh();
s.pieces["A-1"].pos = { kind: "board", node: 5, route: "diagA" };
s.queue = [2]; s.phase = "move";
s = L.reducer(s, { type: "move", pieceId: "A-1", queueIndex: 0 });
eq("diagA 5+개 → 21", s.pieces["A-1"].pos, { kind: "board", node: 21, route: "diagA" });

// 업기: 같은 칸 멈춤 → 함께 이동
s = fresh();
s.pieces["A-0"].pos = { kind: "board", node: 9, route: "outer" };
s.pieces["A-1"].pos = { kind: "board", node: 7, route: "outer" };
s.queue = [2]; s.phase = "move";
s = L.reducer(s, { type: "move", pieceId: "A-1", queueIndex: 0 }); // 7+2 → 9 업기
eq("업기: 같은 칸", [s.pieces["A-0"].pos.node, s.pieces["A-1"].pos.node], [9, 9]);
s.queue = [1]; s.phase = "move"; s.turn = "A";
s = L.reducer(s, { type: "move", pieceId: "A-0", queueIndex: 0 });
eq("업힌 말 함께 이동", [s.pieces["A-0"].pos, s.pieces["A-1"].pos], [
  { kind: "board", node: 10, route: "diagB" },
  { kind: "board", node: 10, route: "diagB" },
]);

// 골인 → 모두 골이면 승리
s = fresh();
s.pieces["A-0"].pos = { kind: "goal" };
s.pieces["A-1"].pos = { kind: "goal" };
s.pieces["A-2"].pos = { kind: "goal" };
s.pieces["A-3"].pos = { kind: "board", node: 19, route: "outer" };
s.queue = [3]; s.phase = "move";
s = L.reducer(s, { type: "move", pieceId: "A-3", queueIndex: 0 });
eq("마지막 말 골인 → 승리", [s.phase, s.winner], ["win", "A"]);

// 백도만 있고 보드에 말 없음 → 자동 턴 넘김
s = fresh();
s = L.reducer(s, { type: "throwResult", value: -1 });
eq("백도 무용 → 턴 넘김", [s.turn, s.phase, s.queue], ["B", "needThrow", []]);

// 던지기 phase 가드 (move 중 throwResult 무시)
s = fresh();
s = L.reducer(s, { type: "throwResult", value: 2 });
const s2 = L.reducer(s, { type: "throwResult", value: 3 });
eq("move 중 던지기 무시", s2.queue, [2]);

// throwSticks 분포 sanity
const counts = { "-1": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
for (let i = 0; i < 20000; i++) counts[String(L.throwSticks().value)]++;
const ok = counts["2"] > counts["4"] && counts["3"] > counts["5"] && counts["-1"] > 0;
eq("던지기 분포 sanity", ok, true);

rmSync(out, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

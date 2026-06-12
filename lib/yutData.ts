// HoneyYut v2 — 보드 좌표 (SVG viewBox 0..1000).
//
// 노드 배치 (29개)
// ---------------------------------------------------------------
//   바깥 둘레 0..19, 출발(0)은 우하단. 시계 반대 방향으로:
//     0(우하) → 1..4 오른쪽 변 위로 → 5(우상)
//     → 6..9 윗변 왼쪽으로 → 10(좌상)
//     → 11..14 왼쪽 변 아래로 → 15(좌하)
//     → 16..19 아랫변 오른쪽으로 → (한 바퀴 = 골)
//   대각선 (X자):
//     diagA: 5 → 20 → 21 → 22(중앙) → 23 → 24 → 15
//     diagB: 10 → 25 → 26 → 22(중앙) → 27 → 28 → 골(0)
// ---------------------------------------------------------------

export interface YutNode {
  idx: number;
  x: number;
  y: number;
  kind: "start" | "corner" | "edge" | "diag" | "center";
}

const PAD = 120;
const MAX = 1000 - PAD;
const C = 500;

const BR = { x: MAX, y: MAX }; // 0 출발/골
const TR = { x: MAX, y: PAD }; // 5
const TL = { x: PAD, y: PAD }; // 10
const BL = { x: PAD, y: MAX }; // 15

function lerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) };
}

function edge(a: { x: number; y: number }, b: { x: number; y: number }): Array<{ x: number; y: number }> {
  // a 제외, 중간 4점 (b 직전까지)
  return [1, 2, 3, 4].map((s) => lerp(a, b, s / 5));
}

const CENTER = { x: C, y: C };

const coords: Array<{ x: number; y: number }> = [
  BR,            // 0
  ...edge(BR, TR), // 1..4
  TR,            // 5
  ...edge(TR, TL), // 6..9
  TL,            // 10
  ...edge(TL, BL), // 11..14
  BL,            // 15
  ...edge(BL, BR), // 16..19
  lerp(TR, CENTER, 1 / 3),  // 20
  lerp(TR, CENTER, 2 / 3),  // 21
  CENTER,                   // 22
  lerp(CENTER, BL, 1 / 3),  // 23
  lerp(CENTER, BL, 2 / 3),  // 24
  lerp(TL, CENTER, 1 / 3),  // 25
  lerp(TL, CENTER, 2 / 3),  // 26
  lerp(CENTER, BR, 1 / 3),  // 27
  lerp(CENTER, BR, 2 / 3),  // 28
];

function kindOf(idx: number): YutNode["kind"] {
  if (idx === 0) return "start";
  if (idx === 5 || idx === 10 || idx === 15) return "corner";
  if (idx === 22) return "center";
  if (idx >= 20) return "diag";
  return "edge";
}

export const YUT_NODES: YutNode[] = coords.map((c, idx) => ({ idx, ...c, kind: kindOf(idx) }));

// 보드에 그릴 연결선 (시각 전용)
export const YUT_EDGES: Array<[number, number]> = [
  // 바깥 둘레
  ...Array.from({ length: 19 }, (_, i) => [i, i + 1] as [number, number]),
  [19, 0],
  // 대각선
  [5, 20], [20, 21], [21, 22], [22, 23], [23, 24], [24, 15],
  [10, 25], [25, 26], [26, 22], [22, 27], [27, 28], [28, 0],
];

// Leitner 5박스 SRS — 표현 복습용.
// 정답이면 박스 한 단계 올라가서 더 긴 간격 후 재출제, 오답이면 1박스로 리셋.
// 간격: 1 / 3 / 7 / 14 / 30 일.

export type SrsBox = 1 | 2 | 3 | 4 | 5;

export const SRS_INTERVALS_MS: Record<SrsBox, number> = {
  1: 1  * 24 * 60 * 60 * 1000,
  2: 3  * 24 * 60 * 60 * 1000,
  3: 7  * 24 * 60 * 60 * 1000,
  4: 14 * 24 * 60 * 60 * 1000,
  5: 30 * 24 * 60 * 60 * 1000,
};

export const SRS_BOX_LABEL: Record<SrsBox, string> = {
  1: "오늘 다시",
  2: "3일 뒤",
  3: "1주 뒤",
  4: "2주 뒤",
  5: "1달 뒤",
};

// 정답/오답 후 다음 박스 계산. correct=false 면 항상 1박스로 강하 (Leitner 표준).
export function nextBoxAfter(box: SrsBox, correct: boolean): SrsBox {
  if (!correct) return 1;
  return Math.min(5, box + 1) as SrsBox;
}

// 박스 기준 다음 복습 예정 시각.
export function nextDueAt(box: SrsBox, now: number = Date.now()): number {
  return now + SRS_INTERVALS_MS[box];
}

// 지금 시점에 복습 가능한지.
export function isDueNow(due: number, now: number = Date.now()): boolean {
  return now >= due;
}

// 신규 항목 — 박스 1에서 시작, 즉시 due (당장 한 번 보고 1박스 간격으로 옮김).
export function initialBox(): SrsBox { return 1; }
export function initialDue(now: number = Date.now()): number { return now; }

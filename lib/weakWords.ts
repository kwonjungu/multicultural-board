// 약점 단어 선정 — VocabAttempt raw 로그를 단어별로 집계해 "지금 복습이 필요한"
// 단어를 점수화한다. 순수 함수만 (Firebase 의존 없음 — 호출부가 attempts 를 fetch).
//
// 점수 구성 (0~1):
//   - 오답률 50%        : 틀린 문항 비율
//   - 재시도 부담 20%   : 문항당 평균 시도 횟수 (1회 = 0, 3회 이상 = 1)
//   - 최근 오답 가중 30% : 틀린 시점이 최근일수록 높음 (7일 선형 감쇠)
//
// 제외 규칙: 시도(문항) 수 2회 미만, 또는 약점 신호가 전혀 없는 단어 (score 0).

import type { VocabAttempt } from "./vocabAttempts";

export const MIN_ATTEMPTS = 2;        // 이 미만 시도된 단어는 판단 보류
export const MAX_WEAK_WORDS = 8;      // 복습 레슨 최대 단어 수
export const MIN_REVIEW_WORDS = 3;    // 카드 노출 최소 단어 수
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 최근 7일

export interface WeakWordStat {
  wordId: string;
  total: number;            // 문항 수 (이 단어가 출제된 횟수)
  wrong: number;            // 틀린 문항 수
  wrongRate: number;        // 0~1
  avgTries: number;         // 문항당 평균 시도 횟수 (attempts 필드 평균)
  recentWrongWeight: number; // 0~1 — 틀린 문항들의 최근성 평균 (1 = 방금, 0 = 7일 이전)
  score: number;            // 종합 약점 점수 0~1
}

const W_WRONG_RATE = 0.5;
const W_AVG_TRIES = 0.2;
const W_RECENCY = 0.3;

// 단어별 집계 + 점수화. 시도수 미달/무신호 단어 포함 전체를 점수 내림차순으로 반환.
export function computeWeakWordStats(
  attempts: VocabAttempt[],
  now: number = Date.now(),
): WeakWordStat[] {
  const byWord = new Map<string, VocabAttempt[]>();
  for (const a of attempts) {
    if (!a || typeof a.wordId !== "string" || !a.wordId) continue;
    const list = byWord.get(a.wordId);
    if (list) list.push(a);
    else byWord.set(a.wordId, [a]);
  }

  const out: WeakWordStat[] = [];
  byWord.forEach((list, wordId) => {
    const total = list.length;
    let wrong = 0;
    let triesSum = 0;
    let recencySum = 0; // 틀린 문항의 최근성 가중 합
    for (const a of list) {
      // attempts 필드 이상치 방어 (음수/NaN → 1)
      const tries = Number.isFinite(a.attempts) && a.attempts >= 1 ? a.attempts : 1;
      triesSum += tries;
      if (!a.correct) {
        wrong += 1;
        const age = now - (Number.isFinite(a.ts) ? a.ts : 0);
        recencySum += Math.max(0, 1 - age / RECENT_WINDOW_MS);
      }
    }
    const wrongRate = total > 0 ? wrong / total : 0;
    const avgTries = total > 0 ? triesSum / total : 1;
    const recentWrongWeight = wrong > 0 ? recencySum / wrong : 0;

    // 재시도 부담: 평균 1회(한 번에 정답) = 0, 3회 이상 = 1
    const retryBurden = Math.max(0, Math.min(1, (avgTries - 1) / 2));

    const score =
      W_WRONG_RATE * wrongRate +
      W_AVG_TRIES * retryBurden +
      W_RECENCY * recentWrongWeight;

    out.push({ wordId, total, wrong, wrongRate, avgTries, recentWrongWeight, score });
  });

  out.sort((a, b) => b.score - a.score || b.wrong - a.wrong || b.total - a.total);
  return out;
}

// 복습 레슨용 최종 선정 — 시도수 2회 이상 + 약점 신호(score > 0)만, 상위 최대 8개.
export function pickWeakWords(
  attempts: VocabAttempt[],
  now: number = Date.now(),
): WeakWordStat[] {
  return computeWeakWordStats(attempts, now)
    .filter((s) => s.total >= MIN_ATTEMPTS && s.score > 0)
    .slice(0, MAX_WEAK_WORDS);
}

// 편의 — wordId 배열만 필요할 때.
export function pickWeakWordIds(
  attempts: VocabAttempt[],
  now: number = Date.now(),
): string[] {
  return pickWeakWords(attempts, now).map((s) => s.wordId);
}

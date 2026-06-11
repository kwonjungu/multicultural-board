// 데일리 골 자동 산정 — 학습자 최근 활동에 따라 50/100/200 중 추천.
// 너무 자주 바뀌지 않도록 하향은 1단계씩 천천히, 상향은 데이터가 분명할 때만.

import { XP_PER_CORRECT, DAILY_GOAL_OPTIONS } from "./lms";
import type { VocabAttempt } from "./vocabAttempts";

export interface GoalSuggestion {
  goal: number;
  changed: boolean;        // 현재 골과 달라서 적용 권장 여부
  reason: string;          // 학생에게 보여줄 한 줄 이유
  basis: {
    dailyAvgAttempts: number;
    activeDays: number;
    estimatedDailyXp: number;
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pickTier(estimatedDailyXp: number): number {
  // 50% 여유로 챌린지 — 평균 XP 의 1.0~1.3 배 목표가 도전감 있는 골.
  // 평균 30 XP 면 50 목표, 평균 80 XP 면 100 목표, 평균 150 XP 면 200 목표.
  if (estimatedDailyXp >= 130) return 200;
  if (estimatedDailyXp >= 55) return 100;
  return 50;
}

export function suggestGoal(
  attempts: VocabAttempt[],
  currentGoal: number,
  currentStreak: number,
  now: number = Date.now(),
): GoalSuggestion {
  // 최근 7일치만 — 7일 전보다 오래된 건 제외.
  const recent = attempts.filter((a) => now - a.ts < WEEK_MS);

  if (recent.length === 0) {
    return {
      goal: 50,
      changed: currentGoal !== 50,
      reason: "처음이니까 50 XP부터 시작해요",
      basis: { dailyAvgAttempts: 0, activeDays: 0, estimatedDailyXp: 0 },
    };
  }

  // 활동한 날짜 수 (실제로 학습한 일수만 평균에 쓴다 — 안 한 날은 빼고)
  const activeDays = new Set(recent.map((a) => dateKey(a.ts))).size;
  const dailyAvgAttempts = recent.length / Math.max(1, activeDays);
  const correctCount = recent.filter((a) => a.correct).length;
  const correctPerDay = correctCount / Math.max(1, activeDays);
  const estimatedDailyXp = correctPerDay * XP_PER_CORRECT;

  let target = pickTier(estimatedDailyXp);

  // 7일 이상 연속 스트릭이면 한 단계 상향 보너스 (200 상한)
  if (currentStreak >= 7) {
    const idx = DAILY_GOAL_OPTIONS.indexOf(target as 50 | 100 | 200);
    if (idx >= 0 && idx < DAILY_GOAL_OPTIONS.length - 1) {
      target = DAILY_GOAL_OPTIONS[idx + 1];
    }
  }

  // 하향 조정은 한 번에 1단계만 (200→100, 100→50). 급락 방지.
  if (target < currentGoal) {
    const curIdx = DAILY_GOAL_OPTIONS.indexOf(currentGoal as 50 | 100 | 200);
    if (curIdx > 0) {
      target = Math.max(target, DAILY_GOAL_OPTIONS[curIdx - 1]);
    }
  }

  // 이유 문구
  let reason: string;
  if (target === currentGoal) {
    reason = `지금 목표 ${currentGoal} XP가 잘 맞아요`;
  } else if (target > currentGoal) {
    reason = currentStreak >= 7
      ? `🔥 ${currentStreak}일 연속! 목표를 ${target} XP로 올렸어요`
      : `잘하고 있어서 목표를 ${target} XP로 올렸어요`;
  } else {
    reason = `오늘은 ${target} XP로 가볍게 가볼까요`;
  }

  return {
    goal: target,
    changed: target !== currentGoal,
    reason,
    basis: {
      dailyAvgAttempts: Math.round(dailyAvgAttempts * 10) / 10,
      activeDays,
      estimatedDailyXp: Math.round(estimatedDailyXp),
    },
  };
}

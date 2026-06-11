// Duolingo 스타일 LMS 상태 — 학생당 XP, 하트, 스트릭, 데일리 골, 레슨 완료.
// Firebase path: rooms/{roomCode}/lms/{clientId} = LearnerState

import { ref, get, set, onValue, off, update, runTransaction } from "firebase/database";
import { getClientDb } from "./firebase-client";

export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 30 * 60 * 1000;       // 하트 1개당 30분 회복
export const XP_PER_CORRECT = 10;                    // 정답 기본 XP
export const COMBO_BONUS_STEPS: Array<{ at: number; bonus: number }> = [
  { at: 3, bonus: 5 },
  { at: 5, bonus: 10 },
  { at: 10, bonus: 20 },
];
export const LESSON_COMPLETE_BONUS = 20;
export const PERFECT_BONUS = 30;                     // 100% 정답 시
export const DAILY_GOAL_OPTIONS = [50, 100, 200] as const;
export const DEFAULT_DAILY_GOAL = 50;

export interface LessonResult {
  stars: 1 | 2 | 3;       // 정답률 기반
  bestAccuracy: number;   // 0~1, 가장 최근/최고 성취
  completedAt: number;    // ms
  attempts: number;       // 이 레슨 도전 횟수
}

export interface LearnerState {
  xp: number;
  hearts: number;
  heartsLastLost: number;        // 0 또는 마지막으로 하트 잃은 시각 (회복 계산)
  streak: number;                // 연속 학습일 수
  streakLastDate: string;        // YYYY-MM-DD (마지막으로 일일 골 달성한 날)
  dailyXp: number;
  dailyXpDate: string;           // YYYY-MM-DD (오늘이 아니면 0으로 리셋)
  dailyGoal: number;
  lessons: Record<string, LessonResult>;
}

export function emptyState(): LearnerState {
  return {
    xp: 0,
    hearts: MAX_HEARTS,
    heartsLastLost: 0,
    streak: 0,
    streakLastDate: "",
    dailyXp: 0,
    dailyXpDate: "",
    dailyGoal: DEFAULT_DAILY_GOAL,
    lessons: {},
  };
}

function basePath(roomCode: string, clientId: string): string {
  return `rooms/${roomCode}/lms/${clientId}`;
}

function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isYesterday(dateStr: string): boolean {
  if (!dateStr) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return todayKey(y) === dateStr;
}

// ── 정규화 ──

export function normalize(raw: unknown): LearnerState {
  const e = emptyState();
  if (!raw || typeof raw !== "object") return e;
  const r = raw as Partial<LearnerState>;
  return {
    xp: Number.isFinite(r.xp) ? Number(r.xp) : 0,
    hearts: Number.isFinite(r.hearts) ? Math.max(0, Math.min(MAX_HEARTS, Number(r.hearts))) : MAX_HEARTS,
    heartsLastLost: Number.isFinite(r.heartsLastLost) ? Number(r.heartsLastLost) : 0,
    streak: Number.isFinite(r.streak) ? Number(r.streak) : 0,
    streakLastDate: typeof r.streakLastDate === "string" ? r.streakLastDate : "",
    dailyXp: Number.isFinite(r.dailyXp) ? Number(r.dailyXp) : 0,
    dailyXpDate: typeof r.dailyXpDate === "string" ? r.dailyXpDate : "",
    dailyGoal: Number.isFinite(r.dailyGoal) ? Number(r.dailyGoal) : DEFAULT_DAILY_GOAL,
    lessons: (r.lessons && typeof r.lessons === "object") ? (r.lessons as Record<string, LessonResult>) : {},
  };
}

// ── 레벨/콤보/하트 헬퍼 (순수 함수) ──

export function levelFromXp(xp: number): number {
  // 50, 150, 300, 500, 750, 1050, 1400, … (50 * level * (level+1) / 2 누적)
  if (xp < 50) return 0;
  return Math.floor((-1 + Math.sqrt(1 + (8 * xp) / 50)) / 2);
}

export function xpForLevel(level: number): number {
  return (50 * level * (level + 1)) / 2;
}

export function xpToNextLevel(xp: number): { current: number; needed: number; ratio: number } {
  const lvl = levelFromXp(xp);
  const base = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);
  const current = xp - base;
  const needed = next - base;
  return { current, needed, ratio: Math.min(1, current / needed) };
}

export function comboBonus(comboCount: number): number {
  let bonus = 0;
  for (const step of COMBO_BONUS_STEPS) {
    if (comboCount >= step.at) bonus = step.bonus;
  }
  return bonus;
}

// 회복 시각 이후로 회복된 하트 수를 더해 현재 하트를 계산.
export function effectiveHearts(state: LearnerState, now: number = Date.now()): number {
  if (state.hearts >= MAX_HEARTS) return MAX_HEARTS;
  if (!state.heartsLastLost) return state.hearts;
  const elapsed = now - state.heartsLastLost;
  if (elapsed <= 0) return state.hearts;
  const regen = Math.floor(elapsed / HEART_REGEN_MS);
  return Math.min(MAX_HEARTS, state.hearts + regen);
}

// 다음 하트까지 남은 ms (0 이면 이미 회복됨 또는 만렙).
export function msUntilNextHeart(state: LearnerState, now: number = Date.now()): number {
  if (effectiveHearts(state, now) >= MAX_HEARTS) return 0;
  const elapsed = now - state.heartsLastLost;
  const sinceLastRegen = elapsed % HEART_REGEN_MS;
  return Math.max(0, HEART_REGEN_MS - sinceLastRegen);
}

export function starsFromAccuracy(correct: number, total: number): 1 | 2 | 3 {
  if (total <= 0) return 1;
  const r = correct / total;
  if (r >= 0.95) return 3;
  if (r >= 0.7) return 2;
  return 1;
}

// ── Firebase I/O ──

export async function fetchLearner(roomCode: string, clientId: string): Promise<LearnerState> {
  const db = getClientDb();
  const snap = await get(ref(db, basePath(roomCode, clientId)));
  return normalize(snap.val());
}

export function subscribeLearner(
  roomCode: string,
  clientId: string,
  cb: (s: LearnerState) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, basePath(roomCode, clientId));
  const handler = onValue(r, (snap) => {
    cb(normalize(snap.val()));
  });
  return () => off(r, "value", handler);
}

// 하트 잃기 — 트랜잭션으로 안전하게 차감.
export async function loseHeart(roomCode: string, clientId: string): Promise<LearnerState> {
  const db = getClientDb();
  const r = ref(db, basePath(roomCode, clientId));
  const result = await runTransaction(r, (raw: unknown) => {
    const cur = normalize(raw);
    const now = Date.now();
    // 회복 적용 먼저
    const live = effectiveHearts(cur, now);
    if (live <= 0) return cur;
    const nextHearts = live - 1;
    const next: LearnerState = {
      ...cur,
      hearts: nextHearts,
      heartsLastLost: nextHearts === live ? cur.heartsLastLost : now,
    };
    return next;
  });
  return normalize(result.snapshot.val());
}

// 하트 가득 채우기 (교사 회복 명령용)
export async function refillHearts(roomCode: string, clientId: string): Promise<void> {
  const db = getClientDb();
  const r = ref(db, basePath(roomCode, clientId));
  await runTransaction(r, (raw: unknown) => {
    const cur = normalize(raw);
    return { ...cur, hearts: MAX_HEARTS, heartsLastLost: 0 };
  });
}

// 데일리 골 변경
export async function setDailyGoal(roomCode: string, clientId: string, goal: number): Promise<void> {
  const db = getClientDb();
  await update(ref(db, basePath(roomCode, clientId)), { dailyGoal: goal });
}

// XP 부여 + 데일리 XP + 스트릭 갱신을 한 트랜잭션으로 처리.
// returns: { leveledUp, prevLevel, nextLevel, streakGained, goalReachedNow }
export interface AwardResult {
  state: LearnerState;
  leveledUp: boolean;
  prevLevel: number;
  nextLevel: number;
  goalReachedNow: boolean;
  streakGained: boolean;
}

export async function awardXp(
  roomCode: string,
  clientId: string,
  amount: number,
): Promise<AwardResult> {
  const db = getClientDb();
  const r = ref(db, basePath(roomCode, clientId));
  let prevLevel = 0;
  let nextLevel = 0;
  let goalReachedNow = false;
  let streakGained = false;

  const result = await runTransaction(r, (raw: unknown) => {
    const cur = normalize(raw);
    prevLevel = levelFromXp(cur.xp);
    const today = todayKey();

    // 데일리 XP — 오늘이 아니면 리셋
    const dailyXpBefore = cur.dailyXpDate === today ? cur.dailyXp : 0;
    const dailyXpAfter = dailyXpBefore + amount;
    const goalReachedBefore = dailyXpBefore >= cur.dailyGoal;
    const goalReachedAfter = dailyXpAfter >= cur.dailyGoal;
    goalReachedNow = !goalReachedBefore && goalReachedAfter;

    // 스트릭 — 오늘 골 처음 달성 시에만 +1, 어제도 달성했으면 연속
    let streak = cur.streak;
    let streakLastDate = cur.streakLastDate;
    if (goalReachedNow) {
      if (streakLastDate === today) {
        // already counted today — keep
      } else if (isYesterday(streakLastDate)) {
        streak = streak + 1;
        streakLastDate = today;
        streakGained = true;
      } else {
        streak = 1;
        streakLastDate = today;
        streakGained = true;
      }
    }

    const next: LearnerState = {
      ...cur,
      xp: cur.xp + amount,
      dailyXp: dailyXpAfter,
      dailyXpDate: today,
      streak,
      streakLastDate,
    };
    nextLevel = levelFromXp(next.xp);
    return next;
  });

  return {
    state: normalize(result.snapshot.val()),
    leveledUp: nextLevel > prevLevel,
    prevLevel,
    nextLevel,
    goalReachedNow,
    streakGained,
  };
}

// 레슨 완료 결과 기록 — 별/정답률/시도 횟수 누적.
export async function recordLessonResult(
  roomCode: string,
  clientId: string,
  lessonId: string,
  correct: number,
  total: number,
): Promise<{ stars: 1 | 2 | 3; isFirstClear: boolean }> {
  const db = getClientDb();
  const r = ref(db, basePath(roomCode, clientId));
  let stars: 1 | 2 | 3 = 1;
  let isFirstClear = false;

  await runTransaction(r, (raw: unknown) => {
    const cur = normalize(raw);
    const accuracy = total > 0 ? correct / total : 0;
    const newStars = starsFromAccuracy(correct, total);
    const prev = cur.lessons?.[lessonId];
    isFirstClear = !prev;
    stars = (prev && prev.stars > newStars ? prev.stars : newStars) as 1 | 2 | 3;
    const updated: LessonResult = {
      stars,
      bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
      completedAt: Date.now(),
      attempts: (prev?.attempts ?? 0) + 1,
    };
    return {
      ...cur,
      lessons: { ...(cur.lessons ?? {}), [lessonId]: updated },
    };
  });

  return { stars, isFirstClear };
}

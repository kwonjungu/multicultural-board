// 📋 오늘의 심부름 (일일 퀘스트) — 엔진 코어. 설계: docs/일일퀘스트-설계.md
//
// rooms/{roomCode}/quests/{clientId}/{YYYY-MM-DD} =
//   { events: {type: n}, claimed: {questId: true}, bonus: true }
//
// - 각 모듈은 reportQuestEvent() 한 줄만 호출 (fire-and-forget, 내부 격리).
// - 오늘의 퀘스트 3개는 hash(날짜+이름) 결정적 회전 — 서버 크론 불필요.
// - 보상 수령은 가드 트랜잭션 선점 → 꿀 지급 트랜잭션 (마을 물주기 패턴).
// ⚠ 이 파일은 오케스트레이션 계약 — UI(A)·계측(B) 에이전트는 수정 금지.

import { ref, onValue, off, runTransaction } from "firebase/database";
import { getClientDb } from "./firebase-client";

export type QuestEventType =
  | "vocab_session"
  | "expression_review"
  | "emotion_checkin"
  | "board_card"
  | "gallery_like"
  | "storybook_read"
  | "game_play"
  | "village_water";

export interface QuestDef {
  id: string;
  event: QuestEventType;
  emoji: string;
  label: string;        // 한국어 하드코딩 (마을 정책과 동일)
  target: number;
  reward: number;       // 🍯
}

export const QUEST_POOL: QuestDef[] = [
  { id: "q-vocab",      event: "vocab_session",     emoji: "🃏", label: "단어 공부 한 판 끝내기", target: 1, reward: 15 },
  { id: "q-expression", event: "expression_review", emoji: "✍️", label: "표현 복습 한 판",       target: 1, reward: 15 },
  { id: "q-emotion",    event: "emotion_checkin",   emoji: "💚", label: "오늘 기분 남기기",       target: 1, reward: 10 },
  { id: "q-board",      event: "board_card",        emoji: "📝", label: "소통판에 글 쓰기",       target: 1, reward: 15 },
  { id: "q-like",       event: "gallery_like",      emoji: "❤️", label: "친구 꿀벌 응원하기",     target: 1, reward: 10 },
  { id: "q-storybook",  event: "storybook_read",    emoji: "📖", label: "그림책 읽기",           target: 1, reward: 15 },
  { id: "q-game",       event: "game_play",         emoji: "🎮", label: "게임 한 판 놀기",       target: 1, reward: 10 },
  { id: "q-water",      event: "village_water",     emoji: "💧", label: "친구 정원에 물주기",     target: 1, reward: 10 },
];

export const DAILY_QUEST_COUNT = 3;
export const BONUS_HONEY = 20;   // 🌟 황금 이슬 (올클리어)
export const BONUS_XP = 30;      // 보너스 수령 시 awardXp 병행 (UI 쪽 책임)

export interface DailyQuestState {
  events?: Partial<Record<QuestEventType, number>>;
  claimed?: Record<string, true>;
  bonus?: true;
}

export function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function basePath(roomCode: string, clientId: string, dateKey: string): string {
  return `rooms/${roomCode}/quests/${clientId}/${dateKey}`;
}

// ── 오늘의 퀘스트 3개 — 결정적 회전 ──────────────────────────────
// 같은 (날짜, 학생) 이면 어디서 호출해도 같은 조합. 시드가 연속된 날에도
// 조합이 크게 바뀌도록 문자 해시(FNV-1a 유사)를 사용.
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailyQuestsFor(dateKey: string, clientId: string): QuestDef[] {
  const picked: QuestDef[] = [];
  const pool = [...QUEST_POOL];
  let seed = hashSeed(`${dateKey}::${clientId}`);
  for (let i = 0; i < DAILY_QUEST_COUNT && pool.length > 0; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    picked.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return picked;
}

// ── 이벤트 보고 (모듈 계측용 — 유일한 쓰기 진입점) ─────────────────
// fire-and-forget: 호출부 흐름을 절대 방해하지 않는다 (내부에서 모든 예외 삼킴).
// 오늘의 퀘스트 여부와 무관하게 모든 타입을 기록 (통계 재활용, 쓰기 단순화).
export function reportQuestEvent(
  roomCode: string,
  clientId: string,
  type: QuestEventType,
  n = 1,
): void {
  try {
    if (!roomCode || !clientId) return;
    const db = getClientDb();
    const r = ref(db, `${basePath(roomCode, clientId, todayKey())}/events/${type}`);
    runTransaction(r, (cur: number | null) => (cur ?? 0) + n).catch(() => {
      /* 조용히 무시 — 퀘스트 집계 실패가 학습 활동을 막으면 안 됨 */
    });
  } catch {
    /* getClientDb 실패 등 — 동일하게 무시 */
  }
}

// ── 구독 ─────────────────────────────────────────────────────────
export function subscribeTodayQuests(
  roomCode: string,
  clientId: string,
  cb: (state: DailyQuestState) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, basePath(roomCode, clientId, todayKey()));
  const unsub = onValue(r, (snap) => {
    cb((snap.val() as DailyQuestState | null) ?? {});
  });
  return () => { off(r); void unsub; };
}

// ── 진행/수령 판정 (순수 함수 — UI 용) ───────────────────────────
export function questProgress(q: QuestDef, state: DailyQuestState): number {
  return Math.min(q.target, state.events?.[q.event] ?? 0);
}
export function questDone(q: QuestDef, state: DailyQuestState): boolean {
  return questProgress(q, state) >= q.target;
}
export function questClaimed(q: QuestDef, state: DailyQuestState): boolean {
  return state.claimed?.[q.id] === true;
}
/** 미수령 보상 개수 (탭 배지용): 완료&미수령 퀘 + 보너스 */
export function unclaimedCount(quests: QuestDef[], state: DailyQuestState): number {
  let n = quests.filter((q) => questDone(q, state) && !questClaimed(q, state)).length;
  const allDone = quests.length > 0 && quests.every((q) => questDone(q, state));
  if (allDone && state.bonus !== true) n += 1;
  return n;
}

// ── 보상 수령 ─────────────────────────────────────────────────────
// 1) claimed/{questId} 가드 트랜잭션 선점 (이미 있으면 abort)
// 2) village honey 트랜잭션 지급 — 2노드라 단일 트랜잭션 불가 (물주기와
//    동일한 트레이드오프: 가드 선점 후 지급 실패 시 해당 보상 유실 가능,
//    학급 규모에선 실용상 무시).
async function claimGuard(path: string): Promise<boolean> {
  const db = getClientDb();
  const res = await runTransaction(ref(db, path), (cur: true | null) => {
    if (cur === true) return; // abort — 이미 수령
    return true;
  });
  return res.committed;
}

async function addHoney(roomCode: string, clientId: string, amount: number): Promise<void> {
  const db = getClientDb();
  await runTransaction(
    ref(db, `rooms/${roomCode}/village/${clientId}/honey`),
    (cur: number | null) => (cur ?? 0) + amount,
  );
}

/** 개별 퀘스트 보상 수령. 성공 시 지급량, 이미 수령/미완료면 null. */
export async function claimQuestReward(
  roomCode: string,
  clientId: string,
  quest: QuestDef,
  state: DailyQuestState,
): Promise<number | null> {
  if (!questDone(quest, state) || questClaimed(quest, state)) return null;
  const dateKey = todayKey();
  const ok = await claimGuard(`${basePath(roomCode, clientId, dateKey)}/claimed/${quest.id}`);
  if (!ok) return null;
  await addHoney(roomCode, clientId, quest.reward);
  return quest.reward;
}

/** 올클리어 보너스(황금 이슬) 수령. XP 지급(awardXp BONUS_XP)은 호출부 책임. */
export async function claimBonusReward(
  roomCode: string,
  clientId: string,
  quests: QuestDef[],
  state: DailyQuestState,
): Promise<number | null> {
  const allDone = quests.length > 0 && quests.every((q) => questDone(q, state));
  if (!allDone || state.bonus === true) return null;
  const dateKey = todayKey();
  const ok = await claimGuard(`${basePath(roomCode, clientId, dateKey)}/bonus`);
  if (!ok) return null;
  await addHoney(roomCode, clientId, BONUS_HONEY);
  return BONUS_HONEY;
}

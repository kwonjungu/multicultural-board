// 📋 오늘의 심부름 (일일 퀘스트) — 엔진 코어. 설계: docs/일일퀘스트-설계.md
//
// rooms/{roomCode}/quests/{clientId}/{dayKey} =
//   { events: {type: n, __seen?: {eventKey: true}},
//     claimed: {questId: RewardEntry | true},
//     bonus: RewardEntry | true }
// rooms/{roomCode}/village/{clientId} =
//   { honey, rewardEvents: {eventKey: {amount, at}}, ... }   ← 지급 멱등 집합
//
// - 각 모듈은 reportQuestEvent() 한 줄만 호출 (fire-and-forget, 내부 격리).
// - 오늘의 퀘스트 3개는 hash(날짜+이름) 결정적 회전 — 서버 크론 불필요.
// - **dayKey 는 교실 timezone 기준**(lib/classroomDay.ts). 기기 로컬 날짜 금지.
// - 보상 수령은 원장(lib/rewardLedger.ts) 을 통해서만. 선점→지급 2단계의
//   중간 실패가 미지급으로 굳지 않도록 재처리 경로를 함께 둔다.
// ⚠ 이 파일은 오케스트레이션 계약 — UI(A)·계측(B) 에이전트는 수정 금지.

import { ref, onValue, runTransaction, update, get } from "@/lib/db";
import { getClientDb } from "./firebase-client";
import { awardXp } from "./lms";
import {
  DEFAULT_CLASSROOM_TIME_ZONE,
  dayKeyAt,
  resolveTimeZone,
} from "./classroomDay";
import {
  BONUS_QUEST_ID,
  REWARD_POLICY_VERSION,
  createEntry,
  normalizeEntry,
  pendingEntries,
  reserveUpdater,
  settleAll,
  settleReward,
  walletApplyUpdater,
  type RewardEntry,
  type RewardStore,
  type SettleResult,
  type StepOutcome,
  type WalletNode,
} from "./rewardLedger";

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
export const BONUS_XP = 30;      // 보너스 지급 이벤트에 함께 묶인 XP

/**
 * 퀘스트 이름은 지금도 한국어 하드코딩이다(마을 정책과 동일 — 의도된 결정).
 * 교실마다 '오늘의 탐험' 처럼 부르고 싶다는 요구(X07)를 위해 **표시 이름만**
 * 갈아끼울 수 있는 자리를 만들어 둔다. 실제 교체 UI/데이터는 별도 과제다.
 */
export const QUEST_BOARD_TITLE = "오늘의 심부름";

export interface DailyQuestState {
  events?: Partial<Record<QuestEventType, number>> & { __seen?: Record<string, true> };
  /** 값은 신규 원장 항목, 또는 옛 `true`. */
  claimed?: Record<string, RewardEntry | true>;
  bonus?: RewardEntry | true;
}

// ── 교실 시간대 ───────────────────────────────────────────────────────
// dayKey 는 기기 시간대가 아니라 교실 시간대로 정한다. 방 설정
// (rooms/{roomCode}/config/timeZone) 을 읽되, 계측 호출(reportQuestEvent)은
// 방 설정이 아직 안 왔을 수도 있으므로 마지막으로 확인한 값을 캐시한다.
const tzByRoom = new Map<string, string>();
const TZ_LS_PREFIX = "quests.tz.";

function lsGet(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* 사생활 모드 등 — 무시 */
  }
}

/** 방 시간대를 캐시에 반영. 구독이 없는 경로(reportQuestEvent)도 이 값을 쓴다. */
export function setClassroomTimeZone(roomCode: string, tz?: string | null): string {
  const resolved = resolveTimeZone(tz);
  if (roomCode) {
    tzByRoom.set(roomCode, resolved);
    lsSet(`${TZ_LS_PREFIX}${roomCode}`, resolved);
  }
  return resolved;
}

/** 현재 알고 있는 교실 시간대 (없으면 기본값). */
export function classroomTimeZone(roomCode?: string): string {
  if (!roomCode) return DEFAULT_CLASSROOM_TIME_ZONE;
  const hit = tzByRoom.get(roomCode);
  if (hit) return hit;
  const stored = lsGet(`${TZ_LS_PREFIX}${roomCode}`);
  if (stored) {
    const resolved = resolveTimeZone(stored);
    tzByRoom.set(roomCode, resolved);
    return resolved;
  }
  return DEFAULT_CLASSROOM_TIME_ZONE;
}

/** 방 설정의 timeZone 구독. 값이 오면 캐시도 갱신한다. */
export function subscribeClassroomTimeZone(
  roomCode: string,
  cb: (tz: string) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, `rooms/${roomCode}/config/timeZone`);
  const unsub = onValue(r, (snap) => {
    cb(setClassroomTimeZone(roomCode, snap.val() as string | null));
  });
  return () => unsub();
}

/**
 * 교실 기준 오늘 날짜 키.
 * @param timeZone 생략하면 기본 교실 시간대(Asia/Seoul). 방 시간대를 쓰려면
 *                 `todayKey(classroomTimeZone(roomCode))` 처럼 명시한다.
 */
export function todayKey(timeZone?: string | null): string {
  return dayKeyAt(Date.now(), timeZone);
}

/** 방 기준 오늘 (캐시된 교실 시간대 사용). */
export function roomTodayKey(roomCode: string, at: number = Date.now()): string {
  return dayKeyAt(at, classroomTimeZone(roomCode));
}

function basePath(roomCode: string, clientId: string, dateKey: string): string {
  return `rooms/${roomCode}/quests/${clientId}/${dateKey}`;
}

function claimPath(roomCode: string, clientId: string, dateKey: string, questId: string): string {
  return questId === BONUS_QUEST_ID
    ? `${basePath(roomCode, clientId, dateKey)}/bonus`
    : `${basePath(roomCode, clientId, dateKey)}/claimed/${questId}`;
}

function walletPath(roomCode: string, clientId: string): string {
  return `rooms/${roomCode}/village/${clientId}`;
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
//
// ⚠ 멱등화: 기본 경로는 종전과 **완전히 동일**한 `+n` 트랜잭션이다. 호출부가
// 안정적인 eventKey(예: 세션 id)를 넘길 때만 `events/__seen` 집합으로 중복을
// 막는다. 두 경로 모두 "events/{type} = 보고된 사건 수" 라는 의미를 바꾸지
// 않는다(퀘스트 target 은 전부 1이라 화면 판정에도 영향이 없다).
export function reportQuestEvent(
  roomCode: string,
  clientId: string,
  type: QuestEventType,
  n = 1,
  opts?: { eventKey?: string; dayKey?: string },
): void {
  try {
    if (!roomCode || !clientId) return;
    const db = getClientDb();
    const dayKey = opts?.dayKey || roomTodayKey(roomCode);
    const base = basePath(roomCode, clientId, dayKey);
    const eventKey = opts?.eventKey ? String(opts.eventKey).replace(/[.#$/[\]\s]/g, "_") : "";

    if (!eventKey) {
      const r = ref(db, `${base}/events/${type}`);
      runTransaction(r, (cur: number | null) => (cur ?? 0) + n).catch(() => {
        /* 조용히 무시 — 퀘스트 집계 실패가 학습 활동을 막으면 안 됨 */
      });
      return;
    }

    // 계수와 중복 가드가 같은 노드(events)에 있어야 원자적이다. 이 서브트리는
    // 학생 1명의 그날 이벤트 뿐이라 (숫자 8개 + seen 몇 개) 전송량이 작다.
    const r = ref(db, `${base}/events`);
    runTransaction(r, (cur: Record<string, unknown> | null) => {
      const seen = (cur?.__seen as Record<string, true> | undefined) ?? {};
      if (seen[eventKey]) return; // abort — 같은 사건 재보고
      const prev = typeof cur?.[type] === "number" ? (cur[type] as number) : 0;
      return { ...(cur ?? {}), [type]: prev + n, __seen: { ...seen, [eventKey]: true } };
    }).catch(() => {
      /* 동일하게 무시 */
    });
  } catch {
    /* getClientDb 실패 등 — 동일하게 무시 */
  }
}

// ── 구독 ─────────────────────────────────────────────────────────
/**
 * @param dayKey 생략하면 교실 기준 오늘. 화면이 자정을 넘겨 살아 있을 수 있으므로
 *               호출부(QuestBoard)가 **목록 계산과 같은 값**을 넘겨야 한다.
 *
 * cleanup 은 반드시 onValue 가 돌려준 unsubscribe 를 쓴다. 종전의 `off(r)` 는
 * 같은 경로를 보는 **다른 컴포넌트의 listener 까지** 끊었다 (ADD-SUB-01).
 */
export function subscribeTodayQuests(
  roomCode: string,
  clientId: string,
  cb: (state: DailyQuestState) => void,
  dayKey?: string,
): () => void {
  const db = getClientDb();
  const key = dayKey || roomTodayKey(roomCode);
  const r = ref(db, basePath(roomCode, clientId, key));
  const unsub = onValue(r, (snap) => {
    cb((snap.val() as DailyQuestState | null) ?? {});
  });
  return () => unsub();
}

// ── 진행/수령 판정 (순수 함수 — UI 용) ───────────────────────────
export function questProgress(q: QuestDef, state: DailyQuestState): number {
  return Math.min(q.target, state.events?.[q.event] ?? 0);
}
export function questDone(q: QuestDef, state: DailyQuestState): boolean {
  return questProgress(q, state) >= q.target;
}

/** 지급까지 **끝난** 것만 true. 중간에 멈춘 claim 은 pending 이라 다시 받을 수 있다. */
export function questClaimed(q: QuestDef, state: DailyQuestState): boolean {
  return questClaimState(q, state) === "applied";
}

export function questClaimState(q: QuestDef, state: DailyQuestState): "none" | "pending" | "applied" {
  const raw = state.claimed?.[q.id];
  const e = normalizeEntry(raw, { questId: q.id, amount: q.reward });
  if (!e) return "none";
  return e.status === "applied" ? "applied" : "pending";
}

export function bonusClaimState(state: DailyQuestState): "none" | "pending" | "applied" {
  const e = normalizeEntry(state.bonus, { questId: BONUS_QUEST_ID, amount: BONUS_HONEY, xpAmount: BONUS_XP });
  if (!e) return "none";
  return e.status === "applied" ? "applied" : "pending";
}

/** 미수령 보상 개수 (탭 배지용): 완료&미수령 퀘 + 보너스. pending 도 '받을 것' 으로 센다. */
export function unclaimedCount(quests: QuestDef[], state: DailyQuestState): number {
  let n = quests.filter((q) => questDone(q, state) && !questClaimed(q, state)).length;
  const allDone = quests.length > 0 && quests.every((q) => questDone(q, state));
  if (allDone && bonusClaimState(state) !== "applied") n += 1;
  return n;
}

/** 화면에 "받는 중 / 다시 받기" 로 보여야 하는 항목들. */
export function pendingRewards(quests: QuestDef[], state: DailyQuestState): RewardEntry[] {
  const list: Array<RewardEntry | null> = [];
  for (const q of quests) {
    list.push(normalizeEntry(state.claimed?.[q.id], { questId: q.id, amount: q.reward }));
  }
  list.push(normalizeEntry(state.bonus, { questId: BONUS_QUEST_ID, amount: BONUS_HONEY, xpAmount: BONUS_XP }));
  return pendingEntries(list);
}

// ── 보상 수령 (원장 경유) ─────────────────────────────────────────
// 1) claimed/{questId} 에 원장 항목 선점 (트랜잭션, 이미 있으면 그 항목 사용)
// 2) village/{clientId} 트랜잭션으로 꿀 + rewardEvents[eventKey] 를 **함께** 기록
// 3) lms/{clientId}/rewardEvents/{eventKey} 가드 후 awardXp
// 4) 각 단계 뒤에 원장 갱신 — 어디서 끊겨도 재처리가 이어간다.
//
// 지갑 트랜잭션의 범위는 village/{clientId} 한 노드다. collectDailyDew ·
// exchangeStickerHoney · buyAndEquipDeco 가 이미 같은 노드를 통째로 트랜잭션
// 하므로 전송량·충돌 특성이 기존과 같다. 방 전체(rooms/{room}) 같은 공통 조상
// 트랜잭션은 쓰지 않는다 — 학생 30명의 모든 데이터를 매 수령마다 내려받고
// 서로 충돌한다.

function plain(entry: RewardEntry): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export function createQuestStore(roomCode: string, clientId: string, dayKey: string): RewardStore {
  const db = getClientDb();
  return {
    now: () => Date.now(),

    async reserve(draft: RewardEntry): Promise<RewardEntry> {
      const r = ref(db, claimPath(roomCode, clientId, dayKey, draft.questId));
      const res = await runTransaction(r, reserveUpdater(draft) as (cur: unknown) => unknown);
      // StrictMode double-invoke 주의 — 캡처값이 아니라 스냅샷을 다시 읽는다.
      const stored = normalizeEntry(res.snapshot.val(), {
        learnerId: draft.learnerId,
        questId: draft.questId,
        dayKey: draft.dayKey,
        amount: draft.amount,
        xpAmount: draft.xpAmount,
        now: Date.now(),
      });
      return stored ?? draft;
    },

    async applyHoney(entry: RewardEntry): Promise<StepOutcome> {
      if (entry.amount <= 0) return { state: "already" };
      const r = ref(db, walletPath(roomCode, clientId));
      const res = await runTransaction(
        r,
        walletApplyUpdater(entry.eventKey, entry.amount, Date.now()) as (cur: unknown) => unknown,
      );
      // abort 의 유일한 사유는 "이미 반영됨" 이다 (updater 참조).
      return res.committed ? { state: "applied", paid: entry.amount } : { state: "already" };
    },

    async applyXp(entry: RewardEntry): Promise<StepOutcome> {
      if (entry.xpAmount <= 0) return { state: "already" };
      // ⚠ 남은 한계: XP 는 lib/lms.ts 의 awardXp 가 학습자 노드를 통째로
      // 트랜잭션한다. 그 트랜잭션 안에 eventKey 가드를 넣을 수 없어(이 파일은
      // lms.ts 를 수정하지 않는다) 가드를 **선반영** 한다. 따라서
      //   · 중복 지급: 없음 (가드가 이미 있으면 다시 주지 않는다)
      //   · 가드 기록 후 awardXp 전에 프로세스가 죽으면: XP 만 누락될 수 있고
      //     그 항목은 xp="uncertain" 으로 남아 교사가 확인할 수 있다.
      // 보고서의 lms.ts patch(awardXpOnce)가 들어가면 이 한계는 사라진다.
      const guardRef = ref(db, `rooms/${roomCode}/lms/${clientId}/rewardEvents/${entry.eventKey}`);
      const res = await runTransaction(guardRef, (cur: unknown) => {
        if (cur) return; // abort — 이미 예약/적용
        return { amount: entry.xpAmount, at: Date.now(), status: "reserved" };
      });
      if (!res.committed) {
        const cur = res.snapshot.val() as { status?: string } | null;
        if (cur && cur.status === "applied") return { state: "already" };
        return { state: "uncertain", reason: "xp-guard-reserved" };
      }
      await awardXp(roomCode, clientId, entry.xpAmount);
      await update(guardRef, { status: "applied" });
      return { state: "applied", paid: entry.xpAmount };
    },

    async persist(entry: RewardEntry): Promise<void> {
      const r = ref(db, claimPath(roomCode, clientId, dayKey, entry.questId));
      await update(r, plain(entry));
    },
  };
}

export interface ClaimOutcome {
  /** 이번 호출로 실제 지급된 🍯 (이미 지급된 건이면 0) */
  honey: number;
  /** 이번 호출로 실제 지급된 XP */
  xp: number;
  status: "paid" | "already" | "pending" | "skipped";
  entry?: RewardEntry;
  error?: string;
}

function draftFor(
  clientId: string,
  dayKey: string,
  questId: string,
  amount: number,
  xpAmount: number,
): RewardEntry {
  return createEntry({
    learnerId: clientId,
    questId,
    dayKey,
    amount,
    xpAmount,
    policyVersion: REWARD_POLICY_VERSION,
    now: Date.now(),
  });
}

function toOutcome(res: SettleResult): ClaimOutcome {
  if (res.outcome === "failed") {
    return { honey: res.honeyPaid, xp: res.xpPaid, status: "pending", entry: res.entry, error: res.error };
  }
  if (res.outcome === "already") return { honey: 0, xp: 0, status: "already", entry: res.entry };
  return { honey: res.honeyPaid, xp: res.xpPaid, status: "paid", entry: res.entry };
}

/**
 * 개별 퀘스트 보상 수령/재처리.
 * @param dayKey 완료 당시의 교실 날짜. 자정을 넘겨도 보상은 **원래 날짜에 귀속**된다.
 */
export async function claimQuestReward(
  roomCode: string,
  clientId: string,
  quest: QuestDef,
  state: DailyQuestState,
  dayKey: string,
): Promise<ClaimOutcome> {
  if (!questDone(quest, state)) return { honey: 0, xp: 0, status: "skipped" };
  if (questClaimState(quest, state) === "applied") return { honey: 0, xp: 0, status: "already" };
  const store = createQuestStore(roomCode, clientId, dayKey);
  const draft = draftFor(clientId, dayKey, quest.id, quest.reward, 0);
  return toOutcome(await settleReward(store, draft));
}

/** 올클리어 보너스(황금 이슬). XP(BONUS_XP)도 **같은 지급 이벤트**에 묶인다. */
export async function claimBonusReward(
  roomCode: string,
  clientId: string,
  quests: QuestDef[],
  state: DailyQuestState,
  dayKey: string,
): Promise<ClaimOutcome> {
  const allDone = quests.length > 0 && quests.every((q) => questDone(q, state));
  if (!allDone) return { honey: 0, xp: 0, status: "skipped" };
  if (bonusClaimState(state) === "applied") return { honey: 0, xp: 0, status: "already" };
  const store = createQuestStore(roomCode, clientId, dayKey);
  const draft = draftFor(clientId, dayKey, BONUS_QUEST_ID, BONUS_HONEY, BONUS_XP);
  return toOutcome(await settleReward(store, draft));
}

/**
 * 끊긴 지급 재처리 — 화면 진입·탭 복귀·"다시 받기" 에서 부른다.
 * 서버 worker 가 없으므로 **재처리는 학생 client 가 한다**. 학생이 다시 오지
 * 않으면 그 항목은 pending 으로 남는다(교사 확인함 과제 X17 로 연결).
 */
export async function recoverDayRewards(
  roomCode: string,
  clientId: string,
  dayKey: string,
  quests: QuestDef[],
  state: DailyQuestState,
): Promise<SettleResult[]> {
  const drafts = pendingRewards(quests, state);
  if (drafts.length === 0) return [];
  const store = createQuestStore(roomCode, clientId, dayKey);
  return settleAll(store, drafts);
}

/** 특정 날짜의 퀘스트 상태 1회 읽기 (자정 이후 '어제 못 받은 보상' 확인용). */
export async function fetchDayQuests(
  roomCode: string,
  clientId: string,
  dayKey: string,
): Promise<DailyQuestState> {
  const db = getClientDb();
  const snap = await get(ref(db, basePath(roomCode, clientId, dayKey)));
  return (snap.val() as DailyQuestState | null) ?? {};
}

/** 지갑의 멱등 집합(진단용 — 총 지급액과 원장 합이 맞는지 확인). */
export async function fetchWalletRewardEvents(
  roomCode: string,
  clientId: string,
): Promise<WalletNode> {
  const db = getClientDb();
  const snap = await get(ref(db, walletPath(roomCode, clientId)));
  return (snap.val() as WalletNode | null) ?? {};
}

export type { RewardEntry } from "./rewardLedger";

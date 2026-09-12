// 🍯 보상 원장 (X04) — "한 번만" 과 "끝까지" 를 동시에 보장하기 위한 순수 상태 기계.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────
// 종전 구조는 `claimed/{questId} = true` 를 트랜잭션으로 **선점**한 뒤 별도
// 노드의 honey 를 더했다. 선점만 성공하고 지급이 실패하면 claimed 가 true 라서
// 다시 눌러도 "이미 받음" 으로 막히고, 꿀은 영영 들어오지 않는다 (lib/quests.ts
// 의 옛 주석도 "보상 유실 가능" 이라고 적고 있었다).
//
// ── 계약 ───────────────────────────────────────────────────────────────
// claim 을 불리언이 아니라 **원장 항목(RewardEntry)** 으로 기록한다:
//   { eventId, eventKey, learnerId, questId, dayKey, status, amount, xpAmount,
//     honey, xp, policyVersion, createdAt, updatedAt, attempts }
// 원장 항목은 안정적(=결정적)인 eventKey 로 식별되므로, 같은 보상에 대한 두
// client 의 동시 요청도 같은 한 항목을 가리킨다. 지급 단계(꿀/XP)는 각각
// **자기 쪽 applied 집합**으로 멱등화하고, 원장은 어디까지 끝났는지를 적는다.
//
//   1) reserve   — 원장 항목 선점(트랜잭션). 이미 있으면 그 항목을 그대로 쓴다.
//   2) applyHoney— 지갑 노드 트랜잭션. rewardEvents[eventKey] 가 있으면 abort.
//   3) applyXp   — 학습자 노드의 rewardEvents 가드 → awardXp.
//   4) persist   — 원장에 단계 완료 기록.
// 어느 단계에서 죽어도 재처리(settleReward 재호출)가 남은 단계만 이어서 한다.
//
// ── 이 파일의 경계 ─────────────────────────────────────────────────────
// Firebase 를 import 하지 않는다. 실제 I/O 는 RewardStore 어댑터(lib/quests.ts)
// 가 구현하고, 테스트는 실패를 주입하는 가짜 어댑터를 넣는다
// (scripts/test-reward-ledger.mjs). "exactly once" 라고 이름 붙이지 않는다 —
// 남은 한계는 아래 XP 주석과 보고서에 명시한다.

/** 지급량·대상이 바뀌면 올린다. eventKey 에 포함되므로 정책이 다르면 다른 사건이 된다. */
export const REWARD_POLICY_VERSION = 1;

/** 보너스(황금 이슬) 원장의 questId — 경로는 quests.ts 가 따로 잡는다. */
export const BONUS_QUEST_ID = "bonus";

export type StepStatus = "pending" | "applied" | "uncertain";
export type EntryStatus = "pending" | "applied";

export interface RewardEntry {
  /** 사람이 읽는 전역 식별자 (학습자 포함). 기록·로그용. */
  eventId: string;
  /** RTDB 키로 쓰는 학습자 범위 식별자. 경로가 이미 학습자별로 갈라져 있다. */
  eventKey: string;
  learnerId: string;
  questId: string;
  dayKey: string;
  status: EntryStatus;
  /** 🍯 지급량 */
  amount: number;
  /** 같은 지급 이벤트에 묶인 XP (퀘스트는 0, 보너스는 BONUS_XP) */
  xpAmount: number;
  honey: StepStatus;
  xp: StepStatus;
  policyVersion: number;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  lastError?: string;
  /** 옛 `true` 불리언에서 승격된 항목 — 지급 여부를 사후에 알 수 없다. */
  legacy?: true;
}

const KEY_UNSAFE_RE = /[.#$/[\]\s]/g;

function safeSegment(s: string): string {
  return String(s).replace(KEY_UNSAFE_RE, "_");
}

/**
 * 학습자 범위 안에서 이 보상 사건을 가리키는 안정 키.
 * (날짜 + 퀘스트 + 정책버전) 이 같으면 어느 탭·어느 기기에서 눌러도 같은 키다.
 */
export function makeEventKey(dayKey: string, questId: string, policyVersion = REWARD_POLICY_VERSION): string {
  return `${safeSegment(dayKey)}__${safeSegment(questId)}__v${policyVersion}`;
}

export function makeEventId(learnerId: string, eventKey: string): string {
  return `${learnerId}|${eventKey}`;
}

export interface CreateEntryInput {
  learnerId: string;
  questId: string;
  dayKey: string;
  amount: number;
  xpAmount?: number;
  policyVersion?: number;
  now: number;
}

export function createEntry(input: CreateEntryInput): RewardEntry {
  const policyVersion = input.policyVersion ?? REWARD_POLICY_VERSION;
  const eventKey = makeEventKey(input.dayKey, input.questId, policyVersion);
  const xpAmount = Math.max(0, Math.floor(input.xpAmount ?? 0));
  return {
    eventId: makeEventId(input.learnerId, eventKey),
    eventKey,
    learnerId: input.learnerId,
    questId: input.questId,
    dayKey: input.dayKey,
    status: "pending",
    amount: Math.max(0, Math.floor(input.amount)),
    xpAmount,
    honey: "pending",
    // XP 가 없는 보상은 XP 단계를 처음부터 끝난 것으로 본다 (영구 pending 방지).
    xp: xpAmount > 0 ? "pending" : "applied",
    policyVersion,
    createdAt: input.now,
    updatedAt: input.now,
    attempts: 0,
  };
}

function toStep(v: unknown, fallback: StepStatus): StepStatus {
  return v === "applied" || v === "pending" || v === "uncertain" ? v : fallback;
}

/**
 * 저장된 값 → 원장 항목.
 *
 * 옛 데이터 호환이 핵심이다. 기존 방에는 `claimed/{questId} = true` 와
 * `bonus = true` 가 이미 쌓여 있다. 그 값은 **이미 지급이 끝난 것으로 간주**한다
 * (당시엔 성공 경로가 압도적이었고, 사후에 지급 여부를 확인할 방법이 없다).
 * 재지급하지 않는 쪽이 안전하다 — 중복 지급이 미지급보다 되돌리기 어렵다.
 */
export function normalizeEntry(raw: unknown, ctx?: Partial<CreateEntryInput>): RewardEntry | null {
  if (raw === null || raw === undefined || raw === false) return null;
  if (raw === true) {
    const dayKey = ctx?.dayKey ?? "";
    const questId = ctx?.questId ?? "";
    const policyVersion = ctx?.policyVersion ?? REWARD_POLICY_VERSION;
    const eventKey = makeEventKey(dayKey, questId, policyVersion);
    const now = ctx?.now ?? 0;
    return {
      eventId: makeEventId(ctx?.learnerId ?? "", eventKey),
      eventKey,
      learnerId: ctx?.learnerId ?? "",
      questId,
      dayKey,
      status: "applied",
      amount: Math.max(0, Math.floor(ctx?.amount ?? 0)),
      xpAmount: Math.max(0, Math.floor(ctx?.xpAmount ?? 0)),
      honey: "applied",
      xp: "applied",
      policyVersion,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      legacy: true,
    };
  }
  if (typeof raw !== "object") return null;
  const r = raw as Partial<RewardEntry>;
  const dayKey = typeof r.dayKey === "string" ? r.dayKey : ctx?.dayKey ?? "";
  const questId = typeof r.questId === "string" ? r.questId : ctx?.questId ?? "";
  const policyVersion = Number.isFinite(r.policyVersion) ? Number(r.policyVersion) : ctx?.policyVersion ?? REWARD_POLICY_VERSION;
  const eventKey = typeof r.eventKey === "string" && r.eventKey ? r.eventKey : makeEventKey(dayKey, questId, policyVersion);
  const learnerId = typeof r.learnerId === "string" ? r.learnerId : ctx?.learnerId ?? "";
  const amount = Number.isFinite(r.amount) ? Math.max(0, Math.floor(Number(r.amount))) : Math.max(0, Math.floor(ctx?.amount ?? 0));
  const xpAmount = Number.isFinite(r.xpAmount) ? Math.max(0, Math.floor(Number(r.xpAmount))) : Math.max(0, Math.floor(ctx?.xpAmount ?? 0));
  const honey = toStep(r.honey, "pending");
  const xp = toStep(r.xp, xpAmount > 0 ? "pending" : "applied");
  const entry: RewardEntry = {
    eventId: typeof r.eventId === "string" && r.eventId ? r.eventId : makeEventId(learnerId, eventKey),
    eventKey,
    learnerId,
    questId,
    dayKey,
    status: r.status === "applied" ? "applied" : "pending",
    amount,
    xpAmount,
    honey,
    xp,
    policyVersion,
    createdAt: Number.isFinite(r.createdAt) ? Number(r.createdAt) : ctx?.now ?? 0,
    updatedAt: Number.isFinite(r.updatedAt) ? Number(r.updatedAt) : ctx?.now ?? 0,
    attempts: Number.isFinite(r.attempts) ? Number(r.attempts) : 0,
  };
  if (typeof r.lastError === "string") entry.lastError = r.lastError;
  if (r.legacy === true) entry.legacy = true;
  // 저장된 status 가 applied 여도 단계가 덜 끝났으면 pending 으로 되돌린다 —
  // 기록이 어긋난 항목을 재처리 대상에 다시 올리기 위한 안전장치.
  if (entry.status === "applied" && !stepsSettled(entry)) entry.status = "pending";
  return entry;
}

function stepsSettled(e: RewardEntry): boolean {
  const honeyDone = e.honey === "applied" || e.honey === "uncertain";
  const xpDone = e.xp === "applied" || e.xp === "uncertain";
  return honeyDone && xpDone;
}

export function isSettled(e: RewardEntry | null): boolean {
  return !!e && e.status === "applied";
}

/** 화면 표시용 상태. pending 은 "받는 중 / 다시 받기" 로 보여야 한다. */
export function claimView(raw: unknown, ctx?: Partial<CreateEntryInput>): "none" | "pending" | "applied" {
  const e = normalizeEntry(raw, ctx);
  if (!e) return "none";
  return e.status === "applied" ? "applied" : "pending";
}

/** 일부만 성공한 상태를 사람 말로. (교사 확인함·보고용) */
export function describeEntry(e: RewardEntry): string {
  if (e.status === "applied") {
    if (e.xp === "uncertain") return "지급됨 (XP 확인 필요)";
    return "지급 완료";
  }
  if (e.honey !== "applied") return "꿀 지급 대기";
  return "XP 지급 대기";
}

/** 트랜잭션 updater — 없을 때만 선점한다. 이미 있으면 abort(undefined). */
export function reserveUpdater(draft: RewardEntry): (cur: unknown) => RewardEntry | undefined {
  return (cur: unknown) => {
    if (cur !== null && cur !== undefined && cur !== false) return undefined; // abort — 기존 항목 유지
    return draft;
  };
}

// ── 지갑(꿀) 쪽 멱등 적용 ────────────────────────────────────────────────
// rooms/{room}/village/{learner} 노드 트랜잭션의 updater. 잔액과 applied 집합을
// **같은 노드**에 함께 쓰기 때문에 이 한 번의 트랜잭션이 원자적이다.
export interface WalletNode {
  honey?: number;
  rewardEvents?: Record<string, { amount: number; at: number }>;
  [k: string]: unknown;
}

export function walletApplyUpdater(
  eventKey: string,
  amount: number,
  now: number,
): (cur: WalletNode | null) => WalletNode | undefined {
  return (cur: WalletNode | null) => {
    if (cur && cur.rewardEvents && cur.rewardEvents[eventKey]) return undefined; // abort — 이미 반영
    const base = cur ?? {};
    return {
      ...base,
      honey: (typeof base.honey === "number" ? base.honey : 0) + amount,
      rewardEvents: { ...(base.rewardEvents ?? {}), [eventKey]: { amount, at: now } },
    };
  };
}

// ── 어댑터 경계 ──────────────────────────────────────────────────────────

/** 지급 단계의 결과. `already` 는 "다른 경로가 이미 반영함" (중복 금지). */
export type StepOutcome =
  | { state: "applied"; paid: number }
  | { state: "already" }
  | { state: "uncertain"; reason: string };

export interface RewardStore {
  now(): number;
  /** 원장 선점 트랜잭션. 기존 항목이 있으면 **그 항목**을 돌려준다. */
  reserve(draft: RewardEntry): Promise<RewardEntry>;
  /** 지갑 꿀 적용 (eventKey 멱등). */
  applyHoney(entry: RewardEntry): Promise<StepOutcome>;
  /** XP 적용 (eventKey 가드). xpAmount 0 이면 호출되지 않는다. */
  applyXp(entry: RewardEntry): Promise<StepOutcome>;
  /** 원장 갱신 (부분 필드). */
  persist(entry: RewardEntry): Promise<void>;
}

export type SettleOutcome = "settled" | "already" | "failed";

export interface SettleResult {
  entry: RewardEntry;
  outcome: SettleOutcome;
  honeyPaid: number;
  xpPaid: number;
  error?: string;
}

/**
 * 원장 한 항목을 끝까지 민다. 중간 어디서 실패해도 **다시 호출하면 이어서** 간다.
 *
 * 되돌리지 않는다(보상 회수 없음). 남은 단계만 다시 시도한다.
 */
export async function settleReward(store: RewardStore, draft: RewardEntry): Promise<SettleResult> {
  let entry: RewardEntry;
  try {
    entry = await store.reserve(draft);
  } catch (err) {
    return { entry: draft, outcome: "failed", honeyPaid: 0, xpPaid: 0, error: errText(err) };
  }

  if (entry.status === "applied") {
    return { entry, outcome: "already", honeyPaid: 0, xpPaid: 0 };
  }

  let honeyPaid = 0;
  let xpPaid = 0;

  try {
    if (entry.honey !== "applied" && entry.honey !== "uncertain") {
      const out = await store.applyHoney(entry);
      if (out.state === "applied") honeyPaid = out.paid;
      entry = {
        ...entry,
        honey: out.state === "uncertain" ? "uncertain" : "applied",
        updatedAt: store.now(),
      };
      await store.persist(entry);
    }

    if (entry.xp !== "applied" && entry.xp !== "uncertain") {
      const out = await store.applyXp(entry);
      if (out.state === "applied") xpPaid = out.paid;
      entry = {
        ...entry,
        xp: out.state === "uncertain" ? "uncertain" : "applied",
        updatedAt: store.now(),
      };
      await store.persist(entry);
    }

    if (stepsSettled(entry) && entry.status !== "applied") {
      entry = { ...entry, status: "applied", updatedAt: store.now() };
      delete entry.lastError;
      await store.persist(entry);
    }
    return { entry, outcome: "settled", honeyPaid, xpPaid };
  } catch (err) {
    const message = errText(err);
    const failed: RewardEntry = {
      ...entry,
      attempts: entry.attempts + 1,
      lastError: message,
      updatedAt: store.now(),
    };
    // 실패 기록 자체가 또 실패할 수 있다 — 그래도 다음 재처리가 원장을 다시 읽어
    // 이어가므로 기록 실패는 치명적이지 않다.
    try {
      await store.persist(failed);
    } catch {
      /* 무시 */
    }
    return { entry: failed, outcome: "failed", honeyPaid, xpPaid, error: message };
  }
}

/** 여러 항목 재처리 (자동 재시도 worker 의 본체). */
export async function settleAll(store: RewardStore, drafts: RewardEntry[]): Promise<SettleResult[]> {
  const out: SettleResult[] = [];
  for (const d of drafts) out.push(await settleReward(store, d));
  return out;
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** 원장 스냅샷에서 아직 안 끝난 항목만. (재처리 대상) */
export function pendingEntries(entries: Array<RewardEntry | null>): RewardEntry[] {
  return entries.filter((e): e is RewardEntry => !!e && e.status !== "applied");
}

/** 불변식 검사용 — 적용된 꿀의 합. 테스트와 교사 점검이 같은 식을 쓴다. */
export function appliedHoneyTotal(entries: Array<RewardEntry | null>): number {
  let sum = 0;
  for (const e of entries) if (e && e.honey === "applied") sum += e.amount;
  return sum;
}

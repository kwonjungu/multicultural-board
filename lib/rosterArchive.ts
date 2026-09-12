/**
 * X02 — 명렬표 보관·복원. 순수 로직 + 얇은 IO 어댑터.
 *
 * 지금 무엇이 문제인가
 * ─────────────────────────────────────────────────────────────────────────
 * RoomManagePanel.saveRoster 는 명렬표에서 빠진 이름의
 *   rooms/{r}/stickers/individual/{name}, stickers/cosmetics/{name}, gallery/{name}
 * 를 곧바로 update(ref, {path: null}) 로 **삭제**한다. 오탈자를 고치려고 이름을
 * 다시 쓴 것만으로도 아이의 칭찬 기록이 사라진다. 되돌릴 방법도 없다.
 *
 * 이 모듈의 규칙
 * ─────────────────────────────────────────────────────────────────────────
 *  1. **기본 제거 = 보관.** rosterStatus 를 archived 로 바꿀 뿐 기록 경로는
 *     건드리지 않는다. 그래서 복원하면 내용·개수·hash 가 그대로다.
 *  2. **삭제는 별도 경로.** purge 는 명시적으로 이름을 다시 입력해야 하는
 *     후속 동작이고, applyRosterOps 는 purge 가 없으면 deletePaths 를 절대
 *     만들지 않는다(끝에서 불변식을 검사해 던진다).
 *  3. **자동 병합 금지.** 일괄 붙여넣기에서 이름 변경을 추측하지 않는다.
 *     사라진 이름은 보관, 새 이름은 신규 학습자다. 같은 사람이면 교사가
 *     '이름 고치기' 로 명시한다.
 *
 * React·Firebase 를 import 하지 않는다(순수). 실제 IO 는 RosterIo 로 주입한다 —
 * scripts/test-roster-archive.mjs 가 삭제 어댑터에 spy 를 걸 수 있는 이유다.
 */

import {
  LEARNER_DOMAINS,
  createLearnerProfile,
  renameLearner,
  setLearnerMark,
  domainPrefix,
  learnerKey,
  buildLegacyClaims,
  resolveLearnerScope,
  contentHash,
  recordCount,
  activeDisplayNames,
  DOMAIN_LABEL_KO,
  type LearnerDomain,
  type LearnerProfile,
  type LearnerScope,
  type UuidFn,
} from "./learnerId";

/* ────────────────────────────────────────────────────────────────────────
 * 편집 연산
 * ──────────────────────────────────────────────────────────────────────── */

export type RosterOp =
  /** 새 학습자. 같은 이름이 이미 있어도 별도 learnerId 로 만든다(동명이인). */
  | { kind: "add"; displayName: string; markId?: string }
  /** 이름만 고친다. 기록은 움직이지 않는다. */
  | { kind: "rename"; learnerId: string; displayName: string }
  | { kind: "setMark"; learnerId: string; markId?: string }
  /** 이번 명렬표에서 내린다. 기록은 그대로 남는다. */
  | { kind: "archive"; learnerId: string }
  | { kind: "restore"; learnerId: string }
  /**
   * 기록 완전 삭제. 기본 편집 흐름에 묶지 않는다 —
   * confirmName 이 현재 displayName 과 정확히 같아야 한다.
   */
  | { kind: "purge"; learnerId: string; confirmName: string };

export interface RosterApplyContext {
  roomCode: string;
  now: number;
  uuid?: UuidFn;
  /**
   * 삭제까지 허용할지. 기본 false — UI 의 일반 저장 경로는 이 값을 켜지 않는다.
   * purge op 이 있는데 false 면 그 op 은 거부되고 warnings 에 남는다.
   */
  allowPurge?: boolean;
}

export interface RosterApplyResult {
  profiles: LearnerProfile[];
  /** config/learners 에 쓸 값. null 이면 프로필 자체 제거(purge 뿐). */
  learnerWrites: Record<string, LearnerProfile | null>;
  /** config/roster 에 쓸 파생 목록(활성 학습자의 표시 이름). */
  rosterNames: string[];
  /** 기록 삭제 경로. purge 가 없으면 반드시 빈 배열이다. */
  deletePaths: string[];
  warnings: string[];
}

/**
 * 편집 연산을 순수하게 적용한다. IO 없음.
 * 끝에서 "purge 없으면 삭제 경로 0" 불변식을 검사한다 — 이 파일을 잘못 고쳐
 * 삭제가 기본 흐름으로 새어 들어오면 여기서 즉시 터진다.
 */
export function applyRosterOps(
  current: ReadonlyArray<LearnerProfile>,
  ops: ReadonlyArray<RosterOp>,
  ctx: RosterApplyContext,
): RosterApplyResult {
  const list: LearnerProfile[] = current.map((p) => ({ ...p }));
  const byId = new Map(list.map((p) => [p.learnerId, p]));
  const writes: Record<string, LearnerProfile | null> = {};
  const deletePaths: string[] = [];
  const warnings: string[] = [];
  let purgeRequested = false;

  const replace = (next: LearnerProfile) => {
    const idx = list.findIndex((p) => p.learnerId === next.learnerId);
    if (idx >= 0) list[idx] = next;
    byId.set(next.learnerId, next);
    writes[next.learnerId] = next;
  };

  for (const op of ops) {
    if (op.kind === "add") {
      const name = op.displayName.trim();
      if (!name) { warnings.push("빈 이름은 추가하지 않았어요."); continue; }
      const profile = createLearnerProfile(name, ctx.now, ctx.uuid, op.markId);
      list.push(profile);
      byId.set(profile.learnerId, profile);
      writes[profile.learnerId] = profile;
      continue;
    }

    const target = byId.get(op.learnerId);
    if (!target) { warnings.push(`이미 없는 학생이라 건너뛰었어요 (${op.learnerId}).`); continue; }

    switch (op.kind) {
      case "rename": {
        const name = op.displayName.trim();
        if (!name) { warnings.push(`${target.displayName}: 빈 이름으로는 바꿀 수 없어요.`); break; }
        if (name === target.displayName) break;
        replace(renameLearner(target, name, ctx.now));
        break;
      }
      case "setMark":
        replace(setLearnerMark(target, op.markId, ctx.now));
        break;
      case "archive":
        if (target.rosterStatus === "archived") break;
        replace({ ...target, rosterStatus: "archived", archivedAt: ctx.now, updatedAt: ctx.now });
        break;
      case "restore": {
        if (target.rosterStatus === "active") break;
        const next: LearnerProfile = { ...target, rosterStatus: "active", updatedAt: ctx.now };
        delete next.archivedAt;
        replace(next);
        break;
      }
      case "purge": {
        if (!ctx.allowPurge) {
          warnings.push(`${target.displayName}: 완전 삭제는 별도 확인 화면에서만 할 수 있어요.`);
          break;
        }
        if (op.confirmName !== target.displayName) {
          warnings.push(`${target.displayName}: 이름이 정확히 일치하지 않아 삭제하지 않았어요.`);
          break;
        }
        purgeRequested = true;
        for (const path of purgePathsFor(ctx.roomCode, target)) deletePaths.push(path);
        const idx = list.findIndex((p) => p.learnerId === target.learnerId);
        if (idx >= 0) list.splice(idx, 1);
        byId.delete(target.learnerId);
        writes[target.learnerId] = null;
        break;
      }
    }
  }

  if (!purgeRequested && deletePaths.length > 0) {
    // 도달하면 이 파일의 버그다. 조용히 지우느니 저장을 실패시킨다.
    throw new Error("applyRosterOps: purge 없이 삭제 경로가 생성됐다 — 저장을 중단한다");
  }

  return { profiles: list, learnerWrites: writes, rosterNames: activeDisplayNames(list), deletePaths, warnings };
}

/**
 * 완전 삭제 대상 경로. learnerId 경로만 만든다 —
 * 옛 이름 경로는 다른 학생과 공유됐을 수 있어 자동으로 지우지 않는다.
 */
export function purgePathsFor(roomCode: string, profile: LearnerProfile): string[] {
  return LEARNER_DOMAINS.map((d) => `${domainPrefix(roomCode, d)}/${learnerKey(profile.learnerId)}`);
}

/* ────────────────────────────────────────────────────────────────────────
 * 일괄 붙여넣기(textarea) → 연산 초안
 * ──────────────────────────────────────────────────────────────────────── */

export interface RosterTextPlan {
  ops: RosterOp[];
  /** 목록에서 사라진 학습자 = 보관 예정. 삭제 아님. */
  toArchive: LearnerProfile[];
  /** 새로 생긴 이름 = 신규 학습자. 기존 학생의 개명으로 추측하지 않는다. */
  toAdd: string[];
  kept: LearnerProfile[];
  /** 보관 중이던 사람의 이름이 다시 등장 — 신규 추가 대신 복원을 권한다. */
  restorable: LearnerProfile[];
  notes: string[];
}

/**
 * 붙여넣은 이름 목록과 현재 프로필을 비교해 연산 초안을 만든다.
 * 제거는 전부 archive 다. rename 은 만들지 않는다(자동 병합 금지).
 */
export function planRosterText(
  current: ReadonlyArray<LearnerProfile>,
  text: string,
): RosterTextPlan {
  const names = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const active = current.filter((p) => p.rosterStatus === "active");
  const archived = current.filter((p) => p.rosterStatus === "archived");
  const notes: string[] = [];

  // 같은 이름이 목록에 여러 번 나오면 그 수만큼 사람이 있는 것으로 본다.
  const wanted = new Map<string, number>();
  for (const n of names) wanted.set(n, (wanted.get(n) ?? 0) + 1);

  const kept: LearnerProfile[] = [];
  const toArchive: LearnerProfile[] = [];
  const remaining = new Map(wanted);
  for (const p of active) {
    const left = remaining.get(p.displayName) ?? 0;
    if (left > 0) { remaining.set(p.displayName, left - 1); kept.push(p); }
    else toArchive.push(p);
  }

  const toAdd: string[] = [];
  const restorable: LearnerProfile[] = [];
  const archivedByName = new Map<string, LearnerProfile[]>();
  for (const p of archived) {
    const l = archivedByName.get(p.displayName) ?? [];
    l.push(p);
    archivedByName.set(p.displayName, l);
  }
  for (const [name, count] of Array.from(remaining.entries())) {
    for (let i = 0; i < count; i++) {
      const pool = archivedByName.get(name);
      const revived = pool && pool.length > 0 ? pool.shift() : undefined;
      if (revived) restorable.push(revived);
      else toAdd.push(name);
    }
  }

  const ops: RosterOp[] = [
    ...toArchive.map((p) => ({ kind: "archive" as const, learnerId: p.learnerId })),
    ...restorable.map((p) => ({ kind: "restore" as const, learnerId: p.learnerId })),
    ...toAdd.map((displayName) => ({ kind: "add" as const, displayName })),
  ];

  if (toArchive.length > 0 && toAdd.length > 0) {
    notes.push(
      "이름을 고치려던 것이라면 저장하지 말고 목록에서 '이름 고치기' 를 쓰세요. " +
      "일괄 저장은 사라진 이름을 보관하고 새 이름을 새 학생으로 만듭니다.",
    );
  }
  for (const [name, count] of Array.from(wanted.entries())) {
    if (count > 1) notes.push(`'${name}' 이(가) ${count}번 있어요 — 동명이인 ${count}명으로 처리합니다.`);
  }

  return { ops, toArchive, toAdd, kept, restorable, notes };
}

/* ────────────────────────────────────────────────────────────────────────
 * 영향 범위 / 지문
 * ──────────────────────────────────────────────────────────────────────── */

/** 한 학습자의 도메인별 노드 값. null = 기록 없음. */
export type LearnerSnapshot = Partial<Record<LearnerDomain, unknown>>;

export interface DomainImpact {
  domain: LearnerDomain;
  labelKo: string;
  count: number;
  /** 어디서 읽었는지 — 옛 이름 경로면 이관 대상이라는 뜻이다. */
  source: LearnerScope["source"];
  path: string;
}

export interface LearnerImpact {
  learnerId: string;
  displayName: string;
  domains: DomainImpact[];
  total: number;
  /** 내용 지문. 보관 전/후 비교의 근거. */
  hash: string;
  /** 교사 해결이 필요한 옛 이름 충돌(동명이인). */
  conflicts: { domain: LearnerDomain; legacyKey: string; claimedBy: string[] }[];
}

/** 스냅샷 → 개수/해시. 순수. */
export function fingerprint(snapshot: LearnerSnapshot): { counts: Record<string, number>; total: number; hash: string } {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const d of LEARNER_DOMAINS) {
    const n = recordCount(snapshot[d] ?? null);
    counts[d] = n;
    total += n;
  }
  return { counts, total, hash: contentHash(normalizeSnapshot(snapshot)) };
}

/** 도메인 키를 고정 순서로 정렬하고 빈 도메인을 null 로 채운 형태. */
export function normalizeSnapshot(snapshot: LearnerSnapshot): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const d of LEARNER_DOMAINS) out[d] = snapshot[d] ?? null;
  return out;
}

export interface RestoreCheck {
  ok: boolean;
  mismatches: string[];
  before: ReturnType<typeof fingerprint>;
  after: ReturnType<typeof fingerprint>;
}

/** 보관 전 스냅샷과 복원 후 스냅샷이 같은지. 개수·내용·해시 셋 다 본다. */
export function verifyRestore(before: LearnerSnapshot, after: LearnerSnapshot): RestoreCheck {
  const b = fingerprint(before);
  const a = fingerprint(after);
  const mismatches: string[] = [];
  for (const d of LEARNER_DOMAINS) {
    if (b.counts[d] !== a.counts[d]) mismatches.push(`${d}: 개수 ${b.counts[d]} → ${a.counts[d]}`);
  }
  if (b.hash !== a.hash) mismatches.push(`내용 hash ${b.hash} → ${a.hash}`);
  if (b.total !== a.total) mismatches.push(`합계 ${b.total} → ${a.total}`);
  return { ok: mismatches.length === 0, mismatches, before: b, after: a };
}

/** '스티커 3개 · 녹음 2개' 같은 한 줄 요약. 0 인 도메인은 숨긴다. */
export function describeImpactKo(impact: LearnerImpact): string {
  const parts = impact.domains.filter((d) => d.count > 0).map((d) => `${d.labelKo} ${d.count}개`);
  return parts.length > 0 ? parts.join(" · ") : "남은 기록 없음";
}

/* ────────────────────────────────────────────────────────────────────────
 * 얇은 IO 어댑터
 * ──────────────────────────────────────────────────────────────────────── */

export interface RosterIo {
  /** 노드 하나 읽기. 없으면 null. */
  readNode(path: string): Promise<unknown>;
  /**
   * config/learners 와 config/roster 를 **한 번의** multi-path update 로 쓴다.
   * 두 번 나눠 쓰면 중간에 실패했을 때 명렬표와 프로필이 어긋난다.
   */
  commitRoster(input: {
    learners: Record<string, LearnerProfile | null>;
    rosterNames: string[];
  }): Promise<void>;
  /** 기록 완전 삭제. purge 경로에서만 호출된다. */
  deleteNodes(paths: string[]): Promise<void>;
}

export interface RosterService {
  apply(current: ReadonlyArray<LearnerProfile>, ops: ReadonlyArray<RosterOp>, opts?: { allowPurge?: boolean }): Promise<RosterApplyResult>;
  loadSnapshot(profiles: ReadonlyArray<LearnerProfile>, learnerId: string): Promise<{ snapshot: LearnerSnapshot; scopes: LearnerScope[] }>;
  loadImpact(profiles: ReadonlyArray<LearnerProfile>, learnerId: string): Promise<LearnerImpact>;
  loadImpacts(profiles: ReadonlyArray<LearnerProfile>, learnerIds: ReadonlyArray<string>): Promise<LearnerImpact[]>;
}

/**
 * 순수 로직과 IO 를 잇는 얇은 층. 여기서 정책 판단을 하지 않는다.
 * apply 는 purge 가 없으면 io.deleteNodes 를 **호출하지 않는다**.
 */
export function createRosterService(
  roomCode: string,
  io: RosterIo,
  opts: { now?: () => number; uuid?: UuidFn } = {},
): RosterService {
  const now = opts.now ?? (() => Date.now());

  async function readIfPresent(path: string): Promise<unknown> {
    const v = await io.readNode(path);
    return v ?? null;
  }

  async function loadSnapshot(profiles: ReadonlyArray<LearnerProfile>, learnerId: string) {
    const profile = profiles.find((p) => p.learnerId === learnerId);
    if (!profile) throw new Error(`알 수 없는 learnerId: ${learnerId}`);
    const claims = buildLegacyClaims(profiles);
    const snapshot: LearnerSnapshot = {};
    const scopes: LearnerScope[] = [];

    for (const domain of LEARNER_DOMAINS) {
      // 읽기 전환 어댑터를 그대로 쓴다: 새 경로 → 옛 이름 경로 순.
      // 경로마다 한 번씩만 읽고 그 결과를 hasRecord 로 되먹인다.
      const cache = new Map<string, unknown>();
      const probe = async (path: string) => {
        if (!cache.has(path)) cache.set(path, await readIfPresent(path));
        return cache.get(path) ?? null;
      };
      const prefix = domainPrefix(roomCode, domain);
      await probe(`${prefix}/${learnerKey(profile.learnerId)}`);
      for (const cand of Array.from(claims.keys())) {
        // 이 학습자가 주장하는 키만 확인한다.
        if (!(claims.get(cand) ?? []).includes(profile.learnerId)) continue;
        await probe(`${prefix}/${cand}`);
      }
      const scope = resolveLearnerScope(
        roomCode, domain, profile,
        (p) => (cache.get(p) ?? null) !== null,
        { claims },
      );
      scopes.push(scope);
      snapshot[domain] = scope.source === "ambiguous" ? null : ((cache.get(scope.readPath) ?? null) as unknown);
    }
    return { snapshot, scopes };
  }

  async function loadImpact(profiles: ReadonlyArray<LearnerProfile>, learnerId: string): Promise<LearnerImpact> {
    const profile = profiles.find((p) => p.learnerId === learnerId);
    if (!profile) throw new Error(`알 수 없는 learnerId: ${learnerId}`);
    const { snapshot, scopes } = await loadSnapshot(profiles, learnerId);
    const fp = fingerprint(snapshot);
    const domains: DomainImpact[] = scopes.map((s) => ({
      domain: s.domain,
      labelKo: DOMAIN_LABEL_KO[s.domain],
      count: fp.counts[s.domain] ?? 0,
      source: s.source,
      path: s.readPath,
    }));
    const conflicts = scopes
      .filter((s) => s.conflict)
      .map((s) => ({ domain: s.domain, legacyKey: s.conflict!.legacyKey, claimedBy: s.conflict!.claimedBy }));
    return { learnerId, displayName: profile.displayName, domains, total: fp.total, hash: fp.hash, conflicts };
  }

  return {
    async apply(current, ops, applyOpts = {}) {
      const result = applyRosterOps(current, ops, {
        roomCode, now: now(), uuid: opts.uuid, allowPurge: applyOpts.allowPurge === true,
      });
      await io.commitRoster({ learners: result.learnerWrites, rosterNames: result.rosterNames });
      // 삭제 어댑터는 실제 삭제 경로가 있을 때만 부른다.
      // 보관/복원/이름 고치기에서는 이 줄에 도달해도 배열이 비어 호출되지 않는다.
      if (result.deletePaths.length > 0) await io.deleteNodes(result.deletePaths);
      return result;
    },
    loadSnapshot,
    loadImpact,
    async loadImpacts(profiles, learnerIds) {
      const out: LearnerImpact[] = [];
      for (const id of learnerIds) out.push(await loadImpact(profiles, id));
      return out;
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * 기존 config.roster(문자열 배열) 에서의 1회 승격
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * config/learners 가 아직 없는 방에서 기존 이름 목록을 프로필로 올린다.
 * 이름은 그대로 두고 learnerId 만 새로 부여한다 — 기록은 옮기지 않는다.
 * 같은 이름이 두 번 있으면 서로 다른 learnerId 를 받고(동명이인),
 * 둘의 옛 기록은 섞여 있으므로 읽기 해석이 ambiguous 로 표시한다.
 */
export function promoteNamesToProfiles(
  names: ReadonlyArray<string>,
  now: number,
  uuid?: UuidFn,
): LearnerProfile[] {
  const out: LearnerProfile[] = [];
  for (const raw of names) {
    const name = (raw ?? "").trim();
    if (!name) continue;
    out.push(createLearnerProfile(name, now, uuid));
  }
  return out;
}

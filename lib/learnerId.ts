/**
 * X01 — 안정된 학습자 ID (LearnerProfile) 계약과 순수 해석 함수.
 *
 * 왜 필요한가
 * ─────────────────────────────────────────────────────────────────────────
 * 지금 학생 기록은 전부 **표시 이름**을 키로 쓴다 (VocabHub 가 user.myName 을
 * clientId 자리에 그대로 넘기고, lib/vocabProgress·vocabRecordings·vocabAttempts·
 * stickers·lms 가 그 값으로 경로를 만든다). 그래서
 *   - 이름 오탈자를 고치면 기록이 통째로 사라진 것처럼 보이고,
 *   - 동명이인 두 명은 같은 경로를 공유해 기록이 섞인다.
 *
 * 이 파일은 "이름은 표시값, 기록은 learnerId" 계약을 정의한다. React·Firebase 를
 * import 하지 않는 **순수 모듈**이라 scripts/test-learner-id.mjs 가 TypeScript 를
 * 런타임 transpile 해 그대로 실행할 수 있다 (scripts/test-word-memory.mjs 와 같은 방식).
 *
 * 이 모듈이 하지 않는 일
 * ─────────────────────────────────────────────────────────────────────────
 *  - 실제 DB 읽기/쓰기/삭제. 경로 문자열과 판단만 돌려준다.
 *  - 기존 이름 경로의 이동·삭제. 이관 실행은 별도 승인 단계다.
 *  - 동명이인 자동 병합. 모호한 매핑은 교사 해결 대상으로 남긴다.
 */

/** 계약 버전. 필드를 늘리면 올리고, 읽는 쪽은 모르는 버전을 만나면 쓰기를 멈춘다. */
export const LEARNER_PROFILE_VERSION = 1;

/** 명렬표에 있음(active) / 이번 명렬표에서 내렸지만 기록은 보존(archived). */
export type RosterStatus = "active" | "archived";

export interface LearnerProfile {
  /** 불변. 이름이 바뀌어도, 기기가 바뀌어도 이 값은 그대로다. */
  learnerId: string;
  /** 표시값. 언제든 고칠 수 있고 기록 위치에 영향을 주지 않는다. */
  displayName: string;
  rosterStatus: RosterStatus;
  createdAt: number;
  updatedAt: number;
  version: number;
  /**
   * 아이가 목록에서 자기를 찾을 보조 표식(그림/기호) id.
   * 국적·피부색·국기로 사람을 구분하지 않는다 — LEARNER_MARKS 참조.
   */
  markId?: string;
  /**
   * U05 — 아이가 고른 내 동물(lib/animals.ts 의 AnimalId allowlist).
   *
   * clientId 가 아니라 여기(learnerId 아래)에 두는 이유: clientId 는 브라우저
   * 단위라 공용 태블릿을 A→B→A 가 돌려 쓰면 선택이 섞인다. 이름·기기가 바뀌어도
   * 따라가야 하는 값이므로 프로필이 권위다.
   *
   * 없으면 고르지 않은 것이고, 화면은 room+안정 식별자로 정해지는 결정적
   * 폴백 동물을 보여준다(렌더마다 random 아님).
   */
  avatarAnimalId?: string;
  /**
   * 이 학습자의 기록이 과거에 쓰던 이름 후보. 최근 이름이 앞에 온다.
   * 이름을 고칠 때마다 이전 이름을 앞에 넣는다. 이관 전 읽기 폴백에만 쓰고,
   * 쓰기 경로를 따로 만드는 데는 쓰지 않는다.
   */
  legacyNameKeys?: string[];
  /** 보관 시각(보관 중일 때만). 복원하면 지운다. */
  archivedAt?: number;
}

/**
 * 아이가 자기를 구별할 보조 표식.
 *
 * 사물·도형·자연물만 둔다. 국기·인물·피부색·민족 상징은 넣지 않는다 —
 * 아이를 출신으로 분류하는 표식이 되면 안 된다(설계서 §4).
 */
export const LEARNER_MARKS: ReadonlyArray<{ id: string; glyph: string; ko: string }> = [
  { id: "star", glyph: "★", ko: "별" },
  { id: "moon", glyph: "☾", ko: "달" },
  { id: "leaf", glyph: "🍃", ko: "잎" },
  { id: "apple", glyph: "🍎", ko: "사과" },
  { id: "drop", glyph: "💧", ko: "물방울" },
  { id: "flower", glyph: "🌼", ko: "꽃" },
  { id: "snow", glyph: "❄", ko: "눈송이" },
  { id: "note", glyph: "♪", ko: "음표" },
  { id: "ball", glyph: "⚽", ko: "공" },
  { id: "book", glyph: "📕", ko: "책" },
  { id: "pencil", glyph: "✏", ko: "연필" },
  { id: "cloud", glyph: "☁", ko: "구름" },
];

export function markGlyph(markId: string | undefined): string {
  if (!markId) return "";
  return LEARNER_MARKS.find((m) => m.id === markId)?.glyph ?? "";
}

export function markLabel(markId: string | undefined): string {
  if (!markId) return "";
  return LEARNER_MARKS.find((m) => m.id === markId)?.ko ?? "";
}

/* ────────────────────────────────────────────────────────────────────────
 * 경로
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * 한 학습자에게 귀속되는 저장 영역. 값은 기존 코드의 경로와 1:1 로 맞춘다.
 * 새 도메인을 추가하면 domainPrefix 와 migrate 스크립트 inventory 가 함께 늘어난다.
 */
export type LearnerDomain =
  | "vocabProgress"
  | "vocabRecordings"
  | "vocabAttempts"
  | "vocabRewards"
  | "lms"
  | "stickers"
  | "cosmetics"
  | "gallery"
  | "emotions"
  | "expressions";

export const LEARNER_DOMAINS: ReadonlyArray<LearnerDomain> = [
  "vocabProgress", "vocabRecordings", "vocabAttempts", "vocabRewards",
  "lms", "stickers", "cosmetics", "gallery", "emotions", "expressions",
];

/** 아이에게 보여줄 도메인 이름. 영향 범위 안내문에 쓴다. */
export const DOMAIN_LABEL_KO: Record<LearnerDomain, string> = {
  vocabProgress: "단어 기록",
  vocabRecordings: "녹음",
  vocabAttempts: "퀴즈 기록",
  vocabRewards: "단어 보상",
  lms: "학습 상태",
  stickers: "칭찬 스티커",
  cosmetics: "꾸미기",
  gallery: "전시장",
  emotions: "감정 기록",
  expressions: "표현 복습",
};

/** 학습자 키 바로 위까지의 경로. 기존 lib/*.ts 의 경로 조립부와 같아야 한다. */
export function domainPrefix(roomCode: string, domain: LearnerDomain): string {
  switch (domain) {
    case "vocabProgress":   return `rooms/${roomCode}/vocab/progress`;
    case "vocabRecordings": return `rooms/${roomCode}/vocab/recordings`;
    case "vocabAttempts":   return `rooms/${roomCode}/vocab/attempts`;
    case "vocabRewards":    return `rooms/${roomCode}/vocab/rewards`;
    case "lms":             return `rooms/${roomCode}/lms`;
    case "stickers":        return `rooms/${roomCode}/stickers/individual`;
    case "cosmetics":       return `rooms/${roomCode}/stickers/cosmetics`;
    case "gallery":         return `rooms/${roomCode}/gallery`;
    case "emotions":        return `rooms/${roomCode}/emotions`;
    case "expressions":     return `rooms/${roomCode}/expressions`;
  }
}

/**
 * 기존 이름 키 인코딩. **바꾸지 말 것** — 이미 저장된 경로와 글자 하나라도
 * 달라지면 옛 기록을 못 찾는다. lib/vocabProgress.ts·vocabRecordings.ts 의
 * encodeKey 와 동일하다.
 */
export function encodeLegacyKey(name: string): string {
  return name.replace(/[.$#/[\]]/g, "_");
}

/** learnerId 경로 키. 이름과 절대 충돌하지 않도록 접두사를 붙인다. */
export const LEARNER_KEY_PREFIX = "lid_";

export function learnerKey(learnerId: string): string {
  return `${LEARNER_KEY_PREFIX}${learnerId}`;
}

export function isLearnerKey(key: string): boolean {
  return key.startsWith(LEARNER_KEY_PREFIX);
}

/**
 * 학습자 키가 아닌, 같은 레벨에 사는 운영 키. inventory 에서 제외한다.
 * 예: rooms/{r}/emotions/_lastAward.
 */
export function isReservedKey(key: string): boolean {
  return key.startsWith("_");
}

/* ────────────────────────────────────────────────────────────────────────
 * 읽기 전환 어댑터
 * ──────────────────────────────────────────────────────────────────────── */

/** 해석에 필요한 최소 식별 정보. LearnerProfile 을 그대로 넘겨도 구조적으로 맞는다. */
export interface LearnerRef {
  learnerId: string;
  displayName: string;
  legacyNameKeys?: string[];
}

/**
 * 어떤 경로가 "기록 있음" 인지 알려주는 순수 판정자.
 * 호출부가 Firebase get/구독 캐시로 채워 넣는다. 이 모듈은 IO 를 하지 않는다.
 */
export type HasRecord = (path: string) => boolean;

export type ScopeSource =
  /** 새 learnerId 경로에 기록이 있다 = 이관 완료. 읽기·쓰기 모두 여기. */
  | "learner"
  /** 아직 이관 전. 옛 이름 경로가 권위 경로다. */
  | "legacy"
  /** 양쪽 다 비었다(신규 학생). 새 경로에서 시작한다. */
  | "empty"
  /** 옛 이름 경로를 두 명 이상이 주장한다 — 자동으로 가를 수 없다. */
  | "ambiguous";

export interface LearnerScope {
  domain: LearnerDomain;
  /** 읽을 경로. */
  readPath: string;
  /**
   * 쓸 경로. **항상 readPath 와 같다.**
   * 전환기에 두 경로로 독립적으로 쓰면 기록이 갈라진다(설계서 §4).
   * 경로가 바뀌는 순간은 이관이 그 도메인 하위 트리를 통째로 복사한 그 한 번뿐이다.
   */
  writePath: string;
  source: ScopeSource;
  /** 아직 옛 경로를 쓰고 있다 = 이관 대상. */
  pendingMigration: boolean;
  /**
   * 교사가 풀어야 하는 충돌. source === "ambiguous" 일 때만 채워진다.
   * 그 사이 쓰기는 깨끗한 learnerId 경로로 가고 옛 경로는 건드리지 않는다.
   */
  conflict?: { legacyKey: string; claimedBy: string[] };
}

export interface ResolveOptions {
  /**
   * 같은 옛 이름 키를 주장하는 learnerId 목록. 동명이인 판정에 쓴다.
   * buildLegacyClaims() 로 만든다.
   */
  claims?: ReadonlyMap<string, string[]>;
}

/**
 * 한 학습자 × 한 도메인의 권위 경로를 정한다.
 *
 * 규칙(순서 그대로):
 *  1. learnerId 경로에 기록이 있으면 그게 권위 경로다.
 *  2. 없으면 옛 이름 키(최근 이름부터)를 훑어 기록이 있는 첫 경로를 쓴다.
 *     단, 그 키를 두 명 이상이 주장하면 쓰지 않는다 — 섞인 기록을 자동으로
 *     한 명에게 줘 버리는 것이 가장 되돌리기 어려운 사고다.
 *  3. 둘 다 없으면 learnerId 경로(빈 상태)에서 시작한다.
 *
 * 반환값의 readPath 와 writePath 는 항상 같다. 호출부가 따로 쓰기 경로를
 * 만들지 못하게 하려고 일부러 한 값을 두 이름으로 준다.
 */
export function resolveLearnerScope(
  roomCode: string,
  domain: LearnerDomain,
  ref: LearnerRef,
  hasRecord: HasRecord,
  opts: ResolveOptions = {},
): LearnerScope {
  const prefix = domainPrefix(roomCode, domain);
  const newPath = `${prefix}/${learnerKey(ref.learnerId)}`;

  if (hasRecord(newPath)) {
    return { domain, readPath: newPath, writePath: newPath, source: "learner", pendingMigration: false };
  }

  for (const key of legacyKeyCandidates(ref)) {
    const path = `${prefix}/${key}`;
    if (!hasRecord(path)) continue;
    const claimedBy = opts.claims?.get(key) ?? [];
    if (claimedBy.length > 1) {
      return {
        domain,
        readPath: newPath,
        writePath: newPath,
        source: "ambiguous",
        pendingMigration: false,
        conflict: { legacyKey: key, claimedBy: [...claimedBy].sort() },
      };
    }
    return { domain, readPath: path, writePath: path, source: "legacy", pendingMigration: true };
  }

  return { domain, readPath: newPath, writePath: newPath, source: "empty", pendingMigration: false };
}

/** 최근 이름 → 과거 이름 순서의 옛 키 후보(중복 제거). */
export function legacyKeyCandidates(ref: LearnerRef): string[] {
  const raw = [ref.displayName, ...(ref.legacyNameKeys ?? [])];
  const out: string[] = [];
  for (const name of raw) {
    const key = encodeLegacyKey((name ?? "").trim());
    if (!key || isLearnerKey(key) || isReservedKey(key)) continue;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/**
 * 옛 이름 키 → 그 키를 주장하는 learnerId 들.
 * 두 명 이상이면 동명이인(또는 encodeKey 충돌)이고, 자동 병합 금지 대상이다.
 */
export function buildLegacyClaims(profiles: ReadonlyArray<LearnerRef>): Map<string, string[]> {
  const claims = new Map<string, string[]>();
  for (const p of profiles) {
    for (const key of legacyKeyCandidates(p)) {
      const list = claims.get(key) ?? [];
      if (!list.includes(p.learnerId)) list.push(p.learnerId);
      claims.set(key, list);
    }
  }
  Array.from(claims.values()).forEach((list) => list.sort());
  return claims;
}

/** 전 도메인 해석. 도메인마다 이관 시점이 다를 수 있으므로 개별로 판단한다. */
export function resolveAllScopes(
  roomCode: string,
  ref: LearnerRef,
  hasRecord: HasRecord,
  opts: ResolveOptions = {},
): Record<LearnerDomain, LearnerScope> {
  const out = {} as Record<LearnerDomain, LearnerScope>;
  for (const d of LEARNER_DOMAINS) out[d] = resolveLearnerScope(roomCode, d, ref, hasRecord, opts);
  return out;
}

/* ────────────────────────────────────────────────────────────────────────
 * 프로필 생성·수정 (순수)
 * ──────────────────────────────────────────────────────────────────────── */

export type UuidFn = () => string;

/** 테스트에서 주입할 수 있도록 생성기를 분리한다. */
export function defaultUuid(): string {
  const g = globalThis as {
    crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array };
  };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (g.crypto?.getRandomValues) g.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createLearnerProfile(
  displayName: string,
  now: number,
  uuid: UuidFn = defaultUuid,
  markId?: string,
): LearnerProfile {
  const name = displayName.trim();
  if (!name) throw new Error("displayName 이 비어 있다");
  return {
    learnerId: uuid(),
    displayName: name,
    rosterStatus: "active",
    createdAt: now,
    updatedAt: now,
    version: LEARNER_PROFILE_VERSION,
    ...(markId ? { markId } : {}),
  };
}

/**
 * 이름만 바꾼다. learnerId 는 불변이고 기록은 움직이지 않는다.
 * 옛 이름은 legacyNameKeys 맨 앞에 남겨 이관 전 읽기 폴백을 유지한다.
 */
export function renameLearner(profile: LearnerProfile, nextName: string, now: number): LearnerProfile {
  const name = nextName.trim();
  if (!name) throw new Error("displayName 이 비어 있다");
  if (name === profile.displayName) return profile;
  const olds = [profile.displayName, ...(profile.legacyNameKeys ?? [])]
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== name);
  const uniq: string[] = [];
  for (const s of olds) if (!uniq.includes(s)) uniq.push(s);
  return { ...profile, displayName: name, legacyNameKeys: uniq, updatedAt: now };
}

export function setLearnerMark(
  profile: LearnerProfile,
  markId: string | undefined,
  now: number,
): LearnerProfile {
  if (markId && !LEARNER_MARKS.some((m) => m.id === markId)) throw new Error(`알 수 없는 표식: ${markId}`);
  if ((profile.markId ?? undefined) === (markId ?? undefined)) return profile;
  const next: LearnerProfile = { ...profile, updatedAt: now };
  if (markId) next.markId = markId;
  else delete next.markId;
  return next;
}

/** 낯선 계약 버전을 만나면 읽기만 하고 쓰지 않는다. */
export function isWritableProfile(profile: LearnerProfile): boolean {
  return profile.version <= LEARNER_PROFILE_VERSION;
}

/** 명렬표에 보이는 활성 이름들(표시 순서 = 추가 순서). SetupScreen 이 소비한다. */
export function activeDisplayNames(profiles: ReadonlyArray<LearnerProfile>): string[] {
  return profiles.filter((p) => p.rosterStatus === "active").map((p) => p.displayName);
}

/** 같은 이름을 쓰는 활성 학습자 그룹(동명이인). 교사 UI 가 표식을 권하는 근거. */
export function duplicateActiveNames(
  profiles: ReadonlyArray<LearnerProfile>,
): Map<string, LearnerProfile[]> {
  const byName = new Map<string, LearnerProfile[]>();
  for (const p of profiles) {
    if (p.rosterStatus !== "active") continue;
    const list = byName.get(p.displayName) ?? [];
    list.push(p);
    byName.set(p.displayName, list);
  }
  Array.from(byName.entries()).forEach(([name, list]) => { if (list.length < 2) byName.delete(name); });
  return byName;
}

/* ────────────────────────────────────────────────────────────────────────
 * 내용 해시 (순수, 의존성 없음)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * 키 순서를 정규화한 JSON. 같은 내용이면 같은 문자열이 나와야 한다 —
 * 보관/복원과 이관 dry-run 의 hash 비교가 여기에 걸려 있다.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

/**
 * FNV-1a 계열 32bit 두 갈래 — node:crypto 없이 브라우저·스크립트 양쪽에서
 * 같은 값이 나오는 것이 목적이다. 암호용이 아니다.
 */
export function contentHash(value: unknown): string {
  const s = canonicalJson(value);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

/** 노드 하나에 들어 있는 레코드 수(객체 키 수). 배열/원시값도 안전하게 센다. */
export function recordCount(value: unknown): number {
  if (value == null) return 0;
  if (Array.isArray(value)) return value.filter((v) => v != null).length;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).filter((v) => v != null).length;
  }
  return 1;
}

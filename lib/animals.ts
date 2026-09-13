/**
 * U05 — 내 동물. 데이터 계약과 순수 해석 함수.
 *
 * 왜 learnerId 인가
 * ─────────────────────────────────────────────────────────────────────────
 * `myClientId` 는 `localStorage.clientId` 에 저장된 **브라우저 단위** UUID 다
 * (app/[roomCode]/page.tsx). 교실 공용 태블릿을 A→B→A 가 돌려 쓰면 세 번 다
 * 같은 clientId 다. 동물 선택을 clientId 에 붙이면 B 가 A 의 동물을 물려받고,
 * A 가 다시 들어오면 B 가 바꾼 동물이 보인다 — 02 §3.C 가 금지한 바로 그 사고다.
 *
 * 그래서 선택의 권위는 **learnerId** 다. `LearnerProfile.avatarAnimalId` 에
 * 저장하고(= `rooms/{room}/config/learners/{learnerId}`), 이름·기기·브라우저가
 * 바뀌어도 따라간다. lib/learnerId.ts 의 markId 와 같은 자리, 같은 방식이다.
 *
 * 이 모듈이 하지 않는 일
 * ─────────────────────────────────────────────────────────────────────────
 *  - DB 읽기/쓰기. 판단과 값만 돌려준다 (learnerId.ts 와 같은 규칙).
 *  - 이름으로 프로필 합치기. 동명이인을 한 사람으로 만들지 않는다.
 *  - 잠금·가격·희귀도·순위. 8종 모두 항상 동등하게 선택 가능하다.
 */
import { contentHash } from "./learnerId";

/**
 * 기본 동물 8종. 성별·국적·능력과 연결하지 않는다. 순서는 화면에 나오는 순서.
 *
 * `emoji` 는 **에셋이 준비되기 전의 임시 표시**다. 03 에셋가이드의 동물 8종
 * PNG(`public/ui-icons/v1/animals/*.png`)가 들어오면 `asset` 경로로 그리고
 * 이모지는 폴백으로만 남는다. 지금 이모지로 보인다고 완료가 아니다.
 */
export const ANIMALS = [
  { id: "rabbit", ko: "토끼", emoji: "🐰" },
  { id: "bear", ko: "곰", emoji: "🐻" },
  { id: "cat", ko: "고양이", emoji: "🐱" },
  { id: "dog", ko: "강아지", emoji: "🐶" },
  { id: "fox", ko: "여우", emoji: "🦊" },
  { id: "panda", ko: "판다", emoji: "🐼" },
  { id: "penguin", ko: "펭귄", emoji: "🐧" },
  { id: "otter", ko: "수달", emoji: "🦦" },
] as const;

export type AnimalId = (typeof ANIMALS)[number]["id"];

const ANIMAL_IDS: ReadonlySet<string> = new Set(ANIMALS.map((a) => a.id));

/** 에셋 경로. 파일이 아직 없을 수 있으므로 렌더 쪽은 반드시 폴백을 둔다. */
export function animalAssetPath(id: AnimalId): string {
  return `/ui-icons/v1/animals/${id}.png`;
}

/**
 * allowlist 검증. 클라이언트 입력과 저장값 **양쪽** 에서 통과시킨다.
 * 모르는 값은 조용히 기본값으로 바꾸지 말고 거부해서, 잘못된 쓰기가
 * 어디서 들어왔는지 드러나게 한다.
 */
export function isAnimalId(v: unknown): v is AnimalId {
  return typeof v === "string" && ANIMAL_IDS.has(v);
}

export function animalOf(id: AnimalId) {
  return ANIMALS.find((a) => a.id === id)!;
}

export function animalLabel(id: AnimalId | null | undefined): string {
  return id && isAnimalId(id) ? animalOf(id).ko : "";
}

/**
 * 아직 고르지 않은 아이의 기본 동물.
 *
 * 요구: "선택 전 기본 캐릭터도 여러 동물로 보이도록 room + stable identity 에
 * 대한 결정적 fallback 을 사용한다. 렌더마다 random 금지."
 *
 * 같은 입력이면 항상 같은 동물이 나온다. 방이 다르면 배치가 달라져 한 반의
 * 모두가 같은 동물로 보이지 않는다. 같은 동물을 여러 아이가 갖는 것은 허용한다.
 */
/**
 * 32bit avalanche(lowbias32). contentHash 의 결과를 그대로 8로 나누면 안 된다:
 * FNV-1a 계열이라 **하위 비트가 문자열 끝에 좌우돼서**, 접두사만 다른
 * "1234:학생1" 과 "5678:학생1" 이 같은 동물로 떨어진다. 두 갈래를 XOR 하는
 * 정도로도 부족했다(두 갈래가 상관돼 8종 중 3종으로 몰렸다).
 * 둘 다 scripts/test-animals.mjs 가 실제로 잡아낸 문제다.
 */
function avalanche32(x: number): number {
  let n = x >>> 0;
  n ^= n >>> 16; n = Math.imul(n, 0x7feb352d) >>> 0;
  n ^= n >>> 15; n = Math.imul(n, 0x846ca68b) >>> 0;
  n ^= n >>> 16;
  return n >>> 0;
}

export function fallbackAnimal(roomCode: string, stableId: string): AnimalId {
  const h = contentHash(`${roomCode}:${stableId}`);
  const h1 = parseInt(h.slice(0, 8), 16);
  const h2 = parseInt(h.slice(8, 16), 16);
  const n = avalanche32(h1 ^ Math.imul(h2, 0x9e3779b1));
  return ANIMALS[n % ANIMALS.length].id;
}

/** 동물을 정한 근거. 화면에 '임시 배정' 을 구분해 보여주거나 검사에서 쓴다. */
export type AnimalSource =
  /** 본인이 고른 값이 프로필에 있다. */
  | "profile"
  /** 글에 함께 저장된 당시 선택(스냅샷). 프로필을 못 찾을 때만. */
  | "snapshot"
  /** 아무 근거가 없어 결정적으로 배정했다. 본인이 고르면 바뀐다. */
  | "fallback";

export interface AnimalResolution {
  id: AnimalId;
  source: AnimalSource;
}

export interface ResolveAnimalInput {
  roomCode: string;
  /** 글/댓글에 저장된 작성자 learnerId. 옛 글에는 없다. */
  authorLearnerId?: string;
  /** learnerId → 프로필. 호출부가 RoomConfig.learners 로 채운다. */
  profiles?: Readonly<Record<string, { avatarAnimalId?: string } | undefined>>;
  /** 글에 함께 저장해 둔 당시 동물. 프로필이 사라져도 화면이 흔들리지 않게 한다. */
  snapshotAnimalId?: string;
  /** 결정적 폴백에 쓸 안정 식별자. learnerId → clientId → 이름 순으로 넘긴다. */
  stableId?: string;
}

/**
 * 한 작성자의 동물을 정한다. 순서는 요구사항 그대로다:
 *   검증된 learnerId → 프로필 조회 → 저장된 스냅샷 → 안정적 fallback
 *
 * **이름으로 프로필을 찾지 않는다.** 동명이인 두 명이 한 사람으로 합쳐지는 것이
 * 가장 되돌리기 어려운 사고다(learnerId.ts 의 ambiguous 처리와 같은 이유).
 * 이름은 마지막 폴백의 해시 재료로만 쓴다 — 그건 표시용 배정일 뿐 신원 판단이 아니다.
 */
export function resolveAnimal(input: ResolveAnimalInput): AnimalResolution {
  const { roomCode, authorLearnerId, profiles, snapshotAnimalId, stableId } = input;

  if (authorLearnerId) {
    const picked = profiles?.[authorLearnerId]?.avatarAnimalId;
    if (isAnimalId(picked)) return { id: picked, source: "profile" };
  }
  if (isAnimalId(snapshotAnimalId)) return { id: snapshotAnimalId, source: "snapshot" };

  const seed = authorLearnerId || stableId || "";
  return { id: fallbackAnimal(roomCode, seed), source: "fallback" };
}

/**
 * 프로필에 동물을 반영한 새 객체. learnerId.ts 의 setLearnerMark 와 같은 모양이다.
 * `null` 이면 선택 해제(다시 폴백으로 돌아간다).
 *
 * 모르는 id 는 던진다 — 조용히 무시하면 저장에 실패했는데 성공처럼 보인다.
 */
export function setLearnerAnimal<T extends { avatarAnimalId?: string; updatedAt: number }>(
  profile: T,
  animalId: AnimalId | null,
  now: number,
): T {
  if (animalId !== null && !isAnimalId(animalId)) {
    throw new Error(`허용되지 않은 동물: ${String(animalId)}`);
  }
  if ((profile.avatarAnimalId ?? null) === animalId) return profile;
  const next = { ...profile, updatedAt: now };
  if (animalId) next.avatarAnimalId = animalId;
  else delete next.avatarAnimalId;
  return next;
}

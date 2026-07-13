// Test: stageOf(0)=egg, stageOf(2)=larva, stageOf(4)=pupa, stageOf(8)=bee, stageOf(15)=queen
// Test: nextThreshold(0)=2, nextThreshold(8)=15, nextThreshold(15)=null
// Test: progressInStage(5)=(current:1,total:4,percent:25)

import type { Stage, SkinId, HatId, PetId, TrophyId, BackdropId, AuraId, HeldId, AccId } from "./types";

// Stage thresholds: [min, max] inclusive. queen has no upper bound.
export const STAGE_THRESHOLDS: Record<Stage, { min: number; max: number | null }> = {
  egg:   { min: 0,  max: 1 },
  larva: { min: 2,  max: 3 },
  pupa:  { min: 4,  max: 7 },
  bee:   { min: 8,  max: 14 },
  queen: { min: 15, max: null },
};

const STAGE_ORDER: Stage[] = ["egg", "larva", "pupa", "bee", "queen"];

export function stageOf(count: number): Stage {
  const n = Math.max(0, Math.floor(count));
  if (n >= STAGE_THRESHOLDS.queen.min) return "queen";
  if (n >= STAGE_THRESHOLDS.bee.min) return "bee";
  if (n >= STAGE_THRESHOLDS.pupa.min) return "pupa";
  if (n >= STAGE_THRESHOLDS.larva.min) return "larva";
  return "egg";
}

// Returns next threshold (min of next stage). Null if already queen.
export function nextThreshold(count: number): number | null {
  const stage = stageOf(count);
  const idx = STAGE_ORDER.indexOf(stage);
  if (stage === "queen" || idx === STAGE_ORDER.length - 1) return null;
  const next = STAGE_ORDER[idx + 1];
  return STAGE_THRESHOLDS[next].min;
}

// Progress within current stage:
// e.g. count=8 pupa(6-15) → {current: 2, total: 10, percent: 20}
// Queen returns {current: count, total: count, percent: 100}.
export function progressInStage(count: number): { current: number; total: number; percent: number } {
  const n = Math.max(0, Math.floor(count));
  const stage = stageOf(n);
  if (stage === "queen") {
    return { current: n, total: n, percent: 100 };
  }
  const { min, max } = STAGE_THRESHOLDS[stage];
  // total = number of stickers needed to traverse this stage from min to next stage min
  // For pupa(6-15), next stage min = 16 → total = 16 - 6 = 10. count=8 → current = 2.
  const total = (max as number) - min + 1;
  const current = n - min;
  const percent = Math.max(0, Math.min(100, Math.round((current / total) * 100)));
  return { current, total, percent };
}

// Korean stage label
export function stageLabel(stage: Stage): string {
  switch (stage) {
    case "egg":   return "알";
    case "larva": return "애벌레";
    case "pupa":  return "번데기";
    case "bee":   return "벌";
    case "queen": return "여왕벌";
  }
}

// Image path for stage (classic skin = 기본 노란색)
export function stageImage(stage: Stage): string {
  switch (stage) {
    case "egg":   return "/stickers/stage-1-egg.png";
    case "larva": return "/stickers/stage-2-larva.png";
    case "pupa":  return "/stickers/stage-3-pupa.png";
    case "bee":   return "/stickers/stage-4-bee.png";
    case "queen": return "/stickers/stage-5-queen.png";
  }
}

function stageKey(stage: Stage): string {
  switch (stage) {
    case "egg":   return "stage-1-egg";
    case "larva": return "stage-2-larva";
    case "pupa":  return "stage-3-pupa";
    case "bee":   return "stage-4-bee";
    case "queen": return "stage-5-queen";
  }
}

// Skin 은 "같은 단계 캐릭터의 색 변형" 이다. classic 이 아니면 해당 skin 의
// 재채색 버전(/stickers/skins/stage-{n}-{name}-{skin}.png) 을 반환.
// 스킨 파일이 없다면 호출부에서 onError 로 기본 stageImage 로 폴백.
export function stageImageWithSkin(stage: Stage, skin: SkinId): string {
  if (skin === "classic") return stageImage(stage);
  return `/stickers/skins/${stageKey(stage)}-${skin}.png`;
}

// 모자 합성본 경로. 미리 합성된 이미지(더 자연스러움).
// 기본 4종은 Gemini edit, 여왕벌 왕관 3종(crown-rose/sapphire/honey)은
// scripts/gen-queen-crown-composites.mjs 로 로컬 합성.
// classic + hat 조합에만 합성본이 존재. 스킨 + 모자 조합은 호출부에서 별도 처리.
export function stageImageWithHat(stage: Stage, hat: NonNullable<HatId>): string {
  return `/stickers/stage-hats/${stageKey(stage)}-${hat}.png`;
}

// Skin + Hat 합성본. skin_hats 배치로 5색 × 5스테이지 × 4모자 = 100장 생성.
// 여왕벌 전용 왕관 3종은 5색 × queen 15장 추가 (gen-queen-crown-composites.mjs).
// classic 스킨은 기존 stage-hats 폴더 사용.
export function stageImageWithSkinAndHat(
  stage: Stage,
  skin: SkinId,
  hat: NonNullable<HatId>,
): string {
  if (skin === "classic") return stageImageWithHat(stage, hat);
  return `/stickers/skin-hats/${stageKey(stage)}-${skin}-${hat}.png`;
}

// === Unlock logic (pure, no Firebase) ===
// 해금은 "스티커 개수" 기반. 스테이지 문턱(0/2/4/8/15)과 여왕벌 이후의
// 로열 마일스톤(20/25/30)을 하나의 표로 관리한다 — 값 = 필요 스티커 수.
// 전체 로스터 40종. docs/꿀벌마을-마스터플랜.md 의 표와 1:1 동기화 유지.

export const ROYAL_MILESTONES: { at: number; label: string }[] = [
  { at: 20, label: "반짝 여왕" },
  { at: 25, label: "별빛 여왕" },
  { at: 30, label: "전설의 여왕" },
];

export const UNLOCK_AT = {
  skin: { classic: 0, orange: 2, green: 2, sky: 4, pink: 4, purple: 4 },
  hat: {
    top: 4, cap: 8, party: 8,
    crown: 15, "crown-rose": 15, "crown-sapphire": 15, "crown-honey": 15,
  },
  backdrop: { flower: 4, hive: 4, rainbow: 4, night: 4, throne: 15, galaxy: 20 },
  aura: { sparkle: 8, heart: 8, stardust: 8, royal: 15, prism: 25 },
  pet: { dog: 8, cat: 15, rabbit: 15, butterfly: 15, fox: 20, owl: 25 },
  trophy: { gold: 15, star: 15, diamond: 30 },
  held: { honeypot: 8, book: 8, flag: 15 },
  acc: { scarf: 4, glasses: 4, necklace: 8, cape: 15 },
} as const;

export type CosmeticKind = keyof typeof UNLOCK_AT;

function unlockedOf<T extends string>(table: Record<T, number>, count: number): T[] {
  const n = Math.max(0, Math.floor(count));
  return (Object.keys(table) as T[]).filter((id) => n >= table[id]);
}

export function unlockedSkins(count: number): SkinId[] {
  return unlockedOf(UNLOCK_AT.skin as Record<SkinId & string, number>, count);
}
export function unlockedHats(count: number): NonNullable<HatId>[] {
  return unlockedOf(UNLOCK_AT.hat as Record<NonNullable<HatId>, number>, count);
}
export function unlockedBackdrops(count: number): NonNullable<BackdropId>[] {
  return unlockedOf(UNLOCK_AT.backdrop as Record<NonNullable<BackdropId>, number>, count);
}
export function unlockedAuras(count: number): NonNullable<AuraId>[] {
  return unlockedOf(UNLOCK_AT.aura as Record<NonNullable<AuraId>, number>, count);
}
export function unlockedPets(count: number): NonNullable<PetId>[] {
  return unlockedOf(UNLOCK_AT.pet as Record<NonNullable<PetId>, number>, count);
}
export function unlockedTrophies(count: number): NonNullable<TrophyId>[] {
  return unlockedOf(UNLOCK_AT.trophy as Record<NonNullable<TrophyId>, number>, count);
}
export function unlockedHeld(count: number): NonNullable<HeldId>[] {
  return unlockedOf(UNLOCK_AT.held as Record<NonNullable<HeldId>, number>, count);
}
export function unlockedAccs(count: number): NonNullable<AccId>[] {
  return unlockedOf(UNLOCK_AT.acc as Record<NonNullable<AccId>, number>, count);
}

/** 특정 아이템의 필요 스티커 수 (표에 없으면 0 = 항상 해금). */
export function requiredCount(kind: CosmeticKind, id: string): number {
  return (UNLOCK_AT[kind] as Record<string, number>)[id] ?? 0;
}

/** count 초과인 가장 가까운 해금 문턱. 전부 해금이면 null. */
export function nextUnlockAt(count: number): number | null {
  const n = Math.max(0, Math.floor(count));
  let best: number | null = null;
  for (const table of Object.values(UNLOCK_AT)) {
    for (const at of Object.values(table) as number[]) {
      if (at > n && (best === null || at < best)) best = at;
    }
  }
  return best;
}

/** 여왕벌 이후 진행률: 직전 해금 문턱 → 다음 문턱 구간의 %.
 *  모든 아이템 해금(count ≥ 30) 시 null → 호출부는 phMaxStage 표기. */
export function royalProgress(count: number): { nextAt: number; remaining: number; percent: number } | null {
  const n = Math.max(0, Math.floor(count));
  const nextAt = nextUnlockAt(n);
  if (nextAt === null) return null;
  let prevAt = 0;
  for (const table of Object.values(UNLOCK_AT)) {
    for (const at of Object.values(table) as number[]) {
      if (at <= n && at > prevAt) prevAt = at;
    }
  }
  const percent = Math.max(0, Math.min(100, Math.round(((n - prevAt) / (nextAt - prevAt)) * 100)));
  return { nextAt, remaining: nextAt - n, percent };
}

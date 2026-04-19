// Test: stageOf(0)=egg, stageOf(3)=larva, stageOf(6)=pupa, stageOf(16)=bee, stageOf(30)=queen
// Test: nextThreshold(0)=3, nextThreshold(16)=30, nextThreshold(30)=null
// Test: progressInStage(8)=(current:2,total:10,percent:20)

import type { Stage, SkinId, HatId, PetId, TrophyId } from "./types";

// Stage thresholds: [min, max] inclusive. queen has no upper bound.
export const STAGE_THRESHOLDS: Record<Stage, { min: number; max: number | null }> = {
  egg:   { min: 0,  max: 2 },
  larva: { min: 3,  max: 5 },
  pupa:  { min: 6,  max: 15 },
  bee:   { min: 16, max: 29 },
  queen: { min: 30, max: null },
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

// Skin 은 "같은 단계 캐릭터의 색 변형" 이다. classic 이 아니면 해당 skin 의
// 재채색 버전(/stickers/skins/stage-{n}-{name}-{skin}.png) 을 반환.
// 스킨 파일이 없다면 호출부에서 onError 로 기본 stageImage 로 폴백.
export function stageImageWithSkin(stage: Stage, skin: SkinId): string {
  if (skin === "classic") return stageImage(stage);
  const key = (() => {
    switch (stage) {
      case "egg":   return "stage-1-egg";
      case "larva": return "stage-2-larva";
      case "pupa":  return "stage-3-pupa";
      case "bee":   return "stage-4-bee";
      case "queen": return "stage-5-queen";
    }
  })();
  return `/stickers/skins/${key}-${skin}.png`;
}

// Helper: numeric rank of a stage (egg=0 ... queen=4)
function rank(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage);
}

// === Unlock logic (pure, no Firebase) ===

// classic always. larva+: +orange,green. pupa+: +sky,pink,purple.
export function unlockedSkins(stage: Stage): SkinId[] {
  const r = rank(stage);
  const out: SkinId[] = ["classic"];
  if (r >= rank("larva")) out.push("orange", "green");
  if (r >= rank("pupa"))  out.push("sky", "pink", "purple");
  return out;
}

// pupa+: top. bee+: +cap,ribbon. queen+: +crown.
export function unlockedHats(stage: Stage): NonNullable<HatId>[] {
  const r = rank(stage);
  const out: NonNullable<HatId>[] = [];
  if (r >= rank("pupa"))  out.push("top");
  if (r >= rank("bee"))   out.push("cap", "ribbon");
  if (r >= rank("queen")) out.push("crown");
  return out;
}

// bee+: dog. queen+: +cat,rabbit,butterfly.
export function unlockedPets(stage: Stage): NonNullable<PetId>[] {
  const r = rank(stage);
  const out: NonNullable<PetId>[] = [];
  if (r >= rank("bee"))   out.push("dog");
  if (r >= rank("queen")) out.push("cat", "rabbit", "butterfly");
  return out;
}

// queen+: gold, star.
export function unlockedTrophies(stage: Stage): NonNullable<TrophyId>[] {
  const r = rank(stage);
  const out: NonNullable<TrophyId>[] = [];
  if (r >= rank("queen")) out.push("gold", "star");
  return out;
}

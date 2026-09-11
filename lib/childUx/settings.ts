/**
 * 아이 화면 설정(글자 크기 · 모션 · 말투)의 단일 저장/적용 경로 — 작업 A.
 *
 * 기존 `uiFontScale`(document zoom) 설정을 여기로 흡수한다. 같은 값이 두 경로로
 * 두 번 적용되면 200% 확대 검사와 레이아웃이 모두 어긋나므로, 적용은 언제나
 * 이 파일의 `applyChildUx` 한 곳에서만 한다.
 */
import type { TextSize, ToneMode } from "./tokens";

export type MotionPref = "system" | "full" | "reduced";

export interface ChildUxSettings {
  textSize: TextSize;
  motion: MotionPref;
  tone: ToneMode;
}

export const DEFAULT_CHILD_UX: ChildUxSettings = { textSize: "basic", motion: "system", tone: "playful" };

export const CHILD_UX_STORAGE_KEY = "childUx.settings";
/** FontSizeButton 이 쓰던 옛 키. 1회 이관 후에도 남겨두고 읽기만 한다. */
export const LEGACY_FONT_SCALE_KEY = "uiFontScale";

function isTextSize(v: unknown): v is TextSize {
  return v === "basic" || v === "large";
}
function isMotion(v: unknown): v is MotionPref {
  return v === "system" || v === "full" || v === "reduced";
}
function isTone(v: unknown): v is ToneMode {
  return v === "playful" || v === "calm";
}

/** 저장된 설정을 읽는다. 값이 깨져 있거나 없으면 기본값으로 떨어진다(예외 없음). */
export function readChildUx(): ChildUxSettings {
  if (typeof window === "undefined") return DEFAULT_CHILD_UX;
  try {
    const rawNew = window.localStorage.getItem(CHILD_UX_STORAGE_KEY);
    if (rawNew) {
      const parsed = JSON.parse(rawNew) as Partial<ChildUxSettings>;
      return {
        textSize: isTextSize(parsed.textSize) ? parsed.textSize : DEFAULT_CHILD_UX.textSize,
        motion: isMotion(parsed.motion) ? parsed.motion : DEFAULT_CHILD_UX.motion,
        tone: isTone(parsed.tone) ? parsed.tone : DEFAULT_CHILD_UX.tone,
      };
    }
    // 옛 zoom 배율(0.9 / 1 / 1.15 / 1.3) → 두 단계 글자 크기로 1회 이관.
    const legacy = Number(window.localStorage.getItem(LEGACY_FONT_SCALE_KEY));
    if (Number.isFinite(legacy) && legacy > 0) {
      return { ...DEFAULT_CHILD_UX, textSize: legacy >= 1.15 ? "large" : "basic" };
    }
  } catch {
    /* 사생활 보호 모드 등에서 localStorage 접근 자체가 던질 수 있다. */
  }
  return DEFAULT_CHILD_UX;
}

export function writeChildUx(s: ChildUxSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHILD_UX_STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* 저장 실패해도 현재 화면 적용은 유지한다. */
  }
}

/**
 * 문서 루트에 설정을 반영한다. 토큰 CSS 가 이 data 속성만 보고 값을 바꾸므로
 * 여기서 font-size / zoom / transform 을 직접 건드리지 않는다.
 */
export function applyChildUx(s: ChildUxSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.uxText = s.textSize;
  root.dataset.uxTone = s.tone;
  if (s.motion === "system") delete root.dataset.uxMotion;
  else root.dataset.uxMotion = s.motion;
  // 옛 applyFontScale 이 남긴 인라인 zoom 제거 — 남아 있으면 이중 배율이 된다.
  if (root.style.zoom) root.style.removeProperty("zoom");
}

/** 실제로 적용될 모션 상태. 애니메이션을 JS 로 도는 곳(마을 씬 등)이 참조한다. */
export function resolveMotion(s: ChildUxSettings): "full" | "reduced" {
  if (s.motion !== "system") return s.motion;
  if (typeof window === "undefined" || !window.matchMedia) return "full";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
}

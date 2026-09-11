/**
 * 캐릭터 합성 렌더 계약 v2 — 작업 A가 동결하고 D가 구현, E(마을)가 소비한다.
 *
 * 여기에는 순수 기하 계산과 타입만 둔다. 자산 해석(manifest 조회·폴백 선택)은
 * D 소유의 `lib/characterRenderPlan.ts` 다. 좌표계는 단 하나 —
 * **해당 파일의 최종 trim 캔버스 픽셀** — 이며, 퍼센트는 화면 변환 뒤에만 쓴다.
 * 스프라이트용 퍼센트를 GLB 에 재사용하지 않는다(README §7.2, §8.3).
 */

export type Slot = "body" | "hat" | "held" | "acc" | "cape" | "backdrop" | "aura";

/** 그리는 순서. 숫자가 작을수록 뒤. README §7.3 의 순서를 코드로 고정한 것. */
export const LAYER_ORDER = [
  "background",
  "environment-shadow",
  "cape-back",
  "body-back",
  "held-back",
  "body",
  "front-hand-mask",
  "hat",
  "face-accessory",
  "held-front",
  "aura",
] as const;
export type LayerKind = (typeof LAYER_ORDER)[number];

export interface AnchorPoint {
  /** trim 캔버스 기준 픽셀 x */
  x: number;
  /** trim 캔버스 기준 픽셀 y */
  y: number;
}

export interface AssetAnchors {
  headTop?: AnchorPoint;
  eyes?: AnchorPoint;
  neck?: AnchorPoint;
  leftGrip?: AnchorPoint;
  rightGrip?: AnchorPoint;
  ground?: AnchorPoint;
}

export interface ManifestEntry {
  assetId: string;
  version: number;
  sha256: string;
  file: string;
  sourceWidth: number;
  sourceHeight: number;
  alphaBounds: { left: number; top: number; right: number; bottom: number };
  anchors: AssetAnchors;
  slots: Slot[];
  compatibleStages: string[];
  authoredView: "three-quarter" | "front" | "side";
  lightDirection: "upper-left" | "upper-right" | "front";
  approved: boolean;
}

export interface CharacterRenderProps {
  stage: string;
  skin: string;
  hat?: string | null;
  held?: string | null;
  acc?: string | null;
  backdrop?: string | null;
  aura?: string | null;
  /** 정사각 컨테이너 한 변(CSS px). */
  size: number;
  reducedMotion: boolean;
}

export type PlanStatus =
  | "composite"        // 승인된 stage+skin+hat 완성 합성본
  | "overlay"          // 동일 skin 원본 + 검증된 모자 오버레이
  | "plain"            // 동일 skin 원본만 (장식 준비 중 표시)
  | "stage-default"    // 기본 stage 원본
  | "placeholder";     // 최종 정적 대체

export interface RenderLayer {
  kind: LayerKind;
  assetId: string;
  src: string;
  /** 컨테이너 좌표계(CSS px) 기준 배치. */
  left: number;
  top: number;
  width: number;
  height: number;
  rotateDeg?: number;
  /** 회전 기준점(컨테이너 px). 손 접점이 있으면 그 점을 쓴다. */
  originX?: number;
  originY?: number;
  opacity?: number;
  clipMaskId?: string;
}

export interface CharacterRenderPlan {
  resolvedAssetId: string;
  status: PlanStatus;
  layers: RenderLayer[];
  /** 같은 props 면 같은 값. DOM/텍스처 표현 일치 검사(ART-04)의 비교 키. */
  planHash: string;
  /** 사용자에게 보일 상태 문구 키. 실패를 빈 화면으로 두지 않기 위한 것. */
  notice?: "decorating" | "asset-missing";
}

export interface ContainTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
}

/**
 * objectFit:contain 과 동일한 변환. 퍼센트 좌표를 쓰기 전에 반드시 통과해야 한다.
 *
 * 예(README §7.2 고정 정답): 자산 400×800, 컨테이너 300×300 → scale .375,
 * offsetX 75, offsetY 0. 자산 x=100 은 화면 x=112.5 이고, 단순 25%(=75px)와
 * 37.5px 어긋난다. 이 오차가 모자·소품이 뜨거나 파묻히던 원인이다.
 */
export function containTransform(
  containerW: number,
  containerH: number,
  assetW: number,
  assetH: number,
): ContainTransform {
  if (!(assetW > 0) || !(assetH > 0) || !(containerW > 0) || !(containerH > 0)) {
    throw new Error(`containTransform: 유효하지 않은 크기 ${containerW}x${containerH} / ${assetW}x${assetH}`);
  }
  const scale = Math.min(containerW / assetW, containerH / assetH);
  const drawWidth = assetW * scale;
  const drawHeight = assetH * scale;
  return {
    scale,
    offsetX: (containerW - drawWidth) / 2,
    offsetY: (containerH - drawHeight) / 2,
    drawWidth,
    drawHeight,
  };
}

/** 자산 픽셀 앵커 → 컨테이너 CSS px 좌표. */
export function anchorToContainer(anchor: AnchorPoint, t: ContainTransform): AnchorPoint {
  return { x: t.offsetX + anchor.x * t.scale, y: t.offsetY + anchor.y * t.scale };
}

/**
 * 액세서리의 자체 접점(gripX,gripY)을 목표 지점에 맞춘 좌상단 좌표.
 * 회전은 이 접점을 transform-origin 으로 써야 물체가 손에서 떨어지지 않는다.
 */
export function placeByGrip(
  target: AnchorPoint,
  gripX: number,
  gripY: number,
  accessoryScale: number,
): { left: number; top: number } {
  return { left: target.x - gripX * accessoryScale, top: target.y - gripY * accessoryScale };
}

/** 레이어를 그릴 순서로 정렬한다. 같은 kind 안에서는 입력 순서를 지킨다. */
export function sortLayers(layers: RenderLayer[]): RenderLayer[] {
  const rank = new Map<string, number>(LAYER_ORDER.map((k, i) => [k, i]));
  return layers
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (rank.get(a.l.kind)! - rank.get(b.l.kind)!) || (a.i - b.i))
    .map((x) => x.l);
}

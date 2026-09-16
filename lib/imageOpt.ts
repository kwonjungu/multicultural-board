/**
 * 배포용 파생 이미지 URL — 원본 경로에서 규칙으로 만든다.
 *
 * `scripts/optimize-images.mjs` 가 원본은 그대로 두고 `public/_opt/**` 에
 * 폭별 WebP 를 만든다. 여기서는 그 규칙대로 URL 만 계산한다.
 *
 *   /ui-icons/v1/animals/otter.png  +  256  ->  /_opt/ui-icons/v1/animals/otter-256.webp
 *
 * **매니페스트를 클라이언트로 보내지 않는 이유:** 항목이 1,000개 가까이라
 * 번들에 넣으면 이미지에서 줄인 것을 JS 로 도로 까먹는다. 규칙으로 계산하고,
 * 파생본이 없으면(줄일 수 없어 건너뛴 그림) `onError` 로 원본에 내려온다 —
 * 그래서 이 함수는 항상 원본 경로도 함께 돌려준다.
 *
 * 되돌리려면 `public/_opt` 를 지우면 된다. 모든 화면이 원본으로 돌아간다.
 */

/** 파생본을 만드는 폴더. 여기 없는 경로는 원본을 그대로 쓴다. */
const OPTIMIZED_PREFIXES = [
  "/ui-icons/v1/",
  "/mascot/",
  "/game-icons/",
  "/stickers/",
];

export function hasDerivative(src: string): boolean {
  return OPTIMIZED_PREFIXES.some((p) => src.startsWith(p)) && /\.(png|jpe?g)$/i.test(src);
}

/**
 * 표시 크기에 맞는 파생본 URL. 없으면 원본 경로를 그대로 돌려준다.
 * `width` 는 **기기 픽셀 기준 폭**이다 — 호출부가 CSS 크기에 DPR 여유를 곱해 넘긴다.
 */
export function optimizedSrc(src: string, width: number): string {
  if (!hasDerivative(src)) return src;
  const dot = src.lastIndexOf(".");
  const stem = src.slice(0, dot);
  return `/_opt${stem}-${width}.webp`;
}

/**
 * CSS 표시 크기 -> 받을 파생본 폭.
 * DPR 2 를 기준으로 하고 한 단계 위를 고른다 — 아이 기기는 대부분 2배이고,
 * 3배 기기에서 약간 흐린 것이 매번 몇 MB 를 받는 것보다 낫다.
 */
export function pickWidth(cssSize: number, ladder: number[]): number {
  const want = cssSize * 2;
  return ladder.find((w) => w >= want) ?? ladder[ladder.length - 1];
}

/** 폴더별 사다리 — scripts/optimize-images.mjs 의 GROUPS 와 같은 값이어야 한다. */
export const LADDERS = {
  animals: [96, 144, 256],
  mascot: [256, 384, 768],
  gameIcons: [160, 320, 480],
  stickers: [128, 256, 512],
  uiIcons: [64, 128, 256],
} as const;

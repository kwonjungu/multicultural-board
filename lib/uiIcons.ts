/**
 * U03 — 같은 톤의 그림 아이콘 (홈 활동 등). 데이터 계약과 순수 해석 함수.
 *
 * 03 에셋가이드(꿀벌소통창_Opus_실행설계_20260913)로 생성된 PNG 6개를 다룬다.
 * lib/animals.ts 와 같은 자리, 같은 규칙 — React import 금지, 순수 모듈.
 *
 * 원본은 1254x1254 · 500KB~930KB 라 32px 아이콘에 매번 내려받게 하면 안 된다.
 * 그래서 `public/ui-icons/v1/` 에 원본과 함께 64/128px 파생본
 * (`${id}-64.png`, `${id}-128.png`, sharp 로 생성, contain·투명 배경 유지)을
 * 두고, 실제 화면은 **항상 파생본만** 가리킨다. 원본 경로는 이 모듈이
 * 내보내지 않는다 — 화면 코드가 실수로 원본을 쓰지 못하게 막는 것도
 * allowlist 의 역할이다.
 *
 * 아직 없는 것: 동물 8종, 공감 5종, 학습 기능 아이콘(마이크/연필/단어카드).
 * 여기 6개 밖의 값을 넣지 않는다 — 없는 파일을 '완료'로 위장하지 않는다.
 */

/** 03 에셋가이드 표(파일 · 의미 · 권장 사용)와 1:1. */
export const UI_ICONS = [
  {
    id: "globe",
    ko: "세계",
    meaning: "다문화 / 세계",
    emoji: "🌐",
  },
  {
    id: "speaker",
    ko: "듣기",
    meaning: "듣기 (TTS)",
    emoji: "🔊",
  },
  {
    id: "storybook",
    ko: "동화책",
    meaning: "동화 / 읽기",
    emoji: "📖",
  },
  {
    id: "friends",
    ko: "친구",
    meaning: "친구와 놀기",
    emoji: "🧑‍🤝‍🧑",
  },
  {
    id: "praise",
    ko: "칭찬",
    meaning: "칭찬",
    emoji: "🌟",
  },
  {
    id: "enter",
    ko: "입장",
    meaning: "교실 들어가기",
    emoji: "🚪",
  },
] as const;

export type UiIconId = (typeof UI_ICONS)[number]["id"];

/** 실제로 파생본을 만들어 둔 크기. AppIcon 은 이 중 하나로 반올림해 고른다. */
export const UI_ICON_SIZES = [64, 128] as const;
export type UiIconSize = (typeof UI_ICON_SIZES)[number];

const UI_ICON_IDS: ReadonlySet<string> = new Set(UI_ICONS.map((i) => i.id));

/**
 * allowlist 검증. 클라이언트 입력이든 상수든 이 함수를 반드시 통과시킨다.
 * animals.ts 의 isAnimalId 와 같은 규칙: 모르는 값을 조용히 기본값으로
 * 바꾸지 않는다.
 */
export function isUiIconId(v: unknown): v is UiIconId {
  return typeof v === "string" && UI_ICON_IDS.has(v);
}

export function uiIconOf(id: UiIconId) {
  return UI_ICONS.find((i) => i.id === id)!;
}

export function uiIconLabel(id: UiIconId): string {
  return uiIconOf(id).meaning;
}

export function uiIconEmoji(id: UiIconId): string {
  return isUiIconId(id) ? uiIconOf(id).emoji : "🐝";
}

/** 요청 크기를 실제로 파생본이 있는 크기 중 하나로 올림. */
function nearestGeneratedSize(size: number): UiIconSize {
  for (const s of UI_ICON_SIZES) {
    if (size <= s) return s;
  }
  return UI_ICON_SIZES[UI_ICON_SIZES.length - 1];
}

/**
 * 표시용 파생본 경로. **원본(`${id}.png`)은 절대 반환하지 않는다** —
 * 화면에는 64/128px 파생본만 쓴다(03 에셋가이드).
 *
 * 모르는 id 는 조용히 넘어가지 않고 던진다 — allowlist 밖 값이 화면까지
 * 흘러가면 깨진 이미지로만 보이고 원인을 알 수 없다.
 */
export function uiIconAssetPath(id: UiIconId, size = 64): string {
  if (!isUiIconId(id)) {
    throw new Error(`uiIconAssetPath: unknown ui icon id "${String(id)}"`);
  }
  const s = nearestGeneratedSize(size);
  return `/ui-icons/v1/${id}-${s}.png`;
}

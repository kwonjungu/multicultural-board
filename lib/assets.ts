// 공개 폴더의 PNG 에셋을 컴포넌트에서 쉽게 쓰기 위한 매핑.

// 기본 컬럼용 아이콘 (title prefix 이모지로 매칭)
const ICON_BY_PREFIX: Record<string, string> = {
  "🙋": "/icons/intro.png",
  "💬": "/icons/today.png",
  "🌟": "/icons/praise.png",
};

export function columnIconFor(title: string): string | null {
  if (!title) return null;
  // title 맨 앞 emoji를 찾아서 매핑
  const first = Array.from(title)[0];
  return ICON_BY_PREFIX[first] || null;
}

// 해당 언어 사용자의 출신 국가를 상징하는 랜드마크 이미지.
// 없으면 null → 국기 이모지로 폴백.
const LANDMARK: Record<string, string> = {
  ko:  "/landmarks/korea.png",
  en:  "/landmarks/usa.png",
  vi:  "/landmarks/vietnam.png",
  zh:  "/landmarks/china.png",
  fil: "/landmarks/philippines.png",
  ja:  "/landmarks/japan.png",
};

export function landmarkFor(langCode: string): string | null {
  return LANDMARK[langCode] || null;
}

// 꿀벌 마스코트 PNG 경로
export function beePng(mood:
  | "welcome" | "cheer" | "think" | "oops"
  | "sleep" | "celebrate" | "loading" | "shh"
): string {
  return `/mascot/bee-${mood}.png`;
}

// 배경 패턴
export const PATTERN = {
  honeycomb: "/patterns/honeycomb.png",
  flowers:   "/patterns/flowers.png",
} as const;

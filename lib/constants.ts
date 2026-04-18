export const LANGUAGES: Record<string, { label: string; flag: string; name: string; greet?: string; romanized?: string }> = {
  ko:  { label: "한국어",           flag: "🇰🇷", name: "Korean",     greet: "안녕!",       romanized: "안녕!" },
  en:  { label: "English",          flag: "🇺🇸", name: "English",    greet: "Hello!",      romanized: "헬로우!" },
  vi:  { label: "Tiếng Việt",       flag: "🇻🇳", name: "Vietnamese", greet: "Xin chào!",   romanized: "신짜오!" },
  zh:  { label: "中文",             flag: "🇨🇳", name: "Chinese",    greet: "你好!",       romanized: "니하오!" },
  fil: { label: "Filipino",         flag: "🇵🇭", name: "Filipino",   greet: "Kumusta!",    romanized: "쿠무스타!" },
  ja:  { label: "日本語",           flag: "🇯🇵", name: "Japanese",   greet: "こんにちは!", romanized: "콘니치와!" },
  th:  { label: "ภาษาไทย",         flag: "🇹🇭", name: "Thai",       greet: "สวัสดี!",     romanized: "사와디!" },
  km:  { label: "ភាសាខ្មែរ",       flag: "🇰🇭", name: "Khmer",      greet: "សួស្តី!",       romanized: "수어스데이!" },
  mn:  { label: "Монгол",           flag: "🇲🇳", name: "Mongolian",  greet: "Сайн уу!",    romanized: "새노우!" },
  ru:  { label: "Русский",          flag: "🇷🇺", name: "Russian",    greet: "Привет!",     romanized: "프리벳!" },
  uz:  { label: "O'zbek",           flag: "🇺🇿", name: "Uzbek",      greet: "Salom!",      romanized: "살롬!" },
  hi:  { label: "हिन्दी",           flag: "🇮🇳", name: "Hindi",      greet: "नमस्ते!",     romanized: "나마스테!" },
  id:  { label: "Bahasa Indonesia", flag: "🇮🇩", name: "Indonesian", greet: "Halo!",       romanized: "할로!" },
  ar:  { label: "العربية",          flag: "🇸🇦", name: "Arabic",     greet: "مرحبا!",      romanized: "마르하바!" },
  my:  { label: "မြန်မာ",           flag: "🇲🇲", name: "Burmese",    greet: "မင်္ဂလာပါ!",     romanized: "밍갈라바!" },
};

export const COLUMNS_DEFAULT = [
  { id: "col1", title: "🙋 자기소개 / Introduce", color: "#F59E0B" },
  { id: "col2", title: "💬 오늘의 이야기 / Today", color: "#FB7185" },
  { id: "col3", title: "🌟 칭찬해요 / Praise", color: "#10B981" },
];

export const CARD_PALETTES = [
  { bg: "#FFFBEB", accent: "#F59E0B" },
  { bg: "#F0FDF4", accent: "#10B981" },
  { bg: "#EFF6FF", accent: "#3B82F6" },
  { bg: "#FFF1F2", accent: "#FB7185" },
  { bg: "#F5F3FF", accent: "#A78BFA" },
  { bg: "#FFF7ED", accent: "#F97316" },
];

export const BRAND_GRADIENT = "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)";

// Kids-First honey palette (design pack v2)
export const HONEY = {
  h50:  "#FFFBEB",
  h100: "#FEF3C7",
  h200: "#FDE68A",
  h300: "#FCD34D",
  h400: "#FBBF24",
  h500: "#F59E0B",
  h600: "#D97706",
  h700: "#B45309",
  h800: "#92400E",
  h900: "#78350F",
} as const;

// Kids-First type scale (min 18px body, 20px button)
export const TYPE = {
  h1:       { size: 36, weight: 900, lh: 1.2 },
  h2:       { size: 28, weight: 800, lh: 1.3 },
  h3:       { size: 22, weight: 800, lh: 1.35 },
  body:     { size: 18, weight: 500, lh: 1.7 },
  bodyBold: { size: 18, weight: 700, lh: 1.7 },
  button:   { size: 20, weight: 800, lh: 1.2 },
  caption:  { size: 14, weight: 600, lh: 1.5 },
  label:    { size: 13, weight: 700, lh: 1.4 },
} as const;

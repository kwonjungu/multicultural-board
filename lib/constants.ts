export const LANGUAGES: Record<string, { label: string; flag: string; name: string }> = {
  ko:  { label: "한국어",           flag: "🇰🇷", name: "Korean" },
  en:  { label: "English",          flag: "🇺🇸", name: "English" },
  vi:  { label: "Tiếng Việt",       flag: "🇻🇳", name: "Vietnamese" },
  zh:  { label: "中文",             flag: "🇨🇳", name: "Chinese" },
  fil: { label: "Filipino",         flag: "🇵🇭", name: "Filipino" },
  ja:  { label: "日本語",           flag: "🇯🇵", name: "Japanese" },
  th:  { label: "ภาษาไทย",         flag: "🇹🇭", name: "Thai" },
  km:  { label: "ភាសាខ្មែរ",       flag: "🇰🇭", name: "Khmer" },
  mn:  { label: "Монгол",           flag: "🇲🇳", name: "Mongolian" },
  ru:  { label: "Русский",          flag: "🇷🇺", name: "Russian" },
  uz:  { label: "O'zbek",           flag: "🇺🇿", name: "Uzbek" },
  hi:  { label: "हिन्दी",           flag: "🇮🇳", name: "Hindi" },
  id:  { label: "Bahasa Indonesia", flag: "🇮🇩", name: "Indonesian" },
  ar:  { label: "العربية",          flag: "🇸🇦", name: "Arabic" },
  my:  { label: "မြန်မာ",           flag: "🇲🇲", name: "Burmese" },
};

export const COLUMNS_DEFAULT = [
  { id: "col1", title: "🙋 자기소개 / Introduce", color: "#6C63FF" },
  { id: "col2", title: "💬 오늘의 이야기 / Today", color: "#FF6584" },
  { id: "col3", title: "🌟 칭찬해요 / Praise", color: "#43C59E" },
];

export const CARD_PALETTES = [
  { bg: "#FFFBEA", top: "#FFD600", dot: "#F59E0B" },
  { bg: "#F0FFF4", top: "#34D399", dot: "#059669" },
  { bg: "#EFF6FF", top: "#60A5FA", dot: "#2563EB" },
  { bg: "#FFF0F3", top: "#FB7185", dot: "#E11D48" },
  { bg: "#F5F3FF", top: "#A78BFA", dot: "#7C3AED" },
  { bg: "#FFF7ED", top: "#FB923C", dot: "#EA580C" },
];

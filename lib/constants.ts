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
  { bg: "#FAFAFE", accent: "#6C63FF" },
  { bg: "#F0FFF8", accent: "#10B981" },
  { bg: "#EFF6FF", accent: "#3B82F6" },
  { bg: "#FFF1F2", accent: "#F43F5E" },
  { bg: "#F5F3FF", accent: "#8B5CF6" },
  { bg: "#FFF7ED", accent: "#F97316" },
];

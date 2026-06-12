// 다문화 지구본 — 방에서 지원하는 15개 언어의 대표 국가 좌표/랜드마크/인사말.
// 국가명은 gameData 의 COUNTRIES(15개 언어 번역)를 재사용하고,
// 없으면 로컬 fallback 을 쓴다.

import { COUNTRIES, tr, type LangMap } from "./gameData";

export interface GlobeCountry {
  lang: string;          // 앱 언어 코드 (ko, en, vi …)
  code: string;          // ISO 3166-1 alpha-2 — flagcdn / COUNTRIES 매칭
  lat: number;
  lon: number;
  landmark: string;      // /landmarks/*.png (트림된 로컬 에셋 — WebGL 텍스처로 안전)
  hello: string;         // 그 나라 말 인사
  fallbackName: LangMap; // COUNTRIES 에 없을 때
}

export const GLOBE_COUNTRIES: GlobeCountry[] = [
  { lang: "ko",  code: "KR", lat: 37.55,  lon: 126.99, landmark: "/landmarks/korea.png",       hello: "안녕하세요",   fallbackName: { ko: "대한민국", en: "South Korea" } },
  { lang: "en",  code: "US", lat: 38.90,  lon: -77.04, landmark: "/landmarks/usa.png",         hello: "Hello",        fallbackName: { ko: "미국", en: "United States" } },
  { lang: "vi",  code: "VN", lat: 21.03,  lon: 105.85, landmark: "/landmarks/vietnam.png",     hello: "Xin chào",     fallbackName: { ko: "베트남", en: "Vietnam" } },
  { lang: "zh",  code: "CN", lat: 39.90,  lon: 116.40, landmark: "/landmarks/china.png",       hello: "你好",          fallbackName: { ko: "중국", en: "China" } },
  { lang: "fil", code: "PH", lat: 14.60,  lon: 120.98, landmark: "/landmarks/philippines.png", hello: "Kumusta",      fallbackName: { ko: "필리핀", en: "Philippines" } },
  { lang: "ja",  code: "JP", lat: 35.68,  lon: 139.69, landmark: "/landmarks/japan.png",       hello: "こんにちは",    fallbackName: { ko: "일본", en: "Japan" } },
  { lang: "th",  code: "TH", lat: 13.76,  lon: 100.50, landmark: "/landmarks/thailand.png",    hello: "สวัสดี",         fallbackName: { ko: "태국", en: "Thailand" } },
  { lang: "km",  code: "KH", lat: 11.56,  lon: 104.92, landmark: "/landmarks/cambodia.png",    hello: "សួស្តី",          fallbackName: { ko: "캄보디아", en: "Cambodia" } },
  { lang: "mn",  code: "MN", lat: 47.92,  lon: 106.92, landmark: "/landmarks/mongolia.png",    hello: "Сайн уу",      fallbackName: { ko: "몽골", en: "Mongolia" } },
  { lang: "ru",  code: "RU", lat: 55.76,  lon: 37.62,  landmark: "/landmarks/russia.png",      hello: "Привет",       fallbackName: { ko: "러시아", en: "Russia" } },
  { lang: "uz",  code: "UZ", lat: 41.31,  lon: 69.24,  landmark: "/landmarks/uzbekistan.png",  hello: "Salom",        fallbackName: { ko: "우즈베키스탄", en: "Uzbekistan" } },
  { lang: "hi",  code: "IN", lat: 28.61,  lon: 77.21,  landmark: "/landmarks/india.png",       hello: "नमस्ते",         fallbackName: { ko: "인도", en: "India" } },
  { lang: "id",  code: "ID", lat: -6.20,  lon: 106.85, landmark: "/landmarks/indonesia.png",   hello: "Halo",         fallbackName: { ko: "인도네시아", en: "Indonesia" } },
  { lang: "ar",  code: "SA", lat: 24.71,  lon: 46.68,  landmark: "/landmarks/saudi.png",       hello: "مرحبا",        fallbackName: { ko: "사우디아라비아", en: "Saudi Arabia" } },
  { lang: "my",  code: "MM", lat: 16.84,  lon: 96.17,  landmark: "/landmarks/myanmar.png",     hello: "မင်္ဂလာပါ",      fallbackName: { ko: "미얀마", en: "Myanmar" } },
];

/** 국가명 — COUNTRIES(15개 언어) 우선, 없으면 fallback */
export function globeCountryName(c: GlobeCountry, viewerLang: string): string {
  const item = COUNTRIES.find((x) => x.code === c.code);
  return tr(item ? item.names : c.fallbackName, viewerLang);
}

export function flagUrlFor(code: string, size: "w80" | "w160" = "w160"): string {
  return `https://flagcdn.com/${size}/${code.toLowerCase()}.png`;
}

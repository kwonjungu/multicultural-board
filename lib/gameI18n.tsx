"use client";

// 게임 콘텐츠 다국어 레이어 (설계서 항목 12).
//
// 정책 (확정 설계):
//   - UI 라벨(버튼/안내)은 lib/i18n.ts 사전 테이블 그대로.
//   - 게임 콘텐츠(LangMap: 문항·지명·카드 텍스트)는
//     ① map 에 뷰어 언어가 있으면 그대로 (사전 번역 우선, 비용 0)
//     ② 없으면 ko 원본을 우선 표시하고, 번역 API(캐시) 도착 시 실제 뷰어
//        언어로 교체 — 기존 tr() 의 "영어 폴백"이 만들던 가짜 2줄 제거.
//   - 한국어(ko)는 모든 LangMap 의 필수 원본 — 항상 100% 표시 보장.
//
// 캐시: 메모리 + localStorage (`gi18n:{lang}:{hash}`) + in-flight dedupe.
// 번역 백엔드: /api/storybook-translate (배치 texts[] 지원, Groq 폴백 내장).
//
// 사용법:
//   JSX:   {tr(map, lang)}  →  <GameText map={map} lang={lang} />
//   문자열(TTS 등): const s = await translateGameText(map.ko, lang) ?? tr(map, lang)

import { useEffect, useState } from "react";
import { tr, type LangMap } from "./gameData";

const memCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

// djb2 — localStorage 키를 짧게 유지
function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}_${s.length}`;
}

function cacheKey(ko: string, lang: string): string {
  return `gi18n:${lang}:${hashText(ko)}`;
}

/** ko 원문을 lang 으로 번역 (캐시 우선). 실패 시 null — 호출부는 ko 로 폴백. */
export async function translateGameText(ko: string, lang: string): Promise<string | null> {
  const src = (ko || "").trim();
  if (!src) return null;
  if (lang === "ko") return src;

  const key = cacheKey(src, lang);
  const mem = memCache.get(key);
  if (mem) return mem;
  try {
    const ls = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (ls) { memCache.set(key, ls); return ls; }
  } catch { /* private mode 등 */ }

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const res = await fetch("/api/storybook-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: [src], fromLang: "ko", toLang: lang }),
      });
      const data = (await res.json()) as { ok: boolean; translated?: string[] };
      const out = data.ok && data.translated?.[0] ? data.translated[0] : null;
      if (out) {
        memCache.set(key, out);
        try { window.localStorage.setItem(key, out); } catch { /* quota */ }
      }
      return out;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/**
 * 게임 콘텐츠 텍스트 훅. map[lang] → (번역 캐시/API) → ko 순.
 * 영어 폴백을 표시하지 않는다 — 번역 도착 전에는 ko 원문.
 */
export function useGameText(map: LangMap | undefined, lang: string): string {
  const direct = map ? map[lang] ?? null : null;
  const ko = map?.ko ?? "";
  const [translated, setTranslated] = useState<string | null>(null);

  useEffect(() => {
    setTranslated(null);
    if (direct || lang === "ko" || !ko) return;
    let cancel = false;
    translateGameText(ko, lang).then((t) => {
      if (!cancel && t) setTranslated(t);
    });
    return () => { cancel = true; };
  }, [direct, ko, lang]);

  if (!map) return "";
  if (direct) return direct;
  if (lang === "ko") return ko || tr(map, lang);
  return translated ?? ko ?? tr(map, lang);
}

/**
 * tr() 호출부의 drop-in 대체 컴포넌트.
 *   {tr(map, lang)} → <GameText map={map} lang={lang} />
 * 리스트 렌더 내부에서도 항목별 훅이 안전하게 동작한다.
 */
export function GameText({ map, lang }: { map: LangMap | undefined; lang: string }) {
  return <>{useGameText(map, lang)}</>;
}

/**
 * 게임 시작 시 프리페치 — 방 언어 세트에 필요한 번역을 미리 캐시에 채운다.
 * 배치 1회 호출로 라운드 중 지연 제거. fire-and-forget 권장.
 */
export async function prefetchGameTexts(maps: Array<LangMap | undefined>, lang: string): Promise<void> {
  if (lang === "ko") return;
  const missing: string[] = [];
  const keys: string[] = [];
  for (const m of maps) {
    if (!m || m[lang]) continue;
    const ko = (m.ko || "").trim();
    if (!ko) continue;
    const key = cacheKey(ko, lang);
    if (memCache.has(key)) continue;
    try {
      const ls = window.localStorage.getItem(key);
      if (ls) { memCache.set(key, ls); continue; }
    } catch { /* ignore */ }
    if (!keys.includes(key)) { missing.push(ko); keys.push(key); }
  }
  if (missing.length === 0) return;
  try {
    const res = await fetch("/api/storybook-translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: missing, fromLang: "ko", toLang: lang }),
    });
    const data = (await res.json()) as { ok: boolean; translated?: string[] };
    if (!data.ok || !data.translated) return;
    data.translated.forEach((t, i) => {
      if (!t) return;
      memCache.set(keys[i], t);
      try { window.localStorage.setItem(keys[i], t); } catch { /* quota */ }
    });
  } catch { /* 프리페치 실패는 무해 — useGameText 가 개별 재시도 */ }
}

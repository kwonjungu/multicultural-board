// 문서 번역 공용 파이프라인: LibreTranslate(셀프호스팅, 무제한) 우선,
// 미설정·미지원·실패 시 Groq LLM 배치 번역으로 폴백.
// hwpx-translate 에만 있던 로직을 pptx-translate / worksheet 와 공유하도록 분리.

import { LANGUAGES } from "./constants";
import { translateBatch } from "./groq-translate";
import { translateWithLibreTranslate, isLtSupported } from "./libretranslate";

export async function translateSegments(
  segments: string[],
  fromLang: string,
  toLang: string,
  tag = "translate",
): Promise<string[]> {
  if (segments.length === 0) return [];

  const fromName = LANGUAGES[fromLang]?.name || fromLang;
  const toName   = LANGUAGES[toLang]?.name   || toLang;

  const ltConfigured = !!process.env.LIBRETRANSLATE_URL;
  if (ltConfigured && isLtSupported(fromLang, toLang)) {
    try {
      const out = await translateWithLibreTranslate(segments, fromLang, toLang);
      console.log(`[${tag}] LibreTranslate OK (${segments.length} segs)`);
      return out;
    } catch (err) {
      console.warn(`[${tag}] LibreTranslate failed → Groq:`, (err as Error).message);
    }
  } else if (ltConfigured) {
    console.log(`[${tag}] lang pair ${fromLang}→${toLang} not LT-supported, using Groq`);
  }

  return translateBatch(segments, fromLang, toLang, fromName, toName);
}

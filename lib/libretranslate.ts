/**
 * LibreTranslate 클라이언트
 *
 * 환경변수:
 *   LIBRETRANSLATE_URL  - 인스턴스 URL (예: http://localhost:5000 또는 셀프호스팅 주소)
 *   LIBRETRANSLATE_KEY  - API 키 (공개 인스턴스 또는 유료 플랜, 없으면 빈 문자열)
 *
 * LibreTranslate 지원 언어 (Argos Translate 기반):
 *   ko, en, vi, zh, ja, ru, ar, hi, id, th, fr, de, es, pt, it ...
 *   미지원: km(크메르), mn(몽골), uz(우즈벡), my(미얀마)
 *   fil → tl (Tagalog, ISO 639-1)
 *
 * 셀프호스팅 (Docker):
 *   docker run -p 5000:5000 libretranslate/libretranslate --load-only ko,en,vi,zh,ja,th,ar,hi,id,ru,tl
 *
 * Railway 무료 배포:
 *   https://railway.app → New Project → Docker → libretranslate/libretranslate
 */

/** 앱 언어코드 → LibreTranslate 언어코드 */
const LT_LANG: Record<string, string> = {
  fil: "tl",   // Filipino → Tagalog
  // zh 그대로 (LibreTranslate는 zh로 Simplified 처리)
};

/** LibreTranslate 미지원 언어 (Argos Translate 모델 없음) */
const LT_UNSUPPORTED = new Set(["km", "mn", "uz", "my"]);

export function ltLang(lang: string): string {
  return LT_LANG[lang] ?? lang;
}

export function isLtSupported(fromLang: string, toLang: string): boolean {
  return !LT_UNSUPPORTED.has(fromLang) && !LT_UNSUPPORTED.has(toLang);
}

interface LtResponse {
  translatedText?: string;
  error?: string;
}

/**
 * 텍스트 배열을 LibreTranslate로 번역.
 * - 동시 요청 8개 (CONCURRENCY)
 * - 언어 쌍 미지원이면 Error("unsupported") throw → 호출부에서 Groq 폴백
 * - 개별 네트워크 오류는 조용히 원본 유지
 */
export async function translateWithLibreTranslate(
  texts: string[],
  fromLang: string,
  toLang: string,
): Promise<string[]> {
  const baseUrl = (process.env.LIBRETRANSLATE_URL ?? "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("LIBRETRANSLATE_URL not configured");

  if (!isLtSupported(fromLang, toLang)) {
    throw new Error(`unsupported: ${fromLang}→${toLang}`);
  }

  const apiKey = process.env.LIBRETRANSLATE_KEY ?? "";
  const src = ltLang(fromLang);
  const tgt = ltLang(toLang);
  const CONCURRENCY = 8;

  const results: string[] = texts.slice(); // 원본으로 초기화
  let langUnsupported = false;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    if (langUnsupported) break;

    const slice = texts.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (text, j) => {
        if (langUnsupported) return;
        const idx = i + j;
        try {
          const body: Record<string, string> = { q: text, source: src, target: tgt, format: "text" };
          if (apiKey) body.api_key = apiKey;

          const res = await fetch(`${baseUrl}/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
          });

          if (!res.ok) {
            // HTTP 4xx/5xx → 서버 오류로 간주, 실패 카운트
            console.warn(`[libretranslate] HTTP ${res.status} for segment ${idx}`);
            failCount++;
            return;
          }

          const data = (await res.json()) as LtResponse;

          if (data.error) {
            const msg = data.error.toLowerCase();
            if (msg.includes("not supported") || msg.includes("invalid") || msg.includes("language")) {
              langUnsupported = true;
              return;
            }
            failCount++;
            return;
          }

          if (data.translatedText) {
            results[idx] = data.translatedText;
            successCount++;
          } else {
            failCount++;
          }
        } catch (e) {
          // 타임아웃·네트워크 오류
          console.warn(`[libretranslate] fetch error for segment ${idx}:`, (e as Error).message);
          failCount++;
        }
      })
    );
  }

  if (langUnsupported) throw new Error(`unsupported: ${fromLang}→${toLang}`);

  // 번역 성공이 하나도 없으면 → Groq 폴백 트리거
  if (successCount === 0 && texts.length > 0) {
    throw new Error(`LibreTranslate 번역 실패 (${failCount}개 오류) — Groq으로 재시도`);
  }

  return results;
}

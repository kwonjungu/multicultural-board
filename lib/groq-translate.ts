/**
 * Groq 다중 모델 폴백 번역 유틸
 *
 * 모델별 무료 일일 토큰 한도 (TPD):
 *   llama-3.3-70b-versatile :  100,000
 *   gemma2-9b-it            :  500,000  ← 가장 여유 있음
 *   llama-3.1-8b-instant    :  131,000
 *   합계                    :  731,000
 *
 * 한 모델이 429(rate limit)를 반환하면 다음 모델로 자동 전환.
 */

import OpenAI from "openai";

const GROQ_MODELS = [
  // ── 품질 우선 ────────────────────────────────────────────────────
  "llama-3.3-70b-versatile",          // 100k TPD  ★ 기본
  "gemma2-9b-it",                     // 500k TPD  ★ 1순위 폴백 (쿼터 5배)
  // ── 중간 품질 ───────────────────────────────────────────────────
  "llama-3.1-8b-instant",             // 131k TPD
  "llama-3.2-11b-vision-preview",     // 별도 쿼터 (비전 모델이나 텍스트도 가능)
  "mixtral-8x7b-32768",               // 별도 쿼터
  // ── 소형/빠른 모델 (최후 수단) ──────────────────────────────────
  "llama-3.2-3b-preview",             // 별도 쿼터, 빠름
  "llama-3.1-70b-versatile",          // 구버전, 별도 쿼터
];

function groqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "placeholder",
    baseURL: "https://api.groq.com/openai/v1",
  });
}

function isRateLimit(err: unknown): boolean {
  if (!err) return false;
  // OpenAI SDK APIError
  if (err instanceof OpenAI.APIError) return err.status === 429;
  // status 프로퍼티로 직접 확인 (모듈 경계 instanceof 실패 방어)
  if (typeof (err as { status?: number }).status === "number") {
    return (err as { status: number }).status === 429;
  }
  const msg = String((err as Error)?.message ?? "");
  return msg.includes("429") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("rate_limit");
}

/**
 * 텍스트 배열을 번역한다. 모델 폴백 + 배치 단위(25개).
 * 실패 시 원본 텍스트를 그대로 유지한다.
 */
export async function translateBatch(
  texts: string[],
  fromLang: string,
  toLang: string,
  fromName: string,
  toName: string,
): Promise<string[]> {
  const BATCH = 25;
  const results: string[] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += BATCH) {
    const chunk = texts.slice(i, i + BATCH);
    const translated = await translateChunkWithFallback(chunk, fromName, toName);
    for (let j = 0; j < chunk.length; j++) results[i + j] = translated[j];
  }

  return results;
}

async function translateChunkWithFallback(
  chunk: string[],
  fromName: string,
  toName: string,
): Promise<string[]> {
  const groq = groqClient();
  const prompt = buildPrompt(chunk, fromName, toName);

  for (const model of GROQ_MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
        temperature: 0.2,
      });

      const raw = (completion.choices[0]?.message?.content || "")
        .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      let parsed: string[] = [];
      try {
        const json = JSON.parse(raw);
        if (Array.isArray(json)) parsed = json.map((x) => String(x ?? ""));
      } catch { parsed = []; }

      // 길이 보정: 모자라면 원본으로 채움
      while (parsed.length < chunk.length) parsed.push(chunk[parsed.length]);
      return parsed.slice(0, chunk.length);
    } catch (err) {
      if (isRateLimit(err)) {
        console.warn(`[groq-translate] ${model} rate-limited, trying next model…`);
        continue;
      }
      // 429가 아닌 오류는 바로 던짐
      throw err;
    }
  }

  // 모든 모델 소진 → 원본 반환 (번역 실패지만 파일은 살림)
  console.error("[groq-translate] All models exhausted. Returning originals.");
  return chunk;
}

function buildPrompt(chunk: string[], fromName: string, toName: string): string {
  return `Translate each array element from ${fromName} to ${toName}.
Return ONLY a raw JSON array of strings with EXACTLY ${chunk.length} elements in the same order.
Do not add explanation, markdown, or code fences.

Input:
${JSON.stringify(chunk)}`;
}

/**
 * 긴 텍스트(PDF 전문 등) 단건 번역. 모델 폴백 적용.
 * JSON 배열 포맷 없이 "번역문만 반환" 프롬프트를 사용.
 */
export async function translateLongText(
  text: string,
  fromName: string,
  toName: string,
): Promise<string> {
  const groq = groqClient();
  const prompt = `Translate the following ${fromName} text to ${toName}.\nReturn ONLY the translated text, nothing else.\n\n${text}`;

  for (const model of GROQ_MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
        temperature: 0.3,
      });
      const result = completion.choices[0]?.message?.content?.trim();
      if (result) return result;
    } catch (err) {
      if (isRateLimit(err)) {
        console.warn(`[groq-translate] ${model} rate-limited (long text), trying next…`);
        continue;
      }
      throw err;
    }
  }

  console.error("[groq-translate] All models exhausted for long text. Returning original.");
  return text;
}

/**
 * Groq 다중 모델 폴백 번역 유틸
 *
 * 2025-04 현재 Groq Production/Preview 모델 기준 (deprecated 모델 제거)
 * 한 모델이 429 또는 사용 불가(404/400) 시 다음 모델로 자동 전환.
 *
 * Production:
 *   llama-3.3-70b-versatile  300K TPM  ★ 기본 (최고 품질)
 *   openai/gpt-oss-120b      250K TPM    폴백1 (120B, 고품질)
 *   openai/gpt-oss-20b       250K TPM    폴백2
 *   llama-3.1-8b-instant     250K TPM    폴백3 (빠름)
 * Preview:
 *   qwen/qwen3-32b           300K TPM    폴백4 (다국어 강함)
 */

import OpenAI from "openai";

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",    // Production — 최고 품질
  "openai/gpt-oss-120b",        // Production — 120B, 고품질
  "openai/gpt-oss-20b",         // Production — 빠름
  "llama-3.1-8b-instant",       // Production — 경량
  "qwen/qwen3-32b",             // Preview   — 다국어 특화
];

function groqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "placeholder",
    baseURL: "https://api.groq.com/openai/v1",
  });
}

/** 429 rate limit 또는 모델 미지원(400/404) → 다음 모델로 스킵 */
function shouldSkipModel(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof OpenAI.APIError) {
    return err.status === 429 || err.status === 404 || err.status === 400;
  }
  const status = (err as { status?: number }).status;
  if (typeof status === "number") {
    return status === 429 || status === 404 || status === 400;
  }
  const msg = String((err as Error)?.message ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("rate_limit")
    || msg.includes("model not found") || msg.includes("not supported");
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
      if (shouldSkipModel(err)) {
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
      if (shouldSkipModel(err)) {
        console.warn(`[groq-translate] ${model} rate-limited (long text), trying next…`);
        continue;
      }
      throw err;
    }
  }

  console.error("[groq-translate] All models exhausted for long text. Returning original.");
  return text;
}

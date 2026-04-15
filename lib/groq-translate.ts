/**
 * Groq 다중 모델 폴백 번역 유틸
 *
 * 2025-04 현재 Groq Production/Preview 텍스트 모델 전체 등록
 * 한 모델이 429(rate limit) 또는 400/404(미지원) 시 다음 모델로 자동 전환.
 *
 * Production:
 *   llama-3.3-70b-versatile              300K TPM  ★ 기본
 *   openai/gpt-oss-120b                  250K TPM  폴백1
 *   openai/gpt-oss-20b                   250K TPM  폴백2
 *   llama-3.1-8b-instant                 250K TPM  폴백3
 * Preview:
 *   qwen/qwen3-32b                       300K TPM  폴백4 (다국어 특화)
 *   meta-llama/llama-4-scout-17b-16e     300K TPM  폴백5 (비전 겸용)
 */

import OpenAI from "openai";

const GROQ_MODELS = [
  // ── Production ──────────────────────────────────────────────────
  "llama-3.3-70b-versatile",                   // 최고 품질
  "openai/gpt-oss-120b",                        // 120B, 고품질
  "openai/gpt-oss-20b",                         // 빠름
  "llama-3.1-8b-instant",                       // 경량
  // ── Preview ─────────────────────────────────────────────────────
  "qwen/qwen3-32b",                             // 다국어 특화
  "meta-llama/llama-4-scout-17b-16e-instruct",  // 비전 겸용 텍스트
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
 * 번역이 불필요한 세그먼트 판별 (토큰 절약)
 * - 순수 숫자/기호
 * - 공백만
 * - 1~2자 (단일 문자, 숫자 조합)
 */
function isUntranslatable(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  if (/^\d[\d.,\s%±~\-]*$/.test(t)) return true;          // 순수 숫자·퍼센트
  if (t.length === 1 && /^[!-/:-@[-`{-~]$/.test(t)) return true; // 단일 ASCII 기호
  return false;
}

/**
 * 텍스트 배열을 번역한다. 모델 폴백 + 배치 단위(50개).
 * 번역 불필요 세그먼트는 건너뛰어 토큰을 아낀다.
 * 실패 시 원본 텍스트를 그대로 유지한다.
 */
export async function translateBatch(
  texts: string[],
  fromLang: string,
  toLang: string,
  fromName: string,
  toName: string,
): Promise<string[]> {
  const BATCH = 50;  // 25→50: 배치당 프롬프트 오버헤드 절반으로 줄임
  const results: string[] = texts.slice(); // 원본으로 초기화

  // 번역 필요한 인덱스만 추림
  const needsTranslation = texts
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !isUntranslatable(t));

  for (let i = 0; i < needsTranslation.length; i += BATCH) {
    const batchItems = needsTranslation.slice(i, i + BATCH);
    const chunk = batchItems.map(({ t }) => t);
    const translated = await translateChunkWithFallback(chunk, fromName, toName);
    batchItems.forEach(({ i: origIdx }, j) => {
      results[origIdx] = translated[j] ?? texts[origIdx];
    });
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

      while (parsed.length < chunk.length) parsed.push(chunk[parsed.length]);
      return parsed.slice(0, chunk.length);
    } catch (err) {
      if (shouldSkipModel(err)) {
        console.warn(`[groq-translate] ${model} skipped (${(err as { status?: number }).status ?? "err"}), trying next…`);
        continue;
      }
      throw err;
    }
  }

  throw new Error("번역 한도 초과: 모든 Groq 모델 소진. 잠시 후 다시 시도하거나 LibreTranslate를 설정하세요.");
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
        console.warn(`[groq-translate] ${model} skipped (long text), trying next…`);
        continue;
      }
      throw err;
    }
  }

  throw new Error("번역 한도 초과: 모든 Groq 모델 소진. 잠시 후 다시 시도하거나 LibreTranslate를 설정하세요.");
}

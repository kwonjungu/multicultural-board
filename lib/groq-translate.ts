/**
 * Groq 다중 모델 폴백 번역 유틸 — 품질 강화판
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
 *
 * 품질 가드:
 *   - temperature 0.1 (창의성 최소화 → 원문 충실도)
 *   - JSON mode (response_format) 로 포맷 오류 차단 (지원 모델만)
 *   - validateTranslation 으로 인트로/해설/길이 이상 감지 → 실패율 > 20% 면 다음 모델
 *   - cleanTranslation 으로 경미한 오염(따옴표, 볼드)은 정리 후 통과
 */

import OpenAI from "openai";
import { withGroqKeyFallback } from "./groq-client";
import {
  batchValidity, cleanTranslation, validateTranslation,
} from "./translation-quality";

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
  "qwen/qwen3-32b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

// JSON mode (response_format: json_object) 확실히 지원되는 모델만 명시
const JSON_MODE_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
]);

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

function isUntranslatable(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  if (/^\d[\d.,\s%±~\-]*$/.test(t)) return true;
  if (t.length === 1 && /^[!-/:-@[-`{-~]$/.test(t)) return true;
  return false;
}

export async function translateBatch(
  texts: string[],
  fromLang: string,
  toLang: string,
  fromName: string,
  toName: string,
): Promise<string[]> {
  const BATCH = 50;
  const results: string[] = texts.slice();

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
  const prompt = buildPrompt(chunk, fromName, toName);
  const systemMsg = buildSystemPrompt();

  return withGroqKeyFallback(async (groq) => {
    let bestResult: string[] | null = null;
    let bestRate = 0;

    for (const model of GROQ_MODELS) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: prompt },
          ],
          max_tokens: 4000,
          temperature: 0.1,
          ...(JSON_MODE_MODELS.has(model)
            ? { response_format: { type: "json_object" as const } }
            : {}),
        });

        const raw = (completion.choices[0]?.message?.content || "")
          .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

        const parsed = parseTranslationResponse(raw, chunk.length);

        // 경미한 오염은 정리 후 통과
        const cleaned = parsed.map((t) => cleanTranslation(t || ""));

        // 품질 검사
        const { validRate, failures } = batchValidity(chunk, cleaned);

        // 80% 이상 유효하면 바로 채택
        if (validRate >= 0.8) {
          // 실패 항목만 원문으로 메움
          for (const f of failures) {
            console.warn(`[translate] item ${f.idx} fallback→원본 (reason=${f.reason}, model=${model})`);
            cleaned[f.idx] = chunk[f.idx];
          }
          return cleaned;
        }

        // 아직 저품질 — 다음 모델 시도하되 best 기록
        console.warn(`[translate] ${model} validity ${Math.round(validRate * 100)}% — trying next model…`);
        if (validRate > bestRate) {
          bestResult = cleaned.slice();
          bestRate = validRate;
        }
        continue;
      } catch (err) {
        if (shouldSkipModel(err)) {
          console.warn(`[translate] ${model} skipped (${(err as { status?: number }).status ?? "err"})`);
          continue;
        }
        throw err;
      }
    }

    // 모든 모델 소진 — 가장 나은 결과 사용 (실패 항목은 원문으로)
    if (bestResult) {
      for (let i = 0; i < chunk.length; i++) {
        const check = validateTranslation(chunk[i], bestResult[i] ?? "");
        if (!check.valid) bestResult[i] = chunk[i];
      }
      return bestResult;
    }

    throw new Error("번역 한도 초과: 모든 Groq 모델 소진. 잠시 후 다시 시도하세요.");
  });
}

function buildSystemPrompt(): string {
  return `You are a professional translator for a multicultural Korean elementary classroom.
Rules:
- Translate faithfully. Preserve meaning, tone, and length.
- Do NOT add explanations, notes, disclaimers, or "Here is the translation" prefixes.
- Do NOT wrap output in quotes or markdown.
- Preserve proper nouns and numbers exactly.
- If input is already in the target language, return it unchanged.
- Output must be valid JSON when requested.`;
}

function buildPrompt(chunk: string[], fromName: string, toName: string): string {
  return `Translate each string in the "items" array from ${fromName} to ${toName}.
Return a JSON object with ONE key "out" whose value is an array of EXACTLY ${chunk.length} translated strings, in the same order.

Example (ko→en):
Input:  {"items": ["안녕하세요", "감사합니다"]}
Output: {"out": ["Hello", "Thank you"]}

Now translate:
${JSON.stringify({ items: chunk })}`;
}

/**
 * LLM 응답 파싱 — JSON mode 대응.
 * 기대 포맷: {"out": [...]}  또는 바로 배열 [...]
 */
function parseTranslationResponse(raw: string, expectedLen: number): string[] {
  if (!raw) return new Array(expectedLen).fill("");

  try {
    const json = JSON.parse(raw);
    if (Array.isArray(json)) {
      return json.map((x) => String(x ?? ""));
    }
    if (json && typeof json === "object") {
      const arr = (json as Record<string, unknown>).out
        ?? (json as Record<string, unknown>).translations
        ?? (json as Record<string, unknown>).result;
      if (Array.isArray(arr)) {
        return arr.map((x) => String(x ?? ""));
      }
    }
  } catch {
    // JSON fail — raw fallback
  }
  return new Array(expectedLen).fill("");
}

/**
 * 긴 텍스트(PDF 전문 등) 단건 번역. 모델 폴백 + 키 폴백 + 품질 검사.
 */
export async function translateLongText(
  text: string,
  fromName: string,
  toName: string,
): Promise<string> {
  const systemMsg = buildSystemPrompt();
  const userMsg = `Translate the following ${fromName} text to ${toName}.
Return ONLY the translated text — no prefix, no explanation, no markdown.

${text}`;

  return withGroqKeyFallback(async (groq) => {
    let bestResult: string | null = null;

    for (const model of GROQ_MODELS) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          max_tokens: 3000,
          temperature: 0.1,
        });
        const result = completion.choices[0]?.message?.content?.trim();
        if (!result) continue;

        const cleaned = cleanTranslation(result);
        const check = validateTranslation(text, cleaned);
        if (check.valid) return cleaned;

        console.warn(`[translate-long] ${model} failed validation: ${check.reason}`);
        if (!bestResult) bestResult = cleaned;
      } catch (err) {
        if (shouldSkipModel(err)) continue;
        throw err;
      }
    }

    if (bestResult) return bestResult;
    throw new Error("번역 한도 초과: 모든 Groq 모델 소진.");
  });
}

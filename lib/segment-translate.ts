// 문서 번역 공용 파이프라인: LibreTranslate(셀프호스팅, 무제한) 우선,
// 미설정·미지원·실패 시 Groq LLM 배치 번역으로 폴백, 그마저 한도(429) 소진 시
// Gemini 2.5 flash-lite 로 최후 폴백.
// hwpx-translate 에만 있던 로직을 pptx-translate / worksheet 와 공유하도록 분리.
//
// 폴백 사다리 (2026-07-23 최신화):
//   1) LibreTranslate            — 무제한(셀프호스팅). 지원 언어쌍일 때만.
//   2) Groq 배치 번역             — gpt-oss-120b → gpt-oss-20b.
//                                   활동지 한 장이 세그먼트 수십 개라 TPM 8K 가 금방 차
//                                   429 가 잦다 → 다음 단계로.
//   3) Gemini 2.5 flash-lite      — Groq 이 통째로 소진됐을 때의 최후 폴백.
//                                   generateJson(THINKING_OFF + 400 재시도)
//                                   재사용. 결과는 Groq 과 동일한 검증 게이트
//                                   (cleanTranslation → batchValidity) 를 통과시킨다.

import { LANGUAGES } from "./constants";
import { translateBatch } from "./groq-translate";
import { translateWithLibreTranslate, isLtSupported } from "./libretranslate";
import { generateJson, getGeminiApiKeys } from "./gemini";
import { batchValidity, cleanTranslation, validateTranslation } from "./translation-quality";

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

  try {
    return await translateBatch(segments, fromLang, toLang, fromName, toName);
  } catch (groqErr) {
    // Groq 이 통째로 소진(429 전 키/모델)됐을 때만 Gemini 로 최후 폴백.
    // Gemini 키가 없거나 Gemini 도 실패하면 원래 Groq 에러를 던진다.
    if (getGeminiApiKeys().length === 0) throw groqErr;
    console.warn(`[${tag}] Groq 소진 → Gemini flash-lite 폴백:`, (groqErr as Error).message);
    try {
      return await translateBatchWithGemini(segments, fromName, toName, toLang, tag);
    } catch (gemErr) {
      console.warn(`[${tag}] Gemini 폴백도 실패:`, (gemErr as Error).message);
      throw groqErr;
    }
  }
}

// 번역 대상이 아닌 세그먼트(숫자·기호·공백) 는 그대로 둔다 — Groq 경로와 동일 정책.
function isUntranslatable(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  if (/^\d[\d.,\s%±~\-]*$/.test(t)) return true;
  if (t.length === 1 && /^[!-/:-@[-`{-~]$/.test(t)) return true;
  return false;
}

/**
 * Gemini 최후 폴백 배치 번역.
 * generateJson(2.5-flash → 2.5-flash-lite, THINKING_OFF + 400 재시도)로
 * {"out":[...]} 를 받아 개수 검증 → cleanTranslation → validateTranslation 게이트를
 * Groq 경로와 동일하게 통과시킨다. 개수 불일치 청크는 원문 유지(억지 정렬 금지).
 */
async function translateBatchWithGemini(
  segments: string[],
  fromName: string,
  toName: string,
  toLang: string,
  tag: string,
): Promise<string[]> {
  const MAX_ITEMS = 40;
  const MAX_CHARS = 3200;
  const results: string[] = segments.slice();

  const needsTranslation = segments
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !isUntranslatable(t));

  let batch: Array<{ t: string; i: number }> = [];
  let batchChars = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    const items = batch;
    batch = [];
    batchChars = 0;
    const chunk = items.map(({ t }) => t);
    const translated = await translateChunkWithGemini(chunk, fromName, toName, toLang);
    items.forEach(({ i: origIdx }, j) => {
      results[origIdx] = translated[j] ?? segments[origIdx];
    });
  };

  for (const item of needsTranslation) {
    if (batch.length >= MAX_ITEMS || (batch.length > 0 && batchChars + item.t.length > MAX_CHARS)) {
      await flush();
    }
    batch.push(item);
    batchChars += item.t.length;
  }
  await flush();

  console.log(`[${tag}] Gemini 폴백 번역 OK (${segments.length} segs)`);
  return results;
}

async function translateChunkWithGemini(
  chunk: string[],
  fromName: string,
  toName: string,
  toLang: string,
): Promise<string[]> {
  const systemPrompt = `You are a professional translator for a multicultural Korean elementary classroom.
Rules:
- Translate faithfully. Preserve meaning, tone, and length.
- Do NOT add explanations, notes, disclaimers, or "Here is the translation" prefixes.
- Do NOT wrap output in quotes or markdown.
- Preserve proper nouns and numbers exactly.
- If input is already in the target language, return it unchanged.`;
  const userPrompt = `Translate each string in the "items" array from ${fromName} to ${toName}.
Return a JSON object with ONE key "out" whose value is an array of EXACTLY ${chunk.length} translated strings, in the same order.

Example (ko→en):
Input:  {"items": ["안녕하세요", "감사합니다"]}
Output: {"out": ["Hello", "Thank you"]}

Now translate:
${JSON.stringify({ items: chunk })}`;

  const chunkChars = chunk.reduce((sum, t) => sum + t.length, 0);
  const maxTokens = Math.min(8000, Math.max(1500, chunkChars * 3));

  const { value } = await generateJson<{ out?: unknown; translations?: unknown; result?: unknown }>({
    systemPrompt,
    userPrompt,
    temperature: 0.1,
    maxTokens,
  });

  const candidate = value?.out ?? value?.translations ?? value?.result;
  // 개수 불일치 = 밀렸거나 잘림 → 이 청크는 통째로 폐기하고 원문 유지 (억지 정렬 금지).
  if (!Array.isArray(candidate) || candidate.length < chunk.length) {
    console.warn(`[translate] Gemini response misaligned/truncated — 원문 유지`);
    return chunk.slice();
  }

  const cleaned = candidate.slice(0, chunk.length).map((x) => cleanTranslation(String(x ?? "")));

  // Groq 경로와 동일한 품질 게이트: 항목별 검증 실패 시 원문으로 메운다.
  const { failures } = batchValidity(chunk, cleaned);
  for (const f of failures) {
    console.warn(`[translate] Gemini item ${f.idx} fallback→원본 (reason=${f.reason})`);
    cleaned[f.idx] = chunk[f.idx];
  }
  // 비한국어 번역인데 한글 잔류가 심한 항목도 원문 유지 (validateTranslation 이 처리하나
  // batchValidity 는 targetLang 을 넘기지 않으므로 여기서 보강).
  if (toLang && toLang !== "ko") {
    for (let i = 0; i < chunk.length; i++) {
      const check = validateTranslation(chunk[i], cleaned[i], { targetLang: toLang });
      if (!check.valid) cleaned[i] = chunk[i];
    }
  }
  return cleaned;
}

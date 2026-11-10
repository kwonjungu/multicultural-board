// 교사용 그림책 글 생성에 쓰는 JSON 생성 도우미 — Groq 전용.
//
// 2026-11-11: 학생이 접속하는 이 웹앱에서 Gemini API 호출을 모두 제거했다.
// Gemini API 추가 약관은 18세 미만이 이용할 가능성이 높은 앱의 일부로 서비스를
// 쓰는 것을 금지하며, 호출하는 사람이 교사인지는 요건이 아니다.
// app/ lib/ components/ 에 Gemini 호출을 다시 넣지 말 것 (scripts/check-no-gemini.mjs 가 빌드 전에 검사).

import { withGroqKeyFallback } from "@/lib/groq-client";

// 다른 Groq 라우트와 같은 우선순위. JSON mode 를 지원하는 모델만 둔다.
export const GROQ_JSON_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
];

export interface GenerateJsonOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

// gpt-oss 는 추론 토큰도 max_tokens 에 포함된다. 긴 JSON 이 잘리지 않게 추론을 줄인다.
function reasoningParams(model: string): Record<string, unknown> {
  return model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
}

function shouldSkipModel(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") return status === 429 || status === 404 || status === 400 || status === 413;
  const msg = String((err as Error)?.message ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("not found");
}

/**
 * JSON 객체 하나를 생성해 돌려준다. 모델이 한도·오류로 막히면 다음 모델로,
 * 키가 막히면 withGroqKeyFallback 이 예비 키로 넘긴다.
 */
export async function generateJson<T = unknown>(
  opts: GenerateJsonOptions,
): Promise<{ value: T; model: string }> {
  return withGroqKeyFallback(async (client) => {
    let lastErr: unknown = null;
    for (const model of GROQ_JSON_MODELS) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: "system" as const, content: opts.systemPrompt },
            { role: "user" as const, content: opts.userPrompt },
          ],
          temperature: opts.temperature ?? 0.75,
          max_tokens: opts.maxTokens ?? 8192,
          response_format: { type: "json_object" as const },
          ...reasoningParams(model),
        });
        const raw = completion.choices[0]?.message?.content?.trim() || "";
        if (!raw) {
          lastErr = new Error(`empty reply from ${model}`);
          continue;
        }
        try {
          return { value: extractJson<T>(raw), model };
        } catch (err) {
          lastErr = new Error(`JSON parse failed on ${model}: ${(err as Error).message}. Raw start: ${raw.slice(0, 200)}`);
          continue;
        }
      } catch (err) {
        lastErr = err;
        if (shouldSkipModel(err)) continue;
        throw err;
      }
    }
    // 모든 모델이 막혔다 — 메시지에 '모델 소진' 을 넣어 예비 키로 넘어가게 한다.
    const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
    const e = new Error(`모든 모델 소진: ${detail}`) as Error & { status?: number };
    e.status = (lastErr as { status?: number })?.status;
    throw e;
  });
}

/**
 * Robust JSON extraction from LLM output.
 * Handles:
 *   - markdown fences (```json ... ```)
 *   - trailing garbage after closing brace
 *   - truncated JSON (attempts to auto-close brackets)
 */
export function extractJson<T>(raw: string): T {
  let text = raw.trim();

  // Strip markdown fences if present
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

  // Fast path: clean JSON
  try {
    return JSON.parse(text) as T;
  } catch { /* try salvage */ }

  // Locate outermost { ... } block
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) throw new Error("no JSON object found");

  // Walk forward finding the matched closing brace, respecting strings & escapes
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastValidEnd = -1;
  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        lastValidEnd = i;
        break;
      }
    }
  }

  if (lastValidEnd !== -1) {
    const candidate = text.slice(firstBrace, lastValidEnd + 1);
    return JSON.parse(candidate) as T;
  }

  // Truncated: try to auto-close by counting open brackets/braces
  const partial = text.slice(firstBrace);
  const closed = autoClose(partial);
  return JSON.parse(closed) as T;
}

// Brute-force auto-close: count unmatched { [ and append matching } ]
function autoClose(text: string): string {
  let depth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escape = false;
  let lastSafe = text.length;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === "[") bracketDepth++;
    else if (ch === "]") bracketDepth--;
    if (!inString && (ch === "," || ch === "]" || ch === "}")) lastSafe = i + 1;
  }

  // Cut at the last structurally-safe position to avoid partial value
  let out = text.slice(0, lastSafe);
  // Remove trailing comma if it is now dangling
  out = out.replace(/,\s*$/, "");
  // Close any remaining open arrays then objects
  out += "]".repeat(Math.max(0, bracketDepth));
  out += "}".repeat(Math.max(0, depth));
  return out;
}

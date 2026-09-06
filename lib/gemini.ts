// Thin Gemini client. Uses OpenAI-compatible endpoint for text (same pattern
// as lib/groq-translate.ts) and direct REST for image generation.
//
// Env var: GEMINI_API_KEY (Vercel).

import OpenAI from "openai";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const GEMINI_REST_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Text models — ordered by preference with fallback on rate-limit.
//
// 모델 세대 이력 (전부 지원 종료가 이유다)
//   gemini-2.0-flash        2026-06-01 종료됨
//   gemini-2.5-flash        2026-10-16 종료 예정  ← 2026-09-06 에 3.8-flash 로 교체
//   llama-3.3-70b (Groq)    2026-08-16 종료됨
// 느린 원인은 모델이 아니라 thinking(추론) 단계였으므로 thinking 을 꺼 속도를 회복한다.
// 단, 3.8 에서는 스위치가 바뀌었다 — reasoning_effort:"none" 은 무시되고
// THINKING_OFF(아래) 만 실제로 먹힌다. 자세한 계측 근거는 THINKING_OFF 주석 참조.
//
// 🔒 비용 하드캡 (사용자 지시 2026-07-13): Flash 계열만. Pro 등 고가 모델 금지.
//   2026-07-23 완화: 3.1-flash-lite 예외 허용 ($0.25/$1.50 per 1M — 최저가).
//   2026-09-06 갱신: 2.5-flash 종료로 3.8-flash 승격.
//     3.8-flash 는 $0.75/$3.75 로 2.5-flash($0.30/$2.50)보다 비싸다.
//     2027-01-01 부터 도입가가 끝나 $1.50/$7.50 로 오른다.
//     그래도 Flash 계열이고 교실 규모 호출량에서는 월 몇 달러 차이다.
//     비용이 문제가 되면 1순위를 gemini-3.1-flash-lite 로 내리면 된다 — 그쪽이
//     오히려 종전 2.5-flash 보다 싸다.
//
// 허용 목록은 정규식 패턴이 아니라 명시 목록이다. 패턴은 의도치 않은 신형
// 고가 모델까지 통과시킨다.
const ALLOWED_GEMINI_MODELS = new Set([
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
]);
export function assertAllowedGeminiModel(model: string): string {
  if (!ALLOWED_GEMINI_MODELS.has(model)) {
    throw new Error(
      `Gemini 모델 차단됨(비용 하드캡 — Flash 계열 허용 목록에 없음): ${model}`,
    );
  }
  return model;
}

export const GEMINI_TEXT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
].map(assertAllowedGeminiModel);

// 튜터·핫시팅 챗봇 전용 체인. (그림책 생성 generateJson/vision 은 GEMINI_TEXT_MODELS)
export const GEMINI_CHAT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
].map(assertAllowedGeminiModel);

// Image generation model (Gemini 3.1 Flash Image aka "Nano Banana 2").
// 종전 gemini-2.5-flash-image 는 2.5 세대라 함께 올린다.
export const GEMINI_IMAGE_MODEL = assertAllowedGeminiModel("gemini-3.1-flash-image");

// Gemini 다중 API 키 폴백 — lib/groq-client.ts 의 getGroqApiKeys 와 동일 패턴.
// 환경변수 (우선순위 순): GEMINI_API_KEY → GEMINI_API_KEY_BACKUP → GEMINI_API_KEY_BACKUP2
export function getGeminiApiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP,
    process.env.GEMINI_API_KEY_BACKUP2,
  ].filter((k): k is string => !!k && k !== "placeholder");
}

function requireKey(): string {
  const k = getGeminiApiKeys()[0];
  if (!k) throw new Error("GEMINI_API_KEY not set");
  return k;
}

export function geminiClientForKey(key: string): OpenAI {
  return new OpenAI({
    apiKey: key,
    baseURL: GEMINI_BASE_URL,
    // #7: 호출당 45s 상한 — 한 호출이 함수 예산(60s)을 통째로 잡아먹고 504 되는
    // 것을 막고, 느린 호출은 빨리 실패시켜 다음 모델로 폴백한다.
    timeout: 45000,
    // SDK 자동 재시도는 429 Retry-After(수십 초)를 기다려 체감 지연만 키운다.
    maxRetries: 0,
  });
}

export function geminiTextClient(): OpenAI {
  return geminiClientForKey(requireKey());
}

/**
 * Gemini 3.x 에서 thinking 을 끄는 유일하게 유효한 파라미터.
 *
 * 2026-09-06 계측: `reasoning_effort:"none"` 은 3.8-flash 에서 무시된다. thinking
 * 토큰이 max_tokens 를 통째로 잠식해(관측 0~669 토큰, 미얀마어·크메르어는 거의 항상
 * 발생) 답이 문장 중간에서 잘렸다. 아래 파라미터를 보내면 thinking=0 이 되고 답이
 * 온전해진다. **두 파라미터를 함께 보내면 400** 이므로 reasoning_effort 는 쓰지 않는다.
 * (검증: `npm run harness:prompt` 의 "잘리지 않음(finish=stop)" 판정)
 */
export const THINKING_OFF = {
  extra_body: { google: { thinking_config: { thinking_budget: 0 } } },
} as const;

// === Text: generate JSON with fallback + simple self-critique loop ===

export interface GenerateJsonOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Ask Gemini for JSON output. Parses and returns the first valid JSON object
 * found. Falls through model list on 429/400/404.
 */
async function createJsonCompletion(
  client: OpenAI,
  model: string,
  opts: GenerateJsonOptions,
  thinkingOff: boolean,
) {
  const base = {
    model,
    messages: [
      { role: "system" as const, content: opts.systemPrompt },
      { role: "user" as const, content: opts.userPrompt },
    ],
    temperature: opts.temperature ?? 0.75,
    max_tokens: opts.maxTokens ?? 8192,
    response_format: { type: "json_object" as const },
  };
  // #7: thinking 을 꺼 생성 지연(20~40s)을 제거. (OpenAI SDK 타입엔 없어 추가 필드로 주입)
  //
  // 2026-09-06 계측(scripts/prompt-harness.mjs): 3.8 은 reasoning_effort:"none" 을
  // **무시한다**. thinking 토큰이 max_tokens 를 잠식해 응답이 문장 중간에서 잘렸다
  // (finish_reason=length). 실제로 먹히는 스위치는
  //   extra_body.google.thinking_config.thinking_budget = 0
  // 이며, 이 둘을 함께 보내면 400 이다 — 그래서 reasoning_effort 는 보내지 않는다.
  // 엔드포인트가 이 값을 거부하면 호출자가 thinkingOff=false 로 폴백한다.
  const params = thinkingOff
    ? { ...base, ...(THINKING_OFF as Record<string, unknown>) }
    : base;
  return client.chat.completions.create(params);
}

export async function generateJson<T = unknown>(
  opts: GenerateJsonOptions,
): Promise<{ value: T; model: string }> {
  const client = geminiTextClient();
  let lastErr: unknown = null;
  for (const model of GEMINI_TEXT_MODELS) {
    try {
      let completion;
      try {
        completion = await createJsonCompletion(client, model, opts, true);
      } catch (err) {
        // thinking 끄기 파라미터가 거부되면(400) 그것 없이 1회 재시도.
        if ((err as { status?: number })?.status === 400) {
          completion = await createJsonCompletion(client, model, opts, false);
        } else {
          throw err;
        }
      }
      const raw = completion.choices[0]?.message?.content?.trim() || "";
      if (!raw) {
        lastErr = new Error(`empty reply from ${model}`);
        continue;
      }
      try {
        const parsed = extractJson<T>(raw);
        return { value: parsed, model };
      } catch (err) {
        lastErr = new Error(`JSON parse failed on ${model}: ${(err as Error).message}. Raw start: ${raw.slice(0, 200)}`);
        continue;
      }
    } catch (err) {
      lastErr = err;
      const e = err as { status?: number };
      if (e?.status === 429 || e?.status === 400 || e?.status === 404) continue;
      break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("generateJson failed");
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

// === Vision: 이미지 + 프롬프트 → 텍스트 (활동지 OCR 용) ===
// 활동지 OCR 은 Gemini 2.5 Flash 계열로만 수행한다. Groq 의 llama-4-scout 비전
// 모델이 2026-07 목록에서 사라져 유일하게 살아있는 비전 경로가 Gemini 다.
// 폴백은 모델(2.5-flash → 2.5-flash-lite) + 키 로테이션 2중으로 확보한다.
// OpenAI 호환 엔드포인트가 data URL image_url 을 지원한다.

export interface VisionOptions {
  system?: string;
  prompt: string;
  imageUrl: string;          // data:image/...;base64,... 또는 https URL
  temperature?: number;
  maxTokens?: number;
  json?: boolean;            // true 면 response_format: json_object
}

export async function visionCompletion(
  opts: VisionOptions,
): Promise<{ content: string; model: string }> {
  // Groq scout 비전 모델이 2026-07 목록에서 사라져 활동지 OCR 은 Gemini 만 남았다.
  // 폴백 경로를 실제로 살아있게 하려면 (1) 모델 폴백(2.5-flash → 2.5-flash-lite)에
  // 더해 (2) 키 로테이션(GEMINI_API_KEY_BACKUP*)까지 겹쳐야 한 키가 429/한도여도
  // 다른 키·모델로 넘어간다. generateImage 의 키 폴백과 동일 정책.
  const keys = getGeminiApiKeys();
  if (keys.length === 0) throw new Error("GEMINI_API_KEY not set"); // 호출부가 Groq/다음 경로로 폴백
  let lastErr: unknown = null;
  for (let ki = 0; ki < keys.length; ki++) {
    const client = geminiClientForKey(keys[ki]);
    let rotateKey = false; // 이 키가 429/auth 로 막혔으면 다음 키로 넘어간다
    for (const model of GEMINI_TEXT_MODELS) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
            {
              role: "user" as const,
              content: [
                { type: "image_url" as const, image_url: { url: opts.imageUrl } },
                { type: "text" as const, text: opts.prompt },
              ],
            },
          ],
          temperature: opts.temperature ?? 0.1,
          max_tokens: opts.maxTokens ?? 8192,
          ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
        });
        const content = completion.choices[0]?.message?.content?.trim() || "";
        if (!content) {
          lastErr = new Error(`empty vision reply from ${model}`);
          continue;
        }
        return { content, model };
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number })?.status;
        // 400/404/503 은 다음 모델(같은 키)로. 429·401·403 은 키 소진/문제이므로
        // 이 키의 나머지 모델은 건너뛰고 바깥 루프에서 다음 키로 넘어간다.
        if (status === 429 || status === 401 || status === 403) { rotateKey = true; break; }
        if (status === 400 || status === 404 || status === 503) continue;
        break;
      }
    }
    if (!rotateKey) break; // 회복 불가능한 에러 — 다른 키로 재시도해도 의미 없음
  }
  throw lastErr instanceof Error ? lastErr : new Error("visionCompletion failed");
}

// === Image: REST call, returns base64 PNG ===

interface GenerateImageResult {
  base64: string;
  mimeType: string;
}

/** 구조화된 이미지 생성 실패 사유 — API 라우트가 클라이언트에 그대로 전달한다. */
export type GeminiImageFailReason =
  | "config"        // 키 미설정 등 — 재시도 무의미
  | "auth"          // 401/403 — 키 문제, 다른 키로만 회복 가능
  | "rate_limited"  // 429 — 잠시 후/다른 키로 재시도 가능
  | "blocked"       // 400 — 프롬프트 거부/잘못된 요청, 같은 프롬프트 재시도 무의미
  | "timeout"       // 호출 타임아웃 — 재시도 가능
  | "server"        // 5xx — 재시도 가능
  | "no_image"      // 200인데 inline 이미지 없음(텍스트만 반환 등) — 재시도 가능
  | "unknown";

export class GeminiImageError extends Error {
  reason: GeminiImageFailReason;
  status?: number;
  /** true 면 같은 요청을 잠시 후 다시 보내볼 가치가 있다. */
  retryable: boolean;
  constructor(reason: GeminiImageFailReason, message: string, status?: number) {
    super(message);
    this.name = "GeminiImageError";
    this.reason = reason;
    this.status = status;
    this.retryable = reason === "rate_limited" || reason === "timeout"
      || reason === "server" || reason === "no_image" || reason === "unknown";
  }
}

function classifyImageHttpError(status: number, bodyText: string): GeminiImageError {
  const msg = `Gemini image API ${status}: ${bodyText.slice(0, 240)}`;
  if (status === 429) return new GeminiImageError("rate_limited", msg, status);
  if (status === 401 || status === 403) return new GeminiImageError("auth", msg, status);
  if (status === 400 || status === 404) return new GeminiImageError("blocked", msg, status);
  if (status >= 500) return new GeminiImageError("server", msg, status);
  return new GeminiImageError("unknown", msg, status);
}

async function generateImageOnce(
  prompt: string,
  key: string,
  timeoutMs: number,
  referenceImages?: Array<{ base64: string; mimeType: string }>,
): Promise<GenerateImageResult> {
  const url = `${GEMINI_REST_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const refParts = (referenceImages ?? []).map((r) => ({
    inlineData: { data: r.base64, mimeType: r.mimeType },
  }));
  const body = {
    contents: [{ role: "user", parts: [...refParts, { text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if ((err as Error)?.name === "TimeoutError" || (err as Error)?.name === "AbortError") {
      throw new GeminiImageError("timeout", `Gemini image call timed out after ${timeoutMs}ms`);
    }
    throw new GeminiImageError("server", `Gemini image fetch failed: ${(err as Error)?.message ?? err}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw classifyImageHttpError(res.status, errText);
  }
  const data = await res.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
      };
    }>;
  };

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const d = p?.inlineData?.data;
    if (d) {
      return {
        base64: d,
        mimeType: p.inlineData!.mimeType || "image/png",
      };
    }
  }
  // 200 이지만 이미지가 없는 케이스(가끔 텍스트만 반환) — 재시도로 대부분 회복된다.
  throw new GeminiImageError("no_image", "Gemini image API returned no inline image data");
}

export interface GenerateImageOptions {
  /** 호출당 상한. Nano Banana 는 보통 10~30s. 기본 35s. */
  attemptTimeoutMs?: number;
  /** 재시도 포함 총 시도 횟수. 기본 3 (원 시도 + 재시도 2회). */
  maxAttempts?: number;
  /** 전체 예산 — 남은 예산이 부족하면 재시도를 포기한다. 기본 50s (route maxDuration 60s 내). */
  totalBudgetMs?: number;
  /**
   * [캐릭터 통일성] 프롬프트 앞에 첨부할 참조 이미지 (캐릭터 초상 등).
   * Nano Banana 는 이미지+텍스트 혼합 입력을 지원 — 참조가 있으면
   * "이 캐릭터 그대로 새 장면을 그려라" 방식의 조건부 생성이 된다.
   */
  referenceImages?: Array<{ base64: string; mimeType: string }>;
}

/**
 * Call Gemini image generation (Nano Banana). Returns base64-encoded PNG.
 *
 * 견고화 (이모지 폴백 잦은 문제의 서버측 대책):
 *  - 호출당 타임아웃 (기본 35s) — 매달린 호출이 함수 예산을 다 먹는 것 방지
 *  - 429/5xx/timeout/no_image 시 짧은 지수 백오프(0.5s→1s)로 최대 2회 재시도
 *  - 시도마다 키 로테이션 (GEMINI_API_KEY_BACKUP*) — groq-client 의 키 폴백과 동일 정책
 *  - 실패는 GeminiImageError(reason/retryable) 로 구조화해 던진다
 */
export async function generateImage(
  prompt: string,
  opts: GenerateImageOptions = {},
): Promise<GenerateImageResult> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new GeminiImageError("config", "GEMINI_API_KEY not set");
  }
  const attemptTimeoutMs = opts.attemptTimeoutMs ?? 35_000;
  const maxAttempts = opts.maxAttempts ?? 3;
  const totalBudgetMs = opts.totalBudgetMs ?? 50_000;
  const startedAt = Date.now();

  let lastErr: GeminiImageError | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 남은 예산 내에서만 시도 — 최소 8s 는 있어야 의미 있는 호출이 된다.
    const remaining = totalBudgetMs - (Date.now() - startedAt);
    if (remaining < 8_000) break;

    const key = keys[attempt % keys.length];
    try {
      return await generateImageOnce(prompt, key, Math.min(attemptTimeoutMs, remaining), opts.referenceImages);
    } catch (err) {
      const e = err instanceof GeminiImageError
        ? err
        : new GeminiImageError("unknown", (err as Error)?.message ?? String(err));
      lastErr = e;
      // auth 는 다른 키가 있을 때만 계속, blocked/config 는 즉시 포기.
      const rotatable = e.reason === "auth" && keys.length > 1;
      if (!e.retryable && !rotatable) throw e;
      if (attempt < maxAttempts - 1) {
        console.warn(`[gemini-image] attempt ${attempt + 1} failed (${e.reason}${e.status ? ` ${e.status}` : ""}), retrying…`);
        // 짧은 지수 백오프 (0.5s → 1s + 지터). 총 지연 수 초 이내.
        const delay = 500 * Math.pow(2, attempt) + Math.random() * 300;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr ?? new GeminiImageError("unknown", "generateImage failed");
}

/**
 * [캐릭터 통일성] 생성 이미지 속 캐릭터가 참조 캐릭터와 같은 디자인인지 판정.
 * 실패(네트워크/파싱)는 true 반환 — 검증 불가로 이미지를 버리지 않는다 (보수적).
 */
export async function verifyCharacterMatch(
  ref: { base64: string; mimeType: string },
  gen: { base64: string; mimeType: string },
): Promise<boolean> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) return true;
  const url = `${GEMINI_REST_BASE}/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(keys[0])}`;
  const body = {
    contents: [{
      role: "user",
      parts: [
        { inlineData: { data: ref.base64, mimeType: ref.mimeType } },
        { inlineData: { data: gen.base64, mimeType: gen.mimeType } },
        { text: "Image 1 is the reference character design of a children's picture book. Does Image 2 depict the SAME character (same species, colors, face, clothing/accessories — pose and scene may differ)? Answer with exactly one word: YES or NO." },
      ],
    }],
  };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return true;
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || "").join(" ");
    return !/\bNO\b/i.test(text.trim());
  } catch {
    return true;
  }
}

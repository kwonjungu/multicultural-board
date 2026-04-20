// Thin Gemini client. Uses OpenAI-compatible endpoint for text (same pattern
// as lib/groq-translate.ts) and direct REST for image generation.
//
// Env var: GEMINI_API_KEY (Vercel).

import OpenAI from "openai";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const GEMINI_REST_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Text models — ordered by preference with fallback on rate-limit.
export const GEMINI_TEXT_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
];

// Image generation model (Gemini 2.5 Flash Image aka "Nano Banana")
export const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

function requireKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY not set");
  return k;
}

export function geminiTextClient(): OpenAI {
  return new OpenAI({
    apiKey: requireKey(),
    baseURL: GEMINI_BASE_URL,
  });
}

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
export async function generateJson<T = unknown>(
  opts: GenerateJsonOptions,
): Promise<{ value: T; model: string }> {
  const client = geminiTextClient();
  let lastErr: unknown = null;
  for (const model of GEMINI_TEXT_MODELS) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
        temperature: opts.temperature ?? 0.75,
        max_tokens: opts.maxTokens ?? 8192,
        response_format: { type: "json_object" },
      });
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

// === Image: REST call, returns base64 PNG ===

interface GenerateImageResult {
  base64: string;
  mimeType: string;
}

/**
 * Call Gemini image generation (Nano Banana). Returns base64-encoded PNG.
 * The API returns inline image data in the candidates' content parts.
 */
export async function generateImage(
  prompt: string,
): Promise<GenerateImageResult> {
  const key = requireKey();
  const url = `${GEMINI_REST_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini image API ${res.status}: ${errText.slice(0, 240)}`);
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
  throw new Error("Gemini image API returned no inline image data");
}

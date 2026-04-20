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
        max_tokens: opts.maxTokens ?? 2048,
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content?.trim() || "";
      if (!raw) {
        lastErr = new Error(`empty reply from ${model}`);
        continue;
      }
      try {
        const parsed = JSON.parse(raw) as T;
        return { value: parsed, model };
      } catch {
        // Some models occasionally wrap in ```json fences despite response_format
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]) as T;
          return { value: parsed, model };
        }
        lastErr = new Error(`non-json reply from ${model}: ${raw.slice(0, 160)}`);
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

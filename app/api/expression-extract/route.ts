// 표현 추출 — 학생이 패들렛에 쓴 카드 텍스트에서 학습할 만한
// 핵심 표현 1~3개를 뽑고 학생 모국어로 번역해 돌려준다.
//
// 입력: { text, fromLang, targetLang }
// 출력: { expressions: [{ text, translation }] }
//
// VOCAB_WORDS 매칭(vocab-extract)과 달리 자유 텍스트에서 어구 단위로 뽑는다.

import { NextRequest, NextResponse } from "next/server";
import { withGroqKeyFallback } from "@/lib/groq-client";

// llama-3.3-70b 는 2026-08-16 decommission 예정이라 제외.
// qwen3.6-27b 는 <think> 추론 유출로 제외.
const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

const LANG_NAME: Record<string, string> = {
  ko: "Korean", en: "English", vi: "Vietnamese", zh: "Chinese", fil: "Filipino",
  ja: "Japanese", th: "Thai", km: "Khmer", mn: "Mongolian", ru: "Russian",
  uz: "Uzbek", hi: "Hindi", id: "Indonesian", ar: "Arabic", my: "Burmese",
};

interface ExtractedExpression {
  text: string;
  translation: string;
}

interface ExtractResponse {
  expressions: ExtractedExpression[];
  fallback?: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  let body: { text?: string; fromLang?: string; targetLang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ExtractResponse>({ expressions: [], error: "bad json" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  const fromLang = body.fromLang || "ko";
  const targetLang = body.targetLang || "en";

  if (!text || text.length < 2) {
    return NextResponse.json<ExtractResponse>({ expressions: [] });
  }
  // 너무 짧은 문장은 그 자체가 한 표현
  if (text.length <= 8) {
    return NextResponse.json<ExtractResponse>({ expressions: [{ text, translation: "" }] });
  }

  const fromName = LANG_NAME[fromLang] || "Korean";
  const targetName = LANG_NAME[targetLang] || "English";

  const system = `You extract 1 to 3 short, useful learning expressions from a multicultural elementary school student's writing.

Rules:
- Each "expression" is a short phrase or clause (2-12 ${fromName} syllables/words), worth memorizing.
- Prefer concrete idioms, situational phrases, useful verbs+objects. Avoid single common particles.
- Avoid proper nouns and full sentences that wouldn't generalize.
- Provide a natural ${targetName} translation for each.
- Output STRICT JSON only:
  {"expressions":[{"text":"...","translation":"..."}, ...]}
- Maximum 3 items. If nothing learning-worthy, return {"expressions":[]}.`;

  const user = `Source text (${fromName}):
"""
${text.slice(0, 600)}
"""

Target translation language: ${targetName}.
Return JSON only, no explanation.`;

  try {
    const result = await withGroqKeyFallback(async (client) => {
      let lastErr: unknown = null;
      for (const model of GROQ_MODELS) {
        try {
          const completion = await client.chat.completions.create({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.3,
            max_tokens: 320,
            response_format: { type: "json_object" },
          });
          const raw = completion.choices[0]?.message?.content?.trim() || "";
          if (!raw) { lastErr = new Error(`empty from ${model}`); continue; }
          const parsed = safeParse(raw);
          if (!parsed) { lastErr = new Error(`bad json from ${model}`); continue; }
          return parsed;
        } catch (err) {
          lastErr = err;
          const status = (err as { status?: number })?.status ?? 0;
          if (status === 400 || status === 404) continue;
          throw err;
        }
      }
      throw lastErr ?? new Error("all models exhausted");
    });
    return NextResponse.json<ExtractResponse>(result);
  } catch (err) {
    console.error("[expression-extract] failed", err);
    return NextResponse.json<ExtractResponse>({
      expressions: [],
      fallback: true,
      error: (err as Error)?.message || "failed",
    });
  }
}

function safeParse(raw: string): { expressions: ExtractedExpression[] } | null {
  try {
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.expressions)) return null;
    const out: ExtractedExpression[] = [];
    for (const x of j.expressions) {
      if (!x || typeof x !== "object") continue;
      const t = typeof x.text === "string" ? x.text.trim() : "";
      const tr = typeof x.translation === "string" ? x.translation.trim() : "";
      if (t.length < 2 || t.length > 80) continue;
      out.push({ text: t, translation: tr });
      if (out.length >= 3) break;
    }
    return { expressions: out };
  } catch {
    return null;
  }
}

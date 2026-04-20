import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { LANGUAGES } from "@/lib/constants";
import { TranslateRequest } from "@/lib/types";
import { withGroqKeyFallback } from "@/lib/groq-client";
import {
  validateTranslation, cleanTranslation, batchValidity,
} from "@/lib/translation-quality";

// 번역 + 안전 검사용 모델 체인 (translate-route 전용 — JSON mode 지원 필수)
const TRANSLATE_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

interface TranslateResult {
  translations: Record<string, string>;
  safe: boolean;
  reason: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: TranslateRequest = await req.json();
    const {
      text,
      fromLang,
      targetLangs,
      colId,
      authorName,
      isTeacher,
      paletteIdx,
      roomCode = "0000",
      cardType = "text",
      imageUrl,
      youtubeId,
      status,
      authorClientId,
    } = body;

    if (!fromLang || (!colId && cardType !== "comment")) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }
    if (cardType === "text" && !text) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    let translations: Record<string, string> = { [fromLang]: text };
    let safe = true;
    let reason = "";

    if ((cardType === "text" || cardType === "comment") && targetLangs && targetLangs.length > 0) {
      const result = await translateWithFallback({
        text,
        fromLang,
        targetLangs,
      });
      translations = { [fromLang]: text, ...result.translations };
      safe = result.safe;
      reason = result.reason;
    }

    if (cardType === "comment") {
      return NextResponse.json({ translations, safe, reason });
    }

    const db = getAdminDb();
    const cardRef = db.ref(`rooms/${roomCode}/cards`).push();
    const cardId = cardRef.key!;

    const cardData = {
      id: cardId,
      colId,
      cardType,
      authorLang: fromLang,
      authorName,
      isTeacher,
      originalText: text || "",
      translations,
      paletteIdx,
      timestamp: Date.now(),
      flagged: !safe,
      flagReason: reason,
      loading: false,
      ...(imageUrl ? { imageUrl } : {}),
      ...(youtubeId ? { youtubeId } : {}),
      ...(status ? { status } : {}),
      ...(authorClientId ? { authorClientId } : {}),
    };

    await cardRef.set(cardData);

    return NextResponse.json({ id: cardId, translations, safe, reason });
  } catch (err) {
    console.error("번역 API 오류:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}

/**
 * 번역 + 안전 검사 — 모델 체인 폴백 + JSON mode + 검증.
 */
async function translateWithFallback(params: {
  text: string;
  fromLang: string;
  targetLangs: string[];
}): Promise<TranslateResult> {
  const { text, fromLang, targetLangs } = params;

  const systemMsg = `You are a translation and safety assistant for a Korean multicultural elementary classroom.
Rules for translation:
- Translate faithfully. Preserve meaning, tone, and length.
- Do NOT add explanations, notes, disclaimers, or prefixes like "Here is the translation".
- Do NOT wrap output in quotes or markdown.
- Preserve proper nouns and numbers exactly.
- If the input is already in a target language, copy it verbatim.

Rules for safety check:
- safe=false ONLY for: violence, profanity, bullying, hate speech, sexual content.
- Normal elementary-school topics (academics, friends, food, feelings) are always safe.
- reason: brief Korean phrase explaining the flag, or "" if safe.`;

  const targetList = targetLangs.map((l) => `${LANGUAGES[l]?.name ?? l} (key: "${l}")`).join(", ");
  const emptyShape = targetLangs.map((l) => `"${l}": ""`).join(", ");

  const userMsg = `Input text (${LANGUAGES[fromLang]?.name ?? fromLang}): "${text}"

Translate into: ${targetList}

Respond with exactly this JSON shape (no extra keys, no markdown):
{"translations": {${emptyShape}}, "safe": true, "reason": ""}`;

  return withGroqKeyFallback(async (groq) => {
    let best: { result: TranslateResult; rate: number } | null = null;

    for (const model of TRANSLATE_MODELS) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          max_tokens: 1000,
          temperature: 0.1,
          response_format: { type: "json_object" as const },
        });

        const raw = (completion.choices[0]?.message?.content || "{}").trim();
        const parsed = safeParseResult(raw, targetLangs);
        if (!parsed) continue;

        // 각 번역 cleanup + validate
        const cleanedTranslations: Record<string, string> = {};
        const origArr: string[] = [];
        const trArr: string[] = [];
        for (const lang of targetLangs) {
          const src = lang === fromLang ? text : text;
          let tr = cleanTranslation(parsed.translations[lang] ?? "");
          // 같은 언어 → 원문 그대로 허용
          const allowSame = lang === fromLang;
          const check = validateTranslation(src, tr, { allowSameAsSource: allowSame });
          if (!check.valid) {
            console.warn(`[translate] ${model} / ${lang} invalid (${check.reason}) → 원본 유지`);
            tr = text; // 원문으로 폴백
          }
          cleanedTranslations[lang] = tr;
          origArr.push(text);
          trArr.push(tr);
        }

        const { validRate } = batchValidity(origArr, trArr);
        const result: TranslateResult = {
          translations: cleanedTranslations,
          safe: parsed.safe,
          reason: parsed.reason,
        };

        if (validRate >= 0.8) return result;

        console.warn(`[translate] ${model} validity ${Math.round(validRate * 100)}% — trying next`);
        if (!best || validRate > best.rate) best = { result, rate: validRate };
      } catch (err) {
        if (shouldSkipModel(err)) continue;
        throw err;
      }
    }

    if (best) return best.result;

    // 완전 실패 — 원문으로 모두 채움
    const fallbackTr: Record<string, string> = {};
    for (const lang of targetLangs) fallbackTr[lang] = text;
    return { translations: fallbackTr, safe: true, reason: "" };
  });
}

function shouldSkipModel(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") {
    return status === 429 || status === 404 || status === 400;
  }
  const msg = String((err as Error)?.message ?? "").toLowerCase();
  return msg.includes("rate") || msg.includes("not found") || msg.includes("not supported");
}

function safeParseResult(
  raw: string,
  targetLangs: string[],
): { translations: Record<string, string>; safe: boolean; reason: string } | null {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const json = JSON.parse(cleaned);
    if (!json || typeof json !== "object") return null;
    const translations = (json as Record<string, unknown>).translations;
    if (!translations || typeof translations !== "object") return null;

    // 모든 target lang 키가 있는지 확인 — 없는 건 빈 문자열로
    const out: Record<string, string> = {};
    for (const lang of targetLangs) {
      const v = (translations as Record<string, unknown>)[lang];
      out[lang] = typeof v === "string" ? v : "";
    }
    return {
      translations: out,
      safe: typeof (json as Record<string, unknown>).safe === "boolean"
        ? (json as Record<string, boolean>).safe
        : true,
      reason: typeof (json as Record<string, unknown>).reason === "string"
        ? (json as Record<string, string>).reason
        : "",
    };
  } catch {
    return null;
  }
}

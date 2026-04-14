import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAdminDb } from "@/lib/firebase-admin";
import { LANGUAGES } from "@/lib/constants";
import { TranslateRequest } from "@/lib/types";

// Grok API는 OpenAI 호환 클라이언트로 사용 가능
const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export async function POST(req: NextRequest) {
  try {
    const body: TranslateRequest = await req.json();
    const { text, fromLang, targetLangs, colId, authorName, isTeacher, paletteIdx } = body;

    if (!text || !fromLang || !colId) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    // ── 1. Grok API: 번역 + 유해 콘텐츠 필터링 ──────────────
    let translations: Record<string, string> = { [fromLang]: text };
    let safe = true;
    let reason = "";

    if (targetLangs && targetLangs.length > 0) {
      const prompt = `You are a translation and content safety assistant for a multicultural elementary classroom in Korea.

Input text (${LANGUAGES[fromLang]?.name}): "${text}"

Tasks:
1. Translate into: ${targetLangs.map((l) => `${LANGUAGES[l]?.name} (key: "${l}")`).join(", ")}
2. Safety check for elementary school (flag if: violence, profanity, bullying, hate speech, sexual content)

Respond ONLY with raw JSON (no markdown, no explanation):
{"translations":{${targetLangs.map((l) => `"${l}":""`).join(",")}},"safe":true,"reason":""}`;

      const completion = await grok.chat.completions.create({
        model: "grok-3-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      });

      const raw = (completion.choices[0]?.message?.content || "{}")
        .replace(/```json|```/g, "")
        .trim();

      try {
        const parsed = JSON.parse(raw);
        translations = { [fromLang]: text, ...parsed.translations };
        safe = parsed.safe ?? true;
        reason = parsed.reason ?? "";
      } catch {
        // JSON 파싱 실패 시 원문만 저장
        console.error("Grok 응답 파싱 실패:", raw);
      }
    }

    // ── 2. Firebase Admin: Realtime DB에 카드 저장 ───────────
    const db = getAdminDb();
    const cardRef = db.ref("cards").push();
    const cardId = cardRef.key!;

    const cardData = {
      id: cardId,
      colId,
      authorLang: fromLang,
      authorName,
      isTeacher,
      originalText: text,
      translations,
      paletteIdx,
      timestamp: Date.now(),
      flagged: !safe,
      flagReason: reason,
      loading: false,
    };

    await cardRef.set(cardData);

    return NextResponse.json({
      id: cardId,
      translations,
      safe,
      reason,
    });
  } catch (err) {
    console.error("번역 API 오류:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

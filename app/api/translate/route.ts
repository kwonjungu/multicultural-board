import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { LANGUAGES } from "@/lib/constants";
import { TranslateRequest } from "@/lib/types";
import { withGroqKeyFallback } from "@/lib/groq-client";

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

    // ── 1. 번역 + 안전 검사 (텍스트 카드만) ─────────────────────
    let translations: Record<string, string> = { [fromLang]: text };
    let safe = true;
    let reason = "";

    if ((cardType === "text" || cardType === "comment") && targetLangs && targetLangs.length > 0) {
      const prompt = `You are a translation and content safety assistant for a multicultural elementary classroom in Korea.

Input text (${LANGUAGES[fromLang]?.name}): "${text}"

Tasks:
1. Translate into: ${targetLangs.map((l) => `${LANGUAGES[l]?.name} (key: "${l}")`).join(", ")}
2. Safety check for elementary school (flag if: violence, profanity, bullying, hate speech, sexual content)

Respond ONLY with raw JSON (no markdown, no explanation):
{"translations":{${targetLangs.map((l) => `"${l}":""`).join(",")}},"safe":true,"reason":""}`;

      const completion = await withGroqKeyFallback((groq) =>
        groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 800,
          temperature: 0.3,
        })
      );

      const raw = (completion.choices[0]?.message?.content || "{}")
        .replace(/```json|```/g, "")
        .trim();

      try {
        const parsed = JSON.parse(raw);
        translations = { [fromLang]: text, ...parsed.translations };
        safe = parsed.safe ?? true;
        reason = parsed.reason ?? "";
      } catch {
        console.error("LLaMA 응답 파싱 실패:", raw);
      }
    }

    // ── 2. comment 타입은 번역 결과만 반환 (Firebase 저장 없음) ──
    if (cardType === "comment") {
      return NextResponse.json({ translations, safe, reason });
    }

    // ── 3. Firebase: rooms/${roomCode}/cards 에 저장 ─────────
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

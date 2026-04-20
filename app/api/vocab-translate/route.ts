import { NextRequest, NextResponse } from "next/server";
import { translateBatch } from "@/lib/groq-translate";
import { LANGUAGES } from "@/lib/constants";

interface TranslateItem {
  key: string;       // 클라이언트가 알아볼 id (word / s0 / s1 / sit0 …)
  text: string;      // 한국어 원문
}

interface VocabTranslateRequest {
  items: TranslateItem[];
  targetLang: string;
}

interface VocabTranslateResponse {
  translations: Record<string, string>;  // key → 번역된 텍스트
  targetLang: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: VocabTranslateRequest = await req.json();
    const { items, targetLang } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items empty" }, { status: 400 });
    }
    if (!targetLang || !LANGUAGES[targetLang]) {
      return NextResponse.json({ error: "invalid targetLang" }, { status: 400 });
    }

    // 한국어 대상 번역은 원문 그대로 반환 (no-op)
    if (targetLang === "ko") {
      const map: Record<string, string> = {};
      for (const it of items) map[it.key] = it.text;
      return NextResponse.json<VocabTranslateResponse>({ translations: map, targetLang });
    }

    const texts = items.map((it) => it.text);
    const fromName = LANGUAGES.ko.name;          // Korean
    const toName = LANGUAGES[targetLang].name;

    let translated: string[];
    try {
      translated = await translateBatch(texts, "ko", targetLang, fromName, toName);
    } catch (err) {
      console.warn("[vocab-translate] 번역 실패, 원문 반환", err);
      translated = texts;
    }

    const map: Record<string, string> = {};
    items.forEach((it, i) => { map[it.key] = translated[i] ?? it.text; });
    return NextResponse.json<VocabTranslateResponse>({ translations: map, targetLang });
  } catch (err) {
    console.error("[vocab-translate] 오류", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

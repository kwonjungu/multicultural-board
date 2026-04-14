import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

function getGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "placeholder",
    baseURL: "https://api.groq.com/openai/v1",
  });
}

// BCP-47 → Whisper ISO-639-1 hints (subset covering LANGUAGES)
const WHISPER_LANG: Record<string, string> = {
  ko: "ko", en: "en", vi: "vi", zh: "zh", fil: "tl",
  ja: "ja", th: "th", km: "km", mn: "mn", ru: "ru",
  uz: "uz", hi: "hi", id: "id", ar: "ar", my: "my",
};

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;
    const lang  = (formData.get("lang") as string) || "";

    if (!audio) {
      return NextResponse.json({ error: "오디오가 없습니다" }, { status: 400 });
    }

    // Reject clips larger than ~25MB (Groq limit)
    if (audio.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "오디오가 너무 큽니다 (최대 25MB)" }, { status: 413 });
    }

    const groq = getGroqClient();
    const hint = WHISPER_LANG[lang];

    // Groq whisper-large-v3 accepts File directly
    const transcription = await groq.audio.transcriptions.create({
      file: audio,
      model: "whisper-large-v3",
      response_format: "json",
      temperature: 0,
      ...(hint ? { language: hint } : {}),
    });

    const text = (transcription.text || "").trim();
    return NextResponse.json({ text });
  } catch (err) {
    console.error("STT API 오류:", err);
    const msg = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

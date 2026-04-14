import { NextRequest, NextResponse } from "next/server";

// Google Translate TTS BCP-47 → Google lang code mapping
const GTTS_LANG: Record<string, string> = {
  ko: "ko", en: "en", vi: "vi", zh: "zh-CN", fil: "tl",
  ja: "ja", th: "th", km: "km", mn: "mn", ru: "ru",
  uz: "uz", hi: "hi", id: "id", ar: "ar", my: "my",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text  = (searchParams.get("text") || "").slice(0, 200); // Google TTS limit
  const lang  = searchParams.get("lang") || "en";

  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });

  const gtLang = GTTS_LANG[lang] || lang;
  const ttsUrl =
    `https://translate.google.com/translate_tts` +
    `?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${gtLang}&client=tw-ob&ttsspeed=0.9`;

  try {
    const res = await fetch(ttsUrl, {
      headers: {
        // Mimic a browser request so Google doesn't reject it
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/",
      },
    });

    if (!res.ok) throw new Error(`Google TTS ${res.status}`);

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "TTS unavailable" }, { status: 503 });
  }
}

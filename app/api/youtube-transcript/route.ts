import { NextRequest, NextResponse } from "next/server";
import { LANGUAGES } from "@/lib/constants";
import { translateLongText } from "@/lib/groq-translate";
import { clipTranscript, fetchYoutubeTranscript } from "@/lib/youtube-transcript";

export const runtime = "nodejs";
export const maxDuration = 60;

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * POST /api/youtube-transcript { videoId, targetLang }
 *
 * 1. 자막 트랙 가져오기 (ko 우선 → en/자동생성 → 없으면 404)
 * 2. 앞부분 위주로 3000자 내로 자르기
 * 3. 기존 번역 파이프라인(translateLongText)으로 targetLang 번역
 *
 * 응답: { transcript, translated, sourceLang, auto } / 실패 시 { error }
 *   - error "NO_CAPTIONS" (404): 자막이 없는 영상
 */
export async function POST(req: NextRequest) {
  let videoId = "";
  let targetLang = "";
  try {
    const body = (await req.json()) as { videoId?: unknown; targetLang?: unknown };
    videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
    targetLang = typeof body.targetLang === "string" ? body.targetLang.trim() : "";
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  if (!VIDEO_ID_RE.test(videoId) || !LANGUAGES[targetLang]) {
    return NextResponse.json({ error: "INVALID_PARAMS" }, { status: 400 });
  }

  try {
    const result = await fetchYoutubeTranscript(videoId);
    if (!result) {
      return NextResponse.json({ error: "NO_CAPTIONS" }, { status: 404 });
    }

    const transcript = clipTranscript(result.text, 3000);
    const sourcePrefix = result.languageCode.toLowerCase().split("-")[0];

    let translated = transcript;
    if (sourcePrefix !== targetLang) {
      const fromName = LANGUAGES[sourcePrefix]?.name ?? result.languageCode;
      const toName = LANGUAGES[targetLang].name;
      translated = await translateLongText(transcript, fromName, toName);
    }

    return NextResponse.json({
      transcript,
      translated,
      sourceLang: result.languageCode,
      auto: result.auto,
    });
  } catch (err) {
    console.error("[youtube-transcript] 오류:", err);
    return NextResponse.json({ error: "TRANSCRIPT_FAILED" }, { status: 500 });
  }
}

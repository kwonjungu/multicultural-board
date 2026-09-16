import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { getAdminApp } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";

// Google Translate TTS BCP-47 → Google lang code mapping
const GTTS_LANG: Record<string, string> = {
  ko: "ko", en: "en", vi: "vi", zh: "zh-CN", fil: "tl",
  ja: "ja", th: "th", km: "km", mn: "mn", ru: "ru",
  uz: "uz", hi: "hi", id: "id", ar: "ar", my: "my",
};

// 캐시 오브젝트 경로. 같은 문장 + 같은 언어면 Google 이 만드는 오디오도
// 항상 같다(이 API 에는 목소리 파라미터가 없다) — 그래서 텍스트+언어를
// 그대로 키로 쓸 수 있다(콘텐츠 주소).
function cacheObjectPath(text: string, lang: string): string {
  const key = createHash("sha1").update(`${text}|${lang}`).digest("hex");
  return `tts/${key}.mp3`;
}

// upload/route.ts 와 같은 Admin SDK 패턴 — 재사용.
// 환경변수가 없거나 Admin 초기화가 실패하면 여기서 던진다. 호출부가 모두
// try/catch 로 감싸므로, 이 함수가 던져도 아이에게는 영향이 없고 그냥
// 예전처럼 프록시 경로로 넘어간다.
function getBucket() {
  const bucketEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketEnv) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 미설정");
  const app = getAdminApp();
  return getStorage(app).bucket(bucketEnv);
}

// 캐시에 이미 있으면 다운로드 토큰 URL을, 없으면(또는 뭔가 잘못되면) null 을
// 돌려준다. null 이면 호출부는 그냥 오늘처럼 Google 에서 새로 받는다.
async function getCachedUrl(objectPath: string): Promise<string | null> {
  const bucket = getBucket();
  const file = bucket.file(objectPath);
  const [metadata] = await file.getMetadata(); // 없으면 404 로 던진다 → 캐시 미스
  const token = (metadata?.metadata as Record<string, string> | undefined)
    ?.firebaseStorageDownloadTokens;
  if (!token) return null; // 토큰 없이 만들어진 예전 오브젝트 — 새로 만든다
  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
    `/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
  );
}

// Google 에서 막 받은 오디오를 교실 캐시에 올린다. 호출부가 절대 await 하지
// 않는다 — 실패해도(권한, 네트워크, 용량) 지금 아이가 듣는 소리에는 영향이
// 없고, 다음 아이가 다시 Google 을 한 번 더 타는 것으로 그친다.
async function saveToCache(objectPath: string, buf: ArrayBuffer): Promise<void> {
  const bucket = getBucket();
  const token = randomUUID();
  await bucket.file(objectPath).save(Buffer.from(buf), {
    contentType: "audio/mpeg",
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text  = (searchParams.get("text") || "").slice(0, 200); // Google TTS limit
  const lang  = searchParams.get("lang") || "en";

  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });

  const objectPath = cacheObjectPath(text, lang);

  // ── 1) 교실 캐시 확인 ──────────────────────────────────────────────
  // 여기서 나는 어떤 예외도(환경변수 없음, 권한 오류, Storage 장애) 아래
  // 프록시 경로로 그냥 넘어가게 둔다 — Storage 사정이 아이의 "듣기" 를
  // 막으면 안 된다는 게 이 기능의 하드 요구사항이다. 오브젝트가 아직
  // 없는 정상적인 캐시 미스(404)는 조용히 넘어가고, 그 외의 진짜 오류만
  // 로그를 남긴다.
  try {
    const cachedUrl = await getCachedUrl(objectPath);
    if (cachedUrl) return NextResponse.redirect(cachedUrl, 302);
  } catch (err) {
    const code = (err as { code?: number } | null)?.code;
    if (code !== 404) console.warn("TTS 캐시 조회 실패 — 프록시로 진행:", err);
  }

  // ── 2) 캐시 미스(또는 캐시 확인 자체가 실패) → 오늘까지 하던 대로 ──
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

    // 다음 학생을 위해 교실 캐시에 올린다 — fire-and-forget. await 하지
    // 않으므로 이 요청의 응답 시간에는 전혀 영향이 없다.
    saveToCache(objectPath, buf).catch((err) =>
      console.warn("TTS 캐시 저장 실패(다음 학생은 다시 Google 을 탄다):", err)
    );

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "audio/mpeg",
        // text+lang 로 콘텐츠 주소가 되므로 영구 캐시가 안전하다.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "TTS unavailable" }, { status: 503 });
  }
}

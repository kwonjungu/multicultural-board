import { NextRequest, NextResponse } from "next/server";
import { generateImage, verifyCharacterMatch, GeminiImageError, GeminiImageFailReason } from "@/lib/gemini";
import { getAdminApp } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { createHash, randomUUID } from "crypto";
import { removeLightBackground } from "@/lib/image-bg-removal";

// Nano Banana image calls take 10-30s each. Run up to 60s budget.
export const maxDuration = 60;

interface ImageAgentRequest {
  bookId: string;         // Firebase-side key where the book lives
  pageIdx?: number;       // 0 = cover, 1+ = regular pages (use when characterId is absent)
  characterId?: string;   // If set, this is a character portrait (clean bg, subject only)
  prompt: string;         // English art-style prompt
  styleReferenceUrl?: string;  // Optional: previous page to keep style consistent (future)
  /** [캐릭터 통일성] 캐릭터 초상 URL — 서버가 내려받아 참조 이미지로 첨부 (최대 3) */
  referenceUrls?: string[];
  /** true 면 캐시를 무시하고 새로 생성 (미리보기 "다시 그리기" 용) */
  force?: boolean;
}

interface ImageAgentResponse {
  ok: boolean;
  url?: string;
  error?: string;
  /** 구조화된 실패 사유 — lib/gemini.ts GeminiImageFailReason */
  reason?: GeminiImageFailReason | "upload";
  /** false 면 같은 요청을 다시 보내도 소용없다 (클라이언트는 즉시 폴백) */
  retryable?: boolean;
  /** 같은 프롬프트 캐시에서 재사용된 경우 true */
  cached?: boolean;
}

// ── 프롬프트 단위 캐시 + 동시요청 병합 ─────────────────────────
// 같은 (bookId, 대상, 프롬프트) 요청은 warm 인스턴스에서 재생성하지 않고
// 직전에 업로드한 URL 을 재사용한다. 학생 여러 명이 동시에 같은 캐릭터의
// 아바타 self-heal 을 트리거해도 Nano Banana 호출은 1회로 병합된다.
const CACHE_TTL_MS = 10 * 60_000;
const urlCache = new Map<string, { url: string; at: number }>();
const inflight = new Map<string, Promise<string>>();

function cacheKey(bookId: string, target: string, prompt: string, refs: string[]): string {
  return createHash("sha1").update(`${bookId}|${target}|${prompt}|${refs.join(",")}`).digest("hex");
}

function statusForReason(reason: GeminiImageFailReason | "upload"): number {
  switch (reason) {
    case "rate_limited": return 429;
    case "timeout": return 504;
    case "blocked": return 422;
    case "server":
    case "no_image": return 502;
    default: return 500; // config / auth / upload / unknown
  }
}

export async function POST(req: NextRequest) {
  let body: ImageAgentRequest;
  try {
    body = await req.json() as ImageAgentRequest;
  } catch {
    return NextResponse.json<ImageAgentResponse>({ ok: false, error: "bad json", retryable: false }, { status: 400 });
  }

  // Either pageIdx (non-negative) or characterId must be provided.
  const hasPage = body?.pageIdx != null && body.pageIdx >= 0;
  const hasChar = !!body?.characterId;
  if (!body?.bookId || !body?.prompt || (!hasPage && !hasChar)) {
    return NextResponse.json<ImageAgentResponse>({ ok: false, error: "missing bookId/target/prompt", retryable: false }, { status: 400 });
  }

  const bucketEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketEnv) {
    return NextResponse.json<ImageAgentResponse>({
      ok: false,
      error: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not set",
      reason: "config",
      retryable: false,
    }, { status: 500 });
  }

  const target = hasChar ? `c:${body.characterId}` : `p:${body.pageIdx}`;
  const refs = (body.referenceUrls ?? []).slice(0, 3);
  const key = cacheKey(body.bookId, target, body.prompt, refs);

  // 캐시 히트 — 같은 프롬프트로 방금 만든 이미지가 있으면 그대로 반환.
  if (!body.force) {
    const hit = urlCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json<ImageAgentResponse>({ ok: true, url: hit.url, cached: true });
    }
  }

  try {
    // 동시 요청 병합 — force 여부와 무관하게 진행 중인 동일 작업에는 합류한다.
    let work = inflight.get(key);
    if (!work) {
      work = generateAndUpload(body, hasChar, bucketEnv);
      inflight.set(key, work);
      work
        .then((url) => urlCache.set(key, { url, at: Date.now() }))
        .catch(() => { /* 실패는 아래 catch 에서 응답 처리 */ })
        .finally(() => inflight.delete(key));
    }
    const url = await work;
    return NextResponse.json<ImageAgentResponse>({ ok: true, url });
  } catch (err) {
    console.error("storybook-agent/image failed", err);
    if (err instanceof GeminiImageError) {
      return NextResponse.json<ImageAgentResponse>({
        ok: false,
        error: err.message,
        reason: err.reason,
        retryable: err.retryable,
      }, { status: statusForReason(err.reason) });
    }
    // Firebase 업로드 등 생성 이후 단계의 실패 — 재시도 가치 있음.
    return NextResponse.json<ImageAgentResponse>({
      ok: false,
      error: (err as Error).message,
      reason: "upload",
      retryable: true,
    }, { status: 500 });
  }
}

/** 참조 URL(자체 Firebase Storage)을 내려받아 base64 로. 실패한 것은 조용히 제외. */
async function fetchReferenceImages(
  urls: string[],
): Promise<Array<{ base64: string; mimeType: string }>> {
  const out: Array<{ base64: string; mimeType: string }> = [];
  for (const u of urls.slice(0, 3)) {
    try {
      const res = await fetch(u);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > 1.5 * 1024 * 1024) continue; // 1.5MB 가드 — 3장 base64 인라인 시 요청 크기 제한
      out.push({ base64: buf.toString("base64"), mimeType: res.headers.get("content-type") || "image/png" });
    } catch { /* skip */ }
  }
  return out;
}

async function generateAndUpload(
  body: ImageAgentRequest,
  hasChar: boolean,
  bucketEnv: string,
): Promise<string> {
  // === Generate ===
  // Reinforce child-book style in every prompt so page-to-page stays coherent.
  // Character portraits get an extra isolation guard so the subject is clean.
  const baseStyleGuard = "Soft watercolor children's picture book illustration. Warm, gentle palette. Cute cartoon characters. No scary, violent, or photorealistic imagery. No text in the image.";
  const portraitGuard = hasChar
    ? " The character alone on a clean solid pastel-cream background. No scene, no other characters, no props, no text, just the character centered."
    : "";
  const refs = await fetchReferenceImages(body.referenceUrls ?? []);
  // 참조가 있으면 "첨부된 캐릭터를 그대로" 를 최상단에 강제 — 문장 중간에 넣으면 무시됨.
  const refGuard = refs.length > 0
    ? "CHARACTER REFERENCE (STRICT): The attached image(s) show the exact character design(s) of this book. Redraw the SAME character(s) — identical species, body shape, colors, face, and clothing/accessories — placed into the scene described below. Do NOT invent a different-looking character.\n\n"
    : "";
  const fullPrompt = `${refGuard}${body.prompt}\n\nStyle: ${baseStyleGuard}${portraitGuard}`;

  // 재시도(백오프+키 폴백)는 generateImage 내부에서 처리 — 총 50s 예산.
  let img = await generateImage(fullPrompt, { referenceImages: refs });

  // [강력 고정] 참조 기반 페이지·표지는 캐릭터 일치를 비전으로 자기검증.
  // 불일치면 1회만 다시 그린다 (그 이상은 예산 초과 — 60s maxDuration).
  if (!hasChar && refs.length > 0) {
    const ok = await verifyCharacterMatch(refs[0], { base64: img.base64, mimeType: img.mimeType || "image/png" });
    if (!ok) {
      console.warn("character mismatch — regenerating once", body.bookId, body.pageIdx);
      try {
        img = await generateImage(fullPrompt, { referenceImages: refs, maxAttempts: 1 });
      } catch { /* 재생성 실패 시 원본 유지 */ }
    }
  }

  let buffer: Buffer = Buffer.from(img.base64, "base64");

  // === Character portrait post-processing ===
  // Flood-fill the cream/white background to transparent so the character
  // floats cleanly on any page color without a baked-in square.
  if (hasChar) {
    try {
      buffer = Buffer.from(await removeLightBackground(buffer));
    } catch (bgErr) {
      console.warn("removeLightBackground failed, using raw image", bgErr);
    }
  }

  // === Upload to Firebase Storage ===
  const token = randomUUID();
  const filename = hasChar
    ? `storybooks/${body.bookId}/char-${body.characterId}.png`
    : body.pageIdx === 0
      ? `storybooks/${body.bookId}/cover.png`
      : `storybooks/${body.bookId}/page-${body.pageIdx}.png`;

  const app = getAdminApp();
  const storage = getStorage(app);
  const bucket = storage.bucket(bucketEnv);

  const fileRef = bucket.file(filename);
  await fileRef.save(buffer, {
    contentType: img.mimeType || "image/png",
    metadata: {
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media&token=${token}`;
}

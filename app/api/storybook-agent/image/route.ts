import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/gemini";
import { getAdminApp } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";

// Nano Banana image calls take 10-30s each. Run up to 60s budget.
export const maxDuration = 60;

interface ImageAgentRequest {
  bookId: string;         // Firebase-side key where the book lives
  pageIdx: number;
  prompt: string;         // English art-style prompt
  styleReferenceUrl?: string;  // Optional: previous page to keep style consistent (future)
}

interface ImageAgentResponse {
  ok: boolean;
  url?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  let body: ImageAgentRequest;
  try {
    body = await req.json() as ImageAgentRequest;
  } catch {
    return NextResponse.json<ImageAgentResponse>({ ok: false, error: "bad json" }, { status: 400 });
  }

  if (!body?.bookId || !body?.pageIdx || !body?.prompt) {
    return NextResponse.json<ImageAgentResponse>({ ok: false, error: "missing bookId/pageIdx/prompt" }, { status: 400 });
  }

  const bucketEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketEnv) {
    return NextResponse.json<ImageAgentResponse>({
      ok: false,
      error: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not set",
    }, { status: 500 });
  }

  try {
    // === Generate ===
    // Reinforce child-book style in every prompt so page-to-page stays coherent.
    const styleGuard = "Soft watercolor children's picture book illustration. Warm, gentle palette. Cute cartoon characters. No scary, violent, or photorealistic imagery. No text in the image.";
    const fullPrompt = `${body.prompt}\n\nStyle: ${styleGuard}`;

    const img = await generateImage(fullPrompt);
    const buffer = Buffer.from(img.base64, "base64");

    // === Upload to Firebase Storage ===
    const token = randomUUID();
    const filename = `storybooks/${body.bookId}/page-${body.pageIdx}.png`;

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

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media&token=${token}`;

    return NextResponse.json<ImageAgentResponse>({ ok: true, url });
  } catch (err) {
    console.error("storybook-agent/image failed", err);
    return NextResponse.json<ImageAgentResponse>({
      ok: false,
      error: (err as Error).message,
    }, { status: 500 });
  }
}

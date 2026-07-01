import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";

// Firebase 키 규칙과 동일한 안전 변환 — lib/vocabRecordings.ts 의 encodeKey 와
// 반드시 일치해야 클라이언트가 계산한 storagePath 와 서버 저장 경로가 같아진다.
function encodeKey(s: string): string {
  return s.replace(/[.$#/\[\]]/g, "_");
}

// 경로 조각 정리 — 경로 탈출(../, 백슬래시) 방지
function sanitizeSegment(s: string): string {
  return encodeKey(s).replace(/\.\./g, "_").replace(/[\\/]/g, "_").slice(0, 120);
}

export async function POST(req: NextRequest) {
  try {
    // ── 환경변수 확인 ──
    const bucketEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketEnv) {
      console.error("Upload API: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 환경변수가 설정되지 않았습니다");
      return NextResponse.json({ error: "스토리지 설정 오류: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 환경변수를 Vercel에 추가해주세요" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const token = randomUUID();
    const kind = formData.get("kind");

    let filename: string;
    let contentType = file.type || "image/jpeg";

    if (kind === "vocab-recording") {
      // 발음 녹음 (VocabRecorder) — 클라이언트 Storage SDK 직접 업로드가
      // Storage 규칙/CORS 로 실패하던 경로를 Admin SDK 로 대체.
      // 같은 예문 재녹음은 같은 경로 덮어쓰기 (기존 정책 유지).
      const roomCode = sanitizeSegment(String(formData.get("roomCode") || ""));
      const clientId = sanitizeSegment(String(formData.get("clientId") || ""));
      const wordId = sanitizeSegment(String(formData.get("wordId") || ""));
      const sentenceIdx = Math.max(0, Math.floor(Number(formData.get("sentenceIdx")) || 0));
      if (!roomCode || !clientId || !wordId) {
        return NextResponse.json({ error: "녹음 경로 정보가 없습니다" }, { status: 400 });
      }
      filename = `vocab-recordings/${roomCode}/${clientId}/${wordId}_${sentenceIdx}.webm`;
      contentType = file.type || "audio/webm";
    } else {
      // 이미지 업로드 (기존 동작 유지)
      const ext = file.type === "image/png" ? "png" : "jpg";
      filename = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    }

    const app = getAdminApp();
    const storage = getStorage(app);
    const bucket = storage.bucket(bucketEnv);

    const fileRef = bucket.file(filename);
    await fileRef.save(buffer, {
      contentType,
      metadata: {
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media&token=${token}`;
    return NextResponse.json({ url, storagePath: filename });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Upload API 오류:", message);
    return NextResponse.json({ error: `업로드 실패: ${message}` }, { status: 500 });
  }
}

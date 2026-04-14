import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const token = randomUUID();
    const ext = file.type === "image/png" ? "png" : "jpg";
    const filename = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const app = getAdminApp();
    const storage = getStorage(app);
    const bucket = storage.bucket();

    const fileRef = bucket.file(filename);
    await fileRef.save(buffer, {
      contentType: file.type || "image/jpeg",
      metadata: {
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media&token=${token}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Upload API 오류:", err);
    return NextResponse.json({ error: "업로드 오류가 발생했습니다" }, { status: 500 });
  }
}

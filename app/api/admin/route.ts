import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "4321";

export async function POST(req: NextRequest) {
  try {
    const { action, password, roomCode, languages } = await req.json();

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "비밀번호가 틀렸습니다" }, { status: 401 });
    }

    const db = getAdminDb();

    if (action === "delete") {
      if (!roomCode || !/^\d{4}$/.test(roomCode)) {
        return NextResponse.json({ error: "올바른 방 번호가 아닙니다" }, { status: 400 });
      }
      await db.ref(`rooms/${roomCode}`).remove();
      return NextResponse.json({ success: true });
    }

    if (action === "create") {
      if (!roomCode || !/^\d{4}$/.test(roomCode)) {
        return NextResponse.json({ error: "올바른 방 번호가 아닙니다" }, { status: 400 });
      }
      await db.ref(`rooms/${roomCode}/meta`).set({
        created: Date.now(),
        active: true,
      });
      if (Array.isArray(languages) && languages.length > 0) {
        await db.ref(`rooms/${roomCode}/config/languages`).set(languages);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "알 수 없는 액션" }, { status: 400 });
  } catch (err) {
    console.error("Admin API 오류:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

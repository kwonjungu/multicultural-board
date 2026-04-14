"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ref, get } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { LANGUAGES } from "@/lib/constants";
import SetupScreen from "@/components/SetupScreen";
import PadletBoard from "@/components/PadletBoard";
import { UserConfig } from "@/lib/types";

const ALL_LANGS = Object.keys(LANGUAGES);

export default function RoomPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const [user, setUser] = useState<UserConfig | null>(null);
  const [roomLangs, setRoomLangs] = useState<string[]>(ALL_LANGS);
  const [langsLoaded, setLangsLoaded] = useState(false);

  const validCode = /^\d{4}$/.test(roomCode);

  useEffect(() => {
    if (!validCode) { setLangsLoaded(true); return; }
    const db = getClientDb();
    get(ref(db, `rooms/${roomCode}/config/languages`))
      .then((snap) => {
        const val = snap.val();
        if (Array.isArray(val) && val.length > 0) setRoomLangs(val);
      })
      .catch(() => {/* fallback to all langs */})
      .finally(() => setLangsLoaded(true));
  }, [roomCode, validCode]);

  if (!validCode) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0d0b26, #1e1b4b)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Noto Sans KR', sans-serif", color: "#fff", gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <p style={{ fontSize: 18, fontWeight: 700 }}>잘못된 방 번호입니다</p>
        <a href="/" style={{ color: "#7C7AFF", fontSize: 14 }}>← 돌아가기</a>
      </div>
    );
  }

  // Brief loading while fetching room language config
  if (!langsLoaded) {
    return (
      <div style={{
        minHeight: "100vh", background: "linear-gradient(135deg, #0d0b26, #1e1b4b)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#7C7AFF",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    );
  }

  if (!user) {
    return <SetupScreen onDone={setUser} roomCode={roomCode} availableLangs={roomLangs} />;
  }

  return (
    <PadletBoard
      user={user}
      roomCode={roomCode}
      roomLangs={roomLangs}
      onLogout={() => setUser(null)}
    />
  );
}

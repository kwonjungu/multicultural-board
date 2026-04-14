"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import SetupScreen from "@/components/SetupScreen";
import PadletBoard from "@/components/PadletBoard";
import { UserConfig } from "@/lib/types";

export default function RoomPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const [user, setUser] = useState<UserConfig | null>(null);

  if (!/^\d{4}$/.test(roomCode)) {
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

  if (!user) {
    return <SetupScreen onDone={setUser} roomCode={roomCode} />;
  }

  return <PadletBoard user={user} roomCode={roomCode} onLogout={() => setUser(null)} />;
}

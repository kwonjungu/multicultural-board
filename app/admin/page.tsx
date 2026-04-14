"use client";

import { useState, useEffect } from "react";
import { ref, onValue, off } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { useRouter } from "next/navigation";

interface RoomInfo {
  code: string;
  cardCount: number;
  lastActivity: number | null;
  created: number | null;
}

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [newCode, setNewCode] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Connection status
  useEffect(() => {
    if (!authed) return;
    const db = getClientDb();
    const connRef = ref(db, ".info/connected");
    onValue(connRef, (snap) => setConnected(snap.val() === true));
    return () => off(connRef);
  }, [authed]);

  // Rooms list
  useEffect(() => {
    if (!authed) return;
    const db = getClientDb();
    const roomsRef = ref(db, "rooms");
    onValue(roomsRef, (snap) => {
      const data = snap.val();
      if (!data) { setRooms([]); return; }
      const list: RoomInfo[] = Object.entries(data).map(([code, val]: [string, unknown]) => {
        const roomData = val as Record<string, unknown>;
        const cards = roomData.cards as Record<string, { timestamp?: number }> | undefined;
        const cardCount = cards ? Object.keys(cards).length : 0;
        const timestamps = cards
          ? Object.values(cards).map((c) => c?.timestamp ?? 0).filter(Boolean)
          : [];
        const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : null;
        const meta = roomData.meta as { created?: number } | undefined;
        return { code, cardCount, lastActivity, created: meta?.created ?? null };
      });
      list.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
      setRooms(list);
    });
    return () => { off(roomsRef); };
  }, [authed]);

  function handleLogin() {
    if (pwInput === "4321") {
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  async function callApi(action: string, roomCode?: string) {
    const key = roomCode || action;
    setLoading(key);
    setMsg(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, password: "4321", roomCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ text: action === "delete" ? `방 ${roomCode} 삭제 완료` : `방 ${roomCode} 생성 완료`, ok: true });
      setNewCode("");
    } catch (e: unknown) {
      setMsg({ text: (e as Error).message || "오류 발생", ok: false });
    }
    setLoading(null);
  }

  function fmt(ts: number | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // ── Auth gate ──
  if (!authed) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0d0b26, #1e1b4b)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Noto Sans KR', sans-serif", padding: 20,
      }}>
        <div style={{
          background: "#fff", borderRadius: 24, padding: "40px 32px",
          maxWidth: 360, width: "100%",
          boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
          textAlign: "center", animation: "fadeSlideIn 0.3s ease",
        }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🔧</div>
          <h2 style={{ margin: "0 0 6px", fontWeight: 900, fontSize: 20, color: "#111827" }}>관리자 패널</h2>
          <p style={{ margin: "0 0 24px", fontSize: 13, color: "#9CA3AF" }}>관리자 비밀번호를 입력하세요</p>

          <input
            type="password"
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="비밀번호"
            maxLength={8}
            autoFocus
            style={{
              width: "100%", padding: "13px 16px", borderRadius: 12, marginBottom: 8,
              border: `2px solid ${pwError ? "#EF4444" : "#E5E7EB"}`,
              fontSize: 18, textAlign: "center", letterSpacing: 6,
              outline: "none", boxSizing: "border-box", fontWeight: 700,
            }}
          />
          {pwError && <p style={{ margin: "0 0 12px", fontSize: 12, color: "#EF4444" }}>비밀번호가 틀렸습니다</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => router.push("/")}
              style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "#F3F4F6", color: "#6B7280", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14 }}
            >← 돌아가기</button>
            <button
              onClick={handleLogin}
              style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "linear-gradient(135deg, #5B57F5, #8B5CF6)", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontSize: 14, boxShadow: "0 4px 16px rgba(91,87,245,0.4)" }}
            >로그인</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin panel ──
  return (
    <div style={{
      minHeight: "100vh", background: "#F0F2FA",
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      {/* Header */}
      <header style={{
        height: 58, background: "#0F0C28",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", padding: "0 24px", gap: 12,
      }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #5B57F5, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🔧</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#F9FAFB" }}>관리자 패널</div>
          <div style={{ fontSize: 10, color: "#6B7280" }}>다문화 교실 소통판</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {/* Connection status */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "6px 12px",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: connected === null ? "#F59E0B" : connected ? "#10B981" : "#EF4444",
              boxShadow: connected ? "0 0 0 2px rgba(16,185,129,0.3)" : "none",
            }} />
            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
              {connected === null ? "확인 중" : connected ? "Firebase 연결됨" : "연결 끊김"}
            </span>
          </div>
          <button
            onClick={() => router.push("/")}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", borderRadius: 10, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
          >← 나가기</button>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "전체 방", value: rooms.length, icon: "🚪" },
            { label: "전체 카드", value: rooms.reduce((s, r) => s + r.cardCount, 0), icon: "📋" },
            { label: "Firebase", value: connected ? "연결됨" : "확인 중", icon: "🔥" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "#fff", borderRadius: 14, padding: "18px 20px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #E9ECF5",
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontWeight: 900, fontSize: 22, color: "#111827" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Create room */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "20px 22px", marginBottom: 20,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #E9ECF5",
        }}>
          <h3 style={{ margin: "0 0 14px", fontWeight: 800, fontSize: 15, color: "#111827" }}>새 방 만들기</h3>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && newCode.length === 4 && callApi("create", newCode)}
              placeholder="방 번호 (4자리)"
              maxLength={4}
              style={{
                flex: 1, padding: "11px 16px", borderRadius: 12, border: "2px solid #E5E7EB",
                fontSize: 16, textAlign: "center", letterSpacing: 8, fontWeight: 700, outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#5B57F5")}
              onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            />
            <button
              onClick={() => newCode.length === 4 && callApi("create", newCode)}
              disabled={newCode.length !== 4 || loading === "create"}
              style={{
                padding: "11px 22px", borderRadius: 12, fontSize: 14,
                background: newCode.length === 4 ? "linear-gradient(135deg, #5B57F5, #8B5CF6)" : "#F3F4F6",
                color: newCode.length === 4 ? "#fff" : "#D1D5DB",
                fontWeight: 800, border: "none", cursor: newCode.length === 4 ? "pointer" : "not-allowed",
                boxShadow: newCode.length === 4 ? "0 4px 16px rgba(91,87,245,0.4)" : "none",
                whiteSpace: "nowrap",
              }}
            >
              {loading === "create" ? "생성 중..." : "+ 방 생성"}
            </button>
          </div>
          {msg && (
            <div style={{ marginTop: 10, fontSize: 13, color: msg.ok ? "#10B981" : "#EF4444", fontWeight: 600 }}>
              {msg.ok ? "✅" : "❌"} {msg.text}
            </div>
          )}
        </div>

        {/* Room list */}
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #E9ECF5", overflow: "hidden" }}>
          <div style={{ padding: "16px 22px 14px", borderBottom: "1px solid #F3F4F8" }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#111827" }}>방 목록 ({rooms.length})</h3>
          </div>

          {rooms.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#9CA3AF" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🚪</div>
              <div style={{ fontWeight: 600 }}>아직 생성된 방이 없습니다</div>
            </div>
          ) : (
            rooms.map((room, i) => (
              <div key={room.code} style={{
                display: "flex", alignItems: "center", padding: "14px 22px",
                borderBottom: i < rooms.length - 1 ? "1px solid #F3F4F8" : "none",
                transition: "background 0.15s",
              }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#FAFBFF")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 14, color: "#fff", marginRight: 14,
                  boxShadow: "0 4px 12px rgba(91,87,245,0.3)",
                }}>
                  {room.code}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                    Room {room.code}
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                    카드 {room.cardCount}개 · 생성 {fmt(room.created)} · 최근 {fmt(room.lastActivity)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => router.push(`/${room.code}`)}
                    style={{
                      padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                      background: "#EEF0FF", color: "#5B57F5", border: "none", cursor: "pointer",
                    }}
                  >
                    열기
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Room ${room.code}의 모든 데이터를 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) {
                        callApi("delete", room.code);
                      }
                    }}
                    disabled={loading === room.code}
                    style={{
                      padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                      background: "#FEF2F2", color: "#EF4444", border: "none",
                      cursor: loading === room.code ? "not-allowed" : "pointer",
                      opacity: loading === room.code ? 0.6 : 1,
                    }}
                  >
                    {loading === room.code ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <p style={{ textAlign: "center", color: "#D1D5DB", fontSize: 11, marginTop: 24 }}>
          관리자 패널 · 다문화 교실 소통판
        </p>
      </main>
    </div>
  );
}

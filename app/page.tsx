"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES } from "@/lib/constants";

const DEFAULT_LANGS = ["ko", "en", "vi", "zh", "fil"];

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"join" | "create">("join");

  // Join
  const [joinCode, setJoinCode] = useState("");

  // Create
  const [createCode, setCreateCode] = useState("");
  const [createLangs, setCreateLangs] = useState<string[]>(DEFAULT_LANGS);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function handleJoin() {
    const room = joinCode.replace(/\D/g, "").slice(0, 4);
    if (room.length === 4) router.push(`/${room}`);
  }

  async function handleCreate() {
    if (createCode.length !== 4 || creating) return;
    setCreating(true);
    setCreateMsg(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          password: "4321",
          roomCode: createCode,
          languages: createLangs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreateMsg({ text: `방 ${createCode} 생성 완료! 입장 중...`, ok: true });
      setTimeout(() => router.push(`/${createCode}`), 900);
    } catch (e: unknown) {
      setCreateMsg({ text: (e as Error).message || "오류 발생", ok: false });
    }
    setCreating(false);
  }

  function toggleLang(code: string) {
    setCreateLangs((prev) =>
      prev.includes(code)
        ? prev.length > 1 ? prev.filter((l) => l !== code) : prev
        : [...prev, code]
    );
  }

  const joinReady = joinCode.replace(/\D/g, "").length === 4;
  const createReady = createCode.length === 4 && createLangs.length > 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d0b26 0%, #1e1b4b 50%, #16133a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif", padding: 20,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "fixed", top: "-15%", right: "-8%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(91,87,245,0.18) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-15%", left: "-8%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{
        background: "#fff", borderRadius: 28, padding: "40px 36px 36px",
        maxWidth: "min(460px, 92vw)", width: "100%",
        boxShadow: "0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        animation: "fadeSlideIn 0.4s ease", position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 20, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, boxShadow: "0 10px 30px rgba(91,87,245,0.45)",
          }}>🌏</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827", letterSpacing: -0.5 }}>
            다문화 교실 소통판
          </h1>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: "flex", background: "#F3F4F6", borderRadius: 14,
          padding: 4, marginBottom: 28, gap: 4,
        }}>
          {([
            { key: "join",   label: "🚪 방 입장",   desc: "학생 · 교사" },
            { key: "create", label: "✨ 방 만들기",  desc: "선생님 전용" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setCreateMsg(null); }}
              style={{
                flex: 1, padding: "10px 8px", borderRadius: 11, border: "none",
                background: tab === t.key ? "#fff" : "transparent",
                boxShadow: tab === t.key ? "0 1px 6px rgba(0,0,0,0.1)" : "none",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, color: tab === t.key ? "#111827" : "#9CA3AF" }}>
                {t.label}
              </div>
              <div style={{ fontSize: 10, color: tab === t.key ? "#6B7280" : "#C4C4C4", marginTop: 1 }}>
                {t.desc}
              </div>
            </button>
          ))}
        </div>

        {/* ── Join tab ── */}
        {tab === "join" && (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1, textAlign: "center" }}>
              방 번호 ROOM CODE
            </p>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="0000"
              maxLength={4}
              autoFocus
              style={{
                width: "100%", padding: "18px 0", borderRadius: 16, marginBottom: 16,
                border: "2px solid #E5E7EB", fontSize: 36, fontWeight: 900,
                textAlign: "center", letterSpacing: 16, color: "#111827",
                background: "#F9FAFB", outline: "none", transition: "all 0.18s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#5B57F5";
                e.target.style.background = "#fff";
                e.target.style.boxShadow = "0 0 0 4px rgba(91,87,245,0.12)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E5E7EB";
                e.target.style.background = "#F9FAFB";
                e.target.style.boxShadow = "none";
              }}
            />
            <button
              onClick={handleJoin}
              disabled={!joinReady}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 15,
                background: joinReady ? "linear-gradient(135deg, #5B57F5, #8B5CF6)" : "#F3F4F6",
                color: joinReady ? "#fff" : "#D1D5DB",
                fontWeight: 800, border: "none",
                cursor: joinReady ? "pointer" : "not-allowed",
                boxShadow: joinReady ? "0 6px 24px rgba(91,87,245,0.4)" : "none",
                transition: "all 0.2s",
              }}
            >
              입장하기 →
            </button>
          </>
        )}

        {/* ── Create tab ── */}
        {tab === "create" && (
          <>
            {/* Room code */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
                방 번호 (4자리 숫자)
              </p>
              <input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => e.key === "Enter" && createReady && handleCreate()}
                placeholder="예: 1234"
                maxLength={4}
                autoFocus
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 14,
                  border: "2px solid #E5E7EB", fontSize: 28, fontWeight: 900,
                  textAlign: "center", letterSpacing: 12, color: "#111827",
                  background: "#F9FAFB", outline: "none", transition: "all 0.18s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#5B57F5";
                  e.target.style.background = "#fff";
                  e.target.style.boxShadow = "0 0 0 4px rgba(91,87,245,0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#E5E7EB";
                  e.target.style.background = "#F9FAFB";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Language picker */}
            <div style={{ marginBottom: 22 }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
                우리 반 언어 선택 ({createLangs.length}개)
              </p>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 7,
                maxHeight: 160, overflowY: "auto", padding: "2px 0",
              }}>
                {Object.entries(LANGUAGES).map(([code, info]) => {
                  const active = createLangs.includes(code);
                  return (
                    <button
                      key={code}
                      onClick={() => toggleLang(code)}
                      style={{
                        padding: "6px 12px", borderRadius: 20, fontSize: 12,
                        border: `1.5px solid ${active ? "#5B57F5" : "#E5E7EB"}`,
                        background: active ? "#EEEEFF" : "#F9FAFB",
                        color: active ? "#5B57F5" : "#6B7280",
                        fontWeight: active ? 700 : 400, cursor: "pointer",
                        transition: "all 0.12s", whiteSpace: "nowrap",
                      }}
                    >
                      {info.flag} {info.label}
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9CA3AF" }}>
                학생 입장 시 선택한 언어만 표시됩니다
              </p>
            </div>

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={!createReady || creating}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 15,
                background: createReady ? "linear-gradient(135deg, #5B57F5, #8B5CF6)" : "#F3F4F6",
                color: createReady ? "#fff" : "#D1D5DB",
                fontWeight: 800, border: "none",
                cursor: createReady ? "pointer" : "not-allowed",
                boxShadow: createReady ? "0 6px 24px rgba(91,87,245,0.4)" : "none",
                transition: "all 0.2s",
              }}
            >
              {creating ? "⟳ 생성 중..." : "방 만들기 →"}
            </button>

            {createMsg && (
              <div style={{
                marginTop: 12, fontSize: 13, fontWeight: 600, textAlign: "center",
                color: createMsg.ok ? "#10B981" : "#EF4444",
              }}>
                {createMsg.ok ? "✅" : "❌"} {createMsg.text}
              </div>
            )}
          </>
        )}

        {/* Admin link */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            onClick={() => router.push("/admin")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "#C4C4C4", fontWeight: 500,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#C4C4C4")}
          >
            🔧 관리자 패널
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [code, setCode] = useState("");
  const router = useRouter();

  function join() {
    const room = code.replace(/\D/g, "").slice(0, 4);
    if (room.length === 4) router.push(`/${room}`);
  }

  const ready = code.replace(/\D/g, "").length === 4;

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
        background: "#fff", borderRadius: 28, padding: "48px 40px 40px",
        maxWidth: 420, width: "100%",
        boxShadow: "0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        animation: "fadeSlideIn 0.4s ease", position: "relative", zIndex: 1,
        textAlign: "center",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22, margin: "0 auto 20px",
          background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 34, boxShadow: "0 10px 30px rgba(91,87,245,0.45)",
        }}>🌏</div>

        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#111827", letterSpacing: -0.5 }}>
          다문화 교실 소통판
        </h1>
        <p style={{ margin: "0 0 32px", fontSize: 13, color: "#9CA3AF", fontWeight: 400 }}>
          방 번호를 입력해 입장하세요
        </p>

        {/* Room code input */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
            방 번호 ROOM CODE
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="0000"
            maxLength={4}
            style={{
              width: "100%", padding: "18px 0", borderRadius: 16,
              border: "2px solid #E5E7EB", fontSize: 36, fontWeight: 900,
              textAlign: "center", letterSpacing: 16, color: "#111827",
              background: "#F9FAFB", outline: "none", transition: "all 0.18s",
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

        <button
          onClick={join}
          disabled={!ready}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 15,
            background: ready ? "linear-gradient(135deg, #5B57F5, #8B5CF6)" : "#F3F4F6",
            color: ready ? "#fff" : "#D1D5DB",
            fontWeight: 800, border: "none",
            cursor: ready ? "pointer" : "not-allowed",
            boxShadow: ready ? "0 6px 24px rgba(91,87,245,0.4)" : "none",
            transition: "all 0.2s", marginBottom: 24,
          }}
        >
          입장하기 →
        </button>

        <button
          onClick={() => router.push("/admin")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "#9CA3AF", fontWeight: 500,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#6B7280")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF")}
        >
          🔧 관리자 패널
        </button>
      </div>
    </div>
  );
}

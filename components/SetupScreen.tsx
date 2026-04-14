"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { UserConfig } from "@/lib/types";
import { t } from "@/lib/i18n";

interface Props {
  onDone: (config: UserConfig) => void;
  roomCode: string;
}

export default function SetupScreen({ onDone, roomCode }: Props) {
  const [myLang, setMyLang] = useState("ko");
  const [myName, setMyName] = useState("");

  function handleEnter() {
    if (!myName.trim()) return;
    onDone({
      myLang,
      myName: myName.trim(),
      isTeacher: false,
      teacherLangs: [],
    });
  }

  const ready = myName.trim().length > 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d0b26 0%, #1e1b4b 50%, #16133a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif", padding: "20px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "fixed", top: "-15%", right: "-8%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(91,87,245,0.18) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-15%", left: "-8%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{
        background: "#fff", borderRadius: 28, padding: "40px 36px 36px",
        maxWidth: 440, width: "100%",
        boxShadow: "0 40px 100px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)",
        animation: "fadeSlideIn 0.4s ease", position: "relative", zIndex: 1,
      }}>

        {/* Room badge */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#F0EEFF", borderRadius: 20, padding: "6px 16px", marginBottom: 18 }}>
            <span style={{ fontSize: 13 }}>🚪</span>
            <span style={{ fontWeight: 800, fontSize: 13, color: "#5B57F5", letterSpacing: 2 }}>
              Room {roomCode}
            </span>
          </div>
          <div style={{
            width: 60, height: 60, borderRadius: 18, margin: "0 auto 14px",
            background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, boxShadow: "0 8px 28px rgba(91,87,245,0.4)",
          }}>🌏</div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: "#111827", letterSpacing: -0.5 }}>
            다문화 교실 소통판
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#9CA3AF" }}>
            {t("enterName", myLang).replace("...", "")} — {LANGUAGES[myLang]?.flag}
          </p>
        </div>

        {/* Language — pick first so name placeholder updates */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
            {t("myLang", myLang).toUpperCase()} &nbsp;·&nbsp; MY LANGUAGE
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, maxHeight: 148, overflowY: "auto", padding: "2px 0" }}>
            {Object.entries(LANGUAGES).map(([code, info]) => (
              <button
                key={code}
                onClick={() => setMyLang(code)}
                style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 12,
                  border: `1.5px solid ${myLang === code ? "#5B57F5" : "#E5E7EB"}`,
                  background: myLang === code ? "#EEEEFF" : "#F9FAFB",
                  color: myLang === code ? "#5B57F5" : "#6B7280",
                  fontWeight: myLang === code ? 700 : 400, cursor: "pointer",
                  transition: "all 0.12s", whiteSpace: "nowrap", outline: "none",
                }}
              >
                {info.flag} {info.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
            NAME &nbsp;·&nbsp; 이름
          </p>
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEnter()}
            placeholder={t("enterName", myLang)}
            style={{
              width: "100%", padding: "13px 16px", borderRadius: 12,
              border: "2px solid #E5E7EB", fontSize: 15, color: "#111827",
              background: "#F9FAFB", outline: "none", transition: "all 0.18s", fontWeight: 500,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#5B57F5";
              e.target.style.background = "#fff";
              e.target.style.boxShadow = "0 0 0 4px rgba(91,87,245,0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#E5E7EB";
              e.target.style.background = "#F9FAFB";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Enter */}
        <button
          disabled={!ready}
          onClick={handleEnter}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 15,
            background: ready ? "linear-gradient(135deg, #5B57F5, #8B5CF6)" : "#F3F4F6",
            color: ready ? "#fff" : "#D1D5DB",
            fontWeight: 800, border: "none",
            cursor: ready ? "pointer" : "not-allowed",
            boxShadow: ready ? "0 6px 24px rgba(91,87,245,0.4)" : "none",
            transition: "all 0.2s",
          }}
        >
          {t("enter", myLang)}
        </button>
      </div>
    </div>
  );
}

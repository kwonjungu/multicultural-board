"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { UserConfig } from "@/lib/types";

interface Props {
  onDone: (config: UserConfig) => void;
}

export default function SetupScreen({ onDone }: Props) {
  const [myLang, setMyLang] = useState("ko");
  const [myName, setMyName] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherLangs, setTeacherLangs] = useState(["ko", "en"]);

  function handleEnter() {
    if (!myName.trim()) return;
    onDone({ myLang, myName: myName.trim(), isTeacher, teacherLangs });
  }

  function toggleTeacherLang(code: string) {
    setTeacherLangs((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  }

  const ready = myName.trim().length > 0 && (!isTeacher || teacherLangs.length > 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d0b26 0%, #1e1b4b 50%, #16133a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif", padding: "20px",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background glows */}
      <div style={{
        position: "fixed", top: "-20%", right: "-10%", width: 600, height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(91,87,245,0.18) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-20%", left: "-10%", width: 500, height: 500,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{
        background: "#fff",
        borderRadius: 28,
        padding: "40px 36px 36px",
        maxWidth: 460, width: "100%",
        boxShadow: "0 40px 100px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)",
        animation: "fadeSlideIn 0.4s ease",
        position: "relative", zIndex: 1,
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, boxShadow: "0 8px 28px rgba(91,87,245,0.4)",
          }}>🌏</div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 900, color: "#111827", letterSpacing: -0.5,
          }}>
            다문화 교실 소통판
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#9CA3AF", fontWeight: 400 }}>
            Multicultural Classroom Board
          </p>
        </div>

        {/* Role */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
            역할 ROLE
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { val: false, icon: "👦", label: "학생", sub: "Student" },
              { val: true,  icon: "👩‍🏫", label: "선생님", sub: "Teacher" },
            ].map(({ val, icon, label, sub }) => (
              <button
                key={String(val)}
                onClick={() => setIsTeacher(val)}
                style={{
                  padding: "14px 12px 12px", borderRadius: 14, cursor: "pointer",
                  border: `2px solid ${isTeacher === val ? "#5B57F5" : "#E5E7EB"}`,
                  background: isTeacher === val ? "#EEEEFF" : "#F9FAFB",
                  textAlign: "left", transition: "all 0.15s",
                  outline: "none",
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 6, lineHeight: 1 }}>{icon}</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: isTeacher === val ? "#5B57F5" : "#374151" }}>
                  {label}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
            이름 NAME
          </p>
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEnter()}
            placeholder="이름을 입력하세요"
            style={{
              width: "100%", padding: "13px 16px", borderRadius: 12,
              border: "2px solid #E5E7EB", fontSize: 15, color: "#111827",
              background: "#F9FAFB", outline: "none", transition: "all 0.18s",
              fontWeight: 500,
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

        {/* Language */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
            {isTeacher ? "지원 언어 (복수 선택)" : "내 언어 MY LANGUAGE"}
          </p>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 7,
            maxHeight: 148, overflowY: "auto", padding: "2px 0",
          }}>
            {Object.entries(LANGUAGES).map(([code, info]) => {
              const sel = isTeacher ? teacherLangs.includes(code) : myLang === code;
              return (
                <button
                  key={code}
                  onClick={() => isTeacher ? toggleTeacherLang(code) : setMyLang(code)}
                  style={{
                    padding: "6px 12px", borderRadius: 20, fontSize: 12,
                    border: `1.5px solid ${sel ? "#5B57F5" : "#E5E7EB"}`,
                    background: sel ? "#EEEEFF" : "#F9FAFB",
                    color: sel ? "#5B57F5" : "#6B7280",
                    fontWeight: sel ? 700 : 400, cursor: "pointer",
                    transition: "all 0.12s", whiteSpace: "nowrap", outline: "none",
                  }}
                >
                  {info.flag} {info.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Enter Button */}
        <button
          disabled={!ready}
          onClick={handleEnter}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 15,
            background: ready
              ? "linear-gradient(135deg, #5B57F5 0%, #8B5CF6 100%)"
              : "#F3F4F6",
            color: ready ? "#fff" : "#D1D5DB",
            fontWeight: 800, border: "none",
            cursor: ready ? "pointer" : "not-allowed",
            boxShadow: ready ? "0 6px 24px rgba(91,87,245,0.4)" : "none",
            transition: "all 0.2s", letterSpacing: -0.3,
          }}
        >
          입장하기 →
        </button>
      </div>
    </div>
  );
}

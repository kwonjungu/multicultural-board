"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { UserConfig } from "@/lib/types";

interface Props {
  onDone: (config: UserConfig) => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontWeight: 800, fontSize: 11, color: "#bbb", marginBottom: 8, letterSpacing: 1 }}>
      {children}
    </p>
  );
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif", padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 24, padding: "36px 32px",
        maxWidth: 440, width: "100%",
        boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
      }}>
        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 50, marginBottom: 6 }}>🌏</div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: "#111" }}>
            다문화 교실 소통판
          </h1>
          <p style={{ margin: "6px 0 0", color: "#aaa", fontSize: 12 }}>
            Multicultural Classroom Board
          </p>
        </div>

        {/* 역할 */}
        <Label>ROLE</Label>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {[
            { val: false, icon: "👦", label: "학생" },
            { val: true, icon: "👩‍🏫", label: "선생님" },
          ].map(({ val, icon, label }) => (
            <button
              key={String(val)}
              onClick={() => setIsTeacher(val)}
              style={{
                flex: 1, padding: "13px 0", borderRadius: 14,
                border: `2.5px solid ${isTeacher === val ? "#6C63FF" : "#e5e5e5"}`,
                background: isTeacher === val ? "#F0EEFF" : "#fafafa",
                color: isTeacher === val ? "#6C63FF" : "#aaa",
                fontWeight: 800, fontSize: 16, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* 이름 */}
        <Label>NAME</Label>
        <input
          value={myName}
          onChange={(e) => setMyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEnter()}
          placeholder="이름을 입력하세요"
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12,
            border: "2px solid #e5e5e5", fontSize: 15,
            boxSizing: "border-box", outline: "none", marginBottom: 20,
            fontFamily: "inherit", transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#6C63FF")}
          onBlur={(e) => (e.target.style.borderColor = "#e5e5e5")}
        />

        {/* 언어 */}
        <Label>
          {isTeacher ? "LANGUAGE (복수 선택)" : "MY LANGUAGE"}
        </Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26 }}>
          {Object.entries(LANGUAGES).map(([code, info]) => {
            const sel = isTeacher ? teacherLangs.includes(code) : myLang === code;
            return (
              <button
                key={code}
                onClick={() => isTeacher ? toggleTeacherLang(code) : setMyLang(code)}
                style={{
                  padding: "8px 14px", borderRadius: 20, fontSize: 13,
                  border: `2px solid ${sel ? "#6C63FF" : "#e5e5e5"}`,
                  background: sel ? "#F0EEFF" : "#fafafa",
                  color: sel ? "#6C63FF" : "#aaa",
                  fontWeight: sel ? 700 : 400, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {info.flag} {info.label}
              </button>
            );
          })}
        </div>

        {/* 입장 버튼 */}
        <button
          disabled={!myName.trim()}
          onClick={handleEnter}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 16,
            background: myName.trim()
              ? "linear-gradient(135deg, #6C63FF, #9B59B6)"
              : "#eee",
            color: myName.trim() ? "#fff" : "#bbb",
            fontWeight: 900, border: "none",
            cursor: myName.trim() ? "pointer" : "not-allowed",
            boxShadow: myName.trim() ? "0 6px 20px rgba(108,99,255,0.35)" : "none",
            transition: "all 0.2s",
          }}
        >
          입장하기 →
        </button>
      </div>
    </div>
  );
}

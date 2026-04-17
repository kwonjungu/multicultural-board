"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { UserConfig, RoomConfig } from "@/lib/types";
import { t } from "@/lib/i18n";
import BeeMascot from "./BeeMascot";

interface Props {
  onDone: (config: UserConfig) => void;
  roomCode: string;
  availableLangs: string[];
  roomConfig: RoomConfig;
}

export default function SetupScreen({ onDone, roomCode, availableLangs, roomConfig }: Props) {
  const [myLang, setMyLang] = useState(() => {
    return availableLangs.includes("ko") ? "ko" : availableLangs[0] ?? "ko";
  });
  const [myName, setMyName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [teacherCode, setTeacherCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  const rosterList: string[] = Array.isArray(roomConfig.roster)
    ? roomConfig.roster
    : roomConfig.roster ? Object.values(roomConfig.roster as unknown as Record<string, string>) : [];
  const isRosterMode = roomConfig.rosterMode && rosterList.length > 0;

  function handleEnter() {
    if (!myName.trim()) return;
    if (role === "teacher") {
      if (teacherCode !== roomCode) { setCodeError(true); return; }
      onDone({ myLang, myName: myName.trim(), isTeacher: true, teacherLangs: availableLangs });
    } else {
      onDone({ myLang, myName: myName.trim(), isTeacher: false, teacherLangs: [] });
    }
  }

  const ready = myName.trim().length > 0 && (role === "student" || teacherCode.length > 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #FEF9E7 0%, #FFF4CC 40%, #FDE8A6 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif", padding: "20px",
      position: "relative", overflow: "hidden",
    }}>
      {/* Soft cloud blobs */}
      <div style={{ position: "fixed", top: "-10%", right: "-6%", width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.75) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-12%", left: "-8%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{
        background: "#fff", borderRadius: 32, padding: "clamp(26px, 5vw, 42px) clamp(20px, 5vw, 36px)",
        maxWidth: "min(460px, 94vw)", width: "100%",
        boxShadow: "0 24px 60px rgba(245,158,11,0.22), 0 8px 20px rgba(0,0,0,0.06)",
        animation: "fadeSlideIn 0.4s ease", position: "relative", zIndex: 1,
      }}>
        {/* Top header with mascot */}
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <BeeMascot size={90} mood="wave" />
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#111827", letterSpacing: -0.6 }}>
            꿀벌 소통창
          </h1>
          <p style={{ margin: "8px 0 14px", fontSize: 17, color: "#6B7280", fontWeight: 600 }}>
            어서 와요! 이름을 알려줘요 🐝
          </p>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "#FEF3C7", borderRadius: 24, padding: "10px 18px",
            border: "2px dashed #FBBF24",
          }}>
            <span style={{ fontSize: 18 }}>🚪</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: "#92400E" }}>우리 방</span>
            <span style={{ fontWeight: 900, fontSize: 19, color: "#B45309", letterSpacing: 4 }}>{roomCode}</span>
          </div>
        </div>

        {/* Language */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: "#111827" }}>
            🌍 어느 나라 말을 써요?
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 180, overflowY: "auto", padding: "2px 0" }}>
            {availableLangs.map((code) => {
              const info = LANGUAGES[code];
              if (!info) return null;
              const active = myLang === code;
              return (
                <button
                  key={code}
                  onClick={() => setMyLang(code)}
                  style={{
                    padding: "11px 16px", borderRadius: 24, fontSize: 16,
                    border: `2px solid ${active ? "#F59E0B" : "#E5E7EB"}`,
                    background: active ? "#FEF3C7" : "#FAFAFA",
                    color: active ? "#92400E" : "#4B5563",
                    fontWeight: active ? 800 : 600, cursor: "pointer",
                    transition: "transform 0.12s, background 0.15s, border-color 0.15s",
                    whiteSpace: "nowrap", outline: "none", minHeight: 44,
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <span style={{ fontSize: 18, marginRight: 4 }}>{info.flag}</span> {info.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: "#111827" }}>
            🙋 내 이름은?
          </p>

          {isRosterMode ? (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 14, color: "#6B7280", fontWeight: 600 }}>
                {t("selectYourName", myLang)}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 200, overflowY: "auto" }}>
                {rosterList.map((name) => {
                  const active = myName === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setMyName(name)}
                      style={{
                        padding: "12px 20px", borderRadius: 24, fontSize: 17,
                        border: `2px solid ${active ? "#F59E0B" : "#E5E7EB"}`,
                        background: active ? "#FEF3C7" : "#FAFAFA",
                        color: active ? "#92400E" : "#374151",
                        fontWeight: active ? 800 : 600, cursor: "pointer",
                        transition: "transform 0.12s, background 0.15s, border-color 0.15s",
                        whiteSpace: "nowrap", outline: "none", minHeight: 48,
                      }}
                      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
                      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <input
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEnter()}
              placeholder={t("enterName", myLang)}
              style={{
                width: "100%", padding: "16px 20px", borderRadius: 18,
                border: "2px solid #E5E7EB", fontSize: 18, color: "#111827",
                background: "#FAFAFA", outline: "none", transition: "all 0.18s", fontWeight: 600,
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#F59E0B";
                e.target.style.background = "#fff";
                e.target.style.boxShadow = "0 0 0 5px rgba(245,158,11,0.15)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E5E7EB";
                e.target.style.background = "#FAFAFA";
                e.target.style.boxShadow = "none";
              }}
            />
          )}
        </div>

        {/* Role selection */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: "#111827" }}>
            ✨ 누구예요?
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => { setRole("student"); setCodeError(false); setTeacherCode(""); }}
              style={{
                flex: 1, padding: "16px 0", borderRadius: 18, fontSize: 17, fontWeight: 800,
                border: `2px solid ${role === "student" ? "#F59E0B" : "#E5E7EB"}`,
                background: role === "student" ? "#FEF3C7" : "#FAFAFA",
                color: role === "student" ? "#92400E" : "#9CA3AF",
                cursor: "pointer", transition: "transform 0.12s, background 0.15s",
                minHeight: 56,
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              🎒 학생
            </button>
            <button
              onClick={() => setRole("teacher")}
              style={{
                flex: 1, padding: "16px 0", borderRadius: 18, fontSize: 17, fontWeight: 800,
                border: `2px solid ${role === "teacher" ? "#10B981" : "#E5E7EB"}`,
                background: role === "teacher" ? "#ECFDF5" : "#FAFAFA",
                color: role === "teacher" ? "#065F46" : "#9CA3AF",
                cursor: "pointer", transition: "transform 0.12s, background 0.15s",
                minHeight: 56,
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              👩‍🏫 선생님
            </button>
          </div>

          {role === "teacher" && (
            <div style={{ marginTop: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: 15, color: "#6B7280", fontWeight: 700 }}>
                🔐 선생님 암호를 입력해 주세요
              </p>
              <input
                type="password"
                value={teacherCode}
                onChange={(e) => { setTeacherCode(e.target.value); setCodeError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleEnter()}
                placeholder="○○○○"
                maxLength={4}
                autoFocus
                style={{
                  width: "100%", padding: "16px 20px", borderRadius: 18,
                  border: `2px solid ${codeError ? "#EF4444" : "#E5E7EB"}`,
                  fontSize: 26, textAlign: "center", letterSpacing: 12,
                  color: "#111827", background: "#FAFAFA", outline: "none",
                  fontWeight: 800, boxSizing: "border-box", transition: "all 0.18s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = codeError ? "#EF4444" : "#10B981";
                  e.target.style.background = "#fff";
                  e.target.style.boxShadow = "0 0 0 5px rgba(16,185,129,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = codeError ? "#EF4444" : "#E5E7EB";
                  e.target.style.background = "#FAFAFA";
                  e.target.style.boxShadow = "none";
                }}
              />
              {codeError && (
                <p style={{ margin: "8px 0 0", fontSize: 14, color: "#EF4444", fontWeight: 700 }}>
                  앗, 암호가 달라요. 다시 확인해 주세요 🔍
                </p>
              )}
            </div>
          )}
        </div>

        {/* Enter */}
        <button
          disabled={!ready}
          onClick={handleEnter}
          style={{
            width: "100%", padding: "18px 0", borderRadius: 22, fontSize: 19,
            background: ready
              ? role === "teacher"
                ? "linear-gradient(135deg, #059669, #10B981)"
                : "linear-gradient(135deg, #FBBF24, #F59E0B)"
              : "#F3F4F6",
            color: ready ? "#fff" : "#D1D5DB",
            fontWeight: 900, border: "none",
            cursor: ready ? "pointer" : "not-allowed",
            boxShadow: ready
              ? role === "teacher"
                ? "0 10px 28px rgba(16,185,129,0.42)"
                : "0 10px 28px rgba(245,158,11,0.45)"
              : "none",
            transition: "transform 0.12s, box-shadow 0.2s",
            minHeight: 60,
          }}
          onMouseDown={(e) => ready && (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {role === "teacher" ? "👩‍🏫 선생님으로 들어가기" : "🐝 놀러 가기!"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { UserConfig, RoomConfig } from "@/lib/types";
import { t } from "@/lib/i18n";

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
      background: "linear-gradient(135deg, #0d0b26 0%, #1e1b4b 50%, #16133a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif", padding: "20px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "fixed", top: "-15%", right: "-8%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(91,87,245,0.18) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-15%", left: "-8%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{
        background: "#fff", borderRadius: 28, padding: "clamp(24px, 5vw, 40px) clamp(16px, 5vw, 36px)",
        maxWidth: "min(440px, 92vw)", width: "100%",
        boxShadow: "0 40px 100px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)",
        animation: "fadeSlideIn 0.4s ease", position: "relative", zIndex: 1,
      }}>
        {/* Room badge */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#F0EEFF", borderRadius: 20, padding: "6px 16px", marginBottom: 18 }}>
            <span style={{ fontSize: 13 }}>🚪</span>
            <span style={{ fontWeight: 800, fontSize: 13, color: "#5B57F5", letterSpacing: 2 }}>Room {roomCode}</span>
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
            {LANGUAGES[myLang]?.flag} {t("enterName", myLang).replace(/\.\.\.$/, "")}
          </p>
        </div>

        {/* Language */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
            {t("myLang", myLang).toUpperCase()} &nbsp;·&nbsp; MY LANGUAGE
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, maxHeight: 148, overflowY: "auto", padding: "2px 0" }}>
            {availableLangs.map((code) => {
              const info = LANGUAGES[code];
              if (!info) return null;
              return (
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
              );
            })}
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
            NAME &nbsp;·&nbsp; 이름
          </p>

          {isRosterMode ? (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6B7280" }}>
                {t("selectYourName", myLang)}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 200, overflowY: "auto" }}>
                {rosterList.map((name) => (
                  <button
                    key={name}
                    onClick={() => setMyName(name)}
                    style={{
                      padding: "10px 18px", borderRadius: 20, fontSize: 13,
                      border: `1.5px solid ${myName === name ? "#5B57F5" : "#E5E7EB"}`,
                      background: myName === name ? "#EEEEFF" : "#F9FAFB",
                      color: myName === name ? "#5B57F5" : "#374151",
                      fontWeight: myName === name ? 700 : 400, cursor: "pointer",
                      transition: "all 0.12s", whiteSpace: "nowrap", outline: "none",
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <input
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEnter()}
              placeholder={t("enterName", myLang)}
              style={{
                width: "100%", padding: "13px 16px", borderRadius: 12,
                border: "2px solid #E5E7EB", fontSize: 15, color: "#111827",
                background: "#F9FAFB", outline: "none", transition: "all 0.18s", fontWeight: 500,
                boxSizing: "border-box",
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
          )}
        </div>

        {/* Role selection */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
            ROLE &nbsp;·&nbsp; 역할
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { setRole("student"); setCodeError(false); setTeacherCode(""); }}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 800,
                border: `2px solid ${role === "student" ? "#5B57F5" : "#E5E7EB"}`,
                background: role === "student" ? "#EEEEFF" : "#F9FAFB",
                color: role === "student" ? "#5B57F5" : "#9CA3AF",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              👨‍🎓 학생
            </button>
            <button
              onClick={() => setRole("teacher")}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 800,
                border: `2px solid ${role === "teacher" ? "#10B981" : "#E5E7EB"}`,
                background: role === "teacher" ? "#ECFDF5" : "#F9FAFB",
                color: role === "teacher" ? "#065F46" : "#9CA3AF",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              👩‍🏫 선생님
            </button>
          </div>

          {role === "teacher" && (
            <div style={{ marginTop: 14 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#6B7280", fontWeight: 600 }}>
                방 코드를 입력하세요
              </p>
              <input
                type="password"
                value={teacherCode}
                onChange={(e) => { setTeacherCode(e.target.value); setCodeError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleEnter()}
                placeholder="코드 4자리"
                maxLength={4}
                autoFocus
                style={{
                  width: "100%", padding: "13px 16px", borderRadius: 12,
                  border: `2px solid ${codeError ? "#EF4444" : "#E5E7EB"}`,
                  fontSize: 22, textAlign: "center", letterSpacing: 10,
                  color: "#111827", background: "#F9FAFB", outline: "none",
                  fontWeight: 800, boxSizing: "border-box", transition: "all 0.18s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = codeError ? "#EF4444" : "#10B981";
                  e.target.style.background = "#fff";
                  e.target.style.boxShadow = "0 0 0 4px rgba(16,185,129,0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = codeError ? "#EF4444" : "#E5E7EB";
                  e.target.style.background = "#F9FAFB";
                  e.target.style.boxShadow = "none";
                }}
              />
              {codeError && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#EF4444", fontWeight: 600 }}>
                  코드가 올바르지 않습니다
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
            width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 15,
            background: ready
              ? role === "teacher"
                ? "linear-gradient(135deg, #059669, #10B981)"
                : "linear-gradient(135deg, #5B57F5, #8B5CF6)"
              : "#F3F4F6",
            color: ready ? "#fff" : "#D1D5DB",
            fontWeight: 800, border: "none",
            cursor: ready ? "pointer" : "not-allowed",
            boxShadow: ready
              ? role === "teacher"
                ? "0 6px 24px rgba(16,185,129,0.4)"
                : "0 6px 24px rgba(91,87,245,0.4)"
              : "none",
            transition: "all 0.2s",
          }}
        >
          {role === "teacher" ? "👩‍🏫 선생님으로 입장" : t("enter", myLang)}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { UserConfig, RoomConfig } from "@/lib/types";
import { t } from "@/lib/i18n";
import { landmarkFor } from "@/lib/assets";
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
      background: "linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 50%, #FDE68A 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif", padding: "20px",
      position: "relative", overflow: "hidden",
    }}>
      {/* Honeycomb decoration */}
      <svg style={{ position: "fixed", top: 0, right: 0, opacity: 0.14, pointerEvents: "none" }} width="320" height="320" viewBox="0 0 300 300" aria-hidden="true">
        {[0,1,2,3].flatMap(i => [0,1,2,3].map(j => {
          const x = i*80 + (j%2)*40;
          const y = j*70;
          return <polygon key={`${i}-${j}`} points={`${x+30},${y} ${x+60},${y+17} ${x+60},${y+52} ${x+30},${y+70} ${x},${y+52} ${x},${y+17}`} fill="none" stroke="#F59E0B" strokeWidth="2"/>;
        }))}
      </svg>
      <div style={{ position: "fixed", bottom: "-15%", left: "-10%", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(252,211,77,0.45) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{
        background: "#fff", borderRadius: 32, padding: "clamp(26px, 5vw, 42px) clamp(20px, 5vw, 36px)",
        maxWidth: "min(480px, 94vw)", width: "100%",
        boxShadow: "0 30px 70px rgba(180,83,9,0.20), 0 0 0 1px rgba(253,230,138,0.6)",
        animation: "fadeSlideIn 0.4s ease", position: "relative", zIndex: 1,
      }}>
        {/* Top header with mascot */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <img
              src="/mascot/bee-welcome.png"
              alt=""
              aria-hidden="true"
              style={{
                width: 128, height: 128, display: "block",
                filter: "drop-shadow(0 8px 20px rgba(245,158,11,0.35))",
                animation: "heroBeeFloat 3s ease-in-out infinite",
              }}
            />
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#1F2937", letterSpacing: -0.6 }}>
            어서 와요!
          </h1>
          <p style={{ margin: "8px 0 14px", fontSize: 18, color: "#92400E", fontWeight: 700 }}>
            {LANGUAGES[myLang]?.greet || "안녕!"} 친구야 🐝
          </p>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "#FEF3C7", borderRadius: 24, padding: "10px 18px",
            border: "2px dashed #FBBF24",
          }}>
            <span style={{ fontSize: 18 }}>🚪</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: "#92400E" }}>우리 방</span>
            <span style={{ fontWeight: 900, fontSize: 20, color: "#B45309", letterSpacing: 4 }}>{roomCode}</span>
          </div>
        </div>

        {/* Language — grid w/ greetings */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 900, color: "#1F2937" }}>
            🌍 어느 나라 말을 써요?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 320, overflowY: "auto", padding: "2px" }}>
            {availableLangs.map((code) => {
              const info = LANGUAGES[code];
              if (!info) return null;
              const active = myLang === code;
              return (
                <button
                  key={code}
                  onClick={() => setMyLang(code)}
                  aria-pressed={active}
                  style={{
                    minHeight: 76, borderRadius: 18,
                    background: active ? "#FEF3C7" : "#fff",
                    border: `3px solid ${active ? "#F59E0B" : "#FDE68A"}`,
                    display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
                    cursor: "pointer", textAlign: "left",
                    boxShadow: active ? "0 6px 16px rgba(245,158,11,0.28)" : "0 2px 6px rgba(0,0,0,0.04)",
                    transition: "transform 0.12s, box-shadow 0.15s, background 0.15s, border-color 0.15s",
                    outline: "none",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {(() => {
                    const lm = landmarkFor(code);
                    if (lm) {
                      return (
                        <img
                          src={lm}
                          alt=""
                          aria-hidden="true"
                          style={{ width: 48, height: 48, flexShrink: 0, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))" }}
                        />
                      );
                    }
                    return <div style={{ fontSize: 34, flexShrink: 0 }}>{info.flag}</div>;
                  })()}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 16 }}>{info.flag}</span>
                      {info.label}
                    </div>
                    {info.romanized && (
                      <div style={{ fontSize: 12, color: "#92400E", fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>
                        &quot;{info.romanized}&quot;
                      </div>
                    )}
                  </div>
                  {active && <div style={{ fontSize: 20, color: "#F59E0B", fontWeight: 900 }}>✓</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 900, color: "#1F2937" }}>
            🙋 내 이름은?
          </p>

          {isRosterMode ? (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 15, color: "#6B7280", fontWeight: 700 }}>
                {t("selectYourName", myLang)}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                {rosterList.map((name) => {
                  const active = myName === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setMyName(name)}
                      style={{
                        padding: "14px 22px", borderRadius: 24, fontSize: 18,
                        border: `3px solid ${active ? "#F59E0B" : "#FDE68A"}`,
                        background: active ? "#FEF3C7" : "#fff",
                        color: active ? "#92400E" : "#374151",
                        fontWeight: active ? 900 : 700, cursor: "pointer",
                        transition: "transform 0.12s, background 0.15s, border-color 0.15s",
                        whiteSpace: "nowrap", outline: "none", minHeight: 56,
                      }}
                      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
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
                width: "100%", padding: "18px 22px", borderRadius: 20,
                border: "3px solid #FDE68A", fontSize: 20, color: "#1F2937",
                background: "#FFFBEB", outline: "none", transition: "all 0.18s", fontWeight: 700,
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#F59E0B";
                e.target.style.background = "#fff";
                e.target.style.boxShadow = "0 0 0 5px rgba(245,158,11,0.18)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#FDE68A";
                e.target.style.background = "#FFFBEB";
                e.target.style.boxShadow = "none";
              }}
            />
          )}
        </div>

        {/* Role selection */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 900, color: "#1F2937" }}>
            ✨ 누구예요?
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => { setRole("student"); setCodeError(false); setTeacherCode(""); }}
              style={{
                flex: 1, padding: "18px 0", borderRadius: 20, fontSize: 18, fontWeight: 900,
                border: `3px solid ${role === "student" ? "#F59E0B" : "#FDE68A"}`,
                background: role === "student" ? "#FEF3C7" : "#fff",
                color: role === "student" ? "#92400E" : "#9CA3AF",
                cursor: "pointer", transition: "transform 0.12s, background 0.15s",
                minHeight: 60,
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
                flex: 1, padding: "18px 0", borderRadius: 20, fontSize: 18, fontWeight: 900,
                border: `3px solid ${role === "teacher" ? "#10B981" : "#D1FAE5"}`,
                background: role === "teacher" ? "#ECFDF5" : "#fff",
                color: role === "teacher" ? "#065F46" : "#9CA3AF",
                cursor: "pointer", transition: "transform 0.12s, background 0.15s",
                minHeight: 60,
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
                  border: `3px solid ${codeError ? "#EF4444" : "#D1FAE5"}`,
                  fontSize: 28, textAlign: "center", letterSpacing: 14,
                  color: "#1F2937", background: "#F0FDF4", outline: "none",
                  fontWeight: 900, boxSizing: "border-box", transition: "all 0.18s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = codeError ? "#EF4444" : "#10B981";
                  e.target.style.background = "#fff";
                  e.target.style.boxShadow = "0 0 0 5px rgba(16,185,129,0.18)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = codeError ? "#EF4444" : "#D1FAE5";
                  e.target.style.background = "#F0FDF4";
                  e.target.style.boxShadow = "none";
                }}
              />
              {codeError && (
                <p style={{ margin: "8px 0 0", fontSize: 15, color: "#EF4444", fontWeight: 800 }}>
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
            width: "100%", padding: "20px 0", borderRadius: 24, fontSize: 22,
            background: ready
              ? role === "teacher"
                ? "linear-gradient(135deg, #059669, #10B981)"
                : "linear-gradient(135deg, #F59E0B, #D97706)"
              : "#F3F4F6",
            color: ready ? "#fff" : "#D1D5DB",
            fontWeight: 900, border: "none",
            cursor: ready ? "pointer" : "not-allowed",
            boxShadow: ready
              ? role === "teacher"
                ? "0 10px 28px rgba(16,185,129,0.42), inset 0 -4px 0 rgba(0,0,0,0.15)"
                : "0 10px 28px rgba(245,158,11,0.45), inset 0 -4px 0 rgba(0,0,0,0.15)"
              : "none",
            transition: "transform 0.12s, box-shadow 0.2s",
            minHeight: 68,
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

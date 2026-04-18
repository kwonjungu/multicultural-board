"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { UserConfig, RoomConfig } from "@/lib/types";
import { t } from "@/lib/i18n";
import { landmarkFor } from "@/lib/assets";

interface Props {
  onDone: (config: UserConfig) => void;
  roomCode: string;
  availableLangs: string[];
  roomConfig: RoomConfig;
}

type Step = "lang" | "role" | "name";

export default function SetupScreen({ onDone, roomCode, availableLangs, roomConfig }: Props) {
  const [step, setStep] = useState<Step>("lang");
  const [myLang, setMyLang] = useState<string>(() =>
    availableLangs.includes("ko") ? "ko" : availableLangs[0] ?? "ko"
  );
  const [role, setRole] = useState<"student" | "teacher" | null>(null);
  const [teacherCode, setTeacherCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [myName, setMyName] = useState("");

  const rosterList: string[] = Array.isArray(roomConfig.roster)
    ? roomConfig.roster
    : roomConfig.roster ? Object.values(roomConfig.roster as unknown as Record<string, string>) : [];
  const isRosterMode = roomConfig.rosterMode && rosterList.length > 0;

  function finish() {
    if (!myName.trim()) return;
    if (role === "teacher") {
      onDone({ myLang, myName: myName.trim(), isTeacher: true, teacherLangs: availableLangs });
    } else {
      onDone({ myLang, myName: myName.trim(), isTeacher: false, teacherLangs: [] });
    }
  }

  function goRole() {
    // role 단계로 진입 시 teacher 입력 초기화
    setStep("role");
  }

  function confirmRole() {
    if (!role) return;
    if (role === "teacher") {
      if (teacherCode !== roomCode) { setCodeError(true); return; }
    }
    setStep("name");
  }

  const stepNum = step === "lang" ? 1 : step === "role" ? 2 : 3;

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
        background: "#fff", borderRadius: 32, padding: "clamp(22px, 4vw, 32px) clamp(20px, 4vw, 30px)",
        maxWidth: "min(480px, 94vw)", width: "100%",
        boxShadow: "0 30px 70px rgba(180,83,9,0.20), 0 0 0 1px rgba(253,230,138,0.6)",
        animation: "fadeSlideIn 0.4s ease", position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column",
      }}>
        {/* Progress indicator + back */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {step !== "lang" && (
            <button
              onClick={() => {
                if (step === "role") setStep("lang");
                if (step === "name") setStep("role");
              }}
              aria-label="뒤로"
              style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: "#fff", border: "2px solid #FDE68A",
                fontSize: 16, fontWeight: 900, color: "#92400E", cursor: "pointer",
              }}
            >←</button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#92400E", letterSpacing: 1 }}>
              {stepNum}/3 단계
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              {[1,2,3].map((i) => (
                <div key={i} style={{
                  flex: 1, height: 6, borderRadius: 999,
                  background: i <= stepNum ? "linear-gradient(90deg, #F59E0B, #D97706)" : "#FEF3C7",
                }}/>
              ))}
            </div>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#FEF3C7", borderRadius: 20, padding: "6px 12px",
            border: "2px dashed #FBBF24", flexShrink: 0,
          }}>
            <span style={{ fontSize: 14 }}>🚪</span>
            <span style={{ fontWeight: 900, fontSize: 14, color: "#B45309", letterSpacing: 2 }}>{roomCode}</span>
          </div>
        </div>

        {/* STEP 1 — 언어 */}
        {step === "lang" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
                <img src="/mascot/bee-welcome.png" alt="" aria-hidden="true"
                  style={{ width: 110, height: 110, filter: "drop-shadow(0 6px 16px rgba(245,158,11,0.35))",
                    animation: "heroBeeFloat 3s ease-in-out infinite" }}/>
              </div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#1F2937", letterSpacing: -0.5 }}>
                어느 나라 말을 쓰니?
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: 15, color: "#92400E", fontWeight: 700 }}>
                {LANGUAGES[myLang]?.greet || "안녕!"} 👋
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18,
              maxHeight: 360, overflowY: "auto", padding: 2 }}>
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
                      minHeight: 84, borderRadius: 18,
                      background: active ? "#FEF3C7" : "#fff",
                      border: `3px solid ${active ? "#F59E0B" : "#FDE68A"}`,
                      display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
                      cursor: "pointer", textAlign: "left",
                      boxShadow: active ? "0 6px 16px rgba(245,158,11,0.28)" : "0 2px 6px rgba(0,0,0,0.04)",
                      transition: "all 0.12s",
                    }}
                  >
                    {(() => {
                      const lm = landmarkFor(code);
                      if (lm) {
                        return <img src={lm} alt="" aria-hidden="true"
                          style={{ width: 52, height: 52, flexShrink: 0, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))" }}/>;
                      }
                      return <div style={{ fontSize: 34, flexShrink: 0 }}>{info.flag}</div>;
                    })()}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937", lineHeight: 1.2, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 16 }}>{info.flag}</span>{info.label}
                      </div>
                      {info.romanized && (
                        <div style={{ fontSize: 12, color: "#92400E", fontWeight: 700, marginTop: 2 }}>
                          &quot;{info.romanized}&quot;
                        </div>
                      )}
                    </div>
                    {active && <div style={{ fontSize: 20, color: "#F59E0B", fontWeight: 900 }}>✓</div>}
                  </button>
                );
              })}
            </div>

            <button
              onClick={goRole}
              style={{
                width: "100%", minHeight: 64, borderRadius: 22, border: "none",
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#fff", fontSize: 20, fontWeight: 900, cursor: "pointer",
                boxShadow: "0 10px 28px rgba(245,158,11,0.42), inset 0 -3px 0 rgba(0,0,0,0.15)",
              }}
            >다음 →</button>
          </>
        )}

        {/* STEP 2 — 역할 */}
        {step === "role" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
                <img src="/mascot/bee-think.png" alt="" aria-hidden="true"
                  style={{ width: 96, height: 96, filter: "drop-shadow(0 6px 16px rgba(245,158,11,0.35))" }}/>
              </div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#1F2937", letterSpacing: -0.5 }}>
                누구예요?
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: 15, color: "#92400E", fontWeight: 700 }}>
                하나만 골라요
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <button
                onClick={() => { setRole("student"); setCodeError(false); setTeacherCode(""); }}
                aria-pressed={role === "student"}
                style={{
                  minHeight: 130, borderRadius: 22, padding: "14px 10px",
                  border: `3px solid ${role === "student" ? "#F59E0B" : "#FDE68A"}`,
                  background: role === "student" ? "#FEF3C7" : "#fff",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  cursor: "pointer", transition: "transform 0.12s",
                  boxShadow: role === "student" ? "0 8px 20px rgba(245,158,11,0.3)" : "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ fontSize: 48 }}>🎒</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937" }}>학생</div>
                <div style={{ fontSize: 12, color: "#92400E", fontWeight: 700 }}>친구들과 이야기해요</div>
              </button>
              <button
                onClick={() => setRole("teacher")}
                aria-pressed={role === "teacher"}
                style={{
                  minHeight: 130, borderRadius: 22, padding: "14px 10px",
                  border: `3px solid ${role === "teacher" ? "#10B981" : "#D1FAE5"}`,
                  background: role === "teacher" ? "#ECFDF5" : "#fff",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  cursor: "pointer", transition: "transform 0.12s",
                  boxShadow: role === "teacher" ? "0 8px 20px rgba(16,185,129,0.3)" : "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ fontSize: 48 }}>👩‍🏫</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937" }}>선생님</div>
                <div style={{ fontSize: 12, color: "#065F46", fontWeight: 700 }}>교실을 관리해요</div>
              </button>
            </div>

            {role === "teacher" && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: "0 0 10px", fontSize: 14, color: "#6B7280", fontWeight: 700 }}>
                  🔐 선생님 암호
                </p>
                <input
                  type="password"
                  value={teacherCode}
                  onChange={(e) => { setTeacherCode(e.target.value); setCodeError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && confirmRole()}
                  placeholder="○○○○"
                  maxLength={4}
                  autoFocus
                  style={{
                    width: "100%", padding: "16px 20px", borderRadius: 18,
                    border: `3px solid ${codeError ? "#EF4444" : "#D1FAE5"}`,
                    fontSize: 26, textAlign: "center", letterSpacing: 14,
                    color: "#1F2937", background: "#F0FDF4", outline: "none",
                    fontWeight: 900, boxSizing: "border-box",
                  }}
                />
                {codeError && (
                  <p style={{ margin: "8px 0 0", fontSize: 14, color: "#EF4444", fontWeight: 800 }}>
                    앗, 암호가 달라요. 다시 확인해 주세요 🔍
                  </p>
                )}
              </div>
            )}

            <button
              onClick={confirmRole}
              disabled={!role || (role === "teacher" && teacherCode.length === 0)}
              style={{
                width: "100%", minHeight: 64, borderRadius: 22, border: "none",
                background: !role || (role === "teacher" && teacherCode.length === 0)
                  ? "#F3F4F6"
                  : role === "teacher"
                    ? "linear-gradient(135deg, #059669, #10B981)"
                    : "linear-gradient(135deg, #F59E0B, #D97706)",
                color: !role || (role === "teacher" && teacherCode.length === 0) ? "#D1D5DB" : "#fff",
                fontSize: 20, fontWeight: 900,
                cursor: !role || (role === "teacher" && teacherCode.length === 0) ? "not-allowed" : "pointer",
                boxShadow: !role || (role === "teacher" && teacherCode.length === 0) ? "none"
                  : role === "teacher"
                    ? "0 10px 28px rgba(16,185,129,0.4), inset 0 -3px 0 rgba(0,0,0,0.15)"
                    : "0 10px 28px rgba(245,158,11,0.42), inset 0 -3px 0 rgba(0,0,0,0.15)",
              }}
            >다음 →</button>
          </>
        )}

        {/* STEP 3 — 이름 */}
        {step === "name" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
                <img src="/mascot/bee-cheer.png" alt="" aria-hidden="true"
                  style={{ width: 96, height: 96, filter: "drop-shadow(0 6px 16px rgba(245,158,11,0.35))" }}/>
              </div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#1F2937", letterSpacing: -0.5 }}>
                내 이름은?
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: 15, color: "#92400E", fontWeight: 700 }}>
                친구들이 이 이름을 볼 거예요
              </p>
            </div>

            {isRosterMode ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 260, overflowY: "auto", marginBottom: 18 }}>
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
                        minHeight: 56,
                      }}
                    >{name}</button>
                  );
                })}
              </div>
            ) : (
              <input
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && finish()}
                placeholder={t("enterName", myLang)}
                autoFocus
                style={{
                  width: "100%", padding: "18px 22px", borderRadius: 20,
                  border: "3px solid #FDE68A", fontSize: 22, color: "#1F2937",
                  background: "#FFFBEB", outline: "none", fontWeight: 800,
                  boxSizing: "border-box", marginBottom: 18,
                  textAlign: "center",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#F59E0B"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 5px rgba(245,158,11,0.18)"; }}
                onBlur={(e) => { e.target.style.borderColor = "#FDE68A"; e.target.style.background = "#FFFBEB"; e.target.style.boxShadow = "none"; }}
              />
            )}

            <button
              onClick={finish}
              disabled={!myName.trim()}
              style={{
                width: "100%", minHeight: 68, borderRadius: 24, border: "none",
                background: !myName.trim() ? "#F3F4F6"
                  : role === "teacher"
                    ? "linear-gradient(135deg, #059669, #10B981)"
                    : "linear-gradient(135deg, #F59E0B, #D97706)",
                color: !myName.trim() ? "#D1D5DB" : "#fff",
                fontSize: 22, fontWeight: 900,
                cursor: !myName.trim() ? "not-allowed" : "pointer",
                boxShadow: !myName.trim() ? "none"
                  : role === "teacher"
                    ? "0 10px 28px rgba(16,185,129,0.42), inset 0 -4px 0 rgba(0,0,0,0.15)"
                    : "0 10px 28px rgba(245,158,11,0.45), inset 0 -4px 0 rgba(0,0,0,0.15)",
              }}
            >
              {role === "teacher" ? "👩‍🏫 선생님으로 들어가기" : "🐝 놀러 가기!"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

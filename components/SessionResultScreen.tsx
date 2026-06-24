"use client";

import { useEffect } from "react";
import type { AwardResult } from "@/lib/lms";
import BeeMascot from "./BeeMascot";
import { playFanfare } from "@/lib/gameSfx";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";
const GREEN = "#10B981";

interface Props {
  outOfHearts: boolean;
  finalizing: boolean;
  correct: number;
  total: number;
  sessionXp: number;
  combo: number;
  award: AwardResult | null;
  stars: 1 | 2 | 3 | null;
  lessonTitle?: string;
  onRetry: () => void;
  onClose: () => void;
}

export default function SessionResultScreen({
  outOfHearts, finalizing, correct, total, sessionXp, combo, award, stars, lessonTitle, onRetry, onClose,
}: Props) {
  // #6 결과 화면 진입 시 꿀비 축하 연출 — 팡파레 + 햅틱 (별 개수 차등).
  const celebrating = !outOfHearts && total > 0;
  const fanfareLevel: "full" | "good" | "soft" =
    stars === 3 ? "full" : stars === 2 ? "good" : "soft";
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!celebrating) return;
    try { playFanfare(fanfareLevel); } catch { /* audio unavailable */ }
    try {
      // 햅틱 — 모바일에서만. 강도도 결과에 맞춰 차등.
      const pattern = fanfareLevel === "full" ? [40, 40, 80] : fanfareLevel === "good" ? [40, 40] : 60;
      (window.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(pattern);
    } catch { /* silent */ }
    // 마운트 1회만 — 결과 화면은 세션당 한 번 생성됨
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (outOfHearts) {
    return (
      <div style={{ textAlign: "center", padding: "32px 18px" }}>
        <BeeMascot size={96} mood="oops" />
        <div style={{ fontSize: 40, marginBottom: 6 }}>💔</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#B91C1C", marginBottom: 6 }}>
          하트가 다 떨어졌어요
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 18, lineHeight: 1.5 }}>
          30분마다 하트가 1개씩 회복돼요.<br/>
          잠시 쉬었다가 다시 도전해요!
        </div>
        <RewardSummary sessionXp={sessionXp} award={award} finalizing={finalizing} />
        <button
          onClick={onClose}
          style={primaryBtn}
        >쉬러 가기</button>
      </div>
    );
  }

  // total=0 안전 처리 — 빈 퀴즈는 정의상 발생하면 안 되지만 방어.
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  if (total === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌱</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#1F2937", marginBottom: 16 }}>
          문제가 없어요
        </div>
        <button onClick={onClose} style={primaryBtn}>닫기</button>
      </div>
    );
  }
  const headlineEmoji = stars === 3 ? "🏆" : stars === 2 ? "🎉" : pct >= 60 ? "✨" : "💪";
  const headlineText = stars === 3 ? "완벽해요!" : stars === 2 ? "잘했어요!" : pct >= 60 ? "수고했어요!" : "다시 도전해봐요!";

  const partyLevel: "full" | "good" | "none" =
    stars === 3 ? "full" : stars === 2 ? "good" : "none";

  return (
    <div style={{ textAlign: "center", padding: "24px 16px 8px", position: "relative", overflow: "hidden" }}>
      {partyLevel !== "none" && <Confetti level={partyLevel} />}
      <div style={{
        position: "relative", zIndex: 1, display: "inline-block",
        animation: "beeCelebrateIn 0.6s cubic-bezier(.2,1.4,.4,1) both",
      }}>
        <BeeMascot size={104} mood={stars !== null && stars >= 2 ? "cheer" : pct >= 60 ? "celebrate" : "think"} />
      </div>
      <div style={{ fontSize: 40, marginBottom: 4, position: "relative", zIndex: 1 }}>{headlineEmoji}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: PURPLE_DARK, marginBottom: 4 }}>
        {headlineText}
      </div>
      {lessonTitle && (
        <div style={{ fontSize: 13, fontWeight: 800, color: "#6B7280", marginBottom: 14 }}>
          {lessonTitle}
        </div>
      )}

      {/* 별 */}
      {stars !== null && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                fontSize: 40,
                opacity: s <= stars ? 1 : 0.25,
                animation: s <= stars ? `starPop 0.55s ease ${0.1 * s}s both` : undefined,
                filter: s <= stars ? "drop-shadow(0 4px 8px rgba(245,158,11,0.45))" : "none",
              }}
            >⭐</div>
          ))}
        </div>
      )}

      {/* 핵심 지표 카드 3개 */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8, marginBottom: 16,
      }}>
        <Stat icon="🎯" label="정답률" value={`${pct}%`} />
        <Stat icon="✓" label="정답" value={`${correct} / ${total}`} />
        <Stat icon="🔥" label="최고 콤보" value={String(combo)} />
      </div>

      {/* 적립 결과 */}
      <RewardSummary sessionXp={sessionXp} award={award} finalizing={finalizing} />

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
        <button onClick={onRetry} style={secondaryBtn}>↻ 다시 풀기</button>
        <button onClick={onClose} style={primaryBtn}>완료</button>
      </div>

      <style>{`
        @keyframes starPop {
          0% { transform: scale(0.3) rotate(-30deg); opacity: 0; }
          70% { transform: scale(1.2) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes barFill {
          from { width: 0; }
        }
        @keyframes beeCelebrateIn {
          0% { transform: scale(0.3) translateY(20px) rotate(-12deg); opacity: 0; }
          60% { transform: scale(1.12) translateY(-6px) rotate(5deg); opacity: 1; }
          80% { transform: scale(0.97) translateY(0) rotate(-2deg); }
          100% { transform: scale(1) translateY(0) rotate(0); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-12px) rotate(0deg); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translateY(360px) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// #6 컨페티 — 결과 화면 상단에서 색종이가 쏟아지는 축하 연출.
// full(별3)=많고 화려하게, good(별2)=절제된 양.
function Confetti({ level }: { level: "full" | "good" }) {
  const count = level === "full" ? 40 : 20;
  const colors = ["#F59E0B", "#8B5CF6", "#10B981", "#FB7185", "#3B82F6", "#FACC15"];
  const pieces = Array.from({ length: count }, (_, i) => {
    const left = (i * 97) % 100;            // 결정적 분포 (SSR/CSR 일치)
    const delay = ((i * 53) % 100) / 100;   // 0~1s
    const dur = 1.6 + (((i * 31) % 100) / 100) * 1.4; // 1.6~3.0s
    const size = 6 + ((i * 17) % 6);        // 6~11px
    const color = colors[i % colors.length];
    const round = i % 3 === 0;
    return (
      <span
        key={i}
        style={{
          position: "absolute", top: -12, left: `${left}%`,
          width: size, height: round ? size : size * 0.5,
          background: color,
          borderRadius: round ? "50%" : 2,
          animation: `confettiFall ${dur}s linear ${delay}s ${level === "full" ? 2 : 1}`,
          opacity: 0,
        }}
      />
    );
  });
  return (
    <div aria-hidden style={{
      position: "absolute", inset: 0, zIndex: 0,
      pointerEvents: "none", overflow: "hidden",
    }}>
      {pieces}
    </div>
  );
}

function RewardSummary({ sessionXp, award, finalizing }: { sessionXp: number; award: AwardResult | null; finalizing: boolean }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, #fff, ${PURPLE_LIGHT})`,
      border: `2px solid ${PURPLE}33`,
      borderRadius: 16, padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 10,
      textAlign: "left",
    }}>
      <RewardRow icon="⚡" label="획득 XP" value={`+${sessionXp}`} accent="#F59E0B" big />

      {award && (
        <>
          <RewardRow icon="📊" label="총 XP" value={String(award.state.xp)} />
          {award.leveledUp && (
            <div style={{
              background: "linear-gradient(135deg, #FDE68A, #F59E0B)",
              color: "#78350F", borderRadius: 12, padding: "10px 12px",
              fontSize: 14, fontWeight: 900, textAlign: "center",
              animation: "starPop 0.5s ease",
            }}>
              🎊 레벨업! Lv.{award.prevLevel} → Lv.{award.nextLevel}
            </div>
          )}

          {/* 데일리 골 진행바 */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, color: "#6B7280", marginBottom: 4 }}>
              <span>🎯 오늘의 목표</span>
              <span>{award.state.dailyXp} / {award.state.dailyGoal} XP</span>
            </div>
            <div style={{ height: 10, background: PURPLE_LIGHT, borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, (award.state.dailyXp / award.state.dailyGoal) * 100)}%`,
                background: award.state.dailyXp >= award.state.dailyGoal
                  ? `linear-gradient(90deg, ${GREEN}, #047857)`
                  : `linear-gradient(90deg, ${PURPLE}, ${PURPLE_DARK})`,
                animation: "barFill 0.7s ease",
              }} />
            </div>
            {award.goalReachedNow && (
              <div style={{
                marginTop: 8, padding: "8px 12px",
                background: "#ECFDF5", color: "#065F46",
                borderRadius: 10, fontSize: 13, fontWeight: 900, textAlign: "center",
              }}>
                ✨ 오늘의 목표 달성!
              </div>
            )}
          </div>

          {/* 스트릭 */}
          {award.streakGained && (
            <div style={{
              background: "linear-gradient(135deg, #FB923C, #EA580C)",
              color: "#fff", borderRadius: 12, padding: "10px 14px",
              fontSize: 14, fontWeight: 900, textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <span style={{ fontSize: 22 }}>🔥</span>
              <span>{award.state.streak}일 연속 학습 중!</span>
            </div>
          )}
        </>
      )}

      {finalizing && !award && (
        <div style={{ fontSize: 12, color: "#6B7280", textAlign: "center" }}>적립 중…</div>
      )}
    </div>
  );
}

function RewardRow({ icon, label, value, accent, big }: { icon: string; label: string; value: string; accent?: string; big?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: big ? "8px 10px" : "4px 4px",
      background: big ? "#fff" : "transparent",
      borderRadius: big ? 10 : 0,
      border: big ? `1.5px solid ${PURPLE_LIGHT}` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: big ? 20 : 16 }}>{icon}</span>
        <span style={{ fontSize: big ? 14 : 12, fontWeight: 800, color: "#374151" }}>{label}</span>
      </div>
      <div style={{
        fontSize: big ? 22 : 14, fontWeight: 900,
        color: accent ?? PURPLE_DARK,
      }}>{value}</div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{
      background: "#fff", border: `2px solid ${PURPLE}22`,
      borderRadius: 12, padding: "10px 6px",
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#6B7280", marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 900, color: PURPLE_DARK, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
  color: "#fff", border: "none", borderRadius: 14,
  padding: "12px 22px", fontSize: 15, fontWeight: 900,
  cursor: "pointer", fontFamily: "inherit",
  boxShadow: `0 6px 18px ${PURPLE}55`,
};

const secondaryBtn: React.CSSProperties = {
  background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 14,
  padding: "12px 18px", fontSize: 14, fontWeight: 900,
  cursor: "pointer", fontFamily: "inherit",
};

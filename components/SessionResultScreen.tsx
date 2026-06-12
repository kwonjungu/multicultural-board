"use client";

import { useEffect } from "react";
import type { AwardResult } from "@/lib/lms";
import BeeMascot from "./BeeMascot";

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
  // 진입 시 살짝 진동/사운드는 추후 추가 가능
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!outOfHearts && correct > 0) {
      try {
        // 가벼운 햅틱 — 모바일에서만 동작
        (window.navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }).vibrate?.(60);
      } catch { /* silent */ }
    }
  }, [outOfHearts, correct]);

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

  return (
    <div style={{ textAlign: "center", padding: "24px 16px 8px" }}>
      <BeeMascot size={104} mood={stars !== null && stars >= 2 ? "cheer" : pct >= 60 ? "celebrate" : "think"} />
      <div style={{ fontSize: 40, marginBottom: 4 }}>{headlineEmoji}</div>
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
      `}</style>
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

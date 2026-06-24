"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subscribeExpressions, recordReviewResult, filterDue, type ExpressionEntry,
} from "@/lib/expressionLog";
import { SRS_BOX_LABEL, type SrsBox } from "@/lib/srs";
import { awardXp } from "@/lib/lms";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";
const GREEN = "#10B981";
const ORANGE = "#F59E0B";

const XP_PER_REVIEW = 5;

type Phase = "front" | "back" | "done";

interface Props {
  roomCode: string;
  clientId: string;
  studentName: string;
  studentLang: string;
  onClose: () => void;
}

let serverTtsAudio: HTMLAudioElement | null = null;
async function speakKo(text: string) {
  if (typeof window === "undefined") return;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const hasVoice = voices.some((v) => v.lang.startsWith("ko"));
  if (hasVoice) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    window.speechSynthesis.speak(u);
    return;
  }
  try {
    if (serverTtsAudio) { serverTtsAudio.pause(); serverTtsAudio = null; }
    const url = `/api/tts?lang=ko&text=${encodeURIComponent(text.slice(0, 200))}`;
    const audio = new Audio(url);
    serverTtsAudio = audio;
    await audio.play();
  } catch { /* silent */ }
}

export default function ExpressionReview({
  roomCode, clientId, studentName, studentLang, onClose,
}: Props) {
  const [all, setAll] = useState<ExpressionEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("front");
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);

  useEffect(() => {
    const unsub = subscribeExpressions(roomCode, clientId, setAll);
    return unsub;
  }, [roomCode, clientId]);

  // 세션 진입 시 due 표현을 한 번 고정 — 복습 중에 새 due 가 들어와도 이번 세션엔 포함 안 함.
  const [session, setSession] = useState<ExpressionEntry[] | null>(null);
  useEffect(() => {
    if (session !== null) return; // 첫 1회만
    if (all.length === 0) return;
    const due = filterDue(all);
    if (due.length > 0) setSession(due.slice(0, 20)); // 한 세션 최대 20개
  }, [all, session]);

  const current = session?.[idx] ?? null;
  const total = session?.length ?? 0;
  const allDone = phase === "done" || (session !== null && idx >= total);

  async function handleAnswer(remembered: boolean) {
    if (!current || busy) return;
    setBusy(true);
    try {
      await recordReviewResult(roomCode, clientId, current.id, remembered);
      setReviewedCount((c) => c + 1);
      if (remembered) {
        setCorrectCount((c) => c + 1);
        setEarnedXp((x) => x + XP_PER_REVIEW);
      }
      // 다음 카드로
      if (idx + 1 >= total) {
        // 세션 종료 → XP 일괄 적립
        if (remembered) {
          // 마지막 카드 보상 포함해서 적립
          await awardXp(roomCode, clientId, earnedXp + XP_PER_REVIEW);
        } else if (earnedXp > 0) {
          await awardXp(roomCode, clientId, earnedXp);
        }
        setPhase("done");
      } else {
        setIdx((i) => i + 1);
        setPhase("front");
      }
    } catch (err) {
      console.warn("[ExpressionReview] 결과 기록 실패", err);
    } finally {
      setBusy(false);
    }
  }

  // ── 빈 상태 ──
  if (session === null && all.length > 0 && filterDue(all).length === 0) {
    return (
      <Shell onClose={onClose}>
        <div style={{ textAlign: "center", padding: "44px 16px" }}>
          <div style={{ fontSize: 56, marginBottom: 6 }}>🌿</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: PURPLE_DARK }}>
            오늘 복습할 표현이 없어요
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginTop: 8, lineHeight: 1.5 }}>
            패들렛에 새 글을 쓰면<br/>
            핵심 표현이 자동으로 모아져요.
          </div>
          <div style={{ marginTop: 18, fontSize: 12, fontWeight: 700, color: "#9CA3AF" }}>
            총 {all.length}개 표현 보관 중
          </div>
          <button onClick={onClose} style={primaryBtn(true)}>확인</button>
        </div>
      </Shell>
    );
  }
  if (all.length === 0) {
    return (
      <Shell onClose={onClose}>
        <div style={{ textAlign: "center", padding: "44px 16px" }}>
          <div style={{ fontSize: 56, marginBottom: 6 }}>📝</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: PURPLE_DARK }}>
            아직 모은 표현이 없어요
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginTop: 8, lineHeight: 1.5 }}>
            패들렛에 글을 쓰면<br/>
            중요한 표현이 자동으로 모여요!
          </div>
          <button onClick={onClose} style={primaryBtn(true)}>확인</button>
        </div>
      </Shell>
    );
  }

  // ── 완료 ──
  if (allDone) {
    return (
      <Shell onClose={onClose}>
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 64, marginBottom: 4 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: PURPLE_DARK, marginBottom: 14 }}>
            복습 완료!
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14,
          }}>
            <Stat icon="📝" label="복습" value={String(reviewedCount)} />
            <Stat icon="✓" label="기억함" value={`${correctCount} / ${reviewedCount}`} />
            <Stat icon="⚡" label="획득 XP" value={`+${earnedXp}`} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 18, lineHeight: 1.5 }}>
            틀린 표현은 내일 다시 만나요.<br/>
            맞춘 표현은 박스가 한 단계 올라갔어요!
          </div>
          <button onClick={onClose} style={primaryBtn(true)}>닫기</button>
        </div>
      </Shell>
    );
  }

  if (!current) {
    return (
      <Shell onClose={onClose}>
        <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>준비 중…</div>
      </Shell>
    );
  }

  // ── 복습 카드 ──
  return (
    <Shell onClose={onClose}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, paddingBottom: 10, borderBottom: `2px solid ${PURPLE_LIGHT}`,
      }}>
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            background: PURPLE_LIGHT, border: "none", borderRadius: 10,
            padding: "6px 10px", fontSize: 16, fontWeight: 900, color: PURPLE_DARK,
            cursor: "pointer", fontFamily: "inherit", minWidth: 36,
          }}
        >✕</button>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#6B7280" }}>
          📝 표현 복습 {idx + 1} / {total}
        </div>
        <div style={{
          background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
          color: "#78350F", fontSize: 12, fontWeight: 900,
          padding: "4px 10px", borderRadius: 999,
        }}>+{earnedXp} XP</div>
      </div>

      {/* 진행바 */}
      <div style={{
        height: 8, background: PURPLE_LIGHT, borderRadius: 999,
        overflow: "hidden", margin: "10px 0 18px",
      }}>
        <div style={{
          height: "100%", background: `linear-gradient(90deg, ${PURPLE}, ${PURPLE_DARK})`,
          width: `${(idx / total) * 100}%`,
          transition: "width 0.3s ease",
        }} />
      </div>

      {/* 박스 배지 */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <span style={{
          background: PURPLE_LIGHT, color: PURPLE_DARK,
          fontSize: 11, fontWeight: 900, padding: "4px 12px", borderRadius: 999,
        }}>
          📦 박스 {current.box} · 다음 {SRS_BOX_LABEL[current.box as SrsBox]}
        </span>
      </div>

      {/* 카드 */}
      <div style={{
        background: `linear-gradient(135deg, #fff, ${PURPLE_LIGHT})`,
        border: `3px solid ${PURPLE_DARK}`,
        borderRadius: 20, padding: "30px 22px", textAlign: "center",
        minHeight: 180,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 14, marginBottom: 14,
        boxShadow: `0 10px 24px ${PURPLE}33`,
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", lineHeight: 1.4 }}>
          {current.text}
        </div>
        <button
          onClick={() => speakKo(current.text)}
          aria-label="듣기"
          style={{
            background: PURPLE_LIGHT, border: `2px solid ${PURPLE}55`, borderRadius: 999,
            padding: "8px 18px", fontSize: 16, fontWeight: 900, color: PURPLE_DARK,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >🔊 듣기</button>

        {phase === "back" && current.translation && (
          <div style={{
            marginTop: 6, padding: "10px 14px",
            background: "#FEF3C7", border: "1.5px dashed #F59E0B",
            borderRadius: 12, fontSize: 15, fontWeight: 800, color: "#78350F",
            maxWidth: "100%",
          }}>
            🌐 {current.translation}
          </div>
        )}
      </div>

      {/* 액션 */}
      {phase === "front" ? (
        <button
          onClick={() => setPhase("back")}
          disabled={busy}
          style={primaryBtn(true)}
        >👁️ 뜻 보기</button>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => handleAnswer(false)}
            disabled={busy}
            style={{
              flex: 1,
              background: "#FEF2F2", color: "#B91C1C",
              border: "2px solid #FCA5A5", borderRadius: 14,
              padding: "12px", fontSize: 14, fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}
          >🤔 모르겠어요</button>
          <button
            onClick={() => handleAnswer(true)}
            disabled={busy}
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${GREEN}, #047857)`,
              color: "#fff", border: "none", borderRadius: 14,
              padding: "12px", fontSize: 14, fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit",
              boxShadow: `0 4px 12px ${GREEN}55`,
            }}
          >✓ 기억나요 (+{XP_PER_REVIEW} XP)</button>
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 11, fontWeight: 700, color: "#9CA3AF", textAlign: "center" }}>
        {current.source !== "manual" && "패들렛에 쓴 글에서 자동으로 모았어요"}
      </div>
    </Shell>
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

function primaryBtn(full: boolean): React.CSSProperties {
  return {
    width: full ? "100%" : undefined,
    marginTop: 10,
    background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
    color: "#fff", border: "none", borderRadius: 14,
    padding: "14px 22px", fontSize: 15, fontWeight: 900,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: `0 6px 18px ${PURPLE}55`,
  };
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(15, 10, 40, 0.78)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520,
          background: "#fff", borderRadius: "24px 24px 0 0",
          padding: "14px 18px 22px",
          maxHeight: "94vh", overflow: "auto",
          boxShadow: "0 -16px 48px rgba(0,0,0,0.3)",
          animation: "slideUp 0.25s ease",
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(60px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}

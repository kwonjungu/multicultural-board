"use client";

import { useEffect, useMemo, useState, CSSProperties } from "react";
import { WYR_CARDS, WYRCard, tr, pickN } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

type Vote = "A" | "B" | null;
type Phase = "intro" | "voting" | "reveal";

const OPT_A_BG = "#FEF3C7"; // yellow
const OPT_A_ACCENT = "#F59E0B";
const OPT_B_BG = "#DBEAFE"; // blue
const OPT_B_ACCENT = "#2563EB";

const DECK_SIZE = 20;

// ==============================================================
// Main component
// ==============================================================
export default function WouldYouRather({ langA, langB }: { langA: string; langB: string }) {
  const [resetKey, setResetKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [voteA, setVoteA] = useState<Vote>(null);
  const [voteB, setVoteB] = useState<Vote>(null);
  const [stats, setStats] = useState<{ played: number; matched: number }>({ played: 0, matched: 0 });

  const deck = useMemo<WYRCard[]>(() => pickN(WYR_CARDS, DECK_SIZE), [resetKey]);
  const card = deck[idx];

  function handleVote(side: "left" | "right", option: "A" | "B") {
    // left hit-area = 학생 A, right hit-area = 학생 B
    if (side === "left") {
      if (voteA) return;
      setVoteA(option);
    } else {
      if (voteB) return;
      setVoteB(option);
    }
  }

  // Auto-reveal once both voted
  useEffect(() => {
    if (phase === "voting" && voteA !== null && voteB !== null) {
      const matched = voteA === voteB;
      setStats((s) => ({ played: s.played + 1, matched: s.matched + (matched ? 1 : 0) }));
      setPhase("reveal");
    }
  }, [phase, voteA, voteB]);

  function nextCard() {
    const n = idx + 1;
    setVoteA(null);
    setVoteB(null);
    if (n >= deck.length) {
      // End of deck — back to intro, keep stats visible
      setPhase("intro");
      setIdx(0);
      setResetKey((k) => k + 1);
    } else {
      setIdx(n);
      setPhase("voting");
    }
  }

  function endGame() {
    setPhase("intro");
    setIdx(0);
    setVoteA(null);
    setVoteB(null);
    setStats({ played: 0, matched: 0 });
    setResetKey((k) => k + 1);
  }

  function startGame() {
    setPhase("voting");
    setIdx(0);
    setVoteA(null);
    setVoteB(null);
  }

  // ----------------- intro -----------------
  if (phase === "intro") {
    return <IntroPanel langA={langA} langB={langB} stats={stats} onStart={startGame} />;
  }

  // ----------------- voting -----------------
  if (phase === "voting") {
    return (
      <div style={{ padding: "14px 12px 28px", maxWidth: 560, margin: "0 auto" }}>
        <StatsBar stats={stats} idx={idx} total={deck.length} />
        <VoteCard
          card={card}
          langA={langA}
          langB={langB}
          voteA={voteA}
          voteB={voteB}
          onVote={handleVote}
        />
        <HintFooter voteA={voteA} voteB={voteB} />
      </div>
    );
  }

  // ----------------- reveal -----------------
  return (
    <div style={{ padding: "14px 12px 28px", maxWidth: 560, margin: "0 auto" }}>
      <StatsBar stats={stats} idx={idx} total={deck.length} />
      <RevealPanel
        card={card}
        langA={langA}
        langB={langB}
        voteA={voteA}
        voteB={voteB}
        onNext={nextCard}
        onEnd={endGame}
      />
    </div>
  );
}

// ==============================================================
// Intro panel
// ==============================================================
function IntroPanel({
  langA, langB, stats, onStart,
}: {
  langA: string; langB: string;
  stats: { played: number; matched: number };
  onStart: () => void;
}) {
  const rate = stats.played > 0 ? Math.round((stats.matched / stats.played) * 100) : 0;
  return (
    <div style={{ padding: "32px 20px 40px", textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ fontSize: 64, lineHeight: 1 }} aria-hidden="true">🎲</div>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: "#9A3412", margin: "12px 0 6px" }}>
        이거 저거 고르기
      </h2>
      <div style={{ fontSize: 14, color: "#7C2D12", fontWeight: 700, lineHeight: 1.55, marginBottom: 20 }}>
        둘 중 뭐가 더 좋아?<br />
        정답은 없어요 — 서로 이야기하면서 친해져요!
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
        margin: "0 auto 18px", maxWidth: 360,
      }}>
        <div style={{
          background: OPT_A_BG, borderRadius: 18, padding: "14px 10px",
          border: `2px solid ${OPT_A_ACCENT}55`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#92400E", letterSpacing: 1 }}>왼쪽 탭</div>
          <div style={{ fontSize: 28, marginTop: 4 }}>🐝</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#78350F", marginTop: 2 }}>학생 A ({langA})</div>
        </div>
        <div style={{
          background: OPT_B_BG, borderRadius: 18, padding: "14px 10px",
          border: `2px solid ${OPT_B_ACCENT}55`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#1E40AF", letterSpacing: 1 }}>오른쪽 탭</div>
          <div style={{ fontSize: 28, marginTop: 4 }}>🐝</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#1E3A8A", marginTop: 2 }}>학생 B ({langB})</div>
        </div>
      </div>

      {stats.played > 0 && (
        <div style={{
          margin: "0 auto 18px", maxWidth: 360,
          background: "#fff", borderRadius: 14, padding: "12px 14px",
          border: "2px dashed #FCD34D", color: "#78350F",
          fontSize: 13, fontWeight: 800,
        }}>
          방금 게임 결과: 함께 {stats.played}장 · 취향 일치 {rate}%
        </div>
      )}

      <button
        onClick={onStart}
        aria-label="시작하기"
        style={{
          background: "linear-gradient(180deg, #FB923C, #EA580C)",
          color: "#fff", border: "none", borderRadius: 999,
          padding: "14px 32px", fontSize: 16, fontWeight: 900,
          cursor: "pointer", boxShadow: "0 8px 22px rgba(234,88,12,0.35)",
        }}
      >
        🎲 시작하기
      </button>
    </div>
  );
}

// ==============================================================
// Stats bar (progress + match rate)
// ==============================================================
function StatsBar({
  stats, idx, total,
}: {
  stats: { played: number; matched: number };
  idx: number;
  total: number;
}) {
  const rate = stats.played > 0 ? Math.round((stats.matched / stats.played) * 100) : 0;
  const pct = ((idx) / total) * 100;
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "10px 12px",
      border: "2px solid #FED7AA", marginBottom: 12,
      boxShadow: "0 4px 12px rgba(249,115,22,0.12)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 800, color: "#9A3412" }}>
        <span>📘 카드 {idx + 1} / {total}</span>
        <span>함께 {stats.played}장 · 취향 일치 {rate}%</span>
      </div>
      <div style={{
        marginTop: 6, height: 6, borderRadius: 999,
        background: "#FFEDD5", overflow: "hidden",
      }} aria-hidden="true">
        <div style={{
          width: `${pct}%`, height: "100%",
          background: "linear-gradient(90deg, #FB923C, #EA580C)",
          transition: "width 0.3s",
        }} />
      </div>
    </div>
  );
}

// ==============================================================
// Vote card — two options stacked, each tapped by A (left) or B (right)
// ==============================================================
function VoteCard({
  card, langA, langB, voteA, voteB, onVote,
}: {
  card: WYRCard;
  langA: string;
  langB: string;
  voteA: Vote;
  voteB: Vote;
  onVote: (side: "left" | "right", option: "A" | "B") => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <OptionRow
        option="A"
        emoji={card.optionA.emoji}
        labelA={tr(card.optionA.label, langA)}
        labelB={tr(card.optionA.label, langB)}
        voteA={voteA}
        voteB={voteB}
        onVote={onVote}
      />
      <div style={{
        textAlign: "center", fontSize: 12, fontWeight: 900,
        color: "#9A3412", letterSpacing: 2,
      }} aria-hidden="true">
        — VS —
      </div>
      <OptionRow
        option="B"
        emoji={card.optionB.emoji}
        labelA={tr(card.optionB.label, langA)}
        labelB={tr(card.optionB.label, langB)}
        voteA={voteA}
        voteB={voteB}
        onVote={onVote}
      />
    </div>
  );
}

function OptionRow({
  option, emoji, labelA, labelB, voteA, voteB, onVote,
}: {
  option: "A" | "B";
  emoji: string;
  labelA: string;
  labelB: string;
  voteA: Vote;
  voteB: Vote;
  onVote: (side: "left" | "right", option: "A" | "B") => void;
}) {
  const bg = option === "A" ? OPT_A_BG : OPT_B_BG;
  const accent = option === "A" ? OPT_A_ACCENT : OPT_B_ACCENT;
  const textCol = option === "A" ? "#78350F" : "#1E3A8A";

  const pickedByA = voteA === option;
  const pickedByB = voteB === option;
  // If A already voted and this option wasn't chosen → show ? (hidden)
  const hiddenFromA = voteA !== null && voteA !== option;
  const hiddenFromB = voteB !== null && voteB !== option;

  const leftDisabled = voteA !== null;
  const rightDisabled = voteB !== null;

  const baseCellStyle: CSSProperties = {
    flex: 1, minHeight: 96,
    background: "transparent", border: "none", cursor: "pointer",
    padding: "10px 8px",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 4,
    color: textCol, fontWeight: 800, fontSize: 13, lineHeight: 1.3, textAlign: "center",
  };

  return (
    <div
      style={{
        background: bg,
        borderRadius: 24,
        border: `3px solid ${accent}55`,
        boxShadow: `0 6px 18px ${accent}22`,
        overflow: "hidden",
      }}
    >
      {/* Top — emoji + labels */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px 10px",
        background: `${accent}11`,
      }}>
        <div style={{
          fontSize: 44, lineHeight: 1,
          width: 60, textAlign: "center", flexShrink: 0,
        }} aria-hidden="true">
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: textCol, lineHeight: 1.3 }}>
            {labelA}
          </div>
          <div style={{ fontSize: 12, color: `${textCol}AA`, marginTop: 2, lineHeight: 1.3 }}>
            {labelB}
          </div>
        </div>
      </div>

      {/* Bottom — split tap area */}
      <div style={{
        display: "flex",
        borderTop: `2px dashed ${accent}66`,
      }}>
        {/* Left half = 학생 A */}
        <button
          onClick={() => onVote("left", option)}
          disabled={leftDisabled}
          aria-label={`학생 A: ${option === "A" ? "첫 번째" : "두 번째"} 선택`}
          aria-pressed={pickedByA}
          style={{
            ...baseCellStyle,
            background: pickedByA ? `${OPT_A_ACCENT}2A` : "transparent",
            cursor: leftDisabled ? "default" : "pointer",
            borderRight: `2px dashed ${accent}66`,
            opacity: leftDisabled && !pickedByA ? 0.55 : 1,
          }}
        >
          {pickedByA ? (
            <>
              <span style={{ fontSize: 28 }} aria-hidden="true">🐝</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: OPT_A_ACCENT }}>✓ 학생 A</span>
            </>
          ) : hiddenFromA ? (
            <>
              <span style={{ fontSize: 28, opacity: 0.35 }} aria-hidden="true">❔</span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>학생 A 다른 쪽</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 22, opacity: 0.7 }} aria-hidden="true">👆</span>
              <span style={{ fontSize: 11, color: textCol, opacity: 0.8 }}>학생 A 탭</span>
            </>
          )}
        </button>

        {/* Right half = 학생 B */}
        <button
          onClick={() => onVote("right", option)}
          disabled={rightDisabled}
          aria-label={`학생 B: ${option === "A" ? "첫 번째" : "두 번째"} 선택`}
          aria-pressed={pickedByB}
          style={{
            ...baseCellStyle,
            background: pickedByB ? `${OPT_B_ACCENT}22` : "transparent",
            cursor: rightDisabled ? "default" : "pointer",
            opacity: rightDisabled && !pickedByB ? 0.55 : 1,
          }}
        >
          {pickedByB ? (
            <>
              <span style={{ fontSize: 28 }} aria-hidden="true">🐝</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: OPT_B_ACCENT }}>✓ 학생 B</span>
            </>
          ) : hiddenFromB ? (
            <>
              <span style={{ fontSize: 28, opacity: 0.35 }} aria-hidden="true">❔</span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>학생 B 다른 쪽</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 22, opacity: 0.7 }} aria-hidden="true">👆</span>
              <span style={{ fontSize: 11, color: textCol, opacity: 0.8 }}>학생 B 탭</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function HintFooter({ voteA, voteB }: { voteA: Vote; voteB: Vote }) {
  const aDone = voteA !== null;
  const bDone = voteB !== null;
  return (
    <div style={{
      marginTop: 14, textAlign: "center",
      fontSize: 12, fontWeight: 800, color: "#7C2D12",
    }}>
      {aDone && bDone ? "공개하는 중..." :
        aDone ? "학생 A 골랐어! 학생 B 차례 🎯" :
        bDone ? "학생 B 골랐어! 학생 A 차례 🎯" :
        "양쪽 모두 골라야 공개돼요 🤫"}
    </div>
  );
}

// ==============================================================
// Reveal panel
// ==============================================================
function RevealPanel({
  card, langA, langB, voteA, voteB, onNext, onEnd,
}: {
  card: WYRCard;
  langA: string;
  langB: string;
  voteA: Vote;
  voteB: Vote;
  onNext: () => void;
  onEnd: () => void;
}) {
  const match = voteA === voteB;

  return (
    <div style={{ position: "relative" }}>
      {match && <Confetti />}

      <div style={{
        background: "#fff", borderRadius: 24,
        border: `3px solid ${match ? "#10B981" : "#F472B6"}55`,
        padding: "22px 18px 18px",
        textAlign: "center",
        boxShadow: `0 10px 28px ${match ? "rgba(16,185,129,0.18)" : "rgba(244,114,182,0.18)"}`,
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <BeeMascot size={90} mood={match ? "celebrate" : "think"} />
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: match ? "#047857" : "#9D174D", marginBottom: 4 }}>
          {match ? "🤝 비슷해!" : "🌈 달라서 재밌어!"}
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 700, marginBottom: 16 }}>
          {match ? "둘 다 같은 걸 골랐어요" : "둘 다 멋진 선택이에요"}
        </div>

        {/* Two-column reveal */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16,
        }}>
          <ChoiceCard
            role="A"
            pickedOption={voteA}
            card={card}
            lang={langA}
          />
          <ChoiceCard
            role="B"
            pickedOption={voteB}
            card={card}
            lang={langB}
          />
        </div>

        {/* Follow-up */}
        <div style={{
          background: "#FFF7ED", borderRadius: 16,
          padding: "14px 16px", textAlign: "left",
          border: "2px dashed #FDBA74",
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#9A3412", letterSpacing: 1.2, marginBottom: 6 }}>
            💬 이야기해봐
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1F2937", lineHeight: 1.5 }}>
            {tr(card.followUp, langA)}
          </div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4, lineHeight: 1.5 }}>
            {tr(card.followUp, langB)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          onClick={onEnd}
          aria-label="끝내기"
          style={{
            flex: 1, padding: "12px 16px", borderRadius: 14,
            background: "#fff", border: "2px solid #FCD34D",
            color: "#92400E", fontWeight: 900, fontSize: 14,
            cursor: "pointer",
          }}
        >
          끝내기
        </button>
        <button
          onClick={onNext}
          aria-label="다음 카드"
          style={{
            flex: 2, padding: "12px 16px", borderRadius: 14,
            background: "linear-gradient(180deg, #FB923C, #EA580C)",
            border: "none", color: "#fff", fontWeight: 900, fontSize: 15,
            cursor: "pointer", boxShadow: "0 6px 16px rgba(234,88,12,0.35)",
          }}
        >
          다음 카드 →
        </button>
      </div>
    </div>
  );
}

function ChoiceCard({
  role, pickedOption, card, lang,
}: {
  role: "A" | "B";
  pickedOption: Vote;
  card: WYRCard;
  lang: string;
}) {
  const roleColor = role === "A" ? OPT_A_ACCENT : OPT_B_ACCENT;
  const roleBg = role === "A" ? OPT_A_BG : OPT_B_BG;
  const picked = pickedOption === "A" ? card.optionA : pickedOption === "B" ? card.optionB : null;

  return (
    <div style={{
      background: roleBg, borderRadius: 16,
      border: `2px solid ${roleColor}55`,
      padding: "12px 8px",
    }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: roleColor, letterSpacing: 1 }}>
        학생 {role}
      </div>
      <div style={{ fontSize: 38, marginTop: 6 }} aria-hidden="true">
        {picked ? picked.emoji : "❔"}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#1F2937", marginTop: 4, lineHeight: 1.3 }}>
        {picked ? tr(picked.label, lang) : "-"}
      </div>
    </div>
  );
}

// ==============================================================
// Confetti — lightweight transform/opacity sprites
// ==============================================================
function Confetti() {
  const pieces = useMemo(() => {
    const arr: { left: number; delay: number; emoji: string; rot: number; dur: number }[] = [];
    const emojis = ["🎊", "🌸", "✨", "🎉", "🌼"];
    for (let i = 0; i < 18; i++) {
      arr.push({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        emoji: emojis[i % emojis.length],
        rot: (Math.random() - 0.5) * 360,
        dur: 1.6 + Math.random() * 1.0,
      });
    }
    return arr;
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        overflow: "hidden", zIndex: 3,
      }}
    >
      <style>{`
        @keyframes wyrConfettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(320px) rotate(var(--r, 180deg)); opacity: 0; }
        }
      `}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            fontSize: 22,
            animation: `wyrConfettiFall ${p.dur}s ease-out ${p.delay}s forwards`,
            ["--r" as string]: `${p.rot}deg`,
          } as CSSProperties}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

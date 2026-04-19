"use client";

import { useEffect, useMemo, useState, CSSProperties } from "react";
import { WYR_CARDS, WYRCard, WYRCategory, tr, pickN } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

type Vote = "A" | "B" | null;
type Phase = "intro" | "voting" | "reveal" | "summary";

const OPT_A_BG = "#FEF3C7"; // yellow
const OPT_A_ACCENT = "#F59E0B";
const OPT_B_BG = "#DBEAFE"; // blue
const OPT_B_ACCENT = "#2563EB";

const PLAYER_A_BG = "#FDF2F8"; // pink
const PLAYER_A_ACCENT = "#DB2777";
const PLAYER_B_BG = "#ECFDF5"; // green
const PLAYER_B_ACCENT = "#059669";

const DECK_SIZE = 20;

const CATEGORIES: WYRCategory[] = ["food", "season", "school", "home", "taste"];
const CATEGORY_META: Record<WYRCategory, { emoji: string; label: string; color: string }> = {
  food:   { emoji: "🍚", label: "음식",   color: "#EA580C" },
  season: { emoji: "🌸", label: "계절",   color: "#10B981" },
  school: { emoji: "🏫", label: "학교",   color: "#2563EB" },
  home:   { emoji: "🏠", label: "집",     color: "#A855F7" },
  taste:  { emoji: "👅", label: "취향",   color: "#DB2777" },
};

interface CategoryStats {
  played: number;
  matched: number;
}

type ByCategory = Record<WYRCategory, CategoryStats>;

interface StatsState {
  played: number;
  matched: number;
  byCategory: ByCategory;
  history: { category: WYRCategory; matched: boolean }[];
}

const INITIAL_BY_CATEGORY: ByCategory = {
  food:   { played: 0, matched: 0 },
  season: { played: 0, matched: 0 },
  school: { played: 0, matched: 0 },
  home:   { played: 0, matched: 0 },
  taste:  { played: 0, matched: 0 },
};

const INITIAL_STATS: StatsState = {
  played: 0,
  matched: 0,
  byCategory: INITIAL_BY_CATEGORY,
  history: [],
};

// ==============================================================
// Main component
// ==============================================================
export default function WouldYouRather({ langA, langB }: { langA: string; langB: string }) {
  const [resetKey, setResetKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [voteA, setVoteA] = useState<Vote>(null);
  const [voteB, setVoteB] = useState<Vote>(null);
  const [stats, setStats] = useState<StatsState>(INITIAL_STATS);

  const deck = useMemo<WYRCard[]>(() => pickN(WYR_CARDS, DECK_SIZE), [resetKey]);
  const card = deck[idx];

  function handleVote(player: "A" | "B", option: "A" | "B") {
    if (player === "A") {
      if (voteA) return;
      setVoteA(option);
    } else {
      if (voteB) return;
      setVoteB(option);
    }
  }

  // Auto-reveal once both voted
  useEffect(() => {
    if (phase === "voting" && voteA !== null && voteB !== null && card) {
      const matched = voteA === voteB;
      setStats((s) => {
        const prev = s.byCategory[card.category];
        return {
          played: s.played + 1,
          matched: s.matched + (matched ? 1 : 0),
          byCategory: {
            ...s.byCategory,
            [card.category]: {
              played: prev.played + 1,
              matched: prev.matched + (matched ? 1 : 0),
            },
          },
          history: [...s.history, { category: card.category, matched }],
        };
      });
      setPhase("reveal");
    }
  }, [phase, voteA, voteB, card]);

  function nextCard() {
    const n = idx + 1;
    setVoteA(null);
    setVoteB(null);
    if (n >= deck.length) {
      // End of deck → summary
      setPhase("summary");
    } else {
      setIdx(n);
      setPhase("voting");
    }
  }

  function endGame() {
    // Go to summary
    setVoteA(null);
    setVoteB(null);
    setPhase("summary");
  }

  function restartFromSummary() {
    setPhase("intro");
    setIdx(0);
    setVoteA(null);
    setVoteB(null);
    setStats(INITIAL_STATS);
    setResetKey((k) => k + 1);
  }

  function startGame() {
    setPhase("voting");
    setIdx(0);
    setVoteA(null);
    setVoteB(null);
    setStats(INITIAL_STATS);
  }

  // ----------------- intro -----------------
  if (phase === "intro") {
    return <IntroPanel langA={langA} langB={langB} stats={stats} onStart={startGame} />;
  }

  // ----------------- summary -----------------
  if (phase === "summary") {
    return <SummaryPanel stats={stats} onRestart={restartFromSummary} />;
  }

  // ----------------- voting -----------------
  if (phase === "voting") {
    return (
      <div style={{ padding: "14px 12px 28px", maxWidth: 560, margin: "0 auto" }}>
        <StatsBar stats={stats} idx={idx} total={deck.length} />
        <VoteCardNew
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
        stats={stats}
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
  stats: StatsState;
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
          background: PLAYER_A_BG, borderRadius: 18, padding: "14px 10px",
          border: `2px solid ${PLAYER_A_ACCENT}55`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: PLAYER_A_ACCENT, letterSpacing: 1 }}>왼쪽</div>
          <div style={{ fontSize: 28, marginTop: 4 }}>🐝</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#9D174D", marginTop: 2 }}>학생 A ({langA})</div>
        </div>
        <div style={{
          background: PLAYER_B_BG, borderRadius: 18, padding: "14px 10px",
          border: `2px solid ${PLAYER_B_ACCENT}55`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: PLAYER_B_ACCENT, letterSpacing: 1 }}>오른쪽</div>
          <div style={{ fontSize: 28, marginTop: 4 }}>🐝</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#065F46", marginTop: 2 }}>학생 B ({langB})</div>
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
  stats: StatsState;
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
        <span>함께 {stats.played}장 · 일치 {rate}%</span>
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
// Vote Card (NEW) — HeaderVS + SplitVoteArea
// ==============================================================
function VoteCardNew({
  card, langA, langB, voteA, voteB, onVote,
}: {
  card: WYRCard;
  langA: string;
  langB: string;
  voteA: Vote;
  voteB: Vote;
  onVote: (player: "A" | "B", option: "A" | "B") => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <HeaderVS card={card} langA={langA} langB={langB} />
      <SplitVoteArea
        card={card}
        langA={langA}
        langB={langB}
        voteA={voteA}
        voteB={voteB}
        onVote={onVote}
      />
    </div>
  );
}

// --------------------------------------------------------------
// HeaderVS — 상단: 대상 A VS 대상 B
// --------------------------------------------------------------
function HeaderVS({ card, langA, langB }: { card: WYRCard; langA: string; langB: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 22,
      border: "3px solid #FED7AA",
      boxShadow: "0 8px 22px rgba(234,88,12,0.12)",
      padding: "14px 12px",
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      gap: 8,
    }}>
      <OptionHero option="A" card={card} langA={langA} langB={langB} />
      <div
        aria-hidden="true"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(180deg, #FB923C, #EA580C)",
          color: "#fff", fontWeight: 900, fontSize: 14, letterSpacing: 0.5,
          boxShadow: "0 4px 10px rgba(234,88,12,0.35)",
          flexShrink: 0,
        }}
      >
        VS
      </div>
      <OptionHero option="B" card={card} langA={langA} langB={langB} />
    </div>
  );
}

function OptionHero({
  option, card, langA, langB,
}: {
  option: "A" | "B";
  card: WYRCard;
  langA: string;
  langB: string;
}) {
  const bg = option === "A" ? OPT_A_BG : OPT_B_BG;
  const accent = option === "A" ? OPT_A_ACCENT : OPT_B_ACCENT;
  const textCol = option === "A" ? "#78350F" : "#1E3A8A";
  const opt = option === "A" ? card.optionA : card.optionB;

  return (
    <div style={{
      background: bg,
      borderRadius: 16,
      border: `2px solid ${accent}55`,
      padding: "10px 8px",
      textAlign: "center",
      minWidth: 0,
    }}>
      <div style={{
        display: "inline-block",
        background: accent, color: "#fff",
        fontSize: 10, fontWeight: 900, letterSpacing: 1,
        padding: "2px 8px", borderRadius: 999, marginBottom: 4,
      }}>
        {option}
      </div>
      <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">
        {opt.emoji}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 900, color: textCol,
        marginTop: 4, lineHeight: 1.25,
        overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {tr(opt.label, langA)}
      </div>
      <div style={{
        fontSize: 11, color: `${textCol}AA`, fontWeight: 700,
        marginTop: 2, lineHeight: 1.25,
        overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {tr(opt.label, langB)}
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// SplitVoteArea — 2 players × 2 options grid
// --------------------------------------------------------------
function SplitVoteArea({
  card, langA, langB, voteA, voteB, onVote,
}: {
  card: WYRCard;
  langA: string;
  langB: string;
  voteA: Vote;
  voteB: Vote;
  onVote: (player: "A" | "B", option: "A" | "B") => void;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    }}>
      <PlayerColumn
        player="A"
        card={card}
        lang={langA}
        myVote={voteA}
        disabled={voteA !== null}
        onVote={(opt) => onVote("A", opt)}
      />
      <PlayerColumn
        player="B"
        card={card}
        lang={langB}
        myVote={voteB}
        disabled={voteB !== null}
        onVote={(opt) => onVote("B", opt)}
      />
    </div>
  );
}

function PlayerColumn({
  player, card, lang, myVote, disabled, onVote,
}: {
  player: "A" | "B";
  card: WYRCard;
  lang: string;
  myVote: Vote;
  disabled: boolean;
  onVote: (opt: "A" | "B") => void;
}) {
  const bg = player === "A" ? PLAYER_A_BG : PLAYER_B_BG;
  const accent = player === "A" ? PLAYER_A_ACCENT : PLAYER_B_ACCENT;

  return (
    <div style={{
      background: bg,
      borderRadius: 20,
      border: `3px solid ${accent}55`,
      boxShadow: `0 4px 14px ${accent}22`,
      overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* Player header */}
      <div style={{
        background: accent, color: "#fff",
        padding: "6px 10px",
        fontSize: 12, fontWeight: 900, letterSpacing: 0.6,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <span aria-hidden="true">🐝</span>
        <span>학생 {player}</span>
        {myVote && <span aria-hidden="true" style={{ opacity: 0.85 }}>· ✓</span>}
      </div>

      {/* Split tap area: option A (top) / option B (bottom) */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <VoteCell
          player={player}
          option="A"
          card={card}
          lang={lang}
          myVote={myVote}
          disabled={disabled}
          onClick={() => onVote("A")}
        />
        <div style={{ height: 2, background: `${accent}44` }} aria-hidden="true" />
        <VoteCell
          player={player}
          option="B"
          card={card}
          lang={lang}
          myVote={myVote}
          disabled={disabled}
          onClick={() => onVote("B")}
        />
      </div>
    </div>
  );
}

function VoteCell({
  player, option, card, lang, myVote, disabled, onClick,
}: {
  player: "A" | "B";
  option: "A" | "B";
  card: WYRCard;
  lang: string;
  myVote: Vote;
  disabled: boolean;
  onClick: () => void;
}) {
  const opt = option === "A" ? card.optionA : card.optionB;
  const optBg = option === "A" ? OPT_A_BG : OPT_B_BG;
  const optAccent = option === "A" ? OPT_A_ACCENT : OPT_B_ACCENT;
  const textCol = option === "A" ? "#78350F" : "#1E3A8A";

  const isPicked = myVote === option;
  const isOther = myVote !== null && myVote !== option;

  const cellStyle: CSSProperties = {
    flex: 1, minHeight: 92,
    background: isPicked ? optBg : "#ffffffDD",
    border: "none",
    cursor: disabled ? "default" : "pointer",
    padding: "10px 6px",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 3,
    color: textCol,
    fontWeight: 800, fontSize: 12, lineHeight: 1.2,
    textAlign: "center",
    opacity: isOther ? 0.45 : 1,
    position: "relative",
    transition: "background 0.15s, opacity 0.15s",
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={`학생 ${player}가 ${option === "A" ? "A (첫 번째)" : "B (두 번째)"} 선택`}
      aria-pressed={isPicked}
      style={cellStyle}
    >
      {/* Option badge */}
      <div style={{
        position: "absolute", top: 4, left: 4,
        background: optAccent, color: "#fff",
        fontSize: 9, fontWeight: 900, letterSpacing: 0.6,
        padding: "1px 6px", borderRadius: 999,
      }} aria-hidden="true">
        {option}
      </div>

      {isPicked ? (
        <>
          <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">{opt.emoji}</span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11, fontWeight: 900, color: optAccent,
          }}>
            <span aria-hidden="true">✓</span>
            <span>골랐어!</span>
          </span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 24, lineHeight: 1, opacity: isOther ? 0.4 : 0.9 }} aria-hidden="true">
            {opt.emoji}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 800, color: textCol,
            maxWidth: "100%",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {tr(opt.label, lang)}
          </span>
        </>
      )}
    </button>
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
        "각자 자기 칸에서 A 또는 B를 탭하세요 🤫"}
    </div>
  );
}

// ==============================================================
// Reveal panel
// ==============================================================
function RevealPanel({
  card, langA, langB, voteA, voteB, stats, onNext, onEnd,
}: {
  card: WYRCard;
  langA: string;
  langB: string;
  voteA: Vote;
  voteB: Vote;
  stats: StatsState;
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

        {/* Node diagram for this card */}
        <MiniNodeDiagram card={card} voteA={voteA} voteB={voteB} langA={langA} langB={langB} />

        {/* Mini session stats */}
        <MiniSessionStats stats={stats} />

        {/* Follow-up */}
        <div style={{
          background: "#FFF7ED", borderRadius: 16,
          padding: "14px 16px", textAlign: "left",
          border: "2px dashed #FDBA74",
          marginTop: 14,
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
          aria-label="끝내기 (통계 보기)"
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

// --------------------------------------------------------------
// MiniNodeDiagram — two nodes (A/B) with their picked emoji,
// connected by solid (match) or dashed (mismatch) line
// --------------------------------------------------------------
function MiniNodeDiagram({
  card, voteA, voteB, langA, langB,
}: {
  card: WYRCard;
  voteA: Vote;
  voteB: Vote;
  langA: string;
  langB: string;
}) {
  const match = voteA === voteB;
  const pickA = voteA === "A" ? card.optionA : voteA === "B" ? card.optionB : null;
  const pickB = voteB === "A" ? card.optionA : voteB === "B" ? card.optionB : null;

  return (
    <div
      role="img"
      aria-label={match ? "두 학생 같은 선택 노드 그림" : "두 학생 다른 선택 노드 그림"}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 6,
        background: "#FAFAFA",
        borderRadius: 16,
        border: "2px solid #E5E7EB",
        padding: "12px 10px",
      }}
    >
      <NodeBubble
        role="A"
        emoji={pickA ? pickA.emoji : "❔"}
        label={pickA ? tr(pickA.label, langA) : "-"}
      />
      <ConnectorLine match={match} />
      <NodeBubble
        role="B"
        emoji={pickB ? pickB.emoji : "❔"}
        label={pickB ? tr(pickB.label, langB) : "-"}
      />
    </div>
  );
}

function NodeBubble({ role, emoji, label }: { role: "A" | "B"; emoji: string; label: string }) {
  const accent = role === "A" ? PLAYER_A_ACCENT : PLAYER_B_ACCENT;
  const bg = role === "A" ? PLAYER_A_BG : PLAYER_B_BG;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: bg, border: `3px solid ${accent}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28,
        boxShadow: `0 3px 8px ${accent}33`,
      }} aria-hidden="true">
        {emoji}
      </div>
      <div style={{ fontSize: 10, fontWeight: 900, color: accent, letterSpacing: 0.6 }}>
        학생 {role}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#374151",
        maxWidth: "100%",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {label}
      </div>
    </div>
  );
}

function ConnectorLine({ match }: { match: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      width: 56, height: 40,
      flexShrink: 0,
      position: "relative",
    }} aria-hidden="true">
      <div style={{
        flex: 1, height: 0,
        borderTop: match ? "3px solid #10B981" : "3px dashed #F472B6",
      }} />
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        background: "#fff",
        border: `2px solid ${match ? "#10B981" : "#F472B6"}`,
        color: match ? "#047857" : "#9D174D",
        fontSize: 10, fontWeight: 900,
        padding: "2px 6px", borderRadius: 999,
        whiteSpace: "nowrap",
      }}>
        {match ? "=" : "≠"}
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// MiniSessionStats — quick bar under reveal
// --------------------------------------------------------------
function MiniSessionStats({ stats }: { stats: StatsState }) {
  const rate = stats.played > 0 ? Math.round((stats.matched / stats.played) * 100) : 0;
  return (
    <div style={{
      marginTop: 14,
      display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap",
      fontSize: 11, fontWeight: 800, color: "#6B7280",
    }}>
      <span style={{
        background: "#FEF3C7", color: "#92400E",
        padding: "4px 10px", borderRadius: 999,
        border: "1px solid #FCD34D",
      }}>
        함께 {stats.played}장
      </span>
      <span style={{
        background: "#DCFCE7", color: "#166534",
        padding: "4px 10px", borderRadius: 999,
        border: "1px solid #86EFAC",
      }}>
        ✓ 일치 {stats.matched}
      </span>
      <span style={{
        background: "#E0E7FF", color: "#3730A3",
        padding: "4px 10px", borderRadius: 999,
        border: "1px solid #A5B4FC",
      }}>
        비율 {rate}%
      </span>
    </div>
  );
}

// ==============================================================
// Summary panel — final stats table + node diagram
// ==============================================================
function SummaryPanel({ stats, onRestart }: { stats: StatsState; onRestart: () => void }) {
  const rate = stats.played > 0 ? Math.round((stats.matched / stats.played) * 100) : 0;
  const hasData = stats.played > 0;

  return (
    <div style={{ padding: "18px 14px 36px", maxWidth: 560, margin: "0 auto" }}>
      {/* Headline */}
      <div style={{
        background: "linear-gradient(180deg, #FFF7ED, #FFEDD5)",
        borderRadius: 20, border: "3px solid #FDBA74",
        padding: "20px 16px", textAlign: "center",
        marginBottom: 14,
        boxShadow: "0 8px 22px rgba(234,88,12,0.15)",
      }}>
        <div style={{ fontSize: 48, lineHeight: 1 }} aria-hidden="true">📊</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "#9A3412", margin: "8px 0 4px" }}>
          우리 취향 통계표
        </h2>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#7C2D12" }}>
          함께 <strong>{stats.played}</strong>장 · 일치 <strong>{stats.matched}</strong>장 · 비율 <strong>{rate}%</strong>
        </div>
      </div>

      {!hasData && (
        <div style={{
          background: "#fff", borderRadius: 16,
          border: "2px dashed #E5E7EB",
          padding: "22px 16px", textAlign: "center",
          color: "#6B7280", fontSize: 13, fontWeight: 700,
        }}>
          아직 고른 카드가 없어요. 다시 해볼까요?
        </div>
      )}

      {hasData && (
        <>
          {/* Category node diagram */}
          <SectionHeader emoji="🕸️" title="카테고리별 취향 그물" />
          <CategoryNodeGraph stats={stats} />

          {/* Category bars */}
          <SectionHeader emoji="📈" title="카테고리별 일치율" />
          <CategoryBars stats={stats} />

          {/* Card-by-card table */}
          <SectionHeader emoji="📋" title="카드별 기록" />
          <HistoryTable history={stats.history} />
        </>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button
          onClick={onRestart}
          aria-label="처음으로"
          style={{
            flex: 1, padding: "14px 16px", borderRadius: 14,
            background: "linear-gradient(180deg, #FB923C, #EA580C)",
            border: "none", color: "#fff", fontWeight: 900, fontSize: 15,
            cursor: "pointer", boxShadow: "0 6px 16px rgba(234,88,12,0.35)",
          }}
        >
          🔄 다시 하기
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div style={{
      margin: "16px 0 8px",
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 13, fontWeight: 900, color: "#9A3412",
      letterSpacing: 0.4,
    }}>
      <span aria-hidden="true">{emoji}</span>
      <span>{title}</span>
    </div>
  );
}

// --------------------------------------------------------------
// CategoryNodeGraph — central "우리 취향" node, 5 categories around,
// line thickness = match rate
// --------------------------------------------------------------
function CategoryNodeGraph({ stats }: { stats: StatsState }) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const centerR = 38;
  const nodeR = 26;
  const ringR = 100;

  const nodes = CATEGORIES.map((cat, i) => {
    const angle = (i / CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * ringR;
    const y = cy + Math.sin(angle) * ringR;
    const s = stats.byCategory[cat];
    const rate = s.played > 0 ? s.matched / s.played : 0;
    const active = s.played > 0;
    return { cat, x, y, rate, played: s.played, matched: s.matched, active };
  });

  return (
    <div style={{
      background: "#fff", borderRadius: 18,
      border: "2px solid #FED7AA", padding: 12,
      display: "flex", justifyContent: "center",
    }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label="카테고리별 취향 일치 노드 그림. 중앙 '우리 취향' 주변에 음식, 계절, 학교, 집, 취향 노드가 선으로 연결되어 있으며 선 두께는 일치율을 나타냅니다."
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Connecting lines */}
        {nodes.map((n) => {
          if (!n.active) {
            return (
              <line
                key={`line-${n.cat}`}
                x1={cx} y1={cy} x2={n.x} y2={n.y}
                stroke="#E5E7EB"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            );
          }
          const color = CATEGORY_META[n.cat].color;
          const thick = 2 + n.rate * 8; // 2..10px
          return (
            <line
              key={`line-${n.cat}`}
              x1={cx} y1={cy} x2={n.x} y2={n.y}
              stroke={color}
              strokeWidth={thick}
              strokeLinecap="round"
              opacity={0.35 + n.rate * 0.5}
            />
          );
        })}

        {/* Center node */}
        <circle
          cx={cx} cy={cy} r={centerR}
          fill="#FFF7ED"
          stroke="#EA580C"
          strokeWidth={3}
        />
        <text
          x={cx} y={cy - 4}
          fontSize={22}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          🐝
        </text>
        <text
          x={cx} y={cy + 16}
          fontSize={10}
          fontWeight={900}
          fill="#9A3412"
          textAnchor="middle"
        >
          우리 취향
        </text>

        {/* Category nodes */}
        {nodes.map((n) => {
          const meta = CATEGORY_META[n.cat];
          const pct = n.played > 0 ? Math.round(n.rate * 100) : 0;
          return (
            <g key={`node-${n.cat}`}>
              <circle
                cx={n.x} cy={n.y} r={nodeR}
                fill="#fff"
                stroke={n.active ? meta.color : "#D1D5DB"}
                strokeWidth={n.active ? 3 : 2}
              />
              <text
                x={n.x} y={n.y - 4}
                fontSize={18}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {meta.emoji}
              </text>
              <text
                x={n.x} y={n.y + 14}
                fontSize={9}
                fontWeight={900}
                fill={n.active ? meta.color : "#9CA3AF"}
                textAnchor="middle"
              >
                {n.active ? `${pct}%` : "—"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --------------------------------------------------------------
// CategoryBars — horizontal bar chart per category
// --------------------------------------------------------------
function CategoryBars({ stats }: { stats: StatsState }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: "2px solid #FED7AA", padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat];
        const s = stats.byCategory[cat];
        const rate = s.played > 0 ? (s.matched / s.played) : 0;
        const pct = Math.round(rate * 100);
        const active = s.played > 0;

        return (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 80, display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 900, color: active ? meta.color : "#9CA3AF",
            }}>
              <span aria-hidden="true">{meta.emoji}</span>
              <span>{meta.label}</span>
            </div>
            <div style={{
              flex: 1, height: 12, borderRadius: 999,
              background: "#F3F4F6", overflow: "hidden",
              position: "relative",
            }} aria-hidden="true">
              <div style={{
                width: active ? `${Math.max(pct, 4)}%` : "0%",
                height: "100%",
                background: active ? meta.color : "transparent",
                transition: "width 0.3s",
              }} />
            </div>
            <div style={{
              width: 56, textAlign: "right",
              fontSize: 11, fontWeight: 800, color: "#374151",
            }}
            aria-label={`${meta.label} ${active ? `${s.matched}/${s.played}장 일치 ${pct}%` : "기록 없음"}`}
            >
              {active ? `${s.matched}/${s.played}` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------
// HistoryTable — card-by-card list
// --------------------------------------------------------------
function HistoryTable({ history }: { history: { category: WYRCategory; matched: boolean }[] }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: "2px solid #FED7AA", padding: "10px 10px",
      overflow: "hidden",
    }}>
      <div
        role="table"
        aria-label="카드별 기록 표"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <div
          role="row"
          style={{
            display: "grid",
            gridTemplateColumns: "48px 1fr 56px",
            gap: 6,
            padding: "6px 8px",
            fontSize: 10, fontWeight: 900, color: "#9A3412",
            letterSpacing: 0.6,
            borderBottom: "2px dashed #FED7AA",
          }}
        >
          <div role="columnheader">카드</div>
          <div role="columnheader">카테고리</div>
          <div role="columnheader" style={{ textAlign: "right" }}>결과</div>
        </div>
        {history.map((h, i) => {
          const meta = CATEGORY_META[h.category];
          return (
            <div
              role="row"
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr 56px",
                gap: 6,
                padding: "8px",
                fontSize: 12, fontWeight: 700,
                color: "#1F2937",
                borderBottom: i === history.length - 1 ? "none" : "1px dashed #F3F4F6",
                alignItems: "center",
              }}
            >
              <div role="cell" style={{ color: "#6B7280", fontWeight: 800 }}>#{i + 1}</div>
              <div role="cell" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span aria-hidden="true">{meta.emoji}</span>
                <span style={{ color: meta.color, fontWeight: 900 }}>{meta.label}</span>
              </div>
              <div role="cell" style={{ textAlign: "right" }}>
                {h.matched ? (
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      background: "#DCFCE7", color: "#166534",
                      padding: "3px 8px", borderRadius: 999,
                      fontSize: 11, fontWeight: 900,
                      border: "1px solid #86EFAC",
                    }}
                    aria-label="일치"
                  >
                    <span aria-hidden="true">✓</span>
                    <span>일치</span>
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      background: "#FCE7F3", color: "#9D174D",
                      padding: "3px 8px", borderRadius: 999,
                      fontSize: 11, fontWeight: 900,
                      border: "1px solid #F9A8D4",
                    }}
                    aria-label="다름"
                  >
                    <span aria-hidden="true">≠</span>
                    <span>다름</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
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

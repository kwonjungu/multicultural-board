"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BeeMascot from "../BeeMascot";
import { LangMap, tr } from "@/lib/gameData";

// 할리갈리 — Halli Galli style bell game.
// Split-screen 2-player. Each player turns one card at a time. When any single
// fruit's total visible count equals exactly 5, the first player to ring the
// bell wins the pile.

type Fruit = "strawberry" | "lime" | "banana" | "plum";

const FRUIT_META: Record<Fruit, { emoji: string; color: string; label: LangMap }> = {
  strawberry: { emoji: "🍓", color: "#EF4444", label: { ko: "딸기",   en: "strawberry", vi: "dâu tây",  zh: "草莓",   ja: "いちご" } },
  lime:       { emoji: "🍋", color: "#84CC16", label: { ko: "라임",   en: "lime",       vi: "chanh",    zh: "酸橙",   ja: "ライム" } },
  banana:     { emoji: "🍌", color: "#FACC15", label: { ko: "바나나", en: "banana",     vi: "chuối",    zh: "香蕉",   ja: "バナナ" } },
  plum:       { emoji: "🟣", color: "#8B5CF6", label: { ko: "자두",   en: "plum",       vi: "mận",      zh: "李子",   ja: "すもも" } },
};

interface Card { fruit: Fruit; count: 1 | 2 | 3 | 4 | 5 }

function buildDeck(): Card[] {
  const deck: Card[] = [];
  // Balanced: each fruit × each count × 2 copies = 40 cards → split 20/20
  (Object.keys(FRUIT_META) as Fruit[]).forEach((f) => {
    ([1, 2, 3, 4, 5] as const).forEach((c) => {
      deck.push({ fruit: f, count: c });
      deck.push({ fruit: f, count: c });
    });
  });
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function fruitImg(f: Fruit): string { return `/halligalli/${f}.png`; }

type Phase = "intro" | "play" | "result";

export default function HalliGalli({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionKey, setSessionKey] = useState(0);

  // Decks (private) & revealed piles (public). Pile top = latest reveal.
  const initial = useMemo(() => {
    const full = buildDeck();
    return { deckA: full.slice(0, 20), deckB: full.slice(20, 40) };
  }, [sessionKey]);
  const [deckA, setDeckA] = useState<Card[]>(initial.deckA);
  const [deckB, setDeckB] = useState<Card[]>(initial.deckB);
  const [pileA, setPileA] = useState<Card[]>([]);
  const [pileB, setPileB] = useState<Card[]>([]);
  const [turn, setTurn] = useState<"A" | "B">("A");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [flash, setFlash] = useState<{ who: "A" | "B"; kind: "hit" | "miss"; reason: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Reset local state whenever sessionKey changes (i.e. "다시하기")
    setDeckA(initial.deckA);
    setDeckB(initial.deckB);
    setPileA([]);
    setPileB([]);
    setTurn("A");
    setScoreA(0);
    setScoreB(0);
    setFlash(null);
  }, [sessionKey, initial]);

  // Auto-end when both decks empty
  useEffect(() => {
    if (phase !== "play") return;
    if (deckA.length === 0 && deckB.length === 0) {
      setPhase("result");
    }
  }, [deckA.length, deckB.length, phase]);

  function flipNext() {
    if (phase !== "play") return;
    const mine = turn === "A" ? deckA : deckB;
    if (mine.length === 0) {
      // Empty deck — switch turn automatically
      setTurn(turn === "A" ? "B" : "A");
      return;
    }
    const [top, ...rest] = mine;
    if (turn === "A") {
      setDeckA(rest);
      setPileA((p) => [top, ...p]);
    } else {
      setDeckB(rest);
      setPileB((p) => [top, ...p]);
    }
    setTurn(turn === "A" ? "B" : "A");
  }

  function totalByFruit(): Record<Fruit, number> {
    const sum: Record<Fruit, number> = { strawberry: 0, lime: 0, banana: 0, plum: 0 };
    const top = (p: Card[]) => (p.length > 0 ? p[0] : null);
    const topA = top(pileA);
    const topB = top(pileB);
    if (topA) sum[topA.fruit] += topA.count;
    if (topB) sum[topB.fruit] += topB.count;
    return sum;
  }

  function ringBell(who: "A" | "B") {
    if (phase !== "play") return;
    const totals = totalByFruit();
    const winningFruit = (Object.keys(totals) as Fruit[]).find((f) => totals[f] === 5);
    if (flashTimer.current) { clearTimeout(flashTimer.current); flashTimer.current = null; }
    if (winningFruit) {
      // Correct — collect both piles
      const gained = pileA.length + pileB.length;
      if (who === "A") setScoreA((s) => s + gained);
      else setScoreB((s) => s + gained);
      setPileA([]);
      setPileB([]);
      setFlash({ who, kind: "hit", reason: `${FRUIT_META[winningFruit].emoji} 정확히 5개!` });
    } else {
      // Wrong — penalty: pay 3 cards to opponent
      const penalty = 3;
      if (who === "A") {
        setScoreA((s) => Math.max(0, s - penalty));
        setScoreB((s) => s + penalty);
      } else {
        setScoreB((s) => Math.max(0, s - penalty));
        setScoreA((s) => s + penalty);
      }
      setFlash({ who, kind: "miss", reason: "5개가 아니에요" });
    }
    flashTimer.current = setTimeout(() => setFlash(null), 1400);
  }

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  function reset() { setSessionKey((k) => k + 1); setPhase("intro"); }

  const totals = phase === "play" ? totalByFruit() : null;

  if (phase === "intro") {
    return (
      <div style={wrap}>
        <div style={{ textAlign: "center", padding: "24px 10px" }}>
          <div style={{ fontSize: 72, margin: "10px 0 8px" }}>🔔</div>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: "#1F2937", margin: "0 0 6px" }}>할리갈리</h2>
          <p style={{ fontSize: 14, color: "#6B7280", fontWeight: 600, margin: 0 }}>
            같은 과일이 <b>정확히 5개</b>가 되면 종을 누르세요!
          </p>
        </div>
        <button
          onClick={() => setPhase("play")}
          style={primaryBtn}
        >🎮 시작하기</button>
        <Rules langA={langA} langB={langB} />
      </div>
    );
  }

  if (phase === "result") {
    const winner = scoreA === scoreB ? null : scoreA > scoreB ? "A" : "B";
    return (
      <div style={{ ...wrap, textAlign: "center" }}>
        <BeeMascot size={120} mood={winner ? "cheer" : "think"} />
        <h2 style={{ fontSize: 26, fontWeight: 900, margin: "14px 0 4px", color: "#111827" }}>
          {winner ? `🏆 플레이어 ${winner} 승!` : "🤝 무승부!"}
        </h2>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 18, fontSize: 18, fontWeight: 900 }}>
          <div style={{ color: "#F59E0B" }}>A: {scoreA}</div>
          <div style={{ color: "#3B82F6" }}>B: {scoreB}</div>
        </div>
        <button onClick={reset} style={{ ...primaryBtn, marginTop: 20 }}>🔄 다시하기</button>
      </div>
    );
  }

  // play
  const topA = pileA[0];
  const topB = pileB[0];

  return (
    <div style={{
      maxWidth: 680, margin: "0 auto",
      display: "flex", flexDirection: "column", gap: 12,
      padding: "12px 12px 28px",
    }}>
      {/* Player B (top, rotated so partner sits facing opposite) */}
      <PlayerSide
        side="B"
        color="#3B82F6"
        bg="#DBEAFE"
        top={topB}
        deckCount={deckB.length}
        score={scoreB}
        isTurn={turn === "B"}
        onFlip={flipNext}
        onBell={() => ringBell("B")}
        flipped
      />

      {/* Center — totals indicator */}
      <TotalsBar totals={totals} />

      {/* Player A (bottom) */}
      <PlayerSide
        side="A"
        color="#F59E0B"
        bg="#FEF3C7"
        top={topA}
        deckCount={deckA.length}
        score={scoreA}
        isTurn={turn === "A"}
        onFlip={flipNext}
        onBell={() => ringBell("A")}
      />

      {flash && <FlashOverlay flash={flash} />}
    </div>
  );
}

// ────────────────────────────────────────────────

function PlayerSide({
  side, color, bg, top, deckCount, score, isTurn, onFlip, onBell, flipped,
}: {
  side: "A" | "B";
  color: string;
  bg: string;
  top: Card | undefined;
  deckCount: number;
  score: number;
  isTurn: boolean;
  onFlip: () => void;
  onBell: () => void;
  flipped?: boolean;
}) {
  return (
    <div
      style={{
        background: bg, border: `3px solid ${color}`, borderRadius: 20,
        padding: "12px 14px", transform: flipped ? "rotate(180deg)" : undefined,
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 900, color, padding: "4px 10px",
          background: "#fff", borderRadius: 999, border: `2px solid ${color}`,
        }}>플레이어 {side}</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7280" }}>
          🃏 {deckCount} · 🏆 {score}
        </div>
        <span style={{ flex: 1 }} />
        {isTurn && (
          <span style={{
            fontSize: 11, fontWeight: 900, background: color, color: "#fff",
            padding: "3px 10px", borderRadius: 999,
          }}>내 차례</span>
        )}
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
        alignItems: "stretch",
      }}>
        {/* Card slot */}
        <div style={{
          minHeight: 128, background: "#fff", borderRadius: 16,
          border: `2px dashed ${color}`, padding: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {top ? <CardFace card={top} /> : <div style={{ fontSize: 38, opacity: 0.25 }}>🂠</div>}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onFlip}
            disabled={!isTurn || deckCount === 0}
            aria-label={`플레이어 ${side} 카드 넘기기`}
            style={{
              flex: 1, minHeight: 56, borderRadius: 14,
              background: isTurn ? "#fff" : "#F3F4F6",
              color: isTurn ? color : "#9CA3AF",
              border: `2px solid ${isTurn ? color : "#E5E7EB"}`,
              fontWeight: 900, fontSize: 15, cursor: isTurn && deckCount > 0 ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >▶ 넘기기</button>
          <button
            onClick={onBell}
            aria-label={`플레이어 ${side} 종 누르기`}
            style={{
              flex: 1, minHeight: 56, borderRadius: 14,
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              color: "#fff", border: "none", fontWeight: 900, fontSize: 20,
              cursor: "pointer", boxShadow: `0 6px 14px ${color}55`,
            }}
          >🔔</button>
        </div>
      </div>
    </div>
  );
}

function CardFace({ card }: { card: Card }) {
  const meta = FRUIT_META[card.fruit];
  const dots = Array.from({ length: card.count });
  const [imgOk, setImgOk] = useState(true);
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
    }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: meta.color, letterSpacing: 1 }}>
        ×{card.count}
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: card.count >= 4 ? "repeat(3, 22px)" : "repeat(auto-fill, 22px)",
        gap: 4, justifyContent: "center",
      }}>
        {dots.map((_, i) => (
          imgOk ? (
            <img
              key={i}
              src={fruitImg(card.fruit)}
              alt=""
              aria-hidden="true"
              onError={() => setImgOk(false)}
              style={{ width: 22, height: 22, objectFit: "contain" }}
            />
          ) : (
            <div key={i} style={{ fontSize: 18, lineHeight: 1, textAlign: "center" }}>{meta.emoji}</div>
          )
        ))}
      </div>
    </div>
  );
}

function TotalsBar({ totals }: { totals: Record<Fruit, number> | null }) {
  if (!totals) return null;
  return (
    <div style={{
      display: "flex", justifyContent: "center", gap: 10,
      background: "#fff", padding: "10px 14px", borderRadius: 14,
      border: "2px solid #FDE68A", flexWrap: "wrap",
    }}>
      {(Object.keys(totals) as Fruit[]).map((f) => {
        const n = totals[f];
        const isFive = n === 5;
        return (
          <div
            key={f}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 99,
              background: isFive ? FRUIT_META[f].color : "#F9FAFB",
              color: isFive ? "#fff" : "#1F2937",
              fontWeight: 900, fontSize: 13,
              border: isFive ? `2px solid ${FRUIT_META[f].color}` : "1px solid #E5E7EB",
              animation: isFive ? "halliPulse 0.4s ease-in-out infinite alternate" : undefined,
            }}
          >
            <span>{FRUIT_META[f].emoji}</span>
            <span>{n}</span>
            {isFive && <span>🔔</span>}
          </div>
        );
      })}
      <style jsx>{`
        @keyframes halliPulse {
          from { transform: scale(1); }
          to   { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

function FlashOverlay({ flash }: { flash: { who: "A" | "B"; kind: "hit" | "miss"; reason: string } }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed", inset: 0, zIndex: 500, pointerEvents: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        background: flash.kind === "hit" ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
        color: "#fff", padding: "18px 28px", borderRadius: 22,
        fontWeight: 900, fontSize: 22, boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
        textAlign: "center",
      }}>
        <div>{flash.kind === "hit" ? "🎯 정답" : "❌ 오답"}</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, opacity: 0.95 }}>
          플레이어 {flash.who} · {flash.reason}
        </div>
      </div>
    </div>
  );
}

function Rules({ langA, langB }: { langA: string; langB: string }) {
  return (
    <div style={{
      marginTop: 18, padding: "12px 14px", background: "#fff",
      borderRadius: 14, border: "2px solid #FDE68A",
      fontSize: 13, color: "#374151", lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: 900, color: "#B45309", marginBottom: 4 }}>🎯 규칙</div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        <li>서로 번갈아 카드를 넘겨요.</li>
        <li>지금 공개된 카드 중 <b>한 과일이 정확히 5개</b>면 종을 눌러요.</li>
        <li>정답이면 지금까지 쌓인 카드를 모두 가져가요.</li>
        <li>오답이면 상대에게 3장을 줘야 해요.</li>
        <li>덱이 다 떨어지면 점수 많은 쪽이 이겨요.</li>
      </ol>
      <div style={{ marginTop: 8, fontSize: 11, color: "#9CA3AF" }}>
        {langA} / {langB}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  padding: "20px 16px 32px", maxWidth: 560, margin: "0 auto",
  fontFamily: "'Noto Sans KR', sans-serif",
};
const primaryBtn: React.CSSProperties = {
  width: "100%", padding: "16px 18px", borderRadius: 16,
  background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#fff",
  fontSize: 18, fontWeight: 900, border: "none", cursor: "pointer",
  boxShadow: "0 6px 16px rgba(245,158,11,0.3)",
};
// Minimal unused import avoidance
void tr;

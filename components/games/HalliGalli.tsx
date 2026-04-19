"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BeeMascot from "../BeeMascot";
import { LangMap, tr } from "@/lib/gameData";

// 할리갈리 — Halli Galli (Amigo Games, 1990) 정식 룰 기반.
// ─────────────────────────────────────────────────────────────
// 룰 요약 (2~5인 변형):
//  1) 카드 총 56장. 과일 4종(딸기/라임/바나나/자두) × 각 14장.
//     각 카드의 과일 수는 1·2·3·4·5개 중 하나.
//  2) 카드를 플레이어 수대로 균등 분배. 56/n, 나머지는 앞 사람부터 1장씩.
//     모두 뒤집어 자기 앞에 쌓아둠 (시작 시 공개된 카드는 없음 — 정식 룰).
//  3) 시계방향으로 한 명씩 맨 위 카드를 자기 앞에 공개(뒤집어).
//     공개된 카드는 각자의 파일(pile)에 누적되며 맨 위 카드만 보임.
//  4) 모든 플레이어의 "공개 파일 맨 위 카드"를 합쳐, **한 과일의 합이
//     정확히 5개** 가 되는 순간 먼저 종을 친 사람이 모든 공개 카드를 가져감.
//  5) 잘못 친 경우 페널티: **각 상대에게 카드 1장씩** 지급.
//  6) 자기 덱이 비면 그 사람은 차례를 패스. 전원 카드가 다 떨어지면 종료.
//  7) 최종적으로 카드(여기선 점수로 환산)가 가장 많은 사람이 승.
//
// 레이아웃:
//  - 2인: 기존 split-screen(+180도 회전) 유지.
//  - 3~5인: flex-wrap 격자로 각 플레이어 영역 나열.

type Fruit = "strawberry" | "lime" | "banana" | "plum";

const FRUIT_META: Record<Fruit, { emoji: string; color: string; label: LangMap }> = {
  strawberry: { emoji: "🍓", color: "#EF4444", label: { ko: "딸기",   en: "strawberry", vi: "dâu tây",  zh: "草莓",   ja: "いちご" } },
  lime:       { emoji: "🍋", color: "#84CC16", label: { ko: "라임",   en: "lime",       vi: "chanh",    zh: "酸橙",   ja: "ライム" } },
  banana:     { emoji: "🍌", color: "#FACC15", label: { ko: "바나나", en: "banana",     vi: "chuối",    zh: "香蕉",   ja: "バナナ" } },
  plum:       { emoji: "🟣", color: "#8B5CF6", label: { ko: "자두",   en: "plum",       vi: "mận",      zh: "李子",   ja: "すもも" } },
};

interface Card { fruit: Fruit; count: 1 | 2 | 3 | 4 | 5 }

// 정식 할리갈리 카드 분포 (총 56장, 과일당 14장).
// 개당 카드 수가 1·2·3·4·5 중 하나이며 과일별 합이 14장이 되도록 구성.
// 일반적으로 알려진 분포: 1개×5장, 2개×3장, 3개×3장, 4개×2장, 5개×1장
// = 5+3+3+2+1 = 14장/과일 × 4과일 = 56장.
const FRUIT_COUNT_DIST: ReadonlyArray<readonly [1 | 2 | 3 | 4 | 5, number]> = [
  [1, 5],
  [2, 3],
  [3, 3],
  [4, 2],
  [5, 1],
];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  (Object.keys(FRUIT_META) as Fruit[]).forEach((f) => {
    FRUIT_COUNT_DIST.forEach(([count, copies]) => {
      for (let i = 0; i < copies; i++) {
        deck.push({ fruit: f, count });
      }
    });
  });
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function fruitImg(f: Fruit): string { return `/halligalli/${f}.png`; }

type Phase = "intro" | "play" | "result";

type PlayerCount = 2 | 3 | 4 | 5;

// 플레이어 팔레트 (최대 5명).
const PLAYER_PALETTE: ReadonlyArray<{ color: string; bg: string }> = [
  { color: "#F59E0B", bg: "#FEF3C7" }, // A - amber
  { color: "#3B82F6", bg: "#DBEAFE" }, // B - blue
  { color: "#10B981", bg: "#D1FAE5" }, // C - emerald
  { color: "#EC4899", bg: "#FCE7F3" }, // D - pink
  { color: "#8B5CF6", bg: "#EDE9FE" }, // E - violet
];

const PLAYER_LABEL = ["A", "B", "C", "D", "E"];

// ─────────────────────────────────────────────────────────────
// WebAudio SFX — 파일 없이 Oscillator 로 합성.
// ─────────────────────────────────────────────────────────────
function playTone(freq: number, durationMs: number, type: OscillatorType = "sine") {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = type; osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000);
}
const sfx = {
  flip: () => playTone(420, 120, "triangle"),
  bell: () => { playTone(880, 160); setTimeout(() => playTone(1320, 200), 80); },
  miss: () => playTone(180, 240, "sawtooth"),
};

// 56장 덱을 n명에게 균등 분배. 나머지는 앞 사람부터 1장씩.
function dealDecks(full: Card[], n: PlayerCount): Card[][] {
  const base = Math.floor(full.length / n);
  const remainder = full.length % n;
  const out: Card[][] = [];
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < remainder ? 1 : 0);
    out.push(full.slice(idx, idx + size));
    idx += size;
  }
  return out;
}

export default function HalliGalli({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionKey, setSessionKey] = useState(0);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);

  // 정식 룰: 시작 시 공개된 카드는 없다. 모든 카드는 뒤집어진 채 각자 덱에
  // 쌓여 있고, 턴마다 맨 위 1장을 공개한다.
  const initial = useMemo(() => {
    const full = buildDeck();
    const decks = dealDecks(full, playerCount);
    const piles: Card[][] = Array.from({ length: playerCount }, () => []);
    return { decks, piles };
    // sessionKey + playerCount 변경 시 새 덱.
  }, [sessionKey, playerCount]);

  const [decks, setDecks] = useState<Card[][]>(initial.decks);
  const [piles, setPiles] = useState<Card[][]>(initial.piles);
  const [turn, setTurn] = useState<number>(0);
  const [scores, setScores] = useState<number[]>(() => Array.from({ length: playerCount }, () => 0));
  const [flash, setFlash] = useState<{ who: number; kind: "hit" | "miss"; reason: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Reset local state whenever sessionKey/playerCount changes.
    setDecks(initial.decks);
    setPiles(initial.piles);
    setTurn(0);
    setScores(Array.from({ length: playerCount }, () => 0));
    setFlash(null);
  }, [sessionKey, initial, playerCount]);

  // 모든 덱이 비면 게임 종료 (정식 룰: 모든 플레이어 카드 소진).
  useEffect(() => {
    if (phase !== "play") return;
    if (decks.every((d) => d.length === 0)) {
      setPhase("result");
    }
  }, [decks, phase]);

  // 정식 룰: 자기 덱이 비면 차례를 패스한다.
  useEffect(() => {
    if (phase !== "play") return;
    if (decks.length === 0) return;
    if (decks[turn] && decks[turn].length === 0 && decks.some((d) => d.length > 0)) {
      // 다음 살아 있는 플레이어로 건너뛴다.
      let next = (turn + 1) % decks.length;
      // 안전한 루프.
      for (let i = 0; i < decks.length; i++) {
        if (decks[next].length > 0) break;
        next = (next + 1) % decks.length;
      }
      if (next !== turn) setTurn(next);
    }
  }, [turn, decks, phase]);

  function flipNext() {
    if (phase !== "play") return;
    const mine = decks[turn];
    if (!mine || mine.length === 0) {
      // Empty deck — find next non-empty turn.
      if (decks.some((d) => d.length > 0)) {
        let next = (turn + 1) % decks.length;
        for (let i = 0; i < decks.length; i++) {
          if (decks[next].length > 0) break;
          next = (next + 1) % decks.length;
        }
        setTurn(next);
      }
      return;
    }
    const [top, ...rest] = mine;
    sfx.flip();
    setDecks((ds) => ds.map((d, i) => (i === turn ? rest : d)));
    setPiles((ps) => ps.map((p, i) => (i === turn ? [top, ...p] : p)));
    // 다음 살아있는 플레이어로 턴 이동.
    // decks 는 아직 업데이트 전이지만 turn 본인만 1장 줄어드므로 판단에 영향 없음.
    let next = (turn + 1) % decks.length;
    for (let i = 0; i < decks.length; i++) {
      const candLen = next === turn ? rest.length : decks[next].length;
      if (candLen > 0) break;
      next = (next + 1) % decks.length;
    }
    setTurn(next);
  }

  function totalByFruit(pilesArr: Card[][]): Record<Fruit, number> {
    const sum: Record<Fruit, number> = { strawberry: 0, lime: 0, banana: 0, plum: 0 };
    pilesArr.forEach((p) => {
      if (p.length > 0) {
        const top = p[0];
        sum[top.fruit] += top.count;
      }
    });
    return sum;
  }

  function ringBell(who: number) {
    if (phase !== "play") return;
    const totals = totalByFruit(piles);
    const winningFruit = (Object.keys(totals) as Fruit[]).find((f) => totals[f] === 5);
    if (flashTimer.current) { clearTimeout(flashTimer.current); flashTimer.current = null; }
    if (winningFruit) {
      // Correct — collect all piles
      const gained = piles.reduce((acc, p) => acc + p.length, 0);
      setScores((arr) => arr.map((s, i) => (i === who ? s + gained : s)));
      setPiles(piles.map(() => [] as Card[]));
      sfx.bell();
      setFlash({ who, kind: "hit", reason: `${FRUIT_META[winningFruit].emoji} 정확히 5개!` });
    } else {
      // 오답 페널티 — 정식 룰: 각 상대 플레이어에게 카드 1장씩 지급.
      // 점수 기반으로는 "상대 수"만큼 잃고, 상대 각각 1씩 얻는 식으로 반영.
      const opponents = scores.length - 1;
      setScores((arr) => arr.map((s, i) => {
        if (i === who) return Math.max(0, s - opponents);
        return s + 1;
      }));
      sfx.miss();
      setFlash({ who, kind: "miss", reason: "5개가 아니에요" });
    }
    flashTimer.current = setTimeout(() => setFlash(null), 1400);
  }

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  function reset() { setSessionKey((k) => k + 1); setPhase("intro"); }

  const totals = phase === "play" ? totalByFruit(piles) : null;
  const winningFruit = totals ? (Object.keys(totals) as Fruit[]).find((f) => totals[f] === 5) : undefined;

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

        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          background: "#FFFBEB", border: "2px solid #FDE68A", borderRadius: 14,
          padding: "12px 14px", marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#B45309" }}>👥 플레이어 수</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {([2, 3, 4, 5] as PlayerCount[]).map((n) => {
              const active = playerCount === n;
              return (
                <button
                  key={n}
                  onClick={() => setPlayerCount(n)}
                  aria-label={`${n}명`}
                  aria-pressed={active}
                  style={{
                    minHeight: 44, padding: "8px 4px", borderRadius: 12,
                    background: active ? "#F59E0B" : "#fff",
                    color: active ? "#fff" : "#92400E",
                    border: `2px solid ${active ? "#D97706" : "#FDE68A"}`,
                    fontSize: 15, fontWeight: 900, cursor: "pointer",
                  }}
                >{n}명</button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 700 }}>
            56장을 {playerCount}명에게 균등 분배 ({Math.floor(56 / playerCount)}장씩
            {56 % playerCount > 0 ? `, 앞 ${56 % playerCount}명은 +1장` : ""})
          </div>
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
    const max = Math.max(...scores);
    const winners: number[] = [];
    scores.forEach((s, i) => { if (s === max) winners.push(i); });
    const isDraw = winners.length > 1;
    return (
      <div style={{ ...wrap, textAlign: "center" }}>
        <BeeMascot size={120} mood={isDraw ? "think" : "cheer"} />
        <h2 style={{ fontSize: 26, fontWeight: 900, margin: "14px 0 4px", color: "#111827" }}>
          {isDraw ? "🤝 무승부!" : `🏆 플레이어 ${PLAYER_LABEL[winners[0]]} 승!`}
        </h2>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, marginTop: 18, fontSize: 16, fontWeight: 900 }}>
          {scores.map((s, i) => (
            <div key={i} style={{ color: PLAYER_PALETTE[i].color }}>
              {PLAYER_LABEL[i]}: {s}
            </div>
          ))}
        </div>
        <button onClick={reset} style={{ ...primaryBtn, marginTop: 20 }}>🔄 다시하기</button>
      </div>
    );
  }

  // play
  if (playerCount === 2) {
    // 기존 split-screen + 180도 회전 유지.
    const topA = piles[0]?.[0];
    const topB = piles[1]?.[0];
    return (
      <div style={{
        maxWidth: 680, margin: "0 auto",
        display: "flex", flexDirection: "column", gap: 10,
        padding: "12px 12px 28px",
      }}>
        {/* Player B controls (top, rotated 180° toward opposite player) */}
        <PlayerControls
          label="B"
          color={PLAYER_PALETTE[1].color} bg={PLAYER_PALETTE[1].bg}
          deckCount={decks[1]?.length ?? 0} score={scores[1] ?? 0} isTurn={turn === 1}
          onFlip={flipNext} onBell={() => ringBell(1)}
          flipped
        />

        {/* Center table — two face-up cards */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          alignItems: "center", padding: "4px 0",
        }}>
          <CenterCard
            card={topB}
            flipped
            highlight={!!(topB && winningFruit && topB.fruit === winningFruit)}
          />
          <CenterCard
            card={topA}
            highlight={!!(topA && winningFruit && topA.fruit === winningFruit)}
          />
        </div>

        {/* Player A controls (bottom) */}
        <PlayerControls
          label="A"
          color={PLAYER_PALETTE[0].color} bg={PLAYER_PALETTE[0].bg}
          deckCount={decks[0]?.length ?? 0} score={scores[0] ?? 0} isTurn={turn === 0}
          onFlip={flipNext} onBell={() => ringBell(0)}
        />

        {flash && <FlashOverlay flash={{ who: PLAYER_LABEL[flash.who], kind: flash.kind, reason: flash.reason }} />}
      </div>
    );
  }

  // 3~5인: flex-wrap 격자 — 각 플레이어 영역을 카드+컨트롤로 묶어 나열.
  return (
    <div style={{
      maxWidth: 880, margin: "0 auto",
      display: "flex", flexDirection: "column", gap: 10,
      padding: "12px 12px 28px",
    }}>
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10,
      }}>
        {Array.from({ length: playerCount }).map((_, i) => {
          const top = piles[i]?.[0];
          const palette = PLAYER_PALETTE[i];
          return (
            <PlayerPanel
              key={i}
              label={PLAYER_LABEL[i]}
              color={palette.color}
              bg={palette.bg}
              card={top}
              highlight={!!(top && winningFruit && top.fruit === winningFruit)}
              deckCount={decks[i]?.length ?? 0}
              score={scores[i] ?? 0}
              isTurn={turn === i}
              onFlip={flipNext}
              onBell={() => ringBell(i)}
            />
          );
        })}
      </div>

      {flash && <FlashOverlay flash={{ who: PLAYER_LABEL[flash.who], kind: flash.kind, reason: flash.reason }} />}
    </div>
  );
}

// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────

function PlayerControls({
  label, color, bg, deckCount, score, isTurn, onFlip, onBell, flipped,
}: {
  label: string;
  color: string;
  bg: string;
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
        background: bg, border: `2px solid ${color}`, borderRadius: 16,
        padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
        transform: flipped ? "rotate(180deg)" : undefined,
      }}
    >
      <div style={{
        fontSize: 12, fontWeight: 900, color, padding: "4px 10px",
        background: "#fff", borderRadius: 999, border: `2px solid ${color}`,
      }}>P {label}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7280" }}>
        🃏 {deckCount} · 🏆 {score}
      </div>
      {isTurn && (
        <span style={{
          fontSize: 11, fontWeight: 900, background: color, color: "#fff",
          padding: "3px 10px", borderRadius: 999,
        }}>내 차례</span>
      )}
      <span style={{ flex: 1 }} />
      <button
        onClick={onFlip}
        disabled={!isTurn || deckCount === 0}
        aria-label={`플레이어 ${label} 카드 넘기기`}
        style={{
          minHeight: 44, padding: "0 16px", borderRadius: 12,
          background: isTurn && deckCount > 0 ? "#fff" : "#F3F4F6",
          color: isTurn && deckCount > 0 ? color : "#9CA3AF",
          border: `2px solid ${isTurn && deckCount > 0 ? color : "#E5E7EB"}`,
          fontWeight: 900, fontSize: 14,
          cursor: isTurn && deckCount > 0 ? "pointer" : "not-allowed",
        }}
      >▶ 넘기기</button>
      <button
        onClick={onBell}
        aria-label={`플레이어 ${label} 종 누르기`}
        style={{
          minHeight: 44, minWidth: 56, padding: 0, borderRadius: 14,
          background: `linear-gradient(135deg, ${color}, ${color}cc)`,
          color: "#fff", border: "none", fontWeight: 900, fontSize: 24,
          cursor: "pointer", boxShadow: `0 4px 10px ${color}55`,
        }}
      >🔔</button>
    </div>
  );
}

// 3~5인 격자용 단일 플레이어 패널 (카드 + 컨트롤 한 덩어리).
function PlayerPanel({
  label, color, bg, card, highlight, deckCount, score, isTurn, onFlip, onBell,
}: {
  label: string;
  color: string;
  bg: string;
  card: Card | undefined;
  highlight: boolean;
  deckCount: number;
  score: number;
  isTurn: boolean;
  onFlip: () => void;
  onBell: () => void;
}) {
  return (
    <div
      style={{
        background: bg, border: `2px solid ${color}`, borderRadius: 16,
        padding: 10, display: "flex", flexDirection: "column", gap: 8,
        // 3~5인 공통: 셀 크기 고정 (flex-grow 금지) → 마지막 플레이어만 커지지 않음
        flex: "0 0 260px", maxWidth: 260,
        boxShadow: isTurn ? `0 0 0 3px ${color}55, 0 6px 14px rgba(0,0,0,0.12)` : "0 2px 6px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          fontSize: 12, fontWeight: 900, color, padding: "3px 10px",
          background: "#fff", borderRadius: 999, border: `2px solid ${color}`,
        }}>P {label}</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>
          🃏 {deckCount} · 🏆 {score}
        </div>
        {isTurn && (
          <span style={{
            fontSize: 10, fontWeight: 900, background: color, color: "#fff",
            padding: "2px 8px", borderRadius: 999, marginLeft: "auto",
          }}>내 차례</span>
        )}
      </div>
      <CenterCard card={card} highlight={highlight} compact />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onFlip}
          disabled={!isTurn || deckCount === 0}
          aria-label={`플레이어 ${label} 카드 넘기기`}
          style={{
            flex: 1,
            minHeight: 44, padding: "0 10px", borderRadius: 12,
            background: isTurn && deckCount > 0 ? "#fff" : "#F3F4F6",
            color: isTurn && deckCount > 0 ? color : "#9CA3AF",
            border: `2px solid ${isTurn && deckCount > 0 ? color : "#E5E7EB"}`,
            fontWeight: 900, fontSize: 13,
            cursor: isTurn && deckCount > 0 ? "pointer" : "not-allowed",
          }}
        >▶ 넘기기</button>
        <button
          onClick={onBell}
          aria-label={`플레이어 ${label} 종 누르기`}
          style={{
            minHeight: 44, minWidth: 52, padding: 0, borderRadius: 14,
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: "#fff", border: "none", fontWeight: 900, fontSize: 22,
            cursor: "pointer", boxShadow: `0 4px 10px ${color}55`,
          }}
        >🔔</button>
      </div>
    </div>
  );
}

function CenterCard({ card, flipped, highlight, compact }: { card: Card | undefined; flipped?: boolean; highlight?: boolean; compact?: boolean }) {
  const transform = flipped ? "rotate(180deg)" : undefined;
  const widthStyle = compact ? "100%" : "min(92%, 420px)";
  if (!card) {
    return (
      <div
        style={{
          width: widthStyle, aspectRatio: "5 / 3",
          background: "#fff", border: "3px dashed #E5E7EB", borderRadius: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#9CA3AF", fontWeight: 800, fontSize: 13,
          transform,
        }}
      >카드 대기 중</div>
    );
  }
  const meta = FRUIT_META[card.fruit];
  const columns = card.count <= 3 ? card.count : 3;
  return (
    <div
      style={{
        width: widthStyle, aspectRatio: "5 / 3",
        background: "#fff",
        // 합이 5인 승리 기회 상태 = 긍정적 녹색(#10B981). 빨강은 오답/경고용이라 부적절.
        border: `4px solid ${highlight ? "#10B981" : meta.color}`,
        borderRadius: 20,
        boxShadow: highlight
          ? "0 0 0 6px rgba(16,185,129,0.35), 0 12px 28px rgba(0,0,0,0.18)"
          : "0 10px 22px rgba(0,0,0,0.12)",
        padding: 12, position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        transform,
        animation: highlight ? "halliGlow 0.6s ease-in-out infinite alternate" : undefined,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 8,
          width: "100%",
          height: "100%",
          alignContent: "center",
          justifyItems: "center",
          placeItems: "center",
        }}
      >
        {Array.from({ length: card.count }).map((_, i) => (
          <FruitGlyph key={i} fruit={card.fruit} />
        ))}
      </div>
      {/* Corner count for tactile confirmation, very subtle */}
      <div style={{
        position: "absolute", top: 8, left: 12,
        fontSize: 13, fontWeight: 900, color: meta.color,
        background: "#fff", padding: "2px 8px", borderRadius: 999,
        border: `2px solid ${meta.color}`,
      }}>{meta.emoji} ×{card.count}</div>
      <style jsx>{`
        @keyframes halliGlow {
          from { box-shadow: 0 0 0 4px rgba(220,38,38,0.25), 0 12px 28px rgba(0,0,0,0.18); }
          to   { box-shadow: 0 0 0 10px rgba(220,38,38,0.55), 0 12px 32px rgba(0,0,0,0.25); }
        }
      `}</style>
    </div>
  );
}

function FruitGlyph({ fruit }: { fruit: Fruit }) {
  const meta = FRUIT_META[fruit];
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span style={{ fontSize: "clamp(32px, 9vw, 56px)", lineHeight: 1 }}>{meta.emoji}</span>;
  }
  return (
    <img
      src={fruitImg(fruit)}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      style={{ width: "clamp(28px, 9vw, 56px)", height: "clamp(28px, 9vw, 56px)", objectFit: "contain", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.12))" }}
    />
  );
}

function FlashOverlay({ flash }: { flash: { who: string; kind: "hit" | "miss"; reason: string } }) {
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
        <li>오답이면 상대에게 1장씩 줘야 해요.</li>
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

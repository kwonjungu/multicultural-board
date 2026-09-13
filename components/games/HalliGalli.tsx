"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../ui/game/GameHeader";
import { LangMap, tr } from "@/lib/gameData";
import { playSequence, playTone } from "@/lib/gameSfx";

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

// 플레이어는 색이 아니라 글자 라벨(P A~E)로 구분한다 — 색각 이상에서도 읽힌다.
const PLAYER_LABEL = ["A", "B", "C", "D", "E"];

// ─────────────────────────────────────────────────────────────
// WebAudio SFX — 공유 싱글턴 컨텍스트 (lib/gameSfx).
// ─────────────────────────────────────────────────────────────
const sfx = {
  flip: () => playTone(420, 120, "triangle"),
  // 연속음은 컴포넌트에서 setTimeout 을 직접 잡지 않고 playSequence 에 맡긴다.
  bell: () => playSequence([
    { freq: 880,  durationMs: 160, delayMs: 0 },
    { freq: 1320, durationMs: 200, delayMs: 80 },
  ]),
  // 오답은 경고음이 아니라 '한 번 더 보자' 는 부드러운 낮은 음 하나 (README §3-5).
  miss: () => playTone(392, 160, "sine", 0.12),
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
  const flipLockRef = useRef(0);

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
    // 더블탭 가드 — 리렌더 전에 두 번 호출되면 같은 top 카드가 두 번
    // 공개되어 덱/파일이 어긋난다 (decks/piles 가 클로저의 stale 값이므로).
    const now = Date.now();
    if (now - flipLockRef.current < 250) return;
    flipLockRef.current = now;
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
      setFlash({ who, kind: "miss", reason: "지금은 5개가 아니에요. 카드를 더 넘겨볼까요?" });
    }
    flashTimer.current = setTimeout(() => setFlash(null), 1400);
  }

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  function reset() { setSessionKey((k) => k + 1); setPhase("intro"); }

  const totals = phase === "play" ? totalByFruit(piles) : null;
  const winningFruit = totals ? (Object.keys(totals) as Fruit[]).find((f) => totals[f] === 5) : undefined;

  if (phase === "intro") {
    return (
      <div data-ux-root className="hg-root">
        <ScopedStyle css={HG_CSS} />
        <div className="hg-head">
          <div className="hg-bigicon" aria-hidden>🔔</div>
          <h1 data-ux-role="title">할리갈리</h1>
          <p data-ux-role="body">
            같은 과일이 <b>정확히 5개</b>가 되면 종을 누르세요!
          </p>
        </div>

        <div className="hg-setup">
          <span data-ux-role="label" className="hg-setuptitle">👥 플레이어 수</span>
          <div className="hg-countgrid">
            {([2, 3, 4, 5] as PlayerCount[]).map((n) => {
              const active = playerCount === n;
              return (
                <button
                  key={n}
                  data-ux-role="control"
                  className="hg-count"
                  data-active={active ? "" : undefined}
                  aria-pressed={active}
                  onClick={() => setPlayerCount(n)}
                >{n}명</button>
              );
            })}
          </div>
          <p data-ux-role="secondary" className="hg-deal">
            56장을 {playerCount}명에게 균등 분배 ({Math.floor(56 / playerCount)}장씩
            {56 % playerCount > 0 ? `, 앞 ${56 % playerCount}명은 +1장` : ""})
          </p>
        </div>

        <button data-ux-role="action" className="hg-primary" onClick={() => setPhase("play")}>
          🎮 시작하기
        </button>
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
      <div data-ux-root className="hg-root hg-center">
        <ScopedStyle css={HG_CSS} />
        <BeeMascot size={120} mood={isDraw ? "think" : "cheer"} />
        <h1 data-ux-role="title">
          {isDraw ? "🤝 무승부!" : `🏆 플레이어 ${PLAYER_LABEL[winners[0]]} 승!`}
        </h1>
        <div className="hg-scores">
          {scores.map((s, i) => (
            <span key={i} data-ux-role="body-emphasis">
              {PLAYER_LABEL[i]}: {s}
            </span>
          ))}
        </div>
        <button data-ux-role="action" className="hg-primary" onClick={reset}>🔄 다시하기</button>
      </div>
    );
  }

  // play
  // U01 공용 헤더 — 이 게임에는 머리 부분이 없었다. 점수는 플레이어마다 자기
  // 구역 안에 흩어져 있어, 다른 게임에서 오른쪽 위를 보던 아이가 여기서는
  // 전체 상황을 한눈에 볼 곳이 없었다. 플레이어별 점수는 자기 구역에 그대로
  // 두고(마주 앉은 사람에게는 그게 맞다), 공통 상황만 헤더로 올린다.
  // 뒤로는 인원 고르기(이 게임의 준비 화면)로.
  const playHeader = (
    <GameHeader
      gameId="halligalli"
      title="할리갈리"
      icon="🔔"
      onBack={reset}
      backLabel="준비"
      status={
        <>
          <GameStat icon="🙋" label="차례" value={`P ${PLAYER_LABEL[turn] ?? "?"}`} tone="key" />
          <GameStat icon="🃏" label="남은 카드" value={decks.reduce((a, d) => a + d.length, 0)} />
          <GameStat icon="🏆" label="최고 점수" value={Math.max(0, ...scores)} />
        </>
      }
    />
  );

  if (playerCount === 2) {
    // 기존 split-screen + 180도 회전 유지.
    const topA = piles[0]?.[0];
    const topB = piles[1]?.[0];
    return (
      <div data-ux-root className="hg-root hg-play2">
        <ScopedStyle css={HG_CSS} />
        {playHeader}
        {/* Player B controls (top, rotated 180° toward opposite player) */}
        <PlayerControls
          label="B"
          deckCount={decks[1]?.length ?? 0} score={scores[1] ?? 0} isTurn={turn === 1}
          onFlip={flipNext} onBell={() => ringBell(1)}
          flipped
        />

        {/* Center table — two face-up cards */}
        <div className="hg-table">
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
          deckCount={decks[0]?.length ?? 0} score={scores[0] ?? 0} isTurn={turn === 0}
          onFlip={flipNext} onBell={() => ringBell(0)}
        />

        {flash && <FlashOverlay flash={{ who: PLAYER_LABEL[flash.who], kind: flash.kind, reason: flash.reason }} />}
      </div>
    );
  }

  // 3~5인: 격자 — 각 플레이어 영역을 카드+컨트롤로 묶어 나열.
  return (
    <div data-ux-root className="hg-root hg-playn">
      <ScopedStyle css={HG_CSS} />
      {playHeader}
      <div className="hg-panels">
        {Array.from({ length: playerCount }).map((_, i) => {
          const top = piles[i]?.[0];
          return (
            <PlayerPanel
              key={i}
              label={PLAYER_LABEL[i]}
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
  label, deckCount, score, isTurn, onFlip, onBell, flipped,
}: {
  label: string;
  deckCount: number;
  score: number;
  isTurn: boolean;
  onFlip: () => void;
  onBell: () => void;
  flipped?: boolean;
}) {
  const canFlip = isTurn && deckCount > 0;
  return (
    <div className="hg-controls" data-flipped={flipped ? "" : undefined}>
      <span data-ux-role="label" className="hg-tag">P {label}</span>
      <span data-ux-role="secondary">🃏 {deckCount} · 🏆 {score}</span>
      {isTurn && <span data-ux-role="label" className="hg-turn">내 차례</span>}
      <span className="hg-spacer" />
      <button
        data-ux-role="control"
        className="hg-flip"
        aria-disabled={!canFlip}
        aria-label={`플레이어 ${label} 카드 넘기기`}
        onClick={() => { if (canFlip) onFlip(); }}
      >▶ 넘기기</button>
      <button
        data-ux-role="control"
        className="hg-bell"
        aria-label={`플레이어 ${label} 종 누르기`}
        onClick={onBell}
      >🔔 종</button>
    </div>
  );
}

// 3~5인 격자용 단일 플레이어 패널 (카드 + 컨트롤 한 덩어리).
function PlayerPanel({
  label, card, highlight, deckCount, score, isTurn, onFlip, onBell,
}: {
  label: string;
  card: Card | undefined;
  highlight: boolean;
  deckCount: number;
  score: number;
  isTurn: boolean;
  onFlip: () => void;
  onBell: () => void;
}) {
  const canFlip = isTurn && deckCount > 0;
  return (
    <div className="hg-panel" data-turn={isTurn ? "" : undefined}>
      <div className="hg-panelhead">
        <span data-ux-role="label" className="hg-tag">P {label}</span>
        <span data-ux-role="secondary">🃏 {deckCount} · 🏆 {score}</span>
        {isTurn && <span data-ux-role="label" className="hg-turn">내 차례</span>}
      </div>
      <CenterCard card={card} highlight={highlight} compact />
      <div className="hg-panelbtns">
        <button
          data-ux-role="control"
          className="hg-flip"
          aria-disabled={!canFlip}
          aria-label={`플레이어 ${label} 카드 넘기기`}
          onClick={() => { if (canFlip) onFlip(); }}
        >▶ 넘기기</button>
        <button
          data-ux-role="control"
          className="hg-bell"
          aria-label={`플레이어 ${label} 종 누르기`}
          onClick={onBell}
        >🔔 종</button>
      </div>
    </div>
  );
}

function CenterCard({ card, flipped, highlight, compact }: { card: Card | undefined; flipped?: boolean; highlight?: boolean; compact?: boolean }) {
  if (!card) {
    return (
      <div className="hg-card hg-cardempty" data-flipped={flipped ? "" : undefined} data-compact={compact ? "" : undefined}>
        <span data-ux-role="secondary">카드 대기 중</span>
      </div>
    );
  }
  const meta = FRUIT_META[card.fruit];
  const columns = card.count <= 3 ? card.count : 3;
  return (
    <div
      className="hg-card"
      data-flipped={flipped ? "" : undefined}
      data-compact={compact ? "" : undefined}
      data-highlight={highlight ? "" : undefined}
      style={{ borderColor: highlight ? "var(--ux-success)" : meta.color }}
    >
      <div className="hg-fruits" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {/* key 에 fruit 포함 — 카드가 바뀔 때 리마운트되어 failed(onError) 상태가 새 과일로 새어가지 않게 */}
        {Array.from({ length: card.count }).map((_, i) => (
          <FruitGlyph key={`${card.fruit}-${i}`} fruit={card.fruit} />
        ))}
      </div>
      {/* Corner count for tactile confirmation */}
      <span data-ux-role="secondary" className="hg-corner" style={{ color: meta.color, borderColor: meta.color }}>
        {meta.emoji} ×{card.count}
      </span>
    </div>
  );
}

function FruitGlyph({ fruit }: { fruit: Fruit }) {
  const meta = FRUIT_META[fruit];
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="hg-fruitfallback" aria-hidden="true">{meta.emoji}</span>;
  }
  return (
    <img
      className="hg-fruit"
      src={fruitImg(fruit)}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  );
}

function FlashOverlay({ flash }: { flash: { who: string; kind: "hit" | "miss"; reason: string } }) {
  return (
    <div className="hg-flashlayer" aria-live="polite">
      <div className="hg-flash" data-kind={flash.kind}>
        <p data-ux-role="body-emphasis">{flash.kind === "hit" ? "🎯 정답" : "🌱 한 번 더 볼까요?"}</p>
        <p data-ux-role="body">플레이어 {flash.who} · {flash.reason}</p>
      </div>
    </div>
  );
}

function Rules({ langA, langB }: { langA: string; langB: string }) {
  return (
    <div className="hg-rules">
      <span data-ux-role="label" className="hg-rulestitle">🎯 규칙</span>
      <ol data-ux-role="body" className="hg-rulelist">
        <li>서로 번갈아 카드를 넘겨요.</li>
        <li>지금 공개된 카드 중 <b>한 과일이 정확히 5개</b>면 종을 눌러요.</li>
        <li>정답이면 지금까지 쌓인 카드를 모두 가져가요.</li>
        <li>오답이면 상대에게 1장씩 줘야 해요.</li>
        <li>덱이 다 떨어지면 점수 많은 쪽이 이겨요.</li>
      </ol>
      <span data-ux-role="secondary">{langA} / {langB}</span>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const HG_CSS = `
.hg-root{
  color: var(--ux-ink);
  width: 100%; max-width: 1100px; margin: 0 auto; box-sizing: border-box;
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-8);
  display: flex; flex-direction: column; gap: var(--ux-space-4);
}
.hg-center{ align-items: center; text-align: center; }
.hg-head{ display: grid; justify-items: center; gap: var(--ux-space-2); text-align: center; }
.hg-head p{ margin: 0; }
.hg-bigicon{ font-size: clamp(3.5rem, 14vw, 5.5rem); line-height: 1; }

.hg-setup{
  display: grid; gap: var(--ux-space-3);
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-4);
}
.hg-setuptitle{ font-weight: 900; color: var(--ux-primary-ink); }
.hg-countgrid{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--ux-space-2); }
.hg-count[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
  padding: var(--ux-space-2);
}
.hg-count[data-active]{ background: var(--ux-primary-fill); color: var(--ux-primary-ink); border-width: 3px; border-color: var(--ux-selected-border); }
.hg-deal{ margin: 0; }

.hg-primary[data-ux-role="action"]{
  width: 100%;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
}
.hg-scores{ display: flex; justify-content: center; flex-wrap: wrap; gap: var(--ux-space-4); }

.hg-rules{
  display: grid; gap: var(--ux-space-2);
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-4);
}
.hg-rulestitle{ font-weight: 900; color: var(--ux-primary-ink); }
.hg-rulelist{ margin: 0; padding-left: var(--ux-space-6); display: grid; gap: var(--ux-space-1); }

/* ── 대전 화면 ── */
.hg-play2{ gap: var(--ux-space-3); }
.hg-table{ display: flex; flex-direction: column; gap: var(--ux-space-2); align-items: center; }
/* 넓은 화면에서는 두 카드를 나란히 놓아 판을 크게 본다. */
@media (min-width: 900px){
  .hg-table{ flex-direction: row; justify-content: center; align-items: stretch; }
  .hg-table > *{ flex: 1 1 0; max-width: 480px; }
}

.hg-controls{
  background: var(--ux-surface-sunk); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2) var(--ux-space-3);
  display: flex; align-items: center; gap: var(--ux-space-2); flex-wrap: wrap;
}
.hg-controls[data-flipped]{ transform: rotate(180deg); }
.hg-spacer{ flex: 1; }
.hg-tag{
  font-weight: 900; color: var(--ux-primary-ink);
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-pill); padding: 0 var(--ux-space-3);
}
.hg-turn{
  font-weight: 900; color: var(--ux-primary-ink); background: var(--ux-primary-fill);
  border-radius: var(--ux-radius-pill); padding: 0 var(--ux-space-3);
}
.hg-flip[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
  white-space: nowrap;
}
.hg-flip[aria-disabled="true"]{ opacity: .55; cursor: default; }
.hg-bell[data-ux-role="control"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
  white-space: nowrap;
}

.hg-panels{ display: grid; gap: var(--ux-space-3); grid-template-columns: 1fr; }
@media (min-width: 640px){ .hg-panels{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px){ .hg-panels{ grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.hg-panel{
  background: var(--ux-surface-sunk); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-3);
  display: flex; flex-direction: column; gap: var(--ux-space-2); min-width: 0;
}
.hg-panel[data-turn]{ border-width: 4px; border-color: var(--ux-selected-border); }
.hg-panelhead{ display: flex; align-items: center; gap: var(--ux-space-2); flex-wrap: wrap; }
.hg-panelbtns{ display: flex; gap: var(--ux-space-2); }
.hg-panelbtns .hg-flip{ flex: 1; }

.hg-card{
  width: 100%; aspect-ratio: 5 / 3;
  background: var(--ux-surface);
  border: 4px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  box-shadow: 0 10px 22px rgba(41,37,31,.12);
  padding: var(--ux-space-3); position: relative; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
}
.hg-card[data-compact]{ width: 100%; }
.hg-card:not([data-compact]){ width: min(92%, 420px); }
.hg-card[data-flipped]{ transform: rotate(180deg); }
.hg-cardempty{ border-style: dashed; border-color: var(--ux-ink-soft); }
/* 합이 5인 '기회' 상태는 긍정적 초록. 빨강은 오답/경고용이라 여기선 쓰지 않는다. */
.hg-card[data-highlight]{ animation: hgGlow .6s ease-in-out infinite alternate; }
@keyframes hgGlow{
  from{ box-shadow: 0 0 0 4px rgba(20,107,73,.25), 0 12px 28px rgba(41,37,31,.18); }
  to  { box-shadow: 0 0 0 10px rgba(20,107,73,.5), 0 12px 32px rgba(41,37,31,.25); }
}
.hg-fruits{ display: grid; gap: var(--ux-space-2); width: 100%; height: 100%; place-items: center; align-content: center; }
.hg-fruit{ width: clamp(1.75rem, 9vw, 3.5rem); height: clamp(1.75rem, 9vw, 3.5rem); object-fit: contain; }
.hg-fruitfallback{ font-size: clamp(2rem, 9vw, 3.5rem); line-height: 1; }
.hg-corner{
  position: absolute; top: var(--ux-space-2); left: var(--ux-space-3);
  background: var(--ux-surface); padding: 0 var(--ux-space-2);
  border-radius: var(--ux-radius-pill); border: 2px solid currentColor; font-weight: 900;
}

.hg-flashlayer{
  position: fixed; inset: 0; z-index: 500; pointer-events: none;
  display: flex; align-items: center; justify-content: center; padding: var(--ux-space-4);
}
.hg-flash{
  border-radius: var(--ux-radius-panel); padding: var(--ux-space-4) var(--ux-space-8);
  text-align: center; box-shadow: 0 20px 50px rgba(41,37,31,.35);
  background: var(--ux-surface); border: 4px solid var(--ux-primary-border);
  display: grid; gap: var(--ux-space-1);
}
.hg-flash p{ margin: 0; }
.hg-flash[data-kind="hit"]{ background: var(--ux-hint-mint); border-color: var(--ux-success); }
.hg-flash[data-kind="miss"]{ background: var(--ux-surface); border-color: var(--ux-primary-border); }
`;
// Minimal unused import avoidance
void tr;

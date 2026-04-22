"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  SPOTIT_SYMBOLS,
  SPOTIT_CARDS,
  SpotItSymbol,
  commonSymbol,
  tr,
  pickN,
} from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

// ────────────────────────────────────────────────────────────
// 타입 / 상수
// ────────────────────────────────────────────────────────────
type PlayerId = 0 | 1 | 2 | 3 | 4 | 5;
type Phase = "intro" | "play" | "result";
type Difficulty = "easy" | "normal" | "hard";

interface Pop {
  who: PlayerId;
  label: string;
  labelOther: string;
}

interface DifficultyInfo {
  order: number;         // projective plane order
  perCard: number;       // n+1
  ready: boolean;        // order 3만 정식 지원 (order 4/5 는 타협 모드)
  label: string;
}

const WIN_SCORE = 7;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

const DIFF_INFO: Record<Difficulty, DifficultyInfo> = {
  easy:   { order: 3, perCard: 4, ready: true,  label: "쉬움 (4 심볼/카드)" },
  normal: { order: 4, perCard: 5, ready: false, label: "보통 (5 심볼/카드)" },
  hard:   { order: 5, perCard: 6, ready: false, label: "어려움 (6 심볼/카드)" },
};

// ⚠️ 타협(compromise) 모드
// gameData.ts 는 order 3 (13 심볼, 4/카드, 13장) 데이터만 보유.
// order 4/5 정식 데이터가 없으므로 "준비 중" 으로 막는 대신,
// 같은 13 심볼 풀을 재사용해서 perCard 만 5/6 으로 늘린 카드를 합성.
// 이 경우 "두 카드 간 공통 심볼이 정확히 1개" 라는 projective plane 불변이 깨질 수 있음.
// → 아이들 플레이용으로는 "공통 심볼이 있으면 그중 하나" 를 정답으로 수용.
//   수학적 완전성은 포기하되 게임 진행에는 문제 없음.
const COMPROMISE_MODE = true;

// ────────────────────────────────────────────────────────────
// 카드 표시용 결정론적 회전
// ────────────────────────────────────────────────────────────
function seededRotation(cardId: number, slot: number): number {
  const h = Math.sin(cardId * 9.31 + slot * 2.17) * 10000;
  const frac = h - Math.floor(h);
  return Math.round(frac * 30 - 15);
}

function cardIndex(card: number[]): number {
  let acc = 0;
  for (let i = 0; i < card.length; i++) acc += card[i] * (i + 1) * 7;
  return acc;
}

// 두 카드가 공유하는 아무 심볼 하나. 없으면 -1.
function anyCommon(a: number[], b: number[]): number {
  for (const x of a) if (b.includes(x)) return x;
  return -1;
}

// ────────────────────────────────────────────────────────────
// 타협 모드 카드 합성
//   base (4 심볼) 카드에 여분 심볼을 채워 perCard 개로 확장.
//   결정론적이지 않아도 무방 (셔플 시마다 다름).
// ────────────────────────────────────────────────────────────
function buildCompromiseDeck(perCard: number): number[][] {
  const totalSymbols = SPOTIT_SYMBOLS.length;
  const out: number[][] = [];
  for (const base of SPOTIT_CARDS) {
    const card = [...base];
    // 무작위로 기존에 없는 심볼 추가
    let guard = 0;
    while (card.length < perCard && guard < 200) {
      const id = Math.floor(Math.random() * totalSymbols);
      if (!card.includes(id)) card.push(id);
      guard++;
    }
    // 심볼이 부족하면 (13 심볼뿐이므로 perCard≤13 이면 항상 충분) 잘라내기
    out.push(card.slice(0, perCard));
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function SpotIt({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  // 덱 + 자리
  const [deck, setDeck] = useState<number[][]>([]);
  const [cursor, setCursor] = useState<number>(0);
  const [centerCard, setCenterCard] = useState<number[]>([]);
  const [playerCards, setPlayerCards] = useState<number[][]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [locks, setLocks] = useState<number[]>([]);
  const [pop, setPop] = useState<Pop | null>(null);

  // 이미지 폴백 추적
  const [imgFail, setImgFail] = useState<Record<number, boolean>>({});

  // 10Hz tick — 락 해제 감지
  const [, setTick] = useState(0);
  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [phase]);

  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
    };
  }, []);

  // dev invariant check (easy/order 3 만)
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      for (let i = 0; i < SPOTIT_CARDS.length; i++) {
        for (let j = i + 1; j < SPOTIT_CARDS.length; j++) {
          const inter = SPOTIT_CARDS[i].filter((x) => SPOTIT_CARDS[j].includes(x));
          // eslint-disable-next-line no-console
          console.assert(
            inter.length === 1,
            `Spot-It pair ${i},${j} has ${inter.length} common symbols`,
          );
        }
      }
    }
  }, []);

  function start() {
    const info = DIFF_INFO[difficulty];
    if (!info.ready && !COMPROMISE_MODE) return;

    const baseDeck = difficulty === "easy"
      ? SPOTIT_CARDS
      : buildCompromiseDeck(info.perCard);

    const shuffled = pickN(baseDeck, baseDeck.length);
    // 중앙 1 + 플레이어 N 만큼 필요
    const need = 1 + playerCount;
    if (shuffled.length < need) return;

    const initPlayerCards: number[][] = [];
    for (let i = 0; i < playerCount; i++) {
      initPlayerCards.push(shuffled[1 + i]);
    }

    setDeck(shuffled);
    setCenterCard(shuffled[0]);
    setPlayerCards(initPlayerCards);
    setCursor(need);
    setScores(new Array(playerCount).fill(0));
    setLocks(new Array(playerCount).fill(0));
    setPop(null);
    setPhase("play");
  }

  function symbolById(id: number): SpotItSymbol {
    return SPOTIT_SYMBOLS[id];
  }

  function showPop(who: PlayerId, symbolId: number, myLang: string, otherLang: string) {
    const sym = symbolById(symbolId);
    setPop({
      who,
      label: tr(sym.label, myLang),
      labelOther: tr(sym.label, otherLang),
    });
    if (popTimerRef.current) clearTimeout(popTimerRef.current);
    popTimerRef.current = setTimeout(() => setPop(null), 2000);
  }

  function langForPlayer(p: number): string {
    // 짝수 index → langA, 홀수 → langB
    return p % 2 === 0 ? langA : langB;
  }
  function otherLangForPlayer(p: number): string {
    return p % 2 === 0 ? langB : langA;
  }

  function onTap(player: PlayerId, symbolId: number) {
    if (phase !== "play") return;
    const now = Date.now();
    if (now < (locks[player] ?? 0)) return;

    const myCard = playerCards[player];
    if (!myCard || myCard.length === 0) return;

    // easy(order 3) 는 commonSymbol (정확히 1개 보장),
    // 타협 모드는 anyCommon (0 또는 여러 개 가능)
    const common = difficulty === "easy"
      ? commonSymbol(myCard, centerCard)
      : anyCommon(myCard, centerCard);

    const isCorrect = common !== -1 && symbolId === common;

    if (!isCorrect) {
      // 오답 → 0.8초 락
      const until = now + 800;
      setLocks((ls) => ls.map((v, i) => (i === player ? until : v)));
      return;
    }

    // 정답 → 점수 +1, 중앙:=내 카드, 내 카드:=deck[cursor]
    showPop(player, symbolId, langForPlayer(player), otherLangForPlayer(player));

    const nextCenter = myCard;
    const nextCard = cursor < deck.length ? deck[cursor] : null;

    const newScores = scores.map((s, i) => (i === player ? s + 1 : s));
    setScores(newScores);
    setCenterCard(nextCenter);

    if (nextCard === null) {
      // 덱 소진 → 해당 플레이어 카드 비우고 종료
      setPlayerCards((cards) => cards.map((c, i) => (i === player ? [] : c)));
      setPhase("result");
      return;
    }

    setPlayerCards((cards) => cards.map((c, i) => (i === player ? nextCard : c)));
    setCursor((c) => c + 1);

    if (newScores[player] >= WIN_SCORE) {
      setPhase("result");
    }
  }

  const remaining = Math.max(0, deck.length - cursor);

  // ────────────────────────────────────────────────────────────
  // intro 화면
  // ────────────────────────────────────────────────────────────
  if (phase === "intro") {
    const info = DIFF_INFO[difficulty];
    const blocked = !info.ready && !COMPROMISE_MODE;

    return (
      <div style={{ textAlign: "center", padding: 32, maxWidth: 520, margin: "0 auto" }}>
        <BeeMascot size={110} mood="happy" />
        <div style={{ fontSize: 24, fontWeight: 900, margin: "16px 0 6px", color: "#1F2937" }}>
          🕵️ 꿀벌 스팟잇
        </div>
        <div style={{ color: "#6B7280", marginBottom: 14, fontSize: 13, lineHeight: 1.6 }}>
          내 카드와 가운데 카드에서<br />
          <b>똑같은 그림 1개</b>를 먼저 찾아 탭하세요!
        </div>

        {/* 인원 선택 */}
        <div style={sectionBox}>
          <div style={sectionTitle}>인원</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPlayerCount(n)}
                style={pillBtn(playerCount === n, "#F59E0B")}
                aria-pressed={playerCount === n}
              >
                {n}인
              </button>
            ))}
          </div>
        </div>

        {/* 난이도 선택 */}
        <div style={sectionBox}>
          <div style={sectionTitle}>난이도</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            {(Object.keys(DIFF_INFO) as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                style={pillBtn(difficulty === d, "#3B82F6")}
                aria-pressed={difficulty === d}
              >
                {DIFF_INFO[d].label}
              </button>
            ))}
          </div>
          {!info.ready && (
            <div style={{
              marginTop: 10, fontSize: 12, color: "#B45309",
              background: "#FEF3C7", border: "1px solid #FCD34D",
              padding: "8px 10px", borderRadius: 10, lineHeight: 1.5,
            }}>
              {COMPROMISE_MODE ? (
                <>※ 정식 카드 세트가 아직 준비 중입니다.<br />
                13개 심볼을 재사용해 간이 모드로 플레이해요.</>
              ) : (
                <>※ 이 난이도는 준비 중입니다.</>
              )}
            </div>
          )}
        </div>

        <div style={{
          background: "#fff", borderRadius: 16, padding: "12px 14px",
          fontSize: 12, color: "#374151", lineHeight: 1.7, margin: "14px 0 18px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          border: "2px solid #FDE68A", textAlign: "left",
        }}>
          <div>• 정답 → 점수 +1, 가운데 카드 교체</div>
          <div>• 오답 → 0.8초 동안 탭 못함</div>
          <div>• 먼저 <b>{WIN_SCORE}점</b> 내거나 카드 소진 시 종료</div>
        </div>

        <button onClick={start} style={primaryBtn} disabled={blocked}>
          ▶ 시작
        </button>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // result 화면
  // ────────────────────────────────────────────────────────────
  if (phase === "result") {
    const maxScore = scores.reduce((a, b) => Math.max(a, b), 0);
    const winners = scores
      .map((s, i) => (s === maxScore ? i : -1))
      .filter((i) => i >= 0);
    const isTie = winners.length > 1;

    return (
      <div style={{ textAlign: "center", padding: 32, maxWidth: 520, margin: "0 auto" }}>
        <BeeMascot size={120} mood={isTie ? "think" : "celebrate"} />
        <div style={{ fontSize: 22, fontWeight: 900, margin: "18px 0 10px", color: "#1F2937" }}>
          {isTie
            ? "🤝 동점이에요!"
            : `🎉 플레이어 ${winners[0] + 1} 승리!`}
        </div>
        <div style={{
          display: "flex", gap: 10, justifyContent: "center", marginBottom: 20,
          fontSize: 16, fontWeight: 800, flexWrap: "wrap",
        }}>
          {scores.map((s, i) => {
            const color = playerAccent(i);
            const isWin = winners.includes(i) && !isTie;
            return (
              <div key={i} style={{
                background: `${color}22`, padding: "10px 14px", borderRadius: 14,
                border: `2px solid ${color}`,
                opacity: isWin ? 1 : 0.85,
                minWidth: 70,
              }}>
                <div style={{ fontSize: 11, color: "#374151" }}>P{i + 1}</div>
                <div style={{ fontSize: 22, color, fontWeight: 900 }}>{s}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={start} style={primaryBtn}>🔁 다시 하기</button>
          <button onClick={() => setPhase("intro")} style={secondaryBtn}>⚙️ 설정</button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // play 화면
  // ────────────────────────────────────────────────────────────
  const now = Date.now();
  const layout = computeLayout(playerCount);

  return (
    <div style={{
      padding: "10px 10px 14px",
      display: "flex", flexDirection: "column",
      minHeight: "100%",
      gap: 8,
      position: "relative",
    }}>
      {/* HUD */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "4px 4px 2px", fontSize: 12, fontWeight: 800, color: "#374151",
      }}>
        <span style={{
          background: "#fff", padding: "4px 10px", borderRadius: 999,
          border: "2px solid #FDE68A", color: "#92400E",
        }}>
          🂠 남은 카드 {remaining}장
        </span>
        <span style={{
          background: "#fff", padding: "4px 10px", borderRadius: 999,
          border: "2px solid #E5E7EB",
        }}>
          목표 {WIN_SCORE}점 · {playerCount}인 · {DIFF_INFO[difficulty].label}
        </span>
      </div>

      {/* 플레이 영역 */}
      <div style={{
        position: "relative",
        flex: 1,
        display: "grid",
        gridTemplateColumns: layout.columns,
        gridTemplateRows: layout.rows,
        gap: 8,
        alignItems: "center",
        justifyItems: "center",
      }}>
        {/* 중앙 카드 */}
        <div style={{
          gridColumn: layout.center.col,
          gridRow: layout.center.row,
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 1,
        }}>
          <SpotItCardView
            card={centerCard}
            accentColor="#F59E0B"
            bgColor="#FFFFFF"
            imgFail={imgFail}
            onImgFail={(id) => setImgFail((m) => ({ ...m, [id]: true }))}
            interactive={false}
            locked={false}
            ariaRole="img"
            ariaLabel="중앙 카드"
            size={layout.cardSize}
          />
        </div>

        {/* 플레이어 영역 */}
        {playerCards.map((card, i) => {
          const slot = layout.players[i];
          const locked = now < (locks[i] ?? 0);
          return (
            <div
              key={i}
              style={{
                gridColumn: slot.col,
                gridRow: slot.row,
                width: "100%",
                display: "flex",
                justifyContent: "center",
                zIndex: 2,
              }}
            >
              <PlayerZone
                playerIndex={i}
                card={card}
                score={scores[i] ?? 0}
                locked={locked}
                imgFail={imgFail}
                onImgFail={(id) => setImgFail((m) => ({ ...m, [id]: true }))}
                onTap={(s) => onTap(i as PlayerId, s)}
                pop={pop?.who === i ? pop : null}
                rotated={slot.rotated}
                cardSize={layout.cardSize}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 레이아웃 계산
// ────────────────────────────────────────────────────────────
interface SlotPos {
  col: string;   // e.g. "1 / 2"
  row: string;
  rotated: boolean;
}
interface LayoutInfo {
  columns: string;
  rows: string;
  center: { col: string; row: string };
  players: SlotPos[];
  cardSize: number;
}

function computeLayout(n: number): LayoutInfo {
  // cardSize: 인원 많을수록 작게
  const cardSize = n <= 2 ? 210 : n <= 4 ? 170 : 140;

  if (n === 2) {
    // 상(B, 회전) / 중앙 / 하(A)
    return {
      columns: "1fr",
      rows: "auto auto auto",
      center: { col: "1 / 2", row: "2 / 3" },
      players: [
        { col: "1 / 2", row: "3 / 4", rotated: false }, // P1 하단
        { col: "1 / 2", row: "1 / 2", rotated: true },  // P2 상단(회전)
      ],
      cardSize,
    };
  }

  if (n === 3) {
    // 상 한 명(회전), 하 두 명
    return {
      columns: "1fr 1fr",
      rows: "auto auto auto",
      center: { col: "1 / 3", row: "2 / 3" },
      players: [
        { col: "1 / 2", row: "3 / 4", rotated: false }, // P1 하-좌
        { col: "2 / 3", row: "3 / 4", rotated: false }, // P2 하-우
        { col: "1 / 3", row: "1 / 2", rotated: true },  // P3 상(회전)
      ],
      cardSize,
    };
  }

  if (n === 4) {
    // 상 2(회전), 하 2
    return {
      columns: "1fr 1fr",
      rows: "auto auto auto",
      center: { col: "1 / 3", row: "2 / 3" },
      players: [
        { col: "1 / 2", row: "3 / 4", rotated: false }, // P1 하-좌
        { col: "2 / 3", row: "3 / 4", rotated: false }, // P2 하-우
        { col: "1 / 2", row: "1 / 2", rotated: true },  // P3 상-좌
        { col: "2 / 3", row: "1 / 2", rotated: true },  // P4 상-우
      ],
      cardSize,
    };
  }

  if (n === 5) {
    // 상 2(회전), 하 3 (중앙 row = 2열 span)
    return {
      columns: "1fr 1fr 1fr",
      rows: "auto auto auto",
      center: { col: "1 / 4", row: "2 / 3" },
      players: [
        { col: "1 / 2", row: "3 / 4", rotated: false }, // P1
        { col: "2 / 3", row: "3 / 4", rotated: false }, // P2
        { col: "3 / 4", row: "3 / 4", rotated: false }, // P3
        { col: "1 / 2", row: "1 / 2", rotated: true },  // P4
        { col: "3 / 4", row: "1 / 2", rotated: true },  // P5
      ],
      cardSize,
    };
  }

  // n === 6 (최대)
  return {
    columns: "1fr 1fr 1fr",
    rows: "auto auto auto",
    center: { col: "1 / 4", row: "2 / 3" },
    players: [
      { col: "1 / 2", row: "3 / 4", rotated: false }, // P1
      { col: "2 / 3", row: "3 / 4", rotated: false }, // P2
      { col: "3 / 4", row: "3 / 4", rotated: false }, // P3
      { col: "1 / 2", row: "1 / 2", rotated: true },  // P4
      { col: "2 / 3", row: "1 / 2", rotated: true },  // P5
      { col: "3 / 4", row: "1 / 2", rotated: true },  // P6
    ],
    cardSize,
  };
}

// ────────────────────────────────────────────────────────────
// 플레이어 색상
// ────────────────────────────────────────────────────────────
const PLAYER_ACCENTS = ["#F59E0B", "#3B82F6", "#10B981", "#EC4899", "#8B5CF6", "#EF4444"];
function playerAccent(i: number): string {
  return PLAYER_ACCENTS[i % PLAYER_ACCENTS.length];
}

// ────────────────────────────────────────────────────────────
// PlayerZone
// ────────────────────────────────────────────────────────────
function PlayerZone(props: {
  playerIndex: number;
  card: number[];
  score: number;
  locked: boolean;
  imgFail: Record<number, boolean>;
  onImgFail: (id: number) => void;
  onTap: (symbolId: number) => void;
  pop: Pop | null;
  rotated: boolean;
  cardSize: number;
}) {
  const {
    playerIndex, card, score, locked, imgFail, onImgFail, onTap, pop, rotated, cardSize,
  } = props;

  const accent = playerAccent(playerIndex);
  const bg = `${accent}1A`;
  const label = `P${playerIndex + 1}`;

  return (
    <div
      style={{
        background: bg,
        borderRadius: 22,
        padding: "8px 10px 10px",
        border: `2px solid ${accent}55`,
        boxShadow: `0 4px 10px ${accent}22`,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      {/* 플레이어 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "0 4px",
        transform: rotated ? "rotate(180deg)" : undefined,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 900, color: accent,
          background: "#fff", padding: "3px 10px", borderRadius: 999,
          border: `2px solid ${accent}`,
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 900, color: "#fff",
          background: accent, padding: "3px 12px", borderRadius: 999,
        }}>
          ⭐ {score}
        </span>
      </div>

      {/* 카드 + 회전 */}
      <div style={{ transform: rotated ? "rotate(180deg)" : undefined }}>
        <SpotItCardView
          card={card}
          accentColor={accent}
          bgColor="#FFFFFF"
          imgFail={imgFail}
          onImgFail={onImgFail}
          interactive={!locked && card.length > 0}
          locked={locked}
          onTap={onTap}
          ariaRole="group"
          ariaLabel={`${label} 카드`}
          size={cardSize}
        />
      </div>

      {/* 말풍선 */}
      {pop && (
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            top: rotated ? undefined : -8,
            bottom: rotated ? -8 : undefined,
            left: "50%",
            transform: `translate(-50%, ${rotated ? "100%" : "-100%"})${rotated ? " rotate(180deg)" : ""}`,
            background: "#fff",
            border: `3px solid ${accent}`,
            borderRadius: 18,
            padding: "10px 18px",
            boxShadow: `0 10px 24px ${accent}55`,
            zIndex: 5,
            minWidth: 140,
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{
            fontSize: 20, fontWeight: 900, color: "#111827", lineHeight: 1.1,
          }}>
            {pop.label}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#6B7280", marginTop: 2,
          }}>
            {pop.labelOther}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SpotItCardView
// ────────────────────────────────────────────────────────────
function SpotItCardView(props: {
  card: number[];
  accentColor: string;
  bgColor: string;
  imgFail: Record<number, boolean>;
  onImgFail: (id: number) => void;
  interactive: boolean;
  locked: boolean;
  onTap?: (symbolId: number) => void;
  ariaRole?: string;
  ariaLabel?: string;
  size: number;
}) {
  const {
    card, accentColor, bgColor, imgFail, onImgFail,
    interactive, locked, onTap, ariaRole, ariaLabel, size,
  } = props;

  const cid = useMemo(() => (card.length ? cardIndex(card) : 0), [card]);
  const grid = useMemo(() => gridSpec(card.length), [card.length]);

  if (!card.length) {
    return (
      <div style={{
        width: size, height: size,
        borderRadius: 24,
        background: "#F3F4F6",
        border: "2px dashed #D1D5DB",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#9CA3AF", fontSize: 13, fontWeight: 700,
      }}>
        카드 없음
      </div>
    );
  }

  return (
    <div
      role={ariaRole}
      aria-label={ariaLabel}
      style={{
        position: "relative",
        width: size, height: size,
        borderRadius: 24,
        background: bgColor,
        border: `3px solid ${accentColor}`,
        boxShadow: `0 8px 18px ${accentColor}44, inset 0 2px 0 rgba(255,255,255,0.6)`,
        display: "grid",
        gridTemplateColumns: grid.cols,
        gridTemplateRows: grid.rows,
        gap: 4,
        padding: 8,
        opacity: locked ? 0.5 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {card.map((symbolId, slot) => (
        <SpotItSymbolButton
          key={`${symbolId}-${slot}`}
          symbolId={symbolId}
          rotation={seededRotation(cid, slot)}
          interactive={interactive}
          imgFailed={!!imgFail[symbolId]}
          onImgFail={() => onImgFail(symbolId)}
          onTap={onTap}
          fontSize={Math.max(22, Math.floor(size / 6))}
        />
      ))}

      {/* 락 오버레이 */}
      {locked && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0, borderRadius: 24,
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(1.5px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: Math.floor(size / 4), pointerEvents: "none",
          }}
        >
          <span role="img" aria-label="대기">⏳</span>
        </div>
      )}
    </div>
  );
}

// 심볼 개수별 격자 배치
function gridSpec(count: number): { cols: string; rows: string } {
  switch (count) {
    case 4:  return { cols: "1fr 1fr", rows: "1fr 1fr" };
    case 5:  return { cols: "1fr 1fr 1fr", rows: "1fr 1fr" }; // 6칸 중 5개 사용
    case 6:  return { cols: "1fr 1fr 1fr", rows: "1fr 1fr" };
    default: return { cols: "1fr 1fr", rows: "1fr 1fr" };
  }
}

// ────────────────────────────────────────────────────────────
// SpotItSymbolButton
// ────────────────────────────────────────────────────────────
function SpotItSymbolButton(props: {
  symbolId: number;
  rotation: number;
  interactive: boolean;
  imgFailed: boolean;
  onImgFail: () => void;
  onTap?: (symbolId: number) => void;
  fontSize: number;
}) {
  const { symbolId, rotation, interactive, imgFailed, onImgFail, onTap, fontSize } = props;
  const sym = SPOTIT_SYMBOLS[symbolId];
  const fallbackEmoji = emojiForKey(sym.key);

  const inner: CSSProperties = {
    width: "100%", height: "100%",
    display: "flex", alignItems: "center", justifyContent: "center",
    transform: `rotate(${rotation}deg)`,
    fontSize, lineHeight: 1,
  };

  const imgStyle: CSSProperties = {
    width: "80%", height: "80%", objectFit: "contain",
    pointerEvents: "none",
  };

  const content = imgFailed ? (
    <span aria-hidden="true" style={inner}>{fallbackEmoji}</span>
  ) : (
    <div style={inner}>
      <img
        src={sym.image}
        alt=""
        aria-hidden="true"
        onError={onImgFail}
        style={imgStyle}
        draggable={false}
      />
    </div>
  );

  const baseStyle: CSSProperties = {
    position: "relative",
    width: "100%", height: "100%",
    borderRadius: 16,
    background: "#FFFDF7",
    border: "1px solid #F3E8CA",
    padding: 0,
    cursor: interactive ? "pointer" : "default",
    overflow: "hidden",
    touchAction: "manipulation",
  };

  if (interactive) {
    return (
      <button
        type="button"
        aria-label={sym.key}
        onClick={() => onTap && onTap(symbolId)}
        style={baseStyle}
      >
        {content}
      </button>
    );
  }

  return (
    <div aria-hidden="true" style={baseStyle}>
      {content}
    </div>
  );
}

// 이미지 폴백용 이모지 매핑 (SPOTIT_SYMBOLS.key 와 동기화)
function emojiForKey(key: string): string {
  switch (key) {
    case "apple":  return "🍎";
    case "banana": return "🍌";
    case "cat":    return "🐱";
    case "dog":    return "🐶";
    case "book":   return "📖";
    case "water":  return "💧";
    case "school": return "🏫";
    case "house":  return "🏠";
    case "sun":    return "☀️";
    case "moon":   return "🌙";
    case "rice":   return "🍚";
    case "tea":    return "🍵";
    case "bee":    return "🐝";
    default:       return "❓";
  }
}

// ────────────────────────────────────────────────────────────
// 공통 스타일
// ────────────────────────────────────────────────────────────
const primaryBtn: CSSProperties = {
  background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
  color: "#fff", border: "none", padding: "14px 32px",
  borderRadius: 99, fontSize: 15, fontWeight: 800, cursor: "pointer",
  boxShadow: "0 8px 20px rgba(245,158,11,0.4)",
};

const secondaryBtn: CSSProperties = {
  background: "#fff", color: "#374151",
  border: "2px solid #D1D5DB", padding: "12px 22px",
  borderRadius: 99, fontSize: 14, fontWeight: 800, cursor: "pointer",
};

const sectionBox: CSSProperties = {
  background: "#fff", borderRadius: 14, padding: "10px 12px",
  marginBottom: 10, boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
  border: "1px solid #F3F4F6",
};

const sectionTitle: CSSProperties = {
  fontSize: 12, fontWeight: 800, color: "#6B7280",
  marginBottom: 8, textAlign: "left",
};

function pillBtn(active: boolean, accent: string): CSSProperties {
  return {
    background: active ? accent : "#fff",
    color: active ? "#fff" : "#374151",
    border: `2px solid ${active ? accent : "#E5E7EB"}`,
    padding: "8px 14px",
    borderRadius: 99,
    fontSize: 13, fontWeight: 800,
    cursor: "pointer",
    minWidth: 60,
  };
}

// MIN_PLAYERS / MAX_PLAYERS / PlayerId 레퍼런스 유지용 (린트)
export const _SPOT_IT_META = { MIN_PLAYERS, MAX_PLAYERS };

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

type Player = "A" | "B";
type Phase = "intro" | "play" | "result";

interface Pop {
  who: Player;
  label: string;
  labelOther: string;
}

const WIN_SCORE = 7;

// 카드별 심볼 위치(2x2 그리드 내 살짝 랜덤 회전). 카드 id 별로 고정되게 seeded.
function seededRotation(cardId: number, slot: number): number {
  // 간단한 결정론적 해시: 카드 index + slot → -15°..15°
  const h = Math.sin(cardId * 9.31 + slot * 2.17) * 10000;
  const frac = h - Math.floor(h);
  return Math.round(frac * 30 - 15);
}

function cardIndex(card: number[]): number {
  // 카드의 심볼들을 정렬한 문자열을 SPOTIT_CARDS 에서 찾는 대신
  // 간단히 첫번째/두번째 심볼 합으로 유사 해시. (표시용 회전에만 쓰임)
  return card[0] * 17 + card[1] * 3 + card[2] + card[3] * 5;
}

export default function SpotIt({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<Phase>("intro");

  // 덱 + 세 자리
  const [deck, setDeck] = useState<number[][]>([]);
  const [cursor, setCursor] = useState<number>(0);
  const [centerCard, setCenterCard] = useState<number[]>([]);
  const [cardA, setCardA] = useState<number[]>([]);
  const [cardB, setCardB] = useState<number[]>([]);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [lockA, setLockA] = useState(0);
  const [lockB, setLockB] = useState(0);
  const [pop, setPop] = useState<Pop | null>(null);

  // 이미지 폴백 추적 (id 별)
  const [imgFail, setImgFail] = useState<Record<number, boolean>>({});

  // 1Hz tick — 락/팝 해제 감지 + 재렌더 트리거
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

  // dev invariant check
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
    const shuffled = pickN(SPOTIT_CARDS, SPOTIT_CARDS.length);
    // 3장 초기 배분 + cursor = 3
    setDeck(shuffled);
    setCenterCard(shuffled[0]);
    setCardA(shuffled[1]);
    setCardB(shuffled[2]);
    setCursor(3);
    setScoreA(0);
    setScoreB(0);
    setLockA(0);
    setLockB(0);
    setPop(null);
    setPhase("play");
  }

  function symbolById(id: number): SpotItSymbol {
    return SPOTIT_SYMBOLS[id];
  }

  function showPop(who: Player, symbolId: number) {
    const sym = symbolById(symbolId);
    const myLang = who === "A" ? langA : langB;
    const otherLang = who === "A" ? langB : langA;
    setPop({
      who,
      label: tr(sym.label, myLang),
      labelOther: tr(sym.label, otherLang),
    });
    if (popTimerRef.current) clearTimeout(popTimerRef.current);
    popTimerRef.current = setTimeout(() => setPop(null), 2000);
  }

  function onTap(player: Player, symbolId: number) {
    if (phase !== "play") return;
    const now = Date.now();
    const myLock = player === "A" ? lockA : lockB;
    if (now < myLock) return;

    const myCard = player === "A" ? cardA : cardB;
    const common = commonSymbol(myCard, centerCard);

    if (symbolId !== common) {
      // 오답 → 0.8초 락
      const until = now + 800;
      if (player === "A") setLockA(until);
      else setLockB(until);
      return;
    }

    // 정답 → 점수 +1, 중앙:=내 카드, 내 카드:=deck[cursor]
    showPop(player, symbolId);

    const nextCenter = myCard;
    const nextCard = cursor < deck.length ? deck[cursor] : null;

    if (player === "A") setScoreA((s) => s + 1);
    else setScoreB((s) => s + 1);

    setCenterCard(nextCenter);

    if (nextCard === null) {
      // 덱 소진 → result
      if (player === "A") setCardA([]);
      else setCardB([]);
      setPhase("result");
      return;
    }

    if (player === "A") setCardA(nextCard);
    else setCardB(nextCard);
    setCursor((c) => c + 1);

    // 승리 점수 도달
    const newScore = (player === "A" ? scoreA : scoreB) + 1;
    if (newScore >= WIN_SCORE) {
      setPhase("result");
    }
  }

  const remaining = Math.max(0, deck.length - cursor);

  if (phase === "intro") {
    return (
      <div style={{ textAlign: "center", padding: 40, maxWidth: 480, margin: "0 auto" }}>
        <BeeMascot size={120} mood="happy" />
        <div style={{ fontSize: 24, fontWeight: 900, margin: "18px 0 8px", color: "#1F2937" }}>
          🕵️ 꿀벌 스팟잇
        </div>
        <div style={{ color: "#6B7280", marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>
          내 카드와 가운데 카드에서<br />
          <b>똑같은 그림 1개</b>를 먼저 찾아 탭하세요!
        </div>
        <div style={{
          background: "#fff", borderRadius: 16, padding: "14px 16px",
          fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          border: "2px solid #FDE68A", textAlign: "left",
        }}>
          <div>• 정답 → 점수 +1, 가운데 카드 교체</div>
          <div>• 오답 → 0.8초 동안 탭 못함</div>
          <div>• 먼저 <b>{WIN_SCORE}점</b> 내거나 카드 소진 시 종료</div>
        </div>
        <button onClick={start} style={primaryBtn}>▶ 시작</button>
      </div>
    );
  }

  if (phase === "result") {
    const winner = scoreA === scoreB ? null : scoreA > scoreB ? "A" : "B";
    return (
      <div style={{ textAlign: "center", padding: 40, maxWidth: 480, margin: "0 auto" }}>
        <BeeMascot size={120} mood={winner ? "celebrate" : "think"} />
        <div style={{ fontSize: 24, fontWeight: 900, margin: "18px 0 10px", color: "#1F2937" }}>
          {winner ? (winner === "A" ? "🎉 아래쪽 승리!" : "🎉 위쪽 승리!") : "🤝 무승부!"}
        </div>
        <div style={{
          display: "flex", gap: 16, justifyContent: "center", marginBottom: 24,
          fontSize: 18, fontWeight: 800,
        }}>
          <div style={{
            background: "#FEF3C7", padding: "12px 20px", borderRadius: 14,
            border: "2px solid #FBBF24",
          }}>
            <div style={{ fontSize: 11, color: "#92400E" }}>아래 (A)</div>
            <div style={{ fontSize: 24, color: "#B45309" }}>{scoreA}</div>
          </div>
          <div style={{
            background: "#DBEAFE", padding: "12px 20px", borderRadius: 14,
            border: "2px solid #60A5FA",
          }}>
            <div style={{ fontSize: 11, color: "#1E40AF" }}>위 (B)</div>
            <div style={{ fontSize: 24, color: "#1D4ED8" }}>{scoreB}</div>
          </div>
        </div>
        <button onClick={start} style={primaryBtn}>🔁 다시 하기</button>
      </div>
    );
  }

  const now = Date.now();
  const aLocked = now < lockA;
  const bLocked = now < lockB;

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
          목표 {WIN_SCORE}점
        </span>
      </div>

      {/* 플레이어 B 영역 (상단, 180도 회전) */}
      <PlayerZone
        player="B"
        card={cardB}
        score={scoreB}
        locked={bLocked}
        imgFail={imgFail}
        onImgFail={(id) => setImgFail((m) => ({ ...m, [id]: true }))}
        onTap={(s) => onTap("B", s)}
        lang={langB}
        pop={pop?.who === "B" ? pop : null}
        rotated
      />

      {/* 중앙 카드 */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        padding: "2px 0",
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
        />
      </div>

      {/* 플레이어 A 영역 (하단) */}
      <PlayerZone
        player="A"
        card={cardA}
        score={scoreA}
        locked={aLocked}
        imgFail={imgFail}
        onImgFail={(id) => setImgFail((m) => ({ ...m, [id]: true }))}
        onTap={(s) => onTap("A", s)}
        lang={langA}
        pop={pop?.who === "A" ? pop : null}
        rotated={false}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// PlayerZone
// ────────────────────────────────────────────────────────────
function PlayerZone(props: {
  player: Player;
  card: number[];
  score: number;
  locked: boolean;
  imgFail: Record<number, boolean>;
  onImgFail: (id: number) => void;
  onTap: (symbolId: number) => void;
  lang: string;
  pop: Pop | null;
  rotated: boolean;
}) {
  const {
    player, card, score, locked, imgFail, onImgFail, onTap, lang, pop, rotated,
  } = props;

  const isA = player === "A";
  const bg = isA ? "#FEF3C7" : "#DBEAFE";
  const accent = isA ? "#F59E0B" : "#3B82F6";
  const label = isA ? "아래 (A)" : "위 (B)";

  return (
    <div
      style={{
        background: bg,
        borderRadius: 22,
        padding: "10px 10px 12px",
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
        />
      </div>

      {/* 말풍선 */}
      {pop && (
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            top: isA ? -8 : undefined,
            bottom: isA ? undefined : -8,
            left: "50%",
            transform: `translate(-50%, ${isA ? "-100%" : "100%"})${rotated ? " rotate(180deg)" : ""}`,
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
            fontSize: 22, fontWeight: 900, color: "#111827", lineHeight: 1.1,
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
}) {
  const {
    card, accentColor, bgColor, imgFail, onImgFail,
    interactive, locked, onTap, ariaRole, ariaLabel,
  } = props;

  const cid = useMemo(() => (card.length ? cardIndex(card) : 0), [card]);

  if (!card.length) {
    return (
      <div style={{
        width: 220, height: 220,
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
        width: 220, height: 220,
        borderRadius: 24,
        background: bgColor,
        border: `3px solid ${accentColor}`,
        boxShadow: `0 8px 18px ${accentColor}44, inset 0 2px 0 rgba(255,255,255,0.6)`,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 4,
        padding: 10,
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
            fontSize: 54, pointerEvents: "none",
          }}
        >
          <span role="img" aria-label="대기">⏳</span>
        </div>
      )}
    </div>
  );
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
}) {
  const { symbolId, rotation, interactive, imgFailed, onImgFail, onTap } = props;
  const sym = SPOTIT_SYMBOLS[symbolId];
  const fallbackEmoji = emojiForKey(sym.key);

  const inner: CSSProperties = {
    width: "100%", height: "100%",
    display: "flex", alignItems: "center", justifyContent: "center",
    transform: `rotate(${rotation}deg)`,
    fontSize: 44, lineHeight: 1,
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

const primaryBtn: CSSProperties = {
  background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
  color: "#fff", border: "none", padding: "14px 32px",
  borderRadius: 99, fontSize: 15, fontWeight: 800, cursor: "pointer",
  boxShadow: "0 8px 20px rgba(245,158,11,0.4)",
};

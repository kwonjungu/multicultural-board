"use client";

import { useEffect, useState } from "react";
import HoneyTaboo from "@/components/games/HoneyTaboo";
import NumberTap from "@/components/games/NumberTap";
import WordMemory from "@/components/games/WordMemory";
import DrawGuess from "@/components/games/DrawGuess";
import SpotDifference from "@/components/games/SpotDifference";
import WordTower from "@/components/games/WordTower";
import TwentyQuestions from "@/components/games/TwentyQuestions";
import WouldYouRather from "@/components/games/WouldYouRather";
import SpotIt from "@/components/games/SpotIt";
import StoryCubes from "@/components/games/StoryCubes";
import BeeTreasureHunt from "@/components/games/BeeTreasureHunt";
import BeeCafe from "@/components/games/BeeCafe";
import GlobeQuest from "@/components/games/GlobeQuest";
import BeeWorldMarble from "@/components/games/BeeWorldMarble";
import HoneyYut from "@/components/games/HoneyYut";
import HalliGalli from "@/components/games/HalliGalli";
import CulturePuzzle from "@/components/games/CulturePuzzle";
import CountryGuess from "@/components/games/CountryGuess";
import EmotionQuiz from "@/components/games/EmotionQuiz";
import GreetingRelay from "@/components/games/GreetingRelay";
import MarketRolePlay from "@/components/games/MarketRolePlay";

/**
 * 이번 라운드에 손댄 게임만 올린다. 나머지 게임은 아직 토큰으로 옮기지 않았고,
 * 검증하지 않은 것을 검증한 것처럼 보이게 하지 않는다.
 * `?game=taboo|number|memory` 로 하나만 열 수 있다 (측정 스크립트가 쓰는 경로).
 */
const GAMES = {
  taboo: { label: "꿀벌 금칙어", cmp: HoneyTaboo },
  number: { label: "숫자 빨리 누르기", cmp: NumberTap },
  memory: { label: "기억 카드", cmp: WordMemory },
  draw: { label: "그림 맞히기", cmp: DrawGuess },
  spot: { label: "틀린 그림 찾기", cmp: SpotDifference },
  tower: { label: "단어 탑 쌓기", cmp: WordTower },
  twentyq: { label: "스무고개", cmp: TwentyQuestions },
  wyr: { label: "이거 저거 고르기", cmp: WouldYouRather },
  spotit: { label: "꿀벌 스팟잇", cmp: SpotIt },
  story: { label: "이야기 주사위", cmp: StoryCubes },
  treasure: { label: "꿀벌 보물사냥", cmp: BeeTreasureHunt },
  cafe: { label: "꿀벌 카페", cmp: BeeCafe },
  globe: { label: "다문화 지구본", cmp: GlobeQuest },
  marble: { label: "꿀벌 월드 마블", cmp: BeeWorldMarble },
  yut: { label: "꿀벌 윷놀이", cmp: HoneyYut },
  halligalli: { label: "할리갈리", cmp: HalliGalli },
  puzzle: { label: "문화 퍼즐", cmp: CulturePuzzle },
  country: { label: "이 나라는 어디?", cmp: CountryGuess },
  emotion: { label: "이 마음은?", cmp: EmotionQuiz },
  greeting: { label: "인사말 배우기", cmp: GreetingRelay },
  market: { label: "시장 역할극", cmp: MarketRolePlay },
} as const;

type Key = keyof typeof GAMES;

export default function GameFixture() {
  const [key, setKey] = useState<Key>("taboo");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("game");
    if (q && q in GAMES) setKey(q as Key);
  }, []);

  const Active = GAMES[key].cmp;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ux-bg)" }}>
      <nav
        data-testid="fixture-nav"
        style={{ display: "flex", gap: 8, padding: 8, flexWrap: "wrap", background: "var(--ux-surface-sunk)" }}
      >
        {(Object.keys(GAMES) as Key[]).map((k) => (
          <button
            key={k}
            onClick={() => setKey(k)}
            aria-pressed={key === k}
            style={{
              padding: "10px 14px", borderRadius: 12, fontFamily: "inherit",
              border: key === k ? "3px solid var(--ux-selected-border)" : "2px solid var(--ux-ink-soft)",
              background: "var(--ux-surface)", color: "var(--ux-ink)", cursor: "pointer",
            }}
          >{GAMES[k].label}</button>
        ))}
      </nav>
      {/* 게임 쪽 data-ux-root 가 화면당 하나가 되도록 여기서는 달지 않는다. */}
      <Active langA="ko" langB="vi" />
    </div>
  );
}

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
import { GameShellProvider } from "@/components/ui/game/GameShellContext";

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
  const [exited, setExited] = useState(0);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("game");
    if (q && q in GAMES) setKey(q as Key);
  }, []);

  const Active = GAMES[key].cmp;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ux-bg)" }}>
      {/* data-fixture-chrome: 검수 도구가 제품 UI 로 세면 안 되는 fixture 껍데기.
          이 칩들은 게임을 고르기 위한 개발용 스위치이지 아이가 보는 화면이 아니다. */}
      <nav
        data-testid="fixture-nav"
        data-fixture-chrome
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
      {/* U01: 공용 GameHeader 의 '뒤로'는 게임이 onBack 을 주지 않으면 셸 밖으로
          나간다. 실제 앱에서는 GameRoom 의 backStack 레이어가 그 역할을 하지만
          fixture 에는 셸이 없으므로 여기서 직접 준다 — 그래야 측정 스크립트가
          비활성 버튼이 아닌 진짜 버튼의 크기·히트를 잰다. */}
      <GameShellProvider onExit={() => setExited((n) => n + 1)}>
        <Active langA="ko" langB="vi" />
      </GameShellProvider>
      {exited > 0 && (
        <p data-fixture-chrome style={{ padding: 8, margin: 0, background: "#111", color: "#9CA3AF", font: "12px monospace" }}>
          fixture: 게임 목록으로 나가기 {exited}회 호출됨
        </p>
      )}
    </div>
  );
}

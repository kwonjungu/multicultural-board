"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LANGUAGES } from "@/lib/constants";
import { useBackLayer } from "@/lib/backStack";
import { GameText, prefetchGameTexts } from "@/lib/gameI18n";
import { reportQuestEvent } from "@/lib/quests";
import { gt, type LangMap } from "./games/uiText";
import ScopedStyle from "./ui/child/ScopedStyle";
import BeeMascot from "./BeeMascot";
import CountryGuess from "./games/CountryGuess";
import WordMemory from "./games/WordMemory";
import SpotDifference from "./games/SpotDifference";
import CulturePuzzle from "./games/CulturePuzzle";
import GreetingRelay from "./games/GreetingRelay";
import DrawGuess from "./games/DrawGuess";
import NumberTap from "./games/NumberTap";
import EmotionQuiz from "./games/EmotionQuiz";
import MarketRolePlay from "./games/MarketRolePlay";
import WordTower from "./games/WordTower";
import TwentyQuestions from "./games/TwentyQuestions";
import HoneyTaboo from "./games/HoneyTaboo";
import WouldYouRather from "./games/WouldYouRather";
import SpotIt from "./games/SpotIt";
import HalliGalli from "./games/HalliGalli";
import BeeWorldMarble from "./games/BeeWorldMarble";
import StoryCubes from "./games/StoryCubes";
import BeeTreasureHunt from "./games/BeeTreasureHunt";
import HoneyYut from "./games/HoneyYut";
import BeeCafe from "./games/BeeCafe";

// three.js(~600KB)가 들어 있어 지구본을 열 때만 로드
const GlobeQuest = dynamic(() => import("./games/GlobeQuest"), { ssr: false });

type GameMeta = {
  id: string;
  icon: string;
  /** Optional PNG that, if present at /public/game-icons/<id>.png, replaces the emoji. */
  iconImg?: string;
  name: string;
  sub: string;
  color: string;
  bg: string;                  // 게임 선택 카드 배경(단색)
  playBg?: string;             // 플레이 화면 배경(없으면 bg). 세계 명소 테마 게임에 사용.
  cmp: React.ComponentType<{ langA: string; langB: string }>;
};

// [게임룸 셸 i18n] 헤더·언어 카드·목록 안내 문구. 게임 이름/부제는 GameText
// (ko 원문 → 번역 API 캐시) 로 처리하므로 여기엔 고정 UI 문구만 둔다.
const GR: Record<string, LangMap> = {
  title: {
    ko: "꿀벌 게임룸", en: "Bee Game Room", vi: "Phòng trò chơi Ong", zh: "蜜蜂游戏室",
    fil: "Game Room ng Bubuyog", ja: "ミツバチゲームルーム", th: "ห้องเกมผึ้ง", id: "Ruang Main Lebah",
    ru: "Игровая комната пчёл", hi: "मधुमक्खी गेम रूम", ar: "غرفة ألعاب النحل",
    mn: "Зөгийн тоглоомын өрөө", uz: "Asalari o'yin xonasi", km: "បន្ទប់ល្បែងឃ្មុំ", my: "ပျားဂိမ်းခန်း",
  },
  subtitle: {
    ko: "친구랑 같이 놀면서 친해져요", en: "Play together and make friends",
    vi: "Cùng chơi và kết bạn nhé", zh: "一起玩，成为好朋友", fil: "Maglaro at magkaibigan",
    ja: "ともだちとあそんでなかよくなろう", th: "เล่นด้วยกันให้สนิทกันนะ", id: "Main bersama dan berteman",
    ru: "Играй и заводи друзей", hi: "साथ खेलो, दोस्त बनो", ar: "العبوا معًا وكوّنوا صداقات",
  },
  friendLangHeader: {
    ko: "함께 놀 친구의 언어", en: "Your friend's language", vi: "Ngôn ngữ của bạn cùng chơi",
    zh: "一起玩的朋友的语言", fil: "Wika ng kalaro mo", ja: "いっしょにあそぶともだちのことば",
    th: "ภาษาของเพื่อนที่เล่นด้วย", id: "Bahasa teman mainmu", ru: "Язык твоего друга",
    hi: "दोस्त की भाषा", ar: "لغة صديقك",
  },
  me: {
    ko: "나", en: "Me", vi: "Tôi", zh: "我", fil: "Ako", ja: "わたし", th: "ฉัน",
    id: "Aku", ru: "Я", hi: "मैं", ar: "أنا", mn: "Би", uz: "Men", km: "ខ្ញុំ", my: "ကျွန်တော်",
  },
  friend: {
    ko: "친구", en: "Friend", vi: "Bạn", zh: "朋友", fil: "Kaibigan", ja: "ともだち", th: "เพื่อน",
    id: "Teman", ru: "Друг", hi: "दोस्त", ar: "صديق", mn: "Найз", uz: "Do'st", km: "មិត្ត", my: "သူငယ်ချင်း",
  },
  teachEachOther: {
    ko: "서로 알려줘", en: "Teach each other", vi: "Dạy cho nhau nhé", zh: "互相教一教",
    fil: "Turuan ang isa't isa", ja: "おしえあおう", th: "สอนกันและกัน", id: "Saling ajari",
    ru: "Учите друг друга", hi: "एक-दूसरे को सिखाओ", ar: "علّما بعضكما",
  },
  whichGame: {
    ko: "어떤 놀이를 할까?", en: "Which game shall we play?", vi: "Chơi trò nào đây?",
    zh: "玩什么游戏呢?", fil: "Anong laro ang gusto mo?", ja: "どのあそびにする?",
    th: "จะเล่นเกมไหนดี?", id: "Main game yang mana?", ru: "Во что сыграем?",
    hi: "कौन सा खेल खेलें?", ar: "أي لعبة نلعب؟",
  },
  gamesReady: {
    ko: "개 준비됨", en: "games ready", vi: "trò chơi sẵn sàng", zh: "个游戏",
    fil: "laro", ja: "こじゅんびOK", th: "เกมพร้อมแล้ว", id: "game siap",
    ru: "игр готово", hi: "खेल तैयार", ar: "لعبة جاهزة",
  },
};

// 세계 명소 배경 — 여행/문화 테마 게임 플레이 화면용. 크림 오버레이로 가독성 유지.
const WORLD_BG =
  "linear-gradient(rgba(255,251,235,0.84), rgba(255,247,224,0.84)), url('/backgrounds/world-landmarks.jpg') center top / cover no-repeat";

const GAMES: GameMeta[] = [
  // #4 상단 4개 — 완성도 높고 저학년 친화 (지정 순서: 지구본·윷놀이·할리갈리·문화퍼즐)
  { id: "globe",    icon: "🌍", iconImg: "/game-icons/globe.png",     name: "다문화 지구본", sub: "공부하기·나라 찾기", color: "#3730A3", bg: "#E0E7FF", playBg: WORLD_BG, cmp: GlobeQuest },
  { id: "marble",   icon: "🎲", iconImg: "/marble/tiles/start.png", name: "꿀벌 월드 마블",     sub: "세계 여행 보드게임", color: "#D97706", bg: "#FEF3C7", cmp: BeeWorldMarble },
  { id: "yut",      icon: "🪵", iconImg: "/game-icons/yut.png",      name: "꿀벌 윷놀이",   sub: "우리 전통 놀이",    color: "#B45309", bg: "#FEF3C7", cmp: HoneyYut },
  { id: "halligalli", icon: "🔔", iconImg: "/game-icons/halligalli.png", name: "할리갈리",           sub: "과일 5개 종 울려!", color: "#DC2626", bg: "#FEE2E2", cmp: HalliGalli },
  { id: "puzzle",    icon: "🧩", iconImg: "/game-icons/puzzle.png",   name: "문화 퍼즐",          sub: "조각 맞추기",       color: "#F472B6", bg: "#FCE7F3", cmp: CulturePuzzle },
  // 나머지 게임 — 기존 상대 순서 유지
  { id: "country",   icon: "🌏", iconImg: "/game-icons/country.png",  name: "이 나라는 어디?",   sub: "국기 맞추기",       color: "#F59E0B", bg: "#FEF3C7", playBg: WORLD_BG, cmp: CountryGuess },
  { id: "emotion",   icon: "💗", iconImg: "/game-icons/emotion.png",  name: "이 마음은?",         sub: "감정 알아채기",     color: "#FB7185", bg: "#FFE4E6", cmp: EmotionQuiz },
  { id: "memory",    icon: "🎴", iconImg: "/game-icons/memory.png",   name: "기억 카드",          sub: "짝 맞추기",         color: "#A78BFA", bg: "#EDE9FE", cmp: WordMemory },
  { id: "greeting",  icon: "👋", iconImg: "/game-icons/greeting.png", name: "인사말 배우기",      sub: "들은 인사 찾기",    color: "#10B981", bg: "#D1FAE5", playBg: WORLD_BG, cmp: GreetingRelay },
  { id: "market",    icon: "🍜", iconImg: "/game-icons/market.png",   name: "시장 역할극",        sub: "대화 연습",         color: "#EF4444", bg: "#FEE2E2", cmp: MarketRolePlay },
  { id: "draw",      icon: "🎨", iconImg: "/game-icons/draw.png",     name: "그림 맞히기",        sub: "꿀벌 낙서",         color: "#3B82F6", bg: "#DBEAFE", cmp: DrawGuess },
  { id: "spot",      icon: "🔍", iconImg: "/game-icons/spot.png",     name: "틀린 그림 찾기",     sub: "다른 곳 찾기",      color: "#6366F1", bg: "#E0E7FF", cmp: SpotDifference },
  { id: "number",    icon: "🔢", iconImg: "/game-icons/number.png",   name: "숫자 빨리 누르기",   sub: "듣고 터치",         color: "#FACC15", bg: "#FEF9C3", cmp: NumberTap },
  { id: "tower",     icon: "🏗️", iconImg: "/game-icons/tower.png",    name: "단어 탑 쌓기",       sub: "번역 맞히기",       color: "#14B8A6", bg: "#CCFBF1", cmp: WordTower },
  { id: "twentyq",   icon: "🔎", iconImg: "/game-icons/twentyq.png",  name: "스무고개",           sub: "예/아니오로 맞히기", color: "#8B5CF6", bg: "#EDE9FE", cmp: TwentyQuestions },
  { id: "taboo",     icon: "🚫", iconImg: "/game-icons/taboo.png",    name: "꿀벌 금칙어",         sub: "단어 설명 놀이",    color: "#E11D48", bg: "#FFE4E6", cmp: HoneyTaboo },
  { id: "wyr",       icon: "🎲", iconImg: "/game-icons/wyr.png",      name: "이거 저거 고르기",   sub: "둘 중 뭐가 좋아?",  color: "#F97316", bg: "#FFEDD5", cmp: WouldYouRather },
  { id: "spotit",    icon: "🕵️", iconImg: "/game-icons/spotit.png",   name: "꿀벌 스팟잇",         sub: "같은 그림 먼저!",   color: "#F59E0B", bg: "#FEF3C7", cmp: SpotIt },
  { id: "story", icon: "📖", iconImg: "/game-icons/story.png", name: "이야기 주사위", sub: "한 문장씩 이어가기", color: "#A78BFA", bg: "#EDE9FE", cmp: StoryCubes },
  { id: "treasure", icon: "🗺", iconImg: "/game-icons/treasure.png", name: "꿀벌 보물사냥", sub: "힌트로 찾아내기", color: "#14B8A6", bg: "#CCFBF1", playBg: WORLD_BG, cmp: BeeTreasureHunt },
  { id: "cafe",     icon: "🍳", iconImg: "/game-icons/cafe.png",     name: "꿀벌 카페",     sub: "함께 요리해요",     color: "#F97316", bg: "#FFEDD5", cmp: BeeCafe },
];

/** Graceful <img> that falls back to an emoji span when the PNG is missing. */
function GameIcon({ icon, iconImg, size }: { icon: string; iconImg?: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (!iconImg || failed) {
    return <div style={{ fontSize: size, lineHeight: 1 }}>{icon}</div>;
  }
  return (
    <img
      src={iconImg}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      style={{ width: size + 10, height: size + 10, objectFit: "contain", filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.15))" }}
    />
  );
}

/**
 * 게임 로비 CSS — U01/U09 재배치 (04 §5).
 *
 * 이전에는 이 화면이 토큰 시스템을 전혀 쓰지 않고 인라인 px 로 색·크기를
 * 다 정해서, 게임마다 다른 파스텔(연보라/노랑/분홍)이 카드를 채우고 언어
 * 카드가 첫 화면의 1/4 을 가져갔다. 여기서부터는:
 *  - 언어 선택은 접힌 칩 요약(.gr-lang-bar) 이 기본, 펼침(.gr-lang-panel)은
 *    누른 사람만 본다 — 매번 놀이를 고르기 전에 언어부터 볼 필요는 없다.
 *  - 카드 색은 게임과 무관하게 전부 같은 토큰(surface/primary-border) —
 *    구분은 아이콘·라벨이 맡는다. 게임별 그라디언트를 다시 만들지 않는다.
 *  - 그리드 열 수는 폭으로만 정한다(640px/1200px). tokens.json 의
 *    responsive.containers 값과 같은 경계다.
 */
const LOBBY_CSS = `
.gr-header{
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-3);
  display: flex; align-items: center; gap: var(--ux-space-3);
  flex-shrink: 0; position: relative; z-index: 2;
}
.gr-close{
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  color: var(--ux-primary-ink); font-weight: 900; flex-shrink: 0;
}
.gr-header-text{ flex: 1; min-width: 0; }
.gr-title{ color: var(--ux-ink); display: flex; align-items: center; gap: 6px; font-weight: 900; }
.gr-subtitle{ margin-top: 2px; }
.gr-bee{ width: 56px; height: 56px; flex-shrink: 0; filter: drop-shadow(0 4px 12px rgba(245,158,11,.35)); }

/* 언어 요약 바 — 기본은 칩 두 개만. 카드 전체를 다시 펼치지 않는다. */
.gr-lang-bar{
  margin: 0 var(--ux-space-4); padding: var(--ux-space-2) var(--ux-space-3);
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  display: flex; align-items: center; gap: var(--ux-space-2);
  flex-wrap: wrap; position: relative; z-index: 2;
}
.gr-lang-bar-label{ flex-shrink: 0; }
.gr-lang-chips{ display: flex; align-items: center; gap: var(--ux-space-2); flex: 1 1 auto; min-width: 0; flex-wrap: wrap; }
.gr-chip{
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--ux-bg); border: 2px solid var(--ux-primary-border);
  color: var(--ux-ink); font-weight: 800; font-family: inherit;
}
.gr-chip[data-ux-role="control"]{ padding: var(--ux-space-1) var(--ux-space-3); }
.gr-chip.me.on{ background: var(--ux-primary-fill); border-color: var(--ux-selected-border); }
.gr-chip.friend.on{ background: var(--ux-hint-lavender); border-color: var(--ux-selected-border); }
.gr-chip-flag{ font-size: 1.3em; line-height: 1; }
.gr-lang-swap{ color: var(--ux-ink-soft); font-weight: 900; flex-shrink: 0; }

.gr-lang-panel{
  margin: var(--ux-space-2) var(--ux-space-4) 0;
  padding: var(--ux-space-3); background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-surface);
  display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--ux-space-2);
  position: relative; z-index: 2;
}
@media (min-width: 640px){ .gr-lang-panel{ grid-template-columns: repeat(6, 1fr); } }
.gr-lang-opt{
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  background: var(--ux-surface); border: 2px solid transparent; color: var(--ux-ink); font-family: inherit;
}
.gr-lang-opt.on{ background: var(--ux-primary-fill); border-color: var(--ux-selected-border); color: var(--ux-primary-ink); }
.gr-lang-opt-flag{ font-size: 1.4em; line-height: 1; }

.gr-grid-wrap{ flex: 1; overflow: auto; padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-8); position: relative; z-index: 2; }
.gr-grid-heading{ margin-bottom: var(--ux-space-3); display: flex; align-items: center; gap: 6px; color: var(--ux-ink); font-weight: 900; }
.gr-grid-count{ font-weight: 700; color: var(--ux-ink-soft); }

/* 그리드 열 수는 폭으로만 정한다 (04 §5 / tokens.json responsive.containers):
   ~639px 2열 · 640~1199px 3열 · 1200px+ 4열. */
.gr-grid{ display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--ux-space-3); }
@media (min-width: 640px){ .gr-grid{ grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1200px){ .gr-grid{ grid-template-columns: repeat(4, 1fr); } }

/* 카드 = 하나의 버튼. 색은 게임과 무관하게 전부 같은 토큰 —
   구분은 아이콘·라벨의 몫이지 배경색의 몫이 아니다. */
.gr-card{
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); text-align: left; font-family: inherit;
  position: relative; box-shadow: 0 4px 12px rgba(137,83,0,.10);
  transition: border-color var(--ux-motion-state) var(--ux-motion-ease), transform var(--ux-motion-press) var(--ux-motion-ease);
}
.gr-card[data-ux-role="control"]{ min-height: 128px; padding: var(--ux-space-3) var(--ux-space-4); }
.gr-card:hover, .gr-card:focus-visible{ border-color: var(--ux-selected-border); }
.gr-card:active{ transform: scale(0.97); }
.gr-card-icon{
  width: 48px; height: 48px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: var(--ux-hint-apricot); border-radius: var(--ux-radius-surface);
}
.gr-card-title{ color: var(--ux-ink); font-weight: 900; }
.gr-card-title-alt{ display: block; color: var(--ux-ink-soft); font-weight: 700; }
.gr-card-sub{ color: var(--ux-ink-soft); }
/* PLAY 표시는 장식으로만 내린다 — 카드 전체가 이미 버튼이라 중첩 버튼을 만들지 않는다. */
.gr-card-play{ position: absolute; top: var(--ux-space-2); right: var(--ux-space-2); color: var(--ux-primary-border); opacity: .55; }
`;

const DEFAULT_LANG_CODES = ["ko","en","vi","zh","fil","ja","th","id"];

/**
 * 개발용 fixture 주입구 (HARNESS §2 G0). GameRoom 은 그 자체로 Firebase 를
 * 구독하지 않지만, "게임 1판 종료" 계측(reportQuestEvent)과 언어 번역 프리페치
 * (fetch("/api/storybook-translate"))가 이 화면에서 fire-and-forget 으로 나간다.
 * fixture 가 주입되면 이 두 경로를 모두 끈다 — 운영 방(1111)의 퀘스트 기록에
 * fixture 조회가 섞이지 않게 하기 위함이다.
 */
export interface GameRoomFixture {
  /** 처음 보여줄 화면. "lobby"=언어 카드+게임 그리드, "langpick"=언어 선택 펼친 상태. */
  initialView?: "lobby" | "langpick";
  /** initialView가 "langpick"일 때 펼칠 카드. 기본 "me". */
  langPickTarget?: "me" | "friend";
}

export default function GameRoom({ myLang, onClose, onChangeMyLang, roomLangs, roomCode, questClientId, fixture }: {
  myLang: string;
  onClose: () => void;
  /** "나" 카드에서 내 언어를 바꿀 때 호출 — 상위에서 UserConfig.myLang 갱신(localStorage 저장). */
  onChangeMyLang?: (lang: string) => void;
  roomLangs?: string[];
  /** 📋 일일 퀘스트 계측용 (선택) — 없으면 계측 생략. questClientId = 학생 이름 (교사는 미전달). */
  roomCode?: string;
  questClientId?: string;
  fixture?: GameRoomFixture;
}) {
  /** fixture 가 주입되면 네트워크 경계를 통째로 끈다. */
  const offline = !!fixture;
  const friendLangCodes = roomLangs && roomLangs.length > 0 ? roomLangs : DEFAULT_LANG_CODES;
  const defaultFriend = friendLangCodes.find((c) => c !== (myLang || "ko")) || "en";
  const [friendLang, setFriendLang] = useState<string>(defaultFriend);
  const [showLangPick, setShowLangPick] = useState<"me" | "friend" | null>(
    fixture?.initialView === "langpick" ? (fixture.langPickTarget ?? "me") : null
  );
  const [gameId, setGameId] = useState<string | null>(null);

  const viewerLang = myLang || "ko";
  const ActiveGame = GAMES.find((g) => g.id === gameId);

  // 게임 이름/부제 번역 프리페치 — 뷰어 언어가 사전에 없는 언어여도 목록이 바로 번역돼 보이게.
  useEffect(() => {
    if (offline) return;
    prefetchGameTexts(GAMES.flatMap((g) => [{ ko: g.name }, { ko: g.sub }]), viewerLang);
  }, [viewerLang, offline]);

  // 📋 일일 퀘스트 — 게임 1판 종료 계측. 개별 게임(20종)은 종료 신호를 셸로
  // 올리지 않으므로 "활성 게임에서 나가기"를 공통 종료 지점으로 사용 (1곳 원칙).
  // fire-and-forget — 기존 화면 전환 흐름은 그대로.
  const reportGamePlayed = () => {
    if (offline) return;
    if (roomCode && questClientId) reportQuestEvent(roomCode, questClientId, "game_play");
  };

  // 뒤로 가기: 게임 플레이 중이면 게임 목록으로 (허브로 바로 나가지 않음).
  useBackLayer(gameId !== null, () => { reportGamePlayed(); setGameId(null); });

  // 한국 학생끼리도 플레이 가능하도록 같은 언어 중복 선택 허용 (filter 제거)
  const availableFriendLangs = friendLangCodes;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 460,
      display: "flex", flexDirection: "column",
      // 🐝 협곡 꽃밭 풍경 배경을 흰 반투명(80%) 오버레이 아래 은은하게 (카드 가독성 유지)
      background: "linear-gradient(rgba(255,251,235,0.80), rgba(252,239,176,0.80)), url('/landing/game-canyon.webp') center / cover no-repeat",
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
      overflow: "hidden",
    }}>

      {!ActiveGame ? (
        <>
          <ScopedStyle css={LOBBY_CSS} />
          {/* Header */}
          <div data-tutorial-id="games-header" className="gr-header">
            <button
              type="button"
              data-ux-role="control"
              className="gr-close"
              onClick={onClose}
              aria-label="닫기"
            >←</button>
            <div className="gr-header-text">
              <div data-ux-role="title" className="gr-title">
                🎮 {gt(GR.title, viewerLang)}
              </div>
              <div data-ux-role="secondary" className="gr-subtitle">
                {gt(GR.subtitle, viewerLang)}
              </div>
            </div>
            <img
              src="/mascot/bee-celebrate.png"
              alt=""
              aria-hidden="true"
              className="gr-bee"
            />
          </div>

          {/* 언어 요약 — 접힌 칩 두 개. 펼치면 아래 gr-lang-panel 이 나온다.
              매번 놀이를 고르기 전에 언어부터 다시 정할 일은 드물어서, 큰 카드
              대신 한 줄 요약 + '바꾸는 경로'(칩 자체가 토글)로 내렸다. */}
          <div data-lobby-langpanel className="gr-lang-bar" role="group" aria-label={gt(GR.friendLangHeader, viewerLang)}>
            <span data-ux-role="secondary" className="gr-lang-bar-label">👫 {gt(GR.friendLangHeader, viewerLang)}</span>
            <div className="gr-lang-chips">
              {/* 나 — 누르면 내 언어도 바로 바꿀 수 있다 (게임룸 번역이 안 바뀐다는 혼동 방지) */}
              <button
                type="button"
                data-ux-role="control"
                className={showLangPick === "me" ? "gr-chip me on" : "gr-chip me"}
                aria-expanded={showLangPick === "me"}
                aria-controls="gr-lang-panel"
                onClick={() => setShowLangPick((v) => (v === "me" ? null : "me"))}
              >
                <span aria-hidden className="gr-chip-flag">{LANGUAGES[viewerLang]?.flag}</span>
                <span>{gt(GR.me, viewerLang)}: {LANGUAGES[viewerLang]?.label}</span>
                <span aria-hidden>{showLangPick === "me" ? "▴" : "▾"}</span>
              </button>
              <span aria-hidden className="gr-lang-swap">⇄</span>
              {/* 친구 */}
              <button
                type="button"
                data-ux-role="control"
                className={showLangPick === "friend" ? "gr-chip friend on" : "gr-chip friend"}
                aria-expanded={showLangPick === "friend"}
                aria-controls="gr-lang-panel"
                onClick={() => setShowLangPick((v) => (v === "friend" ? null : "friend"))}
              >
                <span aria-hidden className="gr-chip-flag">{LANGUAGES[friendLang]?.flag}</span>
                <span>{gt(GR.friend, viewerLang)}: {LANGUAGES[friendLang]?.label}</span>
                <span aria-hidden>{showLangPick === "friend" ? "▴" : "▾"}</span>
              </button>
            </div>
          </div>

          {showLangPick && (
            <div id="gr-lang-panel" className="gr-lang-panel" role="group" aria-label={gt(showLangPick === "me" ? GR.me : GR.friend, viewerLang)}>
              {(showLangPick === "me" ? Object.keys(LANGUAGES) : availableFriendLangs).map((c) => {
                const isMe = showLangPick === "me";
                const active = c === (isMe ? viewerLang : friendLang);
                return (
                  <button
                    key={c}
                    type="button"
                    data-ux-role="control"
                    className={active ? "gr-lang-opt on" : "gr-lang-opt"}
                    aria-pressed={active}
                    onClick={() => {
                      if (isMe) onChangeMyLang?.(c);
                      else setFriendLang(c);
                      setShowLangPick(null);
                    }}
                  >
                    <span aria-hidden className="gr-lang-opt-flag">{LANGUAGES[c]?.flag}</span>
                    <span data-ux-role="label">{LANGUAGES[c]?.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 게임 그리드 — 04 §5: 폭에 따라 2~4열. 색은 게임과 무관하게 통일하고
              아이콘·라벨로만 구분한다 (관찰4). 카드 자체가 버튼이라 PLAY 는
              장식 표시로만 남긴다 (관찰5). */}
          <div className="gr-grid-wrap">
            <div data-ux-role="secondary" className="gr-grid-heading">
              🎯 {gt(GR.whichGame, viewerLang)}
              <span className="gr-grid-count">
                · {viewerLang === "ko" ? `${GAMES.length}개 준비됨` : `${GAMES.length} ${gt(GR.gamesReady, viewerLang)}`}
              </span>
            </div>
            <div data-lobby-grid className="gr-grid">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  data-lobby-card
                  data-ux-role="control"
                  className="gr-card"
                  onClick={() => setGameId(g.id)}
                >
                  <span aria-hidden className="gr-card-icon">
                    <GameIcon icon={g.icon} iconImg={g.iconImg} size={32} />
                  </span>
                  <span data-ux-role="label" className="gr-card-title">
                    <GameText map={{ ko: g.name }} lang={viewerLang} />
                    {viewerLang !== "ko" && (
                      <span className="gr-card-title-alt">{g.name}</span>
                    )}
                  </span>
                  <span data-ux-role="secondary" className="gr-card-sub">
                    <GameText map={{ ko: g.sub }} lang={viewerLang} />
                  </span>
                  <span aria-hidden className="gr-card-play">▶</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Game shell header */}
          <div style={{
            padding: "16px 14px 12px",
            display: "flex", alignItems: "center", gap: 10,
            flexShrink: 0, borderBottom: `2px solid ${ActiveGame.color}22`,
            background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)",
          }}>
            <button
              onClick={() => { reportGamePlayed(); setGameId(null); }}
              aria-label="게임 목록으로"
              style={{
                width: 44, height: 44, borderRadius: 12, border: `2px solid ${ActiveGame.color}44`,
                background: "#fff", fontSize: 18, fontWeight: 900, color: ActiveGame.color, cursor: "pointer",
              }}
            >←</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1F2937", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 22 }}>{ActiveGame.icon}</span> <GameText map={{ ko: ActiveGame.name }} lang={viewerLang} />
                {viewerLang !== "ko" && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>· {ActiveGame.name}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, fontSize: 12, fontWeight: 700, color: "#6B7280" }}>
                <span>{LANGUAGES[viewerLang]?.flag} {LANGUAGES[viewerLang]?.label}</span>
                <span style={{ color: ActiveGame.color, fontWeight: 900 }}>↔</span>
                <span>{LANGUAGES[friendLang]?.flag} {LANGUAGES[friendLang]?.label}</span>
              </div>
            </div>
            <button
              onClick={() => { reportGamePlayed(); onClose(); }}
              aria-label="게임룸 닫기"
              style={{
                width: 44, height: 44, borderRadius: 12, border: "2px solid #FDE68A",
                background: "#FFFBEB", fontSize: 16, fontWeight: 900, color: "#92400E", cursor: "pointer",
              }}
            >✕</button>
          </div>

          {/* #3 minHeight:0 — flex column 안에서 자식이 넘쳐도 확실히 스크롤되게 함
              (이게 없으면 일부 브라우저에서 콘텐츠가 컨테이너를 밀어내 마블 설정의
               '▶ 시작!' 버튼이 화면 밖으로 나가 클릭 불가해질 수 있음). */}
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: ActiveGame.playBg ?? ActiveGame.bg }}>
            <ActiveGame.cmp langA={viewerLang} langB={friendLang} />
          </div>
        </div>
      )}
    </div>
  );
}

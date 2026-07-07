"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LANGUAGES } from "@/lib/constants";
import { useBackLayer } from "@/lib/backStack";
import { GameText, prefetchGameTexts } from "@/lib/gameI18n";
import { gt, type LangMap } from "./games/uiText";
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

const DEFAULT_LANG_CODES = ["ko","en","vi","zh","fil","ja","th","id"];

export default function GameRoom({ myLang, onClose, onChangeMyLang, roomLangs }: {
  myLang: string;
  onClose: () => void;
  /** "나" 카드에서 내 언어를 바꿀 때 호출 — 상위에서 UserConfig.myLang 갱신(localStorage 저장). */
  onChangeMyLang?: (lang: string) => void;
  roomLangs?: string[];
}) {
  const friendLangCodes = roomLangs && roomLangs.length > 0 ? roomLangs : DEFAULT_LANG_CODES;
  const defaultFriend = friendLangCodes.find((c) => c !== (myLang || "ko")) || "en";
  const [friendLang, setFriendLang] = useState<string>(defaultFriend);
  const [showLangPick, setShowLangPick] = useState<"me" | "friend" | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  const viewerLang = myLang || "ko";
  const ActiveGame = GAMES.find((g) => g.id === gameId);

  // 게임 이름/부제 번역 프리페치 — 뷰어 언어가 사전에 없는 언어여도 목록이 바로 번역돼 보이게.
  useEffect(() => {
    prefetchGameTexts(GAMES.flatMap((g) => [{ ko: g.name }, { ko: g.sub }]), viewerLang);
  }, [viewerLang]);

  // 뒤로 가기: 게임 플레이 중이면 게임 목록으로 (허브로 바로 나가지 않음).
  useBackLayer(gameId !== null, () => setGameId(null));

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
          {/* Header */}
          <div data-tutorial-id="games-header" style={{
            padding: "18px 16px 12px",
            display: "flex", alignItems: "center", gap: 12,
            flexShrink: 0, position: "relative", zIndex: 2,
          }}>
            <button
              onClick={onClose}
              aria-label="닫기"
              style={{
                width: 44, height: 44, borderRadius: 14, border: "2px solid rgba(180,83,9,0.3)",
                background: "rgba(255,255,255,0.9)", fontSize: 18, fontWeight: 900, color: "#92400E", cursor: "pointer",
              }}
            >←</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937", display: "flex", alignItems: "center", gap: 6 }}>
                🎮 {gt(GR.title, viewerLang)}
              </div>
              <div style={{ fontSize: 12, color: "#78350F", fontWeight: 700, marginTop: 2 }}>
                {gt(GR.subtitle, viewerLang)}
              </div>
            </div>
            <img
              src="/mascot/bee-celebrate.png"
              alt=""
              aria-hidden="true"
              style={{ width: 56, height: 56, flexShrink: 0, filter: "drop-shadow(0 4px 12px rgba(245,158,11,0.35))" }}
            />
          </div>

          {/* 언어 쌍 카드 */}
          <div style={{ padding: "4px 16px 0", position: "relative", zIndex: 2 }}>
            <div style={{
              background: "#fff", borderRadius: 24,
              padding: "16px 18px",
              border: "3px solid rgba(180,83,9,0.12)",
              boxShadow: "0 10px 28px rgba(180,83,9,0.15)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#92400E", letterSpacing: 1, marginBottom: 12 }}>
                👫 {gt(GR.friendLangHeader, viewerLang)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* 나 — 누르면 내 언어도 바로 바꿀 수 있다 (게임룸 번역이 안 바뀐다는 혼동 방지) */}
                <button
                  onClick={() => setShowLangPick((v) => (v === "me" ? null : "me"))}
                  style={{
                    flex: 1, padding: "14px 10px", borderRadius: 18,
                    background: showLangPick === "me" ? "linear-gradient(135deg, #FDE68A, #FCD34D)" : "linear-gradient(135deg, #FEF3C7, #FDE68A)",
                    border: `2px solid ${showLangPick === "me" ? "#D97706" : "#FBBF24"}`,
                    textAlign: "center", cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#92400E", letterSpacing: 1 }}>
                    {gt(GR.me, viewerLang)} {showLangPick === "me" ? "▴" : "▾"}
                  </div>
                  <div style={{ fontSize: 36, marginTop: 4 }}>{LANGUAGES[viewerLang]?.flag}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#1F2937", marginTop: 2 }}>
                    {LANGUAGES[viewerLang]?.label}
                  </div>
                </button>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 20 }}>⇄</div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#92400E", whiteSpace: "nowrap" }}>{gt(GR.teachEachOther, viewerLang)}</div>
                </div>
                {/* 친구 */}
                <button
                  onClick={() => setShowLangPick((v) => (v === "friend" ? null : "friend"))}
                  style={{
                    flex: 1, padding: "14px 10px", borderRadius: 18,
                    background: showLangPick === "friend" ? "linear-gradient(135deg, #DBEAFE, #BFDBFE)" : "linear-gradient(135deg, #E0E7FF, #DBEAFE)",
                    border: `2px solid ${showLangPick === "friend" ? "#3B82F6" : "#60A5FA"}`,
                    textAlign: "center", cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#1E40AF", letterSpacing: 1 }}>
                    {gt(GR.friend, viewerLang)} {showLangPick === "friend" ? "▴" : "▾"}
                  </div>
                  <div style={{ fontSize: 36, marginTop: 4 }}>{LANGUAGES[friendLang]?.flag}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#1F2937", marginTop: 2 }}>
                    {LANGUAGES[friendLang]?.label}
                  </div>
                </button>
              </div>

              {showLangPick && (
                <div style={{
                  marginTop: 12, display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
                }}>
                  {(showLangPick === "me" ? Object.keys(LANGUAGES) : availableFriendLangs).map((c) => {
                    const isMe = showLangPick === "me";
                    const active = c === (isMe ? viewerLang : friendLang);
                    const activeBg = isMe ? "#F59E0B" : "#3B82F6";
                    const activeBorder = isMe ? "#B45309" : "#1E40AF";
                    return (
                      <button
                        key={c}
                        onClick={() => {
                          if (isMe) onChangeMyLang?.(c);
                          else setFriendLang(c);
                          setShowLangPick(null);
                        }}
                        style={{
                          padding: "10px 4px", borderRadius: 12,
                          background: active ? activeBg : "#F3F4F6",
                          border: active ? `2px solid ${activeBorder}` : "2px solid transparent",
                          color: active ? "#fff" : "#1F2937",
                          fontSize: 11, fontWeight: 800, cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{LANGUAGES[c]?.flag}</span>
                        <span style={{ fontSize: 10 }}>{LANGUAGES[c]?.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 게임 그리드 */}
          <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 28px", position: "relative", zIndex: 2 }}>
            <div style={{
              fontSize: 14, fontWeight: 900, color: "#78350F", marginBottom: 10,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              🎯 {gt(GR.whichGame, viewerLang)}
              <span style={{ color: "#92400E", fontSize: 12, fontWeight: 700 }}>
                · {viewerLang === "ko" ? `${GAMES.length}개 준비됨` : `${GAMES.length} ${gt(GR.gamesReady, viewerLang)}`}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGameId(g.id)}
                  style={{
                    minHeight: 136, borderRadius: 22,
                    background: g.bg,
                    border: `2px solid ${g.color}55`,
                    cursor: "pointer",
                    padding: "14px 12px", textAlign: "left",
                    display: "flex", flexDirection: "column", gap: 4,
                    position: "relative",
                    boxShadow: `0 6px 16px ${g.color}33`,
                    transition: "transform 0.12s",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <GameIcon icon={g.icon} iconImg={g.iconImg} size={42} />
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#1F2937", marginTop: 6 }}>
                    <GameText map={{ ko: g.name }} lang={viewerLang} />
                    {viewerLang !== "ko" && (
                      <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280" }}>{g.name}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: g.color, fontWeight: 800 }}>
                    <GameText map={{ ko: g.sub }} lang={viewerLang} />
                  </div>
                  <div style={{
                    position: "absolute", top: 10, right: 10,
                    fontSize: 14, fontWeight: 900, color: "#fff",
                    background: g.color, padding: "6px 14px", borderRadius: 999,
                    letterSpacing: 0.5, boxShadow: `0 3px 8px ${g.color}66`,
                  }}>PLAY ▶</div>
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
              onClick={() => setGameId(null)}
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
              onClick={onClose}
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

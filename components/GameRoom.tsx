"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";
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

type GameMeta = {
  id: string;
  icon: string;
  name: string;
  sub: string;
  color: string;
  bg: string;
  cmp: React.ComponentType<{ langA: string; langB: string }>;
};

const GAMES: GameMeta[] = [
  { id: "country",   icon: "🌏", name: "이 나라는 어디?",   sub: "국기 맞추기",       color: "#F59E0B", bg: "#FEF3C7", cmp: CountryGuess },
  { id: "emotion",   icon: "💗", name: "이 마음은?",         sub: "감정 알아채기",     color: "#FB7185", bg: "#FFE4E6", cmp: EmotionQuiz },
  { id: "memory",    icon: "🎴", name: "기억 카드",          sub: "짝 맞추기",         color: "#A78BFA", bg: "#EDE9FE", cmp: WordMemory },
  { id: "greeting",  icon: "👋", name: "인사말 배우기",      sub: "들은 인사 찾기",    color: "#10B981", bg: "#D1FAE5", cmp: GreetingRelay },
  { id: "market",    icon: "🍜", name: "시장 역할극",        sub: "대화 연습",         color: "#EF4444", bg: "#FEE2E2", cmp: MarketRolePlay },
  { id: "draw",      icon: "🎨", name: "그림 맞히기",        sub: "꿀벌 낙서",         color: "#3B82F6", bg: "#DBEAFE", cmp: DrawGuess },
  { id: "spot",      icon: "🔍", name: "틀린 그림 찾기",     sub: "다른 곳 찾기",      color: "#6366F1", bg: "#E0E7FF", cmp: SpotDifference },
  { id: "puzzle",    icon: "🧩", name: "문화 퍼즐",          sub: "조각 맞추기",       color: "#F472B6", bg: "#FCE7F3", cmp: CulturePuzzle },
  { id: "number",    icon: "🔢", name: "숫자 빨리 누르기",   sub: "듣고 터치",         color: "#FACC15", bg: "#FEF9C3", cmp: NumberTap },
  { id: "tower",     icon: "🏗️", name: "단어 탑 쌓기",       sub: "번역 맞히기",       color: "#14B8A6", bg: "#CCFBF1", cmp: WordTower },
  { id: "twentyq",   icon: "🔎", name: "스무고개",           sub: "예/아니오로 맞히기", color: "#8B5CF6", bg: "#EDE9FE", cmp: TwentyQuestions },
];

const FRIEND_LANG_CODES = ["ko","en","vi","zh","fil","ja","th","id"];

export default function GameRoom({ myLang, onClose }: { myLang: string; onClose: () => void }) {
  const defaultFriend = FRIEND_LANG_CODES.find((c) => c !== (myLang || "ko")) || "en";
  const [friendLang, setFriendLang] = useState<string>(defaultFriend);
  const [showLangPick, setShowLangPick] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);

  const viewerLang = myLang || "ko";
  const ActiveGame = GAMES.find((g) => g.id === gameId);

  const availableFriendLangs = FRIEND_LANG_CODES.filter((c) => c !== viewerLang);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 460,
      display: "flex", flexDirection: "column",
      background: "linear-gradient(180deg, #FFFBEB 0%, #FDE68A 60%, #FCD34D 100%)",
      fontFamily: "'Noto Sans KR', sans-serif",
      overflow: "hidden",
    }}>
      {/* Honeycomb pattern background */}
      <div aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 320,
        backgroundImage: "url('/patterns/honeycomb.png')",
        backgroundSize: "260px auto", backgroundRepeat: "repeat",
        opacity: 0.35, pointerEvents: "none",
      }} />

      {!ActiveGame ? (
        <>
          {/* Header */}
          <div style={{
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
                🎮 꿀벌 게임룸
              </div>
              <div style={{ fontSize: 12, color: "#78350F", fontWeight: 700, marginTop: 2 }}>
                친구랑 같이 놀면서 친해져요
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
                👫 함께 놀 친구의 언어
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* 나 */}
                <div style={{
                  flex: 1, padding: "14px 10px", borderRadius: 18,
                  background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
                  border: "2px solid #FBBF24", textAlign: "center",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#92400E", letterSpacing: 1 }}>나</div>
                  <div style={{ fontSize: 36, marginTop: 4 }}>{LANGUAGES[viewerLang]?.flag}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#1F2937", marginTop: 2 }}>
                    {LANGUAGES[viewerLang]?.label}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 20 }}>⇄</div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#92400E", whiteSpace: "nowrap" }}>서로 알려줘</div>
                </div>
                {/* 친구 */}
                <button
                  onClick={() => setShowLangPick((v) => !v)}
                  style={{
                    flex: 1, padding: "14px 10px", borderRadius: 18,
                    background: showLangPick ? "linear-gradient(135deg, #DBEAFE, #BFDBFE)" : "linear-gradient(135deg, #E0E7FF, #DBEAFE)",
                    border: `2px solid ${showLangPick ? "#3B82F6" : "#60A5FA"}`,
                    textAlign: "center", cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#1E40AF", letterSpacing: 1 }}>
                    친구 {showLangPick ? "▴" : "▾"}
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
                  {availableFriendLangs.map((c) => {
                    const active = c === friendLang;
                    return (
                      <button
                        key={c}
                        onClick={() => { setFriendLang(c); setShowLangPick(false); }}
                        style={{
                          padding: "10px 4px", borderRadius: 12,
                          background: active ? "#3B82F6" : "#F3F4F6",
                          border: active ? "2px solid #1E40AF" : "2px solid transparent",
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
              🎯 어떤 놀이를 할까?
              <span style={{ color: "#92400E", fontSize: 12, fontWeight: 700 }}>· {GAMES.length}개 준비됨</span>
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
                  <div style={{ fontSize: 42, lineHeight: 1 }}>{g.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#1F2937", marginTop: 6 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: g.color, fontWeight: 800 }}>{g.sub}</div>
                  <div style={{
                    position: "absolute", top: 10, right: 10,
                    fontSize: 10, fontWeight: 900, color: "#fff",
                    background: g.color, padding: "3px 9px", borderRadius: 999,
                    letterSpacing: 0.5, boxShadow: `0 2px 6px ${g.color}66`,
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
                <span style={{ fontSize: 22 }}>{ActiveGame.icon}</span> {ActiveGame.name}
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

          <div style={{ flex: 1, overflow: "auto", background: ActiveGame.bg }}>
            <ActiveGame.cmp langA={viewerLang} langB={friendLang} />
          </div>
        </div>
      )}
    </div>
  );
}

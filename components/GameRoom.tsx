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

const GAMES = [
  { id: "country",   title: "나라 맞히기",        emoji: "🌏", desc: "국기 보고 나라 맞히기",        cmp: CountryGuess },
  { id: "memory",    title: "같은 뜻 짝 맞추기",  emoji: "🃏", desc: "두 언어 카드 짝 찾기",          cmp: WordMemory },
  { id: "spot",      title: "틀린 그림 찾기",      emoji: "🔍", desc: "두 장면에서 다른 곳 찾기",      cmp: SpotDifference },
  { id: "puzzle",    title: "문화 퍼즐",          emoji: "🧩", desc: "문화 그림 조각 맞추기",         cmp: CulturePuzzle },
  { id: "greeting",  title: "인사말 릴레이",      emoji: "👋", desc: "들은 인사를 찾기",              cmp: GreetingRelay },
  { id: "draw",      title: "그림 맞히기",        emoji: "✏️", desc: "꿀벌이 그린 그림 맞히기",       cmp: DrawGuess },
  { id: "number",    title: "숫자 빨리 누르기",   emoji: "🔢", desc: "들리는 숫자 빨리 터치",         cmp: NumberTap },
  { id: "emotion",   title: "감정 맞히기",        emoji: "😊", desc: "상황에 맞는 이모지 고르기",     cmp: EmotionQuiz },
  { id: "market",    title: "시장 역할극",        emoji: "🍜", desc: "시장 대화 연습",                cmp: MarketRolePlay },
  { id: "tower",     title: "단어 탑 쌓기",        emoji: "🏗️", desc: "번역 맞히며 탑 쌓기",           cmp: WordTower },
] as const;

type GameId = typeof GAMES[number]["id"];

export default function GameRoom({ myLang, onClose }: { myLang: string; onClose: () => void }) {
  const [langA, setLangA] = useState<string>(myLang || "ko");
  const [langB, setLangB] = useState<string>(myLang === "en" ? "ko" : "en");
  const [step, setStep] = useState<"pick-lang" | "pick-game" | "play">("pick-lang");
  const [gameId, setGameId] = useState<GameId | null>(null);

  const codes = Object.keys(LANGUAGES);
  const Game = GAMES.find((g) => g.id === gameId)?.cmp;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 460,
      background: "#0F0C28",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Sticky header */}
      <div style={{
        flexShrink: 0,
        background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
        color: "#fff", boxShadow: "0 4px 18px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BeeMascot size={34} flying={false} />
          <div style={{ fontWeight: 900, fontSize: 16 }}>🎮 소통의 방</div>
        </div>
        {step === "play" && gameId && (
          <button
            onClick={() => { setGameId(null); setStep("pick-game"); }}
            style={headerBtn}
          >← 게임 목록</button>
        )}
        {step === "pick-game" && (
          <button
            onClick={() => setStep("pick-lang")}
            style={headerBtn}
          >← 언어 바꾸기</button>
        )}
        <button
          onClick={onClose}
          style={{ ...headerBtn, marginLeft: "auto" }}
        >✕ 닫기</button>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        background: "linear-gradient(180deg,#FFF9E8,#E8F5FF)",
      }}>
        {step === "pick-lang" && (
          <div style={{ padding: "32px 20px 60px", maxWidth: 720, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <BeeMascot size={90} mood="wave" />
              <h2 style={{ margin: "10px 0 4px", fontSize: 22, fontWeight: 900, color: "#111827" }}>
                두 가지 언어를 골라주세요
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
                고른 두 언어로 게임이 진행돼요
              </p>
            </div>

            <LangPicker label="🅰️ 언어 1" value={langA} onChange={setLangA} exclude={langB} codes={codes} />
            <LangPicker label="🅱️ 언어 2" value={langB} onChange={setLangB} exclude={langA} codes={codes} />

            <button
              onClick={() => setStep("pick-game")}
              disabled={langA === langB}
              style={{
                marginTop: 20, width: "100%",
                background: langA === langB ? "#E5E7EB" : "linear-gradient(135deg,#FBBF24,#F59E0B)",
                color: langA === langB ? "#9CA3AF" : "#fff",
                border: "none", padding: 16, borderRadius: 16,
                fontSize: 16, fontWeight: 900,
                cursor: langA === langB ? "not-allowed" : "pointer",
                boxShadow: langA === langB ? "none" : "0 8px 22px rgba(245,158,11,0.4)",
              }}
            >🎯 게임 고르러 가기</button>
          </div>
        )}

        {step === "pick-game" && (
          <div style={{ padding: "24px 16px 60px", maxWidth: 960, margin: "0 auto" }}>
            <div style={{
              background: "#fff", borderRadius: 14, padding: "10px 14px",
              marginBottom: 18, display: "flex", alignItems: "center", gap: 8,
              fontSize: 13, color: "#6B7280", fontWeight: 700,
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}>
              <span>{LANGUAGES[langA]?.flag} {LANGUAGES[langA]?.label}</span>
              <span>↔</span>
              <span>{LANGUAGES[langB]?.flag} {LANGUAGES[langB]?.label}</span>
            </div>

            <div style={{
              display: "grid", gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            }}>
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { setGameId(g.id); setStep("play"); }}
                  style={{
                    background: "#fff", border: "2px solid #E5E7EB", borderRadius: 16,
                    padding: "18px 10px", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    transition: "all 0.15s", textAlign: "center",
                  }}
                  onMouseEnter={(e) => {
                    const b = e.currentTarget;
                    b.style.borderColor = "#F59E0B";
                    b.style.transform = "translateY(-2px)";
                    b.style.boxShadow = "0 8px 20px rgba(245,158,11,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    const b = e.currentTarget;
                    b.style.borderColor = "#E5E7EB";
                    b.style.transform = "translateY(0)";
                    b.style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontSize: 38 }}>{g.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{g.title}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{g.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "play" && Game && (
          <Game langA={langA} langB={langB} />
        )}
      </div>
    </div>
  );
}

function LangPicker({
  label, value, onChange, exclude, codes,
}: {
  label: string; value: string; onChange: (v: string) => void;
  exclude: string; codes: string[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {codes.map((c) => {
          const active = c === value;
          const disabled = c === exclude;
          return (
            <button
              key={c}
              onClick={() => !disabled && onChange(c)}
              disabled={disabled}
              style={{
                padding: "6px 10px", borderRadius: 99,
                border: `2px solid ${active ? "#F59E0B" : "#E5E7EB"}`,
                background: active ? "#FEF3C7" : disabled ? "#F3F4F6" : "#fff",
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: 12, fontWeight: 700,
                color: disabled ? "#D1D5DB" : "#111827",
                opacity: disabled ? 0.5 : 1,
              }}
            >{LANGUAGES[c]?.flag} {LANGUAGES[c]?.label}</button>
          );
        })}
      </div>
    </div>
  );
}

const headerBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)",
  color: "#fff", padding: "6px 12px", borderRadius: 10,
  fontSize: 12, fontWeight: 700, cursor: "pointer",
};

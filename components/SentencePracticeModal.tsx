"use client";

import { useState, useMemo, useEffect } from "react";
import { CardData, UserConfig } from "@/lib/types";
import {
  getKoreanText, getNativeText,
  PracticeMap, recordPractice, subscribePractice,
  practiceProgress, isCardFullyPracticed,
} from "@/lib/sentencePractice";
import { speakKorean } from "@/lib/ttsKorean";
import { LANGUAGES } from "@/lib/constants";
import ListenPanel from "./practice/ListenPanel";
import WritePanel from "./practice/WritePanel";
import VocabRecorder from "./VocabRecorder";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";

interface Props {
  user: UserConfig;
  roomCode: string;
  cards: CardData[];
  onClose: () => void;
}

type DetailTab = "listen" | "speak" | "write";

export default function SentencePracticeModal({ user, roomCode, cards, onClose }: Props) {
  const lang = user.myLang;
  const [openCard, setOpenCard] = useState<CardData | null>(null);
  const [tab, setTab] = useState<DetailTab>("listen");
  const [rate, setRate] = useState(1);
  const [practice, setPractice] = useState<PracticeMap>({});

  // Firebase 연습 이력 구독
  useEffect(() => {
    const unsub = subscribePractice(roomCode, user.myName, setPractice);
    return () => unsub();
  }, [roomCode, user.myName]);

  // 연습 가능한 카드만 추림 (한국어 문장이 있는 것)
  const eligible = useMemo(() => {
    return cards
      .map((c) => {
        const ko = getKoreanText(c);
        const native = getNativeText(c, lang);
        return ko ? { card: c, ko, native } : null;
      })
      .filter((x): x is { card: CardData; ko: string; native: string | null } => !!x);
  }, [cards, lang]);

  function markMode(cardId: string, mode: "listened" | "spoken" | "written") {
    const prev = practice[cardId];
    recordPractice(roomCode, user.myName, cardId, { [mode]: true }, prev);
  }

  // 상세 뷰
  if (openCard) {
    const ko = getKoreanText(openCard) ?? "";
    const native = getNativeText(openCard, lang);
    const rec = practice[openCard.id];
    const listened = !!rec?.listened;
    const spoken = !!rec?.spoken;
    const written = !!rec?.written;

    return (
      <Shell onClose={onClose} wide>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: 8, borderBottom: "2px solid " + PURPLE_LIGHT,
        }}>
          <button
            onClick={() => setOpenCard(null)}
            style={{
              background: PURPLE_LIGHT, border: "none", borderRadius: 10,
              padding: "6px 12px", fontSize: 13, fontWeight: 800, color: PURPLE_DARK,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >← 목록</button>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#6B7280" }}>
            📖 문장 연습
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 34, height: 34, borderRadius: 10, border: "none",
              background: "transparent", fontSize: 18, fontWeight: 900, color: "#6B7280",
              cursor: "pointer",
            }}
          >✕</button>
        </div>

        {/* Author chip */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          margin: "14px 0 10px", fontSize: 12, fontWeight: 700, color: "#6B7280",
        }}>
          <span>{LANGUAGES[openCard.authorLang]?.flag ?? "🌐"}</span>
          <span>{openCard.authorName}</span>
          {openCard.isTeacher && <span style={{
            background: "#ECFDF5", color: "#065F46",
            padding: "2px 8px", borderRadius: 999, fontWeight: 900,
          }}>선생님</span>}
        </div>

        {/* Korean target sentence */}
        <div style={{
          background: "linear-gradient(135deg, #fff, " + PURPLE_LIGHT + ")",
          border: "3px solid " + PURPLE_DARK,
          borderRadius: 18, padding: "18px 16px",
          textAlign: "center", marginBottom: 10,
          fontSize: 22, fontWeight: 900, color: "#1F2937",
          letterSpacing: -0.3, lineHeight: 1.5,
          boxShadow: "0 6px 16px rgba(109, 40, 217, 0.15)",
        }}>
          {ko}
        </div>

        {/* Native translation (if not korean) */}
        {native && (
          <div style={{
            background: "#F9FAFB",
            borderLeft: "4px solid " + PURPLE,
            padding: "10px 14px", borderRadius: "0 10px 10px 0",
            fontSize: 14, fontWeight: 700, color: "#374151",
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: PURPLE_DARK, letterSpacing: 1, marginBottom: 2 }}>
              {LANGUAGES[lang]?.flag} {LANGUAGES[lang]?.label ?? lang}
            </div>
            {native}
          </div>
        )}

        {/* Mode tabs */}
        <div style={{
          display: "flex", gap: 4, background: "#F3F4F6", padding: 4,
          borderRadius: 12, marginBottom: 14,
        }}>
          {([
            { k: "listen" as DetailTab, icon: "👂", label: "듣기", done: listened },
            { k: "speak" as DetailTab, icon: "🎤", label: "말하기", done: spoken },
            { k: "write" as DetailTab, icon: "✏️", label: "쓰기", done: written },
          ]).map((m) => (
            <button
              key={m.k}
              onClick={() => setTab(m.k)}
              style={{
                flex: 1,
                background: tab === m.k
                  ? "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")"
                  : "transparent",
                color: tab === m.k ? "#fff" : "#374151",
                border: "none", borderRadius: 10,
                padding: "10px 6px", fontSize: 13, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                position: "relative",
              }}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
              {m.done && (
                <span style={{
                  position: "absolute", top: 4, right: 6,
                  fontSize: 10, color: tab === m.k ? "#fff" : "#10B981",
                }}>✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Mode content */}
        {tab === "listen" && (
          <ListenPanel
            rate={rate}
            setRate={setRate}
            onPlay={() => speakKorean(ko, rate)}
            onDone={() => markMode(openCard.id, "listened")}
            isDone={listened}
            lang={lang}
          />
        )}

        {tab === "speak" && (
          <VocabRecorder
            sentenceText={ko}
            onOriginalPlay={() => speakKorean(ko, rate)}
            onComplete={() => markMode(openCard.id, "spoken")}
            roomCode={roomCode}
            clientId={user.myName}
            wordId={`card_${openCard.id}`}      // 카드 연습 녹음 (단어 녹음과 구분)
            sentenceIdx={0}
          />
        )}

        {tab === "write" && (
          <WritePanel
            sentenceText={ko}
            onDone={() => markMode(openCard.id, "written")}
            isDone={written}
            lang={lang}
          />
        )}
      </Shell>
    );
  }

  // 리스트 뷰
  return (
    <Shell onClose={onClose} wide>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: 10, borderBottom: "2px solid " + PURPLE_LIGHT,
        marginBottom: 14,
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#1F2937" }}>
          📖 오늘의 문장 연습
        </div>
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            width: 34, height: 34, borderRadius: 10, border: "none",
            background: "transparent", fontSize: 18, fontWeight: 900, color: "#6B7280",
            cursor: "pointer",
          }}
        >✕</button>
      </div>

      {eligible.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "40px 20px",
          color: "#6B7280", fontSize: 14, fontWeight: 700,
        }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>📭</div>
          오늘 소통창에 올린 글이 아직 없어요.<br/>
          친구들이 글을 쓰면 여기서 연습할 수 있어요!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {eligible.map(({ card, ko, native }) => {
            const rec = practice[card.id];
            const done = isCardFullyPracticed(rec);
            const progress = practiceProgress(rec);
            return (
              <div
                key={card.id}
                style={{
                  background: done
                    ? "linear-gradient(145deg, #ECFDF5, #D1FAE5)"
                    : "#fff",
                  border: done
                    ? "2.5px solid #10B981"
                    : progress > 0
                    ? "2.5px solid " + PURPLE
                    : "2px solid #E5E7EB",
                  borderRadius: 16,
                  padding: "14px 16px",
                  boxShadow: done
                    ? "0 6px 16px rgba(16, 185, 129, 0.2)"
                    : progress > 0
                    ? "0 4px 10px rgba(139, 92, 246, 0.15)"
                    : "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                {/* author + progress */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 8,
                }}>
                  <span>
                    {LANGUAGES[card.authorLang]?.flag ?? "🌐"} {card.authorName}
                    {card.isTeacher && " 🎓"}
                  </span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: i < progress ? (done ? "#10B981" : PURPLE) : "#E5E7EB",
                      }} />
                    ))}
                  </div>
                </div>

                {/* Korean — tappable */}
                <button
                  onClick={() => { setOpenCard(card); setTab("listen"); }}
                  style={{
                    width: "100%", textAlign: "left",
                    background: "transparent", border: "none",
                    cursor: "pointer", padding: 0, fontFamily: "inherit",
                  }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 0",
                  }}>
                    <span style={{
                      fontSize: 18, color: PURPLE,
                      flexShrink: 0,
                    }}>🔊</span>
                    <span style={{
                      flex: 1, fontSize: 17, fontWeight: 800, color: "#1F2937",
                      lineHeight: 1.4,
                    }}>{ko}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 900, color: PURPLE_DARK,
                      background: PURPLE_LIGHT, padding: "4px 10px", borderRadius: 999,
                      flexShrink: 0,
                    }}>연습 →</span>
                  </div>
                </button>

                {/* Native (only for non-Korean students) */}
                {native && (
                  <div style={{
                    marginTop: 6, padding: "8px 12px",
                    background: PURPLE_LIGHT,
                    borderRadius: 10,
                    fontSize: 13, fontWeight: 700, color: PURPLE_DARK,
                    lineHeight: 1.4,
                  }}>
                    {LANGUAGES[lang]?.flag} {native}
                  </div>
                )}

                {done && (
                  <div style={{
                    marginTop: 8, fontSize: 11, fontWeight: 900, color: "#059669",
                    letterSpacing: 0.5,
                  }}>🏆 연습 완료!</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

function Shell({
  children, onClose, wide,
}: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15, 10, 40, 0.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "'Noto Sans KR', sans-serif",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: wide ? 640 : 560,
          background: "#fff", borderRadius: "24px 24px 0 0",
          padding: "14px 18px 22px",
          boxShadow: "0 -16px 48px rgba(0,0,0,0.3)",
          maxHeight: "96vh", overflow: "auto",
          animation: "slideUp 0.25s ease",
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(60px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}

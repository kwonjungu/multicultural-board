"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ref, onValue } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { VOCAB_WORDS, VocabWord } from "@/lib/vocabWords";
import {
  loadProgress, saveProgress, markSentenceDone, bumpListen,
  wordDoneCount, masteredCount, ProgressMap,
} from "@/lib/vocabProgress";
import { extractVocabLocal, MatchedWord, wordById } from "@/lib/vocabUtils";
import { UserConfig, CardData } from "@/lib/types";
import { t, tFmt } from "@/lib/i18n";
import VocabCard from "./VocabCard";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";

const SUBCATEGORIES: string[] = [
  "감정", "지칭어", "의사표현", "학교생활", "일상동사", "일상형용사", "인사",
];

const SUB_ICON: Record<string, string> = {
  "감정": "😊",
  "지칭어": "👉",
  "의사표현": "💬",
  "학교생활": "🏫",
  "일상동사": "🏃",
  "일상형용사": "📏",
  "인사": "👋",
};

interface Props {
  user: UserConfig;
  roomCode: string;
  onBack: () => void;
}

export default function VocabHub({ user, roomCode, onBack }: Props) {
  const lang = user.myLang;
  const [progress, setProgress] = useState<ProgressMap>({});
  const [activeSub, setActiveSub] = useState<string | "all">("all");
  const [openWord, setOpenWord] = useState<VocabWord | null>(null);

  // 소통창 카드 텍스트 수집
  const [cardTexts, setCardTexts] = useState<string[]>([]);
  const [matched, setMatched] = useState<MatchedWord[]>([]);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "error">("idle");
  const scanOnce = useRef(false);

  useEffect(() => {
    setProgress(loadProgress(roomCode, user.myName));
  }, [roomCode, user.myName]);

  // 카드 구독 — originalText + translations.ko 수집
  useEffect(() => {
    const db = getClientDb();
    const cardsRef = ref(db, `rooms/${roomCode}/cards`);
    const unsub = onValue(cardsRef, (snap) => {
      const val = snap.val();
      if (!val || typeof val !== "object") { setCardTexts([]); return; }
      const texts: string[] = [];
      for (const card of Object.values(val as Record<string, CardData>)) {
        if (!card) continue;
        if (typeof card.originalText === "string" && card.originalText.trim()) {
          texts.push(card.originalText);
        }
        const koTrans = card.translations?.ko;
        if (typeof koTrans === "string" && koTrans.trim()) texts.push(koTrans);
      }
      setCardTexts(texts);
    });
    return () => unsub();
  }, [roomCode]);

  // 카드가 처음 들어왔을 때 1회 자동 스캔
  useEffect(() => {
    if (scanOnce.current) return;
    if (cardTexts.length === 0) return;
    scanOnce.current = true;
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardTexts]);

  async function runScan() {
    if (cardTexts.length === 0) { setMatched([]); return; }
    setScanState("scanning");
    try {
      const res = await fetch("/api/vocab-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardTexts, limit: 12 }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { matched: MatchedWord[] };
      setMatched(json.matched ?? []);
      setScanState("idle");
    } catch {
      // 폴백 — 서버 장애 시 로컬
      setMatched(extractVocabLocal(cardTexts, 12));
      setScanState("error");
    }
  }

  function persist(next: ProgressMap) {
    setProgress(next);
    saveProgress(roomCode, user.myName, next);
  }

  const filteredWords = useMemo(() => {
    if (activeSub === "all") return VOCAB_WORDS;
    return VOCAB_WORDS.filter((w) => w.subcategory === activeSub);
  }, [activeSub]);

  const masteredTotal = masteredCount(progress);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #FAF5FF 0%, #EDE9FE 50%, #DDD6FE 100%)",
      fontFamily: "'Noto Sans KR', sans-serif",
      padding: "16px 14px 40px",
      position: "relative",
    }}>
      {/* Header */}
      <div style={{
        maxWidth: 760, margin: "0 auto",
        display: "flex", alignItems: "center", gap: 12,
        background: "#fff", borderRadius: 20, padding: "12px 16px",
        border: "2px solid " + PURPLE + "33",
        boxShadow: "0 8px 24px rgba(109, 40, 217, 0.12)",
        marginBottom: 18,
      }}>
        <button
          onClick={onBack}
          aria-label="뒤로"
          style={{
            background: PURPLE_LIGHT, border: "none", borderRadius: 10,
            padding: "8px 12px", fontSize: 14, fontWeight: 800, color: PURPLE_DARK,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >{t("vocabBack", lang)}</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
            📚 {t("hubSectionVocab", lang)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: PURPLE_DARK, marginTop: 2 }}>
            {tFmt("vocabProgress", lang, { done: masteredTotal, total: VOCAB_WORDS.length })}
          </div>
        </div>

        <div style={{
          background: "linear-gradient(135deg, #FDE68A, #F59E0B)",
          color: "#78350F", fontSize: 14, fontWeight: 900,
          padding: "8px 14px", borderRadius: 14,
          boxShadow: "0 4px 10px rgba(245,158,11,0.35)",
        }}>
          🏆 {masteredTotal}
        </div>
      </div>

      {/* Board-matched words */}
      <div style={{ maxWidth: 760, margin: "0 auto 14px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8, padding: "0 2px",
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: PURPLE_DARK }}>
            {t("vocabFromBoard", lang)}
          </div>
          <button
            onClick={runScan}
            disabled={scanState === "scanning" || cardTexts.length === 0}
            style={{
              background: "transparent", border: "1.5px solid " + PURPLE + "66",
              borderRadius: 999, padding: "4px 10px",
              fontSize: 11, fontWeight: 800, color: PURPLE_DARK,
              cursor: scanState === "scanning" ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: cardTexts.length === 0 ? 0.5 : 1,
            }}
          >{scanState === "scanning" ? t("vocabScanning", lang) : t("vocabRefresh", lang)}</button>
        </div>
        {matched.length === 0 ? (
          <div style={{
            background: "#fff", border: "2px dashed " + PURPLE + "44",
            borderRadius: 14, padding: "14px",
            fontSize: 13, color: "#6B7280", fontWeight: 700, textAlign: "center",
          }}>
            {t("vocabFromBoardNone", lang)}
          </div>
        ) : (
          <div style={{
            display: "flex", gap: 10, overflowX: "auto",
            paddingBottom: 6, WebkitOverflowScrolling: "touch",
          }}>
            {matched.map((m) => {
              const w = wordById(m.wordId);
              if (!w) return null;
              const done = wordDoneCount(progress, w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => setOpenWord(w)}
                  style={{
                    flexShrink: 0, width: 108,
                    background: "linear-gradient(145deg, #fff, " + PURPLE_LIGHT + ")",
                    border: "2.5px solid " + PURPLE,
                    borderRadius: 16, padding: "10px 6px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 6px 14px rgba(139, 92, 246, 0.2)",
                  }}
                >
                  <img
                    src={`/vocab-images/icons/${w.id}.png`}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: 56, height: 56, objectFit: "contain",
                      background: "rgba(255,255,255,0.7)", borderRadius: 12, padding: 3,
                    }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#1F2937" }}>{w.ko}</div>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: PURPLE_DARK,
                    letterSpacing: 1,
                  }}>
                    {"★".repeat(Math.max(1, Math.min(5, m.score)))}
                    <span style={{ color: "#E5E7EB" }}>{"★".repeat(5 - Math.max(1, Math.min(5, m.score)))}</span>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: i < done ? PURPLE : "#D1D5DB",
                      }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Subcategory tabs */}
      <div style={{
        maxWidth: 760, margin: "0 auto 16px",
        display: "flex", gap: 6, overflowX: "auto",
        paddingBottom: 4, WebkitOverflowScrolling: "touch",
      }}>
        <CatChip
          active={activeSub === "all"}
          onClick={() => setActiveSub("all")}
          icon="✨"
          label={t("vocabAll", lang)}
          count={VOCAB_WORDS.length}
        />
        {SUBCATEGORIES.map((sub) => {
          const count = VOCAB_WORDS.filter((w) => w.subcategory === sub).length;
          return (
            <CatChip
              key={sub}
              active={activeSub === sub}
              onClick={() => setActiveSub(sub)}
              icon={SUB_ICON[sub] ?? "🏷️"}
              label={t("vocabSub_" + sub, lang)}
              count={count}
            />
          );
        })}
      </div>

      {/* Word grid */}
      <div style={{
        maxWidth: 760, margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        gap: 10,
      }}>
        {filteredWords.map((word) => {
          const done = wordDoneCount(progress, word.id);
          const mastered = done >= 3;
          return (
            <button
              key={word.id}
              onClick={() => setOpenWord(word)}
              aria-label={word.ko}
              style={{
                position: "relative",
                background: mastered
                  ? "linear-gradient(145deg, #FEF3C7, #FDE68A)"
                  : "#fff",
                border: mastered
                  ? "2.5px solid #F59E0B"
                  : done > 0
                  ? "2.5px solid " + PURPLE
                  : "2px solid #E5E7EB",
                borderRadius: 18,
                padding: "10px 8px 10px",
                cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                fontFamily: "inherit",
                boxShadow: mastered
                  ? "0 8px 20px rgba(245, 158, 11, 0.25)"
                  : done > 0
                  ? "0 6px 14px rgba(139, 92, 246, 0.2)"
                  : "0 2px 6px rgba(0,0,0,0.04)",
                transition: "transform 0.15s, box-shadow 0.15s",
                minHeight: 130,
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{
                width: 70, height: 70, borderRadius: 16,
                background: mastered ? "rgba(255,255,255,0.7)" : PURPLE_LIGHT,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                padding: 4,
              }}>
                <img
                  src={`/vocab-images/icons/${word.id}.png`}
                  alt=""
                  aria-hidden="true"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div style={{
                fontSize: 14, fontWeight: 900, color: "#1F2937", letterSpacing: -0.2,
                textAlign: "center", lineHeight: 1.1,
              }}>{word.ko}</div>

              {/* 3-dot progress */}
              <div style={{ display: "flex", gap: 3 }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: i < done ? (mastered ? "#F59E0B" : PURPLE) : "#D1D5DB",
                    }}
                  />
                ))}
              </div>

              {mastered && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  fontSize: 14,
                }}>🏆</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Study modal */}
      {openWord && (
        <VocabCard
          word={openWord}
          lang={lang}
          doneSentences={progress[openWord.id]?.doneSentences ?? []}
          onSentenceDone={(idx) => persist(markSentenceDone(progress, openWord.id, idx))}
          onListenBump={() => persist(bumpListen(progress, openWord.id))}
          onClose={() => setOpenWord(null)}
        />
      )}
    </div>
  );
}

function CatChip({
  active, onClick, icon, label, count,
}: { active: boolean; onClick: () => void; icon: string; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        background: active
          ? "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")"
          : "#fff",
        color: active ? "#fff" : "#374151",
        border: active ? "none" : "2px solid #E5E7EB",
        borderRadius: 999,
        padding: "8px 14px",
        fontSize: 13, fontWeight: 800,
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 6,
        boxShadow: active ? "0 6px 14px rgba(139, 92, 246, 0.35)" : "none",
        whiteSpace: "nowrap",
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span style={{
        background: active ? "rgba(255,255,255,0.25)" : "#F3F4F6",
        color: active ? "#fff" : "#6B7280",
        borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 900,
      }}>{count}</span>
    </button>
  );
}

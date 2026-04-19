"use client";

import { useMemo, useState } from "react";
import {
  TWENTYQ_ITEMS,
  HINT_CARDS,
  TwentyQCategory,
  TwentyQItem,
  HintCard,
  HintGroup,
  pickN,
  tr,
} from "@/lib/gameData";
import BeeMascot from "../BeeMascot";
import { ProgressBar } from "./CountryGuess";

type Phase = "category" | "setup" | "play" | "asking" | "guess" | "result";

const CATEGORY_META: Record<TwentyQCategory, { emoji: string; labelKo: string; labelEn: string; color: string; bg: string }> = {
  country: { emoji: "🌏", labelKo: "나라",   labelEn: "country", color: "#F59E0B", bg: "#FEF3C7" },
  food:    { emoji: "🍜", labelKo: "음식",   labelEn: "food",    color: "#EF4444", bg: "#FEE2E2" },
  person:  { emoji: "👤", labelKo: "직업",   labelEn: "job",     color: "#8B5CF6", bg: "#EDE9FE" },
};

const GROUP_LABEL: Record<HintGroup, { ko: string; en: string; emoji: string }> = {
  region: { ko: "지역",  en: "Region",  emoji: "🗺️" },
  taste:  { ko: "맛/감각", en: "Taste",   emoji: "👅" },
  use:    { ko: "쓰임",  en: "Use",     emoji: "🛠️" },
  form:   { ko: "생김새", en: "Form",    emoji: "🔍" },
  misc:   { ko: "기타",  en: "Other",   emoji: "✨" },
};

export default function TwentyQuestions({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<Phase>("category");
  const [category, setCategory] = useState<TwentyQCategory | null>(null);
  const [secret, setSecret] = useState<TwentyQItem | null>(null);
  const [remaining, setRemaining] = useState(20);
  const [usedFlags, setUsedFlags] = useState<Set<string>>(new Set());
  const [log, setLog] = useState<{ cardEmoji: string; labelA: string; yes: boolean }[]>([]);
  const [pendingCard, setPendingCard] = useState<HintCard | null>(null);
  const [guessChoices, setGuessChoices] = useState<TwentyQItem[]>([]);
  const [finalPick, setFinalPick] = useState<TwentyQItem | null>(null);
  const [sessionKey, setSessionKey] = useState(0); // bump to reshuffle

  const setupCandidates = useMemo<TwentyQItem[]>(() => {
    if (!category) return [];
    const pool = TWENTYQ_ITEMS.filter((i) => i.category === category);
    return pickN(pool, Math.min(8, pool.length));
  }, [category, sessionKey]);

  function chooseCategory(cat: TwentyQCategory) {
    setCategory(cat);
    setPhase("setup");
  }

  function pickSecret(item: TwentyQItem) {
    setSecret(item);
    setRemaining(20);
    setUsedFlags(new Set());
    setLog([]);
    setPhase("play");
  }

  function tapCard(card: HintCard) {
    if (remaining <= 0) return;
    if (usedFlags.has(card.flag as string)) return;
    setPendingCard(card);
    setPhase("asking");
  }

  function answerCard(yes: boolean) {
    if (!pendingCard) return;
    const labelA = tr(pendingCard.label, langA);
    setLog((l) => [{ cardEmoji: pendingCard.emoji, labelA, yes }, ...l].slice(0, 3));
    setUsedFlags((s) => new Set(s).add(pendingCard.flag as string));
    setRemaining((r) => r - 1);
    setPendingCard(null);
    setPhase("play");
  }

  function startGuess() {
    if (!category || !secret) return;
    const pool = TWENTYQ_ITEMS.filter((i) => i.category === category && i.id !== secret.id);
    const others = pickN(pool, Math.min(7, pool.length));
    const mix = [...others, secret].sort(() => Math.random() - 0.5);
    setGuessChoices(mix);
    setPhase("guess");
  }

  function submitGuess(item: TwentyQItem) {
    setFinalPick(item);
    setPhase("result");
  }

  function resetAll() {
    setPhase("category");
    setCategory(null);
    setSecret(null);
    setRemaining(20);
    setUsedFlags(new Set());
    setLog([]);
    setPendingCard(null);
    setGuessChoices([]);
    setFinalPick(null);
    setSessionKey((k) => k + 1);
  }

  // ---- render ----
  if (phase === "category") {
    return (
      <div style={wrapStyle}>
        <h2 style={titleStyle}>🔎 스무고개</h2>
        <p style={subtitleStyle}>카테고리를 먼저 고르세요</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 16 }}>
          {(Object.keys(CATEGORY_META) as TwentyQCategory[]).map((cat) => {
            const m = CATEGORY_META[cat];
            return (
              <button
                key={cat}
                onClick={() => chooseCategory(cat)}
                aria-label={m.labelKo}
                style={{
                  padding: "20px 18px", borderRadius: 20, fontSize: 22, fontWeight: 900,
                  color: "#1F2937", background: m.bg, border: `3px solid ${m.color}`,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.06)", transition: "transform 0.12s",
                }}
                onMouseDown={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")}
                onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
              >
                <span style={{ fontSize: 36 }}>{m.emoji}</span>
                <span>{m.labelKo}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div style={wrapStyle}>
        <SetupPanel
          candidates={setupCandidates}
          category={category!}
          langB={langB}
          onPick={pickSecret}
          onBack={resetAll}
        />
      </div>
    );
  }

  if (phase === "play" || phase === "asking") {
    return (
      <>
        <div style={wrapStyle}>
          <PlayHeader category={category!} remaining={remaining} />
          <HintGrid
            usedFlags={usedFlags}
            onTap={tapCard}
            langA={langA}
          />

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={startGuess}
              style={primaryBtn}
            >🎯 정답 말하기</button>
            <button
              onClick={resetAll}
              style={secondaryBtn}
            >↩ 처음으로</button>
          </div>

          {log.length > 0 && (
            <div style={{ marginTop: 16, background: "#fff", padding: 12, borderRadius: 14,
              border: "1px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7280", marginBottom: 8 }}>
                최근 질문
              </div>
              {log.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 14, padding: "6px 0",
                  borderBottom: i < log.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <span style={{ fontSize: 18 }}>{e.cardEmoji}</span>
                  <span style={{ flex: 1, color: "#111827" }}>{e.labelA}</span>
                  <span style={{
                    fontWeight: 900, fontSize: 13, padding: "2px 10px", borderRadius: 999,
                    background: e.yes ? "#DCFCE7" : "#FEE2E2",
                    color: e.yes ? "#15803D" : "#B91C1C",
                  }}>{e.yes ? "예" : "아니오"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {phase === "asking" && pendingCard && secret && (
          <AskModal
            card={pendingCard}
            secret={secret}
            langB={langB}
            onAnswer={answerCard}
          />
        )}
      </>
    );
  }

  if (phase === "guess") {
    return (
      <div style={wrapStyle}>
        <h2 style={titleStyle}>🎯 정답은?</h2>
        <p style={subtitleStyle}>아래 8개 중에서 골라보세요</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          {guessChoices.map((it) => (
            <button
              key={it.id}
              onClick={() => submitGuess(it)}
              aria-label={tr(it.names, langA)}
              style={{
                padding: "16px 12px", borderRadius: 16, fontSize: 14, fontWeight: 800,
                background: "#fff", border: "2px solid #E5E7EB", cursor: "pointer",
                color: "#1F2937", display: "flex", flexDirection: "column", gap: 6,
                alignItems: "center", transition: "all 0.12s",
              }}
              onMouseDown={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")}
              onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
            >
              <span style={{ fontSize: 32 }}>{it.emoji}</span>
              <span>{tr(it.names, langA)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // result
  const correct = finalPick && secret && finalPick.id === secret.id;
  return (
    <div style={{ ...wrapStyle, textAlign: "center" }}>
      <div style={{ padding: "20px 0" }}>
        <BeeMascot size={120} mood={correct ? "cheer" : "think"} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 10 }}>
        {correct ? "🎉 정답!" : "😅 아쉬워요"}
      </div>
      {secret && (
        <div style={{ fontSize: 18, color: "#374151", fontWeight: 700 }}>
          정답은 {secret.emoji} <b>{tr(secret.names, langA)}</b> /
          {" "}{tr(secret.names, langB)}
        </div>
      )}
      <ProgressBar value={20 - remaining} max={20} score={correct ? 1 : 0} />
      <button
        onClick={resetAll}
        style={{ ...primaryBtn, marginTop: 18 }}
      >🔄 다시 하기</button>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function PlayHeader({ category, remaining }: { category: TwentyQCategory; remaining: number }) {
  const m = CATEGORY_META[category];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
      padding: "10px 14px", background: m.bg, borderRadius: 14, border: `2px solid ${m.color}`,
    }}>
      <span style={{ fontSize: 22 }}>{m.emoji}</span>
      <span style={{ fontWeight: 900, color: "#1F2937" }}>{m.labelKo}</span>
      <span style={{ flex: 1 }} />
      <span style={{
        padding: "4px 12px", borderRadius: 999, background: "#fff",
        border: `2px solid ${m.color}`, fontSize: 13, fontWeight: 900, color: m.color,
      }}>남은 질문 {remaining} / 20</span>
    </div>
  );
}

function HintGrid({
  usedFlags, onTap, langA,
}: {
  usedFlags: Set<string>;
  onTap: (c: HintCard) => void;
  langA: string;
}) {
  const groups: HintGroup[] = ["region", "taste", "use", "form", "misc"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.map((g) => {
        const cards = HINT_CARDS.filter((c) => c.group === g);
        if (cards.length === 0) return null;
        const meta = GROUP_LABEL[g];
        return (
          <div key={g}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7280", marginBottom: 6 }}>
              {meta.emoji} {meta.ko}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {cards.map((c) => {
                const used = usedFlags.has(c.flag as string);
                return (
                  <button
                    key={c.flag as string}
                    disabled={used}
                    onClick={() => onTap(c)}
                    aria-label={tr(c.label, langA)}
                    style={{
                      padding: "12px 12px", borderRadius: 14, fontSize: 13, fontWeight: 800,
                      background: used ? "#F3F4F6" : "#fff",
                      color: used ? "#9CA3AF" : "#1F2937",
                      border: used ? "2px solid #E5E7EB" : "2px solid #FDE68A",
                      cursor: used ? "not-allowed" : "pointer",
                      textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                      transition: "transform 0.12s",
                      opacity: used ? 0.6 : 1,
                    }}
                    onMouseDown={(e) => !used && ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)")}
                    onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
                  >
                    <span style={{ fontSize: 18 }}>{c.emoji}</span>
                    <span>{tr(c.label, langA)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SetupPanel({
  candidates, category, langB, onPick, onBack,
}: {
  candidates: TwentyQItem[];
  category: TwentyQCategory;
  langB: string;
  onPick: (it: TwentyQItem) => void;
  onBack: () => void;
}) {
  const m = CATEGORY_META[category];
  return (
    <>
      <h2 style={titleStyle}>{m.emoji} 출제자: 비밀 답을 고르세요</h2>
      <p style={subtitleStyle}>
        친구가 보기 전에 빠르게 한 개 선택. 선택 즉시 게임 시작!
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        {candidates.map((it) => (
          <button
            key={it.id}
            onClick={() => onPick(it)}
            aria-label={tr(it.names, langB)}
            style={{
              padding: "16px 10px", borderRadius: 16, fontSize: 14, fontWeight: 800,
              background: m.bg, border: `2px solid ${m.color}`, color: "#1F2937",
              cursor: "pointer", display: "flex", flexDirection: "column", gap: 6,
              alignItems: "center", transition: "transform 0.12s",
            }}
            onMouseDown={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")}
            onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
          >
            <span style={{ fontSize: 32 }}>{it.emoji}</span>
            <span>{tr(it.names, langB)}</span>
          </button>
        ))}
      </div>
      <button onClick={onBack} style={{ ...secondaryBtn, marginTop: 16 }}>↩ 카테고리 바꾸기</button>
    </>
  );
}

function AskModal({
  card, secret, langB, onAnswer,
}: {
  card: HintCard;
  secret: TwentyQItem;
  langB: string;
  onAnswer: (yes: boolean) => void;
}) {
  // auto-recommend based on secret.hints
  const flagVal = secret.hints[card.flag];
  const recommended: boolean = flagVal === true;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 600, padding: 16,
      }}
    >
      <div style={{
        maxWidth: 420, width: "100%", background: "#fff", borderRadius: 20,
        padding: "22px 20px", boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7280", marginBottom: 8 }}>
          출제자: 이 질문에 답해주세요
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#111827", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 28 }}>{card.emoji}</span>
          <span>{tr(card.label, langB)}</span>
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>
          추천 답: {recommended ? "예" : "아니오"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
          <button
            onClick={() => onAnswer(true)}
            aria-label="예"
            style={{
              padding: "16px 0", borderRadius: 14, fontSize: 20, fontWeight: 900,
              background: "#10B981", color: "#fff", border: "none", cursor: "pointer",
              boxShadow: "0 6px 14px rgba(16,185,129,0.3)",
            }}
          >✅ 예</button>
          <button
            onClick={() => onAnswer(false)}
            aria-label="아니오"
            style={{
              padding: "16px 0", borderRadius: 14, fontSize: 20, fontWeight: 900,
              background: "#EF4444", color: "#fff", border: "none", cursor: "pointer",
              boxShadow: "0 6px 14px rgba(239,68,68,0.3)",
            }}
          >❌ 아니오</button>
        </div>
      </div>
    </div>
  );
}

// ---- shared styles ----
const wrapStyle: React.CSSProperties = {
  padding: "20px 16px 40px", maxWidth: 640, margin: "0 auto",
  fontFamily: "'Noto Sans KR', sans-serif",
};
const titleStyle: React.CSSProperties = {
  fontSize: 24, fontWeight: 900, color: "#111827", margin: "4px 0 6px",
};
const subtitleStyle: React.CSSProperties = {
  fontSize: 13, color: "#6B7280", fontWeight: 600, margin: 0,
};
const primaryBtn: React.CSSProperties = {
  padding: "12px 18px", borderRadius: 14, fontSize: 15, fontWeight: 900,
  background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#fff", border: "none",
  cursor: "pointer", boxShadow: "0 6px 14px rgba(245,158,11,0.3)",
};
const secondaryBtn: React.CSSProperties = {
  padding: "12px 18px", borderRadius: 14, fontSize: 14, fontWeight: 800,
  background: "#fff", color: "#6B7280", border: "2px solid #E5E7EB", cursor: "pointer",
};

"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { TABOO_CARDS, TabooCategory, TabooCard, tr, pickN } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

type Phase = "setup" | "play" | "result";

const ROUND_SECONDS = 90;
const DECK_SIZE = 12;
const MAX_PASSES = 3;

const CAT_META: Record<TabooCategory, { emoji: string; label: string; bg: string }> = {
  school: { emoji: "🏫", label: "학교", bg: "#FDE68A" },
  food:   { emoji: "🍎", label: "음식", bg: "#FECACA" },
  animal: { emoji: "🐶", label: "동물", bg: "#BBF7D0" },
  daily:  { emoji: "🏠", label: "일상", bg: "#BFDBFE" },
};

const LANG_EMOJI: Record<string, string> = {
  ko: "🇰🇷", en: "🇺🇸", vi: "🇻🇳", zh: "🇨🇳", ja: "🇯🇵", th: "🇹🇭",
  id: "🇮🇩", hi: "🇮🇳", ru: "🇷🇺", ar: "🇸🇦", fil: "🇵🇭", km: "🇰🇭",
  mn: "🇲🇳", uz: "🇺🇿", my: "🇲🇲",
};

type ResultKind = "correct" | "pass" | "skipped";
interface OutcomeRecord { card: TabooCard; result: ResultKind; }

export default function HoneyTaboo({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [cats, setCats] = useState<Record<TabooCategory, boolean>>({
    school: true, food: true, animal: true, daily: true,
  });
  const [giverLang, setGiverLang] = useState<string>(langA);
  const [timer, setTimer] = useState<number>(ROUND_SECONDS);
  const [score, setScore] = useState<number>(0);
  const [passes, setPasses] = useState<number>(MAX_PASSES);
  const [idx, setIdx] = useState<number>(0);
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>([]);
  const [deckCats, setDeckCats] = useState<TabooCategory[]>([]);
  const finishedRef = useRef<boolean>(false);

  const selected = useMemo(
    () => (Object.keys(cats) as TabooCategory[]).filter((k) => cats[k]),
    [cats],
  );

  const deck: TabooCard[] = useMemo(() => {
    if (deckCats.length === 0) return [];
    const pool = TABOO_CARDS.filter((c) => deckCats.includes(c.category));
    return pickN(pool, Math.min(DECK_SIZE, pool.length));
  }, [deckCats]);

  // Timer — runs only during play phase
  useEffect(() => {
    if (phase !== "play") return;
    const id = window.setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Auto-finish when timer hits 0 or deck exhausted
  useEffect(() => {
    if (phase !== "play" || finishedRef.current) return;
    if (timer <= 0 || (deck.length > 0 && idx >= deck.length)) {
      finishedRef.current = true;
      setOutcomes((prev) => {
        const leftover = deck.slice(prev.length).map<OutcomeRecord>((c) => ({ card: c, result: "skipped" }));
        return [...prev, ...leftover];
      });
      setPhase("result");
    }
  }, [timer, idx, deck, phase]);

  function startGame() {
    if (selected.length === 0) return;
    setDeckCats(selected);
    setIdx(0); setScore(0); setPasses(MAX_PASSES); setTimer(ROUND_SECONDS);
    setOutcomes([]); finishedRef.current = false;
    setPhase("play");
  }

  function handleCorrect() {
    if (phase !== "play" || !deck[idx]) return;
    setScore((s) => s + 1);
    setOutcomes((p) => [...p, { card: deck[idx], result: "correct" }]);
    setIdx((i) => i + 1);
  }

  function handlePass() {
    if (phase !== "play" || passes <= 0 || !deck[idx]) return;
    setPasses((p) => p - 1);
    setOutcomes((p) => [...p, { card: deck[idx], result: "pass" }]);
    setIdx((i) => i + 1);
  }

  function toggleGiver() { setGiverLang((g) => (g === langA ? langB : langA)); }

  function restart() {
    setPhase("setup");
    setIdx(0); setScore(0); setPasses(MAX_PASSES); setTimer(ROUND_SECONDS);
    setOutcomes([]); setDeckCats([]); finishedRef.current = false;
  }

  if (phase === "setup") {
    return (
      <SetupScreen
        cats={cats} toggle={(k) => setCats((c) => ({ ...c, [k]: !c[k] }))}
        giverLang={giverLang} toggleGiver={toggleGiver}
        langA={langA} langB={langB}
        canStart={selected.length > 0} onStart={startGame}
      />
    );
  }

  if (phase === "result") {
    return <ResultScreen score={score} outcomes={outcomes} giverLang={giverLang} onRestart={restart} onExit={() => setPhase("setup")} />;
  }

  // PLAY
  const cur = deck[idx];
  const danger = timer <= 10;

  return (
    <div style={{ padding: "14px 14px 28px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <Hud label="⏱ 시간" value={`${timer}s`}
             bg={danger ? "#FEE2E2" : "#FEF3C7"}
             color={danger ? "#B91C1C" : "#92400E"}
             border={danger ? "#DC2626" : "#FBBF24"} shake={danger} />
        <Hud label="🐝 점수" value={`${score}`} bg="#DCFCE7" color="#15803D" border="#22C55E" />
        <Hud label="⏭ 패스" value={`${passes}`} bg="#DBEAFE" color="#1D4ED8" border="#60A5FA" />
      </div>

      {cur && (
        <div style={{
          background: "linear-gradient(180deg,#FFFBEB,#FEF3C7)",
          borderRadius: 22, border: "3px solid #FBBF24",
          boxShadow: "0 10px 28px rgba(180,83,9,0.18)",
          padding: "18px 16px", marginBottom: 12,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 11, fontWeight: 800, color: "#92400E", letterSpacing: 1, marginBottom: 8,
          }}>
            <span>{CAT_META[cur.category].emoji} {CAT_META[cur.category].label.toUpperCase()}</span>
            <span>{idx + 1} / {deck.length}</span>
          </div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
            🎤 설명자 {LANG_EMOJI[giverLang] ?? ""} {giverLang.toUpperCase()}
          </div>
          <div style={{
            textAlign: "center", fontSize: 34, fontWeight: 900, color: "#1F2937",
            padding: "10px 8px", letterSpacing: 0.5, wordBreak: "keep-all",
          }}>
            {tr(cur.answer, giverLang)}
          </div>

          <div style={{
            background: "#FEE2E2", borderRadius: 14, padding: "12px",
            border: "2px dashed #FCA5A5", marginTop: 6,
          }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#B91C1C", letterSpacing: 1, marginBottom: 6 }}>
              🚫 금칙어 (말하면 안 돼요)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {cur.taboos.map((t, i) => (
                <span key={i} style={{
                  background: "#fff", color: "#B91C1C",
                  border: "2px solid #FCA5A5", borderRadius: 12,
                  padding: "6px 12px", fontSize: 15, fontWeight: 800,
                  textDecoration: "line-through",
                  textDecorationColor: "#DC2626", textDecorationThickness: 2,
                }}>{tr(t, giverLang)}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8, marginBottom: 8 }}>
        <button onClick={handleCorrect} aria-label="맞혔어요"
          style={{ ...btnBase, background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff",
            boxShadow: "0 6px 16px rgba(22,163,74,0.35)" }}>
          ✅ 맞혔어요
        </button>
        <button onClick={handlePass} disabled={passes <= 0} aria-label={`패스 남은 ${passes}`}
          style={{ ...btnBase,
            background: passes > 0 ? "linear-gradient(135deg,#FBBF24,#F59E0B)" : "#E5E7EB",
            color: passes > 0 ? "#fff" : "#9CA3AF",
            cursor: passes > 0 ? "pointer" : "not-allowed",
            boxShadow: passes > 0 ? "0 6px 16px rgba(245,158,11,0.35)" : "none" }}>
          ⏭ 패스 ({passes})
        </button>
      </div>
      <button onClick={toggleGiver} aria-label="역할 바꾸기"
        style={{ ...btnBase, width: "100%", background: "#fff", color: "#92400E",
          border: "2px solid #FBBF24", fontWeight: 800 }}>
        🔄 역할 바꾸기 · 지금 {LANG_EMOJI[giverLang] ?? ""} {giverLang.toUpperCase()}
      </button>

      <style jsx>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}

function SetupScreen({
  cats, toggle, giverLang, toggleGiver, langA, langB, canStart, onStart,
}: {
  cats: Record<TabooCategory, boolean>;
  toggle: (k: TabooCategory) => void;
  giverLang: string; toggleGiver: () => void;
  langA: string; langB: string;
  canStart: boolean; onStart: () => void;
}) {
  const keys: TabooCategory[] = ["school", "food", "animal", "daily"];
  return (
    <div style={{ padding: "20px 16px 40px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <BeeMascot size={90} mood="cheer" />
        <div style={{ fontSize: 22, fontWeight: 900, color: "#78350F", marginTop: 6 }}>🚫 꿀벌 금칙어</div>
        <div style={{ fontSize: 12, color: "#92400E", fontWeight: 700, marginTop: 2 }}>
          금칙어는 빼고! 정답을 설명해 맞혀보세요.
        </div>
      </div>

      <Section title="🎯 카테고리 고르기">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {keys.map((k) => {
            const on = cats[k]; const m = CAT_META[k];
            return (
              <button key={k} onClick={() => toggle(k)} aria-pressed={on}
                aria-label={`${m.label} ${on ? "선택됨" : "선택 안 됨"}`}
                style={{
                  padding: "12px 10px", borderRadius: 14,
                  background: on ? m.bg : "#F9FAFB",
                  border: on ? "2px solid #F59E0B" : "2px solid #E5E7EB",
                  color: "#1F2937", fontSize: 14, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                }}>
                <span style={{ fontSize: 22 }}>{m.emoji}</span>
                <span style={{ flex: 1 }}>{m.label}</span>
                <span style={{ fontSize: 16 }}>{on ? "✅" : "⬜"}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="🎤 설명자의 언어">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[langA, langB].map((lang) => {
            const active = giverLang === lang;
            return (
              <button key={lang} onClick={() => { if (!active) toggleGiver(); }}
                aria-pressed={active} aria-label={`설명자 언어 ${lang.toUpperCase()}`}
                style={{
                  padding: "14px 10px", borderRadius: 14,
                  background: active ? "linear-gradient(135deg,#FEF3C7,#FDE68A)" : "#F9FAFB",
                  border: active ? "2px solid #F59E0B" : "2px solid #E5E7EB",
                  color: "#1F2937", fontSize: 15, fontWeight: 800, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}>
                <span style={{ fontSize: 28 }}>{LANG_EMOJI[lang] ?? "🌐"}</span>
                <span>{lang.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginTop: 8, textAlign: "center" }}>
          게임 중에도 🔄 버튼으로 바꿀 수 있어요
        </div>
      </Section>

      <button onClick={onStart} disabled={!canStart} aria-label="게임 시작"
        style={{
          ...btnBase, width: "100%",
          background: canStart ? "linear-gradient(135deg,#FBBF24,#F59E0B)" : "#E5E7EB",
          color: canStart ? "#fff" : "#9CA3AF", fontSize: 17,
          cursor: canStart ? "pointer" : "not-allowed",
          boxShadow: canStart ? "0 8px 20px rgba(245,158,11,0.4)" : "none",
        }}>▶ 시작하기 (90초)</button>
      {!canStart && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#DC2626", fontWeight: 700, marginTop: 8 }}>
          카테고리를 하나 이상 골라주세요
        </div>
      )}
    </div>
  );
}

function ResultScreen({
  score, outcomes, giverLang, onRestart, onExit,
}: {
  score: number; outcomes: OutcomeRecord[]; giverLang: string;
  onRestart: () => void; onExit: () => void;
}) {
  const mood = score >= 8 ? "celebrate" : score >= 5 ? "cheer" : "think";
  const groupBy = (r: ResultKind) => outcomes.filter((o) => o.result === r).map((o) => o.card);
  const correct = groupBy("correct"), passed = groupBy("pass"), skipped = groupBy("skipped");
  return (
    <div style={{ padding: "20px 16px 40px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ textAlign: "center" }}>
        <BeeMascot size={120} mood={mood} />
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 10, color: "#78350F" }}>🐝 {score}점!</div>
        <div style={{ fontSize: 13, color: "#92400E", fontWeight: 700, marginTop: 4 }}>
          {score >= 8 ? "환상적인 소통이에요!" : score >= 5 ? "제법 잘 통했어요!" : "다음엔 더 잘할 수 있어요"}
        </div>
      </div>
      <ResultList title="✅ 맞힌 카드" color="#16A34A" bg="#DCFCE7" cards={correct} lang={giverLang} />
      <ResultList title="⏭ 패스한 카드" color="#D97706" bg="#FEF3C7" cards={passed} lang={giverLang} />
      <ResultList title="⏱ 놓친 카드" color="#6B7280" bg="#F3F4F6" cards={skipped} lang={giverLang} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
        <button onClick={onRestart} aria-label="다시 하기"
          style={{ ...btnBase, background: "linear-gradient(135deg,#FBBF24,#F59E0B)", color: "#fff",
            boxShadow: "0 6px 16px rgba(245,158,11,0.35)" }}>🔁 다시 하기</button>
        <button onClick={onExit} aria-label="종료"
          style={{ ...btnBase, background: "#fff", color: "#92400E", border: "2px solid #FBBF24" }}>🏁 종료</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: "#fff", borderRadius: 18,
      border: "2px solid rgba(180,83,9,0.15)",
      padding: "14px 14px", marginBottom: 12,
      boxShadow: "0 4px 12px rgba(180,83,9,0.08)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#92400E", letterSpacing: 1, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function Hud({ label, value, bg, color, border, shake }: {
  label: string; value: string; bg: string; color: string; border: string; shake?: boolean;
}) {
  return (
    <div style={{
      background: bg, color, border: `2px solid ${border}`, borderRadius: 14,
      padding: "8px 6px", textAlign: "center",
      animation: shake ? "shake 0.5s ease-in-out infinite" : undefined,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, opacity: 0.85 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function ResultList({ title, color, bg, cards, lang }: {
  title: string; color: string; bg: string; cards: TabooCard[]; lang: string;
}) {
  if (cards.length === 0) return null;
  return (
    <div style={{
      marginTop: 14, background: bg, borderRadius: 14,
      border: `2px solid ${color}33`, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, color, letterSpacing: 1, marginBottom: 6 }}>
        {title} · {cards.length}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {cards.map((c, i) => (
          <span key={`${c.id}-${i}`} style={{
            background: "#fff", color: "#1F2937",
            border: `1.5px solid ${color}66`, borderRadius: 10,
            padding: "4px 10px", fontSize: 13, fontWeight: 700,
          }}>{tr(c.answer, lang)}</span>
        ))}
      </div>
    </div>
  );
}

const btnBase: CSSProperties = {
  border: "none", padding: "14px", borderRadius: 16,
  fontSize: 15, fontWeight: 900, cursor: "pointer",
};

"use client";

import { useState, useMemo, useEffect } from "react";
import { VocabWord } from "@/lib/vocabWords";
import { speakKorean } from "@/lib/ttsKorean";
import { t } from "@/lib/i18n";
import VocabRecorder from "./VocabRecorder";
import ListenPanel from "./practice/ListenPanel";
import WritePanel from "./practice/WritePanel";

type Mode = "listen" | "speak" | "write";

// 모듈 스코프 번역 캐시: key = `${wordId}:${lang}` → {word, s0, s1, s2, sit0, sit1, sit2}
const translationCache = new Map<string, Record<string, string>>();

interface Props {
  word: VocabWord;
  lang: string;
  doneSentences: number[];
  onSentenceDone: (idx: number) => void;
  onListenBump: () => void;
  onClose: () => void;
  roomCode: string;
  clientId: string;
}

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";

export default function VocabCard({
  word, lang, doneSentences, onSentenceDone, onListenBump, onClose,
  roomCode, clientId,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [rate, setRate] = useState(1);
  const [mode, setMode] = useState<Mode>("listen");
  const [showNative, setShowNative] = useState(false);
  const [nativeMap, setNativeMap] = useState<Record<string, string> | null>(null);
  const [nativeLoading, setNativeLoading] = useState(false);

  // 학습 단계: 먼저 단어 자체를 익히고(intro), 그 다음 예문(study)
  const [phase, setPhase] = useState<"intro" | "study">("intro");

  const sentence = word.sentences[idx];
  const doneSet = useMemo(() => new Set(doneSentences), [doneSentences]);
  const isDone = doneSet.has(idx);
  const mastered = doneSet.size >= 3;

  // 번역 fetch (lang ≠ ko 이고 showNative 켰을 때 첫 1회)
  useEffect(() => {
    if (lang === "ko") { setNativeMap(null); return; }
    if (!showNative) return;
    const cacheKey = `${word.id}:${lang}`;
    const cached = translationCache.get(cacheKey);
    if (cached) { setNativeMap(cached); return; }
    setNativeLoading(true);
    const items = [
      { key: "word", text: word.ko },
      { key: "s0", text: word.sentences[0].ko },
      { key: "s1", text: word.sentences[1].ko },
      { key: "s2", text: word.sentences[2].ko },
      { key: "sit0", text: word.sentences[0].situation },
      { key: "sit1", text: word.sentences[1].situation },
      { key: "sit2", text: word.sentences[2].situation },
    ];
    fetch("/api/vocab-translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, targetLang: lang }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((j: { translations: Record<string, string> }) => {
        translationCache.set(cacheKey, j.translations);
        setNativeMap(j.translations);
      })
      .catch(() => { /* silent — 실패 시 모국어 표시 불가 */ })
      .finally(() => setNativeLoading(false));
  }, [word.id, lang, showNative, word]);

  // 모드 변경 / 예문 변경 시 상태 리셋
  function switchMode(m: Mode) { setMode(m); }
  function switchIdx(i: number) { setIdx(i); setMode("listen"); }

  function handleDone() {
    onSentenceDone(idx);
    if (idx < 2) setTimeout(() => { setIdx((p) => Math.min(2, p + 1)); setMode("listen"); }, 300);
  }

  const nativeSentence = nativeMap?.[`s${idx}`];
  const nativeSituation = nativeMap?.[`sit${idx}`];
  const nativeWord = nativeMap?.word;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15, 10, 40, 0.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "'Noto Sans KR', sans-serif",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560,
          background: "#fff", borderRadius: "24px 24px 0 0",
          padding: "14px 18px 22px",
          boxShadow: "0 -16px 48px rgba(0,0,0,0.3)",
          maxHeight: "96vh", overflow: "auto",
          animation: "slideUp 0.25s ease",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: 8, borderBottom: "2px solid " + PURPLE_LIGHT,
        }}>
          <button onClick={onClose} aria-label="닫기" style={headerBtnStyle}>
            {t("vocabBack", lang)}
          </button>
          {phase === "study" ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => setPhase("intro")}
                style={{
                  background: "transparent", border: "1.5px solid " + PURPLE + "66",
                  borderRadius: 10, padding: "5px 10px",
                  fontSize: 11, fontWeight: 800, color: PURPLE_DARK,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >🔄 단어 다시</button>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#6B7280" }}>
                {idx + 1} / 3
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 800, color: PURPLE_DARK }}>
              📖 단어 배우기
            </div>
          )}
        </div>

        {phase === "intro" && (
          <IntroPanel
            word={word}
            lang={lang}
            showNative={showNative}
            setShowNative={setShowNative}
            nativeWord={nativeWord}
            nativeLoading={nativeLoading}
            onListen={(text) => { speakKorean(text, rate); onListenBump(); }}
            mastered={doneSet.size >= 3}
            doneCount={doneSet.size}
            onStartStudy={() => { setPhase("study"); setIdx(0); setMode("listen"); }}
          />
        )}

        {phase === "study" && (
          <>
          {/* study phase content follows */}

        {/* Word title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 10px" }}>
          <img
            src={`/vocab-images/icons/${word.id}.png`}
            alt={word.ko}
            style={{
              width: 56, height: 56, objectFit: "contain",
              borderRadius: 14, background: PURPLE_LIGHT,
              padding: 4, flexShrink: 0,
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
              {word.ko}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: PURPLE_DARK, marginTop: 2 }}>
              {word.subcategory} · {word.category}
              {showNative && nativeWord && (
                <span style={{ color: "#059669", marginLeft: 8 }}>· {nativeWord}</span>
              )}
            </div>
          </div>
          {lang !== "ko" && (
            <button
              onClick={() => setShowNative((v) => !v)}
              aria-label="모국어 번역"
              style={{
                background: showNative ? "linear-gradient(135deg, #10B981, #059669)" : PURPLE_LIGHT,
                color: showNative ? "#fff" : PURPLE_DARK,
                border: "none", borderRadius: 10,
                padding: "6px 10px", fontSize: 11, fontWeight: 900,
                cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
              }}
            >🌐 {showNative ? "ON" : "OFF"}</button>
          )}
          {mastered && (
            <div style={{
              background: "linear-gradient(135deg, #FDE68A, #F59E0B)",
              color: "#78350F", fontSize: 12, fontWeight: 900,
              padding: "6px 10px", borderRadius: 999, flexShrink: 0,
              boxShadow: "0 4px 10px rgba(245,158,11,0.35)",
            }}>{t("vocabMastered", lang)}</div>
          )}
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "6px 0 14px" }}>
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => switchIdx(i)}
              aria-label={`예문 ${i + 1}`}
              style={{
                width: i === idx ? 28 : 16, height: 10, borderRadius: 999, border: "none",
                cursor: "pointer",
                background: doneSet.has(i) ? PURPLE : (i === idx ? PURPLE_DARK : "#E5E7EB"),
                transition: "width 0.2s, background 0.2s",
              }}
            />
          ))}
        </div>

        {/* Illustration */}
        <div style={{
          borderRadius: 20, overflow: "hidden", background: PURPLE_LIGHT,
          border: "3px solid " + PURPLE + "33",
          aspectRatio: "16/9",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 10px 30px rgba(139, 92, 246, 0.18)",
        }}>
          <img
            src={`/vocab-images/sentences/${word.id}_${idx}.png`}
            alt={sentence.ko}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Korean sentence */}
        <div style={{
          margin: "18px 0 10px",
          background: "linear-gradient(135deg, #FFFFFF, " + PURPLE_LIGHT + ")",
          border: "3px solid " + PURPLE_DARK,
          borderRadius: 18, padding: "18px 16px",
          textAlign: "center",
          boxShadow: "0 6px 16px rgba(109, 40, 217, 0.15)",
        }}>
          <div style={{
            fontSize: 24, fontWeight: 900, color: "#1F2937",
            letterSpacing: -0.3, lineHeight: 1.5,
          }}>
            {sentence.ko}
          </div>
          {showNative && nativeSentence && (
            <div style={{
              fontSize: 15, color: "#059669", fontWeight: 700,
              marginTop: 10, paddingTop: 10,
              borderTop: "1.5px dashed " + PURPLE + "55",
              lineHeight: 1.5,
            }}>
              🌐 {nativeSentence}
            </div>
          )}
          {showNative && !nativeSentence && nativeLoading && (
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 10 }}>번역 중…</div>
          )}
        </div>

        {/* Situation */}
        <div style={{
          fontSize: 13, color: PURPLE_DARK, fontWeight: 700,
          textAlign: "center", margin: "6px 0 16px", padding: "0 8px",
          lineHeight: 1.5,
        }}>
          {t("vocabSituation", lang)}: {sentence.situation}
          {showNative && nativeSituation && (
            <div style={{ color: "#059669", marginTop: 4, fontWeight: 600 }}>
              {nativeSituation}
            </div>
          )}
        </div>

        {/* Mode tabs */}
        <div style={{
          display: "flex", gap: 4, background: "#F3F4F6", padding: 4,
          borderRadius: 12, marginBottom: 14,
        }}>
          {([
            { k: "listen" as Mode, icon: "👂", label: "듣기" },
            { k: "speak" as Mode, icon: "🎤", label: "말하기" },
            { k: "write" as Mode, icon: "✏️", label: "쓰기" },
          ]).map((m) => (
            <button
              key={m.k}
              onClick={() => switchMode(m.k)}
              style={{
                flex: 1,
                background: mode === m.k
                  ? "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")"
                  : "transparent",
                color: mode === m.k ? "#fff" : "#374151",
                border: "none", borderRadius: 10,
                padding: "10px 6px", fontSize: 13, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                boxShadow: mode === m.k ? "0 6px 14px rgba(139, 92, 246, 0.35)" : "none",
              }}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Mode content */}
        {mode === "listen" && (
          <ListenPanel
            rate={rate}
            setRate={setRate}
            onPlay={() => { speakKorean(sentence.ko, rate); onListenBump(); }}
            onDone={handleDone}
            isDone={isDone}
            lang={lang}
          />
        )}

        {mode === "speak" && (
          <VocabRecorder
            sentenceText={sentence.ko}
            wordForms={[word.ko, ...word.conjugations]}
            onOriginalPlay={() => { speakKorean(sentence.ko, rate); onListenBump(); }}
            onComplete={handleDone}
            roomCode={roomCode}
            clientId={clientId}
            wordId={word.id}
            sentenceIdx={idx}
          />
        )}

        {mode === "write" && (
          <WritePanel
            sentenceText={sentence.ko}
            onDone={handleDone}
            isDone={isDone}
            lang={lang}
          />
        )}

        {/* Nav */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={() => { setIdx((p) => Math.max(0, p - 1)); setMode("listen"); }}
            disabled={idx === 0}
            style={navBtnStyle(idx === 0)}
          >◀ {t("vocabPrev", lang)}</button>
          <button
            onClick={() => { setIdx((p) => Math.min(2, p + 1)); setMode("listen"); }}
            disabled={idx === 2}
            style={navBtnStyle(idx === 2)}
          >{t("vocabNext", lang)} ▶</button>
        </div>

        {/* Conjugations */}
        {word.conjugations.length > 0 && (
          <div style={{
            marginTop: 16, padding: "10px 14px",
            background: "#FAFAFA", borderRadius: 12,
            fontSize: 13, color: "#4B5563", fontWeight: 700,
            textAlign: "center", lineHeight: 1.8,
          }}>
            <span style={{ color: PURPLE_DARK, fontWeight: 900 }}>활용: </span>
            {word.conjugations.join(" · ")}
          </div>
        )}
        </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(60px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}

// ────────────── Intro panel (단어 자체 학습) ──────────────

function IntroPanel({
  word, lang, showNative, setShowNative, nativeWord, nativeLoading,
  onListen, mastered, doneCount, onStartStudy,
}: {
  word: VocabWord; lang: string;
  showNative: boolean; setShowNative: (v: boolean) => void;
  nativeWord: string | undefined; nativeLoading: boolean;
  onListen: (text: string) => void;
  mastered: boolean; doneCount: number;
  onStartStudy: () => void;
}) {
  return (
    <div>
      {/* Big icon + word */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        margin: "18px 0 14px",
      }}>
        <div style={{
          width: 140, height: 140, borderRadius: 28,
          background: "linear-gradient(135deg, " + PURPLE_LIGHT + ", #EDE9FE)",
          border: "3px solid " + PURPLE + "55",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 10,
          boxShadow: "0 14px 36px rgba(139, 92, 246, 0.25)",
        }}>
          <img
            src={`/vocab-images/icons/${word.id}.png`}
            alt={word.ko}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <div style={{
          fontSize: 42, fontWeight: 900, color: "#1F2937",
          letterSpacing: -0.5, textAlign: "center",
        }}>{word.ko}</div>

        {/* Native translation */}
        {lang !== "ko" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: showNative ? "#ECFDF5" : PURPLE_LIGHT,
            border: "2px dashed " + (showNative ? "#10B981" : PURPLE + "55"),
            borderRadius: 12, padding: "8px 14px",
            fontSize: 16, fontWeight: 700,
            color: showNative ? "#059669" : PURPLE_DARK,
          }}>
            🌐
            {showNative
              ? (nativeWord ?? (nativeLoading ? "번역 중…" : "번역 없음"))
              : <span style={{ fontSize: 13 }}>모국어로 보기</span>}
            <button
              onClick={() => setShowNative(!showNative)}
              style={{
                background: showNative ? "#10B981" : PURPLE,
                color: "#fff", border: "none", borderRadius: 8,
                padding: "4px 10px", fontSize: 11, fontWeight: 900,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >{showNative ? "끄기" : "켜기"}</button>
          </div>
        )}

        <div style={{
          display: "flex", gap: 6,
          fontSize: 11, fontWeight: 800, color: PURPLE_DARK,
          letterSpacing: 0.3,
        }}>
          <span style={{ background: PURPLE_LIGHT, padding: "3px 10px", borderRadius: 999 }}>
            {word.subcategory}
          </span>
          <span style={{ background: "#FEF3C7", color: "#92400E", padding: "3px 10px", borderRadius: 999 }}>
            {word.category}
          </span>
          {mastered && (
            <span style={{
              background: "linear-gradient(135deg, #FDE68A, #F59E0B)",
              color: "#78350F", padding: "3px 10px", borderRadius: 999,
            }}>🏆 완주</span>
          )}
        </div>
      </div>

      {/* Listen word button */}
      <button
        onClick={() => onListen(word.ko)}
        style={{
          width: "100%",
          background: "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")",
          color: "#fff", border: "none", borderRadius: 16,
          padding: "14px", fontSize: 18, fontWeight: 900,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 8px 20px rgba(139, 92, 246, 0.4)",
          marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}
      >🔊 단어 듣기</button>

      {/* Conjugations — 각 탭해서 TTS */}
      {word.conjugations.length > 0 && (
        <div style={{
          background: "#FAFAFA", borderRadius: 14,
          padding: "12px 14px", marginBottom: 14,
          border: "1.5px solid #E5E7EB",
        }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: PURPLE_DARK, marginBottom: 8, letterSpacing: 0.3 }}>
            활용형 (탭해서 듣기)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {word.conjugations.map((c) => (
              <button
                key={c}
                onClick={() => onListen(c)}
                style={{
                  background: "#fff",
                  border: "1.5px solid " + PURPLE + "55",
                  borderRadius: 999, padding: "6px 14px",
                  fontSize: 15, fontWeight: 800, color: "#1F2937",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >🔊 {c}</button>
            ))}
          </div>
        </div>
      )}

      {/* Progress hint */}
      {doneCount > 0 && (
        <div style={{
          textAlign: "center", fontSize: 12, fontWeight: 700, color: "#6B7280",
          marginBottom: 10,
        }}>예문 {doneCount}/3 완료됨</div>
      )}

      {/* Start study */}
      <button
        onClick={onStartStudy}
        style={{
          width: "100%",
          background: "linear-gradient(135deg, #F59E0B, #D97706)",
          color: "#fff", border: "none", borderRadius: 16,
          padding: "16px", fontSize: 18, fontWeight: 900,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 10px 24px rgba(245, 158, 11, 0.4)",
        }}
      >📖 예문 배우기 시작 →</button>
    </div>
  );
}

// ────────────── Shared styles ──────────────

const headerBtnStyle: React.CSSProperties = {
  background: PURPLE_LIGHT, border: "none", borderRadius: 10,
  padding: "6px 12px", fontSize: 14, fontWeight: 800, color: PURPLE_DARK,
  cursor: "pointer", fontFamily: "inherit",
};

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: disabled ? "#F3F4F6" : PURPLE_LIGHT,
    color: disabled ? "#9CA3AF" : PURPLE_DARK,
    border: "none", borderRadius: 12,
    padding: "12px", fontSize: 14, fontWeight: 800,
    cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
  };
}

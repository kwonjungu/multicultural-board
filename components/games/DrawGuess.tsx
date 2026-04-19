"use client";

import { useMemo, useState, useRef, useEffect, KeyboardEvent } from "react";
import { VOCAB, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

const DRAW_KEYS = new Set([
  "apple","banana","dog","cat","book","water","school","friend",
  "family","house","sun","moon","rice","tea","thanks",
]);

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export default function DrawGuess({ langA, langB }: { langA: string; langB: string }) {
  const rounds = useMemo(() => {
    const drawable = VOCAB.filter((v) => DRAW_KEYS.has(v.key));
    return pickN(drawable, 5);
  }, []);

  const [round, setRound] = useState(0);
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "wrong" | "correct">("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cur = rounds[round];
  const done = round >= rounds.length;

  useEffect(() => {
    if (!done && !revealed) {
      inputRef.current?.focus();
    }
  }, [round, revealed, done]);

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="cheer" />
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 14 }}>🎉 모두 끝났어요!</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: "#6B7280" }}>
          점수: {score} / {rounds.length}
        </div>
      </div>
    );
  }

  const imgSrc = `/game-assets/draw/${cur.key}.png`;
  const answerA = tr(cur.translations, langA);
  const answerB = tr(cur.translations, langB);

  const firstHint = (s: string): string => {
    const chars = Array.from(s);
    if (chars.length === 0) return "";
    return chars[0] + chars.slice(1).map((c) => (c === " " ? " " : "_")).join("");
  };

  const handleSubmit = () => {
    const guess = normalize(input);
    if (!guess) return;
    const a = normalize(answerA);
    const b = normalize(answerB);
    if (guess === a || guess === b) {
      setFeedback("correct");
      setScore((s) => s + 1);
      setRevealed(true);
    } else {
      setFeedback("wrong");
      setWrongCount((w) => w + 1);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const goNext = () => {
    setRound((r) => r + 1);
    setRevealed(false);
    setInput("");
    setWrongCount(0);
    setFeedback("idle");
  };

  const giveUp = () => {
    setRevealed(true);
    setFeedback("wrong");
  };

  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 520, margin: "0 auto" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 12, color: "#6B7280", fontWeight: 700, marginBottom: 10,
      }}>
        <span>🐝 꿀벌이 그린 그림은 무엇일까요?</span>
        <span>점수 {score} · {round + 1} / {rounds.length}</span>
      </div>

      <div style={{
        position: "relative", aspectRatio: "1 / 1",
        background: "#fff", borderRadius: 16, overflow: "hidden",
        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
      }}>
        <img
          src={imgSrc} alt="맞혀야 할 그림"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {!revealed ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <BeeMascot size={72} mood={feedback === "wrong" ? "think" : "happy"} />
          </div>

          <label htmlFor="draw-guess-input" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            ✏️ 답을 입력하세요
          </label>
          <input
            id="draw-guess-input"
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); if (feedback === "wrong") setFeedback("idle"); }}
            onKeyDown={handleKey}
            aria-label="답을 입력하세요"
            placeholder={`예: ${answerA}`}
            autoComplete="off"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: feedback === "wrong" ? "2px solid #EF4444" : "2px solid #FBBF24",
              fontSize: 16, fontWeight: 700, background: "#FFFBEB",
              outline: "none", boxSizing: "border-box",
            }}
          />

          {feedback === "wrong" && wrongCount > 0 && (
            <div style={{
              marginTop: 10, padding: "10px 12px", background: "#FEE2E2",
              borderRadius: 10, color: "#B91C1C", fontSize: 13, fontWeight: 700,
              textAlign: "center",
            }} role="status" aria-live="polite">
              다시 한 번! 힌트: <span style={{ fontFamily: "monospace", letterSpacing: 2 }}>{firstHint(answerA)}</span>
              {wrongCount >= 2 && (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600 }}>
                  다른 언어 힌트: <span style={{ fontFamily: "monospace", letterSpacing: 2 }}>{firstHint(answerB)}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={handleSubmit}
              aria-label="답 제출하기"
              style={{
                flex: 1,
                background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
                color: "#fff", border: "none", padding: 14, borderRadius: 14,
                fontSize: 15, fontWeight: 800, cursor: "pointer",
              }}
            >✅ 제출</button>
            <button
              type="button"
              onClick={giveUp}
              aria-label="정답 보기"
              style={{
                background: "#F3F4F6", color: "#6B7280", border: "none",
                padding: "14px 16px", borderRadius: 14,
                fontSize: 13, fontWeight: 800, cursor: "pointer",
              }}
            >💡 정답 보기</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 18, padding: 18, background: feedback === "correct" ? "#D1FAE5" : "#FEF3C7", borderRadius: 14, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <BeeMascot size={80} mood={feedback === "correct" ? "cheer" : "think"} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: feedback === "correct" ? "#065F46" : "#92400E", marginBottom: 6 }}>
            {feedback === "correct" ? "🎉 정답!" : "정답은"}
          </div>
          <div style={{ fontSize: 32 }}>{cur.emoji}</div>
          <div style={{ fontSize: 17, fontWeight: 900, marginTop: 6 }}>{answerA}</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>{answerB}</div>
          <button
            type="button"
            onClick={goNext}
            aria-label="다음 라운드로"
            style={{
              marginTop: 14, background: "#F59E0B", color: "#fff", border: "none",
              padding: "10px 24px", borderRadius: 99, cursor: "pointer",
              fontSize: 14, fontWeight: 800,
            }}
          >➡ 다음</button>
        </div>
      )}
    </div>
  );
}

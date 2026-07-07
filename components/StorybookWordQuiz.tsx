"use client";

import { useMemo, useState } from "react";
import type { Storybook } from "@/lib/types";
import { buildStorybookQuiz, type SbQuizItem } from "@/lib/storybookQuiz";
import { playTone, playFanfare } from "@/lib/gameSfx";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const GREEN = "#10B981";
const RED = "#EF4444";

// [신규] 수업 전 단어 퀴즈 (4지선다) — 학생 화면.
// 그림책 본문 전에 핵심 낱말을 미리 노출해 이해도를 높인다.
// 셔플 가드레일: buildStorybookQuiz 가 표시=채점 순서로 단일 배열을 만든다.
export default function StorybookWordQuiz({
  book,
  viewerLang,
  onDone,
}: {
  book: Storybook;
  viewerLang: string;
  onDone: () => void;
}) {
  // 세션 동안 문항을 한 번만 생성 (셔플 고정)
  const quiz = useMemo<SbQuizItem[]>(
    () => buildStorybookQuiz(book.vocab, viewerLang, book.pages),
    [book.vocab, book.pages, viewerLang],
  );

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  // 어휘 부족 → 퀴즈 생략 (방어). 부모가 이미 거르지만 한 번 더.
  if (quiz.length === 0) {
    onDone();
    return null;
  }

  const item = quiz[idx];

  function choose(choiceIdx: number) {
    if (picked !== null) return;
    setPicked(choiceIdx);
    const isCorrect = item.choices[choiceIdx].correct;
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      playTone(880, 140, "sine", 0.18);
    } else {
      playTone(220, 200, "sawtooth", 0.16);
    }
  }

  function next() {
    if (idx + 1 >= quiz.length) {
      const finalCorrect = correctCount;
      const stars = finalCorrect >= quiz.length ? "full" : finalCorrect >= Math.ceil(quiz.length / 2) ? "good" : "soft";
      playFanfare(stars);
      setFinished(true);
    } else {
      setIdx((i) => i + 1);
      setPicked(null);
    }
  }

  if (finished) {
    const pct = Math.round((correctCount / quiz.length) * 100);
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "20px 8px" }}>
          <div style={{ fontSize: 56 }}>{pct >= 80 ? "🏆" : pct >= 50 ? "🎉" : "🌱"}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: PURPLE_DARK, marginTop: 6 }}>
            낱말 퀴즈 끝!
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#374151", marginTop: 8 }}>
            {quiz.length}개 중 <span style={{ color: GREEN }}>{correctCount}개</span> 맞혔어요
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
            이제 그림책을 함께 읽어볼까요?
          </div>
          <button onClick={onDone} style={primaryBtn}>그림책 보러 가기 →</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* progress */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: PURPLE_DARK }}>
          📝 낱말 퀴즈 {idx + 1} / {quiz.length}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: GREEN }}>✓ {correctCount}</span>
      </div>
      <div style={{ height: 8, background: "#F3F4F6", borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
        <div style={{
          width: `${((idx) / quiz.length) * 100}%`, height: "100%",
          background: `linear-gradient(90deg, ${PURPLE}, ${PURPLE_DARK})`, transition: "width 0.3s",
        }} />
      </div>

      {/* question */}
      <div style={{
        fontSize: 18, fontWeight: 900, color: "#1F2937", lineHeight: 1.5,
        textAlign: "center", marginBottom: 16, minHeight: 54,
      }}>
        {item.question}
      </div>

      {item.example && (
        <div style={{
          fontSize: 14, fontWeight: 700, color: "#6D28D9", lineHeight: 1.5,
          textAlign: "center", marginBottom: 14, padding: "10px 12px",
          background: "#FAF5FF", border: "1.5px dashed #DDD6FE", borderRadius: 12,
        }}>
          📖 {item.example}
        </div>
      )}

      {/* choices */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {item.choices.map((c, i) => {
          const isPicked = picked === i;
          const reveal = picked !== null;
          const bg = reveal
            ? c.correct ? "#ECFDF5" : isPicked ? "#FEF2F2" : "#fff"
            : "#fff";
          const border = reveal
            ? c.correct ? GREEN : isPicked ? RED : "#E5E7EB"
            : "#E5E7EB";
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={reveal}
              style={{
                textAlign: "left", padding: "14px 16px",
                background: bg, border: `2.5px solid ${border}`,
                borderRadius: 14, fontSize: 15, fontWeight: 800, color: "#1F2937",
                cursor: reveal ? "default" : "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 10,
                transition: "background 0.15s, border 0.15s",
              }}
            >
              <span style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                background: reveal && c.correct ? GREEN : reveal && isPicked ? RED : "#F3F4F6",
                color: reveal && (c.correct || isPicked) ? "#fff" : "#6B7280",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 900,
              }}>
                {reveal && c.correct ? "✓" : reveal && isPicked ? "✕" : String.fromCharCode(65 + i)}
              </span>
              <span style={{ flex: 1 }}>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* next */}
      {picked !== null && (
        <button onClick={next} style={{ ...primaryBtn, marginTop: 18 }}>
          {idx + 1 >= quiz.length ? "결과 보기" : "다음 →"}
        </button>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 22, padding: "18px 18px 22px",
      border: "2px solid #EDE9FE", boxShadow: "0 8px 24px rgba(139,92,246,0.15)",
    }}>
      {children}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  width: "100%", marginTop: 18,
  background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
  color: "#fff", border: "none", borderRadius: 14,
  padding: "13px 22px", fontSize: 15, fontWeight: 900,
  cursor: "pointer", fontFamily: "inherit",
  boxShadow: `0 6px 18px ${PURPLE}55`,
};

"use client";

import { useMemo, useState, useRef, useEffect, KeyboardEvent } from "react";
import { VOCAB, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";
import VocabImage from "./VocabImage";
import { gt, UI, type LangMap } from "./uiText";

const DG: Record<string, LangMap> = {
  whatDrawing: {
    ko: "🐝 꿀벌이 그린 그림은 무엇일까요?", en: "🐝 What did the bee draw?",
    vi: "🐝 Ong vẽ gì vậy?", zh: "🐝 蜜蜂画的是什么?", fil: "🐝 Ano ang iginuhit ng bubuyog?",
    ja: "🐝 みつばちがかいたのはなに?", th: "🐝 ผึ้งวาดอะไร?", id: "🐝 Lebah menggambar apa?",
    ru: "🐝 Что нарисовала пчёлка?", hi: "🐝 मधुमक्खी ने क्या बनाया?", ar: "🐝 ماذا رسمت النحلة؟",
  },
  enterAnswer: {
    ko: "답을 입력하세요", en: "Type your answer", vi: "Nhập câu trả lời", zh: "输入答案",
    fil: "I-type ang sagot", ja: "こたえをいれてね", th: "พิมพ์คำตอบ", id: "Ketik jawaban",
    ru: "Введите ответ", hi: "उत्तर लिखो", ar: "اكتب الإجابة",
  },
  answerPlaceholder: {
    ko: "여기에 답을 써주세요", en: "Write your answer here", vi: "Viết câu trả lời ở đây",
    zh: "在这里写答案", fil: "Isulat ang sagot dito", ja: "ここにこたえをかいてね",
    th: "เขียนคำตอบที่นี่", id: "Tulis jawaban di sini", ru: "Напишите ответ здесь",
    hi: "यहाँ उत्तर लिखो", ar: "اكتب إجابتك هنا",
  },
  tryAgainHint: {
    ko: "다시 한 번! 힌트:", en: "Try again! Hint:", vi: "Thử lại! Gợi ý:", zh: "再试一次!提示:",
    fil: "Subukan ulit! Pahiwatig:", ja: "もういちど!ヒント:", th: "ลองอีกครั้ง! ใบ้:",
    id: "Coba lagi! Petunjuk:", ru: "Ещё раз! Подсказка:", hi: "फिर कोशिश! संकेत:", ar: "حاول ثانية! تلميح:",
  },
  otherLangHint: {
    ko: "다른 언어 힌트:", en: "Other language hint:", vi: "Gợi ý ngôn ngữ khác:",
    zh: "其他语言提示:", fil: "Pahiwatig sa ibang wika:", ja: "べつのことばのヒント:",
    th: "ใบ้ภาษาอื่น:", id: "Petunjuk bahasa lain:", ru: "Подсказка на другом языке:",
    hi: "दूसरी भाषा संकेत:", ar: "تلميح بلغة أخرى:",
  },
  showAnswer: {
    ko: "정답 보기", en: "Show answer", vi: "Xem đáp án", zh: "看答案", fil: "Ipakita ang sagot",
    ja: "こたえをみる", th: "ดูคำตอบ", id: "Lihat jawaban", ru: "Показать ответ", hi: "उत्तर देखो", ar: "أظهر الإجابة",
  },
  theAnswerIs: {
    ko: "정답은", en: "The answer is", vi: "Đáp án là", zh: "答案是", fil: "Ang sagot ay",
    ja: "こたえは", th: "คำตอบคือ", id: "Jawabannya", ru: "Ответ:", hi: "उत्तर है", ar: "الإجابة هي",
  },
  toGuess: {
    ko: "맞혀야 할 그림", en: "Picture to guess", vi: "Hình cần đoán", zh: "要猜的图",
    fil: "Larawang huhulaan", ja: "あてるえ", th: "ภาพที่ต้องทาย", id: "Gambar tebakan",
    ru: "Картинка для угадывания", hi: "अनुमान चित्र", ar: "صورة للتخمين",
  },
};

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
    return pickN(drawable, 15);
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
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 14 }}>🎉 {gt(UI.allDone, langA)}</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: "#6B7280" }}>
          {gt(UI.score, langA)}: {score} / {rounds.length}
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
        <span>{gt(DG.whatDrawing, langA)}</span>
        <span>{gt(UI.score, langA)} {score} · {round + 1} / {rounds.length}</span>
      </div>

      <div style={{
        position: "relative", aspectRatio: "1 / 1",
        background: "#fff", borderRadius: 16, overflow: "hidden",
        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
      }}>
        <img
          src={imgSrc} alt={gt(DG.toGuess, langA)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {!revealed ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <BeeMascot size={72} mood={feedback === "wrong" ? "think" : "happy"} />
          </div>

          <label htmlFor="draw-guess-input" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            ✏️ {gt(DG.enterAnswer, langA)}
          </label>
          <input
            id="draw-guess-input"
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); if (feedback === "wrong") setFeedback("idle"); }}
            onKeyDown={handleKey}
            aria-label={gt(DG.enterAnswer, langA)}
            placeholder={gt(DG.answerPlaceholder, langA)}
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
              {gt(DG.tryAgainHint, langA)} <span style={{ fontFamily: "monospace", letterSpacing: 2 }}>{firstHint(answerA)}</span>
              {wrongCount >= 2 && (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600 }}>
                  {gt(DG.otherLangHint, langA)} <span style={{ fontFamily: "monospace", letterSpacing: 2 }}>{firstHint(answerB)}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={handleSubmit}
              aria-label={gt(UI.submit, langA)}
              style={{
                flex: 1,
                background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
                color: "#fff", border: "none", padding: 14, borderRadius: 14,
                fontSize: 15, fontWeight: 800, cursor: "pointer",
              }}
            >✅ {gt(UI.submit, langA)}</button>
            <button
              type="button"
              onClick={giveUp}
              aria-label={gt(DG.showAnswer, langA)}
              style={{
                background: "#F3F4F6", color: "#6B7280", border: "none",
                padding: "14px 16px", borderRadius: 14,
                fontSize: 13, fontWeight: 800, cursor: "pointer",
              }}
            >💡 {gt(DG.showAnswer, langA)}</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 18, padding: 18, background: feedback === "correct" ? "#D1FAE5" : "#FEF3C7", borderRadius: 14, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <BeeMascot size={80} mood={feedback === "correct" ? "cheer" : "think"} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: feedback === "correct" ? "#065F46" : "#92400E", marginBottom: 6 }}>
            {feedback === "correct" ? `🎉 ${gt(UI.correct, langA)}` : gt(DG.theAnswerIs, langA)}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            {/* key 로 라운드마다 리마운트 — onError 폴백 상태가 다음 단어로 새어가지 않게 */}
            <VocabImage key={cur.key} vocabKey={cur.key} emoji={cur.emoji} size={64} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, marginTop: 6 }}>{answerA}</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>{answerB}</div>
          <button
            type="button"
            onClick={goNext}
            aria-label={gt(UI.next, langA)}
            style={{
              marginTop: 14, background: "#F59E0B", color: "#fff", border: "none",
              padding: "10px 24px", borderRadius: 99, cursor: "pointer",
              fontSize: 14, fontWeight: 800,
            }}
          >➡ {gt(UI.next, langA)}</button>
        </div>
      )}
    </div>
  );
}

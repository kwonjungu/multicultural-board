"use client";

import { useMemo, useState, useRef, useEffect, KeyboardEvent } from "react";
import { VOCAB, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../ui/game/GameHeader";
import VocabImage from "./VocabImage";
import { gt, UI, type LangMap } from "./uiText";
import { gp } from "./plainText";

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
  // 오답 안내는 차분하게 — 흔들림·경고음 없이 "다시 한 번 해볼까요?" 톤으로.
  tryAgainHint: {
    ko: "다시 한 번 해볼까요? 힌트:", en: "Shall we try once more? Hint:", vi: "Thử lại nhé! Gợi ý:",
    zh: "我们再试一次吧!提示:", fil: "Subukan natin ulit! Pahiwatig:", ja: "もういちど やってみよう!ヒント:",
    th: "ลองอีกครั้งกันไหม ใบ้:", id: "Ayo coba sekali lagi! Petunjuk:", ru: "Попробуем ещё раз! Подсказка:",
    hi: "एक बार और कोशिश करें? संकेत:", ar: "هل نحاول مرة أخرى؟ تلميح:",
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
  // 제출 버튼이 아직 동작하지 않는 이유를 화면에 보여준다 (disabled 대신 aria-disabled).
  typeFirst: {
    ko: "답을 먼저 써주세요", en: "Write your answer first", vi: "Hãy viết câu trả lời trước",
    zh: "请先写下答案", fil: "Isulat muna ang sagot", ja: "さきに こたえを かいてね",
    th: "เขียนคำตอบก่อนนะ", id: "Tulis dulu jawabannya", ru: "Сначала напиши ответ",
    hi: "पहले उत्तर लिखो", ar: "اكتب الإجابة أولًا",
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

  /** '다시 하기' 로 문제를 새로 뽑기 위한 씨앗. 09 §11: 막다른 결과 화면 금지. */
  const [seed, setSeed] = useState(0);
  const [round, setRound] = useState(0);
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "wrong" | "correct">("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cur = rounds[round];
  const done = round >= rounds.length;

  function restart() {
    setRound(0); setInput(""); setRevealed(false); setScore(0);
    setWrongCount(0); setFeedback("idle"); setSeed((n) => n + 1);
  }

  useEffect(() => {
    if (!done && !revealed) {
      inputRef.current?.focus();
    }
  }, [round, revealed, done]);

  if (done) {
    return (
      <div data-ux-root className="dg-root dg-center">
        <ScopedStyle css={DG_CSS} />
        {/* 09 §11: 결과가 막다른 화면이면 안 된다 — 헤더(나가기)와 다시 하기를 둔다. */}
        <GameHeader
          gameId="draw"
          title="그림 맞히기"
          icon="🎨"
          status={<GameStat icon="⭐" label={gt(UI.score, langA)} value={`${score} / ${rounds.length}`} tone="key" />}
        />
        <BeeMascot size={120} mood="cheer" />
        <p data-ux-role="body-emphasis">🎉 {gt(UI.allDone, langA)}</p>
        <p data-ux-role="body">{gt(UI.score, langA)}: {score} / {rounds.length}</p>
        <button data-ux-role="action" className="dg-primary" onClick={restart}>
          🔁 {gp(UI.playAgain, langA)}
        </button>
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

  const canSubmit = normalize(input).length > 0;

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
    // 한글·일본어 조합 중의 Enter 는 글자 확정이지 제출이 아니다.
    if (e.nativeEvent.isComposing) return;
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
    <div data-ux-root className="dg-root">
      <ScopedStyle css={DG_CSS} />

      {/* U01 공용 헤더 — 점수·라운드는 다른 게임과 같은 자리(오른쪽)로. */}
      <GameHeader
        gameId="draw"
        introOpen
        title="그림 맞히기"
        icon="🎨"
        progress={{ value: round, max: rounds.length }}
        status={
          <>
            <GameStat icon="📍" label={gt(UI.round, langA)} value={`${round + 1} / ${rounds.length}`} />
            <GameStat icon="⭐" label={gt(UI.score, langA)} value={score} tone="key" />
          </>
        }
      />

      {/* 문제 지문은 헤더가 아니라 그림 바로 위에 둔다 — 헤더는 어느 게임에서나
          같은 것(이름·상태)만 담고, 그 판의 물음은 판 옆에 있어야 읽힌다. */}
      <p data-ux-role="body-emphasis" className="dg-ask">{gt(DG.whatDrawing, langA)}</p>

      <div className="dg-cols">
        <div className="dg-pic">
          <img src={imgSrc} alt={gt(DG.toGuess, langA)} className="dg-img" />
        </div>

        <div className="dg-side">
          {!revealed ? (
            <>
              <div className="dg-mascot">
                <BeeMascot size={72} mood={feedback === "wrong" ? "think" : "happy"} />
              </div>

              <label htmlFor="draw-guess-input" data-ux-role="label" className="dg-label">
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
                className="dg-input"
                data-state={feedback === "wrong" ? "wrong" : undefined}
              />

              {feedback === "wrong" && wrongCount > 0 && (
                <div className="dg-hint" role="status" aria-live="polite">
                  <span data-ux-role="body">{gt(DG.tryAgainHint, langA)}</span>{" "}
                  <span className="dg-mask">{firstHint(answerA)}</span>
                  {wrongCount >= 2 && (
                    <div className="dg-hint2">
                      <span data-ux-role="secondary">{gt(DG.otherLangHint, langA)}</span>{" "}
                      <span className="dg-mask">{firstHint(answerB)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="dg-actions">
                <button
                  type="button"
                  data-ux-role="action"
                  className="dg-submit"
                  onClick={handleSubmit}
                  aria-disabled={!canSubmit}
                  aria-describedby={!canSubmit ? "draw-guess-why" : undefined}
                  aria-label={gt(UI.submit, langA)}
                >✅ {gt(UI.submit, langA)}</button>
                <button
                  type="button"
                  data-ux-role="control"
                  className="dg-ghost"
                  onClick={giveUp}
                  aria-label={gp(DG.showAnswer, langA)}
                >💡 {gp(DG.showAnswer, langA)}</button>
              </div>
              {!canSubmit && (
                <p id="draw-guess-why" data-ux-role="secondary" className="dg-why">
                  ✏️ {gt(DG.typeFirst, langA)}
                </p>
              )}
            </>
          ) : (
            <div className="dg-reveal" data-state={feedback === "correct" ? "correct" : "shown"}>
              <div className="dg-mascot">
                <BeeMascot size={80} mood={feedback === "correct" ? "cheer" : "think"} />
              </div>
              <p data-ux-role="body-emphasis" className="dg-revealhead">
                {feedback === "correct" ? `🎉 ${gt(UI.correct, langA)}` : gt(DG.theAnswerIs, langA)}
              </p>
              <div className="dg-mascot">
                {/* key 로 라운드마다 리마운트 — onError 폴백 상태가 다음 단어로 새어가지 않게 */}
                <VocabImage key={cur.key} vocabKey={cur.key} emoji={cur.emoji} size={64} />
              </div>
              <p data-ux-role="title" className="dg-answer">{answerA}</p>
              <p data-ux-role="body" className="dg-answerb">{answerB}</p>
              <button
                type="button"
                data-ux-role="action"
                className="dg-next"
                onClick={goNext}
                aria-label={gp(UI.next, langA)}
              >➡ {gp(UI.next, langA)}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const DG_CSS = `
.dg-root{
  color: var(--ux-ink);
  max-width: 1180px; margin: 0 auto;
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-12);
}
.dg-primary[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
}
.dg-center{
  display: grid; justify-items: center; gap: var(--ux-space-3);
  padding: var(--ux-space-12) var(--ux-space-4); text-align: center;
}
.dg-center h1, .dg-center p{ margin: 0; }
/* U01: .dg-top(질문+점수 한 줄)은 공용 GameHeader 로 옮겼다. 남은 것은 질문뿐. */
.dg-ask{
  margin: 0 0 var(--ux-space-4); font-weight: 800;
  word-break: keep-all; overflow-wrap: anywhere; min-width: 0;
}
.dg-cols{ display: grid; gap: var(--ux-space-4); align-items: start; }
.dg-pic{
  position: relative; aspect-ratio: 1 / 1; width: 100%;
  background: var(--ux-surface); border-radius: var(--ux-radius-panel);
  overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,0.08);
}
.dg-img{ width: 100%; height: 100%; object-fit: cover; display: block; }
.dg-side{ display: grid; gap: var(--ux-space-3); min-width: 0; align-content: start; }
.dg-mascot{ display: flex; justify-content: center; }
.dg-label{ display: block; font-weight: 700; }
.dg-input{
  width: 100%; box-sizing: border-box;
  padding: var(--ux-space-3) var(--ux-space-4);
  border-radius: var(--ux-radius-surface);
  border: 2px solid var(--ux-primary-border);
  background: var(--ux-surface);
  color: var(--ux-ink);
  font-family: inherit; font-weight: 700;
  font-size: var(--ux-font-body-emphasis);
  line-height: var(--ux-lh-tight);
  min-height: var(--ux-control-min);
  outline: none;
}
.dg-input[data-state="wrong"]{ border-color: var(--ux-selected-border); background: var(--ux-surface-sunk); }
.dg-hint{
  padding: var(--ux-space-3) var(--ux-space-4);
  background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-surface);
  text-align: center;
  word-break: keep-all; overflow-wrap: anywhere;
}
.dg-hint2{ margin-top: var(--ux-space-1); }
.dg-mask{
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .18em; font-weight: 800;
  font-size: var(--ux-font-body-emphasis);
}
.dg-actions{
  display: grid; gap: var(--ux-space-2);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.dg-submit{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800;
}
.dg-submit[aria-disabled="true"]{ opacity: .62; }
.dg-ghost{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800; white-space: nowrap;
}
.dg-why{ margin: 0; text-align: center; }
.dg-reveal{
  padding: var(--ux-space-4);
  border-radius: var(--ux-radius-panel);
  background: var(--ux-surface-sunk);
  text-align: center;
  display: grid; gap: var(--ux-space-2); justify-items: center;
}
.dg-reveal[data-state="correct"]{ background: color-mix(in srgb, var(--ux-success) 14%, var(--ux-surface)); }
.dg-reveal p{ margin: 0; }
.dg-revealhead{ font-weight: 800; }
.dg-answer{ font-weight: 900; }
.dg-answerb{ color: var(--ux-ink-soft); }
.dg-next{
  margin-top: var(--ux-space-2);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 800;
}
@media (min-width: 768px){
  .dg-root{ padding-left: var(--ux-space-6); padding-right: var(--ux-space-6); }
}
@media (min-width: 1024px){
  .dg-cols{
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: var(--ux-space-8);
    align-items: stretch;
  }
  .dg-reveal{ align-content: center; }
}
`;

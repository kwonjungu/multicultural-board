"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EMOTIONS, EmotionItem, pickN } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import { ProgressBar } from "./CountryGuess";
import { gt, type LangMap } from "./uiText";
import EmotionGlyph from "./EmotionGlyph";

const SITUATION: LangMap = {
  ko: "상황", en: "Situation", vi: "Tình huống", zh: "情境", fil: "Sitwasyon",
  ja: "ばめん", th: "สถานการณ์", id: "Situasi", ru: "Ситуация", hi: "स्थिति", ar: "موقف",
};

// 오답 연출: 흔들림·경고음 대신 다시 보자는 안내 (README §3-5).
const LOOK_AGAIN: LangMap = {
  ko: "괜찮아요. 초록 테두리가 이 마음이에요. 한 번 더 볼까요?",
  en: "That's okay. The green outline is the feeling. Shall we look once more?",
  vi: "Không sao. Viền xanh là cảm xúc đúng. Cùng xem lại nhé?",
  zh: "没关系。绿色边框就是这个心情，我们再看一次吧。",
  fil: "Ayos lang. Ang berdeng hangganan ang tamang damdamin. Tingnan natin ulit.",
  ja: "だいじょうぶ。みどりの わくが この きもちだよ。もういちど みようね。",
  th: "ไม่เป็นไรนะ กรอบสีเขียวคือความรู้สึกนี้ มาดูอีกครั้งกัน",
  id: "Tidak apa-apa. Bingkai hijau itu perasaannya. Ayo lihat sekali lagi.",
  ru: "Ничего страшного. Зелёная рамка — это то самое чувство. Посмотрим ещё раз?",
  hi: "कोई बात नहीं। हरा किनारा ही सही भाव है। एक बार और देखें?",
  ar: "لا بأس. الإطار الأخضر هو الشعور الصحيح. هل ننظر مرة أخرى؟",
};

const EMOJI_POOL = ["😊","😢","😠","😨","😳","🤗","😴","😮","🤔","🥳","🥰","😭","🏆","🤝","😟","💔"];

function EmotionImage({ item }: { item: EmotionItem }) {
  const [imgOk, setImgOk] = useState(true);
  return imgOk ? (
    <img
      className="eq-photo"
      src={`/emotions/${item.imageKey}.png`}
      alt=""
      aria-hidden="true"
      onError={() => setImgOk(false)}
    />
  ) : (
    <div className="eq-photofallback" aria-hidden>{item.emoji}</div>
  );
}

export default function EmotionQuiz({ langA, langB }: { langA: string; langB: string }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  /** 예약된 타이머 전부 — unmount 시 유령 타이머가 남지 않게 한 곳에서 정리한다. */
  const timersRef = useRef<number[]>([]);
  const aliveRef = useRef(true);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      if (aliveRef.current) fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const rounds = useMemo(() => pickN(EMOTIONS, 6).map((ans) => {
    const wrongs = EMOJI_POOL.filter((e) => e !== ans.emoji);
    const distractors = pickN(wrongs, 3);
    const choices = [...distractors, ans.emoji].sort(() => Math.random() - 0.5);
    return { answer: ans, choices };
  }), []);

  const cur = rounds[round];
  const done = round >= rounds.length;

  function handlePick(em: string) {
    if (picked) return;
    setPicked(em);
    if (em === cur.answer.emoji) setScore((s) => s + 1);
    later(() => {
      setPicked(null);
      setRound((r) => r + 1);
    }, 1600);
  }

  if (done) {
    return (
      <div data-ux-root className="eq-root eq-center">
        <ScopedStyle css={EQ_CSS} />
        <BeeMascot size={120} mood="cheer" />
        <h1 data-ux-role="title">🎉 {score} / {rounds.length}</h1>
      </div>
    );
  }

  const wrongPick = picked !== null && picked !== cur.answer.emoji;

  return (
    <div data-ux-root className="eq-root">
      <ScopedStyle css={EQ_CSS} />
      <ProgressBar value={round} max={rounds.length} score={score} />

      <div className="eq-play">
        <div className="eq-card">
          <span data-ux-role="label" className="eq-kicker">💭 {gt(SITUATION, langA)}</span>
          {/* key 로 라운드마다 리마운트 — imgOk(onError) 상태가 다음 문제로 새어가지 않게 */}
          <EmotionImage key={cur.answer.imageKey} item={cur.answer} />
          {/* 설계서 항목 12: 미보유 언어는 ko→번역 캐시 (영어 폴백 제거) */}
          <p data-ux-role="body-emphasis" data-ux-reading>
            <GameText map={cur.answer.situation} lang={langA} />
          </p>
          <p data-ux-role="body" data-ux-reading className="eq-second">
            <GameText map={cur.answer.situation} lang={langB} />
          </p>
        </div>

        <div className="eq-answers">
          <div className="eq-choices">
            {cur.choices.map((em) => {
              const isPicked = picked === em;
              const isCorrect = picked !== null && em === cur.answer.emoji;
              return (
                <button
                  key={em}
                  data-ux-role="control"
                  className="eq-choice"
                  data-state={isCorrect ? "correct" : isPicked ? "picked" : undefined}
                  aria-disabled={picked !== null}
                  onClick={() => handlePick(em)}
                >
                  <EmotionGlyph key={em} emoji={em} size={64} />
                </button>
              );
            })}
          </div>
          {wrongPick && (
            <p data-ux-role="body" className="eq-hint" role="status">🌱 {gt(LOOK_AGAIN, langA)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const EQ_CSS = `
.eq-root{
  color: var(--ux-ink);
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-8);
  width: 100%; max-width: 1200px; margin: 0 auto; box-sizing: border-box;
}
.eq-center{ display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center; padding-top: var(--ux-space-8); }

/* 넓은 화면에서는 상황 카드와 보기를 나란히 둔다 (세로 스크롤 제거). */
.eq-play{ display: grid; gap: var(--ux-space-4); }
@media (min-width: 900px){ .eq-play{ grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }

.eq-card{
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel); padding: var(--ux-space-6) var(--ux-space-4);
  display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center;
}
.eq-card p{ margin: 0; }
.eq-kicker{ color: var(--ux-primary-ink); font-weight: 900; }
.eq-second{ color: var(--ux-ink-soft); }
.eq-photo{ width: min(100%, 260px); height: auto; object-fit: contain; border-radius: var(--ux-radius-surface); }
.eq-photofallback{ font-size: clamp(4rem, 18vw, 7rem); line-height: 1; }

.eq-answers{ display: grid; gap: var(--ux-space-3); align-content: start; }
.eq-choices{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ux-space-3); }
@media (min-width: 480px){ .eq-choices{ grid-template-columns: repeat(4, minmax(0, 1fr)); } }

.eq-choice[data-ux-role="control"]{
  aspect-ratio: 1 / 1;
  display: flex; align-items: center; justify-content: center;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); font-family: inherit;
  padding: var(--ux-space-2);
  transition: background var(--ux-motion-state) var(--ux-motion-ease), border-color var(--ux-motion-state) var(--ux-motion-ease);
}
.eq-choice[data-state="correct"]{ border: 3px solid var(--ux-success); background: var(--ux-hint-mint); }
.eq-choice[data-state="picked"]{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }
.eq-choice[aria-disabled="true"]{ cursor: default; }

.eq-hint{
  margin: 0; padding: var(--ux-space-3) var(--ux-space-4);
  background: var(--ux-hint-mint); border-radius: var(--ux-radius-surface);
}
`;

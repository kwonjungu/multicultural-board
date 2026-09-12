"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VOCAB, pickN } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import VocabImage from "./VocabImage";
import { gt, UI, type LangMap } from "./uiText";
import { gp } from "./plainText";

const WT_HEIGHT: LangMap = {
  ko: "탑 높이", en: "Tower height", vi: "Chiều cao tháp", zh: "塔高", fil: "Taas ng tore",
  ja: "タワーのたかさ", th: "ความสูงหอ", id: "Tinggi menara", ru: "Высота башни", hi: "मीनार ऊँचाई", ar: "ارتفاع البرج",
};
const WT_FLOOR: LangMap = {
  ko: "칸", en: "floors", vi: "tầng", zh: "层", fil: "palapag",
  ja: "かい", th: "ชั้น", id: "lantai", ru: "этажей", hi: "मंज़िल", ar: "طوابق",
};
// 답을 고른 뒤 잠깐 버튼이 잠기는 이유를 아이에게 그대로 보여준다 (disabled 대신 aria-disabled).
const WT_WAIT: LangMap = {
  ko: "결과를 보여주는 중이에요. 잠깐만 기다려요.",
  en: "Showing the result — just a moment.",
  vi: "Đang hiện kết quả — đợi một chút nhé.",
  zh: "正在显示结果,请稍等一下。",
  fil: "Ipinapakita ang sagot — sandali lang.",
  ja: "けっかを みせています。ちょっとまってね。",
  th: "กำลังแสดงผลอยู่ รอสักครู่นะ",
  id: "Sedang menampilkan hasil — tunggu sebentar.",
  ru: "Показываем результат — подожди немного.",
  hi: "नतीजा दिखा रहे हैं — थोड़ा रुको।",
  ar: "نعرض النتيجة — انتظر قليلًا.",
};
// 틀렸을 때도 흔들거나 경고음을 내지 않는다. 차분하게 다시 권한다.
const WT_TRY_AGAIN: LangMap = {
  ko: "다시 한 번 해볼까요?", en: "Shall we try once more?", vi: "Thử lại một lần nữa nhé?",
  zh: "我们再试一次吧?", fil: "Subukan natin ulit?", ja: "もういちど やってみようか?",
  th: "ลองอีกครั้งกันไหม?", id: "Ayo coba sekali lagi?", ru: "Попробуем ещё раз?",
  hi: "एक बार और कोशिश करें?", ar: "هل نحاول مرة أخرى؟",
};
const WT_LIVES: LangMap = {
  ko: "남은 기회", en: "Lives left", vi: "Lượt còn lại", zh: "剩余机会", fil: "Natitirang tsansa",
  ja: "のこりのチャンス", th: "โอกาสที่เหลือ", id: "Sisa kesempatan", ru: "Осталось попыток",
  hi: "बचे मौके", ar: "المحاولات المتبقية",
};

const REVEAL_MS = 900;

export default function WordTower({ langA, langB }: { langA: string; langB: string }) {
  const [height, setHeight] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [cur, setCur] = useState(() => makeRound(langA, langB));
  const [picked, setPicked] = useState<number | null>(null);

  /** 예약된 타이머 전부. unmount·재시작 때 한 곳에서 정리한다. */
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

  // 답을 고른 직후 나가도 예약된 다음-라운드 타이머가 남지 않는다.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  function makeRound(a: string, b: string) {
    const correct = pickN(VOCAB, 1)[0];
    const wrongs = pickN(VOCAB.filter((v) => v.key !== correct.key), 3);
    // Show in A, options in B
    const askLang = Math.random() < 0.5 ? a : b;
    const ansLang = askLang === a ? b : a;
    const options = [correct, ...wrongs].sort(() => Math.random() - 0.5);
    return { correct, options, askLang, ansLang };
  }

  function handlePick(i: number) {
    if (picked !== null || gameOver) return;
    setPicked(i);
    const right = cur.options[i].key === cur.correct.key;
    later(() => {
      if (right) {
        setHeight((h) => h + 1);
      } else {
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) setGameOver(true);
          return nl;
        });
      }
      setPicked(null);
      setCur(makeRound(langA, langB));
    }, REVEAL_MS);
  }

  function restart() {
    clearTimers();
    setHeight(0); setLives(3); setGameOver(false);
    setCur(makeRound(langA, langB));
    setPicked(null);
  }

  const locked = picked !== null;
  const answeredWrong = picked !== null && cur.options[picked].key !== cur.correct.key;

  if (gameOver) {
    return (
      <div data-ux-root className="wt-root wt-center">
        <ScopedStyle css={WT_CSS} />
        <BeeMascot size={120} mood="happy" />
        <h1 data-ux-role="title">
          🏗️ {gt(WT_HEIGHT, langA)} {height}{gt(WT_FLOOR, langA)}
        </h1>
        <button data-ux-role="action" className="wt-primary" onClick={restart}>
          🔁 {gp(UI.playAgain, langA)}
        </button>
      </div>
    );
  }

  return (
    <div data-ux-root className="wt-root">
      <ScopedStyle css={WT_CSS} />

      <div className="wt-cols">
        {/* Quiz */}
        <div className="wt-quiz">
          <div className="wt-bar">
            <span data-ux-role="label" className="wt-floors">🏗️ {height}{gt(WT_FLOOR, langA)}</span>
            <span data-ux-role="label" className="wt-lives" aria-label={`${gt(WT_LIVES, langA)}: ${lives}`}>
              {"❤️".repeat(lives)}
            </span>
          </div>

          <div className="wt-card">
            <div data-ux-role="secondary" className="wt-langs">
              {cur.askLang.toUpperCase()} → {cur.ansLang.toUpperCase()}
            </div>
            <div className="wt-pic">
              {/* key 로 라운드마다 리마운트 — onError 폴백 상태가 다음 단어로 새어가지 않게 */}
              <VocabImage key={cur.correct.key} vocabKey={cur.correct.key} emoji={cur.correct.emoji} size={64} />
            </div>
            <div data-ux-role="title" className="wt-word">
              <GameText map={cur.correct.translations} lang={cur.askLang} />
            </div>
          </div>

          <div className="wt-options">
            {cur.options.map((opt, i) => {
              const isRight = picked !== null && opt.key === cur.correct.key;
              const isWrong = picked === i && opt.key !== cur.correct.key;
              const state = isRight ? "right" : isWrong ? "wrong" : undefined;
              return (
                <button
                  key={i}
                  type="button"
                  data-ux-role="control"
                  className="wt-option"
                  data-state={state}
                  aria-disabled={locked}
                  aria-describedby={locked ? "wt-why" : undefined}
                  onClick={() => handlePick(i)}
                ><GameText map={opt.translations} lang={cur.ansLang} /></button>
              );
            })}
          </div>

          {locked && (
            <p id="wt-why" data-ux-role="secondary" className="wt-why" role="status">
              ⏳ {gt(WT_WAIT, langA)}
              {answeredWrong && <> · {gt(WT_TRY_AGAIN, langA)}</>}
            </p>
          )}
        </div>

        {/* Tower */}
        <div className="wt-tower" aria-label={`${gt(WT_HEIGHT, langA)} ${height}${gt(WT_FLOOR, langA)}`}>
          <div className="wt-ground" />
          {Array.from({ length: height }).map((_, i) => (
            <div
              key={i}
              className="wt-block"
              style={{
                width: `${Math.max(60, 90 - i * 1.5)}%`,
                background: `hsl(${40 + i * 6}, 80%, 60%)`,
              }}
            >🍯</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const WT_CSS = `
@keyframes wt-blockDrop{
  from{ transform: translateY(-40px); opacity: 0; }
  to{ transform: translateY(0); opacity: 1; }
}
.wt-root{
  color: var(--ux-ink);
  margin: 0 auto;
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-12);
}
.wt-center{
  display: grid; justify-items: center; gap: var(--ux-space-4);
  padding: var(--ux-space-12) var(--ux-space-4); text-align: center;
}
.wt-center h1{ margin: 0; }
.wt-primary{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 800;
}
.wt-cols{
  display: grid; gap: var(--ux-space-4);
  grid-template-columns: minmax(0, 1fr) minmax(110px, 24%);
  align-items: start;
}
.wt-quiz{ min-width: 0; }
.wt-bar{
  display: flex; justify-content: space-between; align-items: center;
  gap: var(--ux-space-2); flex-wrap: wrap; margin-bottom: var(--ux-space-3);
}
.wt-floors{ color: var(--ux-success); font-weight: 800; }
.wt-lives{ letter-spacing: .08em; }
.wt-card{
  background: var(--ux-surface);
  border: 2px solid var(--ux-primary-border);
  padding: var(--ux-space-6) var(--ux-space-4);
  border-radius: var(--ux-radius-panel);
  text-align: center; margin-bottom: var(--ux-space-4);
  display: grid; gap: var(--ux-space-2); justify-items: center;
}
.wt-langs{ font-weight: 800; letter-spacing: .08em; }
.wt-pic{ display: flex; justify-content: center; }
.wt-word{ font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }
.wt-options{
  display: grid; gap: var(--ux-space-2);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.wt-option[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800; text-align: left;
  word-break: keep-all; overflow-wrap: anywhere;
  transition: background var(--ux-motion-state) var(--ux-motion-ease);
}
.wt-option[data-state="right"]{
  background: color-mix(in srgb, var(--ux-success) 16%, var(--ux-surface));
  border-color: var(--ux-success);
}
.wt-option[data-state="wrong"]{
  background: var(--ux-surface-sunk);
  border-color: var(--ux-selected-border);
}
.wt-option[aria-disabled="true"]{ cursor: default; }
.wt-why{
  margin: var(--ux-space-3) 0 0;
  padding: var(--ux-space-2) var(--ux-space-3);
  background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-surface);
  text-align: center;
  word-break: keep-all; overflow-wrap: anywhere;
}
.wt-tower{
  --wt-block-h: 20px;
  position: relative;
  background: var(--ux-hint-lavender);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel);
  overflow: hidden;
  display: flex; flex-direction: column-reverse; align-items: center;
  padding: var(--ux-space-2);
  min-height: 380px;
}
.wt-ground{
  width: 84%; height: 14px; border-radius: 4px;
  background: var(--ux-success); margin-bottom: var(--ux-space-1);
}
.wt-block{
  height: var(--wt-block-h);
  border: 2px solid var(--ux-primary-border); border-radius: 4px;
  margin-bottom: 3px;
  display: flex; align-items: center; justify-content: center;
  font-size: calc(var(--ux-font-secondary) * 0.7);
  font-weight: 800; color: var(--ux-primary-ink);
  animation: wt-blockDrop 0.4s ease-out;
}
@media (min-width: 768px){
  .wt-root{ padding-left: var(--ux-space-6); padding-right: var(--ux-space-6); }
  .wt-tower{ --wt-block-h: 24px; min-height: 460px; }
}
@media (min-width: 1024px){
  .wt-root{ max-width: 1280px; }
  .wt-cols{
    grid-template-columns: minmax(0, 1fr) minmax(280px, 26rem);
    gap: var(--ux-space-8);
  }
  .wt-tower{ --wt-block-h: 32px; min-height: 560px; padding: var(--ux-space-3); }
  .wt-ground{ height: 20px; }
  .wt-block{ font-size: calc(var(--ux-font-body) * 0.9); }
}
`;

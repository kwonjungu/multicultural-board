"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GREETINGS, pickN, tr } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../ui/game/GameHeader";
import { gt, UI, type LangMap } from "./uiText";

/**
 * 작은 반복 버튼용 라벨 — gt() 는 학습을 위해 한국어를 병기해서 "Listen again (다시 듣기)"
 * 처럼 라벨이 두 배가 된다. 매 라운드 반복되는 동작 버튼에는 보는 사람 언어만 쓴다.
 * (uiText.ts 는 수정 금지이므로 호출 방식만 바꾼다.)
 */
function plain(map: LangMap, lang: string): string {
  return map[lang] ?? map.en ?? map.ko ?? "";
}

// {a}=듣는 언어, {b}=고르는 언어
const GR: Record<string, LangMap> = {
  instruction: {
    ko: "{a}로 들려요 → {b}로 고르세요", en: "Listen in {a} → choose in {b}",
    vi: "Nghe bằng {a} → chọn {b}", zh: "用{a}听 → 选{b}", fil: "Pakinggan sa {a} → piliin sa {b}",
    ja: "{a}できこえる → {b}でえらぶ", th: "ฟัง {a} → เลือก {b}", id: "Dengar {a} → pilih {b}",
    ru: "Слушай на {a} → выбери на {b}", hi: "{a} में सुनो → {b} में चुनो", ar: "استمع بـ{a} → اختر بـ{b}",
  },
  replay: {
    ko: "다시 듣기", en: "Listen again", vi: "Nghe lại", zh: "重听", fil: "Ulitin",
    ja: "もういちど", th: "ฟังอีกครั้ง", id: "Dengar lagi", ru: "Ещё раз", hi: "फिर सुनो", ar: "استمع ثانية",
  },
  // 오답 연출: 흔들림·경고음 대신 다시 들어보자는 안내 (README §3-5).
  listenAgain: {
    ko: "괜찮아요. 한 번 더 들어볼까요?",
    en: "That's okay. Shall we listen once more?",
    vi: "Không sao. Nghe lại một lần nữa nhé?",
    zh: "没关系，我们再听一次吧。",
    fil: "Ayos lang. Pakinggan natin ulit?",
    ja: "だいじょうぶ。もういちど きいてみようか?",
    th: "ไม่เป็นไรนะ ฟังอีกครั้งไหม",
    id: "Tidak apa-apa. Mau dengar sekali lagi?",
    ru: "Ничего страшного. Послушаем ещё раз?",
    hi: "कोई बात नहीं। एक बार और सुनें?",
    ar: "لا بأس. هل نستمع مرة أخرى؟",
  },
};

export default function GreetingRelay({ langA, langB }: { langA: string; langB: string }) {
  /** '다시 하기' 로 문제를 새로 뽑기 위한 씨앗. 09 §11: 막다른 결과 화면 금지. */
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => {
    return pickN(GREETINGS, 6).map((g) => {
      const askLang = Math.random() < 0.5 ? langA : langB;
      const answerLang = askLang === langA ? langB : langA;
      const pool = GREETINGS.filter((o) => o !== g);
      const distractors = pickN(pool, 3);
      const options = [...distractors, g].sort(() => Math.random() - 0.5);
      return {
        greeting: g, askLang, answerLang,
        options,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langA, langB, seed]);

  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function restart() {
    setRound(0); setScore(0); setPicked(null); setSeed((n) => n + 1);
  }

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

  /** 새 음성 전에 이전 음성을 반드시 멈춘다. unmount cleanup 도 이걸 부른다. */
  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try { a.pause(); a.currentTime = 0; } catch { /* 이미 정리된 엘리먼트 */ }
    audioRef.current = null;
  }, []);

  const cur = rounds[round];
  const done = round >= rounds.length;

  const play = useCallback((text: string, lang: string) => {
    stopAudio();
    const a = new Audio(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`);
    audioRef.current = a;
    a.play().catch(() => { /* 소리가 없어도 글자로 계속 풀 수 있다 */ });
  }, [stopAudio]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimers();
      stopAudio();
    };
  }, [clearTimers, stopAudio]);

  useEffect(() => {
    if (!cur) return;
    play(tr(cur.greeting, cur.askLang), cur.askLang);
  }, [cur, play]);

  function handlePick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (cur.options[i] === cur.greeting) setScore((s) => s + 1);
    later(() => {
      setPicked(null);
      setRound((r) => r + 1);
    }, 1800);
  }

  function replay() {
    if (!cur) return;
    play(tr(cur.greeting, cur.askLang), cur.askLang);
  }

  if (done) {
    return (
      <div data-ux-root className="gr-root gr-center">
        <ScopedStyle css={GR_CSS} />
        {/* 09 §11: 결과가 막다른 화면이면 안 된다 — 헤더(나가기)와 다시 하기를 둔다. */}
        <GameHeader
          gameId="greeting"
          title="인사말 배우기"
          icon="👋"
          status={<GameStat icon="⭐" label={gt(UI.score, langA)} value={`${score} / ${rounds.length}`} tone="key" />}
        />
        <BeeMascot size={120} mood="cheer" />
        <p data-ux-role="body-emphasis">🎉 {score} / {rounds.length}</p>
        <button data-ux-role="action" className="gr-primary" onClick={restart}>
          🔁 {gt(UI.playAgain, langA)}
        </button>
      </div>
    );
  }

  const wrongPick = picked !== null && cur.options[picked] !== cur.greeting;

  return (
    <div data-ux-root className="gr-root">
      <ScopedStyle css={GR_CSS} />
      {/* U01 공용 헤더. 이전 단계가 없어 뒤로는 게임 목록으로 나간다. */}
      <GameHeader
        gameId="greeting"
        introOpen
        title="인사말 배우기"
        icon="👋"
        progress={{ value: round, max: rounds.length }}
        status={
          <>
            <GameStat icon="📍" label={gt(UI.round, langA)} value={`${Math.min(round + 1, rounds.length)} / ${rounds.length}`} />
            <GameStat icon="⭐" label={gt(UI.score, langA)} value={score} tone="key" />
          </>
        }
      />

      <div className="gr-play">
        <div className="gr-listencard">
          <p data-ux-role="body-emphasis" data-ux-reading>
            🎧 {gt(GR.instruction, langA)
              .replace("{a}", cur.askLang.toUpperCase())
              .replace("{b}", cur.answerLang.toUpperCase())}
          </p>
          <button data-ux-role="action" className="gr-replay" onClick={replay}>
            🔊 {plain(GR.replay, langA)}
          </button>
          {wrongPick && (
            <p data-ux-role="body" className="gr-hint" role="status">🌱 {gt(GR.listenAgain, langA)}</p>
          )}
        </div>

        <div className="gr-choices">
          {cur.options.map((opt, i) => {
            const isCorrect = picked !== null && opt === cur.greeting;
            const isWrong = picked === i && opt !== cur.greeting;
            return (
              <button
                key={i}
                data-ux-role="control"
                className="gr-choice"
                data-state={isCorrect ? "correct" : isWrong ? "picked" : undefined}
                aria-disabled={picked !== null}
                onClick={() => handlePick(i)}
              >
                <span data-ux-role="label"><GameText map={opt} lang={cur.answerLang} /></span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const GR_CSS = `
.gr-root{
  color: var(--ux-ink);
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-8);
  width: 100%; max-width: 1200px; margin: 0 auto; box-sizing: border-box;
}
.gr-primary[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
}
.gr-center{ display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center; padding-top: var(--ux-space-8); }

/* 넓은 화면: 듣기 카드와 보기를 나란히. 보기는 세로로 쌓지 않는다. */
.gr-play{ display: grid; gap: var(--ux-space-4); }
@media (min-width: 900px){ .gr-play{ grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }

.gr-listencard{
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel); padding: var(--ux-space-6) var(--ux-space-4);
  display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center;
}
.gr-listencard p{ margin: 0; }
.gr-replay[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}
.gr-hint{ padding: var(--ux-space-3) var(--ux-space-4); background: var(--ux-hint-mint); border-radius: var(--ux-radius-surface); }

.gr-choices{ display: grid; gap: var(--ux-space-3); grid-template-columns: 1fr; align-content: start; }
@media (min-width: 560px){ .gr-choices{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.gr-choice[data-ux-role="control"]{
  display: flex; align-items: center; justify-content: center; text-align: center;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 800;
  word-break: keep-all;
  transition: background var(--ux-motion-state) var(--ux-motion-ease), border-color var(--ux-motion-state) var(--ux-motion-ease);
}
.gr-choice[data-state="correct"]{ border: 3px solid var(--ux-success); background: var(--ux-hint-mint); }
.gr-choice[data-state="picked"]{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }
.gr-choice[aria-disabled="true"]{ cursor: default; }
`;

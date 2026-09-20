"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  COUNTRIES,
  EMOTIONS,
  GREETINGS,
  pickN,
  tr,
  type CountryItem,
  type LangMap,
} from "@/lib/gameData";
import { TILES } from "@/lib/marbleData";
import EmotionGlyph from "../EmotionGlyph";
import ScopedStyle from "../../ui/child/ScopedStyle";

export interface QuizCardProps {
  tileIdx: number;
  langA: string;
  langB: string;
  onAnswer: (correct: boolean) => void;
}

type QuizKind = "flag" | "greeting" | "emotion";

interface QuizData {
  kind: QuizKind;
  prompt: string;
  promptSecondary: string;
  choices: { label: string; key: string }[];
  answerIdx: number;
}

const EMOJI_POOL = ["😊","😢","😠","😨","😳","🤗","😴","😮","🥰","😭","🏆","🤝","😟","💔"];

// 발문 템플릿 — 뷰어/친구 언어로 각각 표시 (영어 하드코딩 제거, 설계서 항목 12)
const T_FLAG: LangMap = {
  ko: "이 나라의 국기를 골라요",
  en: "Pick this country's flag",
  vi: "Chọn quốc kỳ của nước này",
  zh: "选出这个国家的国旗",
  ja: "この国の国旗をえらぼう",
  fil: "Piliin ang bandila ng bansang ito",
  th: "เลือกธงชาติของประเทศนี้",
  ru: "Выбери флаг этой страны",
};
const T_GREET: Record<string, (name: string) => string> = {
  ko: (n) => `${n} 에서는 뭐라고 인사할까요?`,
  en: (n) => `How do people greet in ${n}?`,
  vi: (n) => `Ở ${n} người ta chào thế nào?`,
  zh: (n) => `在${n}人们怎么打招呼？`,
  ja: (n) => `${n} では なんて あいさつする？`,
  fil: (n) => `Paano bumati sa ${n}?`,
};
function greetPrompt(name: string, lang: string): string {
  return (T_GREET[lang] || T_GREET.ko)(name);
}

// Pick the quiz kind with weighted roll (flag 0.5 / greet 0.3 / emotion 0.2).
function pickKind(): QuizKind {
  const r = Math.random();
  if (r < 0.5) return "flag";
  if (r < 0.8) return "greeting";
  return "emotion";
}

function findCountry(code: string): CountryItem | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

function buildQuiz(
  tileIdx: number,
  viewerLang: string,
  friendLang: string,
): QuizData {
  const tile = TILES[tileIdx];
  const kind = pickKind();

  if (kind === "flag" && tile.country) {
    const target = findCountry(tile.country);
    if (target) {
      // Wrongs: 3 other countries from the overall pool.
      const wrongs = pickN(
        COUNTRIES.filter((c) => c.code !== tile.country),
        3,
      );
      const picks = [target, ...wrongs].sort(() => Math.random() - 0.5);
      const answerIdx = picks.findIndex((c) => c.code === target.code);
      return {
        kind,
        prompt: tr(T_FLAG, viewerLang, "ko"),
        promptSecondary: tr(T_FLAG, friendLang, "ko"),
        choices: picks.map((c) => ({ label: c.flag, key: c.code })),
        answerIdx,
      };
    }
  }

  if (kind === "greeting" && tile.country) {
    const target = findCountry(tile.country);
    // Pick a greeting map and ask "which translation matches this country's language?"
    const gmap: LangMap =
      GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    if (target) {
      const tgtLang = langForCountry(target.code);
      const right = gmap[tgtLang] ?? gmap.en ?? Object.values(gmap)[0] ?? "?";
      const wrongLangs = shuffleLangs().filter((l) => l !== tgtLang).slice(0, 3);
      const wrongs = wrongLangs.map((l) => gmap[l] ?? "");
      const picks = [right, ...wrongs].filter(Boolean).sort(() => Math.random() - 0.5);
      // If dedup removed items, pad with any distinct strings
      while (picks.length < 4) picks.push("…");
      const answerIdx = picks.indexOf(right);
      return {
        kind,
        prompt: `${target.flag} ${greetPrompt(tr(target.names, viewerLang), viewerLang)}`,
        promptSecondary: greetPrompt(tr(target.names, friendLang), friendLang),
        choices: picks.map((p, i) => ({ label: p, key: `g-${i}` })),
        answerIdx,
      };
    }
  }

  // Fallback / emotion: emoji 4-choice.
  const emo = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)];
  const wrongs = pickN(
    EMOJI_POOL.filter((e) => e !== emo.emoji),
    3,
  );
  const picks = [emo.emoji, ...wrongs].sort(() => Math.random() - 0.5);
  const answerIdx = picks.indexOf(emo.emoji);
  return {
    kind: "emotion",
    prompt: tr(emo.situation, viewerLang, "ko"),
    promptSecondary: tr(emo.situation, friendLang, "ko"),
    choices: picks.map((p, i) => ({ label: p, key: `e-${i}` })),
    answerIdx,
  };
}

// Map country codes to the most natural "native language" code used by
// our LangMap tables. Fallback to "en" when no obvious match.
function langForCountry(code: string): string {
  switch (code) {
    case "KR": return "ko";
    case "JP": return "ja";
    case "CN": return "zh";
    case "VN": return "vi";
    case "TH": return "th";
    case "PH": return "fil";
    case "ID": return "id";
    case "IN": return "hi";
    case "MN": return "mn";
    case "UZ": return "uz";
    case "KH": return "km";
    case "MM": return "my";
    case "RU": return "ru";
    case "SA": return "ar";
    default:   return "en";
  }
}

function shuffleLangs(): string[] {
  const all = ["ko", "en", "vi", "zh", "ja", "th", "id", "hi", "mn", "uz", "ru", "ar", "fil"];
  return all.sort(() => Math.random() - 0.5);
}

export function QuizCard({ tileIdx, langA, langB, onAnswer }: QuizCardProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(20);
  // 답을 이미 골랐는지 — 타이머 콜백은 picked 의 stale 값을 보므로 ref 로 추적.
  // 마지막 1초에 정답을 골라도 타임아웃의 onAnswer(false) 가 먼저 dispatch 되어
  // 오답 처리(우주 타일이면 한 턴 쉬기 페널티)되는 레이스를 막는다.
  const answeredRef = useRef(false);
  /** 예약된 타이머 전부 — unmount 시 유령 타이머가 남지 않게 한 곳에서 정리한다. */
  const timersRef = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    return () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    };
  }, []);

  const q = useMemo(
    () => buildQuiz(tileIdx, langA, langB),
    // regenerate only when tile changes; langA/langB are stable per game
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tileIdx],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id);
          // Timeout → wrong (이미 답을 골랐다면 무시).
          if (!answeredRef.current) later(() => onAnswer(false), 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [onAnswer, later]);

  function handlePick(i: number) {
    if (picked !== null) return;
    answeredRef.current = true;
    setPicked(i);
    const correct = i === q.answerIdx;
    later(() => onAnswer(correct), 800);
  }

  const bigChoice = q.kind === "flag" || q.kind === "emotion";

  return (
    <div className="mb-quiz" role="dialog" aria-modal="true" aria-label="문화 퀴즈">
      <ScopedStyle css={QUIZ_CSS} />
      <div className="mb-quiztop">
        <span data-ux-role="label" className="mb-quizkind">
          🎯 {q.kind === "flag" ? "국기 맞히기" : q.kind === "greeting" ? "인사말" : "감정"}
        </span>
        <span data-ux-role="secondary">⏳ {remaining}s</span>
      </div>
      <p data-ux-role="body-emphasis" data-ux-reading className="mb-quizprompt">{q.prompt}</p>
      {langA !== langB && q.promptSecondary && (
        <p data-ux-role="secondary" data-ux-reading className="mb-quizprompt2">{q.promptSecondary}</p>
      )}

      <div className="mb-quizchoices">
        {q.choices.map((c, i) => {
          const isAns = i === q.answerIdx;
          const isPicked = picked === i;
          const state = picked === null ? "idle" : isAns ? "correct" : isPicked ? "wrong" : "dim";
          return (
            <button
              key={c.key}
              data-ux-role="control"
              className="mb-quizchoice"
              data-state={state}
              data-big={bigChoice ? "" : undefined}
              aria-label={`답변 ${i + 1}`}
              aria-disabled={picked !== null}
              onClick={() => handlePick(i)}
            >
              {q.kind === "flag" ? (
                <FlagChoice code={c.key} emoji={c.label} />
              ) : q.kind === "emotion" ? (
                <EmotionGlyph key={c.label} emoji={c.label} size={44} />
              ) : (
                <span data-ux-role="label">{c.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const QUIZ_CSS = `
.mb-quiz{
  background: var(--ux-surface);
  border: 3px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-3);
  width: min(460px, 100%);
  max-height: 100%; overflow-y: auto; box-sizing: border-box;
  display: grid; gap: var(--ux-space-2);
  box-shadow: 0 20px 40px rgba(41,37,31,.3);
}
.mb-quiz p{ margin: 0; }
.mb-quiztop{ display: flex; justify-content: space-between; align-items: center; gap: var(--ux-space-2); }
.mb-quizkind{ font-weight: 900; color: var(--ux-primary-ink); }
.mb-quizprompt{ font-weight: 900; }
.mb-quizprompt2{ color: var(--ux-ink-soft); }
.mb-quizchoices{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ux-space-2); }
@media (min-width: 900px){ .mb-quizchoices{ grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.mb-quizchoice[data-ux-role="control"]{
  display: flex; align-items: center; justify-content: center;
  background: var(--ux-surface-sunk); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
  padding: var(--ux-space-2); word-break: break-word; text-align: center;
}
.mb-quizchoice[data-state="correct"]{ background: var(--ux-hint-mint); border: 3px solid var(--ux-success); }
.mb-quizchoice[data-state="wrong"]{ background: var(--ux-surface); border: 3px solid var(--ux-selected-border); }
.mb-quizchoice[data-state="dim"]{ background: var(--ux-surface); border-color: var(--ux-ink-soft); opacity: .6; }
.mb-quizchoice[aria-disabled="true"]{ cursor: default; }
`;

// 국기 선택지 — 로컬 번들 국기 이미지 우선, 로드 실패 시 국기 이모지 폴백.
// (CountryGuess 와 동일한 오픈/CC 라이선스 원본(flagcdn). 선택지 key 가 ISO 국가코드.)
function FlagChoice({ code, emoji }: { code: string; emoji: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span aria-hidden="true" style={{ fontSize: "var(--ux-font-title)" }}>{emoji}</span>;
  const cc = code.toLowerCase();
  return (
    <img
      src={`/flags/w80/${cc}.png`}
      srcSet={`/flags/w160/${cc}.png 2x`}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      draggable={false}
      style={{
        width: "100%",
        maxWidth: 72,
        aspectRatio: "3 / 2",
        objectFit: "cover",
        borderRadius: 6,
        border: "1px solid rgba(41,37,31,0.2)",
        verticalAlign: "middle",
      }}
    />
  );
}

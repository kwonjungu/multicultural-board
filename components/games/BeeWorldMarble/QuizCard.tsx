"use client";

import { CSSProperties, useMemo, useRef, useState, useEffect } from "react";
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

  const q = useMemo(
    () => buildQuiz(tileIdx, langA, langB),
    // regenerate only when tile changes; langA/langB are stable per game
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tileIdx],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          // Timeout → wrong (이미 답을 골랐다면 무시).
          if (!answeredRef.current) setTimeout(() => onAnswer(false), 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onAnswer]);

  function handlePick(i: number) {
    if (picked !== null) return;
    answeredRef.current = true;
    setPicked(i);
    const correct = i === q.answerIdx;
    setTimeout(() => onAnswer(correct), 800);
  }

  const wrap: CSSProperties = {
    background: "#fff",
    border: "3px solid #8B5CF6",
    borderRadius: 20,
    padding: 14,
    maxWidth: 420,
    width: "92%",
    boxShadow: "0 20px 40px rgba(139,92,246,0.35)",
  };

  return (
    <div style={wrap} role="dialog" aria-modal="true" aria-label="문화 퀴즈">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 900, color: "#6D28D9" }}>
          🎯 {q.kind === "flag" ? "국기 맞히기" : q.kind === "greeting" ? "인사말" : "감정"}
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF" }}>
          ⏳ {remaining}s
        </div>
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 900,
          color: "#111827",
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {q.prompt}
      </div>
      {langA !== langB && q.promptSecondary && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#6B7280",
            marginBottom: 10,
          }}
        >
          {q.promptSecondary}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 10,
        }}
      >
        {q.choices.map((c, i) => {
          const isAns = i === q.answerIdx;
          const isPicked = picked === i;
          const state = picked === null ? "idle" : isAns ? "correct" : isPicked ? "wrong" : "dim";
          const bg =
            state === "correct" ? "#D1FAE5" :
            state === "wrong" ? "#FEE2E2" :
            state === "dim" ? "#F3F4F6" : "#FEF3C7";
          const border =
            state === "correct" ? "3px solid #10B981" :
            state === "wrong" ? "3px solid #EF4444" :
            state === "dim" ? "2px solid #E5E7EB" : "2px solid #FBBF24";
          return (
            <button
              key={c.key}
              type="button"
              aria-label={`답변 ${i + 1}`}
              onClick={() => handlePick(i)}
              disabled={picked !== null}
              style={{
                background: bg,
                border,
                borderRadius: 14,
                padding: "12px 6px",
                fontSize: q.kind === "flag" || q.kind === "emotion" ? 36 : 15,
                fontWeight: 900,
                color: "#111827",
                cursor: picked === null ? "pointer" : "default",
                minHeight: 60,
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}
            >
              {q.kind === "flag" ? (
                <FlagChoice code={c.key} emoji={c.label} />
              ) : q.kind === "emotion" ? (
                <EmotionGlyph key={c.label} emoji={c.label} size={48} />
              ) : (
                c.label
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 국기 선택지 — flagcdn 실물 국기 이미지 우선, 로드 실패 시 국기 이모지 폴백.
// (CountryGuess 와 동일한 오픈 라이선스 CDN. 선택지 key 가 ISO 국가코드.)
function FlagChoice({ code, emoji }: { code: string; emoji: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span aria-hidden="true">{emoji}</span>;
  const cc = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w80/${cc}.png`}
      srcSet={`https://flagcdn.com/w160/${cc}.png 2x`}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      draggable={false}
      style={{
        width: 64,
        height: 42,
        objectFit: "cover",
        borderRadius: 6,
        border: "1px solid rgba(0,0,0,0.12)",
        verticalAlign: "middle",
      }}
    />
  );
}

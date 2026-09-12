"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, pickN, tr, type CountryDifficulty } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import { gt, UI, type LangMap } from "./uiText";

/**
 * 작은 반복 버튼용 라벨 — gt() 의 한국어 병기("Replay (다시 듣기)")는 문제 지문에는
 * 좋지만 카드마다 반복되는 동작 버튼에 붙으면 라벨이 두 배가 되어 버튼이 한 줄에
 * 하나씩 쌓인다. uiText.ts 는 수정 금지이므로 호출 방식만 바꾼다 (README 2026-09-12 §3).
 */
function plain(map: LangMap, lang: string): string {
  return map[lang] ?? map.en ?? map.ko ?? "";
}

// 게임 고유 UI 문구
const CG: Record<string, LangMap> = {
  pickDiff: {
    ko: "난이도를 골라주세요", en: "Choose a difficulty", vi: "Chọn độ khó", zh: "选择难度",
    fil: "Pumili ng antas", ja: "なんいどをえらんでね", th: "เลือกระดับ", id: "Pilih tingkat",
    ru: "Выбери уровень", hi: "कठिनाई चुनो", ar: "اختر المستوى",
  },
  ofPick: {
    ko: "개 나라 중에서 8문제가 나와요", en: "countries — 8 questions from them",
    vi: "quốc gia — 8 câu hỏi", zh: "个国家中出8题", fil: "bansa — 8 tanong",
    ja: "かこくから8もん", th: "ประเทศ — 8 ข้อ", id: "negara — 8 soal",
    ru: "стран — 8 вопросов", hi: "देशों में से 8 सवाल", ar: "دولة — 8 أسئلة",
  },
  countriesUnit: {
    ko: "개 나라", en: "countries", vi: "quốc gia", zh: "个国家", fil: "bansa",
    ja: "かこく", th: "ประเทศ", id: "negara", ru: "стран", hi: "देश", ar: "دولة",
  },
  goodJob: {
    ko: "수고했어요!", en: "Well done!", vi: "Giỏi lắm!", zh: "做得好!", fil: "Magaling!",
    ja: "よくできました!", th: "เก่งมาก!", id: "Bagus!", ru: "Молодец!", hi: "शाबाश!", ar: "أحسنت!",
  },
  changeDiff: {
    ko: "난이도 바꾸기", en: "Change difficulty", vi: "Đổi độ khó", zh: "换难度",
    fil: "Palitan ang antas", ja: "なんいどへんこう", th: "เปลี่ยนระดับ", id: "Ganti tingkat",
    ru: "Сменить уровень", hi: "कठिनाई बदलो", ar: "غيّر المستوى",
  },
  noData: {
    ko: "데이터가 부족합니다.", en: "Not enough data.", vi: "Không đủ dữ liệu.", zh: "数据不足。",
    fil: "Kulang ang datos.", ja: "データがたりません。", th: "ข้อมูลไม่พอ", id: "Data kurang.",
    ru: "Недостаточно данных.", hi: "पर्याप्त डेटा नहीं।", ar: "بيانات غير كافية.",
  },
  whichCountry: {
    ko: "이 국기의 나라는?", en: "Which country is this flag?", vi: "Lá cờ này của nước nào?",
    zh: "这是哪国国旗?", fil: "Aling bansa ang bandilang ito?", ja: "このこっきはどこ?",
    th: "ธงนี้ของประเทศใด?", ru: "Чей это флаг?",
    hi: "यह झंडा किस देश का?", ar: "علم أي دولة؟",
  },
  // 오답 연출: 흔들림·경고음 대신 '같이 한 번 더 보자'는 안내 (README §3-5).
  lookAgain: {
    ko: "괜찮아요. 정답 국기를 한 번 더 볼까요?",
    en: "That's okay. Let's look at the right flag once more.",
    vi: "Không sao đâu. Cùng xem lại lá cờ đúng nhé.",
    zh: "没关系，我们再看一次正确的国旗吧。",
    fil: "Ayos lang. Tingnan natin ulit ang tamang bandila.",
    ja: "だいじょうぶ。ただしい こっきを もういちど みようね。",
    th: "ไม่เป็นไร มาดูธงที่ถูกอีกครั้งนะ",
    id: "Tidak apa-apa. Ayo lihat lagi bendera yang benar.",
    ru: "Ничего страшного. Посмотрим правильный флаг ещё раз.",
    hi: "कोई बात नहीं। सही झंडा एक बार और देखें।",
    ar: "لا بأس. لننظر إلى العلم الصحيح مرة أخرى.",
  },
  diffElementary: {
    ko: "초급", en: "Easy", vi: "Dễ", zh: "初级", fil: "Madali", ja: "しょきゅう",
    th: "ง่าย", id: "Mudah", ru: "Лёгкий", hi: "आसान", ar: "سهل",
  },
  diffMiddle: {
    ko: "중급", en: "Medium", vi: "Vừa", zh: "中级", fil: "Katamtaman", ja: "ちゅうきゅう",
    th: "ปานกลาง", id: "Sedang", ru: "Средний", hi: "मध्यम", ar: "متوسط",
  },
  diffHigh: {
    ko: "고급", en: "Hard", vi: "Khó", zh: "高级", fil: "Mahirap", ja: "じょうきゅう",
    th: "ยาก", id: "Sulit", ru: "Сложный", hi: "कठिन", ar: "صعب",
  },
  subEasy: {
    ko: "쉬운 나라", en: "Easy countries", vi: "Nước dễ", zh: "简单的国家", fil: "Madaling bansa",
    ja: "やさしいくに", th: "ประเทศง่าย", id: "Negara mudah", ru: "Простые страны", hi: "आसान देश", ar: "دول سهلة",
  },
  subMid: {
    ko: "조금 어려움", en: "A bit harder", vi: "Hơi khó", zh: "稍难", fil: "Medyo mahirap",
    ja: "すこしむずかしい", th: "ยากขึ้น", id: "Agak sulit", ru: "Посложнее", hi: "थोड़ा कठिन", ar: "أصعب قليلًا",
  },
  subHard: {
    ko: "도전!", en: "Challenge!", vi: "Thử thách!", zh: "挑战!", fil: "Hamon!",
    ja: "ちょうせん!", th: "ท้าทาย!", id: "Tantangan!", ru: "Вызов!", hi: "चुनौती!", ar: "تحدٍّ!",
  },
};

// Real flag image via flagcdn (open, CC-licensed). Provide 2x for sharp displays.
function flagUrl(code: string, size: "w320" | "w640" = "w640"): string {
  return `https://flagcdn.com/${size}/${code.toLowerCase()}.png`;
}

interface DifficultyMeta {
  key: CountryDifficulty;
  labelMap: LangMap;
  subMap: LangMap;
  tint: string;
  emoji: string;
}

// 색으로만 난이도를 구분하지 않는다 — 이모지 + 글자 라벨이 1순위, 색은 보조.
const DIFFICULTIES: DifficultyMeta[] = [
  { key: "elementary", labelMap: CG.diffElementary, subMap: CG.subEasy, tint: "var(--ux-hint-mint)",     emoji: "🌱" },
  { key: "middle",     labelMap: CG.diffMiddle,     subMap: CG.subMid,  tint: "var(--ux-hint-apricot)",  emoji: "🌻" },
  { key: "high",       labelMap: CG.diffHigh,       subMap: CG.subHard, tint: "var(--ux-hint-lavender)", emoji: "🔥" },
];

export default function CountryGuess({ langA, langB }: { langA: string; langB: string }) {
  const [difficulty, setDifficulty] = useState<CountryDifficulty | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  // Used to force-regenerate rounds when restarting with the same difficulty.
  const [seed, setSeed] = useState(0);

  /** 예약된 타이머 전부 — unmount·재시작 때 한 곳에서 정리한다. */
  const timersRef = useRef<number[]>([]);
  const aliveRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimers();
      stopAudio();
    };
  }, [clearTimers, stopAudio]);

  const pool = useMemo(
    () => (difficulty ? COUNTRIES.filter((c) => c.difficulty === difficulty) : []),
    [difficulty]
  );

  const rounds = useMemo(() => {
    if (!pool.length) return [];
    return pickN(pool, 8).map((ans) => {
      const others = pool.filter((c) => c.code !== ans.code);
      const choices = pickN(others, 3).concat([ans]);
      choices.sort(() => Math.random() - 0.5);
      return { answer: ans, choices };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, seed]);

  function resetToDifficultyPick() {
    clearTimers();
    stopAudio();
    setDifficulty(null);
    setRound(0);
    setScore(0);
    setSelected(null);
  }

  function restartSame() {
    clearTimers();
    stopAudio();
    setRound(0);
    setScore(0);
    setSelected(null);
    setSeed((s) => s + 1);
  }

  function handlePick(code: string) {
    if (selected) return;
    setSelected(code);
    const cur = rounds[round];
    if (cur && code === cur.answer.code) setScore((s) => s + 1);
    later(() => {
      setSelected(null);
      setRound((r) => r + 1);
    }, 1800);
  }

  const playTts = useCallback((text: string, lang: string) => {
    stopAudio();
    const a = new Audio(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`);
    audioRef.current = a;
    a.play().catch(() => { /* 소리가 없어도 글자로 계속 풀 수 있다 */ });
  }, [stopAudio]);

  // --- Difficulty picker screen ---
  if (!difficulty) {
    const counts: Record<CountryDifficulty, number> = {
      elementary: COUNTRIES.filter((c) => c.difficulty === "elementary").length,
      middle:     COUNTRIES.filter((c) => c.difficulty === "middle").length,
      high:       COUNTRIES.filter((c) => c.difficulty === "high").length,
    };

    return (
      <div data-ux-root className="cg-root">
        <ScopedStyle css={CG_CSS} />
        <div className="cg-head">
          <BeeMascot size={96} mood="cheer" />
          <h1 data-ux-role="title">{gt(CG.pickDiff, langA)}</h1>
          <p data-ux-role="secondary">{COUNTRIES.length} {gt(CG.ofPick, langA)}</p>
        </div>

        <div className="cg-diffgrid">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.key}
              data-ux-role="control"
              className="cg-diff"
              style={{ background: d.tint }}
              onClick={() => setDifficulty(d.key)}
            >
              <span className="cg-diffemoji" aria-hidden>{d.emoji}</span>
              <span className="cg-difftext">
                <span data-ux-role="label">{gt(d.labelMap, langA)}</span>
                <span data-ux-role="secondary">
                  {gt(d.subMap, langA)} · {counts[d.key]} {gt(CG.countriesUnit, langA)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const cur = rounds[round];
  const done = round >= rounds.length;

  if (done) {
    return (
      <div data-ux-root className="cg-root cg-center">
        <ScopedStyle css={CG_CSS} />
        <BeeMascot size={120} mood="cheer" />
        <h1 data-ux-role="title">🎉 {gt(UI.score, langA)} {score} / {rounds.length}</h1>
        <p data-ux-role="body">{gt(CG.goodJob, langA)}</p>
        <div className="cg-endrow">
          <button data-ux-role="action" className="cg-primary" onClick={restartSame}>
            🔁 {plain(UI.playAgain, langA)}
          </button>
          <button data-ux-role="control" className="cg-secondary" onClick={resetToDifficultyPick}>
            🎚️ {plain(CG.changeDiff, langA)}
          </button>
        </div>
      </div>
    );
  }

  if (!cur) {
    // Safety guard (pool unexpectedly empty).
    return (
      <div data-ux-root className="cg-root cg-center">
        <ScopedStyle css={CG_CSS} />
        <p data-ux-role="body">{gt(CG.noData, langA)}</p>
      </div>
    );
  }

  const wrongPick = selected !== null && selected !== cur.answer.code;

  return (
    <div data-ux-root className="cg-root">
      <ScopedStyle css={CG_CSS} />
      <ProgressBar value={round} max={rounds.length} score={score} />

      <div className="cg-play">
        <div className="cg-flagcard">
          <img
            className="cg-flag"
            src={flagUrl(cur.answer.code, "w640")}
            srcSet={`${flagUrl(cur.answer.code, "w320")} 1x, ${flagUrl(cur.answer.code, "w640")} 2x`}
            alt=""
            aria-hidden="true"
          />
          <p data-ux-role="body-emphasis">{gt(CG.whichCountry, langA)}</p>
        </div>

        <div className="cg-answers">
          <div className="cg-choices">
            {cur.choices.map((c) => {
              const picked = selected === c.code;
              const correct = selected !== null && c.code === cur.answer.code;
              return (
                <button
                  key={c.code}
                  data-ux-role="control"
                  className="cg-choice"
                  data-state={correct ? "correct" : picked ? "picked" : undefined}
                  aria-disabled={selected !== null}
                  onClick={() => handlePick(c.code)}
                >
                  <span data-ux-role="label"><GameText map={c.names} lang={langA} /></span>
                  <span data-ux-role="secondary"><GameText map={c.names} lang={langB} /></span>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="cg-reveal" role="status">
              {wrongPick && <p data-ux-role="body">🌱 {gt(CG.lookAgain, langA)}</p>}
              <img
                className="cg-revealflag"
                src={flagUrl(cur.answer.code, "w320")}
                alt=""
                aria-hidden="true"
              />
              <div className="cg-listenrow">
                <button data-ux-role="control" className="cg-listen" onClick={() => playTts(tr(cur.answer.names, langA), langA)}>
                  🔊 <GameText map={cur.answer.names} lang={langA} />
                </button>
                <button data-ux-role="control" className="cg-listen" onClick={() => playTts(tr(cur.answer.names, langB), langB)}>
                  🔊 <GameText map={cur.answer.names} lang={langB} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, score }: { value: number; max: number; score: number }) {
  return (
    <div className="cg-progress">
      <ScopedStyle css={PROGRESS_CSS} />
      <div className="cg-progresstop">
        <span data-ux-role="secondary">{Math.min(value + 1, max)} / {max}</span>
        <span data-ux-role="secondary" className="cg-star">⭐ {score}</span>
      </div>
      <div className="cg-track">
        <div className="cg-fill" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const PROGRESS_CSS = `
.cg-progress{ margin-bottom: var(--ux-space-4); }
.cg-progresstop{ display: flex; justify-content: space-between; gap: var(--ux-space-2); margin-bottom: var(--ux-space-1); }
.cg-star{ color: var(--ux-primary-ink); font-weight: 800; }
.cg-track{ height: 10px; background: var(--ux-surface-sunk); border-radius: var(--ux-radius-pill); overflow: hidden; }
.cg-fill{ height: 100%; background: var(--ux-primary-fill); border-right: 2px solid var(--ux-primary-border); transition: width var(--ux-motion-celebrate) var(--ux-motion-ease); }
`;

const CG_CSS = `
.cg-root{
  color: var(--ux-ink);
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-8);
  width: 100%; max-width: 1200px; margin: 0 auto; box-sizing: border-box;
}
.cg-center{ display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center; padding-top: var(--ux-space-8); }
.cg-head{ display: grid; justify-items: center; gap: var(--ux-space-2); text-align: center; margin-bottom: var(--ux-space-6); }
.cg-head p, .cg-center p{ margin: 0; }

/* 난이도는 좁은 화면에서 1열, 넓어지면 3열 — 세로로 늘린 휴대폰이 되지 않게. */
.cg-diffgrid{ display: grid; gap: var(--ux-space-3); grid-template-columns: 1fr; }
@media (min-width: 768px){ .cg-diffgrid{ grid-template-columns: repeat(3, minmax(0, 1fr)); } }

.cg-diff[data-ux-role="control"]{
  display: flex; align-items: center; gap: var(--ux-space-4);
  border: 3px solid var(--ux-primary-border);
  color: var(--ux-ink); text-align: left;
  font-family: inherit; padding: var(--ux-space-4);
}
.cg-diffemoji{ font-size: var(--ux-font-title); line-height: 1; flex-shrink: 0; }
.cg-difftext{ display: grid; gap: var(--ux-space-1); min-width: 0; }
.cg-difftext [data-ux-role="label"]{ font-weight: 900; }

.cg-endrow{ display: flex; gap: var(--ux-space-3); flex-wrap: wrap; justify-content: center; margin-top: var(--ux-space-3); }
.cg-primary[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}
.cg-secondary[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}

/* 넓은 화면: 국기와 보기를 나란히 — 스크롤 없이 한눈에 본다. */
.cg-play{ display: grid; gap: var(--ux-space-4); }
@media (min-width: 900px){ .cg-play{ grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }

.cg-flagcard{
  background: var(--ux-surface); border-radius: var(--ux-radius-panel);
  border: 2px solid var(--ux-primary-border);
  padding: var(--ux-space-6) var(--ux-space-4);
  display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center;
}
.cg-flagcard p{ margin: 0; }
.cg-flag{ width: min(100%, 420px); height: auto; border-radius: 10px; display: block; box-shadow: 0 4px 16px rgba(41,37,31,.25); }

.cg-answers{ display: grid; gap: var(--ux-space-4); align-content: start; }
.cg-choices{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ux-space-3); }
@media (min-width: 1200px){ .cg-choices{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.cg-choice[data-ux-role="control"]{
  display: grid; gap: var(--ux-space-1); justify-items: center; text-align: center;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 700;
  transition: background var(--ux-motion-state) var(--ux-motion-ease), border-color var(--ux-motion-state) var(--ux-motion-ease);
}
.cg-choice[data-state="correct"]{ border: 3px solid var(--ux-success); background: var(--ux-hint-mint); }
.cg-choice[data-state="picked"]{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }
.cg-choice[aria-disabled="true"]{ cursor: default; }

.cg-reveal{
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-4); display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center;
}
.cg-reveal p{ margin: 0; }
.cg-revealflag{ width: 140px; max-width: 60%; height: auto; border-radius: 6px; }
.cg-listenrow{ display: flex; gap: var(--ux-space-3); flex-wrap: wrap; justify-content: center; }
.cg-listen[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}
`;

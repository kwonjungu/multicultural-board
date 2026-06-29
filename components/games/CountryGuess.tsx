"use client";

import { useMemo, useState } from "react";
import { COUNTRIES, pickN, tr, type CountryDifficulty } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";
import { gt, UI, type LangMap } from "./uiText";

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
    th: "ธงนี้ของประเทศใด?", id: "Bendera negara mana?", ru: "Чей это флаг?",
    hi: "यह झंडा किस देश का?", ar: "علم أي دولة؟",
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
  color: string;
  emoji: string;
}

const DIFFICULTIES: DifficultyMeta[] = [
  { key: "elementary", labelMap: CG.diffElementary, subMap: CG.subEasy, color: "#10B981", emoji: "🌱" },
  { key: "middle",     labelMap: CG.diffMiddle,     subMap: CG.subMid,  color: "#F59E0B", emoji: "🌻" },
  { key: "high",       labelMap: CG.diffHigh,       subMap: CG.subHard, color: "#EF4444", emoji: "🔥" },
];

export default function CountryGuess({ langA, langB }: { langA: string; langB: string }) {
  const [difficulty, setDifficulty] = useState<CountryDifficulty | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  // Used to force-regenerate rounds when restarting with the same difficulty.
  const [seed, setSeed] = useState(0);

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
    setDifficulty(null);
    setRound(0);
    setScore(0);
    setSelected(null);
  }

  function restartSame() {
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
    setTimeout(() => {
      setSelected(null);
      setRound((r) => r + 1);
    }, 1400);
  }

  function playTts(text: string, lang: string) {
    const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`;
    const a = new Audio(url);
    a.play().catch(() => {});
  }

  // --- Difficulty picker screen ---
  if (!difficulty) {
    const counts: Record<CountryDifficulty, number> = {
      elementary: COUNTRIES.filter((c) => c.difficulty === "elementary").length,
      middle:     COUNTRIES.filter((c) => c.difficulty === "middle").length,
      high:       COUNTRIES.filter((c) => c.difficulty === "high").length,
    };

    return (
      <div style={{ padding: "24px 16px 40px", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <BeeMascot size={96} mood="cheer" />
          <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginTop: 10 }}>
            {gt(CG.pickDiff, langA)}
          </div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
            {COUNTRIES.length} {gt(CG.ofPick, langA)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.key}
              onClick={() => setDifficulty(d.key)}
              style={{
                width: "100%",
                padding: "22px 20px",
                borderRadius: 22,
                border: `3px solid ${d.color}`,
                background: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 16,
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                transition: "transform 0.15s",
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div
                style={{
                  width: 58, height: 58, borderRadius: 16,
                  background: d.color, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30, flexShrink: 0,
                }}
              >
                {d.emoji}
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: d.color }}>
                  {gt(d.labelMap, langA)}
                </div>
                <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 700, marginTop: 2 }}>
                  {gt(d.subMap, langA)} · {counts[d.key]} {gt(CG.countriesUnit, langA)}
                </div>
              </div>
              <div style={{ fontSize: 22, color: d.color, fontWeight: 900 }}>›</div>
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
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="cheer" />
        <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", margin: "18px 0 6px" }}>
          🎉 {gt(UI.score, langA)} {score} / {rounds.length}
        </div>
        <div style={{ color: "#6B7280", fontSize: 13, marginBottom: 20 }}>
          {gt(CG.goodJob, langA)}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={restartSame}
            style={{
              background: "#F59E0B", color: "#fff",
              border: "none", borderRadius: 14,
              padding: "12px 20px", fontSize: 15, fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(245,158,11,0.35)",
            }}
          >
            🔁 {gt(UI.playAgain, langA)}
          </button>
          <button
            onClick={resetToDifficultyPick}
            style={{
              background: "#fff", color: "#F59E0B",
              border: "2px solid #F59E0B", borderRadius: 14,
              padding: "12px 20px", fontSize: 15, fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🎚️ {gt(CG.changeDiff, langA)}
          </button>
        </div>
      </div>
    );
  }

  if (!cur) {
    // Safety guard (pool unexpectedly empty).
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>
        {gt(CG.noData, langA)}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 40px", maxWidth: 640, margin: "0 auto" }}>
      <ProgressBar value={round} max={rounds.length} score={score} />

      <div style={{
        textAlign: "center",
        background: "linear-gradient(180deg,#FEF3C7,#FFFFFF)",
        padding: "34px 20px 26px", borderRadius: 22,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)", marginBottom: 18,
      }}>
        <img
          src={flagUrl(cur.answer.code, "w640")}
          srcSet={`${flagUrl(cur.answer.code, "w320")} 1x, ${flagUrl(cur.answer.code, "w640")} 2x`}
          alt=""
          aria-hidden="true"
          style={{
            width: 220, maxWidth: "70vw", height: "auto",
            borderRadius: 10, display: "block", margin: "0 auto",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}
        />
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 12, fontWeight: 700 }}>
          {gt(CG.whichCountry, langA)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {cur.choices.map((c) => {
          const picked = selected === c.code;
          const correct = selected && c.code === cur.answer.code;
          const bg = !selected ? "#fff"
            : correct ? "#DCFCE7"
            : picked ? "#FEE2E2"
            : "#fff";
          const border = correct ? "#16A34A" : picked ? "#DC2626" : "#E5E7EB";
          return (
            <button
              key={c.code}
              onClick={() => handlePick(c.code)}
              disabled={!!selected}
              style={{
                padding: "16px 12px", borderRadius: 14,
                border: `2px solid ${border}`, background: bg,
                cursor: selected ? "default" : "pointer",
                fontSize: 15, fontWeight: 700, color: "#111827",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800 }}>{tr(c.names, langA)}</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{tr(c.names, langB)}</div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div style={{
          marginTop: 18, padding: "14px 16px",
          background: "#F0F9FF", borderRadius: 14, textAlign: "center",
        }}>
          <img
            src={flagUrl(cur.answer.code, "w320")}
            alt=""
            aria-hidden="true"
            style={{
              width: 90, height: "auto",
              borderRadius: 6, display: "block", margin: "0 auto 8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          />
          <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <button
              onClick={() => playTts(tr(cur.answer.names, langA), langA)}
              style={pillButton}
            >🔊 {tr(cur.answer.names, langA)}</button>
            <button
              onClick={() => playTts(tr(cur.answer.names, langB), langB)}
              style={pillButton}
            >🔊 {tr(cur.answer.names, langB)}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const pillButton: React.CSSProperties = {
  background: "#fff", border: "2px solid #F59E0B", color: "#F59E0B",
  padding: "8px 14px", borderRadius: 99, cursor: "pointer",
  fontSize: 13, fontWeight: 800,
};

export function ProgressBar({ value, max, score }: { value: number; max: number; score: number }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
          {Math.min(value + 1, max)} / {max}
        </span>
        <span style={{ fontSize: 12, color: "#F59E0B", fontWeight: 800 }}>⭐ {score}</span>
      </div>
      <div style={{ height: 6, background: "#E5E7EB", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${(value / max) * 100}%`,
          background: "linear-gradient(90deg,#FBBF24,#F59E0B)",
          transition: "width 0.4s",
        }} />
      </div>
    </div>
  );
}

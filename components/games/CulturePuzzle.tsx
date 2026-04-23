"use client";

import { useMemo, useState } from "react";
import { LANGUAGES } from "@/lib/constants";

type Topic = {
  key: string;
  src: string;
  aspect?: string; // "3/2", "1/1" — container + background 정합
  caption: Record<string, string>;
};

const TOPICS: Topic[] = [
  {
    key: "hanbok",
    src: "/game-assets/puzzle/hanbok.png",
    caption: { ko: "한복 (한국의 전통 옷)", en: "Hanbok — traditional Korean dress", vi: "Hanbok — trang phục truyền thống Hàn Quốc" },
  },
  {
    key: "pho",
    src: "/game-assets/puzzle/pho.png",
    caption: { ko: "쌀국수 (베트남의 전통 음식)", en: "Pho — Vietnamese noodle soup", vi: "Phở — món ăn truyền thống Việt Nam" },
  },
  {
    key: "yurt",
    src: "/game-assets/puzzle/yurt.png",
    caption: { ko: "게르 (몽골의 전통 집)", en: "Ger — Mongolian yurt", vi: "Ger — nhà truyền thống của người Mông Cổ" },
  },
  {
    key: "classroom",
    src: "/game-assets/puzzle/classroom.png",
    aspect: "3/2",
    caption: { ko: "친구야, 같이 놀자!", en: "Hey friend, let’s play together!", vi: "Bạn ơi, cùng chơi nào!" },
  },
  {
    key: "intro",
    src: "/icons/intro.png",
    caption: { ko: "반가워, 내 소개를 할게!", en: "Nice to meet you — let me introduce myself!", vi: "Rất vui được gặp bạn — mình tự giới thiệu nhé!" },
  },
  {
    key: "angry",
    src: "/vocab-images/sentences/angry_2.png",
    caption: { ko: "속상할 땐 마음을 말로 표현해요", en: "When upset, use your words to express feelings", vi: "Khi buồn bực, hãy nói ra cảm xúc" },
  },
  {
    key: "know",
    src: "/vocab-images/sentences/know_2.png",
    caption: { ko: "비밀 이야기 — 친구와 소곤소곤", en: "A little secret — whisper to your friend", vi: "Chuyện nhỏ — thì thầm cùng bạn" },
  },
  {
    key: "bee",
    src: "/mascot/bee-loading.png",
    caption: { ko: "꿀벌이가 응원해요!", en: "Little bee cheers you on!", vi: "Chú ong nhỏ cổ vũ bạn!" },
  },
  {
    key: "korea",
    src: "/landmarks/korea.png",
    caption: { ko: "경복궁 — 한국의 옛 궁궐", en: "Gyeongbokgung — ancient Korean palace", vi: "Gyeongbokgung — cung điện cổ của Hàn Quốc" },
  },
  {
    key: "school",
    src: "/game-assets/draw/school.png",
    caption: { ko: "학교 — 친구들을 만나는 곳", en: "School — where we meet friends", vi: "Trường học — nơi gặp bạn bè" },
  },
];

type Cell = { correctIdx: number; currentIdx: number };

const GRID_SIZE = 3;

function makeShuffledCells(): Cell[] {
  const n = GRID_SIZE * GRID_SIZE;
  const order = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
  // solved 상태로 시작하지 않도록 확인
  if (order.every((v, i) => v === i)) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order.map((currentIdx, i) => ({ correctIdx: i, currentIdx }));
}

export default function CulturePuzzle({ langA, langB }: { langA: string; langB: string }) {
  // 한 세션에서 모든 주제를 순서 섞어 진행
  const ordered = useMemo(() => [...TOPICS].sort(() => Math.random() - 0.5), []);
  const [stageIdx, setStageIdx] = useState(0);
  const [cells, setCells] = useState<Cell[]>(makeShuffledCells);
  const [selected, setSelected] = useState<number | null>(null);

  const allDone = stageIdx >= ordered.length;
  const topic = allDone ? null : ordered[stageIdx];
  const solved = !allDone && cells.every((c) => c.correctIdx === c.currentIdx);

  function handleClick(i: number) {
    if (solved) return;
    if (selected === null) { setSelected(i); return; }
    if (selected === i) { setSelected(null); return; }
    setCells((prev) => {
      const next = prev.map((c) => ({ ...c }));
      [next[selected!].currentIdx, next[i].currentIdx] = [next[i].currentIdx, next[selected!].currentIdx];
      return next;
    });
    setSelected(null);
  }

  function handleNext() {
    setStageIdx((idx) => idx + 1);
    setCells(makeShuffledCells());
    setSelected(null);
  }

  function handleRestart() {
    setStageIdx(0);
    setCells(makeShuffledCells());
    setSelected(null);
  }

  const getCaption = (t: Topic, lang: string) => t.caption[lang] || t.caption.en;

  if (allDone) {
    return (
      <div style={{ padding: "40px 16px", maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🏆</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#16A34A", marginBottom: 6 }}>
          전체 완료!
        </div>
        <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 22 }}>
          {ordered.length}개 퍼즐을 모두 맞혔어요. 👏
        </div>
        <button
          onClick={handleRestart}
          style={{
            background: "#F59E0B", color: "white", border: "none",
            borderRadius: 999, padding: "12px 28px",
            fontSize: 15, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(245,158,11,0.35)",
          }}
        >
          ↻ 다시 시작
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 700 }}>
          🧩 조각을 맞춰보세요
        </div>
        <div style={{ fontSize: 13, color: "#F59E0B", fontWeight: 800 }}>
          {stageIdx + 1} / {ordered.length}
        </div>
      </div>

      {/* 진행 도트 */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {ordered.map((_, i) => (
          <span
            key={i}
            style={{
              width: i === stageIdx ? 18 : 8, height: 8,
              borderRadius: 999,
              background: i < stageIdx ? "#16A34A" : i === stageIdx ? "#F59E0B" : "#E5E7EB",
              transition: "width 0.25s, background 0.25s",
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "relative", aspectRatio: topic!.aspect || "1 / 1",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          background: "#f3f4f6",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
            gap: solved ? 0 : 2,
            width: "100%", height: "100%",
            transition: "gap 0.4s",
          }}
        >
          {cells.map((c, i) => {
            const row = Math.floor(c.currentIdx / GRID_SIZE);
            const col = c.currentIdx % GRID_SIZE;
            return (
              <button
                key={i}
                onClick={() => handleClick(i)}
                aria-label={`조각 ${i + 1}`}
                style={{
                  background: `url(${topic!.src})`,
                  backgroundSize: `${GRID_SIZE * 100}% ${GRID_SIZE * 100}%`,
                  backgroundPosition: `${(col / (GRID_SIZE - 1)) * 100}% ${(row / (GRID_SIZE - 1)) * 100}%`,
                  backgroundRepeat: "no-repeat",
                  border: selected === i ? "3px solid #F59E0B" : "none",
                  outline: "none",
                  cursor: solved ? "default" : "pointer",
                  padding: 0,
                  transition: "border-color 0.15s",
                }}
              />
            );
          })}
        </div>
      </div>

      {solved && (
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#16A34A", marginBottom: 10 }}>
            🎉 완성!
          </div>
          <div
            style={{
              background: "linear-gradient(180deg,#FEF3C7,#fff)",
              padding: 16, borderRadius: 14,
              boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
              {LANGUAGES[langA]?.flag} {getCaption(topic!, langA)}
            </div>
            <div style={{ fontSize: 13, color: "#6B7280" }}>
              {LANGUAGES[langB]?.flag} {getCaption(topic!, langB)}
            </div>
          </div>
          <button
            onClick={handleNext}
            style={{
              background: "#F59E0B", color: "white", border: "none",
              borderRadius: 999, padding: "12px 28px",
              fontSize: 15, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(245,158,11,0.35)",
            }}
          >
            {stageIdx + 1 < ordered.length ? "다음 퍼즐 →" : "🏆 마지막 결과 보기"}
          </button>
        </div>
      )}
    </div>
  );
}

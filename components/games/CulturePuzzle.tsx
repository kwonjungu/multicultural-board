"use client";

import { useMemo, useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import ScopedStyle from "../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../ui/game/GameHeader";

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
    key: "aodai",
    src: "/game-assets/puzzle/aodai.png",
    caption: { ko: "아오자이 (베트남의 전통 옷)", en: "Ao dai — traditional Vietnamese dress", vi: "Áo dài — trang phục truyền thống Việt Nam" },
  },
  {
    key: "songkran",
    src: "/game-assets/puzzle/songkran.png",
    caption: { ko: "송끄란 (태국의 물 축제)", en: "Songkran — Thai water festival", vi: "Songkran — lễ hội té nước Thái Lan" },
  },
  {
    key: "naadam",
    src: "/game-assets/puzzle/naadam.png",
    caption: { ko: "나담 축제 (몽골의 말타기)", en: "Naadam — Mongolian horse riding festival", vi: "Naadam — lễ hội cưỡi ngựa Mông Cổ" },
  },
  {
    key: "jeepney",
    src: "/game-assets/puzzle/jeepney.png",
    caption: { ko: "지프니 (필리핀의 알록달록 버스)", en: "Jeepney — colorful Filipino bus", vi: "Jeepney — xe buýt sặc sỡ của Philippines" },
  },
  {
    key: "taekwondo",
    src: "/game-assets/puzzle/taekwondo.png",
    caption: { ko: "태권도 (한국의 전통 무예)", en: "Taekwondo — Korean martial art", vi: "Taekwondo — võ thuật truyền thống Hàn Quốc" },
  },
  {
    key: "korea",
    src: "/landmarks/korea.png",
    caption: { ko: "경복궁 — 한국의 옛 궁궐", en: "Gyeongbokgung — ancient Korean palace", vi: "Gyeongbokgung — cung điện cổ của Hàn Quốc" },
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
      <div data-ux-root className="cp-root cp-center">
        <ScopedStyle css={CP_CSS} />
        <div className="cp-bigicon" aria-hidden>🏆</div>
        <h1 data-ux-role="title">전체 완료!</h1>
        <p data-ux-role="body">{ordered.length}개 퍼즐을 모두 맞혔어요. 👏</p>
        <button data-ux-role="action" className="cp-primary" onClick={handleRestart}>
          ↻ 다시 시작
        </button>
      </div>
    );
  }

  return (
    <div data-ux-root className="cp-root">
      <ScopedStyle css={CP_CSS} />

      {/* U01 공용 헤더 — 예전에는 판 컬럼 안에 '🧩 조각을 맞춰보세요 … n/N' 한 줄이
          있어 다른 게임과 위치·크기가 달랐다. 뒤로는 첫 퍼즐부터 다시. */}
      <GameHeader
        gameId="puzzle"
        introOpen
        title="문화 퍼즐"
        icon="🧩"
        onBack={handleRestart}
        backLabel="처음"
        progress={{ value: stageIdx, max: ordered.length }}
        status={
          <>
            <GameStat icon="📍" label="퍼즐" value={`${stageIdx + 1} / ${ordered.length}`} tone="key" />
            <GameStat icon="✅" label="맞은 조각" value={`${cells.filter((c) => c.correctIdx === c.currentIdx).length} / ${cells.length}`} />
          </>
        }
      />

      <div className="cp-play">
        <div className="cp-boardcol">
          {/* 진행 도트 */}
          <div className="cp-dots" aria-hidden>
            {ordered.map((_, i) => (
              <span
                key={i}
                className="cp-dot"
                data-state={i < stageIdx ? "done" : i === stageIdx ? "now" : "todo"}
              />
            ))}
          </div>

          <div className="cp-frame" style={{ aspectRatio: topic!.aspect || "1 / 1" }}>
            <div className="cp-grid" data-solved={solved ? "" : undefined}>
              {cells.map((c, i) => {
                const row = Math.floor(c.currentIdx / GRID_SIZE);
                const col = c.currentIdx % GRID_SIZE;
                return (
                  <button
                    key={i}
                    data-ux-role="control"
                    className="cp-cell"
                    data-picked={selected === i ? "" : undefined}
                    onClick={() => handleClick(i)}
                    aria-label={`조각 ${i + 1}`}
                    aria-pressed={selected === i}
                    style={{
                      backgroundImage: `url(${topic!.src})`,
                      backgroundSize: `${GRID_SIZE * 100}% ${GRID_SIZE * 100}%`,
                      backgroundPosition: `${(col / (GRID_SIZE - 1)) * 100}% ${(row / (GRID_SIZE - 1)) * 100}%`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="cp-side">
          {solved ? (
            <div className="cp-done" role="status">
              <p data-ux-role="body-emphasis" className="cp-doneline">🎉 완성!</p>
              <div className="cp-caption">
                <p data-ux-role="body" data-ux-reading>
                  {LANGUAGES[langA]?.flag} {getCaption(topic!, langA)}
                </p>
                <p data-ux-role="secondary" data-ux-reading>
                  {LANGUAGES[langB]?.flag} {getCaption(topic!, langB)}
                </p>
              </div>
              <button data-ux-role="action" className="cp-primary" onClick={handleNext}>
                {stageIdx + 1 < ordered.length ? "다음 퍼즐 →" : "🏆 마지막 결과 보기"}
              </button>
            </div>
          ) : (
            <p data-ux-role="body" data-ux-reading className="cp-guide">
              조각 하나를 누르고, 바꾸고 싶은 다른 조각을 누르면 자리가 바뀌어요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const CP_CSS = `
.cp-root{
  color: var(--ux-ink);
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-8);
  width: 100%; max-width: 1200px; margin: 0 auto; box-sizing: border-box;
  min-height: 100%;
  background: linear-gradient(rgba(255,249,237,.88), rgba(253,243,224,.88)), url('/backgrounds/world-landmarks.jpg') center top / cover no-repeat;
}
.cp-center{ display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center; padding-top: var(--ux-space-8); }
.cp-center p{ margin: 0; }
.cp-bigicon{ font-size: clamp(3rem, 12vw, 5rem); line-height: 1; }

/* 넓은 화면에서는 판을 키우고 안내/완성 카드를 옆에 둔다. */
.cp-play{ display: grid; gap: var(--ux-space-4); }
@media (min-width: 900px){ .cp-play{ grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); align-items: start; } }

.cp-boardcol{ display: grid; gap: var(--ux-space-2); min-width: 0; }
/* U01: .cp-top(안내+진행 수)은 공용 GameHeader 로 대체됐다. */
.cp-dots{ display: flex; justify-content: center; gap: var(--ux-space-1); flex-wrap: wrap; }
.cp-dot{ width: 10px; height: 10px; border-radius: var(--ux-radius-pill); background: var(--ux-surface-sunk); border: 1px solid var(--ux-ink-soft); }
.cp-dot[data-state="done"]{ background: var(--ux-success); border-color: var(--ux-success); }
.cp-dot[data-state="now"]{ width: 24px; background: var(--ux-primary-fill); border-color: var(--ux-primary-border); }

.cp-frame{
  position: relative; width: 100%;
  border-radius: var(--ux-radius-surface); overflow: hidden;
  background: var(--ux-surface-sunk);
  box-shadow: 0 8px 24px rgba(41,37,31,.12);
}
.cp-grid{
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 2px; width: 100%; height: 100%;
  transition: gap var(--ux-motion-celebrate) var(--ux-motion-ease);
}
.cp-grid[data-solved]{ gap: 0; }
/* 전역 [data-ux-role="control"] 규칙이 뒤에 주입되므로 속성까지 걸어 덮는다. */
.cp-cell[data-ux-role="control"]{
  padding: 0; border: none; border-radius: 0; min-width: 0; min-height: 0;
  background-color: var(--ux-surface-sunk);
  background-repeat: no-repeat;
  outline: none; font-family: inherit;
}
.cp-cell[data-picked]{ box-shadow: inset 0 0 0 4px var(--ux-selected-border); }

.cp-side{ display: grid; gap: var(--ux-space-3); align-content: start; }
.cp-guide{ margin: 0; padding: var(--ux-space-4); background: var(--ux-surface); border-radius: var(--ux-radius-surface); border: 2px solid var(--ux-primary-border); }
.cp-done{ display: grid; gap: var(--ux-space-3); justify-items: center; text-align: center; }
.cp-doneline{ margin: 0; color: var(--ux-success); font-weight: 900; }
.cp-caption{
  width: 100%; display: grid; gap: var(--ux-space-1);
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-4); text-align: left;
}
.cp-caption p{ margin: 0; }
.cp-primary[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}
`;

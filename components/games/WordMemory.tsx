"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { initialMemoryState, memoryReducer } from "@/lib/wordMemoryState";
import { VOCAB, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../ui/game/GameHeader";
import VocabImage from "./VocabImage";
import { gt, UI, type LangMap } from "./uiText";

const WM: Record<string, LangMap> = {
  allMatched: {
    ko: "모두 맞췄어요!", en: "All matched!", vi: "Khớp hết rồi!", zh: "全部配对成功!",
    fil: "Tama lahat!", ja: "ぜんぶそろった!", th: "จับคู่ครบแล้ว!", id: "Semua cocok!",
    ru: "Все пары найдены!", hi: "सब मिल गए!", ar: "تطابق الكل!",
  },
  tries: {
    ko: "시도", en: "Tries", vi: "Lượt", zh: "次数", fil: "Subok",
    ja: "かいすう", th: "ครั้ง", id: "Coba", ru: "Попытки", hi: "कोशिश", ar: "محاولات",
  },
  matchedPairs: {
    ko: "맞춘 쌍", en: "Matched", vi: "Cặp đúng", zh: "配对", fil: "Tugma",
    ja: "そろったペア", th: "คู่ที่ได้", id: "Pasangan", ru: "Пары", hi: "जोड़े", ar: "أزواج",
  },
  howMany: {
    ko: "카드 수를 골라요", en: "Choose how many cards", vi: "Chọn số thẻ",
    zh: "选择卡片数量", fil: "Pumili ng bilang ng kard", ja: "カードのかずをえらぼう",
    th: "เลือกจำนวนการ์ด", id: "Pilih jumlah kartu", ru: "Выбери число карточек",
    hi: "कितने कार्ड?", ar: "اختر عدد البطاقات",
  },
  pairs: {
    ko: "쌍", en: "pairs", vi: "cặp", zh: "对", fil: "pares", ja: "ペア",
    th: "คู่", id: "pasang", ru: "пар", hi: "जोड़े", ar: "أزواج",
  },
};

/** 4쌍(8장)은 저학년·짧은 시간용, 8쌍(16장)은 종전 기본값. */
const PAIR_OPTIONS = [4, 8] as const;
type PairCount = (typeof PAIR_OPTIONS)[number];

type Card = {
  id: string;
  pairKey: string;
  emoji: string;
  word: string;
  lang: string;
};

// 카드 뒷면 — 꿀벌 PNG 우선, 실패 시 이모지 폴백
function CardBack() {
  const [failed, setFailed] = useState(false);
  if (failed) return <span aria-hidden="true">🐝</span>;
  return (
    <img
      src="/spotit/bee.png"
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      draggable={false}
      style={{ width: 36, height: 36, objectFit: "contain" }}
    />
  );
}

export default function WordMemory({ langA, langB }: { langA: string; langB: string }) {
  const [pairCount, setPairCount] = useState<PairCount>(8);
  // U01: 시도 수·맞춘 짝은 라운드(자식) 안의 .wm-hud 에 있었다. 헤더 자리를 다른
  // 게임과 맞추려면 부모가 알아야 해서, 라운드가 값이 바뀔 때만 올려 준다.
  const [status, setStatus] = useState({ moves: 0, matched: 0 });
  return (
    <div data-ux-root className="wm-root">
      <ScopedStyle css={WM_CSS} />
      <GameHeader
        gameId="memory"
        introOpen
        title="기억 카드"
        icon="🎴"
        progress={{ value: status.matched, max: pairCount }}
        status={
          <>
            <GameStat icon="🔁" label={gt(WM.tries, langA)} value={status.moves} />
            <GameStat
              icon="✅"
              label={gt(WM.matchedPairs, langA)}
              value={`${status.matched} / ${pairCount}`}
              tone="key"
            />
          </>
        }
      />
      <div className="wm-sizebar">
        <span data-ux-role="label">{gt(WM.howMany, langA)}</span>
        <div className="wm-sizebtns">
          {PAIR_OPTIONS.map((n) => (
            <button
              key={n}
              data-ux-role="control"
              className="wm-size"
              aria-pressed={pairCount === n}
              onClick={() => setPairCount(n)}
            >{pairCount === n ? "✓ " : ""}{n} {gt(WM.pairs, langA)}</button>
          ))}
        </div>
      </div>
      {/* 쌍 수가 바뀌면 언어가 바뀔 때와 똑같이 라운드를 새로 마운트한다 —
          공개된 카드/시도 수가 다른 덱으로 넘어오지 않게 하는 유일한 경로. */}
      <MemoryRound
        key={JSON.stringify([langA, langB, pairCount])}
        langA={langA} langB={langB} pairCount={pairCount}
        onStatus={setStatus}
      />
    </div>
  );
}

function MemoryRound({ langA, langB, pairCount, onStatus }: {
  langA: string; langB: string; pairCount: PairCount;
  /** 헤더에 보여줄 값만 부모로 올린다. 게임 규칙은 여전히 이 안의 reducer 가 정한다. */
  onStatus: (s: { moves: number; matched: number }) => void;
}) {
  const [{ flipped, matched, moves }, dispatch] = useReducer(memoryReducer, undefined, initialMemoryState);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cards = useMemo<Card[]>(() => {
    const picked = pickN(VOCAB, pairCount);
    const cs: Card[] = [];
    picked.forEach((v) => {
      cs.push({ id: `${v.key}-a`, pairKey: v.key, emoji: v.emoji, word: tr(v.translations, langA), lang: langA });
      cs.push({ id: `${v.key}-b`, pairKey: v.key, emoji: v.emoji, word: tr(v.translations, langB), lang: langB });
    });
    return cs.sort(() => Math.random() - 0.5);
  }, [langA, langB, pairCount]);

  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped.map((id) => cards.find((c) => c.id === id));
    const timer = window.setTimeout(() => dispatch({ type: "settle", ids: flipped }),
      a && b && a.pairKey === b.pairKey ? 500 : 900);
    return () => window.clearTimeout(timer);
  }, [flipped, cards]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  // 헤더용 값 올리기. 값이 실제로 바뀔 때만 부른다 — onStatus 는 setState 라
  // 부모가 다시 그리고, 이 effect 가 다시 돌아도 값이 같으면 setState 가
  // 무시되므로 루프가 생기지 않는다.
  useEffect(() => {
    onStatus({ moves, matched: matched.length });
  }, [moves, matched.length, onStatus]);

  function playTts(text: string, lang: string) {
    const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`;
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => {});
  }

  function handleFlip(c: Card) {
    if (matched.includes(c.pairKey)) return;
    if (flipped.includes(c.id)) return;
    if (flipped.length >= 2) return;
    dispatch({ type: "flip", id: c.id, cards });
    playTts(c.word, c.lang);
  }

  const allMatched = matched.length === pairCount;

  if (allMatched) {
    return (
      <div className="wm-done">
        <BeeMascot size={120} mood="cheer" />
        <p data-ux-role="body-emphasis">🎉 {gt(WM.allMatched, langA)}</p>
        <p data-ux-role="body">{gt(WM.tries, langA)} {moves}</p>
      </div>
    );
  }

  return (
    <div className="wm-board">
      <div className="wm-grid" data-pairs={pairCount}>
        {cards.map((c) => {
          const isFlipped = flipped.includes(c.id) || matched.includes(c.pairKey);
          const isMatched = matched.includes(c.pairKey);
          return (
            <button
              key={c.id}
              data-ux-role="control"
              className="wm-card"
              data-state={isMatched ? "matched" : isFlipped ? "open" : "back"}
              onClick={() => handleFlip(c)}
              disabled={isMatched}
              lang={isFlipped ? c.lang : undefined}
            >
              {isFlipped ? (
                <span className="wm-face">
                  <VocabImage vocabKey={c.pairKey} emoji={c.emoji} size={36} />
                  {/* 긴 단어는 잘라내지 않고 줄을 늘린다 — 카드가 세로로 자란다. */}
                  <span className="wm-word">{c.word}</span>
                </span>
              ) : (
                <CardBack />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const WM_CSS = `
.wm-root{
  max-width: 520px; margin: 0 auto;
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-8);
  color: var(--ux-ink);
  display: grid; gap: var(--ux-space-4);
}
.wm-sizebar{
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: var(--ux-space-3);
}
.wm-sizebtns{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; }
.wm-size{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft);
  font-family: inherit; font-weight: 800;
}
.wm-size[aria-pressed="true"]{ border: 3px solid var(--ux-selected-border); }
.wm-board{ display: grid; gap: var(--ux-space-3); }
/* U01: .wm-hud(시도 수·맞춘 짝)는 공용 GameHeader 의 상태로 옮겼다. */
.wm-grid{ display: grid; gap: var(--ux-space-2); }
.wm-grid[data-pairs="4"]{ grid-template-columns: repeat(4, minmax(0, 1fr)); }
.wm-grid[data-pairs="8"]{ grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 360px){ .wm-grid{ grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.wm-card{
  /* 정사각 비율을 '최소'로만 쓴다. 긴 단어가 오면 높이가 늘어나야 글자가 안 잘린다. */
  min-height: max(var(--ux-control-min), 5.5rem);
  display: flex; align-items: center; justify-content: center;
  text-align: center;
  padding: var(--ux-space-2);
  border: 2px solid var(--ux-ink-soft);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  font-family: inherit; font-weight: 800;
  transition: background var(--ux-motion-state) var(--ux-motion-ease);
}
.wm-card[data-state="open"]{ background: var(--ux-surface-sunk); color: var(--ux-ink); }
.wm-card[data-state="matched"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 3px solid var(--ux-success); cursor: default;
}
.wm-face{ display: flex; flex-direction: column; align-items: center; gap: var(--ux-space-1); max-width: 100%; }
.wm-word{
  font-size: var(--ux-font-secondary);
  line-height: var(--ux-lh-reading);
  overflow-wrap: anywhere; word-break: normal; hyphens: auto;
  max-width: 100%;
}
.wm-done{
  display: grid; justify-items: center; gap: var(--ux-space-3);
  padding: var(--ux-space-8) var(--ux-space-4); text-align: center;
}
.wm-done p{ margin: 0; }
`;

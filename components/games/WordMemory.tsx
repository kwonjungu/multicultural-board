"use client";

import { useEffect, useMemo, useState } from "react";
import { VOCAB, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";
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
};

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
  const pairCount = 8; // 16 cards total
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);

  const cards = useMemo<Card[]>(() => {
    const picked = pickN(VOCAB, pairCount);
    const cs: Card[] = [];
    picked.forEach((v) => {
      cs.push({ id: `${v.key}-a`, pairKey: v.key, emoji: v.emoji, word: tr(v.translations, langA), lang: langA });
      cs.push({ id: `${v.key}-b`, pairKey: v.key, emoji: v.emoji, word: tr(v.translations, langB), lang: langB });
    });
    return cs.sort(() => Math.random() - 0.5);
  }, [langA, langB]);

  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped.map((id) => cards.find((c) => c.id === id)!);
    setMoves((m) => m + 1);
    if (a.pairKey === b.pairKey) {
      setMatched((prev) => new Set(prev).add(a.pairKey));
      setTimeout(() => setFlipped([]), 500);
    } else {
      setTimeout(() => setFlipped([]), 900);
    }
  }, [flipped, cards]);

  function playTts(text: string, lang: string) {
    const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`;
    new Audio(url).play().catch(() => {});
  }

  function handleFlip(c: Card) {
    if (matched.has(c.pairKey)) return;
    if (flipped.includes(c.id)) return;
    if (flipped.length >= 2) return;
    setFlipped((f) => [...f, c.id]);
    playTts(c.word, c.lang);
  }

  const allMatched = matched.size === pairCount;

  if (allMatched) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="cheer" />
        <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", margin: "18px 0 6px" }}>
          🎉 {gt(WM.allMatched, langA)}
        </div>
        <div style={{ color: "#6B7280", fontSize: 14 }}>{gt(WM.tries, langA)} {moves}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 520, margin: "0 auto" }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        marginBottom: 14, fontSize: 13, fontWeight: 700, color: "#6B7280",
      }}>
        <span>{gt(WM.tries, langA)} {moves}</span>
        <span>{gt(WM.matchedPairs, langA)} {matched.size} / {pairCount}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {cards.map((c) => {
          const isFlipped = flipped.includes(c.id) || matched.has(c.pairKey);
          const isMatched = matched.has(c.pairKey);
          return (
            <button
              key={c.id}
              onClick={() => handleFlip(c)}
              disabled={isMatched}
              style={{
                aspectRatio: "1 / 1.2",
                borderRadius: 14,
                border: `2px solid ${isMatched ? "#16A34A" : "#E5E7EB"}`,
                background: isFlipped
                  ? (isMatched ? "#DCFCE7" : "#FEF3C7")
                  : "linear-gradient(135deg,#FBBF24,#F59E0B)",
                color: isFlipped ? "#111827" : "#fff",
                fontSize: 13, fontWeight: 800, cursor: isMatched ? "default" : "pointer",
                padding: 6, transition: "all 0.25s",
                boxShadow: isFlipped ? "none" : "0 4px 12px rgba(245,158,11,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                textAlign: "center", lineHeight: 1.2,
                wordBreak: "keep-all", overflow: "hidden",
              }}
            >
              {isFlipped ? (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <VocabImage vocabKey={c.pairKey} emoji={c.emoji} size={36} />
                  <span>{c.word}</span>
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

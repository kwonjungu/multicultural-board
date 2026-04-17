"use client";

import { useEffect, useMemo, useState } from "react";
import { VOCAB, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

type Card = {
  id: string;
  pairKey: string;
  text: string;
  lang: string;
};

export default function WordMemory({ langA, langB }: { langA: string; langB: string }) {
  const pairCount = 8; // 16 cards total
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);

  const cards = useMemo<Card[]>(() => {
    const picked = pickN(VOCAB, pairCount);
    const cs: Card[] = [];
    picked.forEach((v) => {
      cs.push({ id: `${v.key}-a`, pairKey: v.key, text: `${v.emoji} ${tr(v.translations, langA)}`, lang: langA });
      cs.push({ id: `${v.key}-b`, pairKey: v.key, text: `${v.emoji} ${tr(v.translations, langB)}`, lang: langB });
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
    // strip emoji prefix
    const clean = text.replace(/^[^A-Za-z가-힣-龥ぁ-んァ-ン一-龥...]+\s*/, "");
    const url = `/api/tts?text=${encodeURIComponent(clean || text)}&lang=${lang}`;
    new Audio(url).play().catch(() => {});
  }

  function handleFlip(c: Card) {
    if (matched.has(c.pairKey)) return;
    if (flipped.includes(c.id)) return;
    if (flipped.length >= 2) return;
    setFlipped((f) => [...f, c.id]);
    playTts(c.text, c.lang);
  }

  const allMatched = matched.size === pairCount;

  if (allMatched) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="cheer" />
        <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", margin: "18px 0 6px" }}>
          🎉 모두 맞췄어요!
        </div>
        <div style={{ color: "#6B7280", fontSize: 14 }}>{moves}번 시도</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 520, margin: "0 auto" }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        marginBottom: 14, fontSize: 13, fontWeight: 700, color: "#6B7280",
      }}>
        <span>시도 {moves}번</span>
        <span>맞춘 쌍 {matched.size} / {pairCount}</span>
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
              {isFlipped ? c.text : "🐝"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

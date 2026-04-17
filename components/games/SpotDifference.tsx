"use client";

import { useState } from "react";
import { VOCAB, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

// Scene: simple SVG with labeled hit regions. Differences are extra/missing items.
const SCENE = {
  // id -> vocab key (for naming)
  items: [
    { id: "sun",    emoji: "☀️", x: 80, y: 40, vocabKey: "sun",    inBoth: true },
    { id: "moon",   emoji: "🌙", x: 320, y: 40, vocabKey: "moon",   inBoth: false, onlyIn: "B" },
    { id: "house",  emoji: "🏠", x: 60, y: 180, vocabKey: "house",  inBoth: true },
    { id: "dog",    emoji: "🐶", x: 180, y: 230, vocabKey: "dog",   inBoth: false, onlyIn: "A" },
    { id: "cat",    emoji: "🐱", x: 270, y: 220, vocabKey: "cat",   inBoth: true },
    { id: "apple",  emoji: "🍎", x: 340, y: 180, vocabKey: "apple", inBoth: false, onlyIn: "A" },
    { id: "banana", emoji: "🍌", x: 120, y: 280, vocabKey: "banana",inBoth: false, onlyIn: "B" },
    { id: "book",   emoji: "📖", x: 230, y: 300, vocabKey: "book",  inBoth: true },
  ],
};

export default function SpotDifference({ langA, langB }: { langA: string; langB: string }) {
  const [found, setFound] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const differences = SCENE.items.filter((it) => !it.inBoth);
  const total = differences.length;

  function handleClick(id: string, sceneSide: "A" | "B") {
    const item = SCENE.items.find((i) => i.id === id);
    if (!item || item.inBoth) return;
    if (item.onlyIn !== sceneSide) return;
    if (found.has(id)) return;
    setFound((s) => new Set(s).add(id));
    const vocab = VOCAB.find((v) => v.key === item.vocabKey);
    if (vocab) {
      setToast(`${item.emoji}  ${tr(vocab.translations, langA)}  /  ${tr(vocab.translations, langB)}`);
      setTimeout(() => setToast(null), 2200);
      const url = `/api/tts?text=${encodeURIComponent(tr(vocab.translations, langA))}&lang=${langA}`;
      new Audio(url).play().catch(() => {});
    }
  }

  const done = found.size >= total;

  return (
    <div style={{ padding: "16px 12px 40px", maxWidth: 820, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 700 }}>
          🔍 두 그림에서 다른 곳 {total}곳을 찾아요
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#F59E0B", marginTop: 4 }}>
          {found.size} / {total}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Scene side="A" items={SCENE.items.filter((i) => i.inBoth || i.onlyIn === "A")} found={found} onHit={handleClick} />
        <Scene side="B" items={SCENE.items.filter((i) => i.inBoth || i.onlyIn === "B")} found={found} onHit={handleClick} />
      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "#111827", color: "#fff", padding: "12px 20px",
          borderRadius: 99, fontSize: 14, fontWeight: 800,
          boxShadow: "0 8px 20px rgba(0,0,0,0.3)", zIndex: 10,
        }}>{toast}</div>
      )}

      {done && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <BeeMascot size={100} mood="cheer" />
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 10 }}>🎉 모두 찾았어요!</div>
        </div>
      )}
    </div>
  );
}

function Scene({ side, items, found, onHit }: {
  side: "A" | "B";
  items: typeof SCENE.items;
  found: Set<string>;
  onHit: (id: string, side: "A" | "B") => void;
}) {
  return (
    <div style={{
      position: "relative", aspectRatio: "4 / 3",
      background: "linear-gradient(180deg,#BAE6FD 0%,#DBEAFE 60%,#A7F3D0 100%)",
      borderRadius: 16, overflow: "hidden",
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    }}>
      <svg viewBox="0 0 400 360" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
        <ellipse cx="200" cy="340" rx="220" ry="30" fill="#86C87A" opacity="0.8" />
        <ellipse cx="100" cy="330" rx="80" ry="14" fill="#66BB66" opacity="0.5" />
      </svg>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onHit(it.id, side)}
          style={{
            position: "absolute",
            left: `${(it.x / 400) * 100}%`,
            top: `${(it.y / 360) * 100}%`,
            transform: "translate(-50%,-50%)",
            background: "none", border: "none", cursor: "pointer",
            fontSize: 40, padding: 4,
            outline: found.has(it.id) && !it.inBoth ? "3px solid #16A34A" : "none",
            outlineOffset: 2, borderRadius: "50%",
          }}
        >{it.emoji}</button>
      ))}
      <div style={{
        position: "absolute", top: 8, left: 10,
        background: "rgba(255,255,255,0.8)", padding: "2px 10px",
        borderRadius: 99, fontSize: 11, fontWeight: 800, color: "#111827",
      }}>{side}</div>
    </div>
  );
}

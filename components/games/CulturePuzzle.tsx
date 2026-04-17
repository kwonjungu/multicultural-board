"use client";

import { useMemo, useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import BeeMascot from "../BeeMascot";

const TOPICS: { key: string; src: string; caption: Record<string, string> }[] = [
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
];

type Cell = { correctIdx: number; currentIdx: number };

export default function CulturePuzzle({ langA, langB }: { langA: string; langB: string }) {
  const topic = useMemo(() => TOPICS[Math.floor(Math.random() * TOPICS.length)], []);
  const img = topic.src;
  const size = 3;
  const [cells, setCells] = useState<Cell[]>(() => {
    const arr = Array.from({ length: size * size }, (_, i) => ({ correctIdx: i, currentIdx: i }));
    const order = Array.from({ length: size * size }, (_, i) => i).sort(() => Math.random() - 0.5);
    return arr.map((c, i) => ({ ...c, currentIdx: order[i] }));
  });
  const [selected, setSelected] = useState<number | null>(null);

  function handleClick(i: number) {
    if (selected === null) { setSelected(i); return; }
    if (selected === i) { setSelected(null); return; }
    setCells((prev) => {
      const next = [...prev];
      const a = next[selected]; const b = next[i];
      [a.currentIdx, b.currentIdx] = [b.currentIdx, a.currentIdx];
      return next;
    });
    setSelected(null);
  }

  const solved = cells.every((c) => c.correctIdx === c.currentIdx);
  const getCaption = (lang: string) => topic.caption[lang] || topic.caption.en;

  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 12, fontSize: 13, color: "#6B7280", fontWeight: 700 }}>
        🧩 조각을 맞춰보세요 (조각 두 개 골라 자리 바꾸기)
      </div>

      <div style={{
        position: "relative", aspectRatio: "1 / 1",
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        background: "#111",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gridTemplateRows: `repeat(${size}, 1fr)`,
          gap: solved ? 0 : 2,
          width: "100%", height: "100%",
          transition: "gap 0.4s",
        }}>
          {cells.map((c, i) => {
            const row = Math.floor(c.currentIdx / size);
            const col = c.currentIdx % size;
            return (
              <button
                key={i}
                onClick={() => handleClick(i)}
                style={{
                  background: `url(${img})`,
                  backgroundSize: `${size * 100}% ${size * 100}%`,
                  backgroundPosition: `${(col / (size - 1)) * 100}% ${(row / (size - 1)) * 100}%`,
                  border: selected === i ? "3px solid #F59E0B" : "none",
                  cursor: "pointer", padding: 0,
                }}
              />
            );
          })}
        </div>
      </div>

      {solved && (
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#16A34A", marginBottom: 10 }}>
            🎉 완성!
          </div>
          <div style={{
            background: "linear-gradient(180deg,#FEF3C7,#fff)",
            padding: 16, borderRadius: 14,
            boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
              {LANGUAGES[langA]?.flag} {getCaption(langA)}
            </div>
            <div style={{ fontSize: 13, color: "#6B7280" }}>
              {LANGUAGES[langB]?.flag} {getCaption(langB)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

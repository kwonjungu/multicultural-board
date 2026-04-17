"use client";

import { useMemo, useState } from "react";
import { VOCAB, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

const DRAW_KEYS = new Set([
  "apple","banana","dog","cat","book","water","school","friend",
  "family","house","sun","moon","rice","tea","thanks",
]);

export default function DrawGuess({ langA, langB }: { langA: string; langB: string }) {
  const rounds = useMemo(() => {
    const drawable = VOCAB.filter((v) => DRAW_KEYS.has(v.key));
    return pickN(drawable, 5);
  }, []);
  const [round, setRound] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const cur = rounds[round];
  const done = round >= rounds.length;

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="cheer" />
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 14 }}>🎉 모두 맞혔어요!</div>
      </div>
    );
  }

  const imgSrc = `/game-assets/draw/${cur.key}.png`;

  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ textAlign: "center", fontSize: 12, color: "#6B7280", fontWeight: 700, marginBottom: 10 }}>
        🐝 꿀벌이 그린 그림은 무엇일까요? ({round + 1} / {rounds.length})
      </div>

      <div style={{
        position: "relative", aspectRatio: "1 / 1",
        background: "#fff", borderRadius: 16, overflow: "hidden",
        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
      }}>
        <img
          src={imgSrc} alt="guess"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          style={{
            marginTop: 18, width: "100%",
            background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
            color: "#fff", border: "none", padding: 14, borderRadius: 14,
            fontSize: 15, fontWeight: 800, cursor: "pointer",
          }}
        >💡 정답 보기</button>
      ) : (
        <div style={{ marginTop: 18, padding: 18, background: "#FEF3C7", borderRadius: 14, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>{cur.emoji}</div>
          <div style={{ fontSize: 17, fontWeight: 900, marginTop: 6 }}>{tr(cur.translations, langA)}</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>{tr(cur.translations, langB)}</div>
          <button
            onClick={() => { setRound((r) => r + 1); setRevealed(false); }}
            style={{
              marginTop: 14, background: "#5B57F5", color: "#fff", border: "none",
              padding: "10px 24px", borderRadius: 99, cursor: "pointer",
              fontSize: 14, fontWeight: 800,
            }}
          >➡ 다음</button>
        </div>
      )}
    </div>
  );
}

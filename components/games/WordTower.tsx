"use client";

import { useMemo, useState } from "react";
import { VOCAB, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

export default function WordTower({ langA, langB }: { langA: string; langB: string }) {
  const [height, setHeight] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [cur, setCur] = useState(() => makeRound(langA, langB));
  const [picked, setPicked] = useState<number | null>(null);

  function makeRound(a: string, b: string) {
    const correct = pickN(VOCAB, 1)[0];
    const wrongs = pickN(VOCAB.filter((v) => v.key !== correct.key), 3);
    // Show in A, options in B
    const askLang = Math.random() < 0.5 ? a : b;
    const ansLang = askLang === a ? b : a;
    const options = [correct, ...wrongs].sort(() => Math.random() - 0.5);
    return { correct, options, askLang, ansLang };
  }

  function handlePick(i: number) {
    if (picked !== null || gameOver) return;
    setPicked(i);
    const right = cur.options[i].key === cur.correct.key;
    setTimeout(() => {
      if (right) {
        setHeight((h) => h + 1);
      } else {
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) setGameOver(true);
          return nl;
        });
      }
      setPicked(null);
      setCur(makeRound(langA, langB));
    }, 900);
  }

  function restart() {
    setHeight(0); setLives(3); setGameOver(false);
    setCur(makeRound(langA, langB));
    setPicked(null);
  }

  if (gameOver) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="happy" />
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 14 }}>
          🏗️ 탑 높이 {height}칸
        </div>
        <button onClick={restart} style={{
          marginTop: 18,
          background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
          color: "#fff", border: "none", padding: "12px 28px",
          borderRadius: 99, fontSize: 14, fontWeight: 800, cursor: "pointer",
        }}>🔁 다시 하기</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 560, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 160px", gap: 16 }}>
      {/* Quiz */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: "#16A34A" }}>🏗️ {height}칸</span>
          <span style={{ color: "#DC2626" }}>{"❤️".repeat(lives)}</span>
        </div>
        <div style={{
          background: "linear-gradient(180deg,#FEF3C7,#fff)",
          padding: "26px 18px", borderRadius: 18, textAlign: "center",
          marginBottom: 14, boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
        }}>
          <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>
            {cur.askLang.toUpperCase()} → {cur.ansLang.toUpperCase()}
          </div>
          <div style={{ fontSize: 32 }}>{cur.correct.emoji}</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
            {tr(cur.correct.translations, cur.askLang)}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {cur.options.map((opt, i) => {
            const isRight = picked !== null && opt.key === cur.correct.key;
            const isWrong = picked === i && opt.key !== cur.correct.key;
            const bg = picked === null ? "#fff"
              : isRight ? "#DCFCE7"
              : isWrong ? "#FEE2E2" : "#fff";
            const border = isRight ? "#16A34A" : isWrong ? "#DC2626" : "#E5E7EB";
            return (
              <button
                key={i}
                onClick={() => handlePick(i)}
                disabled={picked !== null}
                style={{
                  padding: "12px 14px", borderRadius: 14,
                  border: `2px solid ${border}`, background: bg,
                  cursor: picked === null ? "pointer" : "default",
                  fontSize: 15, fontWeight: 800, color: "#111827", textAlign: "left",
                }}
              >{tr(opt.translations, cur.ansLang)}</button>
            );
          })}
        </div>
      </div>

      {/* Tower */}
      <div style={{
        position: "relative", background: "linear-gradient(180deg,#DBEAFE,#F0F9FF)",
        borderRadius: 14, overflow: "hidden",
        display: "flex", flexDirection: "column-reverse",
        alignItems: "center", padding: "8px 6px",
        minHeight: 380, border: "2px solid #E5E7EB",
      }}>
        <div style={{ width: "80%", height: 14, background: "#86C87A", borderRadius: 4, marginBottom: 4 }} />
        {Array.from({ length: height }).map((_, i) => (
          <div key={i} style={{
            width: `${Math.max(60, 90 - i * 1.5)}%`, height: 20,
            background: `hsl(${40 + i * 6}, 80%, 60%)`,
            border: "2px solid #D97706", borderRadius: 4,
            marginBottom: 3, animation: "blockDrop 0.4s ease-out",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, color: "#fff",
          }}>🍯</div>
        ))}
        <style jsx>{`
          @keyframes blockDrop {
            from { transform: translateY(-40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}

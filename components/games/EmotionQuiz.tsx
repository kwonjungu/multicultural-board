"use client";

import { useMemo, useState } from "react";
import { EMOTIONS, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";
import { ProgressBar } from "./CountryGuess";

const EMOJI_POOL = ["😊","😢","😠","😨","😳","🤗","😴","😮","🤔","🥳"];

export default function EmotionQuiz({ langA, langB }: { langA: string; langB: string }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const rounds = useMemo(() => pickN(EMOTIONS, 6).map((ans) => {
    const wrongs = EMOJI_POOL.filter((e) => e !== ans.emoji);
    const distractors = pickN(wrongs, 3);
    const choices = [...distractors, ans.emoji].sort(() => Math.random() - 0.5);
    return { answer: ans, choices };
  }), []);

  const cur = rounds[round];
  const done = round >= rounds.length;

  function handlePick(em: string) {
    if (picked) return;
    setPicked(em);
    if (em === cur.answer.emoji) setScore((s) => s + 1);
    setTimeout(() => {
      setPicked(null);
      setRound((r) => r + 1);
    }, 1300);
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="cheer" />
        <div style={{ fontSize: 28, fontWeight: 900, margin: "18px 0 6px" }}>
          🎉 {score} / {rounds.length}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 40px", maxWidth: 640, margin: "0 auto" }}>
      <ProgressBar value={round} max={rounds.length} score={score} />

      <div style={{
        background: "linear-gradient(180deg,#EFF6FF,#fff)",
        padding: 22, borderRadius: 18, marginBottom: 18,
        boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#F59E0B", letterSpacing: 1.2, marginBottom: 8 }}>
          💭 상황
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1.5 }}>
          {tr(cur.answer.situation, langA)}
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 8, lineHeight: 1.5 }}>
          {tr(cur.answer.situation, langB)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {cur.choices.map((em) => {
          const isPicked = picked === em;
          const isCorrect = picked && em === cur.answer.emoji;
          const bg = !picked ? "#fff"
            : isCorrect ? "#DCFCE7"
            : isPicked ? "#FEE2E2"
            : "#fff";
          const border = isCorrect ? "#16A34A" : isPicked ? "#DC2626" : "#E5E7EB";
          return (
            <button
              key={em}
              onClick={() => handlePick(em)}
              disabled={!!picked}
              style={{
                aspectRatio: "1 / 1", borderRadius: 16,
                border: `2px solid ${border}`, background: bg,
                fontSize: 44, cursor: picked ? "default" : "pointer",
                transition: "all 0.2s",
              }}
            >{em}</button>
          );
        })}
      </div>
    </div>
  );
}

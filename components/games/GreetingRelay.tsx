"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GREETINGS, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";
import { ProgressBar } from "./CountryGuess";

export default function GreetingRelay({ langA, langB }: { langA: string; langB: string }) {
  const rounds = useMemo(() => {
    return pickN(GREETINGS, 6).map((g) => {
      const askLang = Math.random() < 0.5 ? langA : langB;
      const answerLang = askLang === langA ? langB : langA;
      const pool = GREETINGS.filter((o) => o !== g);
      const distractors = pickN(pool, 3);
      const options = [...distractors, g].sort(() => Math.random() - 0.5);
      return {
        greeting: g, askLang, answerLang,
        options,
      };
    });
  }, [langA, langB]);

  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cur = rounds[round];
  const done = round >= rounds.length;

  useEffect(() => {
    if (!cur) return;
    const text = tr(cur.greeting, cur.askLang);
    try { audioRef.current?.pause(); } catch {}
    const a = new Audio(`/api/tts?text=${encodeURIComponent(text)}&lang=${cur.askLang}`);
    audioRef.current = a;
    a.play().catch(() => {});
  }, [cur]);

  function handlePick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (cur.options[i] === cur.greeting) setScore((s) => s + 1);
    setTimeout(() => {
      setPicked(null);
      setRound((r) => r + 1);
    }, 1400);
  }

  function replay() {
    if (!cur) return;
    const text = tr(cur.greeting, cur.askLang);
    try { audioRef.current?.pause(); } catch {}
    const a = new Audio(`/api/tts?text=${encodeURIComponent(text)}&lang=${cur.askLang}`);
    audioRef.current = a;
    a.play().catch(() => {});
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="cheer" />
        <div style={{ fontSize: 26, fontWeight: 900, margin: "16px 0" }}>🎉 {score} / {rounds.length}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 40px", maxWidth: 560, margin: "0 auto" }}>
      <ProgressBar value={round} max={rounds.length} score={score} />

      <div style={{
        background: "linear-gradient(180deg,#FEF3C7,#fff)",
        padding: "26px 20px", borderRadius: 18, textAlign: "center",
        marginBottom: 18, boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontSize: 10, color: "#F59E0B", fontWeight: 800, letterSpacing: 1 }}>
          🎧 {cur.askLang.toUpperCase()}로 들려요 → {cur.answerLang.toUpperCase()}로 고르세요
        </div>
        <button onClick={replay} style={{
          marginTop: 10, background: "#F59E0B", color: "#fff", border: "none",
          padding: "10px 24px", borderRadius: 99, cursor: "pointer",
          fontSize: 14, fontWeight: 800,
        }}>🔊 다시 듣기</button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {cur.options.map((opt, i) => {
          const isCorrect = picked !== null && opt === cur.greeting;
          const isWrong = picked === i && opt !== cur.greeting;
          const bg = picked === null ? "#fff"
            : isCorrect ? "#DCFCE7"
            : isWrong ? "#FEE2E2"
            : "#fff";
          const border = isCorrect ? "#16A34A" : isWrong ? "#DC2626" : "#E5E7EB";
          return (
            <button
              key={i}
              onClick={() => handlePick(i)}
              disabled={picked !== null}
              style={{
                padding: "14px 16px", borderRadius: 14,
                border: `2px solid ${border}`, background: bg,
                cursor: picked === null ? "pointer" : "default",
                fontSize: 15, fontWeight: 800, color: "#111827",
                textAlign: "left",
              }}
            >{tr(opt, cur.answerLang)}</button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { COUNTRIES, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

export default function CountryGuess({ langA, langB }: { langA: string; langB: string }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const rounds = useMemo(() => pickN(COUNTRIES, 8).map((ans) => {
    const others = COUNTRIES.filter((c) => c.code !== ans.code);
    const choices = pickN(others, 3).concat([ans]);
    choices.sort(() => Math.random() - 0.5);
    return { answer: ans, choices };
  }), []);

  const cur = rounds[round];
  const done = round >= rounds.length;

  function handlePick(code: string) {
    if (selected) return;
    setSelected(code);
    if (code === cur.answer.code) setScore((s) => s + 1);
    setTimeout(() => {
      setSelected(null);
      setRound((r) => r + 1);
    }, 1400);
  }

  function playTts(text: string, lang: string) {
    const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`;
    const a = new Audio(url);
    a.play().catch(() => {});
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="cheer" />
        <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", margin: "18px 0 6px" }}>
          🎉 점수 {score} / {rounds.length}
        </div>
        <div style={{ color: "#6B7280", fontSize: 14 }}>다시 하려면 뒤로 가기</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 40px", maxWidth: 640, margin: "0 auto" }}>
      <ProgressBar value={round} max={rounds.length} score={score} />

      <div style={{
        textAlign: "center",
        background: "linear-gradient(180deg,#FEF3C7,#FFFFFF)",
        padding: "34px 20px 26px", borderRadius: 22,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)", marginBottom: 18,
      }}>
        <div style={{ fontSize: 110, lineHeight: 1 }}>{cur.answer.flag}</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 10, fontWeight: 700 }}>
          이 국기의 나라는?
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {cur.choices.map((c) => {
          const picked = selected === c.code;
          const correct = selected && c.code === cur.answer.code;
          const bg = !selected ? "#fff"
            : correct ? "#DCFCE7"
            : picked ? "#FEE2E2"
            : "#fff";
          const border = correct ? "#16A34A" : picked ? "#DC2626" : "#E5E7EB";
          return (
            <button
              key={c.code}
              onClick={() => handlePick(c.code)}
              disabled={!!selected}
              style={{
                padding: "16px 12px", borderRadius: 14,
                border: `2px solid ${border}`, background: bg,
                cursor: selected ? "default" : "pointer",
                fontSize: 15, fontWeight: 700, color: "#111827",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800 }}>{tr(c.names, langA)}</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{tr(c.names, langB)}</div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div style={{
          marginTop: 18, padding: "14px 16px",
          background: "#F0F9FF", borderRadius: 14, textAlign: "center",
        }}>
          <div style={{ fontSize: 36 }}>{cur.answer.flag}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <button
              onClick={() => playTts(tr(cur.answer.names, langA), langA)}
              style={pillButton}
            >🔊 {tr(cur.answer.names, langA)}</button>
            <button
              onClick={() => playTts(tr(cur.answer.names, langB), langB)}
              style={pillButton}
            >🔊 {tr(cur.answer.names, langB)}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const pillButton: React.CSSProperties = {
  background: "#fff", border: "2px solid #F59E0B", color: "#F59E0B",
  padding: "8px 14px", borderRadius: 99, cursor: "pointer",
  fontSize: 13, fontWeight: 800,
};

export function ProgressBar({ value, max, score }: { value: number; max: number; score: number }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
          {Math.min(value + 1, max)} / {max}
        </span>
        <span style={{ fontSize: 12, color: "#F59E0B", fontWeight: 800 }}>⭐ {score}</span>
      </div>
      <div style={{ height: 6, background: "#E5E7EB", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${(value / max) * 100}%`,
          background: "linear-gradient(90deg,#FBBF24,#F59E0B)",
          transition: "width 0.4s",
        }} />
      </div>
    </div>
  );
}

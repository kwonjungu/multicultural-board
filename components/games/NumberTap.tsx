"use client";

import { useEffect, useRef, useState } from "react";
import BeeMascot from "../BeeMascot";

const NUMBERS_WORDS: Record<string, string[]> = {
  ko: ["영","하나","둘","셋","넷","다섯","여섯","일곱","여덟","아홉"],
  en: ["zero","one","two","three","four","five","six","seven","eight","nine"],
  vi: ["không","một","hai","ba","bốn","năm","sáu","bảy","tám","chín"],
  zh: ["零","一","二","三","四","五","六","七","八","九"],
  ja: ["ゼロ","いち","に","さん","よん","ご","ろく","なな","はち","きゅう"],
  th: ["ศูนย์","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"],
  id: ["nol","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan"],
  hi: ["शून्य","एक","दो","तीन","चार","पाँच","छह","सात","आठ","नौ"],
  ru: ["ноль","один","два","три","четыре","пять","шесть","семь","восемь","девять"],
  ar: ["صفر","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة"],
  fil: ["sero","isa","dalawa","tatlo","apat","lima","anim","pito","walo","siyam"],
  km: ["សូន្យ","មួយ","ពីរ","បី","បួន","ប្រាំ","ប្រាំមួយ","ប្រាំពីរ","ប្រាំបី","ប្រាំបួន"],
  mn: ["тэг","нэг","хоёр","гурав","дөрөв","тав","зургаа","долоо","найм","ес"],
  uz: ["nol","bir","ikki","uch","toʻrt","besh","olti","yetti","sakkiz","toʻqqiz"],
  my: ["သုည","တစ်","နှစ်","သုံး","လေး","ငါး","ခြောက်","ခုနစ်","ရှစ်","ကိုး"],
};

const ROUND_COUNT = 10;
const WRONG_LOCK_MS = 500;

type Phase = "ready" | "play" | "done";

export default function NumberTap({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<{ n: number; lang: string } | null>(null);
  const [flashA, setFlashA] = useState<"ok" | "bad" | null>(null);
  const [flashB, setFlashB] = useState<"ok" | "bad" | null>(null);
  const [lockA, setLockA] = useState(0);
  const [lockB, setLockB] = useState(0);
  const [nowTs, setNowTs] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const solvedRef = useRef(false);

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setNowTs(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  function pickTarget(nextRound: number) {
    const n = Math.floor(Math.random() * 10);
    const lang = Math.random() < 0.5 ? langA : langB;
    setTarget({ n, lang });
    solvedRef.current = false;
    const word = NUMBERS_WORDS[lang]?.[n] || String(n);
    try { audioRef.current?.pause(); } catch {}
    const a = new Audio(`/api/tts?text=${encodeURIComponent(word)}&lang=${lang}`);
    audioRef.current = a;
    a.play().catch(() => {});
    setRound(nextRound);
  }

  function replayTts() {
    if (!target) return;
    const word = NUMBERS_WORDS[target.lang]?.[target.n] || String(target.n);
    try { audioRef.current?.pause(); } catch {}
    const a = new Audio(`/api/tts?text=${encodeURIComponent(word)}&lang=${target.lang}`);
    audioRef.current = a;
    a.play().catch(() => {});
  }

  function start() {
    setScoreA(0); setScoreB(0);
    setLockA(0); setLockB(0);
    setFlashA(null); setFlashB(null);
    setPhase("play");
    setTimeout(() => pickTarget(1), 200);
  }

  function advance() {
    if (round >= ROUND_COUNT) {
      setPhase("done");
      return;
    }
    setTimeout(() => pickTarget(round + 1), 600);
  }

  function handleTap(player: "A" | "B", n: number) {
    if (!target || phase !== "play" || solvedRef.current) return;
    const now = Date.now();
    const locked = player === "A" ? lockA : lockB;
    if (now < locked) return;

    if (n === target.n) {
      solvedRef.current = true;
      if (player === "A") {
        setScoreA((s) => s + 1);
        setFlashA("ok");
        setTimeout(() => setFlashA(null), 250);
      } else {
        setScoreB((s) => s + 1);
        setFlashB("ok");
        setTimeout(() => setFlashB(null), 250);
      }
      advance();
    } else {
      const until = now + WRONG_LOCK_MS;
      if (player === "A") {
        setLockA(until);
        setFlashA("bad");
        setTimeout(() => setFlashA(null), 250);
      } else {
        setLockB(until);
        setFlashB("bad");
        setTimeout(() => setFlashB(null), 250);
      }
    }
  }

  if (phase === "ready") {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="happy" />
        <div style={{ fontSize: 22, fontWeight: 900, margin: "18px 0 10px" }}>🔢 숫자 빨리 누르기</div>
        <div style={{ color: "#6B7280", marginBottom: 20, fontSize: 14 }}>
          둘이서 마주 앉아, 들려주는 숫자를 먼저 눌러요! ({ROUND_COUNT}라운드)
        </div>
        <div style={{ color: "#6B7280", marginBottom: 20, fontSize: 13 }}>
          A: {langA.toUpperCase()} · B: {langB.toUpperCase()}
        </div>
        <button onClick={start} style={primaryBtn}>▶ 시작</button>
      </div>
    );
  }

  if (phase === "done") {
    const winner = scoreA === scoreB ? "무승부" : scoreA > scoreB ? "Player A 승!" : "Player B 승!";
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="cheer" />
        <div style={{ fontSize: 26, fontWeight: 900, color: "#111827", margin: "18px 0 6px" }}>
          🏆 {winner}
        </div>
        <div style={{ color: "#6B7280", fontSize: 15, marginBottom: 20 }}>
          A: {scoreA} · B: {scoreB}
        </div>
        <button onClick={start} style={primaryBtn}>🔁 다시 하기</button>
      </div>
    );
  }

  const targetWord = target ? (NUMBERS_WORDS[target.lang]?.[target.n] || String(target.n)) : "";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      minHeight: "100vh", maxWidth: 480, margin: "0 auto",
      background: "#F9FAFB",
    }}>
      <PlayerArea
        player="B"
        lang={langB}
        score={scoreB}
        rotated
        flash={flashB}
        locked={nowTs < lockB}
        onTap={(n) => handleTap("B", n)}
      />

      <div style={{
        background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
        color: "#fff", padding: "14px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, borderTop: "3px solid #fff", borderBottom: "3px solid #fff",
      }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>
          <div style={{ opacity: 0.85 }}>라운드 {round}/{ROUND_COUNT}</div>
          <div style={{ fontSize: 15, marginTop: 2 }}>
            🎧 {target?.lang.toUpperCase()} · {targetWord}
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, textAlign: "center", flex: 1 }}>
          A: {scoreA} · B: {scoreB}
        </div>
        <button
          onClick={replayTts}
          aria-label="문제 다시 듣기"
          style={{
            background: "rgba(255,255,255,0.25)", border: "none", color: "#fff",
            padding: "8px 14px", borderRadius: 99, cursor: "pointer",
            fontSize: 13, fontWeight: 800, whiteSpace: "nowrap",
          }}
        >🔊 재생</button>
      </div>

      <PlayerArea
        player="A"
        lang={langA}
        score={scoreA}
        rotated={false}
        flash={flashA}
        locked={nowTs < lockA}
        onTap={(n) => handleTap("A", n)}
      />
    </div>
  );
}

function PlayerArea({
  player, lang, score, rotated, flash, locked, onTap,
}: {
  player: "A" | "B";
  lang: string;
  score: number;
  rotated: boolean;
  flash: "ok" | "bad" | null;
  locked: boolean;
  onTap: (n: number) => void;
}) {
  const bg =
    flash === "ok" ? "#DCFCE7" :
    flash === "bad" ? "#FEE2E2" :
    "#fff";

  return (
    <div style={{
      flex: 1, padding: "16px 16px 20px",
      background: bg, transition: "background 0.15s",
      transform: rotated ? "rotate(180deg)" : "none",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10, fontSize: 13, fontWeight: 800, color: "#374151",
      }}>
        <span>Player {player} · {lang.toUpperCase()}</span>
        <span style={{ color: "#16A34A" }}>⭐ {score}</span>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8,
        flex: 1, alignContent: "center",
      }}>
        {Array.from({ length: 10 }, (_, i) => (
          <button
            key={i}
            onClick={() => onTap(i)}
            disabled={locked}
            aria-label={`Player ${player} 숫자 ${i}`}
            style={{
              aspectRatio: "1 / 1", borderRadius: 14,
              border: "2px solid #E5E7EB", background: "#fff",
              fontSize: 24, fontWeight: 900,
              cursor: locked ? "not-allowed" : "pointer",
              color: "#111827",
              opacity: locked ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >{locked ? "⏳" : i}</button>
        ))}
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
  color: "#fff", border: "none", padding: "14px 32px",
  borderRadius: 99, fontSize: 15, fontWeight: 800, cursor: "pointer",
  boxShadow: "0 8px 20px rgba(245,158,11,0.4)",
};

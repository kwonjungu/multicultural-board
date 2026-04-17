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

const TIME_LIMIT = 30;

export default function NumberTap({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<"ready" | "play" | "done">("ready");
  const [score, setScore] = useState(0);
  const [miss, setMiss] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [target, setTarget] = useState<{ n: number; lang: string } | null>(null);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); setPhase("done"); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  function pickTarget() {
    const n = Math.floor(Math.random() * 10);
    const lang = Math.random() < 0.5 ? langA : langB;
    setTarget({ n, lang });
    const word = NUMBERS_WORDS[lang]?.[n] || String(n);
    try { audioRef.current?.pause(); } catch {}
    const a = new Audio(`/api/tts?text=${encodeURIComponent(word)}&lang=${lang}`);
    audioRef.current = a;
    a.play().catch(() => {});
  }

  function start() {
    setScore(0); setMiss(0); setTimeLeft(TIME_LIMIT);
    setPhase("play");
    setTimeout(pickTarget, 200);
  }

  function handleTap(n: number) {
    if (!target || phase !== "play") return;
    if (n === target.n) {
      setScore((s) => s + 1);
      setFlash("ok");
    } else {
      setMiss((m) => m + 1);
      setFlash("bad");
    }
    setTimeout(() => setFlash(null), 250);
    setTimeout(pickTarget, 400);
  }

  if (phase === "ready") {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="happy" />
        <div style={{ fontSize: 22, fontWeight: 900, margin: "18px 0 10px" }}>🔢 숫자 빨리 누르기</div>
        <div style={{ color: "#6B7280", marginBottom: 20, fontSize: 14 }}>
          들려주는 숫자를 {TIME_LIMIT}초 안에 빨리 눌러요!
        </div>
        <button onClick={start} style={primaryBtn}>▶ 시작</button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood="cheer" />
        <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", margin: "18px 0 6px" }}>
          🎯 맞춘 수 {score}
        </div>
        <div style={{ color: "#6B7280", fontSize: 14, marginBottom: 20 }}>
          놓친 수 {miss}
        </div>
        <button onClick={start} style={primaryBtn}>🔁 다시 하기</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 40px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", marginBottom: 14,
        fontSize: 14, fontWeight: 800,
      }}>
        <span style={{ color: "#16A34A" }}>⭐ {score}</span>
        <span style={{ color: timeLeft <= 5 ? "#DC2626" : "#6B7280" }}>⏱ {timeLeft}s</span>
      </div>

      <div style={{
        background: flash === "ok" ? "#DCFCE7" : flash === "bad" ? "#FEE2E2" : "linear-gradient(135deg,#FBBF24,#F59E0B)",
        borderRadius: 20, padding: "40px 20px", marginBottom: 16,
        textAlign: "center", color: flash ? "#111827" : "#fff",
        fontSize: 14, fontWeight: 800, transition: "background 0.15s",
      }}>
        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>
          {target?.lang.toUpperCase()} ({NUMBERS_WORDS[target?.lang || ""]?.[target?.n ?? 0]})
        </div>
        <button
          onClick={() => target && pickTarget()}
          style={{
            background: "rgba(255,255,255,0.25)", border: "none", color: "inherit",
            padding: "8px 16px", borderRadius: 99, cursor: "pointer",
            fontSize: 13, fontWeight: 800,
          }}
        >🔊 다시 듣기</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <button
            key={i}
            onClick={() => handleTap(i)}
            style={{
              aspectRatio: "1 / 1", borderRadius: 14,
              border: "2px solid #E5E7EB", background: "#fff",
              fontSize: 24, fontWeight: 900, cursor: "pointer",
              color: "#111827",
            }}
          >{i}</button>
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

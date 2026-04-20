"use client";

import { useEffect, useRef, useState } from "react";
import type { DialogueLine } from "@/lib/tutorial/types";

interface Props {
  lines: DialogueLine[];
  speakerName: string;
  onLineChange?: (idx: number, line: DialogueLine) => void;
  onDone: () => void;
  muted?: boolean;
}

/**
 * Animal-crossing style bottom-third dialogue box with typewriter effect
 * and multi-line advance-on-click. Plays short beep sounds per character.
 */
export default function DialogueBox({ lines, speakerName, onLineChange, onDone, muted = false }: Props) {
  const [idx, setIdx] = useState(0);
  const [rendered, setRendered] = useState("");
  const [typing, setTyping] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentLine = lines[idx];

  // Fire onLineChange when the active line changes
  useEffect(() => {
    if (currentLine && onLineChange) onLineChange(idx, currentLine);
  }, [idx, currentLine, onLineChange]);

  // Typewriter effect per line
  useEffect(() => {
    if (!currentLine) return;
    setRendered("");
    setTyping(true);
    const text = currentLine.text;
    const speed = currentLine.speed ?? 32;
    if (speed === 0) {
      setRendered(text);
      setTyping(false);
      return;
    }
    let cancelled = false;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      i++;
      const slice = text.slice(0, i);
      setRendered(slice);
      if (!muted) playBeep(audioCtxRef, text[i - 1]);
      if (i >= text.length) {
        setTyping(false);
        return;
      }
      // pause longer after sentence-ending punctuation
      const ch = text[i - 1];
      const delay = /[.,!?~…]/.test(ch) ? speed * 5 : speed;
      window.setTimeout(tick, delay);
    };
    window.setTimeout(tick, 80);
    return () => { cancelled = true; };
  }, [currentLine, muted]);

  function advance() {
    if (typing) {
      // skip: reveal full line instantly
      setRendered(currentLine.text);
      setTyping(false);
      return;
    }
    if (idx < lines.length - 1) {
      setIdx(idx + 1);
    } else {
      onDone();
    }
  }

  // Advance on click or space/enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing, idx, lines]);

  if (!currentLine) return null;

  return (
    <div
      role="dialog"
      aria-label={`${speakerName} 대화`}
      onClick={advance}
      style={{
        position: "fixed",
        left: "50%",
        bottom: 28,
        transform: "translateX(-50%)",
        width: "min(720px, calc(100vw - 32px))",
        background: "#FFFBEB",
        border: "4px solid #F59E0B",
        borderRadius: 24,
        padding: "20px 24px 22px",
        boxShadow: "0 18px 48px rgba(180, 83, 9, 0.35)",
        zIndex: 10000,
        cursor: "pointer",
        animation: "tutorialDialogueIn 360ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        fontFamily: "'Noto Sans KR', sans-serif",
        color: "#1F2937",
      }}
    >
      {/* Speaker tag */}
      <div style={{
        position: "absolute", top: -18, left: 20,
        background: "#F59E0B", color: "#fff",
        padding: "6px 14px", borderRadius: 999,
        fontSize: 13, fontWeight: 900, letterSpacing: 0.3,
        boxShadow: "0 4px 10px rgba(180,83,9,0.3)",
      }}>
        🐝 {speakerName}
      </div>

      {/* Text */}
      <div style={{
        fontSize: 18, lineHeight: 1.6, fontWeight: 600,
        minHeight: 58, whiteSpace: "pre-wrap",
      }}>
        {rendered}
        {typing && (
          <span style={{
            display: "inline-block", width: 2, marginLeft: 3,
            borderRight: "2px solid #F59E0B", height: "1em",
            verticalAlign: "text-bottom",
            animation: "tutorialCaret 600ms steps(1) infinite",
          }} />
        )}
      </div>

      {/* Progress + next cue */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 12,
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          {lines.map((_, i) => (
            <span key={i} style={{
              width: i === idx ? 20 : 8, height: 8,
              borderRadius: 4,
              background: i <= idx ? "#F59E0B" : "#FDE68A",
              transition: "width 180ms ease",
            }} />
          ))}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 800, color: "#92400E",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {typing ? "건너뛰기" : (idx < lines.length - 1 ? "다음" : "계속")}
          <span style={{
            animation: "fadeSlideIn 700ms ease-in-out infinite alternate",
            fontSize: 16,
          }}>▼</span>
        </div>
      </div>
    </div>
  );
}

/** Play a short beep. Three alternating pitches → Animal-Crossing-like babble. */
function playBeep(ctxRef: React.MutableRefObject<AudioContext | null>, ch: string) {
  if (!ch || /\s/.test(ch)) return;              // silent on whitespace
  try {
    if (!ctxRef.current) {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      ctxRef.current = new Ctor();
    }
    const ctx = ctxRef.current!;
    // Pitch derived from char code → varied but consistent
    const pitch = 420 + ((ch.charCodeAt(0) % 9) * 22);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = pitch;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch { /* audio unavailable — fine */ }
}

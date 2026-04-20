"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DialogueLine } from "@/lib/tutorial/types";

interface Props {
  lines: DialogueLine[];
  speakerName: string;
  onLineChange?: (idx: number, line: DialogueLine) => void;
  onDone: () => void;
  muted?: boolean;
}

type Segment = { bold: boolean; text: string };

/**
 * Parse "**emphasis**" into { bold: true, text: "emphasis" } segments so we
 * can render bold without the literal asterisks showing in the typewriter.
 */
function parseBoldSegments(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /\*\*([^*]+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ bold: false, text: text.slice(last, m.index) });
    out.push({ bold: true, text: m[1] });
    last = re.lastIndex;
  }
  if (last < text.length) {
    // Strip any stray unpaired "**" so they never flash mid-typewriter
    out.push({ bold: false, text: text.slice(last).replace(/\*\*/g, "") });
  }
  return out;
}

function segmentsLength(segs: Segment[]): number {
  return segs.reduce((n, s) => n + s.text.length, 0);
}

function renderSegments(segs: Segment[], visibleChars: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = visibleChars;
  for (let i = 0; i < segs.length; i++) {
    if (remaining <= 0) break;
    const s = segs[i];
    const take = Math.min(s.text.length, remaining);
    const slice = s.text.slice(0, take);
    parts.push(
      s.bold
        ? <strong key={i} style={{ color: "#B45309", fontWeight: 900 }}>{slice}</strong>
        : <span key={i}>{slice}</span>
    );
    remaining -= take;
  }
  return parts;
}

function charAt(segs: Segment[], idx: number): string {
  let remaining = idx;
  for (const s of segs) {
    if (remaining < s.text.length) return s.text[remaining];
    remaining -= s.text.length;
  }
  return "";
}

/**
 * Animal-crossing style bottom-third dialogue box with typewriter effect
 * and multi-line advance-on-click. Plays short beep sounds per character.
 */
export default function DialogueBox({ lines, speakerName, onLineChange, onDone, muted = false }: Props) {
  const [idx, setIdx] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);
  const [typing, setTyping] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentLine = lines[idx];

  const segments = useMemo(
    () => (currentLine ? parseBoldSegments(currentLine.text) : []),
    [currentLine],
  );
  const totalChars = useMemo(() => segmentsLength(segments), [segments]);

  // Fire onLineChange when the active line changes
  useEffect(() => {
    if (currentLine && onLineChange) onLineChange(idx, currentLine);
  }, [idx, currentLine, onLineChange]);

  // Typewriter effect per line
  useEffect(() => {
    if (!currentLine) return;
    setVisibleChars(0);
    setTyping(true);
    const speed = currentLine.speed ?? 32;
    if (speed === 0) {
      setVisibleChars(totalChars);
      setTyping(false);
      return;
    }
    let cancelled = false;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      i++;
      setVisibleChars(i);
      const ch = charAt(segments, i - 1);
      if (!muted) playBeep(audioCtxRef, ch);
      if (i >= totalChars) {
        setTyping(false);
        return;
      }
      const delay = /[.,!?~…]/.test(ch) ? speed * 5 : speed;
      window.setTimeout(tick, delay);
    };
    window.setTimeout(tick, 80);
    return () => { cancelled = true; };
  }, [currentLine, muted, segments, totalChars]);

  function advance() {
    if (typing) {
      setVisibleChars(totalChars);
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
        {renderSegments(segments, visibleChars)}
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

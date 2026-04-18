"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import BeeMascot from "./BeeMascot";

type SideState = "idle" | "listening" | "translating" | "done" | "error";
type SideValue = { original: string; translation: string };

const TTS_LANG_MAP: Record<string, string> = {
  ko: "ko-KR", en: "en-US", vi: "vi-VN", zh: "zh-CN", fil: "fil-PH",
  ja: "ja-JP", th: "th-TH", km: "km-KH", mn: "mn-MN", ru: "ru-RU",
  uz: "uz-UZ", hi: "hi-IN", id: "id-ID", ar: "ar-SA", my: "my-MM",
};
const WEB_SPEECH_SUPPORTED = new Set(["ko", "en", "vi", "zh", "ja", "th", "ru", "hi", "id", "ar"]);
let ttsAudio: HTMLAudioElement | null = null;

async function speakText(text: string, lang: string) {
  if (typeof window === "undefined" || !text) return;
  const bcp47 = TTS_LANG_MAP[lang] || "en-US";
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const prefix = bcp47.split("-")[0];
  const hasVoice = voices.some((v) => v.lang.startsWith(prefix));
  if (WEB_SPEECH_SUPPORTED.has(lang) && hasVoice) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp47;
    window.speechSynthesis.speak(u);
  } else {
    try {
      window.speechSynthesis?.cancel();
      if (ttsAudio) { ttsAudio.pause(); ttsAudio = null; }
      const url = `/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text.slice(0, 200))}`;
      const a = new Audio(url);
      ttsAudio = a;
      await a.play();
    } catch {}
  }
}

interface SideProps {
  side: "me" | "other";
  lang: string;
  value: SideValue | null;
  state: SideState;
  onStart: () => void;
  onStop: () => void;
  onReplay: () => void;
  flipped: boolean;
  errorMsg?: string;
  availableLangs: string[];
  onLangChange?: (lang: string) => void;
}

function InterpreterSide({ side, lang, value, state, onStart, onStop, onReplay, flipped, errorMsg, availableLangs, onLangChange }: SideProps) {
  const info = LANGUAGES[lang] || LANGUAGES.ko;
  const isMe = side === "me";

  const tint = isMe
    ? { bg: "linear-gradient(160deg, #FEF3C7 0%, #FDE68A 100%)", pri: "#F59E0B", priDark: "#D97706", ink: "#B45309", border: "#FCD34D" }
    : { bg: "linear-gradient(160deg, #DBEAFE 0%, #BFDBFE 100%)", pri: "#3B82F6", priDark: "#2563EB", ink: "#1E40AF", border: "#60A5FA" };

  const listening = state === "listening";
  const translating = state === "translating";
  const done = state === "done" && !!value;
  const err = state === "error";

  return (
    <div style={{
      flex: 1, background: tint.bg, position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      padding: "18px 16px", minHeight: 0,
      transform: flipped ? "rotate(180deg)" : "none",
    }}>
      <svg style={{ position: "absolute", top: -10, right: -10, opacity: 0.18, pointerEvents: "none" }} width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
        {[0,1,2].flatMap(i => [0,1,2].map(j => {
          const x = i*44 + (j%2)*22 + 10; const y = j*38 + 10;
          return <polygon key={`${i}-${j}`} points={`${x+16},${y} ${x+32},${y+9} ${x+32},${y+28} ${x+16},${y+37} ${x},${y+28} ${x},${y+9}`} fill="none" stroke={tint.pri} strokeWidth="1.5"/>;
        }))}
      </svg>

      {/* Top: language indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, zIndex: 2 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          border: `2px solid ${tint.border}`, boxShadow: "0 3px 8px rgba(0,0,0,0.06)",
        }}>{info.flag}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: tint.ink, letterSpacing: 0.5 }}>
            {isMe ? "나 · 내 언어" : "친구 · 상대방 언어"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937" }}>{info.label}</div>
        </div>
        {onLangChange && (
          <select
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
            aria-label="언어 바꾸기"
            style={{
              background: "#fff", border: `2px solid ${tint.border}`, borderRadius: 10,
              padding: "8px 10px", fontSize: 12, fontWeight: 800, color: tint.ink, cursor: "pointer",
              fontFamily: "inherit", outline: "none",
            }}
          >
            {availableLangs.map((k) => (
              <option key={k} value={k}>{LANGUAGES[k]?.flag} {LANGUAGES[k]?.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Middle: transcript */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 4px", zIndex: 2 }}>
        {listening ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 10, height: 44, alignItems: "center" }}>
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} style={{
                  width: 4, borderRadius: 2, background: tint.pri, height: 12 + (i % 4) * 8,
                  animation: `interpWave ${0.7 + (i % 4) * 0.1}s ease-in-out ${i * 0.05}s infinite alternate`,
                }} />
              ))}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: tint.ink }}>🎧 듣고 있어요...</div>
          </div>
        ) : translating ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: "50%", background: tint.pri,
                  animation: `interpDot 1.1s infinite ${i * 0.15}s`,
                }} />
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 15, fontWeight: 800, color: tint.ink }}>
              🐝 꿀벌이 번역 중...
            </div>
          </div>
        ) : done && value ? (
          <div style={{ width: "100%" }}>
            <div style={{
              background: "#fff", borderRadius: 18, padding: "14px 16px",
              border: `2px solid ${tint.border}`,
              boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
              fontSize: 19, fontWeight: 700, color: "#1F2937", lineHeight: 1.5,
              textAlign: "center",
            }}>
              {value.translation}
            </div>
            <div style={{
              marginTop: 8, padding: "6px 10px", textAlign: "center",
              fontSize: 13, color: tint.ink, fontWeight: 600, fontStyle: "italic", opacity: 0.85,
            }}>
              &quot;{value.original}&quot;
            </div>
          </div>
        ) : err ? (
          <div style={{ textAlign: "center", padding: "0 10px" }}>
            <div style={{ fontSize: 36, marginBottom: 6 }}>😅</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#B91C1C", lineHeight: 1.55 }}>
              {errorMsg || "다시 해볼까?"}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", opacity: 0.85, padding: "0 10px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: tint.ink, lineHeight: 1.65, whiteSpace: "pre-line" }}>
              {isMe
                ? `마이크를 누르고\n${info.label}로 말해봐!`
                : `${info.flag} ${info.label}\n친구가 말할 차례예요`}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: mic + replay */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 2 }}>
        {done && (
          <button
            onClick={onReplay}
            aria-label="다시 듣기"
            style={{
              width: 52, height: 52, borderRadius: 16, border: `2px solid ${tint.border}`,
              background: "#fff", color: tint.ink, fontSize: 22, cursor: "pointer",
              boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
            }}
          >🔊</button>
        )}
        <button
          onClick={listening ? onStop : onStart}
          disabled={translating}
          aria-label={listening ? "녹음 멈추기" : "말하기 시작"}
          style={{
            width: 84, height: 84, borderRadius: "50%", border: "none",
            background: listening
              ? "linear-gradient(135deg, #EF4444, #DC2626)"
              : `linear-gradient(135deg, ${tint.pri}, ${tint.priDark})`,
            color: "#fff", fontSize: 34, cursor: translating ? "wait" : "pointer",
            boxShadow: `0 14px 32px ${tint.pri}66, inset 0 -4px 0 rgba(0,0,0,0.18)`,
            animation: listening ? "interpRecPulse 1.2s infinite" : "none",
            transition: "transform 0.12s",
          }}
          onMouseDown={(e) => !translating && ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.94)")}
          onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
        >
          {listening ? "⏹" : "🎤"}
        </button>
        {done && <div style={{ width: 52 }} />}
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  viewerLang: string;
  availableLangs: string[];
}

export default function InterpreterDrawer({ open, onClose, viewerLang, availableLangs }: Props) {
  const defaultPartner = availableLangs.find((l) => l !== viewerLang) || "vi";
  const [partnerLang, setPartnerLang] = useState<string>(defaultPartner);
  const [meState, setMeState] = useState<SideState>("idle");
  const [otherState, setOtherState] = useState<SideState>("idle");
  const [meValue, setMeValue] = useState<SideValue | null>(null);
  const [otherValue, setOtherValue] = useState<SideValue | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const activeSideRef = useRef<"me" | "other" | null>(null);

  function reset() {
    cancelRecording();
    setMeState("idle"); setOtherState("idle");
    setMeValue(null); setOtherValue(null);
    setErrMsg("");
  }

  useEffect(() => { if (!open) reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  useEffect(() => () => cancelRecording(), []);

  function cancelRecording() {
    const r = recorderRef.current;
    try { if (r && r.state !== "inactive") r.stop(); } catch {}
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    activeSideRef.current = null;
  }

  async function startRecording(side: "me" | "other") {
    if (meState === "listening" || otherState === "listening" || meState === "translating" || otherState === "translating") return;
    setErrMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      activeSideRef.current = side;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        chunksRef.current = [];
        if (blob.size < 1500) {
          // too short
          if (side === "me") setMeState("idle"); else setOtherState("idle");
          return;
        }
        await transcribeAndTranslate(blob, side);
      };
      recorderRef.current = rec;
      rec.start();
      if (side === "me") setMeState("listening"); else setOtherState("listening");
    } catch (err) {
      console.error("mic error:", err);
      setErrMsg("마이크를 켤 수 없어요");
      if (side === "me") setMeState("error"); else setOtherState("error");
    }
  }

  function stopRecording(side: "me" | "other") {
    if (activeSideRef.current !== side) return;
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      if (side === "me") setMeState("translating"); else setOtherState("translating");
      try { r.stop(); } catch {}
    }
  }

  async function transcribeAndTranslate(blob: Blob, side: "me" | "other") {
    const speaker = side === "me" ? viewerLang : partnerLang;
    const target = side === "me" ? partnerLang : viewerLang;
    try {
      // 1) STT
      const fd = new FormData();
      fd.append("audio", new File([blob], "clip.webm", { type: blob.type || "audio/webm" }));
      fd.append("lang", speaker);
      const sttRes = await fetch("/api/stt", { method: "POST", body: fd });
      if (!sttRes.ok) throw new Error("stt 실패");
      const { text: original } = (await sttRes.json()) as { text?: string };
      if (!original || !original.trim()) throw new Error("목소리를 못 알아들었어요");

      // 2) Translate
      const trRes = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: original,
          fromLang: speaker,
          targetLangs: [target],
          cardType: "comment",
          authorName: "interpreter",
          isTeacher: false,
          paletteIdx: 0,
        }),
      });
      if (!trRes.ok) throw new Error("번역 실패");
      const { translations } = (await trRes.json()) as { translations?: Record<string, string> };
      const translation = translations?.[target] || original;

      const value: SideValue = { original, translation };
      if (side === "me") {
        setMeValue(value); setMeState("done"); setOtherState("done");
      } else {
        setOtherValue(value); setOtherState("done"); setMeState("done");
      }
      speakText(translation, target);
    } catch (e) {
      console.error("interpreter error:", e);
      setErrMsg((e as Error).message || "처리 중 문제가 생겼어요");
      if (side === "me") setMeState("error"); else setOtherState("error");
    }
  }

  const partnerOptions = availableLangs.filter((k) => k !== viewerLang);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(31,41,55,0.55)",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s", zIndex: 200,
        }}
      />
      <div
        role="dialog" aria-modal="true" aria-label="통역 도우미"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(560px, 96vw)",
          background: "#1F2937",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 201, display: "flex", flexDirection: "column",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 14px 12px", display: "flex", alignItems: "center", gap: 10,
          flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 44, height: 44, borderRadius: 12, border: "none",
              background: "rgba(255,255,255,0.12)", fontSize: 20, fontWeight: 900, color: "#fff", cursor: "pointer",
            }}
          >→</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
              🎙️ 통역 도우미
              <span style={{
                fontSize: 10, fontWeight: 900, background: "#F59E0B", color: "#fff",
                padding: "3px 8px", borderRadius: 999, letterSpacing: 0.5,
              }}>BETA</span>
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, marginTop: 2 }}>
              말하면 상대방 말로 바꿔줘요 · 대화는 저장되지 않아요
            </div>
          </div>
          <button
            onClick={reset}
            aria-label="초기화"
            style={{
              background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 12,
              padding: "10px 12px", fontSize: 14, fontWeight: 900, color: "#fff", cursor: "pointer",
            }}
          >↻</button>
        </div>

        {/* Lang pair selector */}
        <div style={{
          padding: "10px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          <div style={{
            flex: 1, background: "rgba(245,158,11,0.2)", border: "1.5px solid rgba(245,158,11,0.4)",
            borderRadius: 12, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>{LANGUAGES[viewerLang]?.flag}</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: "#FEF3C7" }}>{LANGUAGES[viewerLang]?.label}</span>
            <span style={{ fontSize: 10, fontWeight: 900, color: "#FCD34D", marginLeft: "auto", letterSpacing: 0.5 }}>나</span>
          </div>
          <div style={{ color: "#9CA3AF", fontSize: 18, fontWeight: 900 }}>⇅</div>
          <select
            value={partnerLang}
            onChange={(e) => { setPartnerLang(e.target.value); reset(); }}
            style={{
              flex: 1, background: "rgba(59,130,246,0.2)", border: "1.5px solid rgba(59,130,246,0.4)",
              borderRadius: 12, padding: "9px 12px", fontSize: 13, fontWeight: 900, color: "#DBEAFE",
              fontFamily: "inherit", cursor: "pointer", outline: "none",
            }}
          >
            {partnerOptions.map((k) => (
              <option key={k} value={k} style={{ color: "#1F2937" }}>
                {LANGUAGES[k]?.flag} {LANGUAGES[k]?.label} (친구)
              </option>
            ))}
          </select>
        </div>

        {/* Mirror layout — vertical (top side flipped) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <InterpreterSide
            side="other"
            lang={partnerLang}
            value={meValue}
            state={otherState}
            onStart={() => startRecording("other")}
            onStop={() => stopRecording("other")}
            onReplay={() => meValue && speakText(meValue.translation, partnerLang)}
            flipped={true}
            errorMsg={errMsg}
            availableLangs={partnerOptions}
            onLangChange={(l) => { setPartnerLang(l); reset(); }}
          />

          {/* Divider */}
          <div style={{
            background: "#1F2937", height: 36, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#9CA3AF", fontSize: 11, fontWeight: 800, letterSpacing: 1, gap: 8,
            borderTop: "1px dashed rgba(255,255,255,0.12)", borderBottom: "1px dashed rgba(255,255,255,0.12)",
          }}>
            <BeeMascot size={22} mood="happy" flying={false} />
            서로 마주 보고 사용해요
          </div>

          <InterpreterSide
            side="me"
            lang={viewerLang}
            value={otherValue}
            state={meState}
            onStart={() => startRecording("me")}
            onStop={() => stopRecording("me")}
            onReplay={() => otherValue && speakText(otherValue.translation, viewerLang)}
            flipped={false}
            errorMsg={errMsg}
            availableLangs={[viewerLang]}
          />
        </div>

        <div style={{
          padding: "10px 14px 14px", flexShrink: 0,
          textAlign: "center", fontSize: 11, color: "#6B7280", fontWeight: 700,
        }}>
          💡 파파고처럼 내 목소리를 친구 말로 바꿔 주는 도구예요
        </div>
      </div>

      <style jsx global>{`
        @keyframes interpWave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.4); }
        }
        @keyframes interpDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40%           { transform: scale(1);   opacity: 1;   }
        }
        @keyframes interpRecPulse {
          0%, 100% { box-shadow: 0 14px 32px rgba(239,68,68,0.5), inset 0 -4px 0 rgba(0,0,0,0.18), 0 0 0 0 rgba(239,68,68,0.45); }
          50%      { box-shadow: 0 14px 32px rgba(239,68,68,0.5), inset 0 -4px 0 rgba(0,0,0,0.18), 0 0 0 14px rgba(239,68,68,0);    }
        }
      `}</style>
    </>
  );
}

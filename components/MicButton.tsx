"use client";

// 🎤 음성 입력 버튼 — 누르면 녹음, 다시 누르면(또는 8초 후) 인식해서
// onText 로 결과를 돌려준다. /api/stt (Whisper) 사용.
// 스토리북 핫시팅 챗·AI 튜터 챗에서 공용.

import React, { useEffect, useRef, useState } from "react";

const MAX_RECORD_MS = 8000;

export default function MicButton({
  lang, disabled, onText, size = 44,
}: {
  lang: string;
  disabled?: boolean;
  onText: (text: string) => void;
  size?: number;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false); // 인식(서버) 중
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const autoStopRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    try { recRef.current?.stop(); } catch { /* noop */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    if (recording || busy || disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        if (blob.size < 1000) { setBusy(false); return; } // 너무 짧음 — 무시
        setBusy(true);
        try {
          const form = new FormData();
          form.append("audio", new File([blob], "rec.webm", { type: blob.type }));
          form.append("lang", lang);
          const res = await fetch("/api/stt", { method: "POST", body: form });
          const j = (await res.json()) as { text?: string };
          const text = (j.text ?? "").trim();
          if (text) onText(text);
        } catch { /* 인식 실패 — 조용히 무시 */ }
        setBusy(false);
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      autoStopRef.current = window.setTimeout(() => stop(), MAX_RECORD_MS);
    } catch { /* 마이크 권한 거부 등 */ }
  }

  function stop() {
    if (autoStopRef.current) { window.clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    const r = recRef.current;
    if (r && r.state !== "inactive") r.stop();
    setRecording(false);
  }

  return (
    <button
      onClick={() => (recording ? stop() : start())}
      disabled={disabled || busy}
      aria-label={recording ? "녹음 끝내기" : "말로 입력하기"}
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: 14, border: "none",
        background: recording
          ? "linear-gradient(135deg, #EF4444, #DC2626)"
          : busy
            ? "#E5E7EB"
            : "linear-gradient(135deg, #F59E0B, #D97706)",
        color: "#fff", fontSize: size * 0.42, fontWeight: 900,
        cursor: disabled || busy ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: recording ? "0 0 0 4px rgba(239,68,68,0.25)" : "none",
        animation: recording ? "micPulse 1s ease-in-out infinite" : undefined,
        transition: "background 0.2s",
      }}
    >
      {busy ? "⋯" : recording ? "⏹" : "🎤"}
      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(239,68,68,0.25); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0.12); }
        }
      `}</style>
    </button>
  );
}

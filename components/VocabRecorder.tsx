"use client";

import { useState, useRef, useEffect } from "react";
import {
  uploadRecording,
  subscribeRecordings,
  RecordingPointer,
  RECORDING_TTL_MS,
} from "@/lib/vocabRecordings";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";
const RED = "#EF4444";

interface Props {
  sentenceText: string;
  onOriginalPlay: () => void;   // 원본 TTS 재생
  onComplete: () => void;        // 녹음 완료 (업로드 성공 후 호출)
  roomCode: string;
  clientId: string;
  wordId: string;
  sentenceIdx: number;
}

type State = "idle" | "recording" | "recorded" | "uploading" | "denied" | "unsupported";

export default function VocabRecorder({
  sentenceText, onOriginalPlay, onComplete,
  roomCode, clientId, wordId, sentenceIdx,
}: Props) {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [savedPtr, setSavedPtr] = useState<RecordingPointer | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 기존 녹음 포인터 구독 (예문 전환 시 새로고침)
  useEffect(() => {
    setSavedPtr(null);
    const unsub = subscribeRecordings(roomCode, clientId, wordId, (byIdx) => {
      const ptr = byIdx[sentenceIdx];
      setSavedPtr(ptr ?? null);
    });
    return () => unsub();
  }, [roomCode, clientId, wordId, sentenceIdx]);

  // 예문 전환 시 임시 상태 초기화
  useEffect(() => {
    setState("idle");
    setElapsed(0);
    setPendingBlob(null);
    setPendingDuration(0);
    setUploadError(null);
    if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordId, sentenceIdx]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    if (state === "recording" || state === "uploading") return;
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const duration = (Date.now() - startRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        setBlobUrl(URL.createObjectURL(blob));
        setPendingBlob(blob);
        setPendingDuration(duration);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setState("recorded");
      };
      recorderRef.current = rec;
      startRef.current = Date.now();
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 200);
      rec.start();
      setState("recording");

      setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === "recording") {
          stopRecording();
        }
      }, 15000);
    } catch {
      setState("denied");
    }
  }

  function stopRecording() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  function playLocalRecording() {
    if (!blobUrl) return;
    const a = new Audio(blobUrl);
    a.play().catch(() => {});
  }

  function playSavedRecording() {
    if (!savedPtr) return;
    const a = new Audio(savedPtr.audioUrl);
    a.play().catch(() => {});
  }

  function retry() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setPendingBlob(null);
    setPendingDuration(0);
    setElapsed(0);
    setUploadError(null);
    setState("idle");
  }

  async function uploadAndComplete() {
    if (!pendingBlob) return;
    setState("uploading");
    setUploadError(null);
    try {
      await uploadRecording({
        roomCode, clientId, wordId, sentenceIdx,
        blob: pendingBlob, duration: pendingDuration,
      });
      // 업로드 성공 → 로컬 임시 상태 정리, 상위에 완료 통지
      setPendingBlob(null);
      if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
      onComplete();
      // 'recorded' 상태는 subscribeRecordings 콜백에서 savedPtr 업데이트로 대체됨
      setState("idle");
    } catch (err) {
      console.warn("[vocab-recorder] 업로드 실패", err);
      setUploadError("업로드 실패 — 다시 시도해 주세요");
      setState("recorded");
    }
  }

  if (state === "unsupported") {
    return (
      <div style={boxStyle}>
        <div style={{ color: "#6B7280", fontSize: 14, fontWeight: 700, textAlign: "center" }}>
          이 브라우저는 녹음을 지원하지 않아요. 크롬/사파리 최신 버전을 사용해 주세요.
        </div>
      </div>
    );
  }

  const savedDaysLeft = savedPtr
    ? Math.max(0, Math.ceil((savedPtr.timestamp + RECORDING_TTL_MS - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <div style={boxStyle}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#4B5563", textAlign: "center", marginBottom: 10 }}>
        🎙️ 예문을 따라 말해 보세요
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
        <button
          onClick={onOriginalPlay}
          style={{
            background: PURPLE_LIGHT, color: PURPLE_DARK,
            border: "none", borderRadius: 12, padding: "10px 14px",
            fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}
        >🔊 원본 듣기</button>
        {savedPtr && (
          <button
            onClick={playSavedRecording}
            style={{
              background: "linear-gradient(135deg, #10B981, #059669)", color: "#fff",
              border: "none", borderRadius: 12, padding: "10px 14px",
              fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 10px rgba(16,185,129,0.3)",
            }}
          >🔊 저장된 녹음</button>
        )}
      </div>

      {savedPtr && savedDaysLeft !== null && (
        <div style={{
          fontSize: 11, fontWeight: 700, color: "#059669",
          textAlign: "center", marginBottom: 10,
        }}>
          💾 저장됨 · {savedDaysLeft}일 후 자동 삭제
        </div>
      )}

      {/* Main mic button */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        {state === "recording" ? (
          <button
            onClick={stopRecording}
            aria-label="녹음 중지"
            style={{
              width: 110, height: 110, borderRadius: "50%",
              background: "linear-gradient(135deg, " + RED + ", #DC2626)",
              border: "6px solid #FECACA",
              color: "#fff", fontSize: 22, fontWeight: 900,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 12px 30px rgba(239, 68, 68, 0.45)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 2,
              animation: "pulse 1.2s ease-in-out infinite",
            }}
          >
            <span style={{ fontSize: 30, lineHeight: 1 }}>⏹</span>
            <span style={{ fontSize: 13 }}>{elapsed}s</span>
          </button>
        ) : state === "uploading" ? (
          <div style={{
            width: 110, height: 110, borderRadius: "50%",
            background: PURPLE_LIGHT,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: PURPLE_DARK,
          }}>
            업로드 중…
          </div>
        ) : (
          <button
            onClick={startRecording}
            disabled={state === "denied"}
            aria-label={savedPtr ? "다시 녹음" : "녹음 시작"}
            style={{
              width: 110, height: 110, borderRadius: "50%",
              background: state === "denied"
                ? "#E5E7EB"
                : "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")",
              border: "6px solid " + PURPLE_LIGHT,
              color: "#fff", fontSize: 36, fontWeight: 900,
              cursor: state === "denied" ? "default" : "pointer",
              fontFamily: "inherit",
              boxShadow: state === "denied" ? "none" : "0 12px 30px rgba(139, 92, 246, 0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >🎙️</button>
        )}
      </div>

      {state === "denied" && (
        <div style={{ textAlign: "center", fontSize: 12, color: RED, fontWeight: 700, marginBottom: 8 }}>
          마이크 권한이 필요해요. 주소창 옆 🔒 에서 허용해 주세요.
        </div>
      )}

      {state === "recorded" && blobUrl && (
        <>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
            <button onClick={onOriginalPlay} style={compareBtnStyle(false)}>🔊 원본</button>
            <button onClick={playLocalRecording} style={compareBtnStyle(true)}>🔊 내 녹음</button>
          </div>
          {uploadError && (
            <div style={{ textAlign: "center", color: RED, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              {uploadError}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={retry}
              style={{
                flex: 1, background: "#F3F4F6", color: "#374151", border: "none",
                borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >↻ 다시 녹음</button>
            <button
              onClick={uploadAndComplete}
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #10B981, #059669)",
                color: "#fff", border: "none", borderRadius: 12, padding: "12px",
                fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 6px 14px rgba(16, 185, 129, 0.35)",
              }}
            >💾 저장 · 완료</button>
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 12px 30px rgba(239, 68, 68, 0.45); }
          50% { box-shadow: 0 12px 40px rgba(239, 68, 68, 0.7); }
        }
      `}</style>
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  background: "#FAFAFA",
  border: "2px dashed " + PURPLE + "44",
  borderRadius: 16,
  padding: "16px 14px",
};

function compareBtnStyle(mine: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: mine ? "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")" : PURPLE_LIGHT,
    color: mine ? "#fff" : PURPLE_DARK,
    border: "none", borderRadius: 12,
    padding: "10px 14px", fontSize: 13, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit",
  };
}

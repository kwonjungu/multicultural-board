"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ref,
  onValue,
  set,
  push,
} from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { BRAND_GRADIENT, LANGUAGES } from "@/lib/constants";
import { compressToUnder1MB } from "@/lib/imageUtils";
import { SessionMeta, SessionResponse } from "@/lib/types";
import { BOOK_STUDY_SAMPLES, BookStudySample } from "@/lib/bookStudySamples";

/* ─────────── Types ─────────── */
type InputMode = "text" | "voice" | "draw";

interface Props {
  roomCode: string;
  isTeacher: boolean;
  myClientId: string;
  myName: string;
  myLang: string;
  roomLangs: string[];
  onBack: () => void;
}

/* ─────────── Constants ─────────── */
const POSTIT_COLORS = [
  "#FEF3C7", "#DBEAFE", "#FCE7F3", "#D1FAE5", "#EDE9FE",
  "#FEE2E2", "#FFEDD5", "#E0F2FE", "#F3E8FF", "#FEF9C3",
  "#CFFAFE", "#FDE68A", "#C7D2FE", "#FECACA", "#BBF7D0",
];

/* ─────────── Main Component ─────────── */
export default function BookStudy({
  roomCode,
  isTeacher,
  myClientId,
  myName,
  myLang,
  roomLangs,
  onBack,
}: Props) {
  const basePath = `rooms/${roomCode}/bookStudy`;
  const [session, setSession] = useState<SessionMeta | null>(null);
  const [responses, setResponses] = useState<SessionResponse[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Teacher creation state
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [characterImg, setCharacterImg] = useState("");
  const [uploading, setUploading] = useState(false);

  // ── Subscribe to session ──
  useEffect(() => {
    const db = getClientDb();
    const metaRef = ref(db, `${basePath}/meta`);
    const unsub = onValue(metaRef, (snap) => {
      setSession(snap.val() as SessionMeta | null);
    });
    return () => unsub();
  }, [basePath]);

  // ── Subscribe to responses ──
  useEffect(() => {
    const db = getClientDb();
    const respRef = ref(db, `${basePath}/responses`);
    const unsub = onValue(respRef, (snap) => {
      const val = snap.val() as Record<string, SessionResponse> | null;
      if (!val) { setResponses([]); return; }
      const list = Object.entries(val).map(([id, r]) => ({ ...r, id }));
      list.sort((a, b) => a.timestamp - b.timestamp);
      setResponses(list);
    });
    return () => unsub();
  }, [basePath]);

  const myResponse = useMemo(
    () => responses.find((r) => r.authorClientId === myClientId),
    [responses, myClientId],
  );

  // ── Teacher: create session ──
  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      // Translate title
      const targets = roomLangs.filter((l) => l !== myLang);
      let titleTranslations: Record<string, string> = { [myLang]: newTitle.trim() };
      let bodyTextTranslations: Record<string, string> = { [myLang]: newBody.trim() };
      if (targets.length > 0) {
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: newTitle.trim(),
              fromLang: myLang, targetLangs: targets,
              authorName: myName, isTeacher: true, paletteIdx: 0,
              roomCode, cardType: "comment",
            }),
          });
          const data = await res.json();
          if (data.translations) titleTranslations = data.translations;
        } catch {}
        if (newBody.trim()) {
          try {
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: newBody.trim(),
                fromLang: myLang, targetLangs: targets,
                authorName: myName, isTeacher: true, paletteIdx: 0,
                roomCode, cardType: "comment",
              }),
            });
            const data = await res.json();
            if (data.translations) bodyTextTranslations = data.translations;
          } catch {}
        }
      }

      const db = getClientDb();
      const meta: Record<string, unknown> = {
        id: "bookStudy",
        title: newTitle.trim(),
        titleTranslations,
        startedAt: Date.now(),
        status: "active",
        teacherClientId: myClientId,
        teacherLang: myLang,
        teacherName: myName,
        targetLangs: roomLangs,
      };
      // Firebase rejects undefined — only add optional fields if they have values
      if (newBody.trim()) {
        meta.bodyText = newBody.trim();
        meta.bodyTextTranslations = bodyTextTranslations;
      }
      if (characterImg) {
        meta.imageUrl = characterImg;
      }
      await set(ref(db, `${basePath}/meta`), meta);
      await set(ref(db, `${basePath}/responses`), null);
      setNewTitle("");
      setNewBody("");
      setCharacterImg("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    }
    setCreating(false);
  }

  // ── Image upload (character image) ──
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressToUnder1MB(file);
      const form = new FormData();
      form.append("file", new File([compressed], "character.png", { type: "image/png" }));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "업로드 실패");
      setCharacterImg(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
    }
    setUploading(false);
  }

  // ── Student submit ──
  async function handleSubmit(text: string) {
    if (!text.trim() || submitting || isTeacher) return;
    setSubmitting(true);
    setError("");
    try {
      const targets = roomLangs.filter((l) => l !== myLang);
      let translations: Record<string, string> = { [myLang]: text.trim() };
      if (targets.length > 0) {
        try {
          const tres = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: text.trim(),
              fromLang: myLang, targetLangs: targets,
              authorName: myName, isTeacher: false, paletteIdx: 0,
              roomCode, cardType: "comment",
            }),
          });
          const tdata = await tres.json();
          if (tdata.translations) translations = tdata.translations;
        } catch {}
      }

      const db = getClientDb();
      const respRef = ref(db, `${basePath}/responses`);
      const newRef = push(respRef);
      await set(newRef, {
        authorName: myName,
        authorLang: myLang,
        authorClientId: myClientId,
        text: text.trim(),
        translations,
        timestamp: Date.now(),
      });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "제출 실패");
    }
    setSubmitting(false);
  }

  // ── Teacher: end session ──
  async function handleEndSession() {
    if (!confirm("세션을 종료할까요?")) return;
    try {
      const db = getClientDb();
      await set(ref(db, `${basePath}/meta/status`), "closed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "종료 실패");
    }
  }

  async function handleDeleteSession() {
    if (!confirm("세션을 삭제할까요?")) return;
    try {
      const db = getClientDb();
      await set(ref(db, `${basePath}/meta`), null);
      await set(ref(db, `${basePath}/responses`), null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  }

  const displayTitle = session?.titleTranslations?.[myLang] || session?.title || "";
  const displayBody = session?.bodyTextTranslations?.[myLang] || session?.bodyText || "";

  // ══════════════ RENDER ══════════════
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #FFF7ED 0%, #FEF3C7 50%, #FFEDD5 100%)",
      fontFamily: "'Noto Sans KR', sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background pattern */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "url('/patterns/honeycomb.png')",
        backgroundSize: "300px auto", backgroundRepeat: "repeat", opacity: 0.12,
      }} />

      <div style={{
        maxWidth: 900, margin: "0 auto", padding: "20px 16px",
        position: "relative", zIndex: 1,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
        }}>
          <button onClick={onBack} style={{
            width: 44, height: 44, borderRadius: 14,
            background: "#fff", border: "2px solid #FDE68A",
            fontSize: 18, fontWeight: 900, color: "#92400E", cursor: "pointer",
          }}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#92400E", margin: 0 }}>
              📖 그림책 공부
            </h1>
            <p style={{ fontSize: 12, color: "#B45309", margin: 0, marginTop: 2 }}>
              캐릭터가 질문하고, 포스트잇으로 답해요!
            </p>
          </div>
          {isTeacher && session && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleEndSession} style={{
                padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E",
                cursor: "pointer",
              }}>종료</button>
              <button onClick={handleDeleteSession} style={{
                padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                background: "#FEE2E2", border: "1px solid #FECACA", color: "#991B1B",
                cursor: "pointer",
              }}>삭제</button>
            </div>
          )}
        </div>

        {/* ══════ No session: Teacher creates / Student waits ══════ */}
        {!session && (
          isTeacher ? (
            <TeacherCreatePanel
              newTitle={newTitle}
              setNewTitle={setNewTitle}
              newBody={newBody}
              setNewBody={setNewBody}
              characterImg={characterImg}
              setCharacterImg={setCharacterImg}
              uploading={uploading}
              creating={creating}
              error={error}
              onImageUpload={handleImageUpload}
              onCreate={handleCreate}
              myLang={myLang}
            />
          ) : (
            <WaitingScreen />
          )
        )}

        {/* ══════ Active session ══════ */}
        {session && session.status === "active" && (
          <>
            {/* Character asking question */}
            <CharacterQuestion
              title={displayTitle}
              body={displayBody}
              imageUrl={session.imageUrl}
            />

            {/* Post-it board — real-time responses */}
            <PostItBoard responses={responses} myLang={myLang} />

            {/* Student input area */}
            {!isTeacher && !myResponse && (
              <StudentInput
                inputMode={inputMode}
                setInputMode={setInputMode}
                draft={draft}
                setDraft={setDraft}
                submitting={submitting}
                myLang={myLang}
                myName={myName}
                onSubmit={handleSubmit}
                error={error}
              />
            )}

            {!isTeacher && myResponse && (
              <div style={{
                marginTop: 20, padding: 18, background: "#ECFDF5",
                borderRadius: 16, border: "1px solid #A7F3D0", textAlign: "center",
              }}>
                <div style={{ fontSize: 26 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#065F46", marginTop: 6 }}>
                  제출 완료! 다른 친구들의 의견을 확인해보세요.
                </div>
              </div>
            )}

            {/* Teacher: stats */}
            {isTeacher && (
              <div style={{
                marginTop: 20, padding: 16, background: "#fff",
                borderRadius: 16, border: "2px solid #FDE68A",
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#92400E" }}>
                  📊 응답 현황: {responses.length}명 제출
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════ Closed session — radial opinion view ══════ */}
        {session && session.status === "closed" && (
          <ClosedRadialView
            title={displayTitle}
            body={displayBody}
            imageUrl={session.imageUrl}
            responses={responses}
            myLang={myLang}
          />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ Sub-components ═══════════════════════════ */

function CharacterQuestion({
  title,
  body,
  imageUrl,
}: { title: string; body: string; imageUrl?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      marginBottom: 24,
    }}>
      {/* Character image */}
      <div style={{
        position: "relative", marginBottom: 12,
      }}>
        <div style={{
          width: 120, height: 120, borderRadius: "50%",
          background: imageUrl
            ? `url(${imageUrl}) center/cover no-repeat`
            : "linear-gradient(135deg, #FDE68A, #F59E0B)",
          border: "4px solid #fff",
          boxShadow: "0 8px 24px rgba(245,158,11,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {!imageUrl && (
            <span style={{ fontSize: 48 }}>🐝</span>
          )}
        </div>
        {/* Speaking indicator */}
        <div style={{
          position: "absolute", bottom: -4, right: -4,
          width: 28, height: 28, borderRadius: "50%",
          background: "#10B981", border: "3px solid #fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12,
        }}>💬</div>
      </div>

      {/* Speech bubble */}
      <div style={{
        position: "relative",
        background: "#fff",
        borderRadius: 24,
        padding: "20px 28px",
        maxWidth: 520,
        width: "100%",
        boxShadow: "0 12px 32px rgba(180,83,9,0.15)",
        border: "2px solid #FDE68A",
        textAlign: "center",
      }}>
        {/* Triangle pointer */}
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft: "12px solid transparent",
          borderRight: "12px solid transparent",
          borderBottom: "12px solid #fff",
          filter: "drop-shadow(0 -2px 1px rgba(253,230,138,0.6))",
        }} />
        <div style={{
          fontSize: 11, fontWeight: 900, color: "#F59E0B",
          letterSpacing: 1, marginBottom: 8,
        }}>
          캐릭터의 질문
        </div>
        <div style={{
          fontSize: 20, fontWeight: 900, color: "#1F2937",
          lineHeight: 1.4,
        }}>
          {title}
        </div>
        {body && (
          <div style={{
            fontSize: 14, color: "#6B7280", marginTop: 10,
            lineHeight: 1.6, whiteSpace: "pre-wrap",
          }}>
            {body}
          </div>
        )}
      </div>
    </div>
  );
}

function PostItBoard({ responses, myLang }: { responses: SessionResponse[]; myLang: string }) {
  if (responses.length === 0) {
    return (
      <div style={{
        padding: "40px 20px", textAlign: "center",
        background: "rgba(255,255,255,0.5)", borderRadius: 20,
        border: "2px dashed #FDE68A",
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
        <div style={{ fontSize: 14, color: "#92400E", fontWeight: 600 }}>
          아직 포스트잇이 없어요. 첫 번째 의견을 남겨보세요!
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
      gap: 14,
      padding: 8,
    }}>
      {responses.map((r, i) => {
        const bg = POSTIT_COLORS[i % POSTIT_COLORS.length];
        const text = r.translations?.[myLang] || r.text;
        const rotation = ((i * 7 + 3) % 7) - 3; // -3 to +3 degrees
        return (
          <div
            key={r.id}
            style={{
              background: bg,
              borderRadius: 4,
              padding: "16px 14px 12px",
              boxShadow: "2px 4px 12px rgba(0,0,0,0.12), 0 1px 0 rgba(0,0,0,0.05)",
              transform: `rotate(${rotation}deg)`,
              transition: "transform 0.2s, box-shadow 0.2s",
              cursor: "default",
              position: "relative",
              minHeight: 100,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              animation: `postItDrop 0.3s ease ${i * 0.05}s both`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "rotate(0deg) scale(1.05)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "4px 8px 20px rgba(0,0,0,0.18)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = `rotate(${rotation}deg)`;
              (e.currentTarget as HTMLDivElement).style.boxShadow = "2px 4px 12px rgba(0,0,0,0.12)";
            }}
          >
            {/* Tape effect */}
            <div style={{
              position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
              width: 40, height: 12, background: "rgba(245,158,11,0.3)",
              borderRadius: 2,
            }} />
            <div style={{
              fontSize: 13, color: "#1F2937", lineHeight: 1.5,
              wordBreak: "break-word", whiteSpace: "pre-wrap",
            }}>
              {text}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 800, color: "#6B7280",
              marginTop: 8, borderTop: "1px dashed rgba(0,0,0,0.1)",
              paddingTop: 6, display: "flex", alignItems: "center", gap: 4,
            }}>
              {LANGUAGES[r.authorLang]?.flag || "🌐"} {r.authorName}
            </div>
          </div>
        );
      })}

      <style jsx global>{`
        @keyframes postItDrop {
          0% { opacity: 0; transform: translateY(-20px) rotate(0deg) scale(0.8); }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ─────────── Student Input with 3 modes ─────────── */
function StudentInput({
  inputMode, setInputMode, draft, setDraft,
  submitting, myLang, myName, onSubmit, error,
}: {
  inputMode: InputMode;
  setInputMode: (m: InputMode) => void;
  draft: string;
  setDraft: (s: string) => void;
  submitting: boolean;
  myLang: string;
  myName: string;
  onSubmit: (text: string) => void;
  error: string;
}) {
  return (
    <div style={{
      marginTop: 24, background: "#fff", borderRadius: 20,
      padding: "20px 18px", border: "2px solid #FDE68A",
      boxShadow: "0 8px 24px rgba(180,83,9,0.1)",
    }}>
      {/* Mode tabs */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 16,
        background: "#FEF3C7", borderRadius: 12, padding: 4,
      }}>
        {([
          { id: "text" as InputMode, label: "✏️ 글자", desc: "텍스트" },
          { id: "voice" as InputMode, label: "🎤 말", desc: "음성" },
          { id: "draw" as InputMode, label: "🖌️ 그리기", desc: "손글씨" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setInputMode(tab.id)}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 10,
              background: inputMode === tab.id ? "#fff" : "transparent",
              border: inputMode === tab.id ? "2px solid #F59E0B" : "2px solid transparent",
              boxShadow: inputMode === tab.id ? "0 2px 8px rgba(245,158,11,0.2)" : "none",
              fontSize: 13, fontWeight: 800,
              color: inputMode === tab.id ? "#92400E" : "#B45309",
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Text mode */}
      {inputMode === "text" && (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="생각을 자유롭게 적어보세요..."
            rows={3}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: "2px solid #E5E7EB", fontSize: 15, color: "#111827",
              background: "#FAFAFA", outline: "none", boxSizing: "border-box",
              resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
            }}
            onFocus={(e) => { e.target.style.borderColor = "#F59E0B"; }}
            onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; }}
          />
        </div>
      )}

      {/* Voice mode */}
      {inputMode === "voice" && (
        <VoiceInput
          myLang={myLang}
          onTranscript={(text) => setDraft(text)}
          draft={draft}
        />
      )}

      {/* Drawing mode */}
      {inputMode === "draw" && (
        <DrawingInput onText={(text) => setDraft(text)} draft={draft} />
      )}

      {/* Submit */}
      {draft && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: "#F9FAFB", borderRadius: 10, fontSize: 13, color: "#374151" }}>
          <strong>미리보기:</strong> {draft}
        </div>
      )}

      <button
        onClick={() => onSubmit(draft)}
        disabled={!draft.trim() || submitting}
        style={{
          width: "100%", marginTop: 12, padding: "14px 0", borderRadius: 14,
          fontSize: 15, fontWeight: 800, border: "none",
          background: !draft.trim() || submitting ? "#E5E7EB" : BRAND_GRADIENT,
          color: !draft.trim() || submitting ? "#9CA3AF" : "#fff",
          cursor: !draft.trim() || submitting ? "not-allowed" : "pointer",
          boxShadow: !draft.trim() || submitting ? "none" : "0 4px 16px rgba(245,158,11,0.4)",
        }}
      >
        {submitting ? "제출 중..." : "📨 포스트잇 붙이기"}
      </button>

      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
          {error}
        </div>
      )}
    </div>
  );
}

/* ─────────── Voice Input ─────────── */
function VoiceInput({ myLang, onTranscript, draft }: { myLang: string; onTranscript: (t: string) => void; draft: string }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Safari doesn't support audio/webm — use mp4 or let browser choose
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : undefined;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const ext = mimeType?.includes("mp4") ? "mp4" : "webm";
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        setProcessing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, `recording.${ext}`);
          form.append("lang", myLang);
          const res = await fetch("/api/stt", { method: "POST", body: form });
          const data = await res.json();
          if (data.text) onTranscript(data.text);
          else alert("음성을 인식하지 못했어요. 다시 시도해주세요.");
        } catch {
          alert("음성 인식에 실패했어요. 네트워크를 확인해주세요.");
        }
        setProcessing(false);
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
    } catch {
      alert("마이크를 사용할 수 없어요.");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      {processing ? (
        <div style={{ fontSize: 14, color: "#6B7280", fontWeight: 600 }}>
          🔄 음성을 글자로 변환 중...
        </div>
      ) : (
        <button
          onClick={recording ? stopRecording : startRecording}
          style={{
            width: 80, height: 80, borderRadius: "50%",
            background: recording
              ? "linear-gradient(135deg, #EF4444, #DC2626)"
              : "linear-gradient(135deg, #F59E0B, #D97706)",
            border: "none", cursor: "pointer",
            boxShadow: recording
              ? "0 0 0 8px rgba(239,68,68,0.2)"
              : "0 4px 16px rgba(245,158,11,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, color: "#fff",
            animation: recording ? "pulse 1s ease-in-out infinite" : "none",
          }}
        >
          {recording ? "⏹" : "🎤"}
        </button>
      )}
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 10 }}>
        {recording ? "녹음 중... 버튼을 눌러 멈추세요" : "버튼을 눌러 말해보세요"}
      </div>
      {draft && (
        <div style={{ marginTop: 12, fontSize: 13, color: "#374151", fontWeight: 600 }}>
          인식 결과: &ldquo;{draft}&rdquo;
        </div>
      )}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

/* ─────────── Drawing Input (Canvas) ─────────── */
function DrawingInput({ onText, draft }: { onText: (t: string) => void; draft: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Fix HiDPI/responsive canvas resolution
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function handleStart(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  }

  function handleMove(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && lastPos.current) {
      ctx.strokeStyle = "#1F2937";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPos.current = pos;
  }

  function handleEnd() {
    setDrawing(false);
    lastPos.current = null;
  }

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
  }

  async function recognizeHandwriting() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setProcessing(true);
    try {
      // Convert canvas to image and send to a simple OCR-like approach
      // We'll use the canvas as an image and pass it via the upload + vision approach
      canvas.toBlob(async (blob) => {
        if (!blob) { setProcessing(false); return; }
        // Upload the image
        const form = new FormData();
        form.append("file", new File([blob], "drawing.png", { type: "image/png" }));
        const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
        const uploadData = await uploadRes.json();
        if (!uploadData.url) { setProcessing(false); return; }

        // Use translate API with a special hint to read handwriting
        // For now, just prompt the user to type what they drew
        // In production, integrate with a handwriting OCR service
        const text = prompt("그린 글자를 입력해주세요 (OCR 연동 예정):");
        if (text) onText(text);
        setProcessing(false);
      }, "image/png");
    } catch {
      setProcessing(false);
    }
  }

  return (
    <div>
      <div style={{
        position: "relative",
        border: "2px solid #E5E7EB",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
        touchAction: "none",
      }}>
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          style={{ width: "100%", height: 200, display: "block", cursor: "crosshair" }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
        {/* Placeholder text */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          pointerEvents: "none", color: "#D1D5DB", fontSize: 14, fontWeight: 600,
        }}>
          여기에 손글씨를 써보세요
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={clearCanvas}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            background: "#F3F4F6", border: "1px solid #E5E7EB",
            fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer",
          }}
        >🗑️ 지우기</button>
        <button
          onClick={recognizeHandwriting}
          disabled={processing}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            background: "#FEF3C7", border: "1px solid #FDE68A",
            fontSize: 13, fontWeight: 700, color: "#92400E", cursor: "pointer",
          }}
        >
          {processing ? "인식 중..." : "✨ 글자 인식"}
        </button>
      </div>
      {draft && (
        <div style={{ marginTop: 10, fontSize: 13, color: "#374151", fontWeight: 600 }}>
          인식 결과: &ldquo;{draft}&rdquo;
        </div>
      )}
    </div>
  );
}

/* ─────────── Teacher Create Panel ─────────── */
function TeacherCreatePanel({
  newTitle, setNewTitle, newBody, setNewBody,
  characterImg, uploading, creating, error,
  onImageUpload, onCreate, setCharacterImg, myLang,
}: {
  newTitle: string; setNewTitle: (s: string) => void;
  newBody: string; setNewBody: (s: string) => void;
  characterImg: string; uploading: boolean; creating: boolean; error: string;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCreate: () => void;
  setCharacterImg: (s: string) => void;
  myLang: string;
}) {
  const [showSamples, setShowSamples] = useState(false);

  function applySample(sample: BookStudySample, questionIdx: number) {
    const q = sample.questions[questionIdx];
    setNewTitle(q.text[myLang] || q.text.ko);
    setCharacterImg(sample.character.imageUrl);
    setShowSamples(false);
  }

  return (
    <div style={{
      background: "#fff", borderRadius: 24, padding: "28px 22px",
      border: "2px solid #FDE68A",
      boxShadow: "0 12px 32px rgba(180,83,9,0.12)",
    }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <img
          src="/mascot/bee-think.png"
          alt=""
          style={{ width: 80, height: 80, objectFit: "contain" }}
        />
        <h2 style={{ fontSize: 18, fontWeight: 900, color: "#92400E", marginTop: 10 }}>
          그림책 질문 만들기
        </h2>
        <p style={{ fontSize: 13, color: "#B45309" }}>
          캐릭터 이미지를 업로드하거나, 아래 샘플을 선택해보세요!
        </p>
      </div>

      {/* ── Sample picker ── */}
      <div style={{ marginBottom: 18 }}>
        <button
          onClick={() => setShowSamples(!showSamples)}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 14,
            background: "linear-gradient(135deg, #EDE9FE, #DDD6FE)",
            border: "2px solid #C4B5FD",
            fontSize: 14, fontWeight: 800, color: "#5B21B6",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}
        >
          📚 샘플 그림책에서 불러오기 {showSamples ? "▲" : "▼"}
        </button>

        {showSamples && (
          <div style={{
            marginTop: 10, background: "#F5F3FF", borderRadius: 16,
            padding: 14, border: "1px solid #DDD6FE",
            maxHeight: 320, overflowY: "auto",
          }}>
            {BOOK_STUDY_SAMPLES.map((sample) => (
              <div key={sample.id} style={{ marginBottom: 14 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 8,
                }}>
                  <img
                    src={sample.character.imageUrl}
                    alt=""
                    style={{
                      width: 40, height: 40, borderRadius: "50%",
                      objectFit: "cover", border: "2px solid #C4B5FD",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#5B21B6" }}>
                      {sample.character.emoji} {sample.character.name[myLang] || sample.character.name.ko}
                    </div>
                    <div style={{ fontSize: 11, color: "#7C3AED" }}>
                      {sample.bookTitle[myLang] || sample.bookTitle.ko}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 50 }}>
                  {sample.questions.map((q, qi) => (
                    <button
                      key={q.id}
                      onClick={() => applySample(sample, qi)}
                      style={{
                        textAlign: "left", padding: "8px 12px", borderRadius: 10,
                        background: "#fff", border: "1px solid #E5E7EB",
                        fontSize: 12, color: "#374151", cursor: "pointer",
                        lineHeight: 1.4,
                        transition: "border-color 0.2s",
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.borderColor = "#8B5CF6"; }}
                      onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.borderColor = "#E5E7EB"; }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#9CA3AF", marginRight: 6 }}>
                        {q.tier === "intro" ? "도입" : q.tier === "core" ? "핵심" : q.tier === "deep" ? "심화" : "개념"}
                      </span>
                      {q.text[myLang] || q.text.ko}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Character image upload */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: "#374151", display: "block", marginBottom: 6 }}>
          📷 캐릭터 이미지 (그림책에서 추출)
        </label>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
        }}>
          {characterImg ? (
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: `url(${characterImg}) center/cover`,
              border: "3px solid #FDE68A",
              flexShrink: 0,
            }} />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "#FEF3C7", border: "2px dashed #FDE68A",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, flexShrink: 0,
            }}>📷</div>
          )}
          <label style={{
            padding: "10px 16px", borderRadius: 10,
            background: "#FEF3C7", border: "1px solid #FDE68A",
            fontSize: 13, fontWeight: 700, color: "#92400E",
            cursor: uploading ? "wait" : "pointer",
          }}>
            {uploading ? "업로드 중..." : "이미지 선택"}
            <input
              type="file"
              accept="image/*"
              onChange={onImageUpload}
              style={{ display: "none" }}
              disabled={uploading}
            />
          </label>
        </div>
        <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
          💡 rembg, SAM, transparent-background 등으로 배경을 제거한 캐릭터 PNG 권장
        </p>
      </div>

      {/* Question */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: "#374151", display: "block", marginBottom: 6 }}>
          ❓ 질문 (캐릭터가 물어볼 내용)
        </label>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="예: 이 장면에서 주인공은 어떤 기분일까요?"
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: "2px solid #E5E7EB", fontSize: 15, color: "#111827",
            outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Body text */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: "#374151", display: "block", marginBottom: 6 }}>
          📝 추가 설명 (선택)
        </label>
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="힌트나 배경 설명..."
          rows={2}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: "2px solid #E5E7EB", fontSize: 14, color: "#111827",
            outline: "none", boxSizing: "border-box", resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </div>

      <button
        onClick={onCreate}
        disabled={!newTitle.trim() || creating}
        style={{
          width: "100%", padding: "14px 0", borderRadius: 14,
          fontSize: 15, fontWeight: 800, border: "none",
          background: !newTitle.trim() || creating ? "#E5E7EB" : BRAND_GRADIENT,
          color: !newTitle.trim() || creating ? "#9CA3AF" : "#fff",
          cursor: !newTitle.trim() || creating ? "not-allowed" : "pointer",
          boxShadow: !newTitle.trim() || creating ? "none" : "0 4px 16px rgba(245,158,11,0.4)",
        }}
      >
        {creating ? "생성 중..." : "🚀 질문 시작하기"}
      </button>

      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#DC2626", fontWeight: 600 }}>{error}</div>
      )}
    </div>
  );
}

function WaitingScreen() {
  return (
    <div style={{
      textAlign: "center", padding: "60px 20px",
      background: "#fff", borderRadius: 24, border: "2px solid #FDE68A",
    }}>
      <img
        src="/mascot/bee-welcome.png"
        alt=""
        style={{ width: 100, height: 100, objectFit: "contain", marginBottom: 16 }}
      />
      <div style={{ fontSize: 16, fontWeight: 800, color: "#92400E" }}>
        선생님이 질문을 준비하고 있어요...
      </div>
      <div style={{ fontSize: 13, color: "#B45309", marginTop: 8 }}>
        잠시만 기다려주세요! 곧 캐릭터가 질문할 거예요 🐝
      </div>
    </div>
  );
}

/* ─────────── Closed Radial View — 그림책 중앙 + 의견 방사형 ─────────── */
function ClosedRadialView({
  title, body, imageUrl, responses, myLang,
}: {
  title: string; body: string; imageUrl?: string;
  responses: SessionResponse[]; myLang: string;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const n = responses.length;

  // 0 responses
  if (n === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <CharacterQuestion title={title} body={body} imageUrl={imageUrl} />
        <div style={{
          marginTop: 20, padding: 24, background: "#F9FAFB",
          borderRadius: 16, border: "1px dashed #D1D5DB",
        }}>
          <div style={{ fontSize: 14, color: "#6B7280" }}>
            🏁 세션이 종료되었지만 제출된 의견이 없습니다.
          </div>
        </div>
      </div>
    );
  }

  // 15+ responses: switch to grid layout instead of radial
  if (n > 15) {
    return (
      <div>
        <CharacterQuestion title={title} body={body} imageUrl={imageUrl} />
        <div style={{
          marginTop: 8, textAlign: "center", fontSize: 12, fontWeight: 800,
          color: "#92400E", background: "#FEF3C7", padding: "6px 14px",
          borderRadius: 99, display: "inline-block",
        }}>
          🏁 {n}개 의견
        </div>
        <PostItBoard responses={responses} myLang={myLang} />
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Radial layout container */}
      <div style={{
        position: "relative",
        width: "100%",
        minHeight: Math.max(500, n > 8 ? 650 : 550),
        overflow: "visible",
      }}>
        {/* Center: character + question */}
        <div style={{
          position: "absolute",
          left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          display: "flex", flexDirection: "column", alignItems: "center",
          width: 220,
        }}>
          {/* Character circle */}
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            background: imageUrl
              ? `url(${imageUrl}) center/cover no-repeat`
              : "linear-gradient(135deg, #FDE68A, #F59E0B)",
            border: "4px solid #fff",
            boxShadow: "0 8px 28px rgba(245,158,11,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", flexShrink: 0,
          }}>
            {!imageUrl && <span style={{ fontSize: 40 }}>🐝</span>}
          </div>
          {/* Question card */}
          <div style={{
            marginTop: 10,
            background: "#fff",
            borderRadius: 16,
            padding: "14px 16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            border: "2px solid #F59E0B",
            textAlign: "center",
            width: "100%",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#F59E0B", letterSpacing: 1, marginBottom: 4 }}>
              ❓ 질문
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937", lineHeight: 1.35 }}>
              {title}
            </div>
          </div>
          <div style={{
            marginTop: 8, fontSize: 12, fontWeight: 800, color: "#92400E",
            background: "#FEF3C7", padding: "4px 12px", borderRadius: 99,
          }}>
            🏁 {n}개 의견
          </div>
        </div>

        {/* Radial post-its */}
        {responses.map((r, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const radiusX = n <= 6 ? 38 : n <= 12 ? 42 : 44;
          const radiusY = n <= 6 ? 36 : n <= 12 ? 40 : 42;
          const cx = 50 + Math.cos(angle) * radiusX;
          const cy = 50 + Math.sin(angle) * radiusY;
          const bg = POSTIT_COLORS[i % POSTIT_COLORS.length];
          const text = r.translations?.[myLang] || r.text;
          const rotation = ((i * 5 + 2) % 9) - 4;

          return (
            <button
              key={r.id}
              onClick={() => setSelectedIdx(i)}
              style={{
                position: "absolute",
                left: `${cx}%`, top: `${cy}%`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                zIndex: 5,
                background: bg,
                border: "none",
                borderRadius: 4,
                padding: "12px 10px 8px",
                width: n <= 6 ? 150 : n <= 12 ? 130 : 110,
                boxShadow: "2px 4px 12px rgba(0,0,0,0.15)",
                cursor: "pointer",
                textAlign: "left",
                animation: `postItPop 0.4s cubic-bezier(.17,.89,.32,1.28) ${i * 0.06}s both`,
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translate(-50%, -55%) rotate(0deg) scale(1.1)";
                (e.currentTarget as HTMLButtonElement).style.zIndex = "20";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
                (e.currentTarget as HTMLButtonElement).style.zIndex = "5";
              }}
            >
              {/* Tape */}
              <div style={{
                position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)",
                width: 30, height: 10, background: "rgba(245,158,11,0.3)", borderRadius: 2,
              }} />
              <div style={{
                fontSize: 11, color: "#1F2937", lineHeight: 1.4,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const,
                wordBreak: "break-word",
              }}>
                {text}
              </div>
              <div style={{
                fontSize: 9, fontWeight: 800, color: "#6B7280",
                marginTop: 6, borderTop: "1px dashed rgba(0,0,0,0.1)", paddingTop: 4,
              }}>
                {LANGUAGES[r.authorLang]?.flag || "🌐"} {r.authorName}
              </div>
            </button>
          );
        })}

        {/* Connection lines from center to each post-it */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {responses.map((r, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const radiusX = n <= 6 ? 38 : n <= 12 ? 42 : 44;
            const radiusY = n <= 6 ? 36 : n <= 12 ? 40 : 42;
            const cx = 50 + Math.cos(angle) * radiusX;
            const cy = 50 + Math.sin(angle) * radiusY;
            return (
              <line
                key={r.id}
                x1="50" y1="50" x2={cx} y2={cy}
                stroke="#FDE68A" strokeWidth="0.3" strokeDasharray="1 1"
                opacity="0.6"
              />
            );
          })}
        </svg>
      </div>

      {/* Detail modal */}
      {selectedIdx !== null && responses[selectedIdx] && (
        <div
          onClick={() => setSelectedIdx(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(17,24,39,0.5)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, animation: "fadeIn 0.2s",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: POSTIT_COLORS[selectedIdx % POSTIT_COLORS.length],
              borderRadius: 8, maxWidth: 400, width: "100%",
              padding: "24px 22px", boxShadow: "4px 8px 30px rgba(0,0,0,0.25)",
              position: "relative",
              animation: "postItPop 0.3s cubic-bezier(.17,.89,.32,1.28)",
            }}
          >
            {/* Tape */}
            <div style={{
              position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
              width: 60, height: 16, background: "rgba(245,158,11,0.35)", borderRadius: 3,
            }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "#FEF3C7", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 18, border: "2px solid #FDE68A",
              }}>
                {LANGUAGES[responses[selectedIdx].authorLang]?.flag || "🌐"}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937" }}>
                  {responses[selectedIdx].authorName}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
                  {LANGUAGES[responses[selectedIdx].authorLang]?.label || responses[selectedIdx].authorLang}
                </div>
              </div>
            </div>
            <div style={{
              fontSize: 16, fontWeight: 600, color: "#1F2937",
              lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {responses[selectedIdx].translations?.[myLang] || responses[selectedIdx].text}
            </div>
            {responses[selectedIdx].authorLang !== myLang && (
              <div style={{
                marginTop: 12, padding: "8px 12px",
                background: "rgba(255,255,255,0.6)",
                borderRadius: 8, fontSize: 12, color: "#6B7280",
                fontStyle: "italic",
              }}>
                원문: &ldquo;{responses[selectedIdx].text}&rdquo;
              </div>
            )}
            <button
              onClick={() => setSelectedIdx(null)}
              style={{
                width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 12,
                background: "rgba(0,0,0,0.08)", border: "none",
                fontSize: 14, fontWeight: 800, color: "#374151", cursor: "pointer",
              }}
            >닫기</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes postItPop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3) rotate(0deg); }
          100% { opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

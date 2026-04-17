"use client";

import { useState } from "react";
import { ref, push, set } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { compressToUnder1MB } from "@/lib/imageUtils";
import { BRAND_GRADIENT } from "@/lib/constants";
import { SessionMeta } from "@/lib/types";

interface Props {
  roomCode: string;
  teacherClientId: string;
  teacherName: string;
  teacherLang: string;
  roomLangs: string[];
  onClose: () => void;
  onCreated?: (sessionId: string) => void;
}

export default function DiscussionCreateModal({
  roomCode,
  teacherClientId,
  teacherName,
  teacherLang,
  roomLangs,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const compressed = await compressToUnder1MB(file);
      const form = new FormData();
      form.append("file", new File([compressed], "image.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "업로드 실패");
      setImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
    }
    setUploading(false);
  }

  async function translateToAll(text: string): Promise<Record<string, string>> {
    const targets = roomLangs.filter((l) => l !== teacherLang);
    if (targets.length === 0 || !text.trim()) return { [teacherLang]: text };
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          fromLang: teacherLang,
          targetLangs: targets,
          authorName: teacherName,
          isTeacher: true,
          paletteIdx: 0,
          roomCode,
          cardType: "comment",
        }),
      });
      const data = await res.json();
      return data.translations || { [teacherLang]: text };
    } catch {
      return { [teacherLang]: text };
    }
  }

  async function handleStart() {
    if (!title.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const db = getClientDb();
      const sessionsRef = ref(db, `rooms/${roomCode}/sessions`);
      const newSessionRef = push(sessionsRef);
      const sessionId = newSessionRef.key!;

      const [titleTranslations, bodyTextTranslations] = await Promise.all([
        translateToAll(title.trim()),
        bodyText.trim() ? translateToAll(bodyText.trim()) : Promise.resolve(undefined),
      ]);

      const meta: Partial<SessionMeta> & { id: string } = {
        id: sessionId,
        title: title.trim(),
        titleTranslations,
        startedAt: Date.now(),
        status: "active",
        teacherClientId,
        teacherLang,
        teacherName,
        targetLangs: roomLangs,
      };
      if (bodyText.trim()) {
        meta.bodyText = bodyText.trim();
        if (bodyTextTranslations) meta.bodyTextTranslations = bodyTextTranslations;
      }
      if (imageUrl) meta.imageUrl = imageUrl;

      await set(ref(db, `rooms/${roomCode}/sessions/${sessionId}/meta`), meta);
      await set(ref(db, `rooms/${roomCode}/activeSession`), sessionId);
      onCreated?.(sessionId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 생성 실패");
      setCreating(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, background: "rgba(9,7,30,0.8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 500, backdropFilter: "blur(8px)", padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 24, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
        animation: "fadeSlideIn 0.25s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid #F3F4F8",
          display: "flex", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, color: "#111827" }}>
              💭 의견 나누기 시작
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
              학생들이 실시간으로 의견을 제출할 수 있어요
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto", background: "#F3F4F6", border: "none", borderRadius: "50%",
              width: 32, height: 32, fontSize: 14, cursor: "pointer", color: "#6B7280",
            }}
          >✕</button>
        </div>

        <div style={{ padding: "20px 24px 28px" }}>
          {/* Title */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>
              주제 <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 오늘 배운 내용 중 가장 인상 깊었던 것은?"
              autoFocus
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: "2px solid #E5E7EB", fontSize: 14, color: "#111827",
                background: "#F9FAFB", outline: "none", boxSizing: "border-box",
                fontWeight: 600,
              }}
              onFocus={(e) => { e.target.style.borderColor = "#5B57F5"; e.target.style.background = "#fff"; }}
              onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
            />
          </div>

          {/* Body text */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>
              설명 (선택)
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="학생들에게 전달할 상세 설명..."
              rows={3}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: "2px solid #E5E7EB", fontSize: 13, color: "#111827",
                background: "#F9FAFB", outline: "none", boxSizing: "border-box",
                resize: "vertical", fontFamily: "inherit",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#5B57F5"; e.target.style.background = "#fff"; }}
              onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
            />
          </div>

          {/* Image attach */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>
              이미지 첨부 (선택)
            </label>
            {imageUrl ? (
              <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #E5E7EB" }}>
                <img src={imageUrl} alt="첨부" style={{ width: "100%", display: "block" }} />
                <button
                  onClick={() => setImageUrl("")}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "rgba(0,0,0,0.6)", color: "#fff", border: "none",
                    width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                    fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>
              </div>
            ) : (
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "24px 16px", borderRadius: 12,
                border: "2px dashed #D1D5DB", background: "#F9FAFB",
                cursor: uploading ? "wait" : "pointer", transition: "all 0.15s",
                color: "#6B7280", fontSize: 13, fontWeight: 600,
              }}>
                {uploading ? (
                  <>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: "2px solid rgba(91,87,245,0.25)", borderTopColor: "#5B57F5",
                      animation: "spin 0.8s linear infinite",
                    }} />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 20 }}>📷</span>
                    클릭하여 이미지 선택
                  </>
                )}
                <input
                  type="file" accept="image/*" onChange={handleImageChange}
                  disabled={uploading}
                  style={{ display: "none" }}
                />
              </label>
            )}
          </div>

          {error && (
            <div style={{
              padding: "10px 12px", background: "#FEF2F2", borderLeft: "3px solid #EF4444",
              color: "#991B1B", fontSize: 13, borderRadius: 6, marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              disabled={creating}
              style={{
                flex: 1, padding: "13px 0", borderRadius: 12, fontSize: 14,
                background: "#F3F4F6", color: "#6B7280", fontWeight: 700,
                border: "none", cursor: creating ? "not-allowed" : "pointer",
              }}
            >
              취소
            </button>
            <button
              onClick={handleStart}
              disabled={!title.trim() || creating || uploading}
              style={{
                flex: 2, padding: "13px 0", borderRadius: 12, fontSize: 14,
                background: !title.trim() || creating || uploading ? "#F3F4F6" : BRAND_GRADIENT,
                color: !title.trim() || creating || uploading ? "#D1D5DB" : "#fff",
                fontWeight: 800, border: "none",
                cursor: !title.trim() || creating || uploading ? "not-allowed" : "pointer",
                boxShadow: !title.trim() || creating || uploading ? "none" : "0 4px 16px rgba(91,87,245,0.4)",
              }}
            >
              {creating ? "시작 중..." : "🚀 세션 시작"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

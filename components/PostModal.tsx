"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { UserConfig, PostData, CardType, CardData, CardStatus } from "@/lib/types";
import { t } from "@/lib/i18n";
import DrawingCanvas from "./DrawingCanvas";
import WorksheetTab from "./WorksheetTab";
import { compressToUnder1MB, fmtBytes } from "@/lib/imageUtils";

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

async function uploadToServer(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, `upload_${Date.now()}.jpg`);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "업로드 실패");
  }
  const data = await res.json();
  return data.url as string;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const bstr = atob(data);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

type ModalMode = CardType | "worksheet";

interface Props {
  colId: string;
  colTitle: string;
  colColor: string;
  user: UserConfig;
  posting: boolean;
  onPost: (data: PostData) => void;
  onClose: () => void;
  approvalMode?: boolean;
  myClientId?: string;
  editCard?: CardData;
  roomCode: string;
}

export default function PostModal({
  colId,
  colTitle,
  colColor,
  user,
  posting,
  onPost,
  onClose,
  approvalMode,
  myClientId,
  editCard,
  roomCode,
}: Props) {
  const lang = user.myLang;
  const accent = colColor || "#5B57F5";

  const draftKey = editCard ? null : `draft_${roomCode}_${colId}`;

  const TABS: { key: ModalMode; icon: string; label: string }[] = [
    { key: "text",      icon: "📝", label: t("tabWrite", lang)     },
    { key: "image",     icon: "🖼️", label: t("tabPhoto", lang)     },
    { key: "youtube",   icon: "📺", label: "YouTube"               },
    { key: "drawing",   icon: "✏️", label: t("tabDraw", lang)      },
    ...(editCard ? [] : [{ key: "worksheet" as ModalMode, icon: "📋", label: t("tabWorksheet", lang) }]),
  ];

  const initialMode: ModalMode = editCard
    ? (editCard.cardType as ModalMode)
    : "text";

  const [mode, setMode] = useState<ModalMode>(initialMode);
  const [inputText, setInputText] = useState(() => {
    if (editCard) return editCard.originalText || "";
    return "";
  });
  const [writeLang, setWriteLang] = useState(editCard ? editCard.authorLang : user.myLang);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageOrigSize, setImageOrigSize] = useState<number>(0);
  const [youtubeUrl, setYoutubeUrl] = useState(() => {
    if (editCard?.cardType === "youtube" && editCard.youtubeId) {
      return `https://youtu.be/${editCard.youtubeId}`;
    }
    return "";
  });
  const [drawingDataUrl, setDrawingDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);

  // Draft state
  const [hasDraft, setHasDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Error state
  const [postError, setPostError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // On mount: check for draft (only when not editing)
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { text?: string; youtubeUrl?: string };
        if (parsed.text && parsed.text.trim()) {
          setHasDraft(true);
        }
      }
    } catch {
      // ignore
    }
    setDraftLoaded(true);
  }, [draftKey]);

  // Focus textarea on text mode
  useEffect(() => {
    if (mode === "text") setTimeout(() => textareaRef.current?.focus(), 80);
  }, [mode]);

  // Debounced draft save
  useEffect(() => {
    if (!draftKey || !draftLoaded || hasDraft) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (inputText.trim() || youtubeUrl.trim()) {
        localStorage.setItem(draftKey, JSON.stringify({ text: inputText, youtubeUrl }));
      }
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputText, youtubeUrl, draftKey, draftLoaded, hasDraft]);

  function restoreDraft() {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { text?: string; youtubeUrl?: string };
        if (parsed.text) setInputText(parsed.text);
        if (parsed.youtubeUrl) {
          setYoutubeUrl(parsed.youtubeUrl);
          setMode("youtube");
        }
      }
    } catch {
      // ignore
    }
    setHasDraft(false);
  }

  function discardDraft() {
    if (!draftKey) return;
    localStorage.removeItem(draftKey);
    setHasDraft(false);
  }

  function clearDraft() {
    if (!draftKey) return;
    localStorage.removeItem(draftKey);
  }

  const langOptions = user.isTeacher ? user.teacherLangs : Object.keys(LANGUAGES);
  const youtubeId = extractYouTubeId(youtubeUrl);

  async function handleImageSelect(file: File) {
    setImageOrigSize(file.size);
    setImagePreview(URL.createObjectURL(file));
    setCompressing(true);
    setCompressedBlob(null);
    setCompressedSize(0);
    try {
      const compressed = await compressToUnder1MB(file);
      setCompressedBlob(compressed);
      setCompressedSize(compressed.size);
      setImagePreview(URL.createObjectURL(compressed));
    } catch {
      setCompressedBlob(file);
      setCompressedSize(file.size);
    }
    setCompressing(false);
    setImageFile(file);
  }

  const canPost = () => {
    if (uploading || posting || compressing) return false;
    if (mode === "text")      return inputText.trim().length > 0;
    if (mode === "youtube")   return !!youtubeId;
    if (mode === "image")     return !!compressedBlob;
    if (mode === "drawing")   return !!drawingDataUrl;
    if (mode === "worksheet") return false;
    return false;
  };

  async function handleSubmit() {
    if (!canPost()) return;
    setPostError(null);

    const shouldPend = approvalMode && !user.isTeacher;
    const statusField: { status?: CardStatus; authorClientId?: string } = shouldPend
      ? { status: "pending" as CardStatus, authorClientId: myClientId || "" }
      : {};

    try {
      if (mode === "text") {
        onPost({ cardType: "text", text: inputText, writeLang, ...statusField });
        clearDraft();
        return;
      }
      if (mode === "youtube") {
        onPost({ cardType: "youtube", text: "", writeLang, youtubeId: youtubeId!, ...statusField });
        clearDraft();
        return;
      }

      setUploading(true);
      try {
        let blob: Blob;
        if (mode === "image" && compressedBlob) {
          blob = compressedBlob;
        } else {
          const raw = dataUrlToBlob(drawingDataUrl!);
          blob = await compressToUnder1MB(raw);
        }
        const imageUrl = await uploadToServer(blob);
        onPost({ cardType: mode as import("@/lib/types").CardType, text: "", writeLang, imageUrl, ...statusField });
        clearDraft();
      } catch (err) {
        console.error("업로드 실패:", err);
        setPostError(t("postFailed", lang));
      }
      setUploading(false);
    } catch (err) {
      console.error("게시 실패:", err);
      setPostError(t("postFailed", lang));
    }
  }

  const btnDisabled = !canPost();
  const isEdit = !!editCard;
  const btnLabel = isEdit
    ? "수정 완료"
    : compressing
      ? t("compressing", lang)
      : uploading
        ? t("uploading", lang)
        : posting
          ? t("saving", lang)
          : t("post", lang);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(9,7,30,0.75)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 200, backdropFilter: "blur(6px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: "24px 24px 0 0",
        width: "100%", maxWidth: 560, padding: "24px 24px 40px",
        boxShadow: "0 -16px 60px rgba(0,0,0,0.3)",
        animation: "slideUp 0.22s ease",
        maxHeight: "92vh", overflowY: "auto",
      }}>
        {/* Handle bar */}
        <div style={{
          width: 36, height: 4, borderRadius: 2, background: "#E5E7EB",
          margin: "-8px auto 20px",
        }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: accent, flexShrink: 0, boxShadow: `0 0 0 3px ${accent}22` }} />
          <span style={{ fontWeight: 800, fontSize: 14, color: "#111827", flex: 1, letterSpacing: -0.2 }}>
            {isEdit ? `✏️ ${t("editCard", lang)} — ${colTitle}` : colTitle}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "#F3F4F6", border: "none", borderRadius: "50%",
              width: 30, height: 30, fontSize: 13, cursor: "pointer", color: "#6B7280",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#E5E7EB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6")}
          >✕</button>
        </div>

        {/* Draft banner */}
        {hasDraft && !isEdit && (
          <div style={{
            background: "#FEF3C7", borderRadius: 10, padding: "10px 14px",
            marginBottom: 14, display: "flex", alignItems: "center", gap: 10,
            border: "1px solid #FDE68A",
          }}>
            <span style={{ fontSize: 13, color: "#92400E", flex: 1, fontWeight: 600 }}>
              💾 {t("draftRestore", lang)}
            </span>
            <button
              onClick={restoreDraft}
              style={{
                padding: "5px 12px", borderRadius: 8, border: "none", background: "#F59E0B",
                color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}
            >복원</button>
            <button
              onClick={discardDraft}
              style={{
                padding: "5px 12px", borderRadius: 8, border: "1px solid #D97706",
                color: "#92400E", fontWeight: 700, fontSize: 12, cursor: "pointer",
                background: "transparent",
              }}
            >{t("draftDiscard", lang)}</button>
          </div>
        )}

        {/* Error banner */}
        {postError && (
          <div style={{
            background: "#FEF2F2", borderRadius: 10, padding: "10px 14px",
            marginBottom: 14, display: "flex", alignItems: "center", gap: 10,
            border: "1px solid #FECACA",
          }}>
            <span style={{ fontSize: 13, color: "#991B1B", flex: 1, fontWeight: 600 }}>
              ❌ {postError}
            </span>
            <button
              onClick={() => { setPostError(null); handleSubmit(); }}
              style={{
                padding: "5px 12px", borderRadius: 8, border: "none", background: "#EF4444",
                color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}
            >{t("retry", lang)}</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "#F3F4F6", borderRadius: 12, padding: 4 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              style={{
                flex: 1, padding: "8px 4px", borderRadius: 9, border: "none", cursor: "pointer",
                background: mode === tab.key ? "#fff" : "transparent",
                boxShadow: mode === tab.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                fontWeight: mode === tab.key ? 800 : 500, fontSize: 12,
                color: mode === tab.key ? accent : "#9CA3AF",
                transition: "all 0.15s",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── 텍스트 모드 ── */}
        {mode === "text" && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 0.5 }}>{t("writingLang", lang)}</span>
              {langOptions.map((l) => (
                <button
                  key={l}
                  onClick={() => setWriteLang(l)}
                  style={{
                    padding: "5px 11px", borderRadius: 16, fontSize: 12,
                    border: `1.5px solid ${writeLang === l ? accent : "#E5E7EB"}`,
                    background: writeLang === l ? accent + "15" : "#F9FAFB",
                    color: writeLang === l ? accent : "#9CA3AF",
                    fontWeight: writeLang === l ? 700 : 400, cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  {LANGUAGES[l]?.flag} {LANGUAGES[l]?.label}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
              placeholder={`${LANGUAGES[writeLang]?.flag} ${LANGUAGES[writeLang]?.label}...`}
              rows={4}
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 14,
                border: "2px solid #E5E7EB", fontSize: 15, resize: "none",
                boxSizing: "border-box", lineHeight: 1.65,
                outline: "none", transition: "all 0.18s", color: "#111827",
                background: "#F9FAFB", fontWeight: 500,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = accent;
                e.target.style.background = "#fff";
                e.target.style.boxShadow = `0 0 0 4px ${accent}14`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E5E7EB";
                e.target.style.background = "#F9FAFB";
                e.target.style.boxShadow = "none";
              }}
            />
          </>
        )}

        {/* ── 사진 모드 ── */}
        {mode === "image" && (
          <div>
            <input
              ref={fileInputRef}
              type="file" accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                handleImageSelect(file);
              }}
            />
            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed #E5E7EB", borderRadius: 14,
                  padding: "52px 20px", textAlign: "center", cursor: "pointer",
                  transition: "all 0.18s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = accent;
                  el.style.background = accent + "08";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#E5E7EB";
                  el.style.background = "transparent";
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 10 }}>🖼️</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 4 }}>{t("selectPhoto", lang)}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("clickToUpload", lang)}</div>
              </div>
            ) : (
              <div>
                <div style={{ position: "relative" }}>
                  <img src={imagePreview} alt="preview"
                    style={{ width: "100%", borderRadius: 12, maxHeight: 280, objectFit: "contain", background: "#F9FAFB" }} />
                  <button
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setCompressedBlob(null);
                      setCompressedSize(0);
                      setImageOrigSize(0);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    style={{
                      position: "absolute", top: 8, right: 8,
                      background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%",
                      width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >✕</button>
                </div>
                {/* Compression info */}
                <div style={{ marginTop: 8, fontSize: 12, textAlign: "center" }}>
                  {compressing ? (
                    <span style={{ color: "#F59E0B", fontWeight: 600 }}>{t("compressing", lang)}</span>
                  ) : compressedSize > 0 && imageOrigSize > 0 ? (
                    <span style={{ color: "#10B981", fontWeight: 600 }}>
                      🗜 {fmtBytes(imageOrigSize)} → {fmtBytes(compressedSize)}
                      {compressedSize < imageOrigSize && ` (-${Math.round((1 - compressedSize / imageOrigSize) * 100)}%)`}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── YouTube 모드 ── */}
        {mode === "youtube" && (
          <div>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="YouTube URL (youtu.be/... 또는 youtube.com/watch?v=...)"
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 14,
                border: "2px solid #E5E7EB", fontSize: 14, background: "#F9FAFB",
                boxSizing: "border-box", outline: "none", transition: "all 0.18s", color: "#111827",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = accent;
                e.target.style.background = "#fff";
                e.target.style.boxShadow = `0 0 0 4px ${accent}14`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E5E7EB";
                e.target.style.background = "#F9FAFB";
                e.target.style.boxShadow = "none";
              }}
            />
            {youtubeId && (
              <div style={{ marginTop: 12 }}>
                <img
                  src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                  alt="YouTube thumbnail"
                  style={{ width: "100%", borderRadius: 12 }}
                />
                <div style={{ fontSize: 12, color: "#10B981", marginTop: 8, textAlign: "center", fontWeight: 700 }}>
                  ✅ 유효한 YouTube 링크
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 그림 모드 ── */}
        {mode === "drawing" && (
          drawingDataUrl ? (
            <div>
              <div style={{ position: "relative" }}>
                <img src={drawingDataUrl} alt="drawing" style={{ width: "100%", borderRadius: 12 }} />
                <button
                  onClick={() => setDrawingDataUrl(null)}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%",
                    width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8, textAlign: "center" }}>
                다시 그리려면 ✕ 버튼을 누르세요
              </div>
            </div>
          ) : (
            <DrawingCanvas onDone={(dataUrl) => setDrawingDataUrl(dataUrl)} />
          )
        )}

        {/* ── 활동지 모드 (not available in edit mode) ── */}
        {mode === "worksheet" && !isEdit && (
          <WorksheetTab
            userLang={lang}
            onPostText={(text, postLang) => {
              onPost({ cardType: "text", text, writeLang: postLang });
            }}
            onClose={onClose}
          />
        )}

        {/* Bottom submit */}
        {!(mode === "drawing" && !drawingDataUrl) && mode !== "worksheet" && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <span style={{ fontSize: 11, color: "#CBD5E1" }}>
              {mode === "text" ? "Ctrl+Enter" : ""}
            </span>
            <button
              onClick={handleSubmit}
              disabled={btnDisabled}
              style={{
                padding: "12px 28px", borderRadius: 13, fontSize: 14,
                background: btnDisabled
                  ? "#F3F4F6"
                  : `linear-gradient(135deg, ${accent}, #9B59B6)`,
                color: btnDisabled ? "#CBD5E1" : "#fff",
                fontWeight: 800, border: "none",
                cursor: btnDisabled ? "not-allowed" : "pointer",
                boxShadow: !btnDisabled ? `0 4px 20px ${accent}44` : "none",
                transition: "all 0.18s", letterSpacing: -0.2,
              }}
            >
              {btnLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

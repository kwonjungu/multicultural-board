"use client";

import { useEffect, useRef, useState } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { LANGUAGES, COLUMNS_DEFAULT } from "@/lib/constants";
import { UserConfig, PostData, CardType } from "@/lib/types";
import { getClientStorage } from "@/lib/firebase-client";
import DrawingCanvas from "./DrawingCanvas";

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

async function uploadBlob(blob: Blob): Promise<string> {
  const storage = getClientStorage();
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob);
  return getDownloadURL(fileRef);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const bstr = atob(data);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

const TABS: { key: CardType; icon: string; label: string }[] = [
  { key: "text",    icon: "📝", label: "글쓰기"  },
  { key: "image",   icon: "🖼️", label: "사진"    },
  { key: "youtube", icon: "📺", label: "YouTube" },
  { key: "drawing", icon: "✏️", label: "그림"    },
];

interface Props {
  colId: string;
  user: UserConfig;
  posting: boolean;
  onPost: (data: PostData) => void;
  onClose: () => void;
}

export default function PostModal({ colId, user, posting, onPost, onClose }: Props) {
  const [mode, setMode] = useState<CardType>("text");
  const [inputText, setInputText] = useState("");
  const [writeLang, setWriteLang] = useState(user.myLang);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [drawingDataUrl, setDrawingDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const col = COLUMNS_DEFAULT.find((c) => c.id === colId);
  const accent = col?.color || "#6C63FF";

  useEffect(() => {
    if (mode === "text") setTimeout(() => textareaRef.current?.focus(), 80);
  }, [mode]);

  const langOptions = user.isTeacher ? user.teacherLangs : Object.keys(LANGUAGES);
  const youtubeId = extractYouTubeId(youtubeUrl);

  const canPost = () => {
    if (uploading || posting) return false;
    if (mode === "text")    return inputText.trim().length > 0;
    if (mode === "youtube") return !!youtubeId;
    if (mode === "image")   return !!imageFile;
    if (mode === "drawing") return !!drawingDataUrl;
    return false;
  };

  async function handleSubmit() {
    if (!canPost()) return;

    if (mode === "text") {
      onPost({ cardType: "text", text: inputText, writeLang });
      return;
    }
    if (mode === "youtube") {
      onPost({ cardType: "youtube", text: "", writeLang, youtubeId: youtubeId! });
      return;
    }

    // image / drawing → Firebase Storage 업로드
    setUploading(true);
    try {
      let blob: Blob;
      if (mode === "image" && imageFile) {
        blob = imageFile;
      } else if (mode === "drawing" && drawingDataUrl) {
        blob = dataUrlToBlob(drawingDataUrl);
      } else {
        setUploading(false);
        return;
      }
      const imageUrl = await uploadBlob(blob);
      onPost({ cardType: mode, text: "", writeLang, imageUrl });
    } catch (err) {
      console.error("업로드 실패:", err);
      alert("업로드에 실패했습니다.\nFirebase Storage 규칙이 설정되어 있는지 확인하세요.");
    }
    setUploading(false);
  }

  const btnDisabled = !canPost();

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,12,41,0.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 200, backdropFilter: "blur(5px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: "22px 22px 0 0",
        width: "100%", maxWidth: 560, padding: "22px 22px 36px",
        boxShadow: "0 -12px 48px rgba(0,0,0,0.25)",
        animation: "slideUp 0.22s ease",
        maxHeight: "92vh", overflowY: "auto",
      }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: accent, flexShrink: 0 }} />
          <span style={{ fontWeight: 900, fontSize: 14, color: "#1a1a1a", flex: 1 }}>{col?.title}</span>
          <button
            onClick={onClose}
            style={{ background: "#f2f2f2", border: "none", borderRadius: "50%", width: 28, height: 28, fontSize: 13, cursor: "pointer", color: "#777" }}
          >✕</button>
        </div>

        {/* 탭 */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#f5f5f5", borderRadius: 12, padding: 4 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              style={{
                flex: 1, padding: "7px 4px", borderRadius: 9, border: "none", cursor: "pointer",
                background: mode === tab.key ? "#fff" : "transparent",
                boxShadow: mode === tab.key ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                fontWeight: mode === tab.key ? 800 : 400, fontSize: 12,
                color: mode === tab.key ? accent : "#999",
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
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#bbb", fontWeight: 700 }}>작성 언어</span>
              {langOptions.map((l) => (
                <button
                  key={l}
                  onClick={() => setWriteLang(l)}
                  style={{
                    padding: "5px 12px", borderRadius: 16, fontSize: 12,
                    border: `2px solid ${writeLang === l ? accent : "#eee"}`,
                    background: writeLang === l ? accent + "18" : "#fafafa",
                    color: writeLang === l ? accent : "#aaa",
                    fontWeight: writeLang === l ? 800 : 400, cursor: "pointer",
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
              placeholder={`${LANGUAGES[writeLang]?.flag} ${LANGUAGES[writeLang]?.label}로 입력하면 자동으로 번역됩니다...`}
              rows={4}
              style={{
                width: "100%", padding: "13px 15px", borderRadius: 14,
                border: "2px solid #e5e5e5", fontSize: 15, resize: "none",
                boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.65,
                outline: "none", transition: "border-color 0.18s", color: "#1a1a1a",
              }}
              onFocus={(e) => (e.target.style.borderColor = accent)}
              onBlur={(e) => (e.target.style.borderColor = "#e5e5e5")}
            />
          </>
        )}

        {/* ── 사진 모드 ── */}
        {mode === "image" && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
              }}
            />
            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed #e5e5e5", borderRadius: 14,
                  padding: "48px 20px", textAlign: "center", cursor: "pointer",
                  color: "#bbb", transition: "all 0.18s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = accent;
                  (e.currentTarget as HTMLDivElement).style.background = accent + "08";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#e5e5e5";
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 8 }}>🖼️</div>
                <div style={{ fontWeight: 700, marginBottom: 4, color: "#888" }}>사진을 선택하세요</div>
                <div style={{ fontSize: 12 }}>클릭하여 업로드</div>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <img
                  src={imagePreview}
                  alt="preview"
                  style={{ width: "100%", borderRadius: 12, maxHeight: 280, objectFit: "contain", background: "#f5f5f5" }}
                />
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%",
                    width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 13,
                  }}
                >✕</button>
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
              placeholder="YouTube URL 붙여넣기 (https://youtu.be/... 또는 youtube.com/watch?v=...)"
              style={{
                width: "100%", padding: "13px 15px", borderRadius: 14,
                border: "2px solid #e5e5e5", fontSize: 14,
                boxSizing: "border-box", outline: "none", fontFamily: "inherit",
                transition: "border-color 0.18s", color: "#1a1a1a",
              }}
              onFocus={(e) => (e.target.style.borderColor = accent)}
              onBlur={(e) => (e.target.style.borderColor = "#e5e5e5")}
            />
            {youtubeId && (
              <div style={{ marginTop: 12 }}>
                <img
                  src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                  alt="YouTube thumbnail"
                  style={{ width: "100%", borderRadius: 12 }}
                />
                <div style={{ fontSize: 12, color: "#4CAF50", marginTop: 6, textAlign: "center", fontWeight: 700 }}>
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
                  }}
                >✕</button>
              </div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 6, textAlign: "center" }}>
                다시 그리려면 ✕ 버튼을 누르세요
              </div>
            </div>
          ) : (
            <DrawingCanvas onDone={(dataUrl) => setDrawingDataUrl(dataUrl)} />
          )
        )}

        {/* 하단 게시 버튼 (그림 그리는 중엔 숨김) */}
        {!(mode === "drawing" && !drawingDataUrl) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <span style={{ fontSize: 11, color: "#ccc" }}>
              {mode === "text" ? "Ctrl+Enter · 자동 번역 포함" : ""}
            </span>
            <button
              onClick={handleSubmit}
              disabled={btnDisabled}
              style={{
                padding: "11px 26px", borderRadius: 13, fontSize: 14,
                background: btnDisabled
                  ? "#e8e8e8"
                  : `linear-gradient(135deg, ${accent}, #9B59B6)`,
                color: btnDisabled ? "#bbb" : "#fff",
                fontWeight: 900, border: "none",
                cursor: btnDisabled ? "not-allowed" : "pointer",
                boxShadow: !btnDisabled ? `0 4px 16px ${accent}44` : "none",
                transition: "all 0.18s",
              }}
            >
              {uploading ? "⟳ 업로드 중..." : posting ? "⟳ 저장 중..." : "게시하기 📤"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

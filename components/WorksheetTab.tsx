"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { compressToUnder1MB } from "@/lib/imageUtils";

interface Block {
  x: number; y: number; w: number; h: number;
  original: string; translated: string;
}

interface WorksheetResult {
  originalText: string;
  translatedText: string;
  fileType: "pdf" | "image";
  imagePreviewUrl?: string;
  blocks?: Block[];
}

interface Props {
  userLang: string;
  onPostText: (text: string, lang: string) => void;
  onPostWorksheetImage?: (blob: Blob, originalText: string, translatedText: string, toLang: string) => void;
  onClose: () => void;
}

export default function WorksheetTab({ userLang, onPostText, onPostWorksheetImage, onClose }: Props) {
  const [fromLang, setFromLang] = useState(userLang === "ko" ? "en" : userLang);
  const [toLang, setToLang]     = useState(userLang === "ko" ? "ko" : "ko");
  const [processing, setProcessing]   = useState(false);
  const [statusMsg, setStatusMsg]     = useState("");
  const [result, setResult]           = useState<WorksheetResult | null>(null);
  const [showTranslated, setShowTranslated] = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [activeTtsIdx, setActiveTtsIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Measure rendered image size for block positioning
  useEffect(() => {
    if (!result || result.fileType !== "image") return;
    const img = imgRef.current;
    if (!img) return;
    const update = () => setImgDims({ w: img.clientWidth, h: img.clientHeight });
    if (img.complete) update();
    img.addEventListener("load", update);
    const ro = new ResizeObserver(update);
    ro.observe(img);
    window.addEventListener("resize", update);
    return () => {
      img.removeEventListener("load", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [result]);

  function playBlockTts(block: Block, idx: number) {
    try { audioRef.current?.pause(); } catch {}
    const url = `/api/tts?text=${encodeURIComponent(block.original)}&lang=${fromLang}`;
    const audio = new Audio(url);
    audioRef.current = audio;
    setActiveTtsIdx(idx);
    audio.onended = () => setActiveTtsIdx((v) => (v === idx ? null : v));
    audio.onerror = () => setActiveTtsIdx((v) => (v === idx ? null : v));
    audio.play().catch(() => setActiveTtsIdx(null));
  }

  async function handleFile(file: File) {
    const isPDF   = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPDF && !isImage) {
      setError("PDF 또는 이미지 파일만 지원합니다");
      return;
    }

    setResult(null);
    setError(null);
    setProcessing(true);
    setShowTranslated(true);

    try {
      let uploadFile: File | Blob = file;
      if (isImage) {
        setStatusMsg("🗜 이미지 압축 중...");
        uploadFile = await compressToUnder1MB(file);
        setCompressedBlob(uploadFile);
      }
      setStatusMsg(isPDF ? "📄 PDF 텍스트 읽는 중..." : "🔍 OCR + 번역 중...");

      const fd = new FormData();
      fd.append("file", uploadFile, file.name);
      fd.append("fromLang", fromLang);
      fd.append("toLang",   toLang);
      fd.append("type",     isPDF ? "pdf" : "image");

      const res = await fetch("/api/worksheet", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "처리 실패");
      }
      const data = await res.json();
      const previewUrl = isImage ? URL.createObjectURL(uploadFile) : undefined;

      const r: WorksheetResult = {
        originalText:   data.originalText  || "",
        translatedText: data.translatedText || "",
        fileType:       isPDF ? "pdf" : "image",
        imagePreviewUrl: previewUrl,
        blocks:         data.blocks || [],
      };
      setResult(r);
    } catch (e: unknown) {
      setError((e as Error).message || "처리 중 오류가 발생했습니다");
    }
    setProcessing(false);
    setStatusMsg("");
  }

  const selectStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 10,
    border: "1.5px solid #E5E7EB", fontSize: 13,
    background: "#F9FAFB", color: "#111827",
    outline: "none", cursor: "pointer", fontWeight: 600,
    fontFamily: "'Noto Sans KR', sans-serif",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Language direction selector */}
      <div style={{
        background: "#F8F9FC", borderRadius: 14, padding: "14px 16px",
        border: "1px solid #E9ECF5",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1, marginBottom: 10 }}>
          번역 방향 설정
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={fromLang} onChange={(e) => setFromLang(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
            {Object.entries(LANGUAGES).map(([code, info]) => (
              <option key={code} value={code}>{info.flag} {info.label}</option>
            ))}
          </select>
          <div style={{ fontSize: 20, color: "#9CA3AF", fontWeight: 900, flexShrink: 0, padding: "0 4px" }}>→</div>
          <select value={toLang} onChange={(e) => setToLang(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
            {Object.entries(LANGUAGES).map(([code, info]) => (
              <option key={code} value={code}>{info.flag} {info.label}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8, textAlign: "center" }}>
          {LANGUAGES[fromLang]?.flag} {LANGUAGES[fromLang]?.label} 텍스트를 읽어 {LANGUAGES[toLang]?.flag} {LANGUAGES[toLang]?.label}(으)로 번역합니다
        </div>
      </div>

      {/* Upload area */}
      {!result && !processing && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = "#F59E0B"; }}
            onDragLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#D1D5DB"; }}
            onDrop={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLDivElement).style.borderColor = "#D1D5DB";
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            style={{
              border: "2px dashed #D1D5DB", borderRadius: 14,
              padding: "40px 20px", textAlign: "center", cursor: "pointer",
              transition: "all 0.18s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = "#F59E0B";
              el.style.background = "rgba(245,158,11,0.06)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = "#D1D5DB";
              el.style.background = "transparent";
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 4 }}>
              활동지를 업로드하세요
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.7 }}>
              클릭하거나 파일을 드래그해서 놓으세요<br />
              <span style={{ fontWeight: 600, color: "#6B7280" }}>PDF</span> 또는{" "}
              <span style={{ fontWeight: 600, color: "#6B7280" }}>사진 (JPG, PNG)</span> 지원
            </div>
          </div>
        </>
      )}

      {/* Processing spinner */}
      {processing && (
        <div style={{
          textAlign: "center", padding: "36px 20px",
          background: "#F8F9FC", borderRadius: 14, border: "1px solid #E9ECF5",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", margin: "0 auto 14px",
            border: "3px solid #E5E7EB", borderTopColor: "#F59E0B",
            animation: "spin 0.8s linear infinite",
          }} />
          <div style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>{statusMsg}</div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>
            AI가 텍스트를 분석하고 번역 중입니다...
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12,
          padding: "12px 16px", fontSize: 13, color: "#EF4444", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          ❌ {error}
          <button
            onClick={() => { setError(null); setResult(null); }}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#EF4444" }}
          >↩</button>
        </div>
      )}

      {/* ── PDF Result ── */}
      {result && result.fileType === "pdf" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 300 }}>
            <div style={{ background: "#F8F9FC", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "8px 12px", fontWeight: 800, fontSize: 11, color: "#6B7280", background: "#F3F4F6", borderBottom: "1px solid #E9ECF5", letterSpacing: 1 }}>
                {LANGUAGES[fromLang]?.flag} 원문
              </div>
              <div style={{ padding: "12px", fontSize: 12, color: "#374151", lineHeight: 1.8, overflowY: "auto", flex: 1, maxHeight: 250, whiteSpace: "pre-wrap" }}>
                {result.originalText || <span style={{ color: "#9CA3AF" }}>텍스트가 없습니다</span>}
              </div>
            </div>
            <div style={{ background: "#F0EEFF", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "8px 12px", fontWeight: 800, fontSize: 11, color: "#F59E0B", background: "#EEF0FF", borderBottom: "1px solid #DDD9FF", letterSpacing: 1 }}>
                {LANGUAGES[toLang]?.flag} 번역
              </div>
              <div style={{ padding: "12px", fontSize: 12, color: "#1E1B4B", lineHeight: 1.8, overflowY: "auto", flex: 1, maxHeight: 250, whiteSpace: "pre-wrap" }}>
                {result.translatedText || <span style={{ color: "#9CA3AF" }}>번역 결과 없음</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => { setResult(null); setError(null); }}
              style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: "1.5px solid #E5E7EB", background: "#fff", color: "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >↩ 다시 올리기</button>
            <button
              onClick={() => { onPostText(result.translatedText, toLang); onClose(); }}
              style={{ flex: 2, padding: "10px 0", borderRadius: 11, border: "none", background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}
            >📌 번역 게시하기</button>
          </div>
        </div>
      )}

      {/* ── Image OCR Result ── */}
      {result && result.fileType === "image" && result.imagePreviewUrl && (
        <div>
          {/* Hint */}
          {showTranslated && (result.blocks?.length ?? 0) > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, color: "#F59E0B", fontWeight: 700,
              marginBottom: 6, padding: "0 2px",
            }}>
              🔊 <span>번역 줄을 탭하면 {LANGUAGES[fromLang]?.flag} {LANGUAGES[fromLang]?.label}(으)로 읽어줘요</span>
            </div>
          )}

          {/* Image + overlay container */}
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#F9FAFB" }}>
            {/* Original image (always rendered) */}
            <img
              ref={imgRef}
              src={result.imagePreviewUrl}
              alt="원본"
              style={{
                width: "100%", display: "block", maxHeight: 480,
                objectFit: "contain",
                position: "relative",
              }}
            />

            {/* DOM overlay: per-block glassmorphism + TTS */}
            {showTranslated && (result.blocks?.length ?? 0) > 0 && imgDims.w > 0 && (
              <div style={{
                position: "absolute", inset: 0,
                // Center horizontally if image is narrower than container (objectFit:contain)
                pointerEvents: "none",
              }}>
                <div style={{
                  position: "absolute",
                  left: "50%", top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: imgDims.w, height: imgDims.h,
                  pointerEvents: "none",
                }}>
                  {result.blocks!.map((b, i) => {
                    if (!b.translated?.trim()) return null;
                    const pxHeight = b.h * imgDims.h;
                    const fontSize = Math.max(9, Math.min(pxHeight * 0.58, 22));
                    const active = activeTtsIdx === i;
                    return (
                      <div
                        key={i}
                        onClick={() => playBlockTts(b, i)}
                        title={`🔊 ${b.original}`}
                        style={{
                          position: "absolute",
                          left: `${b.x * 100}%`,
                          top: `${b.y * 100}%`,
                          width: `${b.w * 100}%`,
                          height: `${b.h * 100}%`,
                          pointerEvents: "auto",
                          cursor: "pointer",
                          background: active
                            ? "rgba(91,87,245,0.32)"
                            : "rgba(255,255,255,0.45)",
                          backdropFilter: "blur(5px)",
                          WebkitBackdropFilter: "blur(5px)",
                          border: active
                            ? "1.5px solid rgba(91,87,245,0.7)"
                            : "1px solid rgba(91,87,245,0.18)",
                          borderRadius: 4,
                          color: "#0F172A",
                          fontSize,
                          lineHeight: 1.2,
                          padding: "1px 4px",
                          display: "flex",
                          alignItems: "center",
                          overflow: "hidden",
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                          fontWeight: 600,
                          fontFamily: "'Noto Sans KR', sans-serif",
                          transition: "background 0.15s, border-color 0.15s",
                          boxShadow: active ? "0 2px 10px rgba(245,158,11,0.35)" : "none",
                        }}
                      >
                        {b.translated}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Toggle button */}
            <button
              onClick={() => setShowTranslated(!showTranslated)}
              style={{
                position: "absolute", top: 10, right: 10, zIndex: 10,
                background: showTranslated ? "rgba(91,87,245,0.92)" : "rgba(0,0,0,0.55)",
                border: "none", color: "#fff", borderRadius: 10,
                padding: "6px 14px", cursor: "pointer",
                fontSize: 12, fontWeight: 800,
                backdropFilter: "blur(4px)",
                transition: "background 0.2s",
              }}
            >
              {showTranslated ? `🖼️ ${LANGUAGES[fromLang]?.flag} 원본만` : `🌐 ${LANGUAGES[toLang]?.flag} 번역 보기`}
            </button>
          </div>

          {/* OCR original text */}
          {result.originalText && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 12, color: "#9CA3AF", cursor: "pointer", fontWeight: 600, padding: "6px 0" }}>
                {LANGUAGES[fromLang]?.flag} 인식된 원문 보기
              </summary>
              <div style={{ padding: "10px 12px", background: "#F8F9FC", borderRadius: 10, marginTop: 6, fontSize: 12, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap", maxHeight: 140, overflowY: "auto" }}>
                {result.originalText}
              </div>
            </details>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={() => { setResult(null); setError(null); setShowTranslated(true); setCompressedBlob(null); }}
              style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: "1.5px solid #E5E7EB", background: "#fff", color: "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >↩ 다시 올리기</button>
            <button
              onClick={() => {
                if (compressedBlob && onPostWorksheetImage) {
                  onPostWorksheetImage(compressedBlob, result.originalText, result.translatedText, toLang);
                } else {
                  onPostText(result.translatedText, toLang);
                }
                onClose();
              }}
              style={{ flex: 2, padding: "10px 0", borderRadius: 11, border: "none", background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}
            >📌 이미지+번역 게시하기</button>
          </div>
        </div>
      )}
    </div>
  );
}

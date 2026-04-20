"use client";

import { useRef, useState } from "react";

type Stage = "entry" | "uploading" | "processing" | "result" | "error";

export interface AnalyzeResult {
  content: string;
  previewUrl: string;
  model: string;
}

interface ViewProps {
  /** Fires once OCR completes. Parent decides what to do (post, translate, etc). */
  onComplete?: (result: AnalyzeResult) => void;
  /** Label for the final confirm button (default: "이 내용 사용하기"). */
  submitLabel?: string;
  /** If true, show a submit button on the result stage; if false, auto-fire onComplete. */
  requireConfirm?: boolean;
  /** Optional: hide the initial entry/upload area padding for embedded use. */
  compact?: boolean;
}

interface Props extends ViewProps {
  open: boolean;
  onClose: () => void;
  /** @deprecated alias for onComplete. */
  onResult?: (result: AnalyzeResult) => void;
}

const MAX_DIM = 2048;        // 장변 다운스케일 기준 — OCR 품질 유지 + 토큰 절약
const JPEG_QUALITY = 0.9;

/**
 * 전체 오버레이 모달 버전 — 독립적으로 열리는 다이얼로그.
 * PostModal 등에 직접 박아 넣을 때는 WorksheetAnalyzeView를 사용한다.
 */
export default function WorksheetAnalyzeModal({
  open, onClose, onResult, onComplete, submitLabel, requireConfirm,
}: Props) {
  if (!open) return null;
  const handleComplete = (r: AnalyzeResult) => {
    onResult?.(r);
    onComplete?.(r);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="활동지 올리기"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(17, 24, 39, 0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        fontFamily: "'Noto Sans KR', sans-serif",
        animation: "fadeSlideIn 240ms ease-out both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560,
          background: "#FFFBEB", borderRadius: 24,
          border: "3px solid #FDE68A",
          boxShadow: "0 30px 60px rgba(17,24,39,0.35)",
          padding: "18px 20px 22px",
          maxHeight: "92vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#92400E" }}>
            📋 활동지 올리기
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: "#FEF3C7", border: "1px solid #FDE68A",
              color: "#92400E", fontWeight: 900, cursor: "pointer",
            }}
          >✕</button>
        </div>
        <WorksheetAnalyzeView
          onComplete={(r) => { handleComplete(r); onClose(); }}
          submitLabel={submitLabel}
          requireConfirm={requireConfirm}
        />
      </div>
    </div>
  );
}

/**
 * 임베딩 가능한 활동지 OCR 뷰. PostModal 탭 내부에 박아 쓸 수 있다.
 * 사진 선택 → 클라이언트 리사이즈 → base64 → /api/worksheet-analyze → 마크다운 결과.
 */
export function WorksheetAnalyzeView({
  onComplete,
  submitLabel = "이 내용 사용하기",
  requireConfirm = true,
  compact = false,
}: ViewProps) {
  const [stage, setStage] = useState<Stage>("entry");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStage("entry");
    setPreviewUrl("");
    setProgress("");
    setResult("");
    setErrorMsg("");
  }

  async function handlePick(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("이미지 파일만 업로드할 수 있어요 (JPG, PNG, HEIC 등)");
      setStage("error");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg("20MB 이하 파일만 업로드할 수 있어요");
      setStage("error");
      return;
    }

    try {
      setStage("uploading");
      setProgress("📷 사진 불러오는 중…");
      const dataUrl = await resizeToDataUrl(file, MAX_DIM);
      setPreviewUrl(dataUrl);

      setStage("processing");
      setProgress("🐝 꿀벌이 글자를 읽고 있어요…");
      const res = await fetch("/api/worksheet-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "image", imageBase64: dataUrl }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `서버 오류 (${res.status})`);

      const content = String(body.content || "").trim();
      if (!content) throw new Error("글자를 인식하지 못했어요. 더 밝은 곳에서 다시 찍어보세요.");

      setResult(content);
      setModel(body.model || "");
      setStage("result");

      // If auto-mode, fire completion immediately. Otherwise wait for user confirm.
      if (!requireConfirm) {
        onComplete?.({ content, previewUrl: dataUrl, model: body.model || "" });
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "알 수 없는 오류");
      setStage("error");
    }
  }

  function submit() {
    onComplete?.({ content: result, previewUrl, model });
  }

  // ── render by stage (embeddable, no modal chrome) ───────────────
  return (
    <div style={{ padding: compact ? 0 : 2 }}>
      {stage === "entry" && (
        <EntryStage
          onPickCamera={() => cameraInputRef.current?.click()}
          onPickFile={() => fileInputRef.current?.click()}
        />
      )}
      {(stage === "uploading" || stage === "processing") && (
        <BusyStage previewUrl={previewUrl} progress={progress} />
      )}
      {stage === "result" && (
        <ResultStage
          previewUrl={previewUrl}
          content={result}
          requireConfirm={requireConfirm}
          submitLabel={submitLabel}
          onAgain={reset}
          onSubmit={submit}
        />
      )}
      {stage === "error" && (
        <ErrorStage message={errorMsg} onRetry={reset} />
      )}
      {/* Hidden file inputs — camera one requests rear camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          handlePick(f);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          handlePick(f);
        }}
      />
    </div>
  );
}

// ── stage views ────────────────────────────────────────────────────

function EntryStage({ onPickCamera, onPickFile }: { onPickCamera: () => void; onPickFile: () => void }) {
  return (
    <>
      <p style={{ margin: "0 0 16px", color: "#78350F", fontWeight: 700, lineHeight: 1.5, fontSize: 14 }}>
        종이 활동지를 사진으로 찍거나 파일로 올려봐.
        <br />
        꿀벌이 글자를 읽어서 정리해줄게 🐝
      </p>

      {/* Primary: camera/photo — large, prominent */}
      <button
        onClick={onPickCamera}
        style={{
          width: "100%",
          minHeight: 200,
          background: "linear-gradient(135deg, #FCD34D, #F59E0B)",
          border: "none", borderRadius: 22,
          color: "#7C2D12",
          fontWeight: 900, fontSize: 20,
          cursor: "pointer",
          boxShadow: "0 16px 36px rgba(245,158,11,0.35)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 10, padding: 20,
          transition: "transform 0.15s",
          fontFamily: "inherit",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <div style={{ fontSize: 72, lineHeight: 1 }}>📷</div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>사진 찍기 / 갤러리</div>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>
          활동지를 화면에 가득 채워서 찍어주세요
        </div>
      </button>

      {/* Secondary: file attach — compact */}
      <button
        onClick={onPickFile}
        style={{
          width: "100%", marginTop: 10,
          background: "#FEF3C7",
          border: "2px dashed #FDE68A",
          borderRadius: 14,
          color: "#92400E",
          fontSize: 13, fontWeight: 800,
          padding: "12px 14px",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 18 }}>📎</span>
        첨부파일에서 이미지 선택
      </button>

      <div style={{ fontSize: 11, color: "#92400E", marginTop: 12, opacity: 0.8, textAlign: "center" }}>
        JPG · PNG · HEIC · 20MB 이하
      </div>
    </>
  );
}

function BusyStage({ previewUrl, progress }: { previewUrl: string; progress: string }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0 12px" }}>
      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          style={{
            width: "100%", maxHeight: 260, objectFit: "contain",
            borderRadius: 14, background: "#FEF3C7",
            border: "2px solid #FDE68A",
          }}
        />
      ) : (
        <div style={{
          width: "100%", height: 200,
          background: "#FEF3C7", borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 48,
        }}>📷</div>
      )}
      <div style={{
        marginTop: 16, fontWeight: 900, color: "#92400E", fontSize: 15,
      }}>
        {progress}
      </div>
      <div style={{
        marginTop: 12, height: 6, borderRadius: 6,
        background: "#FDE68A", overflow: "hidden",
      }}>
        <div style={{
          width: "45%", height: "100%", background: "#F59E0B",
          animation: "captionProgress 1.4s ease-in-out infinite alternate",
          transformOrigin: "left",
        }} />
      </div>
    </div>
  );
}

function ResultStage({
  previewUrl, content, requireConfirm, submitLabel, onAgain, onSubmit,
}: {
  previewUrl: string;
  content: string;
  requireConfirm: boolean;
  submitLabel: string;
  onAgain: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          style={{
            width: "100%", maxHeight: 220, objectFit: "contain",
            borderRadius: 12, background: "#FEF3C7",
            border: "2px solid #FDE68A", marginBottom: 12,
          }}
        />
      )}
      <div style={{
        fontSize: 12, fontWeight: 900, color: "#92400E", marginBottom: 6,
      }}>
        ✨ 꿀벌이 읽어낸 내용
      </div>
      <pre style={{
        margin: 0, padding: "12px 14px",
        background: "#fff", border: "1.5px solid #FDE68A",
        borderRadius: 12, color: "#1F2937",
        fontSize: 13, lineHeight: 1.6,
        fontFamily: "'Noto Sans KR', sans-serif",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        maxHeight: "40vh", overflow: "auto",
      }}>{content}</pre>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          onClick={onAgain}
          style={{
            flex: "0 0 auto", padding: "11px 14px",
            background: "#FEF3C7", border: "2px solid #FDE68A",
            borderRadius: 12, color: "#92400E",
            fontWeight: 800, fontSize: 13, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >🔄 다시</button>
        <button
          onClick={() => navigator.clipboard?.writeText(content)}
          style={{
            flex: "0 0 auto", padding: "11px 14px",
            background: "#fff", border: "2px solid #FDE68A",
            borderRadius: 12, color: "#92400E",
            fontWeight: 800, fontSize: 13, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >📋</button>
        {requireConfirm && (
          <button
            onClick={onSubmit}
            style={{
              flex: 1, padding: "11px 14px",
              background: "#F59E0B", border: "none",
              borderRadius: 12, color: "#fff",
              fontWeight: 900, fontSize: 14, cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 6px 16px rgba(245,158,11,0.3)",
            }}
          >📨 {submitLabel}</button>
        )}
      </div>
    </>
  );
}

function ErrorStage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "18px 0" }}>
      <div style={{ fontSize: 48 }}>😢</div>
      <div style={{ marginTop: 10, fontSize: 15, fontWeight: 800, color: "#991B1B" }}>
        {message}
      </div>
      <button
        onClick={onRetry}
        style={{
          marginTop: 14, padding: "10px 20px",
          background: "#F59E0B", color: "#fff",
          border: "none", borderRadius: 12,
          fontWeight: 900, fontSize: 14, cursor: "pointer",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >🔄 다시 시도</button>
    </div>
  );
}

// ── image helpers ──────────────────────────────────────────────────

/**
 * Downscale an image to fit within maxDim on the longest edge and return a
 * JPEG data URL. OCR accuracy holds up to ~2048px while keeping payload/tokens
 * manageable. HEIC files that the browser can decode work transparently; if
 * the browser can't decode them we fall back to sending the original as a
 * data URL.
 */
async function resizeToDataUrl(file: File, maxDim: number): Promise<string> {
  try {
    const bitmap = await (window as unknown as { createImageBitmap: (f: Blob) => Promise<ImageBitmap> })
      .createImageBitmap(file);
    let { width, height } = bitmap;
    if (width <= maxDim && height <= maxDim && file.size < 1.5 * 1024 * 1024) {
      return await blobToDataUrl(file);
    }
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas context 없음");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    // HEIC 등 비-디코딩 포맷 → 원본 그대로 전송
    return await blobToDataUrl(file);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

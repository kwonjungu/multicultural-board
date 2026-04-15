"use client";

import { useRef, useState } from "react";
import { LANGUAGES } from "@/lib/constants";

interface Props {
  defaultFromLang: string;
  defaultToLang: string;
  onClose: () => void;
}

type Result = {
  blob: Blob;
  fileName: string;
  segments: number;
  backend: string;
};

export default function PptxTranslateModal({ defaultFromLang, defaultToLang, onClose }: Props) {
  const [fromLang, setFromLang] = useState(defaultFromLang || "ko");
  const [toLang, setToLang]     = useState(defaultToLang   || "en");
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      setError("PPTX 파일만 지원합니다");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("파일이 너무 큽니다 (최대 30MB)");
      return;
    }
    setError(null);
    setResult(null);
    setProcessing(true);
    setStatusMsg("📊 PPTX 분석 중...");

    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("fromLang", fromLang);
      fd.append("toLang", toLang);

      setStatusMsg("🌐 슬라이드 번역 중...");
      const res = await fetch("/api/pptx-translate", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "PPTX 번역 실패");
      }
      const blob = await res.blob();
      setResult({
        blob,
        fileName: file.name.replace(/\.pptx$/i, "") + `_${toLang}.pptx`,
        segments: Number(res.headers.get("X-Segments-Translated") || 0),
        backend:  res.headers.get("X-Translation-Backend") || "",
      });
    } catch (e: unknown) {
      setError((e as Error).message || "처리 중 오류가 발생했습니다");
    }
    setProcessing(false);
    setStatusMsg("");
  }

  function download() {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url; a.download = result.fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const selectStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 10,
    border: "1.5px solid #E5E7EB", fontSize: 13,
    background: "#F9FAFB", color: "#111827",
    outline: "none", cursor: "pointer", fontWeight: 600,
    fontFamily: "'Noto Sans KR', sans-serif",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(9,7,30,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, backdropFilter: "blur(6px)", padding: 16,
      }}
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 20,
        width: "100%", maxWidth: 560, padding: "24px clamp(16px, 4vw, 28px) 28px",
        boxShadow: "0 16px 60px rgba(0,0,0,0.35)",
        animation: "slideUp 0.22s ease",
        maxHeight: "92vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ fontSize: 26 }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#111827", letterSpacing: -0.2 }}>
              PPTX 슬라이드 번역
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
              파워포인트 파일의 텍스트를 번역해 새 파일로 저장
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              background: "#F3F4F6", border: "none", borderRadius: "50%",
              width: 30, height: 30, fontSize: 13, cursor: "pointer", color: "#6B7280",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        {/* Language direction */}
        <div style={{
          background: "#F8F9FC", borderRadius: 14, padding: "14px 16px",
          border: "1px solid #E9ECF5", marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1, marginBottom: 10 }}>
            번역 방향
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select value={fromLang} onChange={(e) => setFromLang(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
              {Object.entries(LANGUAGES).map(([code, info]) => (
                <option key={code} value={code}>{info.flag} {info.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 20, color: "#9CA3AF", fontWeight: 900, padding: "0 4px" }}>→</div>
            <select value={toLang} onChange={(e) => setToLang(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
              {Object.entries(LANGUAGES).map(([code, info]) => (
                <option key={code} value={code}>{info.flag} {info.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Upload area */}
        {!result && !processing && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = "#5B57F5"; }}
              onDragLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#D1D5DB"; }}
              onDrop={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).style.borderColor = "#D1D5DB";
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              style={{
                border: "2px dashed #D1D5DB", borderRadius: 14,
                padding: "48px 20px", textAlign: "center", cursor: "pointer",
                transition: "all 0.18s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = "#5B57F5";
                el.style.background = "rgba(91,87,245,0.03)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = "#D1D5DB";
                el.style.background = "transparent";
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 10 }}>📤</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 4 }}>
                PPTX 파일을 올리세요
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.7 }}>
                클릭하거나 드래그 앤 드롭<br />
                <span style={{ fontWeight: 600, color: "#6B7280" }}>.pptx</span> · 최대 30MB
              </div>
            </div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#FEF3C7", borderRadius: 10, fontSize: 11, color: "#92400E", lineHeight: 1.6 }}>
              💡 슬라이드 텍스트만 번역됩니다. 이미지 속 글자, 차트 데이터는 원본 그대로 유지돼요.
            </div>
          </>
        )}

        {/* Processing */}
        {processing && (
          <div style={{
            textAlign: "center", padding: "48px 20px",
            background: "#F8F9FC", borderRadius: 14, border: "1px solid #E9ECF5",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", margin: "0 auto 16px",
              border: "3px solid #E5E7EB", borderTopColor: "#5B57F5",
              animation: "spin 0.8s linear infinite",
            }} />
            <div style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>{statusMsg}</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8, lineHeight: 1.7 }}>
              슬라이드 수에 따라 10~60초 걸릴 수 있어요<br />
              오픈소스 NLLB-200 → 실패 시 Groq 폴백
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12,
            padding: "12px 16px", fontSize: 13, color: "#EF4444", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8, marginTop: 12,
          }}>
            ❌ {error}
            <button
              onClick={() => { setError(null); }}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#EF4444" }}
            >↩</button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{
            background: "linear-gradient(135deg, #F0EEFF, #FFF7ED)",
            borderRadius: 14, padding: "22px 18px",
            border: "1px solid #DDD9FF", textAlign: "center",
          }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1E1B4B", marginBottom: 6 }}>
              번역 완료
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
              {LANGUAGES[fromLang]?.flag} {LANGUAGES[fromLang]?.label} → {LANGUAGES[toLang]?.flag} {LANGUAGES[toLang]?.label}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 14 }}>
              {result.segments > 0 ? `${result.segments}개 텍스트 조각 번역` : ""}
              {result.backend === "hf" ? " · NLLB-200 (오픈소스)" : result.backend === "groq" ? " · Groq Llama" : ""}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setResult(null); setError(null); }}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 11, border: "1.5px solid #E5E7EB",
                  background: "#fff", color: "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >↩ 다른 파일</button>
              <button
                onClick={download}
                style={{
                  flex: 2, padding: "11px 0", borderRadius: 11, border: "none",
                  background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
                  color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(91,87,245,0.35)",
                }}
              >📥 다운로드</button>
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 12, lineHeight: 1.6 }}>
              원본 레이아웃 유지 · PowerPoint, Keynote, Google Slides 호환
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

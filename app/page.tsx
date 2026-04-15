"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES } from "@/lib/constants";

const DEFAULT_LANGS = ["ko", "en", "vi", "zh", "fil"];

const selectStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10,
  border: "1.5px solid #E5E7EB", fontSize: 13,
  background: "#F9FAFB", color: "#111827",
  outline: "none", cursor: "pointer", fontWeight: 600,
  fontFamily: "'Noto Sans KR', sans-serif", flex: 1,
};

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"join" | "create" | "pptx">("join");

  // ── Join ──────────────────────────────────────────────────────────
  const [joinCode, setJoinCode] = useState("");

  // ── Create ────────────────────────────────────────────────────────
  const [createCode, setCreateCode] = useState("");
  const [createLangs, setCreateLangs] = useState<string[]>(DEFAULT_LANGS);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── PPTX ──────────────────────────────────────────────────────────
  const [pptxFrom, setPptxFrom] = useState("ko");
  const [pptxTo,   setPptxTo]   = useState("en");
  const [pptxProcessing, setPptxProcessing] = useState(false);
  const [pptxStatus,  setPptxStatus]  = useState("");
  const [pptxError,   setPptxError]   = useState<string | null>(null);
  const [pptxResult,  setPptxResult]  = useState<{
    blob: Blob; fileName: string; segments: number; backend: string;
  } | null>(null);
  const pptxRef = useRef<HTMLInputElement>(null);

  // ── Handlers ─────────────────────────────────────────────────────
  function handleJoin() {
    const room = joinCode.replace(/\D/g, "").slice(0, 4);
    if (room.length === 4) router.push(`/${room}`);
  }

  async function handleCreate() {
    if (createCode.length !== 4 || creating) return;
    setCreating(true);
    setCreateMsg(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          password: "4321",
          roomCode: createCode,
          languages: createLangs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreateMsg({ text: `방 ${createCode} 생성 완료! 입장 중...`, ok: true });
      setTimeout(() => router.push(`/${createCode}`), 900);
    } catch (e: unknown) {
      setCreateMsg({ text: (e as Error).message || "오류 발생", ok: false });
    }
    setCreating(false);
  }

  function toggleLang(code: string) {
    setCreateLangs((prev) =>
      prev.includes(code)
        ? prev.length > 1 ? prev.filter((l) => l !== code) : prev
        : [...prev, code]
    );
  }

  async function handlePptxFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      setPptxError("PPTX 파일만 지원합니다");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setPptxError("파일이 너무 큽니다 (최대 30MB)");
      return;
    }
    setPptxError(null);
    setPptxResult(null);
    setPptxProcessing(true);
    setPptxStatus("📊 PPTX 분석 중...");

    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("fromLang", pptxFrom);
      fd.append("toLang",   pptxTo);

      setPptxStatus("🌐 슬라이드 번역 중...");
      const res = await fetch("/api/pptx-translate", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "PPTX 번역 실패");
      }
      const blob = await res.blob();
      setPptxResult({
        blob,
        fileName: file.name.replace(/\.pptx$/i, "") + `_${pptxTo}.pptx`,
        segments: Number(res.headers.get("X-Segments-Translated") || 0),
        backend:  res.headers.get("X-Translation-Backend") || "",
      });
    } catch (e: unknown) {
      setPptxError((e as Error).message || "처리 중 오류가 발생했습니다");
    }
    setPptxProcessing(false);
    setPptxStatus("");
  }

  function pptxDownload() {
    if (!pptxResult) return;
    const url = URL.createObjectURL(pptxResult.blob);
    const a = document.createElement("a");
    a.href = url; a.download = pptxResult.fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const joinReady   = joinCode.replace(/\D/g, "").length === 4;
  const createReady = createCode.length === 4 && createLangs.length > 0;

  const TABS = [
    { key: "join"   as const, label: "🚪 방 입장",   sub: "학생 · 교사" },
    { key: "create" as const, label: "✨ 방 만들기",  sub: "선생님 전용" },
    { key: "pptx"   as const, label: "📊 PPTX 번역", sub: "파일 변환"   },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d0b26 0%, #1e1b4b 50%, #16133a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif", padding: 20,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "fixed", top: "-15%", right: "-8%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(91,87,245,0.18) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-15%", left: "-8%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{
        background: "#fff", borderRadius: 28, padding: "36px 32px 32px",
        maxWidth: "min(480px, 92vw)", width: "100%",
        boxShadow: "0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        animation: "fadeSlideIn 0.4s ease", position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: "0 auto 14px",
            background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, boxShadow: "0 10px 30px rgba(91,87,245,0.45)",
          }}>🌏</div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: "#111827", letterSpacing: -0.5 }}>
            다문화 교실 소통판
          </h1>
        </div>

        {/* Tab switcher — 3 tabs */}
        <div style={{
          display: "flex", background: "#F3F4F6", borderRadius: 14,
          padding: 4, marginBottom: 26, gap: 3,
        }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setCreateMsg(null); setPptxError(null); }}
              style={{
                flex: 1, padding: "9px 4px", borderRadius: 11, border: "none",
                background: tab === t.key ? "#fff" : "transparent",
                boxShadow: tab === t.key ? "0 1px 6px rgba(0,0,0,0.1)" : "none",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 12, color: tab === t.key ? "#111827" : "#9CA3AF" }}>
                {t.label}
              </div>
              <div style={{ fontSize: 10, color: tab === t.key ? "#6B7280" : "#C4C4C4", marginTop: 1 }}>
                {t.sub}
              </div>
            </button>
          ))}
        </div>

        {/* ── 방 입장 ── */}
        {tab === "join" && (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1, textAlign: "center" }}>
              방 번호 ROOM CODE
            </p>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="0000"
              maxLength={4}
              autoFocus
              style={{
                width: "100%", padding: "18px 0", borderRadius: 16, marginBottom: 16,
                border: "2px solid #E5E7EB", fontSize: 36, fontWeight: 900,
                textAlign: "center", letterSpacing: 16, color: "#111827",
                background: "#F9FAFB", outline: "none", transition: "all 0.18s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#5B57F5"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 4px rgba(91,87,245,0.12)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; e.target.style.boxShadow = "none"; }}
            />
            <button
              onClick={handleJoin}
              disabled={!joinReady}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 15,
                background: joinReady ? "linear-gradient(135deg, #5B57F5, #8B5CF6)" : "#F3F4F6",
                color: joinReady ? "#fff" : "#D1D5DB",
                fontWeight: 800, border: "none",
                cursor: joinReady ? "pointer" : "not-allowed",
                boxShadow: joinReady ? "0 6px 24px rgba(91,87,245,0.4)" : "none",
                transition: "all 0.2s",
              }}
            >입장하기 →</button>
          </>
        )}

        {/* ── 방 만들기 ── */}
        {tab === "create" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
                방 번호 (4자리 숫자)
              </p>
              <input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => e.key === "Enter" && createReady && handleCreate()}
                placeholder="예: 1234"
                maxLength={4}
                autoFocus
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 14,
                  border: "2px solid #E5E7EB", fontSize: 28, fontWeight: 900,
                  textAlign: "center", letterSpacing: 12, color: "#111827",
                  background: "#F9FAFB", outline: "none", transition: "all 0.18s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#5B57F5"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 4px rgba(91,87,245,0.12)"; }}
                onBlur={(e)  => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1 }}>
                우리 반 언어 선택 ({createLangs.length}개)
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, maxHeight: 152, overflowY: "auto", padding: "2px 0" }}>
                {Object.entries(LANGUAGES).map(([code, info]) => {
                  const active = createLangs.includes(code);
                  return (
                    <button
                      key={code}
                      onClick={() => toggleLang(code)}
                      style={{
                        padding: "6px 12px", borderRadius: 20, fontSize: 12,
                        border: `1.5px solid ${active ? "#5B57F5" : "#E5E7EB"}`,
                        background: active ? "#EEEEFF" : "#F9FAFB",
                        color: active ? "#5B57F5" : "#6B7280",
                        fontWeight: active ? 700 : 400, cursor: "pointer",
                        transition: "all 0.12s", whiteSpace: "nowrap",
                      }}
                    >{info.flag} {info.label}</button>
                  );
                })}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9CA3AF" }}>
                학생 입장 시 선택한 언어만 표시됩니다
              </p>
            </div>

            <button
              onClick={handleCreate}
              disabled={!createReady || creating}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 15,
                background: createReady ? "linear-gradient(135deg, #5B57F5, #8B5CF6)" : "#F3F4F6",
                color: createReady ? "#fff" : "#D1D5DB",
                fontWeight: 800, border: "none",
                cursor: createReady ? "pointer" : "not-allowed",
                boxShadow: createReady ? "0 6px 24px rgba(91,87,245,0.4)" : "none",
                transition: "all 0.2s",
              }}
            >{creating ? "⟳ 생성 중..." : "방 만들기 →"}</button>

            {createMsg && (
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, textAlign: "center", color: createMsg.ok ? "#10B981" : "#EF4444" }}>
                {createMsg.ok ? "✅" : "❌"} {createMsg.text}
              </div>
            )}
          </>
        )}

        {/* ── PPTX 번역 ── */}
        {tab === "pptx" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* 언어 방향 */}
            <div style={{ background: "#F8F9FC", borderRadius: 14, padding: "14px 16px", border: "1px solid #E9ECF5" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1, marginBottom: 10 }}>
                번역 방향
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <select value={pptxFrom} onChange={(e) => setPptxFrom(e.target.value)} style={selectStyle}>
                  {Object.entries(LANGUAGES).map(([code, info]) => (
                    <option key={code} value={code}>{info.flag} {info.label}</option>
                  ))}
                </select>
                <div style={{ fontSize: 20, color: "#9CA3AF", fontWeight: 900, flexShrink: 0 }}>→</div>
                <select value={pptxTo} onChange={(e) => setPptxTo(e.target.value)} style={selectStyle}>
                  {Object.entries(LANGUAGES).map(([code, info]) => (
                    <option key={code} value={code}>{info.flag} {info.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 업로드 영역 */}
            {!pptxResult && !pptxProcessing && (
              <>
                <input
                  ref={pptxRef}
                  type="file"
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePptxFile(file);
                    e.target.value = "";
                  }}
                />
                <div
                  onClick={() => pptxRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = "#5B57F5"; }}
                  onDragLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#D1D5DB"; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#D1D5DB";
                    const file = e.dataTransfer.files[0];
                    if (file) handlePptxFile(file);
                  }}
                  style={{
                    border: "2px dashed #D1D5DB", borderRadius: 14,
                    padding: "40px 20px", textAlign: "center", cursor: "pointer",
                    transition: "all 0.18s",
                  }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#5B57F5"; el.style.background = "rgba(91,87,245,0.03)"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#D1D5DB"; el.style.background = "transparent"; }}
                >
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📤</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 4 }}>
                    PPTX 파일을 올리세요
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.7 }}>
                    클릭하거나 드래그 앤 드롭<br />
                    <span style={{ fontWeight: 600, color: "#6B7280" }}>.pptx</span> · 최대 30MB
                  </div>
                </div>
                <div style={{ padding: "10px 14px", background: "#FEF3C7", borderRadius: 10, fontSize: 11, color: "#92400E", lineHeight: 1.6 }}>
                  💡 슬라이드 텍스트만 번역됩니다. 이미지 속 글자·차트 데이터는 원본 그대로 유지돼요.
                </div>
              </>
            )}

            {/* 처리 중 */}
            {pptxProcessing && (
              <div style={{ textAlign: "center", padding: "36px 20px", background: "#F8F9FC", borderRadius: 14, border: "1px solid #E9ECF5" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", margin: "0 auto 14px", border: "3px solid #E5E7EB", borderTopColor: "#5B57F5", animation: "spin 0.8s linear infinite" }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>{pptxStatus}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6, lineHeight: 1.7 }}>
                  슬라이드 수에 따라 10~60초 걸릴 수 있어요
                </div>
              </div>
            )}

            {/* 오류 */}
            {pptxError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#EF4444", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                ❌ {pptxError}
                <button onClick={() => setPptxError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#EF4444" }}>↩</button>
              </div>
            )}

            {/* 완료 */}
            {pptxResult && (
              <div style={{ background: "linear-gradient(135deg, #F0EEFF, #FFF7ED)", borderRadius: 14, padding: "20px 18px", border: "1px solid #DDD9FF", textAlign: "center" }}>
                <div style={{ fontSize: 38, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#1E1B4B", marginBottom: 6 }}>번역 완료</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
                  {LANGUAGES[pptxFrom]?.flag} {LANGUAGES[pptxFrom]?.label} → {LANGUAGES[pptxTo]?.flag} {LANGUAGES[pptxTo]?.label}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 14 }}>
                  {pptxResult.segments > 0 ? `${pptxResult.segments}개 텍스트 조각 번역` : ""}
                  {pptxResult.backend === "hf" ? " · NLLB-200" : pptxResult.backend === "groq" ? " · Groq Llama" : ""}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setPptxResult(null); setPptxError(null); }}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "1.5px solid #E5E7EB", background: "#fff", color: "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >↩ 다른 파일</button>
                  <button
                    onClick={pptxDownload}
                    style={{ flex: 2, padding: "11px 0", borderRadius: 11, border: "none", background: "linear-gradient(135deg, #5B57F5, #8B5CF6)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(91,87,245,0.35)" }}
                  >📥 번역 파일 다운로드</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 관리자 링크 */}
        <div style={{ textAlign: "center", marginTop: 22 }}>
          <button
            onClick={() => router.push("/admin")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#C4C4C4", fontWeight: 500, transition: "color 0.15s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#C4C4C4")}
          >🔧 관리자 패널</button>
        </div>
      </div>
    </div>
  );
}

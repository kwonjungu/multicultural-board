"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES } from "@/lib/constants";
import BeeMascot from "@/components/BeeMascot";
import { PATTERN } from "@/lib/assets";

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
  const [view, setView] = useState<"hero" | "sub">("hero");

  // ── Join ──────────────────────────────────────────────────────────
  const [joinCode, setJoinCode] = useState("");

  // ── Create ────────────────────────────────────────────────────────
  const [createCode, setCreateCode] = useState("");
  const [createLangs, setCreateLangs] = useState<string[]>(DEFAULT_LANGS);
  const [createRosterText, setCreateRosterText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── PPTX ──────────────────────────────────────────────────────────
  const [pptxFrom, setPptxFrom] = useState("ko");
  const [pptxTo,   setPptxTo]   = useState("en");
  const [pptxProcessing, setPptxProcessing] = useState(false);
  const [pptxStatus,  setPptxStatus]  = useState("");
  const [pptxError,   setPptxError]   = useState<string | null>(null);
  const [pptxResult,  setPptxResult]  = useState<{
    blob: Blob; fileName: string; segments: number; backend: string; kind: "pptx" | "hwpx";
  } | null>(null);
  const pptxRef = useRef<HTMLInputElement>(null);

  // ── Handlers ─────────────────────────────────────────────────────
  function handleJoin() {
    const room = joinCode.replace(/\D/g, "").slice(0, 4);
    if (room.length === 4) router.push(`/${room}`);
  }

  function parsedRoster(): string[] {
    return createRosterText
      .split(/[,\n]+/)
      .map((n) => n.trim())
      .filter(Boolean);
  }

  async function handleCreate() {
    if (createCode.length !== 4 || creating) return;
    const roster = parsedRoster();
    if (roster.length < 1) {
      setCreateMsg({ text: "학생 이름을 최소 1명 입력해 주세요", ok: false });
      return;
    }
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
          roster,
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

  function getDocKind(file: File): "pptx" | "hwpx" | null {
    const n = file.name.toLowerCase();
    if (n.endsWith(".pptx")) return "pptx";
    if (n.endsWith(".hwpx")) return "hwpx";
    return null;
  }

  async function handlePptxFile(file: File) {
    const kind = getDocKind(file);
    if (!kind) {
      setPptxError("PPTX 또는 HWPX 파일만 지원합니다");
      return;
    }
    setPptxError(null);
    setPptxResult(null);
    setPptxProcessing(true);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(await file.arrayBuffer());

      if (kind === "pptx") {
        // ① 슬라이드 XML 추출
        setPptxStatus("📊 슬라이드 분석 중...");
        const slideXmls: Record<string, string> = {};
        const paths: string[] = [];
        zip.forEach((path) => {
          if (/^ppt\/slides\/slide\d+\.xml$/i.test(path)) paths.push(path);
        });
        for (const p of paths) {
          const f = zip.file(p);
          if (f) slideXmls[p] = await f.async("string");
        }
        if (paths.length === 0) throw new Error("슬라이드를 찾을 수 없습니다");

        setPptxStatus("🌐 슬라이드 번역 중...");
        const res = await fetch("/api/pptx-translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slideXmls, fromLang: pptxFrom, toLang: pptxTo }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "PPTX 번역 실패");
        }
        const { translatedXmls, segments } = await res.json() as {
          translatedXmls: Record<string, string>; segments: number;
        };

        setPptxStatus("📦 파일 재조립 중...");
        for (const [p, xml] of Object.entries(translatedXmls)) zip.file(p, xml);
        const outBuffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
        setPptxResult({
          blob: new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
          fileName: file.name.replace(/\.pptx$/i, "") + `_${pptxTo}.pptx`,
          segments,
          backend: "groq",
          kind,
        });

      } else {
        // ① 섹션 XML + header.xml 추출
        setPptxStatus("📄 문서 분석 중...");
        const sectionXmls: Record<string, string> = {};
        const paths: string[] = [];
        zip.forEach((p) => { if (/[Ss]ection\d+\.xml$/.test(p)) paths.push(p); });
        for (const p of paths) {
          const f = zip.file(p);
          if (f) sectionXmls[p] = await f.async("string");
        }
        if (paths.length === 0) throw new Error("섹션 파일을 찾을 수 없습니다 (HWPX 형식인지 확인하세요)");

        // header.xml: 폰트 테이블 + 스타일 정의
        let headerXml: string | undefined;
        let headerPath: string | undefined;
        const HEADER_PATHS = ["Contents/header.xml", "header.xml", "Contents/head.xml", "head.xml"];
        for (const hp of HEADER_PATHS) {
          const f = zip.file(hp);
          if (f) { headerXml = await f.async("string"); headerPath = hp; break; }
        }
        // 폴백: zip 전체에서 header.xml 패턴 검색
        if (!headerPath) {
          zip.forEach((p) => { if (!headerPath && /(?:^|\/)header\.xml$/i.test(p)) headerPath = p; });
          if (headerPath) {
            const f = zip.file(headerPath);
            if (f) headerXml = await f.async("string");
          }
        }

        setPptxStatus("🌐 문서 번역 중...");
        const res = await fetch("/api/hwpx-translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionXmls, fromLang: pptxFrom, toLang: pptxTo, headerXml }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "HWPX 번역 실패");
        }
        const { translatedXmls, translatedHeaderXml, segments } = await res.json() as {
          translatedXmls: Record<string, string>;
          translatedHeaderXml?: string;
          segments: number;
        };

        setPptxStatus("📦 파일 재조립 중...");
        for (const [p, xml] of Object.entries(translatedXmls)) zip.file(p, xml);
        if (translatedHeaderXml && headerPath) zip.file(headerPath, translatedHeaderXml);
        const outBuffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
        setPptxResult({
          blob: new Blob([outBuffer], { type: "application/octet-stream" }),
          fileName: file.name.replace(/\.hwpx$/i, "") + `_${pptxTo}.hwpx`,
          segments,
          backend: "groq",
          kind,
        });
      }
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
  const createReady = createCode.length === 4 && createLangs.length > 0 && parsedRoster().length >= 1;

  function enterView(next: "join" | "create" | "pptx") {
    setTab(next);
    setView("sub");
    setCreateMsg(null);
    setPptxError(null);
  }
  function backToHero() {
    setView("hero");
    setCreateMsg(null);
    setPptxError(null);
  }

  const SUB_TITLE: Record<"join" | "create" | "pptx", string> = {
    join: "🚪 방에 들어가기",
    create: "✨ 새 방 만들기",
    pptx: "📄 문서 번역하기",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 60%, #FDE68A 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif", padding: 20,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `url(${PATTERN.honeycomb})`,
        backgroundSize: "280px auto",
        backgroundRepeat: "repeat",
        opacity: 0.12,
      }} />
      <div style={{ position: "fixed", bottom: "-20%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(252,211,77,0.35) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{
        background: "#fff", borderRadius: 28, padding: view === "hero" ? "40px 28px 28px" : "22px 28px 28px",
        maxWidth: "min(480px, 92vw)", width: "100%",
        boxShadow: "0 30px 80px rgba(180,83,9,0.18), 0 0 0 1px rgba(253,230,138,0.6)",
        animation: "fadeSlideIn 0.4s ease", position: "relative", zIndex: 1,
        overflow: "hidden",
      }}>
        {view === "hero" && (
          <div aria-hidden="true" style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
            opacity: 0.18,
            backgroundImage: `url(${PATTERN.flowers})`,
            backgroundPosition: "center bottom",
            backgroundSize: "85% auto",
            backgroundRepeat: "no-repeat",
          }} />
        )}
        {view === "hero" ? (
          <>
            {/* Hero: big mascot + 2 CTAs */}
            <div style={{ textAlign: "center", marginBottom: 28, position: "relative", zIndex: 1 }}>
              <div style={{ display: "inline-block", position: "relative", marginBottom: 10 }}>
                <img
                  src="/mascot/bee-welcome.png"
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: 180, height: 180, display: "block",
                    filter: "drop-shadow(0 10px 24px rgba(245,158,11,0.35))",
                    animation: "heroBeeFloat 3s ease-in-out infinite",
                  }}
                />
                <div style={{
                  position: "absolute", top: 8, right: -60,
                  background: "#fff", padding: "10px 16px", borderRadius: 20,
                  borderBottomLeftRadius: 4,
                  boxShadow: "0 6px 20px rgba(180,83,9,0.18)",
                  border: "2px solid #FDE68A",
                  fontSize: 15, fontWeight: 900, color: "#B45309",
                  whiteSpace: "nowrap",
                }}>안녕, 친구야! 👋</div>
              </div>
              <h1 style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900, color: "#1F2937", letterSpacing: -0.6, lineHeight: 1.25 }}>
                우리 반에<br/>놀러 갈까?
              </h1>
              <p style={{ margin: "10px 0 0", fontSize: 15, color: "#92400E", fontWeight: 700 }}>
                방 번호를 눌러서 들어가요
              </p>
            </div>

            {/* Two giant CTAs */}
            <button
              onClick={() => enterView("join")}
              style={{
                width: "100%", minHeight: 76, borderRadius: 22, border: "none",
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#fff", fontSize: 22, fontWeight: 900,
                boxShadow: "0 10px 28px rgba(245,158,11,0.4), inset 0 -4px 0 rgba(0,0,0,0.15)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                marginBottom: 12, transition: "transform 0.12s",
                position: "relative", zIndex: 1,
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <span style={{ fontSize: 30 }}>🚪</span> 방에 들어가기
            </button>

            <button
              onClick={() => enterView("create")}
              style={{
                width: "100%", minHeight: 66, borderRadius: 20,
                background: "#fff", border: "3px solid #FDE68A",
                color: "#B45309", fontSize: 18, fontWeight: 900,
                boxShadow: "0 6px 16px rgba(180,83,9,0.1)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "transform 0.12s, background 0.15s, border-color 0.15s",
                position: "relative", zIndex: 1,
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#FEF3C7"; e.currentTarget.style.borderColor = "#F59E0B"; }}
            >
              ✨ 새 방 만들기
              <span style={{ fontSize: 12, background: "#FEF3C7", padding: "3px 10px", borderRadius: 999, color: "#92400E", fontWeight: 800 }}>선생님</span>
            </button>

            <button
              onClick={() => enterView("pptx")}
              style={{
                width: "100%", marginTop: 14, background: "none", border: "none",
                color: "#92400E", fontSize: 14, fontWeight: 800, cursor: "pointer",
                textDecoration: "underline", textUnderlineOffset: 4, padding: "6px 0",
                position: "relative", zIndex: 1,
              }}
            >📄 문서 번역하기</button>
          </>
        ) : (
          <>
            {/* Sub header with back button */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <button
                onClick={backToHero}
                aria-label="뒤로"
                style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: "#fff", border: "2px solid #FDE68A",
                  fontSize: 18, fontWeight: 900, color: "#92400E", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FEF3C7"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#F59E0B"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#FDE68A"; }}
              >←</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
                  {SUB_TITLE[tab]}
                </div>
              </div>
              <img
                src={`/mascot/bee-${tab === "pptx" ? "loading" : tab === "create" ? "shh" : "cheer"}.png`}
                alt=""
                aria-hidden="true"
                style={{ width: 52, height: 52, flexShrink: 0, filter: "drop-shadow(0 4px 12px rgba(245,158,11,0.3))" }}
              />
            </div>
          </>
        )}


        {/* ── 방 입장: 터치 키패드 ── */}
        {view === "sub" && tab === "join" && (
          <div
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key >= "0" && e.key <= "9" && joinCode.length < 4) {
                setJoinCode((c) => (c + e.key).slice(0, 4));
              } else if (e.key === "Backspace") {
                setJoinCode((c) => c.slice(0, -1));
              } else if (e.key === "Enter" && joinReady) {
                handleJoin();
              }
            }}
            style={{ outline: "none" }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: "#92400E", textAlign: "center" }}>
              방 번호 4자리를 눌러 주세요
            </p>

            {/* 4 digit display boxes */}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 22 }}>
              {[0, 1, 2, 3].map((i) => {
                const d = joinCode[i];
                const filled = !!d;
                const nextSlot = !filled && i === joinCode.length;
                return (
                  <div
                    key={i}
                    style={{
                      width: 56, height: 68, borderRadius: 16,
                      background: filled ? "#fff" : nextSlot ? "rgba(255,255,255,0.85)" : "rgba(255,251,235,0.6)",
                      border: `3px solid ${filled ? "#F59E0B" : nextSlot ? "#FBBF24" : "#FDE68A"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 34, fontWeight: 900, color: "#B45309",
                      boxShadow: filled ? "0 4px 0 rgba(180,83,9,0.15)" : "none",
                      transition: "all 0.12s",
                    }}
                  >
                    {d || (nextSlot ? <span style={{ width: 4, height: 36, background: "#FBBF24", borderRadius: 2, animation: "pulse 1s ease-in-out infinite" }}/> : "")}
                  </div>
                );
              })}
            </div>

            {/* 3×4 touch keypad */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {([1, 2, 3, 4, 5, 6, 7, 8, 9, "clear", 0, "del"] as const).map((k) => {
                const label = k === "del" ? "⌫" : k === "clear" ? "초기화" : String(k);
                const isAction = k === "del" || k === "clear";
                return (
                  <button
                    key={String(k)}
                    onClick={() => {
                      if (k === "del") setJoinCode((c) => c.slice(0, -1));
                      else if (k === "clear") setJoinCode("");
                      else if (joinCode.length < 4) setJoinCode((c) => (c + k).slice(0, 4));
                    }}
                    aria-label={k === "del" ? "지우기" : k === "clear" ? "모두 지우기" : `숫자 ${k}`}
                    style={{
                      minHeight: 64, borderRadius: 20,
                      background: isAction ? "#FEF3C7" : "#fff",
                      border: `2px solid ${isAction ? "#FBBF24" : "#FDE68A"}`,
                      fontSize: isAction ? 14 : 26, fontWeight: 900, color: "#B45309",
                      cursor: "pointer",
                      boxShadow: "0 3px 0 rgba(180,83,9,0.12)",
                      transition: "transform 0.1s, background 0.12s",
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(2px)")}
                    onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                  >{label}</button>
                );
              })}
            </div>

            <button
              onClick={handleJoin}
              disabled={!joinReady}
              style={{
                width: "100%", minHeight: 68, borderRadius: 22, fontSize: 22,
                background: joinReady ? "linear-gradient(135deg, #F59E0B, #D97706)" : "#F3F4F6",
                color: joinReady ? "#fff" : "#D1D5DB",
                fontWeight: 900, border: "none",
                cursor: joinReady ? "pointer" : "not-allowed",
                boxShadow: joinReady ? "0 10px 28px rgba(245,158,11,0.45), inset 0 -4px 0 rgba(0,0,0,0.15)" : "none",
                transition: "all 0.15s",
              }}
            >🐝 들어가기 →</button>
          </div>
        )}

        {/* ── 방 만들기 ── */}
        {view === "sub" && tab === "create" && (
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
                onFocus={(e) => { e.target.style.borderColor = "#F59E0B"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 4px rgba(245,158,11,0.18)"; }}
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
                        border: `1.5px solid ${active ? "#F59E0B" : "#E5E7EB"}`,
                        background: active ? "#FEF3C7" : "#F9FAFB",
                        color: active ? "#F59E0B" : "#6B7280",
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

            {/* Roster — 최소 1명 필수 */}
            <div style={{ marginBottom: 22 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#B45309", letterSpacing: 1 }}>
                학생 이름 (최소 1명, 쉼표 또는 줄바꿈으로 구분)
              </p>
              <textarea
                value={createRosterText}
                onChange={(e) => setCreateRosterText(e.target.value)}
                placeholder="예시:&#10;김민지&#10;응우엔 란&#10;웨이"
                rows={4}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 14,
                  border: "2px solid #FDE68A", fontSize: 15, color: "#1F2937",
                  background: "#FFFBEB", outline: "none", resize: "vertical",
                  boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.55,
                  fontWeight: 500,
                }}
                onFocus={(e) => { e.target.style.borderColor = "#F59E0B"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 4px rgba(245,158,11,0.18)"; }}
                onBlur={(e) => { e.target.style.borderColor = "#FDE68A"; e.target.style.background = "#FFFBEB"; e.target.style.boxShadow = "none"; }}
              />
              <p style={{ margin: "6px 0 0", fontSize: 11, color: parsedRoster().length >= 1 ? "#10B981" : "#92400E", fontWeight: 700 }}>
                {parsedRoster().length >= 1 ? `✓ ${parsedRoster().length}명 등록됨` : "⚠ 최소 1명의 학생 이름이 필요해요"}
              </p>
            </div>

            <button
              onClick={handleCreate}
              disabled={!createReady || creating}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 14, fontSize: 15,
                background: createReady ? "linear-gradient(135deg, #F59E0B, #D97706)" : "#F3F4F6",
                color: createReady ? "#fff" : "#D1D5DB",
                fontWeight: 800, border: "none",
                cursor: createReady ? "pointer" : "not-allowed",
                boxShadow: createReady ? "0 6px 24px rgba(245,158,11,0.4)" : "none",
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
        {view === "sub" && tab === "pptx" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* 언어 방향 */}
            <div style={{ background: "#FFFBEB", borderRadius: 14, padding: "14px 16px", border: "1px solid #FDE68A" }}>
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
                  accept=".pptx,.hwpx"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePptxFile(file);
                    e.target.value = "";
                  }}
                />
                <div
                  onClick={() => pptxRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = "#F59E0B"; }}
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
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#F59E0B"; el.style.background = "rgba(245,158,11,0.06)"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#D1D5DB"; el.style.background = "transparent"; }}
                >
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📤</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 4 }}>
                    문서 파일을 올리세요
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.7 }}>
                    클릭하거나 드래그 앤 드롭<br />
                    <span style={{ fontWeight: 600, color: "#6B7280" }}>.pptx</span>
                    {" · "}
                    <span style={{ fontWeight: 600, color: "#6B7280" }}>.hwpx</span>
                  </div>
                </div>
                <div style={{ padding: "10px 14px", background: "#FEF3C7", borderRadius: 10, fontSize: 11, color: "#92400E", lineHeight: 1.6 }}>
                  💡 텍스트만 번역됩니다. 이미지 속 글자·차트 데이터는 원본 그대로 유지돼요.
                </div>
              </>
            )}

            {/* 처리 중 */}
            {pptxProcessing && (
              <div style={{ textAlign: "center", padding: "36px 20px", background: "#FFFBEB", borderRadius: 14, border: "1px solid #FDE68A" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", margin: "0 auto 14px", border: "3px solid #E5E7EB", borderTopColor: "#F59E0B", animation: "spin 0.8s linear infinite" }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>{pptxStatus}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6, lineHeight: 1.7 }}>
                  문서 크기에 따라 10~60초 걸릴 수 있어요
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
              <div style={{ background: "linear-gradient(135deg, #FEF3C7, #FFF7ED)", borderRadius: 14, padding: "20px 18px", border: "1px solid #FDE68A", textAlign: "center" }}>
                <div style={{ fontSize: 38, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#B45309", marginBottom: 6 }}>번역 완료</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
                  {LANGUAGES[pptxFrom]?.flag} {LANGUAGES[pptxFrom]?.label} → {LANGUAGES[pptxTo]?.flag} {LANGUAGES[pptxTo]?.label}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 14 }}>
                  {pptxResult.segments > 0 ? `${pptxResult.segments}개 텍스트 조각 번역 · ` : ""}
                  {pptxResult.kind === "pptx" ? "PowerPoint" : "한글(HWPX)"} · Groq Llama
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setPptxResult(null); setPptxError(null); }}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "1.5px solid #E5E7EB", background: "#fff", color: "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >↩ 다른 파일</button>
                  <button
                    onClick={pptxDownload}
                    style={{ flex: 2, padding: "11px 0", borderRadius: 11, border: "none", background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}
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

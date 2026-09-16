"use client";

import { useEffect, useRef, useState } from "react";
import AppIcon from "@/components/ui/child/AppIcon";
import { useRouter } from "next/navigation";
import { LANGUAGES } from "@/lib/constants";
import BeeBanner from "@/components/BeeBanner";
import FlyingBees from "@/components/ui/FlyingBees";
import ScopedStyle from "@/components/ui/child/ScopedStyle";

const DEFAULT_LANGS = ["ko", "en", "vi", "zh", "fil"];

/**
 * 루트 `/` 진입 — 작업 B-01.
 *
 * 아이가 여기서 할 일은 하나다: **우리 교실 번호를 눌러 들어가기**(README §5.1).
 * 그래서 기본 화면에는 제목 · 번호 입력 · 들어가기만 둔다. 방 만들기 · 문서 번역 ·
 * 관리자는 교사 도구라 아래쪽 보조 링크로 내려간다.
 *
 * `/1111` 처럼 번호가 이미 주어진 QR 진입은 이 화면을 거치지 않는다 — 그 경로와
 * `/^\d{4}$/` 방 번호 규칙은 종전 그대로다.
 */
type JoinState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "missing"; code: string }
  | { kind: "offline"; code: string };

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"join" | "create" | "pptx">("join");
  const [view, setView] = useState<"join" | "sub">("join");

  // ── Join ──────────────────────────────────────────────────────────
  const [joinCode, setJoinCode] = useState("");
  const [joinState, setJoinState] = useState<JoinState>({ kind: "idle" });
  /** 연타로 확인 요청이 여러 번 나가지 않게 한다 (ENTRY-02 와 같은 규칙). */
  const checking = useRef(false);

  // ── Create ────────────────────────────────────────────────────────
  const [createCode, setCreateCode] = useState("");
  const [createLangs, setCreateLangs] = useState<string[]>(DEFAULT_LANGS);
  const [createRosterText, setCreateRosterText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── PPTX / HWPX ───────────────────────────────────────────────────
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
  /**
   * 방이 실제로 있는지 먼저 확인한다. 확인 결과는 세 가지로 갈라진다:
   *   찾는 중 / 그런 방 없음 / 확인 자체를 못 함(연결 실패).
   * 확인을 못 한 경우에는 아이를 막지 않는다 — 못 들어가는 게 아니라
   * '확인을 못 했을 뿐'이므로 그대로 들어가는 길을 함께 준다.
   * Firebase 는 여기서만 필요하니 지연 로드한다(랜딩 번들 보호).
   */
  async function handleJoin() {
    const room = joinCode.replace(/\D/g, "").slice(0, 4);
    if (!/^\d{4}$/.test(room)) return;
    if (checking.current) return;
    checking.current = true;
    setJoinState({ kind: "checking" });
    try {
      const [{ getClientDb }, { ref, get }] = await Promise.all([
        import("@/lib/firebase-client"),
        import("firebase/database"),
      ]);
      const db = getClientDb();
      // config 가 정석이지만, 옛 방은 meta 만 있을 수 있어 둘 다 본다.
      const [config, meta] = await Promise.all([
        get(ref(db, `rooms/${room}/config`)),
        get(ref(db, `rooms/${room}/meta`)),
      ]);
      checking.current = false;
      if (config.exists() || meta.exists()) {
        router.push(`/${room}`);
        return;
      }
      setJoinState({ kind: "missing", code: room });
    } catch {
      checking.current = false;
      setJoinState({ kind: "offline", code: room });
    }
  }

  /** 확인 없이 그대로 들어간다 — 연결 실패 때만 보여 준다. */
  function joinAnyway(code: string) {
    router.push(`/${code}`);
  }

  function editCode(next: (c: string) => string) {
    setJoinState({ kind: "idle" });
    setJoinCode((c) => next(c));
  }

  /**
   * 키보드로도 교실 번호를 넣는다.
   *
   * 화면 키패드는 태블릿 터치 기준으로 만든 것이고, 크롬북·노트북에서는
   * 숫자를 그냥 치는 것이 훨씬 빠르다. 04 §4 가 "크롬북은 트랙패드·키보드" 를
   * 핵심 입력으로 꼽은 이유다.
   *
   * 가로채면 안 되는 경우를 먼저 빠져나간다:
   *  - 다른 입력칸(교실 만들기 명렬표, 교사 PIN 등)에 포커스가 있을 때
   *  - 한글·일본어·중국어 조합 중일 때(IME) — 조합 중 Enter 는 확정용이다
   *  - Ctrl/Cmd/Alt 조합 — 브라우저 단축키를 빼앗지 않는다
   *  - 들어가기 화면이 아닐 때(교실 만들기·문서 번역 탭)
   */
  useEffect(() => {
    if (view !== "join" || tab !== "join") return;

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.isComposing) return;
      const el = e.target as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        editCode((c) => (c.length >= 4 ? c : c + e.key));
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        editCode((c) => c.slice(0, -1));
        return;
      }
      if (e.key === "Delete" || e.key === "Escape") {
        e.preventDefault();
        editCode(() => "");
        return;
      }
      if (e.key === "Enter") {
        // 네 자리가 다 찼을 때만. 아니면 아무 일도 하지 않는다(오동작 방지).
        if (joinCode.replace(/\D/g, "").length !== 4) return;
        // 버튼에 포커스가 있으면 그 버튼의 기본 동작에 맡긴다 — 두 번 실행 금지.
        if (el && el.tagName === "BUTTON") return;
        e.preventDefault();
        void handleJoin();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // handleJoin 은 매 렌더 새로 만들어지므로 의존성에 넣지 않는다 — 최신
    // joinCode 는 위에서 직접 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tab, joinCode]);

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
    document.body.appendChild(a); a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const joinReady   = joinCode.replace(/\D/g, "").length === 4;
  const createReady = createCode.length === 4 && createLangs.length > 0 && parsedRoster().length >= 1;

  function enterView(next: "create" | "pptx") {
    setTab(next);
    setView("sub");
    setCreateMsg(null);
    setPptxError(null);
  }
  function backToJoin() {
    setView("join");
    setTab("join");
    setCreateMsg(null);
    setPptxError(null);
  }

  /** 한국어·일본어·중국어 조합 중 Enter 는 확정용이다 — 전송으로 쓰지 않는다. */
  const enterUnlessComposing = (run: () => void) => (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
    run();
  };

  return (
    <>
    {/* 앱 이름표 — 화면 맨 위에 상시로 뜬다. position:fixed 라서
        transform 이 걸린 조상 안에 두면 고정이 깨진다. 최상위에 둔다. */}
    <BeeBanner />
    <div data-ux-root className="root-page">
      <ScopedStyle css={ROOT_CSS} />
      <div aria-hidden="true" className="root-backdrop" />
      <FlyingBees />

      <div className="root-shell">
        <main className={view === "join" ? "root-panel join" : "root-panel"} data-ux-surface="panel">
          {/* ── 기본 화면: 우리 교실에 들어가요 ─────────────────────── */}
          {view === "join" && (
            <>
              <div className="root-hero">
                <img src="/mascot/bee-welcome.png" alt="" aria-hidden="true" className="root-hero-bee" />
                <h1 data-ux-role="title" className="root-title">우리 교실에 들어가요</h1>
                <p data-ux-role="body" className="root-sub">교실 번호 네 자리를 눌러 주세요</p>
                {/* 크롬북·노트북에서는 그냥 치는 게 빠르다. 키보드가 없는
                    태블릿에서는 이 줄이 방해되지 않도록 보조 크기로 둔다. */}
                <p data-ux-role="secondary" className="root-kbdhint">
                  키보드로 숫자를 눌러도 돼요 · <kbd>⌫</kbd> 지우기 · <kbd>Enter</kbd> 들어가기
                </p>
              </div>

              {/* 가로로 넓고 세로로 짧은 크롬북·노트북에서는 안내(왼쪽)와
                  입력(오른쪽)을 두 열로 나눈다. 한 열로 쌓으면 1366x768 에서
                  문서가 1130px 이 되어 정작 들어가기 가 화면 밖(y=770)으로
                  밀렸다 — 첫 화면에서 아이가 스크롤을 해야 하는 상태였다. */}
              <div className="root-entry">
              {/* 네 자리 표시 — 지금 어디를 누르는지 보이게 한다 */}
              <div className="root-digits" role="status" aria-label={`교실 번호 ${joinCode || "없음"}`}>
                {[0, 1, 2, 3].map((i) => {
                  const d = joinCode[i];
                  const nextSlot = !d && i === joinCode.length;
                  return (
                    <span key={i} className={d ? "root-digit filled" : nextSlot ? "root-digit next" : "root-digit"}>
                      {d || ""}
                    </span>
                  );
                })}
              </div>

              <div
                className="root-keypad"
                role="group"
                aria-label="교실 번호 누르기"
                onKeyDown={enterUnlessComposing(() => { if (joinReady) void handleJoin(); })}
              >
                {([1, 2, 3, 4, 5, 6, 7, 8, 9, "clear", 0, "del"] as const).map((k) => {
                  const isEdit = k === "del" || k === "clear";
                  const label = k === "del" ? "지우기" : k === "clear" ? "모두 지우기" : String(k);
                  return (
                    <button
                      key={String(k)}
                      type="button"
                      data-ux-role="control"
                      className={isEdit ? "root-key edit" : "root-key"}
                      onClick={() => {
                        if (k === "del") editCode((c) => c.slice(0, -1));
                        else if (k === "clear") editCode(() => "");
                        else editCode((c) => (c.length < 4 ? (c + k).slice(0, 4) : c));
                      }}
                    >
                      {/* 아이콘만 두지 않는다 — 지우기 버튼에는 글자 라벨을 붙이고,
                          숫자는 그 숫자 자체가 이름이므로 aria-hidden 으로 가리지 않는다.
                          (실측: 가려 두었더니 숫자 키에 접근 가능한 이름이 아예 없었다.) */}
                      <span aria-hidden={isEdit} className="root-key-glyph">
                        {k === "del" ? "⌫" : k === "clear" ? "✕" : k}
                      </span>
                      {isEdit && <span className="root-key-label">{label}</span>}
                    </button>
                  );
                })}
              </div>

              {/* 상태 — 로딩 / 방 없음 / 연결 실패를 각각 다르게 말한다 */}
              {joinState.kind === "checking" && (
                <p data-ux-role="body" className="root-state" role="status">
                  <span aria-hidden>🐝</span> 우리 교실을 찾는 중이에요…
                </p>
              )}
              {joinState.kind === "missing" && (
                <div className="root-state warn" role="alert">
                  <p data-ux-role="body" className="root-state-line">
                    {joinState.code}번 교실을 찾지 못했어요. 번호를 다시 확인해 주세요.
                  </p>
                  <button type="button" data-ux-role="control" className="root-retry" onClick={() => void handleJoin()}>
                    다시 찾아보기
                  </button>
                </div>
              )}
              {joinState.kind === "offline" && (
                <div className="root-state warn" role="alert">
                  <p data-ux-role="body" className="root-state-line">
                    연결이 잠깐 끊겼어요. 누른 번호는 그대로 있어요.
                  </p>
                  <div className="root-state-actions">
                    <button type="button" data-ux-role="control" className="root-retry" onClick={() => void handleJoin()}>
                      다시 시도하기
                    </button>
                    <button
                      type="button"
                      data-ux-role="control"
                      className="root-retry"
                      onClick={() => joinAnyway(joinState.code)}
                    >
                      그래도 들어가기
                    </button>
                  </div>
                </div>
              )}

              {/* 못 누르는 버튼도 읽히게 둔다 — disabled 대신 이유를 말한다. */}
              <button
                type="button"
                data-ux-role="action"
                className="root-cta"
                aria-disabled={!joinReady || joinState.kind === "checking"}
                aria-describedby="root-cta-hint"
                onClick={() => {
                  if (!joinReady) return;
                  void handleJoin();
                }}
              >
                {/* U03 — 입장 CTA 에 03 에셋가이드의 enter 그림 아이콘.
                    확인 중에는 글자만 남긴다(그림이 바뀌면 상태가 헷갈린다). */}
                {joinState.kind === "checking"
                  ? "들어가는 중…"
                  : <><AppIcon name="enter" size={28} className="root-cta-ico" />들어가기</>}
              </button>
              <p id="root-cta-hint" data-ux-role="secondary" className="root-cta-hint">
                {joinReady ? "교실 번호가 다 채워졌어요" : "네 자리를 모두 눌러야 들어갈 수 있어요"}
              </p>
              </div>

              {/* 교사 도구는 아이의 흐름에서 비켜난 보조 링크다. */}
              <div className="root-teacher-links">
                <button type="button" data-ux-role="control" className="root-link" onClick={() => enterView("create")}>
                  ✨ 새 교실 만들기 <span data-ux-role="secondary">선생님</span>
                </button>
                <button type="button" data-ux-role="control" className="root-link" onClick={() => enterView("pptx")}>
                  📄 문서 번역하기 <span data-ux-role="secondary">선생님</span>
                </button>
                <button type="button" data-ux-role="control" className="root-link quiet" onClick={() => router.push("/admin")}>
                  🔧 관리자 패널
                </button>
              </div>
            </>
          )}

          {/* ── 보조 화면: 교사 도구 ───────────────────────────────── */}
          {view === "sub" && (
            <>
              <div className="root-subhead">
                <button type="button" data-ux-role="control" className="root-back" onClick={backToJoin}>
                  <span aria-hidden>←</span> <span>뒤로</span>
                </button>
                <h1 data-ux-role="title" className="root-title small">
                  {tab === "create" ? "새 교실 만들기" : "문서 번역하기"}
                </h1>
              </div>

              {tab === "create" && (
                <>
                  <label data-ux-role="label" className="root-label" htmlFor="root-create-code">
                    교실 번호 (숫자 네 자리)
                  </label>
                  <input
                    id="root-create-code"
                    className="root-input code"
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onKeyDown={enterUnlessComposing(() => { if (createReady) void handleCreate(); })}
                    placeholder="1234"
                    inputMode="numeric"
                    maxLength={4}
                  />

                  <p data-ux-role="label" className="root-label">
                    우리 반 언어 ({createLangs.length}개)
                  </p>
                  <div className="root-langs" role="group" aria-label="우리 반 언어 고르기">
                    {Object.entries(LANGUAGES).map(([code, info]) => {
                      const active = createLangs.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          data-ux-role="control"
                          className={active ? "root-lang on" : "root-lang"}
                          aria-pressed={active}
                          onClick={() => toggleLang(code)}
                        >
                          <span aria-hidden>{info.flag}</span>
                          <span data-ux-role="label" lang={code} className="root-lang-name">{info.label}</span>
                          <span aria-hidden className="root-check">{active ? "✓" : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p data-ux-role="secondary" className="root-note">학생 입장 화면에는 고른 언어만 보여요</p>

                  <label data-ux-role="label" className="root-label" htmlFor="root-roster">
                    학생 이름 (쉼표 또는 줄바꿈으로 구분, 최소 1명)
                  </label>
                  <textarea
                    id="root-roster"
                    className="root-input area"
                    value={createRosterText}
                    onChange={(e) => setCreateRosterText(e.target.value)}
                    rows={4}
                    placeholder={"학생 01\n학생 02"}
                  />
                  <p data-ux-role="secondary" className={parsedRoster().length >= 1 ? "root-note ok" : "root-note warn"}>
                    {parsedRoster().length >= 1
                      ? `${parsedRoster().length}명 등록됨`
                      : "최소 1명의 학생 이름이 필요해요"}
                  </p>

                  <button
                    type="button"
                    data-ux-role="action"
                    className="root-cta"
                    aria-disabled={!createReady || creating}
                    onClick={() => { if (createReady && !creating) void handleCreate(); }}
                  >{creating ? "만드는 중…" : "교실 만들기"}</button>

                  {createMsg && (
                    <p data-ux-role="body" className={createMsg.ok ? "root-state ok" : "root-state warn"} role="status">
                      {createMsg.text}
                    </p>
                  )}
                </>
              )}

              {tab === "pptx" && (
                <>
                  <p data-ux-role="label" className="root-label">번역 방향</p>
                  <div className="root-dir">
                    <select
                      className="root-select"
                      aria-label="원본 언어"
                      value={pptxFrom}
                      onChange={(e) => setPptxFrom(e.target.value)}
                    >
                      {Object.entries(LANGUAGES).map(([code, info]) => (
                        <option key={code} value={code}>{info.flag} {info.label}</option>
                      ))}
                    </select>
                    <span aria-hidden className="root-dir-arrow">→</span>
                    <select
                      className="root-select"
                      aria-label="바꿀 언어"
                      value={pptxTo}
                      onChange={(e) => setPptxTo(e.target.value)}
                    >
                      {Object.entries(LANGUAGES).map(([code, info]) => (
                        <option key={code} value={code}>{info.flag} {info.label}</option>
                      ))}
                    </select>
                  </div>

                  {!pptxResult && !pptxProcessing && (
                    <>
                      <input
                        ref={pptxRef}
                        type="file"
                        accept=".pptx,.hwpx"
                        className="root-file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handlePptxFile(file);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        data-ux-role="action"
                        className="root-cta"
                        onClick={() => pptxRef.current?.click()}
                      >📤 문서 파일 고르기</button>
                      <p data-ux-role="secondary" className="root-note">
                        .pptx · .hwpx 만 됩니다. 글자만 번역되고 이미지 속 글자·차트 값은 그대로 둡니다.
                      </p>
                    </>
                  )}

                  {pptxProcessing && (
                    <p data-ux-role="body" className="root-state" role="status">
                      {pptxStatus} — 문서 크기에 따라 10~60초 걸릴 수 있어요
                    </p>
                  )}

                  {pptxError && (
                    <div className="root-state warn" role="alert">
                      <p data-ux-role="body" className="root-state-line">{pptxError}</p>
                      <button type="button" data-ux-role="control" className="root-retry" onClick={() => setPptxError(null)}>
                        다시 해보기
                      </button>
                    </div>
                  )}

                  {pptxResult && (
                    <div className="root-done">
                      <p data-ux-role="body" className="root-state ok">
                        번역 완료 — {LANGUAGES[pptxFrom]?.label} → {LANGUAGES[pptxTo]?.label}
                        {pptxResult.segments > 0 ? ` · 텍스트 ${pptxResult.segments}조각` : ""}
                      </p>
                      <button type="button" data-ux-role="action" className="root-cta" onClick={pptxDownload}>
                        📥 번역 파일 내려받기
                      </button>
                      <button
                        type="button"
                        data-ux-role="control"
                        className="root-link"
                        onClick={() => { setPptxResult(null); setPptxError(null); }}
                      >다른 파일 번역하기</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
    </>
  );
}

/* ── 루트 진입 화면 전용 규칙 ───────────────────────────────────────
   크기·색은 전부 토큰에서 온다. 여기서 px 글자 크기를 새로 만들지 않는다.
   100vh 로 잠그지 않고 문서가 스크롤되게 둔다 — 모바일 키보드가 올라와도
   입력과 CTA 가 스크롤로 닿아야 한다(README §5.1). */
const ROOT_CSS = `
.root-page{
  position: relative;
  min-height: 100svh;
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-12);
  background: var(--ux-bg);
  display: flex; justify-content: center;
}
.root-backdrop{
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: url('/landing/landing-bees.webp') center / cover no-repeat;
  opacity: .35;
}
.root-shell{ position: relative; z-index: 1; width: 100%; max-width: 560px; align-self: center; }
.root-panel{
  background: var(--ux-surface);
  border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-6) var(--ux-space-4);
  box-shadow: 0 10px 30px rgba(137,83,0,.14);
  display: grid; gap: var(--ux-space-4);
}
.root-entry{ display: grid; gap: var(--ux-space-4); }
.root-hero{ text-align: center; display: grid; gap: var(--ux-space-2); justify-items: center; }

/* 크롬북·노트북(넓고 짧은 가로 화면): 안내와 입력을 두 열로.
   문턱을 뷰포트 폭 + 가로 방향으로 잡는다 — 폭만 보면 태블릿 세로에서도
   걸려 오히려 좁아진다. 세로 화면과 좁은 폭은 지금처럼 한 열이다. */
@media (min-width: 900px) and (orientation: landscape){
  .root-shell{ max-width: 1000px; }
  .root-panel.join{
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr);
    align-items: center;
    column-gap: var(--ux-space-6);
  }
  /* 교사 도구는 아이 흐름 밖이라 아래에 한 줄로 깐다. */
  .root-panel.join > .root-teacher-links{ grid-column: 1 / -1; }
}
.root-hero-bee{ width: 96px; height: 96px; object-fit: contain; }
.root-title{ margin: 0; color: var(--ux-ink); font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }
.root-title.small{ flex: 1; min-width: 0; text-align: left; }
.root-sub{ margin: 0; color: var(--ux-ink-soft); word-break: keep-all; }
/* 키보드 안내 — 터치만 쓰는 태블릿에서는 화면을 차지하지 않게 작게 둔다.
   포인터가 굵은(터치) 기기에서는 아예 감춘다: 키보드가 없는데 키보드
   안내를 읽히면 혼란만 준다. */
.root-kbdhint{ margin: var(--ux-space-2) 0 0; color: var(--ux-ink-soft); word-break: keep-all; }
.root-kbdhint kbd{
  font: inherit; font-weight: 800;
  background: var(--ux-surface-sunk); border: 1.5px solid var(--ux-primary-border);
  border-radius: 6px; padding: 0 6px;
}
@media (pointer: coarse){ .root-kbdhint{ display: none; } }

/* 네 자리 표시 */
.root-digits{ display: flex; gap: var(--ux-space-3); justify-content: center; }
.root-digit{
  width: 56px; min-height: 72px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--ux-radius-surface);
  border: 3px solid var(--ux-ink-soft); background: var(--ux-surface-sunk);
  color: var(--ux-ink); font-weight: 900; font-size: var(--ux-font-title);
  line-height: var(--ux-lh-tight);
}
.root-digit.filled{ border-color: var(--ux-selected-border); background: var(--ux-surface); }
.root-digit.next{ border-style: dashed; border-color: var(--ux-selected-border); }

/* 키패드 — 한 칸도 56px 아래로 내려가지 않는다 */
.root-keypad{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--ux-control-gap); }
.root-key{
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
}
/* 전역 [data-ux-role] 규칙이 layout 의 <style> 에서 더 뒤에 오므로 클래스 하나로는
   min-height 를 못 이긴다 — 속성까지 함께 걸어야 실제로 64px 이 된다. */
.root-key[data-ux-role="control"]{ min-height: 64px; }
.root-key-glyph{ font-size: var(--ux-font-body-emphasis); line-height: 1; }
.root-key-label{
  font-size: var(--ux-font-secondary); font-weight: 700;
  /* 어절 가운데서 접히면 '모두 지 / 우기' 가 된다 — 어절은 지킨다. */
  word-break: keep-all;
}
.root-key.edit{ background: var(--ux-surface-sunk); }
.root-key.edit .root-key-glyph{ font-size: var(--ux-font-label); }

/* 상태 — 로딩 / 방 없음 / 연결 실패 */
.root-state{
  margin: 0; display: grid; gap: var(--ux-space-2); justify-items: center;
  text-align: center; color: var(--ux-ink); word-break: keep-all;
}
.root-state-line{ margin: 0; }
.root-state-actions{ display: flex; flex-wrap: wrap; gap: var(--ux-control-gap); justify-content: center; }
.root-state.warn{
  color: var(--ux-error); font-weight: 700;
  background: var(--ux-surface-sunk); border: 2px dashed var(--ux-error);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-3);
}
.root-state.ok{ color: var(--ux-success); font-weight: 700; }
.root-retry{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}

.root-cta{
  width: 100%; font-family: inherit; font-weight: 900;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  /* 그림 아이콘과 글자를 한 줄 가운데로. 아이콘은 AppIcon 이 인라인 width/height
     를 직접 박으므로(그 편이 로딩 중 밀림이 없다) 여기서는 정렬만 맡는다. */
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--ux-space-2);
}
.root-cta-ico{ flex: 0 0 auto; }
/* 아직 누를 수 없는 상태도 읽히게 둔다. 회색 위 회색 글자는 쓰지 않는다. */
.root-cta[aria-disabled="true"]{
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  border: 2px dashed var(--ux-ink-soft);
}
.root-cta-hint{ margin: 0; text-align: center; }

.root-teacher-links{
  display: grid; gap: var(--ux-space-2);
  border-top: 2px dashed var(--ux-surface-sunk); padding-top: var(--ux-space-4);
}
.root-link{
  display: inline-flex; align-items: center; justify-content: center; gap: var(--ux-space-2);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
  word-break: keep-all;
}
.root-link.quiet{ border: 2px solid transparent; color: var(--ux-ink-soft); }

/* 보조 화면 */
.root-subhead{ display: flex; align-items: center; gap: var(--ux-space-3); }
.root-back{
  display: inline-flex; align-items: center; gap: var(--ux-space-2); flex-shrink: 0;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 700;
}
.root-label{ font-weight: 800; color: var(--ux-ink); margin: 0; }
.root-note{ margin: 0; }
.root-note.ok{ color: var(--ux-success); font-weight: 700; }
.root-note.warn{ color: var(--ux-error); font-weight: 700; }
.root-input{
  width: 100%; min-height: var(--ux-action-min);
  font-family: inherit; font-size: var(--ux-font-body-emphasis); font-weight: 700;
  color: var(--ux-ink); background: var(--ux-surface);
  border: 2px solid var(--ux-ink-soft); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3) var(--ux-space-4); box-sizing: border-box;
}
.root-input.code{ text-align: center; letter-spacing: .4em; }
.root-input.area{ resize: vertical; line-height: var(--ux-lh-reading); }
.root-input:focus{ border-color: var(--ux-selected-border); }

.root-langs{ display: grid; grid-template-columns: 1fr; gap: var(--ux-space-2); }
@media (min-width: 600px){ .root-langs{ grid-template-columns: 1fr 1fr; } }
.root-lang{
  display: flex; align-items: center; gap: var(--ux-space-3); width: 100%;
  background: var(--ux-surface); color: var(--ux-ink); text-align: left;
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 700;
}
.root-lang.on{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }
.root-lang-name{ flex: 1; min-width: 0; font-weight: 800; word-break: keep-all; overflow-wrap: anywhere; }
.root-check{ font-weight: 900; color: var(--ux-selected-border); flex-shrink: 0; }

.root-dir{ display: flex; align-items: center; gap: var(--ux-space-3); }
.root-select{
  flex: 1; min-width: 0; min-height: var(--ux-control-min);
  font-family: inherit; font-size: var(--ux-font-label); font-weight: 700;
  color: var(--ux-ink); background: var(--ux-surface);
  border: 2px solid var(--ux-primary-border); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2) var(--ux-space-3);
}
.root-dir-arrow{ font-weight: 900; color: var(--ux-ink-soft); flex-shrink: 0; }
.root-file{ display: none; }
.root-done{ display: grid; gap: var(--ux-space-3); }

@media (min-width: 1024px){
  .root-shell{ max-width: 640px; }
  .root-panel{ padding: var(--ux-space-8) var(--ux-space-6); }
  .root-hero-bee{ width: 140px; height: 140px; }
}
`;

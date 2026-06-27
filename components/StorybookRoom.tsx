"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  UserConfig,
  Storybook,
  StorybookSession,
  StorybookPage,
  StorybookQuestion,
  StorybookResponse,
  StorybookPhase,
  QuestionTier,
  StorybookCharacter,
  StorybookChatTurn,
  StorybookAlert,
} from "@/lib/types";
import {
  loadBook,
  startSession,
  endSession,
  subscribeSession,
  setPhase,
  setPage,
  showQuestion,
  submitResponse,
  subscribeResponses,
  subscribeBookAnswers,
  setActiveCharacter,
  appendChatTurn,
  subscribeChat,
  raiseAlert,
  subscribeAlerts,
  clearAlert,
  listGeneratedBooks,
  deleteGeneratedBook,
  setBookFlags,
  type BookListEntry,
} from "@/lib/storybook";
import { exportStorybookToPptx } from "@/lib/storybookPptx";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import { readChatStream } from "@/lib/chatStreamClient";
import MicButton from "./MicButton";
import { speak as speakText } from "@/lib/ttsMulti";
import StorybookCreator from "./StorybookCreator";
import StorybookWordQuiz from "./StorybookWordQuiz";
import { useBackLayer } from "@/lib/backStack";
import EmotionCardDeck from "./EmotionCardDeck";
import { pushEmotion, emotionById, awardEmotionStickerOncePerDay, type EmotionId } from "@/lib/emotions";
import { t, tFmt } from "@/lib/i18n";

interface Props {
  user: UserConfig;
  roomCode: string;
  myClientId: string;
  onBack: () => void;
}

// MVP: single hard-coded book. Phase 3 will add a library.
const AVAILABLE_BOOKS = [
  {
    id: "curious-worlds",
    titleKo: "붕붕이의 궁금 여행",
    cover: "🐝🌍✨",
    coverImageUrl: "/storybooks/curious-worlds/cover.png",
  },
  {
    id: "seasons-beauty",
    titleKo: "붕붕이의 사계절 산책",
    cover: "🐝🌸🍁❄️",
    coverImageUrl: "/storybooks/seasons-beauty/cover.png",
  },
];

const TIER_KEY: Record<QuestionTier, string> = {
  intro: "sbTierIntro",
  check: "sbTierCheck",
  core: "sbTierCore",
  deep: "sbTierDeep",
  concept: "sbTierConcept",
};

// Pick localized text with fallback chain: myLang → ko → en → any
function pick(map: Record<string, string> | undefined, lang: string): string {
  if (!map) return "";
  return map[lang] || map.ko || map.en || Object.values(map)[0] || "";
}

// For non-Korean students: return { primary: userLang, secondary: ko } so the
// UI can render both. For Korean students: return { primary: ko, secondary: null }.
function bilingual(
  map: Record<string, string> | undefined,
  lang: string,
): { primary: string; secondary: string | null } {
  if (!map) return { primary: "", secondary: null };
  if (lang === "ko") {
    return { primary: map.ko || Object.values(map)[0] || "", secondary: null };
  }
  const primary = map[lang] || "";
  const ko = map.ko || "";
  if (!primary && !ko) return { primary: Object.values(map)[0] || "", secondary: null };
  if (!primary) return { primary: ko, secondary: null };
  if (!ko || ko === primary) return { primary, secondary: null };
  return { primary, secondary: ko };
}

// ============================================================
// Main Shell — routes by session.phase & user.isTeacher
// ============================================================

export default function StorybookRoom({ user, roomCode, myClientId, onBack }: Props) {
  const lang = user.myLang;
  const isTeacher = user.isTeacher;

  const [session, setSession] = useState<StorybookSession | null>(null);
  const [book, setBook] = useState<Storybook | null>(null);
  const [bookLoading, setBookLoading] = useState(false);

  // Subscribe to session
  useEffect(() => {
    const unsub = subscribeSession(roomCode, setSession);
    return () => unsub();
  }, [roomCode]);

  // Load book when bookId changes
  useEffect(() => {
    if (!session?.bookId) {
      setBook(null);
      return;
    }
    let cancel = false;
    setBookLoading(true);
    loadBook(session.bookId)
      .then((b) => { if (!cancel) setBook(b); })
      .catch((err) => {
        console.error("loadBook failed", err);
        if (!cancel) setBook(null);
      })
      .finally(() => { if (!cancel) setBookLoading(false); });
    return () => { cancel = true; };
  }, [session?.bookId]);

  const handleStart = useCallback(async (bookId: string, opts?: { wordQuizEnabled?: boolean }) => {
    await startSession(roomCode, bookId, myClientId, opts);
  }, [roomCode, myClientId]);

  const handleEnd = useCallback(async () => {
    await endSession(roomCode);
  }, [roomCode]);

  // ── No active session ────────────────────────────────────
  if (!session) {
    if (isTeacher) {
      return (
        <TeacherSetup
          lang={lang}
          teacherName={user.myName}
          onBack={onBack}
          onStart={handleStart}
        />
      );
    }
    // [신규] 학생: 수업이 없으면 교사가 공개한 책을 자유롭게 읽을 수 있다.
    return <StudentFreeLibrary lang={lang} viewerLang={lang} roomCode={roomCode} onBack={onBack} />;
  }

  // ── Loading book ─────────────────────────────────────────
  if (bookLoading || !book) {
    return <StudentWaiting lang={lang} onBack={onBack} />;
  }

  // ── Phase routing ────────────────────────────────────────
  // While a session is active (phase != "done"), back navigation is blocked.
  // Students stay fully synced. Teacher uses "수업 마치기" button to exit.
  const sessionActive = session.phase !== "done";
  const guardedBack = () => {
    if (sessionActive) {
      if (isTeacher) {
        window.alert("수업 중입니다. '수업 마치기' 버튼을 눌러 먼저 수업을 마쳐주세요.");
      } else {
        window.alert("선생님이 수업을 진행 중이에요. 조금만 더 기다려주세요.");
      }
      return;
    }
    onBack();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        // 🐝 협곡 풍경 배경 (그림책 일러스트 보호 위해 흰 오버레이 88%로 은은하게)
        background: "linear-gradient(rgba(255,251,235,0.88), rgba(253,230,138,0.88)), url('/landing/game-canyon.webp') center / cover no-repeat",
        backgroundAttachment: "fixed",
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
        padding: "16px 12px 32px",
      }}
    >
      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        {isTeacher && <TeacherAlertBanner lang={lang} roomCode={roomCode} />}

        <SessionHeader
          lang={lang}
          roomCode={roomCode}
          session={session}
          book={book}
          isTeacher={isTeacher}
          onBack={guardedBack}
          onEnd={handleEnd}
        />

        <PhaseBody
          lang={lang}
          roomCode={roomCode}
          user={user}
          myClientId={myClientId}
          session={session}
          book={book}
          isTeacher={isTeacher}
        />
      </div>
    </div>
  );
}

// ============================================================
// Teacher Alert Banner — subscribes to storybook alerts, shows distress
// ============================================================

function TeacherAlertBanner({ lang, roomCode }: { lang: string; roomCode: string }) {
  const [alerts, setAlerts] = useState<StorybookAlert[]>([]);

  useEffect(() => {
    const unsub = subscribeAlerts(roomCode, setAlerts);
    return () => unsub();
  }, [roomCode]);

  const visible = useMemo(
    () => alerts.filter((a) => a.kind === "distress" || a.kind === "repeated_block"),
    [alerts],
  );

  if (visible.length === 0) return null;

  return (
    <div style={{
      marginBottom: 12,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {visible.slice(0, 5).map((a) => {
        const isDistress = a.kind === "distress";
        const label = isDistress
          ? tFmt("sbTeacherAlertDistress", lang, { name: a.studentName })
          : `⚠️ ${a.studentName} 학생이 부적절한 말을 반복했어요`;
        const borderColor = isDistress ? "#DC2626" : "#D97706";
        const bg = isDistress
          ? "linear-gradient(135deg, #FEE2E2, #FECACA)"
          : "linear-gradient(135deg, #FEF3C7, #FDE68A)";
        const textColor = isDistress ? "#991B1B" : "#92400E";
        const btnBorder = isDistress ? "#DC2626" : "#D97706";
        return (
          <div
            key={a.id}
            style={{
              padding: "10px 12px",
              background: bg,
              border: `3px solid ${borderColor}`,
              borderRadius: 14,
              boxShadow: `0 6px 18px ${borderColor}44`,
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: textColor, letterSpacing: -0.2 }}>
                {label}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: textColor, opacity: 0.8, marginTop: 2 }}>
                {new Date(a.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <button
              onClick={() => clearAlert(roomCode, a.id)}
              style={{
                minHeight: 36, padding: "6px 12px",
                background: "#fff", border: `2px solid ${btnBorder}`,
                color: textColor, fontSize: 12, fontWeight: 900,
                borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >확인 ✓</button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Teacher Setup — book library + "create new" entry point
// ============================================================

function TeacherSetup({
  lang,
  teacherName,
  onBack,
  onStart,
}: {
  lang: string;
  teacherName: string;
  onBack: () => void;
  onStart: (bookId: string, opts?: { wordQuizEnabled?: boolean }) => void;
}) {
  const [busy, setBusy] = useState(false);
  // [신규] 수업 전 단어 퀴즈 토글
  const [wordQuizEnabled, setWordQuizEnabled] = useState(false);
  const [generated, setGenerated] = useState<BookListEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  async function handleExportPptx(id: string) {
    if (exportingId) return;
    setExportingId(id);
    try {
      const book = await loadBook(id);
      if (book) await exportStorybookToPptx(book, lang);
      else window.alert("그림책을 불러오지 못했어요.");
    } catch (err) {
      console.error("PPTX export failed", err);
      window.alert("PPT 만들기에 실패했어요.");
    } finally {
      setExportingId(null);
    }
  }

  useEffect(() => {
    let cancel = false;
    setLoadingList(true);
    listGeneratedBooks()
      .then((list) => { if (!cancel) setGenerated(list); })
      .catch((err) => console.error("listGeneratedBooks failed", err))
      .finally(() => { if (!cancel) setLoadingList(false); });
    return () => { cancel = true; };
  }, [creating]);

  async function handleDelete(id: string) {
    if (!window.confirm("정말 삭제할까요?")) return;
    try {
      await deleteGeneratedBook(id);
      setGenerated((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error("deleteGeneratedBook failed", err);
    }
  }

  // [신규] 책별 공개/퀴즈 토글 — 낙관적 갱신 후 Firebase 저장.
  async function toggleFlag(id: string, key: "visible" | "wordQuizEnabled") {
    const cur = generated.find((b) => b.id === id);
    if (!cur) return;
    const nextVal = !cur[key];
    setGenerated((prev) => prev.map((b) => (b.id === id ? { ...b, [key]: nextVal } : b)));
    try {
      await setBookFlags(id, { [key]: nextVal });
    } catch (err) {
      console.error("setBookFlags failed", err);
      // 롤백
      setGenerated((prev) => prev.map((b) => (b.id === id ? { ...b, [key]: !nextVal } : b)));
    }
  }

  if (creating) {
    return (
      <StorybookCreator
        teacherName={teacherName}
        onCreated={async (id) => {
          setCreating(false);
          if (busy) return;
          setBusy(true);
          try { await onStart(id, wordQuizEnabled ? { wordQuizEnabled: true } : undefined); } finally { setBusy(false); }
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  const staticList: BookListEntry[] = AVAILABLE_BOOKS.map((b) => ({
    id: b.id,
    titleKo: b.titleKo,
    coverEmoji: b.cover,
    coverImageUrl: b.coverImageUrl,
    source: "static" as const,
  }));
  const allBooks = [...generated, ...staticList];

  return (
    <div
      style={{
        minHeight: "100vh",
        // 🐝 협곡 풍경 배경 (그림책 일러스트 보호 위해 흰 오버레이 88%로 은은하게)
        background: "linear-gradient(rgba(255,251,235,0.88), rgba(253,230,138,0.88)), url('/landing/game-canyon.webp') center / cover no-repeat",
        backgroundAttachment: "fixed",
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
        padding: "20px 16px 40px",
      }}
    >
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button
            onClick={onBack}
            aria-label="back"
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: "#fff", border: "2px solid #FDE68A",
              fontSize: 18, fontWeight: 900, color: "#92400E", cursor: "pointer",
            }}
          >←</button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
            {t("sbChooseBook", lang)}
          </h1>
        </div>

        {/* Create new — hero button */}
        <button
          onClick={() => setCreating(true)}
          disabled={busy}
          style={{
            width: "100%", marginBottom: 14,
            padding: "18px 20px",
            background: "linear-gradient(135deg, #8B5CF6, #6D28D9)",
            color: "#fff", border: "none", borderRadius: 22,
            fontSize: 17, fontWeight: 900, cursor: busy ? "not-allowed" : "pointer",
            boxShadow: "0 8px 24px rgba(139,92,246,0.4)",
            letterSpacing: -0.2,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 26 }}>🎨</span>
          AI로 새 그림책 만들기
        </button>

        {/* [신규] 단어 퀴즈 토글 — 수업 시작 시 적용 */}
        <button
          type="button"
          role="switch"
          aria-checked={wordQuizEnabled}
          onClick={() => setWordQuizEnabled((v) => !v)}
          style={{
            width: "100%", marginBottom: 14,
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px",
            background: wordQuizEnabled ? "linear-gradient(135deg, #ECFDF5, #D1FAE5)" : "#fff",
            border: `2px solid ${wordQuizEnabled ? "#10B981" : "#FDE68A"}`,
            borderRadius: 16, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}
        >
          <span style={{ fontSize: 24 }}>📝</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 900, color: "#1F2937" }}>
              이번 수업은 단어 퀴즈로 시작
            </span>
            <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginTop: 1 }}>
              켜면 책 설정과 무관하게 강제 적용 · 끄면 책별 📝 설정을 따름
            </span>
          </span>
          <span style={{
            width: 46, height: 26, borderRadius: 999, flexShrink: 0, position: "relative",
            background: wordQuizEnabled ? "#10B981" : "#D1D5DB", transition: "background 0.15s",
          }}>
            <span style={{
              position: "absolute", top: 3, left: wordQuizEnabled ? 23 : 3,
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </span>
        </button>

        {loadingList ? (
          <div style={{ textAlign: "center", padding: 30, color: "#92400E", fontWeight: 700 }}>
            📚 그림책 목록 불러오는 중…
          </div>
        ) : allBooks.length === 0 ? (
          <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#92400E", fontWeight: 700 }}>
            {t("sbNoBookYet", lang)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allBooks.map((b) => (
              <div
                key={b.id}
                onClick={async (e) => {
                  // Ignore clicks that land on the delete button (has its own handler)
                  if ((e.target as HTMLElement).closest("button")) return;
                  if (busy) return;
                  setBusy(true);
                  try { await onStart(b.id, wordQuizEnabled ? { wordQuizEnabled: true } : undefined); } finally { setBusy(false); }
                }}
                role="button"
                tabIndex={0}
                aria-label={`${b.titleKo} 시작`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "88px 1fr auto",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 14px",
                  background: b.source === "generated"
                    ? "linear-gradient(135deg, #FAF5FF, #EDE9FE)"
                    : "linear-gradient(135deg, #FEF3C7, #FDE68A)",
                  border: `3px solid ${b.source === "generated" ? "#8B5CF655" : "#F59E0B55"}`,
                  borderRadius: 18,
                  boxShadow: "0 6px 20px rgba(180,83,9,0.15)",
                  cursor: busy ? "wait" : "pointer",
                  transition: "transform 0.12s",
                  opacity: busy ? 0.75 : 1,
                }}
                onMouseDown={(e) => { if (!busy) e.currentTarget.style.transform = "scale(0.98)"; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {b.coverImageUrl ? (
                  <div style={{
                    width: 88, height: 88,
                    borderRadius: 12, overflow: "hidden",
                    boxShadow: "0 4px 10px rgba(180,83,9,0.25)",
                    background: "#fff",
                    border: "2px solid #fff",
                  }}>
                    <img
                      src={b.coverImageUrl}
                      alt=""
                      aria-hidden="true"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: 88, height: 88,
                    borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(255,255,255,0.6)",
                    fontSize: 44,
                    filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.1))",
                  }}>
                    {b.coverEmoji}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 16, fontWeight: 900, color: "#1F2937", letterSpacing: -0.2,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {b.titleKo}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: b.source === "generated" ? "#6D28D9" : "#B45309", marginTop: 2 }}>
                    {b.source === "generated" ? `🤖 AI · ${b.authorName || ""}` : "📖 샘플"}
                  </div>
                  {/* [신규] 책별 공개/퀴즈 토글 (AI 생성 책만) */}
                  {b.source === "generated" && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <FlagChip
                        active={!!b.visible}
                        onClick={() => toggleFlag(b.id, "visible")}
                        onLabel="👁 공개됨"
                        offLabel="🙈 숨김"
                        title="학생 자유 읽기 공개 여부"
                      />
                      <FlagChip
                        active={!!b.wordQuizEnabled}
                        disabled={!b.hasVocab}
                        onClick={() => toggleFlag(b.id, "wordQuizEnabled")}
                        onLabel="📝 퀴즈 ON"
                        offLabel={b.hasVocab ? "📝 퀴즈 OFF" : "📝 어휘없음"}
                        title="단어 퀴즈를 켜면 읽기 전 4지선다를 먼저 풀어요"
                      />
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => handleExportPptx(b.id)}
                    disabled={exportingId === b.id}
                    aria-label="PPT로 내보내기"
                    title="PPT로 내보내기"
                    style={{
                      minHeight: 40, padding: "6px 10px",
                      background: exportingId === b.id ? "#E5E7EB" : "#fff",
                      border: "1.5px solid #FCD34D",
                      color: exportingId === b.id ? "#9CA3AF" : "#B45309",
                      fontSize: 12, fontWeight: 900,
                      borderRadius: 10, cursor: exportingId === b.id ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >{exportingId === b.id ? "…" : "📊 PPT"}</button>
                  {b.source === "generated" && (
                    <button
                      onClick={() => handleDelete(b.id)}
                      aria-label="delete"
                      style={{
                        minHeight: 40, padding: "6px 10px",
                        background: "#fff", border: "1.5px solid #FCA5A5",
                        color: "#B91C1C", fontSize: 12, fontWeight: 900,
                        borderRadius: 10, cursor: "pointer",
                      }}
                    >🗑</button>
                  )}
                  <button
                    onClick={async () => {
                      if (busy) return;
                      setBusy(true);
                      try { await onStart(b.id, wordQuizEnabled ? { wordQuizEnabled: true } : undefined); } finally { setBusy(false); }
                    }}
                    disabled={busy}
                    style={{
                      minHeight: 40, padding: "6px 14px",
                      background: busy ? "#E5E7EB" : "linear-gradient(135deg, #F59E0B, #D97706)",
                      color: busy ? "#9CA3AF" : "#fff",
                      fontSize: 13, fontWeight: 900, border: "none",
                      borderRadius: 10, cursor: busy ? "wait" : "pointer",
                    }}
                  >▶ 시작</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Student Waiting
// ============================================================

function StudentWaiting({ lang, onBack }: { lang: string; onBack: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        // 🐝 협곡 풍경 배경 (그림책 일러스트 보호 위해 흰 오버레이 88%로 은은하게)
        background: "linear-gradient(rgba(255,251,235,0.88), rgba(253,230,138,0.88)), url('/landing/game-canyon.webp') center / cover no-repeat",
        backgroundAttachment: "fixed",
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 20, textAlign: "center",
      }}
    >
      <button
        onClick={onBack}
        aria-label="back"
        style={{
          position: "absolute", top: 20, left: 20,
          width: 44, height: 44, borderRadius: 14,
          background: "#fff", border: "2px solid #FDE68A",
          fontSize: 18, fontWeight: 900, color: "#92400E", cursor: "pointer",
        }}
      >←</button>
      <img
        src="/mascot/bee-sleep.png"
        alt=""
        aria-hidden="true"
        style={{ width: 160, height: 160, animation: "heroBeeFloat 3s ease-in-out infinite" }}
      />
      <div style={{ marginTop: 16, fontSize: 18, fontWeight: 900, color: "#92400E", letterSpacing: -0.2 }}>
        {t("sbWaitingForTeacher", lang)}
      </div>
    </div>
  );
}

// [신규] 교사용 토글 칩 — 책 카드의 공개/퀴즈 on·off.
function FlagChip({
  active, onClick, onLabel, offLabel, title, disabled,
}: {
  active: boolean;
  onClick: () => void;
  onLabel: string;
  offLabel: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      style={{
        fontSize: 10, fontWeight: 900, letterSpacing: -0.2,
        padding: "4px 9px", borderRadius: 999, cursor: disabled ? "not-allowed" : "pointer",
        border: `1.5px solid ${active ? "#10B981" : "#D1D5DB"}`,
        background: disabled ? "#F3F4F6" : active ? "#ECFDF5" : "#fff",
        color: disabled ? "#9CA3AF" : active ? "#047857" : "#6B7280",
        fontFamily: "inherit", whiteSpace: "nowrap",
      }}
    >
      {active ? onLabel : offLabel}
    </button>
  );
}

// ============================================================
// [신규] 학생 자유 도서관 — 교사가 공개한 책을 수업 외에 스스로 읽기
// ============================================================

function StudentFreeLibrary({
  lang, viewerLang, roomCode, onBack,
}: { lang: string; viewerLang: string; roomCode: string; onBack: () => void }) {
  const [books, setBooks] = useState<BookListEntry[] | null>(null);
  const [openBook, setOpenBook] = useState<Storybook | null>(null);
  const [loadingBook, setLoadingBook] = useState(false);

  useEffect(() => {
    let cancel = false;
    listGeneratedBooks()
      .then((list) => { if (!cancel) setBooks(list.filter((b) => b.visible)); })
      .catch(() => { if (!cancel) setBooks([]); });
    return () => { cancel = true; };
  }, []);

  // 뒤로 가기: 책을 읽는 중이면 도서관 목록으로 (그림책 교실에서 바로 나가지 않음).
  useBackLayer(openBook !== null, () => setOpenBook(null));

  async function open(id: string) {
    if (loadingBook) return;
    setLoadingBook(true);
    try {
      const b = await loadBook(id);
      setOpenBook(b);
    } catch (err) {
      console.error("free reader loadBook failed", err);
      window.alert("그림책을 불러오지 못했어요.");
    } finally {
      setLoadingBook(false);
    }
  }

  if (openBook) {
    return (
      <StorybookFreeReader
        book={openBook}
        viewerLang={viewerLang}
        roomCode={roomCode}
        onBack={() => setOpenBook(null)}
      />
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      // 🐝 협곡 풍경 배경 (그림책 일러스트 보호 위해 흰 오버레이 88%로 은은하게)
      background: "linear-gradient(rgba(255,251,235,0.88), rgba(253,230,138,0.88)), url('/landing/game-canyon.webp') center / cover no-repeat",
      backgroundAttachment: "fixed",
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
      padding: "20px 16px 40px",
    }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button
            onClick={onBack}
            aria-label="back"
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: "#fff", border: "2px solid #FDE68A",
              fontSize: 18, fontWeight: 900, color: "#92400E", cursor: "pointer",
            }}
          >←</button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
            📚 그림책 읽기
          </h1>
        </div>

        {books === null ? (
          <div style={{ textAlign: "center", padding: 30, color: "#92400E", fontWeight: 700 }}>
            📚 그림책 불러오는 중…
          </div>
        ) : books.length === 0 ? (
          <div style={{
            marginTop: 24, textAlign: "center", padding: "30px 20px",
            background: "#fff", borderRadius: 16, border: "2px dashed #FDE68A",
            color: "#92400E", fontSize: 14, fontWeight: 700, lineHeight: 1.6,
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🐝</div>
            아직 읽을 수 있는 그림책이 없어요.<br/>선생님이 책을 열어주면 여기에 보여요!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {books.map((b) => (
              <button
                key={b.id}
                onClick={() => open(b.id)}
                disabled={loadingBook}
                style={{
                  display: "grid", gridTemplateColumns: "72px 1fr auto",
                  alignItems: "center", gap: 14, textAlign: "left",
                  padding: "12px 14px",
                  background: "linear-gradient(135deg, #FAF5FF, #EDE9FE)",
                  border: "3px solid #8B5CF655", borderRadius: 18,
                  boxShadow: "0 6px 20px rgba(180,83,9,0.12)",
                  cursor: loadingBook ? "wait" : "pointer", fontFamily: "inherit",
                }}
              >
                {b.coverImageUrl ? (
                  <div style={{ width: 72, height: 72, borderRadius: 12, overflow: "hidden", background: "#fff", border: "2px solid #fff" }}>
                    <img src={b.coverImageUrl} alt="" aria-hidden="true" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.6)", fontSize: 38 }}>
                    {b.coverEmoji}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#1F2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.titleKo}
                  </div>
                  {b.wordQuizEnabled && b.hasVocab && (
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#6D28D9", marginTop: 2 }}>
                      📝 단어 퀴즈 먼저 풀어요
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 900, color: "#fff",
                  background: "#8B5CF6", padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap",
                }}>읽기 ▶</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// [신규] 자유 리더 — 학생이 스스로 페이지를 넘기며 읽고 듣는다 (질문/핫시팅 없음).
// 책에 단어 퀴즈가 켜져 있고 어휘가 4개 이상이면 읽기 전에 퀴즈를 먼저 푼다(규칙).
function StorybookFreeReader({
  book, viewerLang, roomCode, onBack,
}: { book: Storybook; viewerLang: string; roomCode: string; onBack: () => void }) {
  const quizFirst = !!book.wordQuizEnabled && (book.vocab?.length ?? 0) >= 4;
  const [quizDone, setQuizDone] = useState(false);
  // 0 = 표지, 1..N = 페이지
  const [page, setPage] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  if (quizFirst && !quizDone) {
    return (
      <div style={{
        minHeight: "100vh",
        // 🐝 협곡 풍경 배경 (그림책 일러스트 보호 위해 흰 오버레이 88%로 은은하게)
        background: "linear-gradient(rgba(255,251,235,0.88), rgba(253,230,138,0.88)), url('/landing/game-canyon.webp') center / cover no-repeat",
        backgroundAttachment: "fixed",
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
        padding: "16px 12px 32px",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <StorybookWordQuiz book={book} viewerLang={viewerLang} onDone={() => setQuizDone(true)} />
        </div>
      </div>
    );
  }

  const total = book.pages.length;
  const onCover = page === 0;
  const curPage = onCover ? null : book.pages.find((p) => p.idx === page) ?? null;

  function speakCurrent() {
    const text = onCover
      ? (book.title?.[viewerLang] || book.title?.ko || "")
      : (curPage?.text?.[viewerLang] || curPage?.text?.ko || "");
    if (!text) return;
    setSpeaking(true);
    speakText(text, viewerLang).finally(() => setSpeaking(false));
  }

  return (
    <div style={{
      minHeight: "100vh",
      // 🐝 협곡 풍경 배경 (그림책 일러스트 보호 위해 흰 오버레이 88%로 은은하게)
      background: "linear-gradient(rgba(255,251,235,0.88), rgba(253,230,138,0.88)), url('/landing/game-canyon.webp') center / cover no-repeat",
      backgroundAttachment: "fixed",
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
      padding: "16px 12px 32px",
    }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button
            onClick={onBack}
            aria-label="back"
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: "#fff", border: "2px solid #FDE68A",
              fontSize: 18, fontWeight: 900, color: "#92400E", cursor: "pointer",
            }}
          >←</button>
          <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 900, color: "#1F2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {book.title?.[viewerLang] || book.title?.ko}
          </div>
          <button
            onClick={speakCurrent}
            aria-label="들어보기"
            style={{
              minHeight: 44, padding: "8px 14px", borderRadius: 12,
              background: "#fff", border: "2px solid #FDE68A",
              fontSize: 14, fontWeight: 900, color: "#B45309", cursor: "pointer",
            }}
          >🔊 {speaking ? "재생 중…" : "들어보기"}</button>
        </div>

        {/* content */}
        {onCover
          ? <CoverCard lang={viewerLang} book={book} />
          : curPage && <PageCard lang={viewerLang} page={curPage} total={total} />}

        {/* [#1] 이 책으로 했던 수업의 친구들 답변 — 책 단위로 영속 저장되어 그대로 보인다 */}
        {(onCover
          ? book.questions.filter((q) => q.tier === "intro")
          : book.questions.filter((q) => q.pageIdx === page)
        ).map((q) => (
          <FriendAnswers
            key={q.id}
            roomCode={roomCode}
            bookId={book.id}
            question={q}
            viewerLang={viewerLang}
          />
        ))}

        {/* nav */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={onCover}
            style={{
              flex: 1, padding: "14px 16px", borderRadius: 14,
              background: onCover ? "#F3F4F6" : "#fff", border: "2px solid #FDE68A",
              color: onCover ? "#9CA3AF" : "#92400E", fontWeight: 900, fontSize: 15,
              cursor: onCover ? "default" : "pointer",
            }}
          >◀ 이전</button>
          <button
            onClick={() => setPage((p) => Math.min(total, p + 1))}
            disabled={page >= total}
            style={{
              flex: 2, padding: "14px 16px", borderRadius: 14,
              background: page >= total ? "#F3F4F6" : "linear-gradient(135deg, #F59E0B, #D97706)",
              border: "none", color: page >= total ? "#9CA3AF" : "#fff", fontWeight: 900, fontSize: 15,
              cursor: page >= total ? "default" : "pointer",
            }}
          >{page >= total ? "끝!" : onCover ? "읽기 시작 ▶" : "다음 ▶"}</button>
        </div>
      </div>
    </div>
  );
}

// [#1] 친구들의 예전 답변 — 책별 영속 저장(bookAnswers)을 읽어 자유 읽기 화면에 표시.
//   뷰어 언어와 다른 답변은 언어별로 묶어 한 번에 번역한다.
function FriendAnswers({
  roomCode, bookId, question, viewerLang,
}: {
  roomCode: string; bookId: string; question: StorybookQuestion; viewerLang: string;
}) {
  const [answers, setAnswers] = useState<StorybookResponse[]>([]);
  const [trans, setTrans] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = subscribeBookAnswers(roomCode, bookId, question.id, setAnswers);
    return () => unsub();
  }, [roomCode, bookId, question.id]);

  useEffect(() => {
    const groups: Record<string, StorybookResponse[]> = {};
    for (const a of answers) {
      if (!a.studentLang || a.studentLang === viewerLang || trans[a.id]) continue;
      (groups[a.studentLang] ||= []).push(a);
    }
    const langs = Object.keys(groups);
    if (langs.length === 0) return;
    let cancel = false;
    (async () => {
      for (const fl of langs) {
        const grp = groups[fl];
        try {
          const res = await fetch("/api/storybook-translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: grp.map((a) => a.text), fromLang: fl, toLang: viewerLang }),
          });
          const data = (await res.json()) as { ok: boolean; translated?: string[] };
          if (!cancel && data.ok && data.translated) {
            setTrans((prev) => {
              const next = { ...prev };
              grp.forEach((a, i) => { if (data.translated![i]) next[a.id] = data.translated![i]; });
              return next;
            });
          }
        } catch { /* 원문 유지 */ }
      }
    })();
    return () => { cancel = true; };
    // trans 는 의도적으로 제외(루프 방지) — 새 답변 도착 시에만 재번역
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, viewerLang]);

  if (answers.length === 0) return null;

  return (
    <div style={{
      background: "#fff", borderRadius: 20, border: "2px solid #FDE68A",
      boxShadow: "0 8px 24px rgba(180,83,9,0.1)", padding: "14px 16px", marginBottom: 14,
    }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#92400E", marginBottom: 4 }}>
        💬 {pick(question.text, viewerLang)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#B45309", marginBottom: 10 }}>
        친구들의 생각 {answers.length}개
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {answers.map((a) => (
          <div key={a.id} style={{
            background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12,
            padding: "8px 12px",
          }}>
            <div style={{ fontSize: 14, color: "#1F2937", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {trans[a.id] || a.text}
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#92400E", marginTop: 4 }}>
              — {a.studentName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Session Header (shared)
// ============================================================

function SessionHeader({
  lang, roomCode, session, book, isTeacher, onBack, onEnd,
}: {
  lang: string;
  roomCode: string;
  session: StorybookSession;
  book: Storybook;
  isTeacher: boolean;
  onBack: () => void;
  onEnd: () => Promise<void>;
}) {
  const phaseLabelKey: Record<StorybookPhase, string> = {
    before: "sbPhaseBefore",
    during: "sbPhaseDuring",
    after: "sbPhaseAfter",
    done: "sbPhaseDone",
  };
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "12px 14px",
        border: "2px solid #FDE68A",
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 14,
      }}
    >
      <button
        onClick={onBack}
        aria-label="back"
        style={{
          width: 40, height: 40, borderRadius: 12,
          background: "#fff", border: "2px solid #FDE68A",
          fontSize: 16, fontWeight: 900, color: "#92400E", cursor: "pointer",
          flexShrink: 0,
        }}
      >←</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {pick(book.title, lang)}
        </div>
        <div style={{ fontSize: 11, color: "#B45309", fontWeight: 800, marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ background: "#FEF3C7", padding: "2px 8px", borderRadius: 999 }}>🚪 {roomCode}</span>
          <span style={{ background: "#DBEAFE", color: "#1E40AF", padding: "2px 8px", borderRadius: 999 }}>
            {t(phaseLabelKey[session.phase], lang)}
          </span>
        </div>
      </div>
      {isTeacher && (
        <button
          onClick={onEnd}
          style={{
            minHeight: 40, padding: "8px 14px",
            background: "#fff", border: "2px solid #FECACA",
            color: "#B91C1C", fontSize: 12, fontWeight: 900,
            borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap",
          }}
        >{t("sbPhaseDoneBtn", lang)}</button>
      )}
    </div>
  );
}

// ============================================================
// Phase routing
// ============================================================

function PhaseBody({
  lang, roomCode, user, myClientId, session, book, isTeacher,
}: {
  lang: string;
  roomCode: string;
  user: UserConfig;
  myClientId: string;
  session: StorybookSession;
  book: Storybook;
  isTeacher: boolean;
}) {
  if (session.phase === "before") {
    return (
      <BeforePhase
        lang={lang}
        roomCode={roomCode}
        user={user}
        myClientId={myClientId}
        session={session}
        book={book}
        isTeacher={isTeacher}
      />
    );
  }
  if (session.phase === "during") {
    return (
      <DuringPhase
        lang={lang}
        roomCode={roomCode}
        user={user}
        myClientId={myClientId}
        session={session}
        book={book}
        isTeacher={isTeacher}
      />
    );
  }
  if (session.phase === "after") {
    return (
      <AfterPhase
        lang={lang}
        session={session}
        book={book}
        isTeacher={isTeacher}
        roomCode={roomCode}
        myClientId={myClientId}
        user={user}
      />
    );
  }
  // done
  return (
    <div style={{
      background: "#fff", borderRadius: 22, padding: 32, textAlign: "center",
      border: "2px solid #FDE68A", boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
    }}>
      <div style={{ fontSize: 64 }}>🎉</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", marginTop: 10 }}>
        {t("sbPhaseDone", lang)}
      </div>
    </div>
  );
}

// ============================================================
// BEFORE — Cover + intro questions
// ============================================================

function BeforePhase({
  lang, roomCode, user, myClientId, session, book, isTeacher,
}: {
  lang: string;
  roomCode: string;
  user: UserConfig;
  myClientId: string;
  session: StorybookSession;
  book: Storybook;
  isTeacher: boolean;
}) {
  // [신규] 수업 전 단어 퀴즈 게이트 — 학생만, 토글 ON + 어휘 4개 이상일 때.
  // 학생이 퀴즈를 마치면 본문(표지/도입)으로 진행. 단계 신설 없이 로컬 게이트.
  // (Hooks 규칙: 모든 훅은 early-return 앞에서 호출)
  const [quizDone, setQuizDone] = useState(false);
  const introQuestions = useMemo(
    () => book.questions.filter((q) => q.tier === "intro"),
    [book.questions],
  );

  const quizEligible = !isTeacher
    && !!session.wordQuizEnabled
    && (book.vocab?.length ?? 0) >= 4;
  if (quizEligible && !quizDone) {
    return (
      <StorybookWordQuiz
        book={book}
        viewerLang={lang}
        onDone={() => setQuizDone(true)}
      />
    );
  }

  const currentQ = session.currentQuestionId
    ? introQuestions.find((q) => q.id === session.currentQuestionId) ?? null
    : null;

  return (
    <>
      <CoverCard lang={lang} book={book} />

      {currentQ && (
        <QuestionCard
          lang={lang}
          roomCode={roomCode}
          user={user}
          myClientId={myClientId}
          q={currentQ}
          isTeacher={isTeacher}
          book={book}
        />
      )}

      {isTeacher && (
        <TeacherControls
          lang={lang}
          title={t("sbPhaseBefore", lang)}
          questions={introQuestions}
          activeQuestionId={session.currentQuestionId}
          onShowQuestion={(id) => showQuestion(roomCode, id)}
          onNext={() => setPhase(roomCode, "during").then(() => setPage(roomCode, 1))}
          nextLabel={t("sbPhaseNextDuring", lang)}
        />
      )}
    </>
  );
}

function CoverCard({ lang, book }: { lang: string; book: Storybook }) {
  const title = pick(book.title, lang);
  return (
    <div
      style={{
        borderRadius: 26,
        border: "3px solid #F59E0B",
        boxShadow: "0 14px 36px rgba(180,83,9,0.2)",
        marginBottom: 14,
        overflow: "hidden",
        background: book.cover.bgGradient,
      }}
    >
      {/* Cover image with title overlay (Jua font) */}
      <div
        style={{
          minHeight: 460,
          aspectRatio: "4 / 3",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}
      >
        {book.cover.imageUrl ? (
          <img
            src={book.cover.imageUrl}
            alt=""
            aria-hidden="true"
            style={{
              width: "100%", height: "100%", objectFit: "cover", display: "block",
              position: "absolute", inset: 0,
            }}
          />
        ) : (
          <div style={{ fontSize: 140, filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.15))" }}>
            {book.cover.emoji}
          </div>
        )}

        {/* Gradient scrim — keeps title readable over any image */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0, right: 0, bottom: 0,
            height: "55%",
            background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.6) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Title overlay — Jua 주아체, centered bottom */}
        <div
          style={{
            position: "absolute",
            left: 0, right: 0, bottom: 0,
            padding: "20px 24px 28px",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "flex-end",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontFamily: "'Jua', 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
              fontSize: "clamp(28px, 6vw, 44px)",
              fontWeight: 400, // Jua is a single-weight display font
              color: "#fff",
              letterSpacing: -0.5,
              lineHeight: 1.15,
              textShadow:
                "0 2px 0 rgba(180,83,9,0.55), 0 4px 14px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.5)",
              wordBreak: "keep-all",
              padding: "0 6px",
            }}
          >
            {title}
          </div>
          <div style={{
            marginTop: 8,
            fontFamily: "'Jua', 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
            fontSize: 13,
            color: "#FEF3C7",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            letterSpacing: 0.5,
          }}>
            {t("sbCover", lang)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DURING — Page-by-page reading + check/core/deep/concept questions
// ============================================================

function DuringPhase({
  lang, roomCode, user, myClientId, session, book, isTeacher,
}: {
  lang: string;
  roomCode: string;
  user: UserConfig;
  myClientId: string;
  session: StorybookSession;
  book: Storybook;
  isTeacher: boolean;
}) {
  const pageIdx = Math.max(1, Math.min(book.pages.length, session.currentPage));
  const page = book.pages.find((p) => p.idx === pageIdx);

  // Questions available for current page or not tied to any page
  const availableQuestions = useMemo(() => {
    const checks = book.questions.filter((q) => q.tier === "check" && q.pageIdx === pageIdx);
    // On last page, surface core/deep/concept as available
    const extras = pageIdx === book.pages.length
      ? book.questions.filter((q) => q.tier === "core" || q.tier === "deep" || q.tier === "concept")
      : [];
    return [...checks, ...extras];
  }, [book.questions, book.pages.length, pageIdx]);

  const currentQ = session.currentQuestionId
    ? book.questions.find((q) => q.id === session.currentQuestionId) ?? null
    : null;

  if (!page) {
    return <div>Page {pageIdx} not found</div>;
  }

  return (
    <>
      <PageCard lang={lang} page={page} total={book.pages.length} />

      {currentQ && (
        <QuestionCard
          lang={lang}
          roomCode={roomCode}
          user={user}
          myClientId={myClientId}
          q={currentQ}
          isTeacher={isTeacher}
          book={book}
        />
      )}

      {isTeacher && (
        <TeacherPageControls
          lang={lang}
          roomCode={roomCode}
          pageIdx={pageIdx}
          totalPages={book.pages.length}
          questions={availableQuestions}
          activeQuestionId={session.currentQuestionId}
          onGotoAfter={() => setPhase(roomCode, "after")}
        />
      )}
    </>
  );
}

function PageCard({
  lang, page, total,
}: {
  lang: string;
  page: StorybookPage;
  total: number;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 26,
        border: "3px solid #FDE68A",
        boxShadow: "0 14px 36px rgba(180,83,9,0.15)",
        marginBottom: 14,
        overflow: "hidden",
      }}
    >
      {/* Illustration panel — emoji + gradient (MVP) or AI image (future) */}
      <div
        style={{
          background: page.illustration.bgGradient,
          minHeight: 440,
          aspectRatio: "4 / 3",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}
      >
        {page.illustration.imageUrl ? (
          <img
            src={page.illustration.imageUrl}
            alt=""
            aria-hidden="true"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            fontSize: 140, letterSpacing: "0.05em",
            filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.15))",
            textAlign: "center",
          }}>
            {page.illustration.emoji}
          </div>
        )}
        <div style={{
          position: "absolute", top: 14, right: 16,
          fontSize: 12, fontWeight: 900, color: "#B45309",
          background: "#FFFBEB", padding: "5px 12px", borderRadius: 999,
          border: "1.5px solid #FDE68A",
        }}>
          {tFmt("sbPageOf", lang, { cur: page.idx, total })}
        </div>
      </div>

      {/* Text panel — bilingual for non-Korean students */}
      <BilingualText map={page.text} lang={lang} size="page" />
    </div>
  );
}

// Shared bilingual text block. For non-Korean students, shows primary (their lang)
// + smaller Korean line underneath for language-learning support.
function BilingualText({
  map, lang, size,
}: {
  map: Record<string, string> | undefined;
  lang: string;
  size: "page" | "question";
}) {
  const { primary, secondary } = bilingual(map, lang);
  const primarySize = size === "page" ? 20 : 18;
  const secondarySize = size === "page" ? 16 : 15;
  const padding = size === "page" ? "20px 22px 22px" : "0";

  return (
    <div style={{ padding, position: "relative" }}>
      <div style={{
        fontSize: primarySize, fontWeight: 700, color: "#1F2937",
        letterSpacing: -0.2, lineHeight: 1.55,
      }}>
        {primary}
      </div>
      {secondary && (
        <div style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px dashed #FDE68A",
          fontSize: secondarySize, fontWeight: 600, color: "#B45309",
          letterSpacing: -0.1, lineHeight: 1.5,
          fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
        }}>
          🇰🇷 {secondary}
        </div>
      )}
    </div>
  );
}

// speakText is imported from lib/ttsMulti — uses voice selection + per-lang tuning.

// ============================================================
// Question card (shared between phases)
// ============================================================
// v3: Character wobble + TTS auto-play + post-it + fruit-tree result + 3 input modes

type QInputMode = "text" | "voice" | "draw" | "emotion";

const POSTIT_COLORS = [
  "#FEF3C7", "#DBEAFE", "#FCE7F3", "#D1FAE5", "#EDE9FE",
  "#FEE2E2", "#FFEDD5", "#E0F2FE", "#F3E8FF", "#FEF9C3",
  "#CFFAFE", "#FDE68A", "#C7D2FE", "#FECACA", "#BBF7D0",
];

const FRUIT_BG = ["#EF4444","#FDBA74","#8B5CF6","#FDE047","#3B82F6","#DC2626","#10B981","#F472B6"];

/** Animal-Crossing-style babble beep per character */
function playIntroBeep(ctxRef: React.MutableRefObject<AudioContext | null>, ch: string) {
  if (!ch || /\s/.test(ch)) return;
  try {
    if (!ctxRef.current) {
      const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctxRef.current = new Ctor();
    }
    const ctx = ctxRef.current!;
    const pitch = 420 + ((ch.charCodeAt(0) % 9) * 22);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = pitch;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch { /* audio unavailable */ }
}

function QuestionCard({
  lang, roomCode, user, myClientId, q, isTeacher, book,
}: {
  lang: string;
  roomCode: string;
  user: UserConfig;
  myClientId: string;
  q: StorybookQuestion;
  isTeacher: boolean;
  book?: Storybook;
}) {
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [responses, setResponses] = useState<StorybookResponse[]>([]);
  const [inputMode, setInputMode] = useState<QInputMode>("text");
  const [speaking, setSpeaking] = useState(false);
  const [selectedFruit, setSelectedFruit] = useState<number | null>(null);
  // Translation cache for responses: key = `${responseId}:${toLang}`
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  // Tutorial-style entrance for students
  const [showIntro, setShowIntro] = useState(false);
  const [introTyped, setIntroTyped] = useState(0);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const ttsPlayedRef = useRef<string>("");

  // Reset when question changes — trigger tutorial intro for students
  useEffect(() => {
    setDraft(""); setSaved(false); setSelectedFruit(null);
    if (!isTeacher) {
      setShowIntro(true);
      setIntroTyped(0);
    }
  }, [q.id, isTeacher]);

  useEffect(() => {
    const unsub = subscribeResponses(roomCode, q.id, setResponses);
    return () => unsub();
  }, [roomCode, q.id]);

  const mine = responses.find((r) => r.clientId === myClientId);
  useEffect(() => { if (mine && !saved) { setSaved(true); setDraft(mine.text); } }, [mine, saved]);

  // Auto-translate a response's text to the current viewer's language on demand.
  // Cached per-response. Skips when languages match or own response.
  const ensureTranslation = useCallback(async (r: StorybookResponse) => {
    const key = `${r.id}:${lang}`;
    if (!r.studentLang || r.studentLang === lang) return;
    if (translations[key] || translating[key]) return;
    setTranslating((s) => ({ ...s, [key]: true }));
    try {
      const res = await fetch("/api/storybook-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: [r.text], fromLang: r.studentLang, toLang: lang }),
      });
      const data = await res.json() as { ok: boolean; translated?: string[] };
      if (data.ok && data.translated && data.translated[0]) {
        setTranslations((s) => ({ ...s, [key]: data.translated![0] }));
      }
    } catch (err) {
      console.warn("translate failed", err);
    } finally {
      setTranslating((s) => {
        const { [key]: _, ...rest } = s;
        return rest;
      });
    }
  }, [lang, translations, translating]);

  // When the selected fruit changes, trigger translation if needed
  useEffect(() => {
    if (selectedFruit === null) return;
    const r = responses[selectedFruit];
    if (r) ensureTranslation(r);
  }, [selectedFruit, responses, ensureTranslation]);

  // ── Typewriter effect for student intro ──
  const introText = pick(q.text, lang);
  useEffect(() => {
    if (!showIntro || isTeacher || !introText) return;
    let i = 0;
    const speed = 35;
    const tick = () => {
      i++;
      setIntroTyped(i);
      // beep sound per char
      const ch = introText[i - 1] || "";
      if (ch && !/\s/.test(ch)) playIntroBeep(audioCtxRef, ch);
      if (i >= introText.length) return;
      const delay = /[.,!?~…]/.test(ch) ? speed * 5 : speed;
      introTimerRef.current = setTimeout(tick, delay);
    };
    introTimerRef.current = setTimeout(tick, 400); // wait for entrance
    return () => { if (introTimerRef.current) clearTimeout(introTimerRef.current); };
  }, [showIntro, isTeacher, introText]);

  // TTS is now manual — no auto-play

  function handleTtsReplay() {
    const text = pick(q.text, lang);
    if (text) { setSpeaking(true); speakText(text, lang).finally(() => setSpeaking(false)); }
  }

  async function handleSubmit() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      await submitResponse(roomCode, q.id, myClientId, user.myName, user.myLang, draft, book?.id);
      setSaved(true);
    } catch (err) { console.error("submitResponse failed", err); }
    setBusy(false);
  }

  // [#4] 음성 입력은 앱 공용 STT 엔진(MicButton)로 통일 — 인식 결과를 draft 에 이어붙인다.
  //   기존의 인라인 MediaRecorder 구현은 언마운트 정리 누락 등 오류 원인이라 제거함.

  // Canvas drawing
  function getCanvasPos(e: React.MouseEvent | React.TouchEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ("touches" in e) { const t = e.touches[0] || e.changedTouches[0]; return { x: t.clientX - rect.left, y: t.clientY - rect.top }; }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }
  function drawStart(e: React.MouseEvent | React.TouchEvent) { e.preventDefault(); setDrawing(true); lastPos.current = getCanvasPos(e); }
  function drawMove(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return; e.preventDefault();
    const pos = getCanvasPos(e); const ctx = canvasRef.current?.getContext("2d");
    if (ctx && lastPos.current) { ctx.strokeStyle = "#1F2937"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
    lastPos.current = pos;
  }
  function drawEnd() { setDrawing(false); lastPos.current = null; }
  function clearCanvas() { const ctx = canvasRef.current?.getContext("2d"); if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); }

  const activeChar = book?.characters?.[0];
  const charImg = activeChar?.avatarUrl || "/mascot/bee-think.png";
  const charName = activeChar ? pick(activeChar.name, lang) : "🐝";
  const { primary, secondary } = bilingual(q.text, lang);

  function dismissIntro() {
    // skip typewriter instantly if still typing, or dismiss overlay
    if (introTyped < introText.length) {
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
      setIntroTyped(introText.length);
    } else {
      setShowIntro(false);
    }
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {/* ═══ Student tutorial-style intro overlay ═══ */}
      {!isTeacher && showIntro && (
        <div
          onClick={dismissIntro}
          style={{
            position: "fixed", inset: 0, zIndex: 9990,
            background: "rgba(9,7,30,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            animation: "fadeIn 0.3s ease",
          }}
        >
          {/* Character — big entrance (tablet-max, transparent bg) */}
          <img
            src={charImg}
            alt={charName}
            style={{
              width: "min(460px, 60vw, 55vh)",
              height: "min(460px, 60vw, 55vh)",
              objectFit: "contain",
              background: "transparent",
              filter: "drop-shadow(0 16px 36px rgba(245,158,11,0.55))",
              animation: "charBounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both, beeGuideIdle 2.8s ease-in-out 0.5s infinite",
              marginBottom: 18,
            }}
          />

          {/* Dialogue box — Animal Crossing style */}
          <div
            onClick={(e) => { e.stopPropagation(); dismissIntro(); }}
            style={{
              width: "min(600px, calc(100vw - 40px))",
              background: "#FFFBEB",
              border: "4px solid #F59E0B",
              borderRadius: 24,
              padding: "22px 26px 24px",
              boxShadow: "0 20px 50px rgba(180,83,9,0.4)",
              position: "relative",
              fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
              animation: "bubblePop 0.35s cubic-bezier(0.17,0.89,0.32,1.28) 0.2s both",
              cursor: "pointer",
            }}
          >
            {/* Speaker tag */}
            <div style={{
              position: "absolute", top: -18, left: 22,
              background: "#F59E0B", color: "#fff",
              padding: "6px 16px", borderRadius: 999,
              fontSize: 13, fontWeight: 900,
              boxShadow: "0 4px 10px rgba(180,83,9,0.3)",
            }}>
              {activeChar?.avatarEmoji || "🐝"} {charName}
            </div>

            {/* Typewriter text */}
            <div style={{
              fontSize: 20, lineHeight: 1.6, fontWeight: 700,
              minHeight: 60, whiteSpace: "pre-wrap", color: "#1F2937",
              marginTop: 6,
            }}>
              {introText.slice(0, introTyped)}
              {introTyped < introText.length && (
                <span style={{
                  display: "inline-block", width: 2, marginLeft: 3,
                  borderRight: "3px solid #F59E0B", height: "1em",
                  verticalAlign: "text-bottom",
                  animation: "tutorialCaret 600ms steps(1) infinite",
                }} />
              )}
            </div>

            {/* Secondary (Korean) for non-Korean students */}
            {secondary && introTyped >= introText.length && (
              <div style={{
                marginTop: 8, paddingTop: 8, borderTop: "1px dashed #FDE68A",
                fontSize: 15, fontWeight: 700, color: "#B45309", lineHeight: 1.5,
                animation: "questionSlideIn 0.3s ease both",
              }}>
                🇰🇷 {secondary}
              </div>
            )}

            {/* Bottom: TTS button + hint */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginTop: 14,
            }}>
              {introTyped >= introText.length ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleTtsReplay(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: 99,
                    background: speaking ? "#FDE68A" : "#FEF3C7",
                    border: "2px solid #F59E0B",
                    fontSize: 13, fontWeight: 800, color: "#92400E",
                    cursor: "pointer",
                    animation: speaking ? "pulse 1s ease-in-out infinite" : "none",
                  }}
                >🔊 {speaking ? "재생 중..." : "들어보기"}</button>
              ) : <div />}
              <div style={{
                fontSize: 13, fontWeight: 800, color: "#92400E",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {introTyped < introText.length ? "건너뛰기" : "답변하기"}
                <span style={{ animation: "fadeSlideIn 700ms ease-in-out infinite alternate", fontSize: 16 }}>▼</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Character with wobble animation + speech bubble (inline, after intro) ── */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14,
        animation: "questionSlideIn 0.5s ease both",
      }}>
        {/* Character avatar — transparent PNG, wobble animation */}
        <img
          src={charImg}
          alt=""
          aria-hidden="true"
          onClick={handleTtsReplay}
          title="다시 들려주기"
          style={{
            width: "min(160px, 22vw)", height: "min(160px, 22vw)",
            flexShrink: 0, objectFit: "contain",
            background: "transparent",
            filter: "drop-shadow(0 8px 20px rgba(245,158,11,0.45))",
            animation: "charWobble 2s ease-in-out infinite",
            cursor: "pointer",
          }}
        />

        {/* Speech bubble */}
        <div style={{
          flex: 1, position: "relative",
          background: "#fff", borderRadius: 20, padding: "14px 18px",
          border: "2px solid #60A5FA",
          boxShadow: "0 8px 24px rgba(59,130,246,0.12)",
          animation: "bubblePop 0.4s cubic-bezier(.17,.89,.32,1.28) 0.15s both",
        }}>
          {/* Triangle pointer */}
          <div style={{
            position: "absolute", left: -9, top: 18,
            width: 0, height: 0,
            borderTop: "9px solid transparent", borderBottom: "9px solid transparent",
            borderRight: "9px solid #60A5FA",
          }} />
          <div style={{ position: "absolute", left: -6, top: 20, width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderRight: "7px solid #fff" }} />

          {/* Header: tier + name + TTS button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: "#1E40AF", background: "#DBEAFE", padding: "2px 10px", borderRadius: 99 }}>
              {t(TIER_KEY[q.tier], lang)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>{charName}</span>
            <button
              onClick={handleTtsReplay}
              title="다시 듣기"
              style={{
                marginLeft: "auto", width: 28, height: 28, borderRadius: "50%",
                background: speaking ? "#DBEAFE" : "#F3F4F6", border: "none",
                cursor: "pointer", fontSize: 14,
                animation: speaking ? "pulse 1s ease-in-out infinite" : "none",
              }}
            >🔊</button>
          </div>

          {/* Question text */}
          <div style={{ fontSize: 18, fontWeight: 900, color: "#1F2937", lineHeight: 1.4, letterSpacing: -0.3 }}>
            {primary}
          </div>
          {secondary && (
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "#3B82F6", lineHeight: 1.4 }}>
              🇰🇷 {secondary}
            </div>
          )}
        </div>
      </div>

      {/* ── Student input: 3 modes ── */}
      {!isTeacher && !saved && (
        <div style={{
          background: "#fff", borderRadius: 18, padding: "16px 18px",
          border: "2px solid #E5E7EB", marginBottom: 12,
          animation: "questionSlideIn 0.4s ease 0.3s both",
        }}>
          <div style={{ display: "flex", gap: 0, marginBottom: 14, background: "#F3F4F6", borderRadius: 12, padding: 3, border: "1px solid #E5E7EB" }}>
            {([
              { id: "text" as QInputMode, icon: "✏️", label: "글자" },
              { id: "voice" as QInputMode, icon: "🎤", label: "말" },
              { id: "draw" as QInputMode, icon: "🖌️", label: "그리기" },
              { id: "emotion" as QInputMode, icon: "💗", label: "감정" },
            ]).map((tab) => (
              <button key={tab.id} onClick={() => setInputMode(tab.id)} style={{
                flex: 1, padding: "9px 6px", borderRadius: 10,
                background: inputMode === tab.id ? "#fff" : "transparent",
                border: inputMode === tab.id ? "2px solid #3B82F6" : "2px solid transparent",
                boxShadow: inputMode === tab.id ? "0 2px 8px rgba(59,130,246,0.15)" : "none",
                fontSize: 13, fontWeight: 800, color: inputMode === tab.id ? "#1E40AF" : "#9CA3AF",
                cursor: "pointer", transition: "all 0.15s",
              }}>{tab.icon} {tab.label}</button>
            ))}
          </div>

          {inputMode === "text" && (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder={t("sbAnswerPlaceholder", lang)} disabled={busy} rows={3}
              style={{ width: "100%", padding: "12px 14px", border: "2px solid #DBEAFE", borderRadius: 14, fontSize: 15, fontFamily: "inherit", resize: "vertical", outline: "none", background: "#FAFAFA", color: "#1F2937", boxSizing: "border-box", lineHeight: 1.5 }}
              onFocus={(e) => { e.target.style.borderColor = "#3B82F6"; e.target.style.background = "#fff"; }}
              onBlur={(e) => { e.target.style.borderColor = "#DBEAFE"; e.target.style.background = "#FAFAFA"; }}
            />
          )}

          {inputMode === "voice" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "14px 0" }}>
              {/* 앱 공용 STT 엔진 — 소통창/튜터와 동일 (오류 적은 단일 구현) */}
              <MicButton
                lang={lang}
                size={72}
                onText={(text) => setDraft((d) => (d ? `${d} ${text}` : text))}
              />
              <div style={{ fontSize: 12, color: "#6B7280" }}>버튼을 눌러 말해보세요</div>
              {draft && <div style={{ marginTop: 4, fontSize: 14, color: "#1F2937", fontWeight: 600 }}>&ldquo;{draft}&rdquo;</div>}
            </div>
          )}

          {inputMode === "draw" && (
            <div>
              <div style={{ border: "2px solid #E5E7EB", borderRadius: 12, overflow: "hidden", touchAction: "none", background: "#fff", position: "relative" }}>
                <canvas ref={canvasRef} width={400} height={160}
                  style={{ width: "100%", height: 160, display: "block", cursor: "crosshair" }}
                  onMouseDown={drawStart} onMouseMove={drawMove} onMouseUp={drawEnd} onMouseLeave={drawEnd}
                  onTouchStart={drawStart} onTouchMove={drawMove} onTouchEnd={drawEnd} />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={clearCanvas} style={{ flex: 1, padding: "8px", borderRadius: 10, background: "#F3F4F6", border: "1px solid #E5E7EB", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑️ 지우기</button>
                <button onClick={() => { const text = prompt("그린 글자를 입력해주세요:"); if (text) setDraft(text); }} style={{ flex: 1, padding: "8px", borderRadius: 10, background: "#DBEAFE", border: "1px solid #BFDBFE", fontSize: 12, fontWeight: 700, color: "#1E40AF", cursor: "pointer" }}>✨ 글자 인식</button>
              </div>
            </div>
          )}

          {inputMode === "emotion" && (
            <div>
              <EmotionCardDeck
                lang={lang}
                quick
                busy={busy}
                onPick={async (emotionId) => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    const e = emotionById(emotionId);
                    const label = e.label[lang] ?? e.label.ko ?? e.id;
                    const text = `${e.emoji} ${label}`;
                    await pushEmotion({
                      roomCode,
                      emotionId: emotionId as EmotionId,
                      intensity: 2,
                      clientId: myClientId,
                      authorName: user.myName,
                      context: "storybook",
                      bookId: book?.id,
                    });
                    await submitResponse(roomCode, q.id, myClientId, user.myName, user.myLang, text, book?.id);
                    awardEmotionStickerOncePerDay({
                      roomCode,
                      clientId: myClientId,
                      studentName: user.myName,
                    }).catch(() => undefined);
                    setDraft(text);
                    setSaved(true);
                  } catch (err) {
                    console.error("emotion submit failed", err);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </div>
          )}

          {draft && inputMode !== "text" && inputMode !== "emotion" && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#F0F9FF", borderRadius: 10, fontSize: 13, color: "#1E40AF", fontWeight: 600 }}>
              입력: &ldquo;{draft}&rdquo;
            </div>
          )}
          {inputMode !== "emotion" && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={handleSubmit} disabled={busy || !draft.trim()} style={{
                minHeight: 56, padding: "10px 24px",
                background: !draft.trim() ? "#E5E7EB" : "linear-gradient(135deg, #3B82F6, #2563EB)",
                color: !draft.trim() ? "#9CA3AF" : "#fff",
                fontSize: 15, fontWeight: 900, border: "none", borderRadius: 14,
                cursor: !draft.trim() || busy ? "not-allowed" : "pointer",
                boxShadow: !draft.trim() ? "none" : "0 6px 16px rgba(59,130,246,0.3)",
                transition: "all 0.2s",
              }}>{busy ? "제출 중..." : "📨 포스트잇 붙이기"}</button>
            </div>
          )}
        </div>
      )}

      {!isTeacher && saved && (
        <div style={{ padding: "12px 16px", background: "#ECFDF5", borderRadius: 14, border: "1px solid #A7F3D0", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#065F46" }}>{t("sbAnswerSaved", lang)}</span>
        </div>
      )}

      {/* ── Fruit-tree style responses (열매나무) ── */}
      {(isTeacher || saved) && responses.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            🍎 {t("sbResponsesTitle", lang)} ({responses.length})
          </div>
          <div style={{
            position: "relative",
            minHeight: responses.length <= 6 ? 200 : 280,
            background: "linear-gradient(180deg, #E8F5FF 0%, #F0F7E8 100%)",
            borderRadius: 20, overflow: "hidden",
            border: "1px solid #D1FAE5",
          }}>
            {/* Mini tree SVG */}
            <svg viewBox="0 0 400 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} aria-hidden>
              <ellipse cx="200" cy="195" rx="180" ry="12" fill="#A4D68B" opacity="0.4" />
              <path d="M195 195 Q190 140 198 100 Q200 90 205 100 Q212 140 208 195 Z" fill="#8B5A3C" />
              <ellipse cx="200" cy="85" rx="120" ry="70" fill="#7AB96A" />
              <ellipse cx="140" cy="70" rx="60" ry="45" fill="#86C87A" />
              <ellipse cx="260" cy="70" rx="60" ry="45" fill="#86C87A" />
              <ellipse cx="200" cy="50" rx="50" ry="40" fill="#92D387" />
            </svg>

            {/* Fruits = responses */}
            {responses.map((r, i) => {
              const n = responses.length;
              const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
              const rx = Math.min(38, 24 + n);
              const ry = Math.min(32, 20 + n);
              const cx = 50 + Math.cos(angle) * rx;
              const cy = 46 + Math.sin(angle) * ry;
              const fruitColor = FRUIT_BG[i % FRUIT_BG.length];

              return (
                <button key={r.id} onClick={() => setSelectedFruit(i)} style={{
                  position: "absolute", left: `${cx}%`, top: `${cy}%`,
                  transform: "translate(-50%, -50%)", zIndex: 2,
                  animation: `fruitPop 0.4s cubic-bezier(.17,.89,.32,1.28) ${i * 0.06}s both`,
                  background: "transparent", border: "none", cursor: "pointer", padding: 0,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.2))",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translate(-50%, -55%) scale(1.15)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translate(-50%, -50%) scale(1)"; }}
                >
                  <svg width="36" height="40" viewBox="0 0 36 40">
                    <path d={`M18 4 Q16 2 18 0`} stroke="#78350F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <g transform="translate(20 3) rotate(30)"><path d="M0 0 Q5 -1 7 3 Q4 4 0 0 Z" fill="#16A34A" /></g>
                    <ellipse cx="18" cy="24" rx="14" ry="14" fill={fruitColor} />
                    <ellipse cx="14" cy="18" rx="4" ry="5" fill="#fff" opacity="0.5" />
                    <circle cx="12" cy="15" r="1.5" fill="#fff" opacity="0.7" />
                  </svg>
                  <div style={{
                    background: "rgba(255,255,255,0.92)", color: "#1F2937",
                    padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.1)", whiteSpace: "nowrap",
                    maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis",
                  }}>{r.studentName}</div>
                </button>
              );
            })}

            {/* Center question label */}
            <div style={{
              position: "absolute", left: "50%", top: "46%", transform: "translate(-50%, -50%)",
              zIndex: 3, background: "#fff", borderRadius: 14, padding: "8px 14px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)", border: "2px solid #F59E0B",
              fontSize: 10, fontWeight: 900, color: "#92400E", textAlign: "center",
              maxWidth: 120,
            }}>❓ {responses.length}명</div>
          </div>

          {/* Fruit detail modal — auto-translates into the viewer's language */}
          {selectedFruit !== null && responses[selectedFruit] && (() => {
            const r = responses[selectedFruit];
            const key = `${r.id}:${lang}`;
            const needsTranslation = !!r.studentLang && r.studentLang !== lang;
            const translated = translations[key];
            const isTranslating = !!translating[key];
            const isOwn = r.clientId === myClientId;
            const showOrig = !!showOriginal[r.id];
            const displayText = needsTranslation && translated && !showOrig ? translated : r.text;

            return (
              <div onClick={() => setSelectedFruit(null)} style={{
                position: "fixed", inset: 0, zIndex: 500, background: "rgba(17,24,39,0.5)",
                backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center",
                padding: 20, animation: "fadeIn 0.2s",
              }}>
                <div onClick={(e) => e.stopPropagation()} style={{
                  background: POSTIT_COLORS[selectedFruit % POSTIT_COLORS.length],
                  borderRadius: 16, maxWidth: 420, width: "100%", padding: "22px 20px",
                  boxShadow: "4px 8px 30px rgba(0,0,0,0.25)", position: "relative",
                  animation: "bubblePop 0.3s cubic-bezier(.17,.89,.32,1.28)",
                }}>
                  <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 50, height: 12, background: "rgba(245,158,11,0.3)", borderRadius: 3 }} />

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>
                      {r.studentName}
                    </div>
                    {r.studentLang && r.studentLang !== lang && (
                      <div style={{
                        fontSize: 10, fontWeight: 800, color: "#92400E",
                        background: "rgba(255,255,255,0.6)", padding: "2px 8px", borderRadius: 999,
                        border: "1px solid rgba(245,158,11,0.4)",
                      }}>
                        {(r.studentLang || "").toUpperCase()} → {lang.toUpperCase()}
                      </div>
                    )}
                    {isTranslating && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280" }}>
                        ⟳ 번역 중…
                      </div>
                    )}
                  </div>

                  <div style={{
                    fontSize: 16, fontWeight: 600, color: "#1F2937",
                    lineHeight: 1.6, whiteSpace: "pre-wrap",
                  }}>
                    {displayText}
                  </div>

                  {needsTranslation && translated && !showOrig && !isOwn && (
                    <div style={{
                      marginTop: 10, padding: "8px 12px",
                      background: "rgba(255,255,255,0.55)",
                      borderRadius: 10,
                      borderLeft: "3px solid rgba(245,158,11,0.5)",
                      fontSize: 12, fontWeight: 500, color: "#4B5563",
                      lineHeight: 1.5, whiteSpace: "pre-wrap",
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#92400E", marginBottom: 3, letterSpacing: 0.3 }}>
                        ORIGINAL · {(r.studentLang || "").toUpperCase()}
                      </div>
                      {r.text}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                    {needsTranslation && translated && (
                      <button
                        onClick={() => setShowOriginal((s) => ({ ...s, [r.id]: !showOrig }))}
                        style={{
                          flex: 1, padding: "10px 0", borderRadius: 12,
                          background: "rgba(255,255,255,0.7)",
                          border: "1.5px solid rgba(245,158,11,0.4)",
                          fontSize: 12, fontWeight: 800,
                          color: "#92400E", cursor: "pointer",
                        }}
                      >
                        {showOrig ? "🌐 번역 보기" : "📜 원문만 보기"}
                      </button>
                    )}
                    <button onClick={() => setSelectedFruit(null)} style={{
                      flex: 1, padding: "10px 0", borderRadius: 12,
                      background: "rgba(0,0,0,0.06)", border: "none", fontSize: 13, fontWeight: 800,
                      color: "#374151", cursor: "pointer",
                    }}>닫기</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <style jsx global>{`
        @keyframes charBounceIn {
          0% { opacity: 0; transform: scale(0.2) translateY(40px); }
          60% { opacity: 1; transform: scale(1.15) translateY(-10px); }
          80% { transform: scale(0.95) translateY(2px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes beeGuideIdle {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes tutorialCaret {
          0%,49% { opacity: 1; }
          50%,100% { opacity: 0; }
        }
        @keyframes fadeSlideIn {
          from { transform: translateY(0); opacity: 0.6; }
          to { transform: translateY(3px); opacity: 1; }
        }
        @keyframes charWobble {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-6deg) scale(1.05); }
          30% { transform: rotate(5deg) scale(1.03); }
          45% { transform: rotate(-3deg) scale(1.02); }
          60% { transform: rotate(2deg) scale(1); }
        }
        @keyframes questionSlideIn {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes bubblePop {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fruitPop {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(0.3); }
          100% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

// ============================================================
// Teacher Controls — before phase
// ============================================================

function TeacherControls({
  lang, title, questions, activeQuestionId, onShowQuestion, onNext, nextLabel,
}: {
  lang: string;
  title: string;
  questions: StorybookQuestion[];
  activeQuestionId: string | null;
  onShowQuestion: (id: string | null) => void;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "14px 16px",
        border: "2px solid #FDE68A",
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: "#92400E", marginBottom: 8 }}>
        👩‍🏫 {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {questions.map((q) => {
          const active = q.id === activeQuestionId;
          return (
            <button
              key={q.id}
              onClick={() => onShowQuestion(active ? null : q.id)}
              style={{
                padding: "10px 12px",
                background: active ? "linear-gradient(135deg, #3B82F6, #2563EB)" : "#F9FAFB",
                color: active ? "#fff" : "#1F2937",
                border: `2px solid ${active ? "#1E40AF" : "#E5E7EB"}`,
                borderRadius: 12,
                fontSize: 13, fontWeight: 800,
                textAlign: "left",
                cursor: "pointer",
                letterSpacing: -0.1,
                fontFamily: "inherit",
              }}
            >
              {active ? `🔵 ${t("sbHideQuestion", lang)}` : t("sbShowQuestion", lang)}: {pick(q.text, lang)}
            </button>
          );
        })}
      </div>
      <button
        onClick={onNext}
        style={{
          width: "100%", minHeight: 48,
          background: "linear-gradient(135deg, #F59E0B, #D97706)",
          color: "#fff", fontSize: 15, fontWeight: 900,
          border: "none", borderRadius: 14, cursor: "pointer",
          boxShadow: "0 6px 18px rgba(245,158,11,0.35)",
          letterSpacing: -0.2,
        }}
      >{nextLabel}</button>
    </div>
  );
}

// ============================================================
// Teacher Page Controls — during phase
// ============================================================

function TeacherPageControls({
  lang, roomCode, pageIdx, totalPages, questions, activeQuestionId, onGotoAfter,
}: {
  lang: string;
  roomCode: string;
  pageIdx: number;
  totalPages: number;
  questions: StorybookQuestion[];
  activeQuestionId: string | null;
  onGotoAfter: () => void;
}) {
  const prevDisabled = pageIdx <= 1;
  const isLast = pageIdx >= totalPages;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "14px 16px",
        border: "2px solid #FDE68A",
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setPage(roomCode, Math.max(1, pageIdx - 1))}
          disabled={prevDisabled}
          style={{
            flex: 1, minHeight: 48,
            background: prevDisabled ? "#F3F4F6" : "#fff",
            color: prevDisabled ? "#9CA3AF" : "#92400E",
            border: `2px solid ${prevDisabled ? "#E5E7EB" : "#FDE68A"}`,
            borderRadius: 14, fontSize: 14, fontWeight: 900,
            cursor: prevDisabled ? "not-allowed" : "pointer",
          }}
        >{t("sbPrevPage", lang)}</button>
        {!isLast && (
          <button
            onClick={() => setPage(roomCode, pageIdx + 1)}
            style={{
              flex: 1, minHeight: 48,
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              color: "#fff", border: "none",
              borderRadius: 14, fontSize: 14, fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
            }}
          >{t("sbNextPage", lang)}</button>
        )}
        {isLast && (
          <button
            onClick={onGotoAfter}
            style={{
              flex: 1, minHeight: 48,
              background: "linear-gradient(135deg, #10B981, #059669)",
              color: "#fff", border: "none",
              borderRadius: 14, fontSize: 14, fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
            }}
          >{t("sbPhaseNextAfter", lang)}</button>
        )}
      </div>

      {questions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#6B7280", letterSpacing: 0.3 }}>
            {t("sbShowQuestion", lang)}
          </div>
          {questions.map((q) => {
            const active = q.id === activeQuestionId;
            return (
              <button
                key={q.id}
                onClick={() => showQuestion(roomCode, active ? null : q.id)}
                style={{
                  padding: "10px 12px",
                  background: active ? "linear-gradient(135deg, #3B82F6, #2563EB)" : "#F9FAFB",
                  color: active ? "#fff" : "#1F2937",
                  border: `2px solid ${active ? "#1E40AF" : "#E5E7EB"}`,
                  borderRadius: 12,
                  fontSize: 12, fontWeight: 800,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ marginRight: 6 }}>
                  {active ? "🔵" : "○"}
                </span>
                <span style={{ opacity: 0.8, marginRight: 6 }}>
                  {t(TIER_KEY[q.tier], lang)}
                </span>
                {pick(q.text, lang)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// AFTER — Character chatbot with Groq + 4-layer safety
// ============================================================

const MAX_TURNS = 15;

function AfterPhase({
  lang, session, book, isTeacher, roomCode, myClientId, user,
}: {
  lang: string;
  session: StorybookSession;
  book: Storybook;
  isTeacher: boolean;
  roomCode: string;
  myClientId: string;
  user: UserConfig;
}) {
  const activeChar = session.activeCharacterId
    ? book.characters.find((c) => c.id === session.activeCharacterId) ?? null
    : null;

  // Teacher view: roster of chats in progress + end button
  if (isTeacher) {
    return (
      <TeacherAfterView
        lang={lang}
        roomCode={roomCode}
        book={book}
        session={session}
        activeChar={activeChar}
      />
    );
  }

  // Student view: pick character (if none picked yet) then chat
  if (!activeChar) {
    return (
      <CharacterPicker
        lang={lang}
        book={book}
        onPick={async (id) => {
          // Student's pick seeds their own clientId → activeCharacterId only
          // stores the "featured" character for teacher-led flow. But in MVP
          // each student can choose independently — we store locally via
          // react state by using a per-student path.
          await setActiveCharacter(roomCode, id);
        }}
      />
    );
  }

  return (
    <CharacterChat
      lang={lang}
      roomCode={roomCode}
      myClientId={myClientId}
      user={user}
      book={book}
      character={activeChar}
    />
  );
}

function CharacterPicker({
  lang, book, onPick,
}: {
  lang: string;
  book: Storybook;
  onPick: (id: string) => void;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "24px 20px",
        border: "3px solid #FDE68A",
        boxShadow: "0 10px 28px rgba(180,83,9,0.15)",
        marginBottom: 14,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3, marginBottom: 14 }}>
        {t("sbChooseCharacter", lang)}
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
      }}>
        {book.characters.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            style={{
              padding: "18px 14px 16px",
              background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
              border: "3px solid #F59E0B55",
              borderRadius: 22,
              textAlign: "center",
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(245,158,11,0.25)",
              fontFamily: "inherit",
              transition: "transform 0.15s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {c.avatarUrl ? (
              <img
                src={c.avatarUrl}
                alt=""
                aria-hidden="true"
                style={{
                  width: "min(220px, 26vw)", height: "min(220px, 26vw)",
                  margin: "0 auto", display: "block",
                  objectFit: "contain",
                  background: "transparent",
                  filter: "drop-shadow(0 10px 22px rgba(180,83,9,0.28))",
                }}
              />
            ) : (
              <div style={{
                fontSize: "min(140px, 20vw)", lineHeight: 1,
                filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.15))",
              }}>
                {c.avatarEmoji}
              </div>
            )}
            <div style={{ fontSize: 18, fontWeight: 900, color: "#1F2937", marginTop: 12, letterSpacing: -0.2 }}>
              {pick(c.name, lang)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CharacterChat({
  lang, roomCode, myClientId, user, book, character,
}: {
  lang: string;
  roomCode: string;
  myClientId: string;
  user: UserConfig;
  book: Storybook;
  character: StorybookCharacter;
}) {
  const [turns, setTurns] = useState<StorybookChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [showLangExpand, setShowLangExpand] = useState(false);

  useEffect(() => {
    const unsub = subscribeChat(roomCode, myClientId, setTurns);
    return () => unsub();
  }, [roomCode, myClientId]);

  const studentTurnCount = useMemo(
    () => turns.filter((t) => t.from === "student").length,
    [turns],
  );
  const turnsLeft = Math.max(0, MAX_TURNS - studentTurnCount);
  const limitReached = studentTurnCount >= MAX_TURNS;

  // After hitting 15 turns, if student is Korean show farewell language expansion once
  useEffect(() => {
    if (limitReached && lang === "ko" && !showLangExpand) {
      setShowLangExpand(true);
    }
  }, [limitReached, lang, showLangExpand]);

  async function handleSend() {
    if (!draft.trim() || busy || limitReached) return;
    const text = draft.trim();
    setDraft("");
    setBusy(true);

    // Client-side pre-check (Layer 1)
    const pre = checkSafety(text);
    if (pre.distress) {
      await appendChatTurn(roomCode, myClientId, {
        from: "student", text, timestamp: Date.now(), flagged: true,
      });
      await appendChatTurn(roomCode, myClientId, {
        from: "character", text: replyForSafety(lang, "distress"),
        timestamp: Date.now() + 1,
      });
      // Fire teacher alert — name + time only, NOT the text (privacy)
      await raiseAlert(roomCode, {
        clientId: myClientId,
        studentName: user.myName,
        timestamp: Date.now(),
        kind: "distress",
      });
      setBusy(false);
      return;
    }
    if (pre.blocked) {
      // Escalation: count prior flagged student turns in this session.
      // 1st offense → soft warning that tells the student the teacher
      // will be notified on repeat. 2nd+ offense → fire teacher alert.
      const priorFlagged = turns.filter((tt) => tt.from === "student" && tt.flagged).length;
      const isRepeat = priorFlagged >= 1;

      await appendChatTurn(roomCode, myClientId, {
        from: "student", text, timestamp: Date.now(), flagged: true,
      });
      await appendChatTurn(roomCode, myClientId, {
        from: "character",
        text: replyForSafety(lang, isRepeat ? "block" : "warning"),
        timestamp: Date.now() + 1,
      });
      if (isRepeat) {
        await raiseAlert(roomCode, {
          clientId: myClientId,
          studentName: user.myName,
          timestamp: Date.now(),
          kind: "repeated_block",
        });
      }
      setBusy(false);
      return;
    }

    // Record the student turn — await 하지 않는다. Firebase 는 로컬 쓰기를
    // 즉시 onValue 로 에코하므로 화면엔 바로 뜨고, 서버 ack 를 기다리느라
    // LLM 요청 시작이 늦어지는 게 기존 체감 지연의 한 축이었음.
    appendChatTurn(roomCode, myClientId, {
      from: "student", text, timestamp: Date.now(),
    }).catch((err) => console.error("student turn write failed", err));

    // Send to server API (Layer 2+3 happen there) — SSE 스트리밍 수신
    try {
      const history = turns.map((t) => ({
        role: t.from === "student" ? ("user" as const) : ("assistant" as const),
        content: t.text,
      }));
      const res = await fetch("/api/storybook-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character,
          bookTitle: pick(book.title, "ko"),
          studentLang: lang,
          history,
          studentText: text,
        }),
      });
      const data = await readChatStream(res, (accumulated) => {
        setStreamText(accumulated);
      });
      if (data.kind === "distress") {
        await raiseAlert(roomCode, {
          clientId: myClientId,
          studentName: user.myName,
          timestamp: Date.now(),
          kind: "distress",
        });
      }
      // 로컬 에코가 즉시 발화하므로 await 없이 기록 → streamText 정리 순서로
      // 깜빡임 없이 확정 버블로 전환된다.
      appendChatTurn(roomCode, myClientId, {
        from: "character", text: data.reply || replyForSafety(lang, "block"),
        timestamp: Date.now(),
        flagged: data.kind !== "normal",
      }).catch((err) => console.error("character turn write failed", err));
    } catch (err) {
      console.error("chat request failed", err);
      appendChatTurn(roomCode, myClientId, {
        from: "character", text: replyForSafety(lang, "block"),
        timestamp: Date.now(), flagged: true,
      }).catch(() => {});
    }
    setStreamText(null);
    setBusy(false);
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        border: "3px solid #FDE68A",
        boxShadow: "0 10px 28px rgba(180,83,9,0.15)",
        marginBottom: 14,
        display: "flex", flexDirection: "column",
        maxHeight: "78vh", minHeight: 480,
        overflow: "hidden",
      }}
    >
      {/* Header with avatar */}
      <div style={{
        background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: "2px solid #F59E0B33",
      }}>
        {character.avatarUrl ? (
          <img
            src={character.avatarUrl}
            alt=""
            aria-hidden="true"
            style={{
              width: "min(104px, 16vw)", height: "min(104px, 16vw)",
              objectFit: "contain",
              background: "transparent",
              flexShrink: 0,
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))",
            }}
          />
        ) : (
          <div style={{
            fontSize: "min(72px, 12vw)", flexShrink: 0, lineHeight: 1,
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.15))",
          }}>
            {character.avatarEmoji}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#1F2937", letterSpacing: -0.2 }}>
            {pick(character.name, lang)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#B45309", marginTop: 2 }}>
            {limitReached
              ? t("sbTurnLimitReached", lang)
              : tFmt("sbTurnsLeft", lang, { n: turnsLeft })}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, padding: "14px", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 8,
        background: "#FFFBEB",
      }}>
        {turns.length === 0 && (
          <div style={{
            textAlign: "center", fontSize: 13, fontWeight: 700,
            color: "#92400E", padding: "32px 16px",
          }}>
            💬 {t("sbChatPlaceholder", lang)}
          </div>
        )}
        {turns.map((turn) => (
          <ChatBubble key={turn.id} turn={turn} lang={lang} character={character} />
        ))}
        {busy && (
          <div style={{
            alignSelf: "flex-start",
            maxWidth: "85%",
            padding: streamText ? "10px 14px" : "8px 14px",
            background: "#fff",
            borderRadius: streamText ? "18px 18px 18px 4px" : 16,
            border: "2px solid #FDE68A",
            fontSize: 14, fontWeight: streamText ? 600 : 700,
            color: streamText ? "#1F2937" : "#92400E",
            lineHeight: 1.4, wordBreak: "break-word",
          }}>
            {streamText || "···"}
          </div>
        )}
      </div>

      {/* Input */}
      {!limitReached && (
        <div style={{
          padding: "10px 12px 12px",
          background: "#fff",
          borderTop: "2px solid #FDE68A",
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <MicButton
            lang={lang}
            disabled={busy}
            onText={(text) => setDraft((d) => (d ? `${d} ${text}` : text))}
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder={t("sbChatPlaceholder", lang)}
            disabled={busy}
            maxLength={200}
            style={{
              flex: 1, minHeight: 56,
              padding: "10px 14px",
              border: "2px solid #FDE68A",
              borderRadius: 14,
              fontSize: 14, fontWeight: 600,
              color: "#1F2937",
              fontFamily: "inherit",
              outline: "none",
              background: "#FFFBEB",
            }}
          />
          <button
            onClick={handleSend}
            disabled={busy || !draft.trim()}
            style={{
              minWidth: 72,
              background: !draft.trim() || busy
                ? "#E5E7EB"
                : "linear-gradient(135deg, #F59E0B, #D97706)",
              color: !draft.trim() || busy ? "#9CA3AF" : "#fff",
              fontSize: 14, fontWeight: 900,
              border: "none", borderRadius: 14,
              cursor: !draft.trim() || busy ? "not-allowed" : "pointer",
              padding: "0 14px",
            }}
          >{t("sbSend", lang)}</button>
        </div>
      )}

      {/* Turn limit or language expansion */}
      {limitReached && (
        <div style={{
          padding: "14px 16px",
          background: "#FEF3C7",
          borderTop: "2px solid #FDE68A",
          textAlign: "center",
        }}>
          {showLangExpand && lang === "ko" ? (
            <LangExpandPanel
              character={character}
              roomCode={roomCode}
              myClientId={myClientId}
              onClose={() => setShowLangExpand(false)}
            />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 900, color: "#92400E" }}>
              {t("sbTurnLimitReached", lang)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChatBubble({
  turn, lang, character,
}: {
  turn: StorybookChatTurn;
  lang: string;
  character: StorybookCharacter;
}) {
  const isStudent = turn.from === "student";
  return (
    <div style={{
      alignSelf: isStudent ? "flex-end" : "flex-start",
      maxWidth: "85%",
      display: "flex", gap: 6, alignItems: "flex-end",
      flexDirection: isStudent ? "row-reverse" : "row",
    }}>
      {!isStudent && (
        character.avatarUrl ? (
          <img
            src={character.avatarUrl}
            alt=""
            aria-hidden="true"
            style={{
              width: 56, height: 56,
              objectFit: "contain",
              background: "transparent",
              flexShrink: 0,
              filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.15))",
            }}
          />
        ) : (
          <div style={{
            fontSize: 38, flexShrink: 0, lineHeight: 1,
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))",
          }}>{character.avatarEmoji}</div>
        )
      )}
      <div style={{
        padding: "10px 14px",
        background: isStudent ? "linear-gradient(135deg, #3B82F6, #2563EB)" : "#fff",
        color: isStudent ? "#fff" : "#1F2937",
        borderRadius: isStudent ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        border: isStudent ? "none" : "2px solid #FDE68A",
        fontSize: 14, fontWeight: 600, lineHeight: 1.4,
        letterSpacing: -0.1,
        wordBreak: "break-word",
        boxShadow: isStudent ? "0 4px 10px rgba(59,130,246,0.25)" : "0 2px 8px rgba(180,83,9,0.1)",
      }}>
        {turn.text}
        {!isStudent && (
          <button
            onClick={() => speakText(turn.text, lang)}
            aria-label={t("sbReadText", lang)}
            style={{
              marginLeft: 6, marginTop: 4,
              background: "transparent", border: "none",
              fontSize: 14, cursor: "pointer",
              padding: 0,
            }}
          >🔊</button>
        )}
      </div>
    </div>
  );
}

function LangExpandPanel({
  character, roomCode, myClientId, onClose,
}: {
  character: StorybookCharacter;
  roomCode: string;
  myClientId: string;
  onClose: () => void;
}) {
  const otherLangs: { code: string; flag: string; greeting: string }[] = [
    { code: "en",  flag: "🇺🇸", greeting: "Thanks for sharing with me! Goodbye!" },
    { code: "vi",  flag: "🇻🇳", greeting: "Cảm ơn bạn đã chia sẻ! Tạm biệt!" },
    { code: "zh",  flag: "🇨🇳", greeting: "谢谢你和我分享!再见!" },
    { code: "fil", flag: "🇵🇭", greeting: "Salamat sa pagbabahagi! Paalam!" },
    { code: "ja",  flag: "🇯🇵", greeting: "はなしてくれて ありがとう! バイバイ!" },
  ];
  const [picked, setPicked] = useState<string | null>(null);

  async function handlePick(item: typeof otherLangs[number]) {
    if (picked) return;
    setPicked(item.code);
    const farewell = `${item.greeting} ${character.avatarEmoji}`;
    await appendChatTurn(roomCode, myClientId, {
      from: "character",
      text: farewell,
      timestamp: Date.now(),
    });
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 900, color: "#92400E", marginBottom: 10, lineHeight: 1.4 }}>
        {t("sbLangExpandTitle", "ko")}
      </div>
      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center",
      }}>
        {otherLangs.map((l) => (
          <button
            key={l.code}
            onClick={() => handlePick(l)}
            disabled={!!picked}
            style={{
              padding: "8px 12px",
              background: picked === l.code ? "linear-gradient(135deg, #F59E0B, #D97706)" : "#fff",
              color: picked === l.code ? "#fff" : "#92400E",
              border: `2px solid ${picked === l.code ? "#D97706" : "#FDE68A"}`,
              borderRadius: 12,
              fontSize: 13, fontWeight: 900,
              cursor: picked ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {l.flag} {l.code.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: 10,
          padding: "6px 14px",
          background: "transparent",
          border: "1.5px solid #FDE68A",
          color: "#92400E",
          fontSize: 12, fontWeight: 800,
          borderRadius: 10, cursor: "pointer",
        }}
      >{t("sbLangExpandSkip", "ko")}</button>
    </div>
  );
}

function TeacherAfterView({
  lang, roomCode, book, session, activeChar,
}: {
  lang: string;
  roomCode: string;
  book: Storybook;
  session: StorybookSession;
  activeChar: StorybookCharacter | null;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "20px 18px",
        border: "3px solid #FDE68A",
        boxShadow: "0 10px 28px rgba(180,83,9,0.15)",
        marginBottom: 14,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3, marginBottom: 12 }}>
        {t("sbPhaseAfter", lang)}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", lineHeight: 1.5, marginBottom: 14 }}>
        학생들이 등장인물과 대화 중이에요.<br />
        위기 상황 감지 시 위쪽에 🔔 알림이 뜹니다.
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 10,
        marginBottom: 14,
      }}>
        {book.characters.map((c) => (
          <div
            key={c.id}
            style={{
              padding: "14px 10px",
              background: session.activeCharacterId === c.id
                ? "linear-gradient(135deg, #FEF3C7, #FDE68A)"
                : "#F9FAFB",
              border: `2px solid ${session.activeCharacterId === c.id ? "#F59E0B" : "#E5E7EB"}`,
              borderRadius: 14,
              textAlign: "center",
            }}
          >
            {c.avatarUrl ? (
              <img
                src={c.avatarUrl}
                alt=""
                aria-hidden="true"
                style={{
                  width: "min(140px, 18vw)", height: "min(140px, 18vw)",
                  margin: "0 auto", display: "block",
                  objectFit: "contain",
                  background: "transparent",
                  filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))",
                }}
              />
            ) : (
              <div style={{
                fontSize: "min(88px, 14vw)", lineHeight: 1,
                filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.15))",
              }}>{c.avatarEmoji}</div>
            )}
            <div style={{ fontSize: 13, fontWeight: 900, color: "#1F2937", marginTop: 6 }}>
              {pick(c.name, lang)}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => setPhase(roomCode, "done")}
        style={{
          width: "100%", minHeight: 48,
          background: "linear-gradient(135deg, #10B981, #059669)",
          color: "#fff", fontSize: 15, fontWeight: 900,
          border: "none", borderRadius: 14, cursor: "pointer",
          boxShadow: "0 6px 18px rgba(16,185,129,0.3)",
        }}
      >{t("sbPhaseDoneBtn", lang)}</button>
    </div>
  );
}

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
  setActiveCharacter,
  appendChatTurn,
  subscribeChat,
  raiseAlert,
  subscribeAlerts,
  clearAlert,
  listGeneratedBooks,
  deleteGeneratedBook,
  type BookListEntry,
} from "@/lib/storybook";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import { speak as speakText } from "@/lib/ttsMulti";
import StorybookCreator from "./StorybookCreator";
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

  const handleStart = useCallback(async (bookId: string) => {
    await startSession(roomCode, bookId, myClientId);
  }, [roomCode, myClientId]);

  const handleEnd = useCallback(async () => {
    await endSession(roomCode);
  }, [roomCode]);

  // ── Teacher Setup screen: no session yet ─────────────────
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
    return <StudentWaiting lang={lang} onBack={onBack} />;
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
        background: "linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 40%, #FDE68A 100%)",
        fontFamily: "'Noto Sans KR', sans-serif",
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
  onStart: (bookId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<BookListEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);

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

  if (creating) {
    return (
      <StorybookCreator
        teacherName={teacherName}
        onCreated={async (id) => {
          setCreating(false);
          if (busy) return;
          setBusy(true);
          try { await onStart(id); } finally { setBusy(false); }
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
        background: "linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 40%, #FDE68A 100%)",
        fontFamily: "'Noto Sans KR', sans-serif",
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
                  try { await onStart(b.id); } finally { setBusy(false); }
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
                </div>
                <div style={{ display: "flex", gap: 6 }}>
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
                      try { await onStart(b.id); } finally { setBusy(false); }
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
        background: "linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 100%)",
        fontFamily: "'Noto Sans KR', sans-serif",
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
  const introQuestions = useMemo(
    () => book.questions.filter((q) => q.tier === "intro"),
    [book.questions],
  );
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
              fontFamily: "'Jua', 'Noto Sans KR', sans-serif",
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
            fontFamily: "'Jua', 'Noto Sans KR', sans-serif",
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
          fontFamily: "'Noto Sans KR', sans-serif",
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
// Redesigned: Character asks via speech bubble + post-it responses + 3 input modes

type QInputMode = "text" | "voice" | "draw";

const POSTIT_COLORS = [
  "#FEF3C7", "#DBEAFE", "#FCE7F3", "#D1FAE5", "#EDE9FE",
  "#FEE2E2", "#FFEDD5", "#E0F2FE", "#F3E8FF", "#FEF9C3",
];

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
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const lastPos = React.useRef<{ x: number; y: number } | null>(null);

  // Reset when question changes
  useEffect(() => {
    setDraft("");
    setSaved(false);
  }, [q.id]);

  useEffect(() => {
    const unsub = subscribeResponses(roomCode, q.id, setResponses);
    return () => unsub();
  }, [roomCode, q.id]);

  const mine = responses.find((r) => r.clientId === myClientId);
  useEffect(() => {
    if (mine && !saved) {
      setSaved(true);
      setDraft(mine.text);
    }
  }, [mine, saved]);

  async function handleSubmit() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      await submitResponse(roomCode, q.id, myClientId, user.myName, user.myLang, draft);
      setSaved(true);
    } catch (err) {
      console.error("submitResponse failed", err);
    }
    setBusy(false);
  }

  // Voice recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : undefined;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        setProcessing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "rec.webm");
          form.append("lang", lang);
          const res = await fetch("/api/stt", { method: "POST", body: form });
          const data = await res.json();
          if (data.text) setDraft(data.text);
          else alert("음성을 인식하지 못했어요. 다시 시도해주세요.");
        } catch { alert("음성 인식 실패"); }
        setProcessing(false);
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
    } catch { alert("마이크를 사용할 수 없어요."); }
  }
  function stopRecording() { mediaRef.current?.stop(); setRecording(false); }

  // Drawing helpers
  function getCanvasPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }
  function drawStart(e: React.MouseEvent | React.TouchEvent) { e.preventDefault(); setDrawing(true); lastPos.current = getCanvasPos(e); }
  function drawMove(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return; e.preventDefault();
    const pos = getCanvasPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && lastPos.current) {
      ctx.strokeStyle = "#1F2937"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    }
    lastPos.current = pos;
  }
  function drawEnd() { setDrawing(false); lastPos.current = null; }
  function clearCanvas() { const ctx = canvasRef.current?.getContext("2d"); if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); }

  // Get active character avatar
  const activeChar = book?.characters?.[0];
  const charImg = activeChar?.avatarUrl || "/mascot/bee-think.png";
  const charName = activeChar ? pick(activeChar.name, lang) : "🐝";

  const { primary, secondary } = bilingual(q.text, lang);

  return (
    <div style={{ marginBottom: 14 }}>
      {/* ── Character speech bubble ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
          background: `url(${charImg}) center/cover no-repeat`,
          border: "3px solid #fff",
          boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
        }} />
        <div style={{
          flex: 1, position: "relative",
          background: "#fff", borderRadius: 18, padding: "14px 16px",
          border: "2px solid #60A5FA",
          boxShadow: "0 6px 18px rgba(59,130,246,0.12)",
        }}>
          {/* Triangle */}
          <div style={{
            position: "absolute", left: -8, top: 16,
            width: 0, height: 0,
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
            borderRight: "8px solid #60A5FA",
          }} />
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 900, color: "#1E40AF",
              background: "#DBEAFE", padding: "2px 8px", borderRadius: 99,
            }}>{t(TIER_KEY[q.tier], lang)}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>{charName}</span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#1F2937", lineHeight: 1.4 }}>
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
          background: "#fff", borderRadius: 18, padding: "14px 16px",
          border: "2px solid #E5E7EB", marginBottom: 12,
        }}>
          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#F3F4F6", borderRadius: 10, padding: 3 }}>
            {([
              { id: "text" as QInputMode, label: "✏️ 글자" },
              { id: "voice" as QInputMode, label: "🎤 말" },
              { id: "draw" as QInputMode, label: "🖌️ 그리기" },
            ]).map((tab) => (
              <button key={tab.id} onClick={() => setInputMode(tab.id)} style={{
                flex: 1, padding: "7px 4px", borderRadius: 8,
                background: inputMode === tab.id ? "#fff" : "transparent",
                border: inputMode === tab.id ? "1.5px solid #3B82F6" : "1.5px solid transparent",
                fontSize: 12, fontWeight: 800, color: inputMode === tab.id ? "#1E40AF" : "#6B7280",
                cursor: "pointer",
              }}>{tab.label}</button>
            ))}
          </div>

          {inputMode === "text" && (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("sbAnswerPlaceholder", lang)}
              disabled={busy}
              rows={3}
              style={{
                width: "100%", padding: "10px 12px",
                border: "2px solid #DBEAFE", borderRadius: 12,
                fontSize: 14, fontFamily: "inherit", resize: "vertical",
                outline: "none", background: "#FAFAFA", color: "#1F2937",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#3B82F6"; }}
              onBlur={(e) => { e.target.style.borderColor = "#DBEAFE"; }}
            />
          )}

          {inputMode === "voice" && (
            <div style={{ textAlign: "center", padding: "14px 0" }}>
              {processing ? (
                <div style={{ fontSize: 13, color: "#6B7280" }}>🔄 음성 변환 중...</div>
              ) : (
                <button
                  onClick={recording ? stopRecording : startRecording}
                  style={{
                    width: 64, height: 64, borderRadius: "50%",
                    background: recording ? "linear-gradient(135deg,#EF4444,#DC2626)" : "linear-gradient(135deg,#3B82F6,#2563EB)",
                    border: "none", cursor: "pointer", fontSize: 24, color: "#fff",
                    boxShadow: recording ? "0 0 0 6px rgba(239,68,68,0.2)" : "0 4px 12px rgba(59,130,246,0.3)",
                    animation: recording ? "pulse 1s ease-in-out infinite" : "none",
                  }}
                >{recording ? "⏹" : "🎤"}</button>
              )}
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>
                {recording ? "녹음 중... 눌러서 멈추기" : "버튼을 눌러 말해보세요"}
              </div>
              {draft && <div style={{ marginTop: 8, fontSize: 13, color: "#1F2937", fontWeight: 600 }}>인식: &ldquo;{draft}&rdquo;</div>}
            </div>
          )}

          {inputMode === "draw" && (
            <div>
              <div style={{ border: "2px solid #E5E7EB", borderRadius: 10, overflow: "hidden", touchAction: "none", background: "#fff" }}>
                <canvas
                  ref={canvasRef}
                  width={360} height={140}
                  style={{ width: "100%", height: 140, display: "block", cursor: "crosshair" }}
                  onMouseDown={drawStart} onMouseMove={drawMove} onMouseUp={drawEnd} onMouseLeave={drawEnd}
                  onTouchStart={drawStart} onTouchMove={drawMove} onTouchEnd={drawEnd}
                />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={clearCanvas} style={{ flex: 1, padding: "7px", borderRadius: 8, background: "#F3F4F6", border: "1px solid #E5E7EB", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑️ 지우기</button>
                <button onClick={() => { const text = prompt("그린 글자를 입력해주세요:"); if (text) setDraft(text); }} style={{ flex: 1, padding: "7px", borderRadius: 8, background: "#DBEAFE", border: "1px solid #BFDBFE", fontSize: 12, fontWeight: 700, color: "#1E40AF", cursor: "pointer" }}>✨ 글자 인식</button>
              </div>
            </div>
          )}

          {/* Preview + submit */}
          {draft && inputMode !== "text" && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "#F9FAFB", borderRadius: 8, fontSize: 13, color: "#374151" }}>
              <strong>입력:</strong> {draft}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              onClick={handleSubmit}
              disabled={busy || !draft.trim()}
              style={{
                minHeight: 40, padding: "8px 20px",
                background: !draft.trim() ? "#E5E7EB" : "linear-gradient(135deg, #3B82F6, #2563EB)",
                color: !draft.trim() ? "#9CA3AF" : "#fff",
                fontSize: 14, fontWeight: 900, border: "none",
                borderRadius: 12, cursor: !draft.trim() || busy ? "not-allowed" : "pointer",
                boxShadow: !draft.trim() ? "none" : "0 4px 12px rgba(59,130,246,0.3)",
              }}
            >{busy ? "제출 중..." : "📨 포스트잇 붙이기"}</button>
          </div>
        </div>
      )}

      {/* Saved confirmation */}
      {!isTeacher && saved && (
        <div style={{
          padding: "10px 14px", background: "#ECFDF5", borderRadius: 12,
          border: "1px solid #A7F3D0", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#065F46" }}>{t("sbAnswerSaved", lang)}</span>
        </div>
      )}

      {/* ── Post-it style responses ── */}
      {(isTeacher || saved) && responses.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#475569", marginBottom: 8 }}>
            {t("sbResponsesTitle", lang)} ({responses.length})
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}>
            {responses.map((r, i) => {
              const bg = POSTIT_COLORS[i % POSTIT_COLORS.length];
              const rotation = ((i * 5 + 2) % 7) - 3;
              return (
                <div key={r.id} style={{
                  background: bg, borderRadius: 4, padding: "12px 10px 8px",
                  boxShadow: "2px 3px 10px rgba(0,0,0,0.1)",
                  transform: `rotate(${rotation}deg)`,
                  position: "relative", minHeight: 70,
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  transition: "transform 0.2s",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "rotate(0deg) scale(1.05)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = `rotate(${rotation}deg)`; }}
                >
                  {/* Tape */}
                  <div style={{
                    position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)",
                    width: 30, height: 8, background: "rgba(59,130,246,0.2)", borderRadius: 2,
                  }} />
                  <div style={{ fontSize: 12, color: "#1F2937", lineHeight: 1.4, wordBreak: "break-word" }}>
                    {r.text}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#6B7280", marginTop: 6, borderTop: "1px dashed rgba(0,0,0,0.08)", paddingTop: 4 }}>
                    {r.studentName}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
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
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
      }}>
        {book.characters.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            style={{
              padding: "16px 12px 14px",
              background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
              border: "3px solid #F59E0B55",
              borderRadius: 20,
              textAlign: "center",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(245,158,11,0.25)",
              fontFamily: "inherit",
              transition: "transform 0.15s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {c.avatarUrl ? (
              <div style={{
                width: 120, height: 120, margin: "0 auto",
                borderRadius: "50%", overflow: "hidden",
                background: "#fff",
                boxShadow: "0 4px 12px rgba(180,83,9,0.2)",
                border: "3px solid #fff",
              }}>
                <img
                  src={c.avatarUrl}
                  alt=""
                  aria-hidden="true"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            ) : (
              <div style={{ fontSize: 80, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.12))" }}>
                {c.avatarEmoji}
              </div>
            )}
            <div style={{ fontSize: 17, fontWeight: 900, color: "#1F2937", marginTop: 10, letterSpacing: -0.2 }}>
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

    // Record the student turn first so the UI feels responsive
    await appendChatTurn(roomCode, myClientId, {
      from: "student", text, timestamp: Date.now(),
    });

    // Send to server API (Layer 2+3 happen there)
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
      const data = await res.json() as {
        reply: string; kind: "normal" | "block" | "distress" | "error";
      };
      if (data.kind === "distress") {
        await raiseAlert(roomCode, {
          clientId: myClientId,
          studentName: user.myName,
          timestamp: Date.now(),
          kind: "distress",
        });
      }
      await appendChatTurn(roomCode, myClientId, {
        from: "character", text: data.reply || replyForSafety(lang, "block"),
        timestamp: Date.now(),
        flagged: data.kind !== "normal",
      });
    } catch (err) {
      console.error("chat request failed", err);
      await appendChatTurn(roomCode, myClientId, {
        from: "character", text: replyForSafety(lang, "block"),
        timestamp: Date.now(), flagged: true,
      });
    }
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
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            overflow: "hidden", background: "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            border: "2px solid #fff",
            flexShrink: 0,
          }}>
            <img
              src={character.avatarUrl}
              alt=""
              aria-hidden="true"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        ) : (
          <div style={{ fontSize: 40, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.1))" }}>
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
            padding: "8px 14px",
            background: "#fff", borderRadius: 16,
            border: "2px solid #FDE68A",
            fontSize: 14, fontWeight: 700, color: "#92400E",
          }}>
            ···
          </div>
        )}
      </div>

      {/* Input */}
      {!limitReached && (
        <div style={{
          padding: "10px 12px 12px",
          background: "#fff",
          borderTop: "2px solid #FDE68A",
          display: "flex", gap: 8,
        }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder={t("sbChatPlaceholder", lang)}
            disabled={busy}
            maxLength={200}
            style={{
              flex: 1, minHeight: 44,
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
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            overflow: "hidden", flexShrink: 0, background: "#fff",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}>
            <img
              src={character.avatarUrl}
              alt=""
              aria-hidden="true"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        ) : (
          <div style={{ fontSize: 22, flexShrink: 0 }}>{character.avatarEmoji}</div>
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
              <div style={{
                width: 64, height: 64, margin: "0 auto",
                borderRadius: "50%", overflow: "hidden", background: "#fff",
              }}>
                <img
                  src={c.avatarUrl}
                  alt=""
                  aria-hidden="true"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            ) : (
              <div style={{ fontSize: 40 }}>{c.avatarEmoji}</div>
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

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
  StorybookLiveBoard,
  StorybookResponseComment,
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
  appendResponseComment,
  subscribeResponseComments,
  setAllowReviewChat,
  setAutoReading,
  subscribeBookAnswers,
  submitBookAnswer,
  pushStorybookBoard,
  subscribeStorybookBoards,
  appendChatTurn,
  subscribeChat,
  raiseAlert,
  subscribeAlerts,
  clearAlert,
  listGeneratedBooks,
  deleteGeneratedBook,
  setBookFlags,
  updateGeneratedBookCharacterAvatar,
  type BookListEntry,
} from "@/lib/storybook";
import { requestStorybookImage } from "@/lib/storybookImageClient";
import { exportStorybookToPptx } from "@/lib/storybookPptx";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import { readChatStream } from "@/lib/chatStreamClient";
import MicButton from "./MicButton";
import DrawBoard, { type DrawBoardHandle } from "./DrawBoard";
import ImageLightbox from "./ImageLightbox";
import { speak as speakText, cancelSpeak } from "@/lib/ttsMulti";
import StorybookCreator from "./StorybookCreator";
import StorybookWordQuiz from "./StorybookWordQuiz";
import { useBackLayer } from "@/lib/backStack";
import EmotionCardDeck from "./EmotionCardDeck";
import { pushEmotion, emotionById, awardEmotionStickerOncePerDay, type EmotionId } from "@/lib/emotions";
import { t, tFmt } from "@/lib/i18n";
import { Fruit, FRUIT_KINDS } from "./DiscussionSession";

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

  // [아바타 self-heal] 생성 당시 이미지가 실패한 캐릭터(avatarUrl 없음 +
  // avatarImagePrompt 있음)를 발견하면 백그라운드로 다시 그린다. 이게 없으면
  // 핫시팅 챗은 영구히 이모지 폴백으로 남는다. 교사는 어느 단계에서든 즉시,
  // 학생은 챗 단계(after)에서만 트리거 — 반 전체가 초반에 동시 호출하는 것 방지
  // (서버는 같은 프롬프트 요청을 캐시·병합하므로 남는 중복도 1회 생성으로 수렴).
  const healedBookRef = useRef<string | null>(null);
  useEffect(() => {
    if (!book?.id) return;
    if (!isTeacher && session?.phase !== "after") return;
    if (healedBookRef.current === book.id) return;
    const missing = (book.characters || []).filter((c) => !c.avatarUrl && c.avatarImagePrompt);
    if (missing.length === 0) return;
    healedBookRef.current = book.id;
    const bookId = book.id;
    let cancel = false;
    (async () => {
      // 생성 전에 Firebase 를 한 번 다시 읽는다 — 교사(또는 먼저 든 학생)의
      // self-heal 이 이미 채워놨으면 그 URL 만 반영하고 생성 호출을 건너뛴다.
      let toHeal = missing;
      try {
        const fresh = await loadBook(bookId);
        if (cancel) return;
        const freshById = new Map(
          (fresh.characters || []).map((c) => [c.id, c] as const));
        const recovered = missing.filter((c) => freshById.get(c.id)?.avatarUrl);
        if (recovered.length > 0) {
          setBook((prev) => {
            if (!prev || prev.id !== bookId) return prev;
            return {
              ...prev,
              characters: prev.characters.map((pc) => {
                const freshUrl = freshById.get(pc.id)?.avatarUrl;
                return freshUrl && !pc.avatarUrl ? { ...pc, avatarUrl: freshUrl } : pc;
              }),
            };
          });
        }
        toHeal = missing.filter((c) => !freshById.get(c.id)?.avatarUrl);
      } catch { /* 읽기 실패 시 원래 목록으로 진행 */ }

      for (const c of toHeal) {
        // helper 가 재시도 1회 포함 — 그래도 실패하면 이번 세션은 이모지 폴백 유지.
        const res = await requestStorybookImage(
          { bookId, characterId: c.id, prompt: c.avatarImagePrompt! },
        ).catch(() => null);
        if (cancel || !res?.ok || !res.url) continue;
        const url = res.url;
        // 다음 세션을 위해 영구 저장 (실패해도 로컬 표시는 진행)
        updateGeneratedBookCharacterAvatar(bookId, c.id, url).catch((err) =>
          console.warn("avatar self-heal persist failed", err));
        if (cancel) return;
        setBook((prev) => {
          if (!prev || prev.id !== bookId) return prev;
          return {
            ...prev,
            characters: prev.characters.map((pc) =>
              pc.id === c.id ? { ...pc, avatarUrl: url } : pc),
          };
        });
      }
    })();
    return () => { cancel = true; };
  }, [book, isTeacher, session?.phase]);

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
    return <StudentFreeLibrary lang={lang} viewerLang={lang} roomCode={roomCode} user={user} myClientId={myClientId} onBack={onBack} />;
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
  async function toggleFlag(id: string, key: "visible" | "wordQuizEnabled" | "chatEnabled") {
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
                      {/* 복습(자유 읽기) 중 캐릭터 챗봇 허용 — 기본 OFF (설계서 항목 3) */}
                      <FlagChip
                        active={!!b.chatEnabled}
                        onClick={() => toggleFlag(b.id, "chatEnabled")}
                        onLabel="🐝 챗봇 ON"
                        offLabel="🐝 챗봇 OFF"
                        title="켜면 학생이 복습(자유 읽기) 중에 등장인물 챗봇과 대화할 수 있어요"
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
  lang, viewerLang, roomCode, user, myClientId, onBack,
}: { lang: string; viewerLang: string; roomCode: string; user: UserConfig; myClientId: string; onBack: () => void }) {
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
        user={user}
        myClientId={myClientId}
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
  book, viewerLang, roomCode, user, myClientId, onBack,
}: { book: Storybook; viewerLang: string; roomCode: string; user: UserConfig; myClientId: string; onBack: () => void }) {
  const quizFirst = !!book.wordQuizEnabled && (book.vocab?.length ?? 0) >= 4;
  const [quizDone, setQuizDone] = useState(false);
  // 0 = 표지, 1..N = 페이지
  const [page, setPage] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  // 복습 중 캐릭터 챗봇 (설계서 항목 3+4) — 교사가 책별 🐝 챗봇 ON 시에만.
  // ← 뒤로가기로 다른 캐릭터 재선택 가능 (챗 로그는 캐릭터별 분리 저장).
  const chatAllowed = !!book.chatEnabled && (book.characters?.length ?? 0) > 0;
  const [reviewChatOpen, setReviewChatOpen] = useState(false);
  const [reviewCharId, setReviewCharId] = useState<string | null>(null);
  const reviewChar = reviewCharId
    ? book.characters.find((c) => c.id === reviewCharId) ?? null
    : null;

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
            user={user}
            myClientId={myClientId}
          />
        ))}

        {/* ── 🐝 복습 중 캐릭터에게 물어보기 (교사가 책별 챗봇 ON 시에만) ── */}
        {chatAllowed && (
          <button
            onClick={() => setReviewChatOpen(true)}
            style={{
              width: "100%", minHeight: 52, marginTop: 14,
              background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
              color: "#fff", fontSize: 15, fontWeight: 900,
              border: "none", borderRadius: 16, cursor: "pointer",
              boxShadow: "0 6px 18px rgba(245,158,11,0.35)",
              letterSpacing: -0.2, fontFamily: "inherit",
            }}
          >🐝 등장인물에게 물어보기 — 궁금한 걸 질문해요!</button>
        )}

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

      {/* ── 챗봇 오버레이: 캐릭터 선택 → 대화 → ← 로 다른 캐릭터 (항목 3+4) ── */}
      {chatAllowed && reviewChatOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setReviewChatOpen(false); setReviewCharId(null); } }}
          style={{
            position: "fixed", inset: 0, zIndex: 600,
            background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 14, animation: "fadeIn 0.2s",
          }}
        >
          <div style={{ width: "min(680px, 100%)", maxHeight: "92vh", overflowY: "auto", position: "relative" }}>
            <button
              onClick={() => { setReviewChatOpen(false); setReviewCharId(null); }}
              aria-label="닫기"
              style={{
                position: "sticky", top: 0, left: "100%", zIndex: 2,
                width: 38, height: 38, borderRadius: 12, marginBottom: 6,
                background: "#fff", border: "2px solid #FDE68A",
                fontSize: 15, fontWeight: 900, color: "#92400E", cursor: "pointer",
                display: "block",
              }}
            >✕</button>
            {reviewChar ? (
              <CharacterChat
                lang={viewerLang}
                roomCode={roomCode}
                myClientId={myClientId}
                user={user}
                book={book}
                character={reviewChar}
                onBack={() => setReviewCharId(null)}
              />
            ) : (
              <CharacterPicker
                lang={viewerLang}
                book={book}
                onPick={(id) => setReviewCharId(id)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// [#1] 친구들의 예전 답변 — 책별 영속 저장(bookAnswers)을 읽어 자유 읽기 화면에 표시.
//   뷰어 언어와 다른 답변은 언어별로 묶어 한 번에 번역한다.
// 자유 읽기 새 답변 작성기 입력 모드 — 실제 수업(QuestionCard)과 동일 4종
type FreeMode = "text" | "voice" | "draw" | "emotion";

// 친구들의 생각 카드 색 — 의견 나누기(DiscussionSession)와 동일한 파스텔 로테이션
const FA_CARD_COLORS = [
  "#FEF3C7", "#DBEAFE", "#FCE7F3", "#D1FAE5", "#EDE9FE",
  "#FEE2E2", "#FFEDD5", "#E0F2FE", "#F3E8FF", "#FEF9C3",
];

function faDataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function FriendAnswers({
  roomCode, bookId, question, viewerLang, user, myClientId,
}: {
  roomCode: string; bookId: string; question: StorybookQuestion; viewerLang: string;
  user: UserConfig; myClientId: string;
}) {
  const [answers, setAnswers] = useState<StorybookResponse[]>([]);
  const [trans, setTrans] = useState<Record<string, string>>({});
  // 복습 중 의견 추가 (설계서 항목 1) — 답변별 댓글 입력
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [warn, setWarn] = useState<string | null>(null);
  // ── ✍ 새 생각 남기기 (자유 읽기 중 새 답변 — 수업과 동일한 4모드 입력) ──
  const [composerOpen, setComposerOpen] = useState(false);
  const [mode, setMode] = useState<FreeMode>("text");
  const [answerDraft, setAnswerDraft] = useState("");
  const [answerWarn, setAnswerWarn] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const freeDrawRef = useRef<DrawBoardHandle>(null);
  // 친구 그림 클릭 확대
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  useEffect(() => {
    // comments 서브트리는 raw 에 함께 실려온다 (bookAnswers 하위 저장이라
    // 별도 구독 불필요 — 댓글 추가 시 onValue 에코로 자동 갱신)
    const unsub = subscribeBookAnswers(roomCode, bookId, question.id, setAnswers);
    return () => unsub();
  }, [roomCode, bookId, question.id]);

  // 질문이 바뀌면 작성기 초기화
  useEffect(() => {
    setComposerOpen(false);
    setMode("text");
    setAnswerDraft("");
    setAnswerWarn(null);
  }, [question.id]);

  const myAnswer = answers.find((a) => a.clientId === myClientId) ?? null;

  // 새 답변 제출 — 글/말/그림/감정 공통 경로 (bookAnswers 영속 저장)
  async function submitFreeAnswer(opts?: { kind?: "text" | "drawing" | "emotion"; imageUrl?: string; textOverride?: string }) {
    if (submitting) return;
    const text = (opts?.textOverride ?? answerDraft).trim();
    if (!text && opts?.kind !== "drawing") return;
    // 안전검사 (챗·댓글과 동일 레이어)
    if (text) {
      const pre = checkSafety(text);
      if (pre.distress) {
        setAnswerWarn(replyForSafety(viewerLang, "distress"));
        raiseAlert(roomCode, {
          clientId: myClientId, studentName: user.myName,
          timestamp: Date.now(), kind: "distress",
        }).catch(() => {});
        setAnswerDraft("");
        return;
      }
      if (pre.blocked) {
        setAnswerWarn(replyForSafety(viewerLang, "warning"));
        return;
      }
    }
    setAnswerWarn(null);
    setSubmitting(true);
    try {
      await submitBookAnswer(
        roomCode, bookId, question.id, myClientId, user.myName, user.myLang,
        text, opts?.kind || opts?.imageUrl ? { kind: opts?.kind ?? "text", imageUrl: opts?.imageUrl } : { kind: "text" },
      );
      setAnswerDraft("");
      setComposerOpen(false);
    } catch (err) { console.error("submitBookAnswer failed", err); }
    setSubmitting(false);
  }

  // 그림 모드 제출 — 캔버스 업로드 후 drawing 답변으로
  async function submitFreeDrawing() {
    if (submitting) return;
    const dataUrl = freeDrawRef.current?.getDataUrl(0.8);
    if (!dataUrl) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", faDataUrlToBlob(dataUrl), `draw_${Date.now()}.jpg`);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json() as { url?: string };
      const imageUrl = data.url || dataUrl; // 업로드 실패 시 dataURL 폴백
      await submitBookAnswer(
        roomCode, bookId, question.id, myClientId, user.myName, user.myLang,
        answerDraft.trim(), { kind: "drawing", imageUrl },
      );
      setAnswerDraft("");
      setComposerOpen(false);
    } catch (err) { console.error("free drawing submit failed", err); }
    setSubmitting(false);
  }

  useEffect(() => {
    // 답변 + 댓글 텍스트를 언어별로 묶어 배치 번역 (항목 5: 원문+번역 2줄)
    const groups: Record<string, Array<{ id: string; text: string }>> = {};
    const add = (id: string, text: string, fromLang?: string) => {
      if (!fromLang || fromLang === viewerLang || trans[id] || !text) return;
      (groups[fromLang] ||= []).push({ id, text });
    };
    for (const a of answers) {
      add(a.id, a.text, a.studentLang);
      for (const c of Object.values(a.comments ?? {})) {
        if (c) add(c.id, c.text, c.studentLang);
      }
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
            body: JSON.stringify({ texts: grp.map((g) => g.text), fromLang: fl, toLang: viewerLang }),
          });
          const data = (await res.json()) as { ok: boolean; translated?: string[] };
          if (!cancel && data.ok && data.translated) {
            setTrans((prev) => {
              const next = { ...prev };
              grp.forEach((g, i) => { if (data.translated![i]) next[g.id] = data.translated![i]; });
              return next;
            });
          }
        } catch { /* 원문 유지 */ }
      }
    })();
    return () => { cancel = true; };
    // trans 는 의도적으로 제외(루프 방지) — 새 답변/댓글 도착 시에만 재번역
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, viewerLang]);

  function handleAddComment(respId: string) {
    const text = draft.trim();
    if (!text) return;
    // 클라이언트 사전 안전검사 (챗과 동일 레이어)
    const pre = checkSafety(text);
    if (pre.distress) {
      setWarn(replyForSafety(viewerLang, "distress"));
      raiseAlert(roomCode, {
        clientId: myClientId, studentName: user.myName,
        timestamp: Date.now(), kind: "distress",
      }).catch(() => {});
      setDraft("");
      return;
    }
    if (pre.blocked) {
      setWarn(replyForSafety(viewerLang, "warning"));
      return;
    }
    setWarn(null);
    appendResponseComment(roomCode, bookId, question.id, respId, {
      clientId: myClientId,
      studentName: user.myName,
      studentLang: user.myLang,
      text,
      timestamp: Date.now(),
    }).catch((err) => console.error("comment write failed", err));
    setDraft("");
  }

  return (
    <div style={{
      background: "#fff", borderRadius: 20, border: "2px solid #FDE68A",
      boxShadow: "0 8px 24px rgba(180,83,9,0.1)", padding: "14px 16px", marginBottom: 14,
    }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#92400E", marginBottom: 4 }}>
        💬 {pick(question.text, viewerLang)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#B45309", marginBottom: 10 }}>
        {answers.length > 0
          ? `친구들의 생각 ${answers.length}개 — 내 생각도 남기고, 친구 생각에 댓글도 달아요`
          : "아직 생각이 없어요 — 첫 번째 생각을 남겨볼까요?"}
      </div>

      {/* ── ✍ 새 생각 남기기 — 수업과 동일한 4모드(그림·글자·말·감정) ── */}
      {!composerOpen ? (
        <button
          onClick={() => { setComposerOpen(true); setAnswerWarn(null); }}
          style={{
            width: "100%", minHeight: 46, marginBottom: 10,
            background: "linear-gradient(135deg, #3B82F6, #2563EB)",
            color: "#fff", fontSize: 14, fontWeight: 900,
            border: "none", borderRadius: 14, cursor: "pointer",
            boxShadow: "0 5px 14px rgba(59,130,246,0.3)", fontFamily: "inherit",
          }}
        >✍ {myAnswer ? "내 생각 다시 쓰기" : "새 생각 남기기"}</button>
      ) : (
        <div style={{
          background: "#F8FAFF", border: "2px solid #DBEAFE", borderRadius: 14,
          padding: "12px 12px 14px", marginBottom: 12,
        }}>
          {/* 모드 탭 — 수업(QuestionCard)과 동일 구성 */}
          <div style={{ display: "flex", gap: 0, marginBottom: 10, background: "#EFF6FF", borderRadius: 12, padding: 3, border: "1px solid #DBEAFE" }}>
            {([
              { id: "text" as FreeMode, icon: "✏️", label: "글자" },
              { id: "voice" as FreeMode, icon: "🎤", label: "말" },
              { id: "draw" as FreeMode, icon: "🖍", label: "그림" },
              { id: "emotion" as FreeMode, icon: "💗", label: "감정" },
            ]).map((tab) => (
              <button key={tab.id} onClick={() => setMode(tab.id)} style={{
                flex: 1, padding: "8px 4px", borderRadius: 10,
                background: mode === tab.id ? "#fff" : "transparent",
                border: mode === tab.id ? "2px solid #3B82F6" : "2px solid transparent",
                fontSize: 12.5, fontWeight: 800, color: mode === tab.id ? "#1E40AF" : "#9CA3AF",
                cursor: "pointer", fontFamily: "inherit",
              }}>{tab.icon} {tab.label}</button>
            ))}
          </div>

          {answerWarn && (
            <div style={{ fontSize: 11, fontWeight: 800, color: "#B91C1C", marginBottom: 8, lineHeight: 1.4 }}>
              ⚠ {answerWarn}
            </div>
          )}

          {mode === "text" && (
            <textarea
              value={answerDraft}
              onChange={(e) => setAnswerDraft(e.target.value)}
              placeholder="이 질문에 대한 내 생각을 적어요…"
              disabled={submitting}
              rows={3}
              maxLength={300}
              style={{
                width: "100%", padding: "10px 12px", border: "2px solid #DBEAFE", borderRadius: 12,
                fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none",
                background: "#fff", color: "#1F2937", boxSizing: "border-box", lineHeight: 1.5,
              }}
            />
          )}

          {mode === "voice" && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <MicButton
                lang={viewerLang}
                disabled={submitting}
                size={64}
                onText={(text) => setAnswerDraft((d) => (d ? `${d} ${text}` : text))}
              />
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>버튼을 눌러 말해보세요</div>
              {answerDraft && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "#EFF6FF", borderRadius: 10, fontSize: 13, color: "#1E40AF", fontWeight: 600, textAlign: "left" }}>
                  &ldquo;{answerDraft}&rdquo;
                </div>
              )}
            </div>
          )}

          {mode === "draw" && (
            <div>
              <DrawBoard key={`free-${question.id}`} ref={freeDrawRef} width={720} height={400} accent="#3B82F6" />
              <input
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                placeholder="한 줄 설명을 더해도 좋아요 (선택)"
                disabled={submitting}
                maxLength={150}
                style={{
                  width: "100%", marginTop: 8, padding: "9px 12px", borderRadius: 12,
                  border: "2px solid #DBEAFE", fontSize: 14, fontFamily: "inherit",
                  outline: "none", background: "#fff", color: "#1F2937", boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {mode === "emotion" && (
            <EmotionCardDeck
              lang={viewerLang}
              quick
              busy={submitting}
              onPick={async (emotionId) => {
                if (submitting) return;
                const e = emotionById(emotionId);
                const label = e.label[viewerLang] ?? e.label.ko ?? e.id;
                // 수업과 동일: 감정 로그 + 하루 1회 스티커 (fire-and-forget)
                pushEmotion({
                  roomCode, emotionId: emotionId as EmotionId, intensity: 2,
                  clientId: myClientId, authorName: user.myName,
                  context: "storybook", bookId,
                }).catch(() => {});
                awardEmotionStickerOncePerDay({
                  roomCode, clientId: myClientId, studentName: user.myName,
                }).catch(() => {});
                await submitFreeAnswer({ kind: "emotion", textOverride: `${e.emoji} ${label}` });
              }}
            />
          )}

          {/* 제출/취소 — 감정 모드는 카드 탭이 곧 제출 */}
          {mode !== "emotion" && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => (mode === "draw" ? submitFreeDrawing() : submitFreeAnswer())}
                disabled={submitting || (mode !== "draw" && !answerDraft.trim())}
                style={{
                  flex: 2, minHeight: 44,
                  background: submitting || (mode !== "draw" && !answerDraft.trim())
                    ? "#E5E7EB"
                    : "linear-gradient(135deg, #3B82F6, #2563EB)",
                  color: submitting || (mode !== "draw" && !answerDraft.trim()) ? "#9CA3AF" : "#fff",
                  fontSize: 14, fontWeight: 900, border: "none", borderRadius: 12,
                  cursor: submitting ? "wait" : "pointer", fontFamily: "inherit",
                }}
              >{submitting ? "저장 중…" : "📨 생각 남기기"}</button>
              <button
                onClick={() => { setComposerOpen(false); setAnswerDraft(""); setAnswerWarn(null); }}
                disabled={submitting}
                style={{
                  flex: 1, minHeight: 44, background: "#fff",
                  border: "1.5px solid #E5E7EB", color: "#6B7280",
                  fontSize: 13, fontWeight: 800, borderRadius: 12,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >취소</button>
            </div>
          )}
        </div>
      )}
      {/* ── 친구들의 생각 — 의견 나누기(소통판)와 동일한 과일나무 배경 + 과일 장식 그리드 ── */}
      {answers.length > 0 && (
        <div style={{
          background: "linear-gradient(rgba(232,245,255,0.78), rgba(240,247,232,0.82)), url('/discussion/tree-bg.png') center / cover no-repeat",
          borderRadius: 16, padding: "12px 10px",
          border: "1px solid #D1FAE5",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 10, alignItems: "start",
          }}>
            {answers.map((a, ai) => {
              const cardBg = FA_CARD_COLORS[ai % FA_CARD_COLORS.length];
              const aTrans = trans[a.id];
              const comments = Object.values(a.comments ?? {})
                .filter(Boolean)
                .sort((x, y) => (x.timestamp ?? 0) - (y.timestamp ?? 0));
              const open = draftFor === a.id;
              return (
                <div key={a.id} style={{
                  background: cardBg, borderRadius: 14,
                  padding: "10px 11px 9px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 5px 12px rgba(0,0,0,0.1)",
                  display: "flex", flexDirection: "column", gap: 5,
                  position: "relative",
                }}>
                  {/* 🍎 소통판 의견 나누기와 같은 과일 장식 — 카드마다 로테이션 */}
                  <div aria-hidden="true" style={{ position: "absolute", top: -12, right: -4, pointerEvents: "none", zIndex: 1 }}>
                    <Fruit kind={FRUIT_KINDS[ai % FRUIT_KINDS.length]} scale={0.36} />
                  </div>
                  {/* 그림 답변 — 수업 중 그린 그림 그대로 표시, 클릭하면 크게 */}
                  {a.imageUrl && (
                    <img
                      src={a.imageUrl}
                      alt={`${a.studentName}의 그림`}
                      onClick={() => setZoomSrc(a.imageUrl!)}
                      title="크게 보기"
                      style={{
                        width: "100%", borderRadius: 10,
                        background: "#fff",
                        border: "1px solid rgba(0,0,0,0.08)",
                        display: "block", cursor: "zoom-in",
                      }}
                    />
                  )}
                  {/* 메인 = 뷰어 언어(번역 도착 시), 아래 원문 항상 표시 (항목 5) */}
                  {a.text && (
                    <div style={{ fontSize: 13.5, color: "#111827", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {aTrans || a.text}
                    </div>
                  )}
                  {aTrans && aTrans !== a.text && (
                    <div style={{
                      padding: "4px 7px",
                      background: "rgba(255,255,255,0.65)", borderRadius: 8,
                      borderLeft: "3px solid rgba(245,158,11,0.5)",
                      fontSize: 11.5, color: "#4B5563", lineHeight: 1.45, whiteSpace: "pre-wrap",
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#92400E", marginRight: 4 }}>
                        📜 {(a.studentLang || "").toUpperCase()}
                      </span>
                      {a.text}
                    </div>
                  )}
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: "#6B7280",
                    borderTop: "1px dashed rgba(0,0,0,0.12)", paddingTop: 4,
                  }}>
                    — {a.studentName}{a.clientId === myClientId ? " (나)" : ""}
                  </div>

                  {/* ── 💬 친구 의견 댓글 (설계서 항목 1, 영속) ── */}
                  {comments.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {comments.map((c) => {
                        const cTrans = trans[c.id];
                        return (
                          <div key={c.id} style={{
                            background: "rgba(255,255,255,0.75)",
                            borderRadius: 8, padding: "5px 8px",
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {cTrans || c.text}
                            </div>
                            {cTrans && cTrans !== c.text && (
                              <div style={{ fontSize: 10.5, color: "#6B7280", marginTop: 2, lineHeight: 1.4 }}>
                                📜 {c.text}
                              </div>
                            )}
                            <div style={{ fontSize: 9, fontWeight: 800, color: "#B45309", marginTop: 2 }}>
                              ↳ {c.studentName}{c.clientId === myClientId ? " (나)" : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {open ? (
                    <div>
                      {warn && (
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#B91C1C", marginBottom: 5, lineHeight: 1.4 }}>
                          ⚠ {warn}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 5 }}>
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(a.id); }}
                          placeholder="내 생각을 덧붙여요…"
                          maxLength={150}
                          autoFocus
                          style={{
                            flex: 1, minWidth: 0, minHeight: 36, padding: "6px 9px", borderRadius: 9,
                            border: "1.5px solid rgba(0,0,0,0.12)", fontSize: 12.5, fontWeight: 600,
                            color: "#1F2937", background: "#fff",
                            outline: "none", fontFamily: "inherit",
                          }}
                        />
                        <button
                          onClick={() => handleAddComment(a.id)}
                          disabled={!draft.trim()}
                          style={{
                            minWidth: 44, borderRadius: 9, border: "none",
                            background: draft.trim()
                              ? "linear-gradient(135deg, #F59E0B, #D97706)"
                              : "rgba(0,0,0,0.08)",
                            color: draft.trim() ? "#fff" : "#9CA3AF",
                            fontSize: 12, fontWeight: 900,
                            cursor: draft.trim() ? "pointer" : "default",
                            fontFamily: "inherit",
                          }}
                        >등록</button>
                        <button
                          onClick={() => { setDraftFor(null); setDraft(""); setWarn(null); }}
                          aria-label="닫기"
                          style={{
                            minWidth: 32, borderRadius: 9, border: "1px solid rgba(0,0,0,0.1)",
                            background: "#fff", color: "#9CA3AF", fontSize: 12, fontWeight: 900,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >✕</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setDraftFor(a.id); setDraft(""); setWarn(null); }}
                      style={{
                        alignSelf: "flex-start",
                        padding: "4px 11px", borderRadius: 999,
                        background: "rgba(255,255,255,0.8)", border: "1.5px dashed #F59E0B",
                        color: "#B45309", fontSize: 11, fontWeight: 900,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >💬 댓글 달기{comments.length > 0 ? ` (${comments.length})` : ""}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 그림 클릭 확대 */}
      <ImageLightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />
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

  // 설계서 항목 3: 교사 허용 시 복습(during) 중 캐릭터 챗봇 사용.
  // 오버레이 안에서 캐릭터 선택 → 챗 → ← 로 다른 캐릭터 재선택 (항목 4 공유).
  const [reviewChatOpen, setReviewChatOpen] = useState(false);
  const [reviewCharId, setReviewCharId] = useState<string | null>(null);
  const reviewChar = reviewCharId
    ? book.characters.find((c) => c.id === reviewCharId) ?? null
    : null;

  // ── [항목 7] 자동 읽기: 교사 기기가 한국어 더빙으로 낭독하며 페이지를 넘긴다.
  // 학생 기기는 기존 setPage 구독으로 함께 넘어간다 (교실 스피커 = 교사 기기).
  const [autoReading, setAutoReadingLocal] = useState(false);
  const autoAbortRef = useRef(false);

  async function startAutoRead() {
    if (autoReading) return;
    autoAbortRef.current = false;
    setAutoReadingLocal(true);
    setAutoReading(roomCode, true).catch(() => {});
    try {
      for (let i = pageIdx; i <= book.pages.length; i++) {
        if (autoAbortRef.current) break;
        await setPage(roomCode, i);
        const p = book.pages.find((pp) => pp.idx === i);
        const text = p?.text?.ko || "";
        if (text) await speakText(text, "ko");       // 완주 대기 (Task 10 Step 1)
        if (autoAbortRef.current) break;
        await new Promise((r) => setTimeout(r, 1500)); // 페이지 사이 숨 고르기
      }
    } finally {
      setAutoReadingLocal(false);
      setAutoReading(roomCode, false).catch(() => {});
    }
  }

  function stopAutoRead() {
    autoAbortRef.current = true;
    cancelSpeak();
    setAutoReadingLocal(false);
    setAutoReading(roomCode, false).catch(() => {});
  }

  // 언마운트/phase 이탈 시 정리
  useEffect(() => () => { autoAbortRef.current = true; cancelSpeak(); }, []);

  if (!page) {
    return <div>Page {pageIdx} not found</div>;
  }

  return (
    <>
      <PageCard lang={lang} page={page} total={book.pages.length} autoReading={!isTeacher && !!session.autoReading} />

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
          allowReviewChat={!!session.allowReviewChat}
          onGotoAfter={() => setPhase(roomCode, "after")}
          autoReading={autoReading}
          onStartAutoRead={startAutoRead}
          onStopAutoRead={stopAutoRead}
        />
      )}

      {/* ── 학생: 복습 중 캐릭터에게 물어보기 (교사 허용 시에만) ── */}
      {!isTeacher && session.allowReviewChat && book.characters.length > 0 && (
        <button
          onClick={() => setReviewChatOpen(true)}
          style={{
            width: "100%", minHeight: 52, marginBottom: 14,
            background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
            color: "#fff", fontSize: 15, fontWeight: 900,
            border: "none", borderRadius: 16, cursor: "pointer",
            boxShadow: "0 6px 18px rgba(245,158,11,0.35)",
            letterSpacing: -0.2, fontFamily: "inherit",
          }}
        >🐝 {t("sbChooseCharacter", lang)} — 궁금한 걸 물어봐!</button>
      )}

      {!isTeacher && reviewChatOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setReviewChatOpen(false); setReviewCharId(null); } }}
          style={{
            position: "fixed", inset: 0, zIndex: 600,
            background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 14, animation: "fadeIn 0.2s",
          }}
        >
          <div style={{ width: "min(680px, 100%)", maxHeight: "92vh", overflowY: "auto", position: "relative" }}>
            <button
              onClick={() => { setReviewChatOpen(false); setReviewCharId(null); }}
              aria-label="닫기"
              style={{
                position: "sticky", top: 0, left: "100%", zIndex: 2,
                width: 38, height: 38, borderRadius: 12, marginBottom: 6,
                background: "#fff", border: "2px solid #FDE68A",
                fontSize: 15, fontWeight: 900, color: "#92400E", cursor: "pointer",
                display: "block",
              }}
            >✕</button>
            {reviewChar ? (
              <CharacterChat
                lang={lang}
                roomCode={roomCode}
                myClientId={myClientId}
                user={user}
                book={book}
                character={reviewChar}
                onBack={() => setReviewCharId(null)}
              />
            ) : (
              <CharacterPicker
                lang={lang}
                book={book}
                onPick={(id) => setReviewCharId(id)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PageCard({
  lang, page, total, autoReading,
}: {
  lang: string;
  page: StorybookPage;
  total: number;
  autoReading?: boolean;
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
        {autoReading && (
          <div style={{
            position: "absolute", top: 14, left: 16,
            fontSize: 12, fontWeight: 900, color: "#1D4ED8",
            background: "#DBEAFE", padding: "5px 12px", borderRadius: 999,
            border: "1.5px solid #93C5FD", animation: "pulse 1.2s ease-in-out infinite",
          }}>🔊 선생님이 읽어주는 중</div>
        )}
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

// [#6] 교사 라이브 모니터링 갤러리 — 현재 질문에 대해 학생들이 그리는 중인 그림을
//   화이트보드 갤러리와 같은 방식(썸네일 그리드 + 확대 + 제출 배지)으로 실시간 표시.
function TeacherDrawMonitor({ roomCode, questionId }: { roomCode: string; questionId: string }) {
  const [boards, setBoards] = useState<StorybookLiveBoard[]>([]);
  const [enlarged, setEnlarged] = useState<StorybookLiveBoard | null>(null);

  useEffect(() => {
    const unsub = subscribeStorybookBoards(roomCode, questionId, setBoards);
    return () => unsub();
  }, [roomCode, questionId]);

  useBackLayer(enlarged !== null, () => setEnlarged(null));

  if (boards.length === 0) return null;

  const submitted = boards.filter((b) => b.submitted).length;

  return (
    <div style={{
      background: "#fff", borderRadius: 16, border: "2px solid #DBEAFE",
      boxShadow: "0 6px 18px rgba(59,130,246,0.12)", padding: "12px 14px", marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: "#1E40AF" }}>
          🖍 실시간 그림 모니터링
        </span>
        <span style={{
          fontSize: 11, fontWeight: 800, color: "#1E40AF",
          background: "#DBEAFE", padding: "2px 10px", borderRadius: 999,
        }}>그리는 중 {boards.length} · 제출 {submitted}</span>
      </div>
      <div style={{
        display: "grid", gap: 10,
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
      }}>
        {boards.map((b) => (
          <button
            key={b.clientId}
            onClick={() => setEnlarged(b)}
            style={{
              background: "#fff", border: `2px solid ${b.submitted ? "#10B981" : "#DBEAFE"}`,
              borderRadius: 12, padding: 6, cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{ position: "relative" }}>
              <img
                src={b.dataUrl}
                alt={`${b.studentName} 그림`}
                style={{ width: "100%", borderRadius: 8, display: "block", background: "#fff", aspectRatio: "3 / 2", objectFit: "cover" }}
              />
              {b.submitted && (
                <span style={{
                  position: "absolute", top: 4, right: 4,
                  fontSize: 10, fontWeight: 900, color: "#fff", background: "#10B981",
                  padding: "2px 7px", borderRadius: 999,
                }}>✓ 제출</span>
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#1F2937", marginTop: 5, paddingLeft: 2 }}>
              {b.studentName}
            </div>
          </button>
        ))}
      </div>

      {enlarged && (
        <div
          onClick={() => setEnlarged(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 450,
            background: "rgba(9,7,30,0.8)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 22, padding: 16, maxWidth: 760, width: "100%",
            boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1, fontSize: 16, fontWeight: 900, color: "#1F2937" }}>
                🖍 {enlarged.studentName}{enlarged.submitted ? " · ✓ 제출" : " · 그리는 중"}
              </div>
              <button
                onClick={() => setEnlarged(null)}
                aria-label="close"
                style={{
                  width: 36, height: 36, borderRadius: 10, border: "2px solid #DBEAFE",
                  background: "#fff", color: "#1E40AF", fontSize: 16, fontWeight: 900, cursor: "pointer",
                }}
              >✕</button>
            </div>
            <img src={enlarged.dataUrl} alt={`${enlarged.studentName} 그림`} style={{ width: "100%", borderRadius: 12, background: "#fff" }} />
          </div>
        </div>
      )}
    </div>
  );
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
  // [#6] 그림이 주인공 — 기본 모드는 그리기.
  const [inputMode, setInputMode] = useState<QInputMode>("draw");
  const [speaking, setSpeaking] = useState(false);
  const [selectedFruit, setSelectedFruit] = useState<number | null>(null);
  // Translation cache for responses: key = `${responseId}:${toLang}`
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  // Tutorial-style entrance for students
  const [showIntro, setShowIntro] = useState(false);
  const [introTyped, setIntroTyped] = useState(0);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // [#6] 공용 DrawBoard — 제출 시 ref.getDataUrl(), 그리는 중 onChange 로 라이브 스트리밍.
  const drawRef = useRef<DrawBoardHandle>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const ttsPlayedRef = useRef<string>("");

  // Reset when question changes — trigger tutorial intro for students
  useEffect(() => {
    setDraft(""); setSaved(false); setSelectedFruit(null); setHasDrawn(false);
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

  // 친구 그림 응답 클릭 확대 (fruit 모달)
  const [fruitZoom, setFruitZoom] = useState<string | null>(null);

  // ── 응답 댓글: 복습 중 의견 추가 (설계서 항목 1) ──
  // 영속 경로(bookAnswers) 하위에 저장 — 세션이 끝나도 자유 읽기(복습)에서 유지.
  const bookIdForComments = book?.id ?? null;
  const [fruitComments, setFruitComments] = useState<StorybookResponseComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentWarn, setCommentWarn] = useState<string | null>(null);
  const selectedRespId = selectedFruit !== null ? responses[selectedFruit]?.id ?? null : null;

  // 선택된 응답 1개의 댓글만 구독 (전체 트리 구독 금지)
  useEffect(() => {
    setFruitComments([]);
    setCommentDraft("");
    setCommentWarn(null);
    if (!selectedRespId || !bookIdForComments) return;
    const unsub = subscribeResponseComments(roomCode, bookIdForComments, q.id, selectedRespId, setFruitComments);
    return () => unsub();
  }, [roomCode, bookIdForComments, q.id, selectedRespId]);

  // 댓글도 원문+번역 2줄 규칙 (항목 5) — 도착 시 자동 번역
  useEffect(() => {
    for (const c of fruitComments) {
      if (c.studentLang && c.studentLang !== lang) {
        ensureTranslation({ id: c.id, text: c.text, studentLang: c.studentLang } as StorybookResponse);
      }
    }
  }, [fruitComments, lang, ensureTranslation]);

  function handleAddComment() {
    const text = commentDraft.trim();
    if (!text || !selectedRespId || !bookIdForComments) return;
    // 클라이언트 사전 안전검사 (챗과 동일 레이어)
    const pre = checkSafety(text);
    if (pre.distress) {
      setCommentWarn(replyForSafety(lang, "distress"));
      raiseAlert(roomCode, {
        clientId: myClientId, studentName: user.myName,
        timestamp: Date.now(), kind: "distress",
      }).catch(() => {});
      setCommentDraft("");
      return;
    }
    if (pre.blocked) {
      setCommentWarn(replyForSafety(lang, "warning"));
      return;
    }
    setCommentWarn(null);
    // 낙관적 쓰기 — 로컬 에코가 즉시 목록에 반영된다
    appendResponseComment(roomCode, bookIdForComments, q.id, selectedRespId, {
      clientId: myClientId,
      studentName: user.myName,
      studentLang: user.myLang,
      text,
      timestamp: Date.now(),
    }).catch((err) => console.error("comment write failed", err));
    setCommentDraft("");
  }

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

  // dataURL → Blob (그림 업로드용)
  function dataUrlToBlob(dataUrl: string): Blob {
    const [header, data] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    const bin = atob(data);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function handleSubmit() {
    if (busy) return;
    // [#6] 그림 모드: 캔버스를 이미지로 업로드 후 그림 응답으로 제출.
    if (inputMode === "draw") {
      const dataUrl = drawRef.current?.getDataUrl(0.8);
      if (!dataUrl) return;
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", dataUrlToBlob(dataUrl), `draw_${Date.now()}.jpg`);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json() as { url?: string };
        const imageUrl = data.url || dataUrl; // 업로드 실패 시 dataURL 폴백
        await submitResponse(
          roomCode, q.id, myClientId, user.myName, user.myLang,
          draft.trim(), book?.id, { kind: "drawing", imageUrl },
        );
        setSaved(true);
      } catch (err) { console.error("drawing submit failed", err); }
      setBusy(false);
      return;
    }
    // 글/말 모드
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await submitResponse(roomCode, q.id, myClientId, user.myName, user.myLang, draft, book?.id, { kind: "text" });
      setSaved(true);
    } catch (err) { console.error("submitResponse failed", err); }
    setBusy(false);
  }

  // 그리는 중 라이브 스냅샷 → 교사 모니터링 (디바운스는 DrawBoard 내부에서).
  function handleDrawChange(dataUrl: string) {
    setHasDrawn(true);
    pushStorybookBoard(roomCode, q.id, myClientId, user.myName, dataUrl).catch(() => {});
  }

  // [#4] 음성 입력은 앱 공용 STT 엔진(MicButton)로 통일 — 인식 결과를 draft 에 이어붙인다.

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
              { id: "draw" as QInputMode, icon: "🖍", label: "그림" },
              { id: "text" as QInputMode, icon: "✏️", label: "글자" },
              { id: "voice" as QInputMode, icon: "🎤", label: "말" },
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
              {/* 화이트보드와 동일한 공용 멀티툴 그림판. 그리는 동안 교사가 실시간으로 본다.
                  질문이 바뀌면 key 로 새 캔버스로 리셋. */}
              <DrawBoard key={q.id} ref={drawRef} width={720} height={480} accent="#3B82F6" onChange={handleDrawChange} />
              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "#3B82F6" }}>
                🐝 그리는 동안 선생님이 실시간으로 보고 있어요
              </div>
              {/* 그림에 곁들일 한 줄 설명(선택) */}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="한 줄 설명을 더해도 좋아요 (선택)"
                disabled={busy}
                style={{
                  width: "100%", marginTop: 8, padding: "9px 12px", borderRadius: 12,
                  border: "2px solid #DBEAFE", fontSize: 14, fontFamily: "inherit",
                  outline: "none", background: "#FAFAFA", color: "#1F2937", boxSizing: "border-box",
                }}
              />
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

          {draft && inputMode === "voice" && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#F0F9FF", borderRadius: 10, fontSize: 13, color: "#1E40AF", fontWeight: 600 }}>
              입력: &ldquo;{draft}&rdquo;
            </div>
          )}
          {inputMode !== "emotion" && (() => {
            // 그림 모드는 그림을 그렸으면 제출 가능, 그 외엔 텍스트가 있어야 한다.
            const canSubmit = inputMode === "draw" ? hasDrawn : !!draft.trim();
            return (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={handleSubmit} disabled={busy || !canSubmit} style={{
                minHeight: 56, padding: "10px 24px",
                background: !canSubmit ? "#E5E7EB" : "linear-gradient(135deg, #3B82F6, #2563EB)",
                color: !canSubmit ? "#9CA3AF" : "#fff",
                fontSize: 15, fontWeight: 900, border: "none", borderRadius: 14,
                cursor: !canSubmit || busy ? "not-allowed" : "pointer",
                boxShadow: !canSubmit ? "none" : "0 6px 16px rgba(59,130,246,0.3)",
                transition: "all 0.2s",
              }}>{busy ? "제출 중..." : inputMode === "draw" ? "🖍 그림 제출하기" : "📨 포스트잇 붙이기"}</button>
            </div>
            );
          })()}
        </div>
      )}

      {!isTeacher && saved && (
        <div style={{ padding: "12px 16px", background: "#ECFDF5", borderRadius: 14, border: "1px solid #A7F3D0", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#065F46" }}>{t("sbAnswerSaved", lang)}</span>
        </div>
      )}

      {/* [#6] 교사 라이브 모니터링 — 학생들이 그리는 중인 그림을 실시간으로 본다. */}
      {isTeacher && <TeacherDrawMonitor roomCode={roomCode} questionId={q.id} />}

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
          {/* 원문 + 뷰어 언어 번역을 항상 2줄로 표시 (설계서 항목 5 — 토글 제거) */}
          {selectedFruit !== null && responses[selectedFruit] && (() => {
            const r = responses[selectedFruit];
            const key = `${r.id}:${lang}`;
            const needsTranslation = !!r.studentLang && r.studentLang !== lang;
            const translated = translations[key];
            const isTranslating = !!translating[key];
            // 메인 표시는 뷰어 언어(번역 도착 시), 아래에 원문을 항상 함께 표시
            const displayText = needsTranslation && translated ? translated : r.text;

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

                  {/* 그림 응답 — 클릭하면 크게 보기 */}
                  {r.imageUrl && (
                    <img
                      src={r.imageUrl}
                      alt={`${r.studentName}의 그림`}
                      onClick={() => setFruitZoom(r.imageUrl!)}
                      title="크게 보기"
                      style={{
                        width: "100%", maxHeight: 300, objectFit: "contain",
                        background: "#fff", borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.1)",
                        display: "block", cursor: "zoom-in",
                        marginBottom: displayText ? 8 : 0,
                      }}
                    />
                  )}
                  {displayText && (
                    <div style={{
                      fontSize: 16, fontWeight: 600, color: "#1F2937",
                      lineHeight: 1.6, whiteSpace: "pre-wrap",
                    }}>
                      {displayText}
                    </div>
                  )}

                  {/* 원문 — 번역이 메인일 때 항상 함께 표시 (숨김 없음, 항목 5) */}
                  {needsTranslation && translated && (
                    <div style={{
                      marginTop: 10, padding: "8px 12px",
                      background: "rgba(255,255,255,0.55)",
                      borderRadius: 10,
                      borderLeft: "3px solid rgba(245,158,11,0.5)",
                      fontSize: 13, fontWeight: 500, color: "#4B5563",
                      lineHeight: 1.5, whiteSpace: "pre-wrap",
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#92400E", marginBottom: 3, letterSpacing: 0.3 }}>
                        📜 원문 · {(r.studentLang || "").toUpperCase()}
                      </div>
                      {r.text}
                    </div>
                  )}

                  {/* 번역이 아직 준비 안 됨 — 원문이 메인으로 표시 중임을 안내 */}
                  {needsTranslation && !translated && (
                    <div style={{
                      marginTop: 10, fontSize: 11, fontWeight: 700, color: "#92400E",
                    }}>
                      {isTranslating ? "⟳ 내 언어로 번역 준비 중…" : "🌐 번역을 불러오지 못했어요 — 원문으로 표시 중"}
                    </div>
                  )}

                  {/* ── 💬 친구들의 생각: 복습 중 의견 추가 (설계서 항목 1) ── */}
                  <div style={{
                    marginTop: 12, borderTop: "1.5px dashed rgba(180,83,9,0.25)", paddingTop: 10,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#92400E", marginBottom: 6 }}>
                      💬 친구들의 생각 ({fruitComments.length})
                    </div>
                    {fruitComments.length > 0 && (
                      <div style={{
                        display: "flex", flexDirection: "column", gap: 6,
                        maxHeight: 180, overflowY: "auto", marginBottom: 8,
                      }}>
                        {fruitComments.map((c) => {
                          const ckey = `${c.id}:${lang}`;
                          const cTranslated = c.studentLang && c.studentLang !== lang ? translations[ckey] : null;
                          return (
                            <div key={c.id} style={{
                              background: "rgba(255,255,255,0.65)", borderRadius: 10, padding: "7px 10px",
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 900, color: "#6B7280", marginBottom: 2 }}>
                                {c.studentName}{c.clientId === myClientId ? " (나)" : ""}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                                {c.text}
                              </div>
                              {/* 원문+번역 2줄 규칙 (항목 5) */}
                              {cTranslated && cTranslated !== c.text && (
                                <div style={{
                                  fontSize: 12, fontWeight: 600, color: "#4B5563", marginTop: 3,
                                  paddingTop: 3, borderTop: "1px dashed rgba(0,0,0,0.1)",
                                }}>
                                  🌐 {cTranslated}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {commentWarn && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#B91C1C", marginBottom: 6, lineHeight: 1.4 }}>
                        ⚠ {commentWarn}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }}
                        placeholder="내 생각을 덧붙여요…"
                        maxLength={150}
                        style={{
                          flex: 1, minHeight: 38, padding: "6px 10px", borderRadius: 10,
                          border: "1.5px solid rgba(245,158,11,0.4)", fontSize: 13, fontWeight: 600,
                          color: "#1F2937", background: "rgba(255,255,255,0.8)",
                          outline: "none", fontFamily: "inherit",
                        }}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!commentDraft.trim()}
                        style={{
                          minWidth: 54, borderRadius: 10, border: "none",
                          background: commentDraft.trim()
                            ? "linear-gradient(135deg, #F59E0B, #D97706)"
                            : "rgba(0,0,0,0.08)",
                          color: commentDraft.trim() ? "#fff" : "#9CA3AF",
                          fontSize: 13, fontWeight: 900,
                          cursor: commentDraft.trim() ? "pointer" : "default",
                          fontFamily: "inherit",
                        }}
                      >등록</button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
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

      {/* 그림 응답 클릭 확대 */}
      <ImageLightbox src={fruitZoom} onClose={() => setFruitZoom(null)} />

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
  lang, roomCode, pageIdx, totalPages, questions, activeQuestionId, allowReviewChat, onGotoAfter,
  autoReading, onStartAutoRead, onStopAutoRead,
}: {
  lang: string;
  roomCode: string;
  pageIdx: number;
  totalPages: number;
  questions: StorybookQuestion[];
  activeQuestionId: string | null;
  /** 복습 중 캐릭터 챗봇 허용 여부 (설계서 항목 3, 기본 OFF) */
  allowReviewChat: boolean;
  onGotoAfter: () => void;
  autoReading: boolean;
  onStartAutoRead: () => void;
  onStopAutoRead: () => void;
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
      <button
        onClick={autoReading ? onStopAutoRead : onStartAutoRead}
        style={{
          width: "100%", minHeight: 52, marginBottom: 10,
          background: autoReading
            ? "linear-gradient(135deg, #EF4444, #DC2626)"
            : "linear-gradient(135deg, #3B82F6, #2563EB)",
          color: "#fff", border: "none", borderRadius: 14,
          fontSize: 15, fontWeight: 900, cursor: "pointer",
          boxShadow: "0 4px 12px rgba(59,130,246,0.3)", fontFamily: "inherit",
        }}
      >{autoReading ? "⏹ 자동 읽기 멈추기" : "▶️ 자동 읽기 — 끝까지 읽어주며 넘겨요"}</button>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setPage(roomCode, Math.max(1, pageIdx - 1))}
          disabled={prevDisabled || autoReading}
          style={{
            flex: 1, minHeight: 48,
            background: (prevDisabled || autoReading) ? "#F3F4F6" : "#fff",
            color: (prevDisabled || autoReading) ? "#9CA3AF" : "#92400E",
            border: `2px solid ${(prevDisabled || autoReading) ? "#E5E7EB" : "#FDE68A"}`,
            borderRadius: 14, fontSize: 14, fontWeight: 900,
            cursor: (prevDisabled || autoReading) ? "not-allowed" : "pointer",
          }}
        >{t("sbPrevPage", lang)}</button>
        {!isLast && (
          <button
            onClick={() => setPage(roomCode, pageIdx + 1)}
            disabled={autoReading}
            style={{
              flex: 1, minHeight: 48,
              background: autoReading ? "#F3F4F6" : "linear-gradient(135deg, #F59E0B, #D97706)",
              color: autoReading ? "#9CA3AF" : "#fff", border: "none",
              borderRadius: 14, fontSize: 14, fontWeight: 900,
              cursor: autoReading ? "not-allowed" : "pointer",
              boxShadow: autoReading ? "none" : "0 4px 12px rgba(245,158,11,0.3)",
            }}
          >{t("sbNextPage", lang)}</button>
        )}
        {isLast && (
          <button
            onClick={onGotoAfter}
            disabled={autoReading}
            style={{
              flex: 1, minHeight: 48,
              background: autoReading ? "#F3F4F6" : "linear-gradient(135deg, #10B981, #059669)",
              color: autoReading ? "#9CA3AF" : "#fff", border: "none",
              borderRadius: 14, fontSize: 14, fontWeight: 900,
              cursor: autoReading ? "not-allowed" : "pointer",
              boxShadow: autoReading ? "none" : "0 4px 12px rgba(16,185,129,0.3)",
            }}
          >{t("sbPhaseNextAfter", lang)}</button>
        )}
      </div>

      {/* ── 복습 중 챗봇 허용 토글 (설계서 항목 3, 기본 OFF) ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px", marginBottom: 12,
        background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#92400E" }}>
            🐝 복습 중 캐릭터 챗봇 허용
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#B45309", opacity: 0.8, marginTop: 2 }}>
            켜면 학생이 읽는 중에도 등장인물에게 질문할 수 있어요
          </div>
        </div>
        <button
          onClick={() => setAllowReviewChat(roomCode, !allowReviewChat).catch((err) => console.error("setAllowReviewChat failed", err))}
          role="switch"
          aria-checked={allowReviewChat}
          aria-label="복습 중 캐릭터 챗봇 허용"
          style={{
            width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
            background: allowReviewChat ? "#F59E0B" : "#E5E7EB",
            position: "relative", transition: "background 0.2s", flexShrink: 0,
          }}
        >
          <div style={{
            position: "absolute", top: 3, left: allowReviewChat ? 25 : 3,
            width: 20, height: 20, borderRadius: "50%", background: "#fff",
            transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </button>
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
  // Per-client local pick. session.activeCharacterId is reserved for a future
  // teacher-led "featured character" flow — students must not write it.
  const [myCharId, setMyCharId] = useState<string | null>(null);
  const findChar = (id: string | null | undefined) =>
    id ? book.characters.find((c) => c.id === id) ?? null : null;
  // 교사: 공유 featured(향후 교사 주도용). 학생: 오직 본인 로컬 선택 — 공유 필드를 무시해
  // 한 명의 선택이 전원에게 적용되던 버그 + 구버전이 남긴 stale 공유값 재발을 차단.
  const activeChar = isTeacher ? findChar(session.activeCharacterId) : findChar(myCharId);

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
        onPick={(id) => {
          setMyCharId(id);
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
      onBack={() => setMyCharId(null)}
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
  lang, roomCode, myClientId, user, book, character, onBack,
}: {
  lang: string;
  roomCode: string;
  myClientId: string;
  user: UserConfig;
  book: Storybook;
  character: StorybookCharacter;
  /** 캐릭터 선택 화면으로 복귀 — 다른 챗봇과 대화 가능 (설계서 항목 4) */
  onBack?: () => void;
}) {
  const [turns, setTurns] = useState<StorybookChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [showLangExpand, setShowLangExpand] = useState(false);

  // 캐릭터별 분리된 로그 구독 — 캐릭터 전환 시 자동 재구독
  useEffect(() => {
    setTurns([]);
    const unsub = subscribeChat(roomCode, myClientId, character.id, setTurns);
    return () => unsub();
  }, [roomCode, myClientId, character.id]);

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
      await appendChatTurn(roomCode, myClientId, character.id, {
        from: "student", text, timestamp: Date.now(), flagged: true,
      });
      await appendChatTurn(roomCode, myClientId, character.id, {
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

      await appendChatTurn(roomCode, myClientId, character.id, {
        from: "student", text, timestamp: Date.now(), flagged: true,
      });
      await appendChatTurn(roomCode, myClientId, character.id, {
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
    appendChatTurn(roomCode, myClientId, character.id, {
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
      appendChatTurn(roomCode, myClientId, character.id, {
        from: "character", text: data.reply || replyForSafety(lang, "block"),
        timestamp: Date.now(),
        flagged: data.kind !== "normal",
      }).catch((err) => console.error("character turn write failed", err));
    } catch (err) {
      console.error("chat request failed", err);
      appendChatTurn(roomCode, myClientId, character.id, {
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
        {onBack && (
          <button
            onClick={onBack}
            aria-label="다른 캐릭터 고르기"
            title="다른 캐릭터와 대화하기"
            style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: "#fff", border: "2px solid #F59E0B",
              fontSize: 16, fontWeight: 900, color: "#92400E", cursor: "pointer",
            }}
          >←</button>
        )}
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
    await appendChatTurn(roomCode, myClientId, character.id, {
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

"use client";

import { useState, useEffect, useRef } from "react";
import { ref, onValue, off, push, set, remove } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { CardData, CommentData } from "@/lib/types";
import { LANGUAGES, CARD_PALETTES } from "@/lib/constants";
import { t } from "@/lib/i18n";

const TTS_LANG_MAP: Record<string, string> = {
  ko: "ko-KR", en: "en-US", vi: "vi-VN", zh: "zh-CN", fil: "fil-PH",
  ja: "ja-JP", th: "th-TH", km: "km-KH", mn: "mn-MN", ru: "ru-RU",
  uz: "uz-UZ", hi: "hi-IN", id: "id-ID", ar: "ar-SA", my: "my-MM",
};

// Languages that Web Speech API reliably supports across browsers
const WEB_SPEECH_SUPPORTED = new Set(["ko", "en", "vi", "zh", "ja", "th", "ru", "hi", "id", "ar"]);

const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Singleton audio element to avoid overlapping playback
let serverTtsAudio: HTMLAudioElement | null = null;

async function speakText(text: string, lang: string) {
  if (typeof window === "undefined") return;

  const bcp47 = TTS_LANG_MAP[lang] || "en-US";

  // Check if browser has a matching voice loaded
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const langPrefix = bcp47.split("-")[0];
  const hasVoice = voices.some((v) => v.lang.startsWith(langPrefix));

  if (WEB_SPEECH_SUPPORTED.has(lang) && hasVoice) {
    // Use Web Speech API
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp47;
    window.speechSynthesis.speak(u);
  } else {
    // Fall back to server-side Google Translate TTS proxy
    try {
      window.speechSynthesis?.cancel();
      if (serverTtsAudio) { serverTtsAudio.pause(); serverTtsAudio = null; }
      const url = `/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text.slice(0, 200))}`;
      const audio = new Audio(url);
      serverTtsAudio = audio;
      await audio.play();
    } catch {
      // silent fail — network error or browser blocked autoplay
    }
  }
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  return `${Math.floor(s / 3600)}시간 전`;
}

function TranslationRow({ lang, text, accent }: { lang: string; text: string; accent: string }) {
  return (
    <div style={{
      position: "relative",
      background: accent + "14",
      borderLeft: "4px solid " + accent,
      padding: "10px 14px",
      borderRadius: "0 10px 10px 0",
      marginTop: 8,
    }}>
      <span style={{ fontSize: 12, display: "block", marginBottom: 4, color: accent, fontWeight: 800 }}>
        {LANGUAGES[lang]?.flag} {LANGUAGES[lang]?.label}
      </span>
      <span style={{ fontSize: 15, color: "#374151", lineHeight: 1.65, fontWeight: 500 }}>{text}</span>
      <button
        onClick={() => speakText(text, lang)}
        title="읽어주기"
        aria-label={`${LANGUAGES[lang]?.label} 읽어주기`}
        style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(255,255,255,0.8)", border: `1.5px solid ${accent}44`, cursor: "pointer",
          fontSize: 13, color: accent, padding: "4px 8px",
          transition: "all 0.15s", lineHeight: 1, borderRadius: 10, fontWeight: 700,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.8)"; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >🔊</button>
    </div>
  );
}

interface Props {
  card: CardData;
  viewerLang: string;
  colColor: string;
  isTeacher?: boolean;
  myClientId?: string;
  authorName?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  isPending?: boolean;
  roomCode: string;
  roomLangs: string[];
  approvalMode?: boolean;
}

export default function PadletCard({
  card,
  viewerLang,
  colColor,
  isTeacher,
  myClientId,
  authorName,
  onEdit,
  onDelete,
  isPending,
  roomCode,
  roomLangs,
  approvalMode,
}: Props) {
  const p = CARD_PALETTES[card.paletteIdx % CARD_PALETTES.length];
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const cardType = card.cardType || "text";

  // Comment state
  const [commentsOpen, setCommentsOpen] = useState(false);
  // Local like state (세션 동안만; Firebase 저장은 추후 과제)
  const [likedLocal, setLikedLocal] = useState(false);
  const [likeBump, setLikeBump] = useState(0);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const commentDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tick to update edit window expiry
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Comment listener (only when open)
  useEffect(() => {
    if (!commentsOpen) return;
    const db = getClientDb();
    const commentsRef = ref(db, `rooms/${roomCode}/cards/${card.id}/comments`);
    const unsub = onValue(commentsRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setComments([]);
        setCommentCount(0);
        return;
      }
      const list: CommentData[] = Object.values(data) as CommentData[];
      list.sort((a, b) => a.timestamp - b.timestamp);
      // Filter pending for non-teachers
      const visible = isTeacher ? list : list.filter((c) => !c.status || c.status === "approved");
      setComments(visible);
      setCommentCount(list.filter((c) => !c.status || c.status === "approved").length);
    });
    return () => {
      off(commentsRef);
      // unsub is already handled by off, but keep reference to satisfy lint
      void unsub;
    };
  }, [commentsOpen, roomCode, card.id, isTeacher]);

  // Draft restore on open
  useEffect(() => {
    if (commentsOpen) {
      const key = `draft:comment:${roomCode}:${card.id}`;
      const saved = localStorage.getItem(key);
      if (saved) setCommentInput(saved);
    }
  }, [commentsOpen, roomCode, card.id]);

  const isMyCard = !!myClientId && card.authorClientId === myClientId;
  const withinEditWindow = now - card.timestamp < EDIT_WINDOW_MS;
  const canEdit = (isTeacher || (isMyCard && withinEditWindow)) && !!onEdit;
  const canDelete = isTeacher || (isMyCard && withinEditWindow);

  const otherLangs = Object.keys(card.translations || {}).filter(
    (l) => l !== card.authorLang && l !== viewerLang
  );

  const pendingBorderStyle = isPending
    ? { border: "2px solid #F59E0B", background: "#FFFBEB" }
    : {};

  async function submitComment() {
    if (!commentInput.trim() || submittingComment) return;
    setSubmittingComment(true);
    setCommentError(null);
    const text = commentInput.trim();
    try {
      const targetLangs = roomLangs.filter((l) => l !== viewerLang);
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          fromLang: viewerLang,
          targetLangs,
          colId: "comment",
          authorName: authorName || "?",
          isTeacher: isTeacher ?? false,
          paletteIdx: 0,
          roomCode,
          cardType: "comment",
        }),
      });
      if (!res.ok) throw new Error("번역 실패");
      const data = await res.json();
      const translations: Record<string, string> = data.translations || { [viewerLang]: text };

      const db = getClientDb();
      const commentRef = push(ref(db, `rooms/${roomCode}/cards/${card.id}/comments`));
      const commentId = commentRef.key!;
      const comment: CommentData = {
        id: commentId,
        authorName: authorName || "?",
        authorLang: viewerLang,
        authorClientId: myClientId || "",
        isTeacher: isTeacher ?? false,
        text,
        translations,
        timestamp: Date.now(),
        ...(approvalMode && !isTeacher ? { status: "pending" as const } : {}),
        flagged: data.safe === false,
      };
      await set(commentRef, comment);
      setCommentInput("");
      localStorage.removeItem(`draft:comment:${roomCode}:${card.id}`);
    } catch {
      setCommentError(t("commentFailed", viewerLang));
    }
    setSubmittingComment(false);
  }

  function deleteComment(commentId: string, comment: CommentData) {
    const canDelete =
      isTeacher ||
      (myClientId &&
        comment.authorClientId === myClientId &&
        Date.now() - comment.timestamp < 5 * 60 * 1000);
    if (!canDelete) return;
    const db = getClientDb();
    remove(ref(db, `rooms/${roomCode}/cards/${card.id}/comments/${commentId}`));
  }

  function approveComment(commentId: string) {
    const db = getClientDb();
    set(ref(db, `rooms/${roomCode}/cards/${card.id}/comments/${commentId}/status`), "approved");
  }

  return (
    <div
      style={{
        background: isPending ? "#FFFBEB" : p.bg,
        borderRadius: 18,
        border: isPending ? "2px solid #F59E0B" : "1px solid " + p.accent + "22",
        borderLeft: isPending ? "5px solid #F59E0B" : `5px solid ${p.accent}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)",
        marginBottom: 12,
        transition: "box-shadow 0.2s, transform 0.2s",
        overflow: "hidden",
        ...pendingBorderStyle,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 28px rgba(180,83,9,0.12), 0 4px 8px rgba(0,0,0,0.04)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.03)";
        (e.currentTarget as HTMLDivElement).style.transform = "none";
      }}
    >
      <div style={{ padding: "14px 16px 12px" }}>
        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 14, flexShrink: 0,
            background: `linear-gradient(135deg, ${p.accent}, ${p.accent}aa)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: card.isTeacher ? 18 : 16, fontWeight: 900, color: "#fff",
            boxShadow: `0 4px 10px ${p.accent}44`,
          }}>
            {card.isTeacher ? "👩‍🏫" : card.authorName.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "#1F2937" }}>
                {card.authorName}
              </span>
              {card.isTeacher && (
                <span style={{
                  fontSize: 11, background: p.accent, color: "#fff",
                  borderRadius: 999, padding: "2px 8px", fontWeight: 700,
                  height: 20, display: "inline-flex", alignItems: "center",
                }}>{t("teacherTag", viewerLang)}</span>
              )}
              {cardType !== "text" && (
                <span style={{
                  fontSize: 11, background: "#F3F4F6", color: "#6B7280",
                  borderRadius: 999, padding: "2px 8px",
                  height: 20, display: "inline-flex", alignItems: "center",
                }}>
                  {cardType === "image" ? "🖼️ 사진" : cardType === "youtube" ? "📺 YouTube" : t("drawBadge", viewerLang)}
                </span>
              )}
              {card.flagged && (
                <span style={{
                  fontSize: 11, background: "#FEF2F2", color: "#DC2626",
                  borderRadius: 999, padding: "2px 8px", border: "1px solid #FECACA",
                  height: 20, display: "inline-flex", alignItems: "center",
                }}>⚠️ 검토</span>
              )}
              {isPending && (
                <span style={{
                  fontSize: 11, background: "#FEF3C7", color: "#D97706",
                  borderRadius: 999, padding: "2px 8px", border: "1px solid #FDE68A",
                  fontWeight: 700,
                  height: 20, display: "inline-flex", alignItems: "center",
                }}>대기 중</span>
              )}
              {card.editedAt && (
                <span style={{
                  fontSize: 11, background: "#F0F9FF", color: "#0369A1",
                  borderRadius: 999, padding: "2px 8px",
                  height: 20, display: "inline-flex", alignItems: "center",
                }}>수정됨</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
              {LANGUAGES[card.authorLang]?.flag}
              <span>{LANGUAGES[card.authorLang]?.label}</span>
              <span style={{ color: "#E5E7EB" }}>·</span>
              <span>{timeAgo(card.timestamp)}</span>
            </div>
          </div>

          {/* Edit button */}
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
              title={isTeacher ? "수정" : "5분 내 수정 가능"}
              style={{
                background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 8,
                padding: "4px 8px", cursor: "pointer", fontSize: 12, color: "#0369A1",
                fontWeight: 700, flexShrink: 0, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#E0F2FE";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#F0F9FF";
              }}
            >
              ✏️
            </button>
          )}
          {/* Delete button */}
          {canDelete && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="삭제 (되돌리기 가능)"
              style={{
                background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
                padding: "4px 8px", cursor: "pointer", fontSize: 12, color: "#DC2626",
                fontWeight: 700, flexShrink: 0, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#FEE2E2";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2";
              }}
            >
              🗑️
            </button>
          )}
        </div>

        {/* ── Image / Drawing ── */}
        {(cardType === "image" || cardType === "drawing") && card.imageUrl && !imgError && (
          <img
            src={card.imageUrl}
            alt={cardType}
            onError={() => setImgError(true)}
            style={{ width: "100%", borderRadius: 10, display: "block" }}
          />
        )}
        {(cardType === "image" || cardType === "drawing") && imgError && (
          <div style={{ padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: 12, background: "#F9FAFB", borderRadius: 10 }}>
            이미지를 불러올 수 없습니다
          </div>
        )}
        {/* 활동지 이미지: 번역 텍스트 */}
        {cardType === "image" && card.originalText && (
          <div style={{
            marginTop: 8, padding: "8px 12px", borderRadius: 8,
            background: p.accent + "0A", borderLeft: `3px solid ${p.accent}`,
          }}>
            <div style={{ fontSize: 10, color: p.accent, fontWeight: 700, marginBottom: 3, opacity: 0.8 }}>
              {LANGUAGES[card.authorLang]?.flag} 번역
            </div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>
              {card.translations?.[viewerLang] && viewerLang !== card.authorLang
                ? card.translations[viewerLang]
                : card.originalText}
            </div>
          </div>
        )}

        {/* ── YouTube ── */}
        {cardType === "youtube" && card.youtubeId && (
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 10, overflow: "hidden" }}>
            <iframe
              src={`https://www.youtube.com/embed/${card.youtubeId}`}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          </div>
        )}

        {/* ── Text ── */}
        {cardType === "text" && (
          <>
            <div style={{
              fontSize: 17, fontWeight: 500, color: "#1F2937", lineHeight: 1.65,
              padding: "12px 14px",
              background: "#fff",
              borderRadius: 12, border: "1px solid " + p.accent + "22",
              display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <span style={{ flex: 1 }}>{card.originalText}</span>
              <button
                onClick={() => speakText(card.originalText, card.authorLang)}
                aria-label="원문 읽어주기"
                style={{ background: p.accent + "14", border: `1.5px solid ${p.accent}33`, cursor: "pointer", fontSize: 13, color: p.accent, flexShrink: 0, padding: "4px 8px", transition: "all 0.15s", borderRadius: 10, fontWeight: 700 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = p.accent + "22"; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = p.accent + "14"; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              >🔊</button>
            </div>

            {card.loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
                <span style={{ display: "inline-block", animation: "pulse 1.2s ease-in-out infinite" }}>● ● ●</span>
              </div>
            )}

            {!card.loading && card.translations?.[viewerLang] && viewerLang !== card.authorLang && (
              <div style={{ paddingTop: 2 }}>
                <TranslationRow lang={viewerLang} text={card.translations[viewerLang]} accent={colColor} />
              </div>
            )}

            {card.translateError && (
              <div style={{
                background: "#FEF2F2", color: "#B91C1C",
                borderLeft: "3px solid #EF4444",
                padding: "6px 10px", borderRadius: 6, fontSize: 12,
                marginTop: 6,
              }}>⚠️ 번역 실패</div>
            )}

            {otherLangs.length > 0 && (
              <div>
                <button
                  onClick={() => setOpen((v) => !v)}
                  style={{
                    background: "rgba(255,255,255,0.7)", border: `1.5px dashed ${p.accent}55`, cursor: "pointer",
                    fontSize: 13, color: p.accent, fontWeight: 800,
                    padding: "8px 14px", marginTop: 8, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = p.accent + "14")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.7)")}
                >
                  {open ? "▲ 접기" : `▼ +${otherLangs.length}개 언어 더보기`}
                </button>
                {open && otherLangs.map((l) =>
                  card.translations[l] ? (
                    <TranslationRow key={l} lang={l} text={card.translations[l]} accent={p.accent} />
                  ) : null
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Action row: 🔊 들어봐 · ❤️ 좋아요 · 💬 댓글 ── */}
      <div
        style={{
          display: "flex", gap: 8, padding: "10px 12px",
          borderTop: `1px solid ${p.accent}22`,
          background: "rgba(255,255,255,0.5)",
        }}
      >
        <button
          type="button"
          onClick={() => speakText(
            cardType === "text" ? card.originalText :
            (card.originalText || card.translations?.[viewerLang] || ""),
            card.authorLang
          )}
          aria-label="원문 읽어주기"
          style={{
            flex: 1, minHeight: 44, borderRadius: 12,
            background: "#fff", border: `2px solid ${p.accent}44`,
            color: p.accent, fontSize: 14, fontWeight: 900,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = p.accent + "14"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
        >🔊 들어봐</button>

        <button
          type="button"
          onClick={() => {
            setLikedLocal((v) => !v);
            setLikeBump((n) => n + 1);
          }}
          aria-pressed={likedLocal}
          aria-label="좋아요"
          style={{
            flex: 1, minHeight: 44, borderRadius: 12,
            background: likedLocal ? "#FEE2E2" : "#fff",
            border: `2px solid ${likedLocal ? "#FB7185" : "#FECDD3"}`,
            color: likedLocal ? "#BE123C" : "#FB7185", fontSize: 14, fontWeight: 900,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            transition: "all 0.15s",
            animation: likeBump > 0 ? "likeBump 0.45s ease" : undefined,
          }}
          onAnimationEnd={() => setLikeBump(0)}
        >{likedLocal ? "❤️" : "🤍"} <span style={{ fontSize: 13 }}>좋아요</span></button>

        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          aria-label="댓글"
          style={{
            flex: 1, minHeight: 44, borderRadius: 12,
            background: commentsOpen ? "#EDE9FE" : "#fff",
            border: `2px solid ${commentsOpen ? "#A78BFA" : "#DDD6FE"}`,
            color: commentsOpen ? "#6D28D9" : "#8B5CF6", fontSize: 14, fontWeight: 900,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            transition: "all 0.15s",
          }}
        >💬 <span>{commentCount > 0 ? commentCount : "댓글"}</span></button>
      </div>

      {/* ── Expanded comments section ── */}
      {commentsOpen && (
        <div style={{
          padding: "14px 16px",
          background: "#FFFBEB",
          borderTop: `1px solid ${p.accent}22`,
        }}>
          {/* Header */}
          <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 10 }}>
            💬 {comments.filter((c) => !c.status || c.status === "approved").length > 0
              ? `댓글 (${comments.filter((c) => !c.status || c.status === "approved").length})`
              : t("noComments", viewerLang)
            }
          </div>

          {/* Comments list */}
          {comments.length === 0 && (
            <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "10px 0" }}>
              {t("noComments", viewerLang)}
            </div>
          )}
          {comments.map((comment) => {
            const isPendingComment = comment.status === "pending";
            const canDeleteThis =
              isTeacher ||
              (myClientId &&
                comment.authorClientId === myClientId &&
                Date.now() - comment.timestamp < 5 * 60 * 1000);
            const displayText = comment.translations?.[viewerLang] || comment.text;
            return (
              <div key={comment.id} style={{
                padding: "10px 12px",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
                background: isPendingComment ? "#FFFBEB" : "transparent",
                borderLeft: isPendingComment ? "3px solid #F59E0B" : "3px solid transparent",
                borderRadius: 6,
                marginBottom: 4,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>
                    {comment.isTeacher ? "👩‍🏫 " : ""}{comment.authorName}
                  </span>
                  <span style={{ fontSize: 10, color: "#9CA3AF" }}>
                    {LANGUAGES[comment.authorLang]?.flag} · {timeAgo(comment.timestamp)}
                  </span>
                  {isPendingComment && (
                    <span style={{ fontSize: 9, background: "#FEF3C7", color: "#D97706", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>
                      {t("commentPending", viewerLang)}
                    </span>
                  )}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    {isTeacher && isPendingComment && (
                      <>
                        <button
                          onClick={() => approveComment(comment.id)}
                          style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, border: "none", background: "#D1FAE5", color: "#065F46", cursor: "pointer", fontWeight: 700 }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            const db = getClientDb();
                            remove(ref(db, `rooms/${roomCode}/cards/${card.id}/comments/${comment.id}`));
                          }}
                          style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, border: "none", background: "#FEE2E2", color: "#991B1B", cursor: "pointer", fontWeight: 700 }}
                        >
                          ✕
                        </button>
                      </>
                    )}
                    {canDeleteThis && !isPendingComment && (
                      <button
                        onClick={() => deleteComment(comment.id, comment)}
                        aria-label={t("deleteComment", viewerLang)}
                        style={{ fontSize: 11, background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", padding: "0 2px" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#EF4444")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#D1D5DB")}
                      >🗑</button>
                    )}
                  </div>
                </div>

                {/* Original text (if different from display) */}
                {comment.authorLang !== viewerLang && (
                  <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6, marginBottom: 3 }}>
                    {comment.text}
                  </div>
                )}
                {/* Translated text */}
                <div style={{
                  fontSize: 13, color: "#111827", lineHeight: 1.6, fontWeight: 500,
                  background: `${colColor}0A`, borderLeft: `3px solid ${colColor}`,
                  padding: "4px 8px", borderRadius: "0 4px 4px 0",
                }}>
                  {displayText}
                </div>
              </div>
            );
          })}

          {/* Comment error */}
          {commentError && (
            <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 8, padding: "4px 8px", background: "#FEF2F2", borderRadius: 6 }}>
              {commentError}
            </div>
          )}

          {/* Input area */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={commentInput}
              onChange={(e) => {
                setCommentInput(e.target.value);
                const key = `draft:comment:${roomCode}:${card.id}`;
                if (commentDraftTimer.current) clearTimeout(commentDraftTimer.current);
                commentDraftTimer.current = setTimeout(() => {
                  if (e.target.value) localStorage.setItem(key, e.target.value);
                }, 500);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitComment();
                }
              }}
              placeholder={t("commentPlaceholder", viewerLang)}
              disabled={submittingComment}
              style={{
                flex: 1, height: 48, borderRadius: 24, padding: "0 18px",
                border: "2px solid #FDE68A", fontSize: 15, outline: "none",
                background: submittingComment ? "#F3F4F6" : "#fff",
                color: "#1F2937", fontWeight: 500,
              }}
              onFocus={(e) => (e.target.style.borderColor = colColor)}
              onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
            />
            <button
              onClick={submitComment}
              disabled={!commentInput.trim() || submittingComment}
              aria-busy={submittingComment}
              style={{
                padding: "0 20px", height: 48, borderRadius: 24, border: "none",
                background: commentInput.trim() && !submittingComment ? `linear-gradient(135deg, ${colColor}, ${colColor}dd)` : "#E5E7EB",
                color: commentInput.trim() && !submittingComment ? "#fff" : "#9CA3AF",
                fontWeight: 800, fontSize: 15,
                cursor: commentInput.trim() && !submittingComment ? "pointer" : "not-allowed",
                whiteSpace: "nowrap", transition: "all 0.15s", flexShrink: 0,
                boxShadow: commentInput.trim() && !submittingComment ? `0 6px 16px ${colColor}44` : "none",
              }}
            >
              {submittingComment ? t("commentTranslating", viewerLang) : t("submitComment", viewerLang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { ref, get, onValue, off, push, set, remove } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { CardData, CommentData } from "@/lib/types";
import { LANGUAGES, CARD_PALETTES } from "@/lib/constants";
import { t } from "@/lib/i18n";

const TTS_LANG_MAP: Record<string, string> = {
  ko: "ko-KR", en: "en-US", vi: "vi-VN", zh: "zh-CN", fil: "fil-PH",
  ja: "ja-JP", th: "th-TH", km: "km-KH", mn: "mn-MN", ru: "ru-RU",
  uz: "uz-UZ", hi: "hi-IN", id: "id-ID", ar: "ar-SA", my: "my-MM",
};

const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function speakText(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = TTS_LANG_MAP[lang] || "en-US";
  window.speechSynthesis.speak(u);
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
      display: "flex", alignItems: "flex-start", gap: 8,
      padding: "7px 0", borderTop: "1px solid #F3F4F6",
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
        background: accent + "18", color: accent,
        borderRadius: 8, padding: "2px 7px", flexShrink: 0, marginTop: 2,
        whiteSpace: "nowrap",
      }}>
        {LANGUAGES[lang]?.flag} {LANGUAGES[lang]?.label}
      </span>
      <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, flex: 1 }}>{text}</span>
      <button
        onClick={() => speakText(text, lang)}
        title="읽어주기"
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: "#CBD5E1", flexShrink: 0, padding: "2px",
          transition: "color 0.15s", lineHeight: 1,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = accent)}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1")}
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

  // Comment count fetch (one-time on mount)
  useEffect(() => {
    const db = getClientDb();
    get(ref(db, `rooms/${roomCode}/cards/${card.id}/comments`))
      .then((snap) => {
        const data = snap.val();
        if (data) {
          const list = Object.values(data) as CommentData[];
          setCommentCount(list.filter((c) => !c.status || c.status === "approved").length);
        }
      })
      .catch(() => {});
  }, [roomCode, card.id]);

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
        borderRadius: 14,
        border: isPending ? "2px solid #F59E0B" : "1px solid #EEF0F6",
        borderLeft: isPending ? "4px solid #F59E0B" : `4px solid ${p.accent}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.04)",
        marginBottom: 10,
        transition: "box-shadow 0.2s, transform 0.2s",
        overflow: "hidden",
        ...pendingBorderStyle,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.1)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.04)";
        (e.currentTarget as HTMLDivElement).style.transform = "none";
      }}
    >
      <div style={{ padding: "12px 14px 14px" }}>
        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg, ${p.accent}cc, ${p.accent}66)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: card.isTeacher ? 15 : 13, fontWeight: 900, color: "#fff",
          }}>
            {card.isTeacher ? "👩‍🏫" : card.authorName.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
                {card.authorName}
              </span>
              {card.isTeacher && (
                <span style={{
                  fontSize: 9, background: p.accent, color: "#fff",
                  borderRadius: 6, padding: "1px 7px", fontWeight: 700,
                }}>선생님</span>
              )}
              {cardType !== "text" && (
                <span style={{
                  fontSize: 9, background: "#F3F4F6", color: "#6B7280",
                  borderRadius: 6, padding: "1px 7px",
                }}>
                  {cardType === "image" ? "🖼️ 사진" : cardType === "youtube" ? "📺 YouTube" : "✏️ 그림"}
                </span>
              )}
              {card.flagged && (
                <span style={{
                  fontSize: 9, background: "#FEF2F2", color: "#DC2626",
                  borderRadius: 6, padding: "1px 7px", border: "1px solid #FECACA",
                }}>⚠️ 검토</span>
              )}
              {isPending && (
                <span style={{
                  fontSize: 9, background: "#FEF3C7", color: "#D97706",
                  borderRadius: 6, padding: "1px 7px", border: "1px solid #FDE68A",
                  fontWeight: 700,
                }}>대기 중</span>
              )}
              {card.editedAt && (
                <span style={{
                  fontSize: 9, background: "#F0F9FF", color: "#0369A1",
                  borderRadius: 6, padding: "1px 7px",
                }}>수정됨</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
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
              fontSize: 14, fontWeight: 600, color: "#111827", lineHeight: 1.7,
              padding: "9px 11px",
              background: "rgba(255,255,255,0.75)",
              borderRadius: 9, border: "1px solid #F3F4F6",
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <span style={{ flex: 1 }}>{card.originalText}</span>
              <button
                onClick={() => speakText(card.originalText, card.authorLang)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#CBD5E1", flexShrink: 0, padding: "2px", transition: "color 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = p.accent)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1")}
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
              <div style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>⚠️ 번역 실패</div>
            )}

            {otherLangs.length > 0 && (
              <div>
                <button
                  onClick={() => setOpen((v) => !v)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, color: p.accent, fontWeight: 700,
                    padding: "6px 0 0", display: "flex", alignItems: "center", gap: 3,
                  }}
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

      {/* ── Comment toggle bar ── */}
      <div
        style={{
          borderTop: "1px solid rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center",
          padding: "8px 14px", cursor: "pointer",
          color: "#6B7280", fontSize: 12,
        }}
        onClick={() => setCommentsOpen((v) => !v)}
        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.color = colColor)}
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.color = "#6B7280")}
      >
        <span style={{ marginRight: 6 }}>💬</span>
        {commentCount > 0 ? `${commentCount}` : t("addComment", viewerLang)}
        {commentsOpen && <span style={{ marginLeft: "auto", fontSize: 11 }}>✕ 닫기</span>}
      </div>

      {/* ── Expanded comments section ── */}
      {commentsOpen && (
        <div style={{
          padding: "12px 14px",
          background: "#F8F9FC",
          borderTop: "1px solid rgba(0,0,0,0.04)",
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
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
                flex: 1, height: 40, borderRadius: 20, padding: "0 14px",
                border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none",
                background: submittingComment ? "#F3F4F6" : "#fff",
                color: "#111827",
              }}
              onFocus={(e) => (e.target.style.borderColor = colColor)}
              onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            />
            <button
              onClick={submitComment}
              disabled={!commentInput.trim() || submittingComment}
              aria-busy={submittingComment}
              style={{
                padding: "0 16px", height: 40, borderRadius: 20, border: "none",
                background: commentInput.trim() && !submittingComment ? colColor : "#E5E7EB",
                color: commentInput.trim() && !submittingComment ? "#fff" : "#9CA3AF",
                fontWeight: 700, fontSize: 13,
                cursor: commentInput.trim() && !submittingComment ? "pointer" : "not-allowed",
                whiteSpace: "nowrap", transition: "all 0.15s", flexShrink: 0,
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

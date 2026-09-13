"use client";

import { useState, useEffect, useRef } from "react";
import { ref, onValue, off, push, set, remove } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { CardData, CommentData, TranscriptData } from "@/lib/types";
import { LANGUAGES } from "@/lib/constants";
import { t, tFmt, tPlain } from "@/lib/i18n";
import { speak, cancelSpeak } from "@/lib/ttsMulti";
import {
  REACTIONS, readReactions, nextReaction,
  type ReactionKind, type RawReactions,
} from "@/lib/cardReactions";
import { resolveAnimal } from "@/lib/animals";
import AnimalArt from "./ui/child/AnimalArt";
import ImageLightbox from "./ImageLightbox";

const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** 이 길이를 넘으면 '더 읽기'로 접는다. 글을 잘라 없애지 않는다. */
const LONG_TEXT = 220;

/* 반응 데이터 계약은 lib/cardReactions.ts 로 분리했다 — 옛 `true` 호환처럼
   눈으로 판단할 수 없는 규칙은 실제로 실행해 검사해야 한다.
   기존 import 경로를 쓰던 코드를 위해 여기서 다시 내보낸다. */
export { readReactions } from "@/lib/cardReactions";

/* U04: 게시글·댓글의 상대시간 표시를 없앴다. '선00 · 1995시간 전' 처럼 시간이
   작성자 옆에서 가장 먼저 읽히는 것이 아이에게 아무 의미가 없다는 사용자 요구다.
   `card.timestamp` 자체는 그대로 둔다 — 정렬, 수정 가능 시간(EDIT_WINDOW_MS),
   댓글 승인 대기 판정이 모두 이 값을 쓴다. 표시만 뺀 것이지 필드를 지운 게 아니다. */

interface Props {
  card: CardData;
  viewerLang: string;
  colColor: string;
  isTeacher?: boolean;
  myClientId?: string;
  authorName?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onPraise?: () => void;
  isPending?: boolean;
  roomCode: string;
  roomLangs: string[];
  approvalMode?: boolean;
  /** 개발용 fixture — Firebase 구독과 외부 API 호출을 하지 않는다 (HARNESS §2). */
  fixture?: boolean;
  /**
   * U05 — learnerId → 프로필. RoomConfig.learners 를 그대로 넘긴다.
   * 작성자의 현재 동물을 찾는 데만 쓴다(이름으로 찾지 않는다).
   */
  learners?: Record<string, { avatarAnimalId?: string } | undefined>;
  /**
   * fixture 에서 반응 노드의 초기값을 주입한다. 구독을 끄면 반응이 늘 비어 있어
   * 옛 `true` 호환·개수 표시·내 선택 상태를 화면으로 검수할 수 없다.
   * 모양은 실제 노드와 같다: `{ [clientId]: 반응문자열 | true }`.
   */
  fixtureReactions?: RawReactions;
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
  onPraise,
  isPending,
  roomCode,
  roomLangs,
  approvalMode,
  fixture,
  learners,
  fixtureReactions,
}: Props) {
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [now, setNow] = useState(card.timestamp);
  const cardType = card.cardType || "text";

  // 읽기 상태
  const [showOriginal, setShowOriginal] = useState(false);
  const [showKorean, setShowKorean] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [localTr, setLocalTr] = useState<Record<string, string> | null>(null);
  const [retryState, setRetryState] = useState<"idle" | "loading" | "failed">("idle");

  // 듣기 — 재생 중인 것은 카드 전체에서 하나뿐이다 (AUDIO-01).
  const [speaking, setSpeaking] = useState<string | null>(null);
  const playToken = useRef(0);

  // YouTube 자막 번역 상태
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptErr, setTranscriptErr] = useState<string | null>(null);
  const [transcriptOtherOpen, setTranscriptOtherOpen] = useState(false);
  const [transcriptOrigOpen, setTranscriptOrigOpen] = useState(false);
  const [localTranscript, setLocalTranscript] = useState<TranscriptData | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteSubmitting, setPasteSubmitting] = useState(false);

  // 답장(댓글)
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const commentDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 반응 (기존 likes 노드 위의 호환 어댑터)
  const [reactRaw, setReactRaw] = useState<RawReactions>(fixtureReactions ?? {});
  /** U06: 세부 반응 패널은 눌러야 열린다 — 카드마다 상시 자리를 차지하지 않는다. */
  const [reactOpen, setReactOpen] = useState(false);
  const [reactError, setReactError] = useState<string | null>(null);

  // Tick to update edit window expiry
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  /** 카드가 사라지거나 다른 카드로 넘어가면 재생 중인 음성을 반드시 끊는다. */
  useEffect(() => {
    return () => { cancelSpeak(); };
  }, [card.id]);

  // 반응 listener — 개수는 항상 보이게 상시 구독
  useEffect(() => {
    if (fixture) return;
    const db = getClientDb();
    const likesRef = ref(db, `rooms/${roomCode}/cards/${card.id}/likes`);
    const unsub = onValue(likesRef, (snap) => {
      setReactRaw((snap.val() as RawReactions | null) || {});
    });
    return () => { off(likesRef); void unsub; };
  }, [roomCode, card.id, fixture]);

  /* U05 — 작성자의 동물. 검증된 learnerId → 프로필 → 글에 저장된 스냅샷 →
     결정적 폴백. stableId 는 신원 판단이 아니라 폴백 해시 재료일 뿐이다. */
  const authorAnimal = resolveAnimal({
    roomCode,
    authorLearnerId: card.authorLearnerId,
    profiles: learners,
    snapshotAnimalId: card.authorAnimalId,
    stableId: card.authorClientId || card.authorName,
  }).id;

  const { counts, legacy, mine, total } = readReactions(reactRaw, myClientId);
  const myReaction = REACTIONS.find((r) => r.id === mine) ?? null;

  /* U06 disclosure: 트리거·패널을 id 로 묶고, Escape·바깥 클릭으로 닫은 뒤
     포커스를 트리거로 되돌린다. */
  const reactPanelId = `pc-react-${card.id}`;
  const reactTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reactPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!reactOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setReactOpen(false);
      reactTriggerRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (reactPanelRef.current?.contains(t) || reactTriggerRef.current?.contains(t)) return;
      setReactOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [reactOpen]);

  /**
   * 반응 쓰기는 직렬화한다. 아이가 연타하면 요청이 겹쳐 나가고, 늦게 도착한
   * 이전 응답이 최신 상태를 덮어쓸 수 있다. 마지막 의도만 순서대로 보낸다.
   */
  const reactQueue = useRef<Promise<void>>(Promise.resolve());

  async function pickReaction(kind: ReactionKind) {
    if (!myClientId) return;
    const prevMine = mine;
    const next = nextReaction(prevMine, kind);
    setReactError(null);
    // 낙관적 반영 — 실패하면 아래에서 되돌린다.
    setReactRaw((prev) => {
      const copy = { ...prev };
      if (next) copy[myClientId] = next; else delete copy[myClientId];
      return copy;
    });
    // 고르면 패널을 닫고 포커스를 트리거로 돌려준다.
    setReactOpen(false);
    reactTriggerRef.current?.focus();
    if (fixture) return;

    const db = getClientDb();
    const myRef = ref(db, `rooms/${roomCode}/cards/${card.id}/likes/${myClientId}`);
    reactQueue.current = reactQueue.current
      .then(async () => {
        if (next) await set(myRef, next);
        else await remove(myRef);
      })
      .catch(() => {
        // 낙관적 상태를 영구히 남기지 않는다 — 이전 선택으로 되돌리고 알린다.
        setReactRaw((prev) => {
          const copy = { ...prev };
          if (prevMine) copy[myClientId] = prevMine; else delete copy[myClientId];
          return copy;
        });
        setReactError(t("cardReactFailed", viewerLang));
      });
  }

  // 답장 listener (열었을 때만)
  useEffect(() => {
    if (!commentsOpen || fixture) return;
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
      const visible = isTeacher ? list : list.filter((c) => !c.status || c.status === "approved");
      setComments(visible);
      setCommentCount(list.filter((c) => !c.status || c.status === "approved").length);
    });
    return () => {
      off(commentsRef);
      void unsub;
    };
  }, [commentsOpen, roomCode, card.id, isTeacher, fixture]);

  // Draft restore on open
  useEffect(() => {
    if (!commentsOpen || fixture) return;
    const key = `draft:comment:${roomCode}:${card.id}`;
    const saved = localStorage.getItem(key);
    if (saved) setCommentInput(saved);
  }, [commentsOpen, roomCode, card.id, fixture]);

  const isMyCard = !!myClientId && card.authorClientId === myClientId;
  const withinEditWindow = now - card.timestamp < EDIT_WINDOW_MS;
  const canEdit = (isTeacher || (isMyCard && withinEditWindow)) && !!onEdit;
  const canDelete = isTeacher || (isMyCard && withinEditWindow);

  // ── 읽기 계약: 내 언어 하나를 본문으로, 나머지는 눌러서 편다 (README §6.2) ──
  const sameLang = viewerLang === card.authorLang;
  const myText = localTr?.[viewerLang] ?? card.translations?.[viewerLang];
  const translating = !sameLang && !!card.loading && !myText;
  const translateFailed = !sameLang && !card.loading && (!!card.translateError || !myText);
  const bodyText = sameLang ? card.originalText : (myText || "");
  const readingText = bodyText || card.originalText || "";
  const isLong = readingText.length > LONG_TEXT;
  const koText = card.translations?.ko ?? (card.authorLang === "ko" ? card.originalText : undefined);
  const otherLangs = Object.keys(card.translations || {}).filter(
    (l) => l !== card.authorLang && l !== viewerLang && l !== "ko"
  );

  async function toggleSpeak(id: string, text: string, lang: string) {
    if (!text.trim()) return;
    // 카드 간 이동·재생 중 전환 — 어떤 경우에도 활성 재생은 하나뿐이다.
    cancelSpeak();
    if (speaking === id) { setSpeaking(null); return; }
    const token = ++playToken.current;
    setSpeaking(id);
    try {
      await speak(text, lang);
    } finally {
      if (playToken.current === token) setSpeaking(null);
    }
  }

  /** 번역 실패 복구 — 저장 없이 이 화면에서만 다시 번역한다. */
  async function retryTranslate() {
    if (fixture || retryState === "loading") return;
    setRetryState("loading");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: card.originalText,
          fromLang: card.authorLang,
          targetLangs: [viewerLang],
          colId: "comment",
          authorName: card.authorName,
          isTeacher: false,
          paletteIdx: 0,
          roomCode,
          cardType: "comment", // translate-only: Firebase 에 저장하지 않는다
        }),
      });
      if (!res.ok) throw new Error("translate failed");
      const data = await res.json();
      if (data?.translations?.[viewerLang]) {
        setLocalTr(data.translations as Record<string, string>);
        setRetryState("idle");
      } else {
        setRetryState("failed");
      }
    } catch {
      setRetryState("failed");
    }
  }

  async function submitComment() {
    if (!commentInput.trim() || submittingComment || fixture) return;
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
    const allowed =
      isTeacher ||
      (myClientId &&
        comment.authorClientId === myClientId &&
        Date.now() - comment.timestamp < 5 * 60 * 1000);
    if (!allowed || fixture) return;
    const db = getClientDb();
    remove(ref(db, `rooms/${roomCode}/cards/${card.id}/comments/${commentId}`));
  }

  function approveComment(commentId: string) {
    if (fixture) return;
    const db = getClientDb();
    set(ref(db, `rooms/${roomCode}/cards/${card.id}/comments/${commentId}/status`), "approved");
  }

  // YouTube 자막: 토글 + 최초 1회 서버 호출(이후엔 Firebase 캐시가 card.transcript 로 들어옴)
  const transcript = card.transcript || localTranscript;
  async function toggleTranscript() {
    const next = !transcriptOpen;
    setTranscriptOpen(next);
    if (!next || transcript || transcriptLoading || !card.youtubeId || fixture) return;
    setTranscriptLoading(true);
    setTranscriptErr(null);
    try {
      const res = await fetch("/api/youtube-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeId: card.youtubeId,
          roomCode,
          cardId: card.id,
          targetLangs: roomLangs,
        }),
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setLocalTranscript(data.transcript as TranscriptData);
    } catch {
      setTranscriptErr(t("captionNone", viewerLang));
    }
    setTranscriptLoading(false);
  }

  /** 교사가 직접 붙여넣은 자막을 모든 학생 언어로 번역해 올린다. */
  async function submitManualTranscript() {
    if (!pasteText.trim() || pasteSubmitting || !card.youtubeId || fixture) return;
    setPasteSubmitting(true);
    setTranscriptErr(null);
    try {
      const res = await fetch("/api/youtube-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeId: card.youtubeId,
          roomCode,
          cardId: card.id,
          targetLangs: roomLangs,
          manualText: pasteText,
          sourceLang: viewerLang,
        }),
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setLocalTranscript(data.transcript as TranscriptData);
      setPasteText("");
    } catch {
      setTranscriptErr(t("captionNone", viewerLang));
    }
    setPasteSubmitting(false);
  }

  const enterUnlessComposing = (run: () => void) => (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    // 한국어·일본어·중국어 조합 중 Enter 는 확정용이다 — 전송으로 쓰지 않는다.
    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
    e.preventDefault();
    run();
  };

  /** 라벨 있는 듣기 버튼. 재생 중에는 '멈추기'로 바뀐다. */
  function ListenButton({ id, text, lang, withLang }: { id: string; text: string; lang: string; withLang?: boolean }) {
    if (!text?.trim()) return null;
    const on = speaking === id;
    // 한 카드에 듣기 버튼이 여럿일 때 어느 글을 읽는지 라벨로 구분한다.
    const suffix = withLang && LANGUAGES[lang]?.label ? ` · ${LANGUAGES[lang].label}` : "";
    return (
      <button
        type="button"
        data-ux-role="control"
        className="pc-btn"
        aria-pressed={on}
        onClick={() => toggleSpeak(id, text, lang)}
      >{(on ? tPlain("cardStop", viewerLang) : tPlain("cardListen", viewerLang)) + suffix}</button>
    );
  }

  return (
    <article
      className={isPending ? "pc-card pending" : "pc-card"}
      style={{ borderInlineStartColor: colColor }}
      aria-label={`${card.authorName}의 이야기`}
    >
      {/* ── 1. 누가 썼는지 ── */}
      <header className="pc-who">
        {/* U05 — 작성자의 내 동물. 해석 순서는 검증된 learnerId → 프로필 →
            글에 저장된 스냅샷 → 결정적 폴백. 이름으로 프로필을 찾지 않는다
            (동명이인 병합 금지).

            교사는 동물을 고르지 않는다. OS 이모지(🧑‍🏫)는 기기마다 그림이
            달라 이 앱의 톤과 맞지 않았다 — 같은 세트의 꿀벌 마스코트를 쓴다
            (03 에셋가이드: OS 유니코드 이모지를 핵심 아이콘으로 쓰지 않기).
            원 안에서 그림이 작아 보이던 것도 함께 키웠다. */}
        {/* 바탕색은 주제(칼럼) 색을 그대로 쓴다 — 색이 다른 것은 의도다.
            통일하는 것은 **모양**이다: 모든 아바타가 같은 크기의 정원에
            같은 테두리를 갖는다(.pc-avatar). */}
        <span aria-hidden className="pc-avatar" style={{ background: colColor }}>
          {card.isTeacher
            ? <img src="/mascot/bee-teacher.png" alt="" aria-hidden="true" width={40} height={40}
                   className="pc-avatar-art" style={{ width: 40, height: 40 }} />
            : <AnimalArt id={authorAnimal} size={40} className="pc-avatar-art" />}
        </span>
        <span className="pc-who-text">
          <span data-ux-role="label" className="pc-name"><bdi>{card.authorName}</bdi></span>
          {(card.isTeacher || card.editedAt || isPending) && (
            <span data-ux-role="secondary" className="pc-meta">
              {[
                card.isTeacher ? t("teacherTag", viewerLang) : null,
                card.editedAt ? "수정됨" : null,
                isPending ? "선생님이 확인하고 있어요" : null,
              ].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
        {(canEdit || (canDelete && onDelete) || (isTeacher && onPraise && !card.isTeacher)) && (
          <span className="pc-owner-tools">
            {canEdit && (
              <button type="button" data-ux-role="control" className="pc-btn" onClick={() => onEdit?.()}>고치기</button>
            )}
            {isTeacher && onPraise && !card.isTeacher && (
              <button type="button" data-ux-role="control" className="pc-btn" onClick={() => onPraise()}>{tPlain("praiseAction", viewerLang)}</button>
            )}
            {canDelete && onDelete && (
              <button type="button" data-ux-role="control" className="pc-btn danger" onClick={() => onDelete()}>지우기</button>
            )}
          </span>
        )}
      </header>

      {/* ── 2. 그림·사진 ── */}
      {(cardType === "image" || cardType === "drawing") && card.imageUrl && !imgError && (
        <button type="button" className="pc-img-btn" onClick={() => setZoomSrc(card.imageUrl!)} aria-label="그림 크게 보기">
          <img src={card.imageUrl} alt={cardType === "drawing" ? "친구가 그린 그림" : "친구가 올린 사진"} onError={() => setImgError(true)} className="pc-img" />
        </button>
      )}
      {(cardType === "image" || cardType === "drawing") && imgError && (
        <p data-ux-role="body" className="pc-state warn">{t("cardImageFailed", viewerLang)}</p>
      )}
      <ImageLightbox src={zoomSrc} alt={`${card.authorName}의 ${cardType === "drawing" ? "그림" : "사진"}`} onClose={() => setZoomSrc(null)} />

      {cardType === "youtube" && card.youtubeId && (
        <div className="pc-video">
          <iframe
            src={`https://www.youtube.com/embed/${card.youtubeId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        </div>
      )}

      {/* ── 3. 내 언어 본문 ── */}
      {readingText && (
        <div className="pc-read">
          {!sameLang && (
            <span data-ux-role="secondary" className="pc-read-tag">
              {translating || translateFailed ? LANGUAGES[card.authorLang]?.label : LANGUAGES[viewerLang]?.label}
            </span>
          )}

          {/* '번역 중' / '번역 실패' / '원문 보기' 는 서로 다른 상태다. 어떤 경우에도 카드가 비지 않는다. */}
          {translating && (
            <p data-ux-role="body" className="pc-state" role="status">{t("cardTranslating", viewerLang)}</p>
          )}
          {translateFailed && (
            <div className="pc-state warn">
              <p data-ux-role="body" className="pc-state-text">{t("cardTranslateFailed", viewerLang)}</p>
              <button
                type="button"
                data-ux-role="control"
                className="pc-btn"
                aria-disabled={retryState === "loading"}
                onClick={retryTranslate}
              >{retryState === "loading" ? t("cardTranslating", viewerLang) : tPlain("cardRetryTranslate", viewerLang)}</button>
            </div>
          )}

          <p
            data-ux-role="body"
            data-ux-reading
            lang={translating || translateFailed ? card.authorLang : viewerLang}
            className={isLong && !expanded ? "pc-body clamp" : "pc-body"}
          >{translating || translateFailed ? card.originalText : readingText}</p>

          {/* 긴 글은 줄 수로 잘라 없애지 않고 펼칠 수 있게 둔다. */}
          {isLong && (
            <button type="button" data-ux-role="control" className="pc-btn" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
              {expanded ? tPlain("cardReadLess", viewerLang) : tPlain("cardReadMore", viewerLang)}
            </button>
          )}

          {/* ── 4. 원문 보기 ── */}
          {!sameLang && !translating && !translateFailed && (
            <div className="pc-sub">
              <button type="button" data-ux-role="control" className="pc-btn" aria-pressed={showOriginal} onClick={() => setShowOriginal((v) => !v)}>
                {showOriginal ? tPlain("cardHideOriginal", viewerLang) : tPlain("cardShowOriginal", viewerLang)}
              </button>
              {showOriginal && (
                <div className="pc-alt">
                  <span data-ux-role="secondary" className="pc-read-tag">{LANGUAGES[card.authorLang]?.label}</span>
                  <p data-ux-role="body" data-ux-reading lang={card.authorLang} className="pc-body">{card.originalText}</p>
                  <ListenButton id="orig" text={card.originalText} lang={card.authorLang} withLang />
                </div>
              )}
            </div>
          )}

          {/* 한국어 학습 보기 — 자동으로 쌓지 않고 아이가 고를 때만 함께 보여준다. */}
          {viewerLang !== "ko" && koText && koText !== card.originalText && (
            <div className="pc-sub">
              <button type="button" data-ux-role="control" className="pc-btn" aria-pressed={showKorean} onClick={() => setShowKorean((v) => !v)}>
                {showKorean ? tPlain("cardHideKorean", viewerLang) : tPlain("cardAlsoKorean", viewerLang)}
              </button>
              {showKorean && (
                <div className="pc-alt">
                  <span data-ux-role="secondary" className="pc-read-tag">{LANGUAGES.ko?.label}</span>
                  <p data-ux-role="body" data-ux-reading lang="ko" className="pc-body">{koText}</p>
                  <ListenButton id="ko" text={koText} lang="ko" withLang />
                </div>
              )}
            </div>
          )}

          {otherLangs.length > 0 && (
            <div className="pc-sub">
              <button type="button" data-ux-role="control" className="pc-btn" aria-pressed={showOthers} onClick={() => setShowOthers((v) => !v)}>
                {tPlain("cardOtherLangs", viewerLang)}
              </button>
              {showOthers && otherLangs.map((l) => (
                <div key={l} className="pc-alt">
                  <span data-ux-role="secondary" className="pc-read-tag">{LANGUAGES[l]?.label}</span>
                  <p data-ux-role="body" data-ux-reading lang={l} className="pc-body">{card.translations[l]}</p>
                  <ListenButton id={`tr:${l}`} text={card.translations[l]} lang={l} withLang />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── YouTube 자막 (교사 붙여넣기 폴백 포함) ── */}
      {cardType === "youtube" && card.youtubeId && (
        <div className="pc-sub">
          <button type="button" data-ux-role="control" className="pc-btn" aria-pressed={transcriptOpen} onClick={toggleTranscript}>
            {transcriptOpen ? tPlain("captionHide", viewerLang) : tPlain("captionShow", viewerLang)}
          </button>

          {transcriptOpen && (
            <div className="pc-alt">
              {transcriptLoading && (
                <p data-ux-role="body" className="pc-state" role="status">{t("captionLoading", viewerLang)}</p>
              )}
              {!transcriptLoading && transcriptErr && (
                <p data-ux-role="body" className="pc-state warn">{transcriptErr}</p>
              )}
              {!transcriptLoading && transcript && !transcript.available && (
                <p data-ux-role="body" className="pc-state warn">{transcript.reason || t("captionNone", viewerLang)}</p>
              )}

              {!transcriptLoading && transcript && transcript.available && (() => {
                const src = transcript.sourceLang;
                const viewerText = viewerLang === src
                  ? transcript.original
                  : (transcript.translations?.[viewerLang] || transcript.original);
                const others = roomLangs.filter(
                  (l) => l !== viewerLang && l !== src && transcript.translations?.[l],
                );
                return (
                  <>
                    <p data-ux-role="body" data-ux-reading lang={viewerLang} className="pc-body pre">{viewerText}</p>
                    <ListenButton id="cap" text={viewerText} lang={viewerLang} />
                    {src && src !== viewerLang && (
                      <>
                        <button type="button" data-ux-role="control" className="pc-btn" aria-pressed={transcriptOrigOpen} onClick={() => setTranscriptOrigOpen((v) => !v)}>
                          {tPlain("captionOriginal", viewerLang)}
                        </button>
                        {transcriptOrigOpen && (
                          <p data-ux-role="body" data-ux-reading lang={src} className="pc-body pre">{transcript.original}</p>
                        )}
                      </>
                    )}
                    {others.length > 0 && (
                      <>
                        <button type="button" data-ux-role="control" className="pc-btn" aria-pressed={transcriptOtherOpen} onClick={() => setTranscriptOtherOpen((v) => !v)}>
                          {tPlain("cardOtherLangs", viewerLang)}
                        </button>
                        {transcriptOtherOpen && others.map((l) => (
                          <p key={l} data-ux-role="body" data-ux-reading lang={l} className="pc-body pre">{transcript.translations[l]}</p>
                        ))}
                      </>
                    )}
                    {transcript.truncated && (
                      <p data-ux-role="secondary" className="pc-note">긴 영상이라 앞부분만 번역했어요</p>
                    )}
                  </>
                );
              })()}

              {isTeacher && !transcriptLoading && (!transcript || !transcript.available) && (
                <div className="pc-alt">
                  <label data-ux-role="label" htmlFor={`pc-paste-${card.id}`} className="pc-label">
                    선생님용 · 자막 직접 붙여넣기
                  </label>
                  <p data-ux-role="secondary" className="pc-note">
                    자동 자막을 가져올 수 없을 때 스크립트를 붙여넣으면 모든 학생 언어로 번역돼요.
                  </p>
                  <textarea
                    id={`pc-paste-${card.id}`}
                    className="pc-textarea"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={4}
                    readOnly={pasteSubmitting}
                  />
                  <button
                    type="button"
                    data-ux-role="control"
                    className="pc-btn"
                    aria-disabled={!pasteText.trim() || pasteSubmitting}
                    onClick={submitManualTranscript}
                  >{pasteSubmitting ? "번역 중…" : "번역해서 올리기"}</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 5. 조작 한 줄: 왼쪽 읽기 보조 · 오른쪽 대화 ──
             읽기 보조(듣기)와 대화 동작(답장·공감)은 성격이 다르다. 같은 무게로
             나란히 쌓으면 카드가 버튼 더미가 된다. */}
      <div className="pc-actions">
        <div className="pc-act-read">
          <ListenButton
            id="mine"
            text={translating || translateFailed ? card.originalText : readingText}
            lang={translating || translateFailed ? card.authorLang : viewerLang}
          />
        </div>
        <div className="pc-act-talk">
          <button
            type="button"
            data-ux-role="control"
            className="pc-btn"
            aria-expanded={commentsOpen}
            onClick={() => setCommentsOpen((v) => !v)}
          >{tPlain("cardReply", viewerLang)}{commentCount > 0 ? ` ${commentCount}` : ""}</button>
        </div>
      </div>

      {/* ── 반응 (U06): 기본은 '공감하기' 한 버튼. 누르면 세부 5종 패널이 열린다.
             예전에는 3종 버튼이 카드마다 상시 자리를 차지해, 카드 50개 화면에서
             조작이 318개가 됐다. 요약 칩은 0보다 큰 반응만 보여준다. ── */}
      <div className="pc-reactbar">
        <button
          type="button"
          ref={reactTriggerRef}
          data-ux-role="control"
          className={mine ? "pc-btn on" : "pc-btn"}
          aria-expanded={reactOpen}
          aria-controls={reactPanelId}
          aria-disabled={!myClientId}
          onClick={() => setReactOpen((v) => !v)}
        >
          {mine
            ? `${myReaction?.icon ?? ""} ${tPlain(myReaction?.key ?? "", viewerLang)} ✓`
            : tPlain("cardReactOpen", viewerLang)}
        </button>

        {/* 요약: 0보다 큰 반응만. 누르면 같은 패널이 열린다 — 별도 토글을 만들어
            아이를 헷갈리게 하지 않는다. */}
        {total > 0 && (
          <button
            type="button"
            data-ux-role="control"
            className="pc-chipsum"
            aria-expanded={reactOpen}
            aria-controls={reactPanelId}
            onClick={() => setReactOpen((v) => !v)}
          >
            {REACTIONS.filter((r) => counts[r.id] > 0).map((r) => (
              <span key={r.id} className="pc-chip">
                <span aria-hidden>{r.icon}</span>
                <span className="pc-chip-n">{counts[r.id]}</span>
                <span className="pc-sr">{tPlain(r.key, viewerLang)}</span>
              </span>
            ))}
          </button>
        )}
      </div>

      {reactOpen && (
        <div
          id={reactPanelId}
          ref={reactPanelRef}
          className="pc-reactpanel"
          role="group"
          aria-label={t("cardReactions", viewerLang)}
        >
          {REACTIONS.map((r) => {
            const on = mine === r.id;
            return (
              <button
                key={r.id}
                type="button"
                data-ux-role="control"
                className={on ? "pc-react on" : "pc-react"}
                aria-pressed={on}
                aria-disabled={!myClientId}
                onClick={() => pickReaction(r.id)}
              >
                <span aria-hidden className="pc-react-ico">{r.icon}</span>
                <span className="pc-react-lb">{tPlain(r.key, viewerLang)}</span>
                {/* 선택 표시는 색만으로 하지 않는다 — 체크와 테두리로도 알린다. */}
                {on && <span aria-hidden className="pc-react-ck">✓</span>}
                {counts[r.id] > 0 && <span className="pc-react-n">{counts[r.id]}</span>}
              </button>
            );
          })}
        </div>
      )}
      {reactError && (
        <p data-ux-role="secondary" className="pc-note" role="status">{reactError}</p>
      )}

      {/* ── 답장 목록 ── */}
      {commentsOpen && (
        <div className="pc-comments">
          {comments.length === 0 ? (
            <p data-ux-role="body" className="pc-note">{t("noComments", viewerLang)}</p>
          ) : (
            comments.map((comment) => {
              const isPendingComment = comment.status === "pending";
              const canDeleteThis =
                isTeacher ||
                (myClientId &&
                  comment.authorClientId === myClientId &&
                  Date.now() - comment.timestamp < 5 * 60 * 1000);
              const displayText = comment.translations?.[viewerLang] || comment.text;
              return (
                <div key={comment.id} className="pc-comment">
                  <p data-ux-role="secondary" className="pc-comment-who">
                    <bdi>{comment.authorName}</bdi>
                    {isPendingComment ? ` · ${t("commentPending", viewerLang)}` : ""}
                  </p>
                  <p data-ux-role="body" data-ux-reading className="pc-body">{displayText}</p>
                  <div className="pc-actions">
                    <ListenButton id={`c:${comment.id}`} text={displayText} lang={viewerLang} />
                    {isTeacher && isPendingComment && (
                      <button type="button" data-ux-role="control" className="pc-btn" onClick={() => approveComment(comment.id)}>{tPlain("approve", viewerLang)}</button>
                    )}
                    {canDeleteThis && (
                      <button type="button" data-ux-role="control" className="pc-btn danger" onClick={() => deleteComment(comment.id, comment)}>{tPlain("deleteComment", viewerLang)}</button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {commentError && (
            <p data-ux-role="body" className="pc-state warn" role="alert">{commentError}</p>
          )}

          <label data-ux-role="label" className="pc-label" htmlFor={`pc-reply-${card.id}`}>{tPlain("cardReply", viewerLang)}</label>
          <input
            id={`pc-reply-${card.id}`}
            className="pc-input"
            value={commentInput}
            onChange={(e) => {
              const value = e.target.value;
              setCommentInput(value);
              const key = `draft:comment:${roomCode}:${card.id}`;
              if (commentDraftTimer.current) clearTimeout(commentDraftTimer.current);
              commentDraftTimer.current = setTimeout(() => {
                if (value) localStorage.setItem(key, value);
              }, 500);
            }}
            onKeyDown={enterUnlessComposing(submitComment)}
            placeholder={t("commentPlaceholder", viewerLang)}
            readOnly={submittingComment}
          />
          <button
            type="button"
            data-ux-role="control"
            className="pc-btn"
            aria-disabled={!commentInput.trim() || submittingComment}
            aria-busy={submittingComment}
            onClick={submitComment}
          >{submittingComment ? t("commentTranslating", viewerLang) : t("submitComment", viewerLang)}</button>
        </div>
      )}
    </article>
  );
}

/* ── 읽기 카드 규칙 ───────────────────────────────────────────────────
   카드는 가용 폭 전체를 쓰고, 읽는 글줄만 42ch 로 묶는다. 글자 크기는 토큰이
   정한다 — 여기서 px 을 새로 만들지 않는다 (README §6.2). */
export const CARD_CSS = `
.pc-card{
  display: grid; gap: var(--ux-space-3);
  width: 100%; box-sizing: border-box;
  background: var(--ux-surface);
  border: 2px solid var(--ux-primary-border);
  border-inline-start: 8px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-4);
  box-shadow: 0 4px 14px rgba(137,83,0,.10);
  /* 카드로 스크롤할 때 고정 헤더·하단 버튼에 가리지 않게 한다. */
  scroll-margin-top: 6rem; scroll-margin-bottom: 6rem;
}
.pc-card.pending{ border-style: dashed; }
.pc-who{ display: flex; align-items: center; gap: var(--ux-space-3); flex-wrap: wrap; }
.pc-avatar{
  width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--ux-primary-ink); font-weight: 900;
  overflow: hidden;
  /* 모양은 통일한다 — 같은 지름의 정원 + 같은 테두리. 바탕색만 주제별로 다르다. */
  border: 2px solid var(--ux-primary-border);
  box-sizing: border-box;
}
/* 원 대비 그림을 크게. 예전에는 44px 원에 30px 그림이라(68%) 동물이 작아
   보였다. 40px(91%)로 키우고 살짝 아래로 내려 얼굴이 원 가운데 오게 한다 —
   이 그림들은 머리가 위쪽에 있어 정중앙에 놓으면 아래가 비어 보인다.
   크기는 여기서 정하지 않는다: AnimalArt 가 size prop 을 인라인 style 로
   넣어서 클래스보다 우선한다. 여기서 %로 다시 쓰면 조용히 무시된다. */
.pc-avatar-art{ object-fit: contain; display: block; transform: translateY(4%); }
.pc-who-text{ display: grid; gap: 2px; min-width: 0; flex: 1; }
.pc-name{ font-weight: 900; color: var(--ux-ink); overflow-wrap: anywhere; }
.pc-meta{ overflow-wrap: anywhere; }
.pc-owner-tools{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; }

.pc-img-btn{ padding: 0; border: none; background: none; cursor: zoom-in; width: 100%; }
.pc-img{ width: 100%; height: auto; display: block; border-radius: var(--ux-radius-surface); }
.pc-video{ position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: var(--ux-radius-surface); overflow: hidden; }
.pc-video iframe{ position: absolute; inset: 0; width: 100%; height: 100%; border: none; }

.pc-read{ display: grid; gap: var(--ux-space-2); }
/* 그리드 자식이라고 버튼을 카드 폭만큼 늘리지 않는다. */
.pc-read > button, .pc-alt > button{ justify-self: start; }
.pc-read-tag{ font-weight: 800; }
.pc-body{
  margin: 0; color: var(--ux-ink);
  word-break: keep-all; overflow-wrap: anywhere;
}
.pc-body.pre{ white-space: pre-wrap; }
.pc-body.clamp{
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 6;
  overflow: hidden;
}
.pc-sub{ display: grid; gap: var(--ux-space-2); justify-items: start; }
.pc-alt{
  display: grid; gap: var(--ux-space-2); justify-items: start; width: 100%; box-sizing: border-box;
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3);
}
.pc-state{
  margin: 0; display: grid; gap: var(--ux-space-2); justify-items: start;
  color: var(--ux-ink-soft); font-weight: 700;
}
.pc-state.warn{
  color: var(--ux-error);
  border: 2px dashed var(--ux-error); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3); word-break: keep-all; overflow-wrap: anywhere;
}
.pc-state-text{ margin: 0; }
.pc-note{ margin: 0; word-break: keep-all; overflow-wrap: anywhere; }
.pc-label{ font-weight: 800; color: var(--ux-ink); }

/* 카드 아래 조작 줄.
   예전에는 버튼 5개(원문 보기·듣기·답장·공감·요약)가 전부 같은 굵은 갈색
   테두리로 **3줄에 걸쳐 왼쪽에 쌓여** 본문(2줄)보다 큰 덩어리가 됐다.
   전부 왼쪽에 몰려 오른쪽이 비는 것도 좌편향으로 보였다(사용자 지적).

   고친 규칙:
    - 한 줄로 두고 좌우로 나눈다. 읽기 보조(듣기·원문)는 왼쪽에서 **낮은 강조**,
      대화 동작(답장·공감)은 오른쪽에서 평소 강조.
    - 굵은 갈색 테두리를 모든 버튼에 두르지 않는다. 보조는 테두리 없이 두고
      hover/focus 에서만 바탕을 준다 — 조작 영역 크기는 그대로 지킨다. */
.pc-actions{
  display: flex; gap: var(--ux-space-2); flex-wrap: wrap;
  align-items: center; justify-content: space-between;
}
.pc-act-read, .pc-act-talk{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; align-items: center; }
.pc-act-talk{ margin-left: auto; }
/* 보조 조작 — 크기는 유지하고 시각 무게만 낮춘다. */
.pc-actions .pc-act-read .pc-btn{
  border-color: transparent; background: transparent; font-weight: 700;
  color: var(--ux-ink-soft);
}
.pc-actions .pc-act-read .pc-btn:hover,
.pc-actions .pc-act-read .pc-btn:focus-visible{
  background: var(--ux-surface-sunk); color: var(--ux-ink);
}
.pc-reactions{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; }

/* ── 반응 (U06) ─────────────────────────────────────────────────────
   기본은 '공감하기' 한 버튼 + 0보다 큰 반응의 요약 칩. 세부 5종은 눌러야
   열린다 — 카드마다 5개를 상시 깔면 카드 50개 화면에서 조작이 폭발한다. */
/* 공감 줄도 조작 줄과 같은 축에 맞춘다 — 왼쪽에 요약, 오른쪽에 공감하기.
   전부 왼쪽에 몰리면 카드 오른쪽이 계속 비어 좌편향으로 보인다. */
.pc-reactbar{
  display: flex; gap: var(--ux-space-2); flex-wrap: wrap; align-items: center;
  justify-content: space-between;
}
.pc-reactbar > .pc-btn{ order: 2; margin-left: auto; }
.pc-reactbar > .pc-chipsum{ order: 1; }
.pc-chipsum{
  display: inline-flex; gap: var(--ux-space-2); align-items: center;
  background: transparent; border: 2px solid transparent; cursor: pointer;
  padding: var(--ux-space-1) var(--ux-space-2); border-radius: var(--ux-radius-pill);
  font-family: inherit; color: var(--ux-ink-soft);
}
.pc-chipsum:hover{ background: var(--ux-surface-sunk); }
.pc-chip{ display: inline-flex; gap: 2px; align-items: center; font-size: var(--ux-font-secondary); }
.pc-chip-n{ font-weight: 700; color: var(--ux-ink); }
/* 스크린리더에만 읽히는 반응 이름 — 아이콘만으로 뜻이 남지 않게 한다. */
.pc-sr{
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
/* 좁은 칼럼(패들렛은 250px 안팎)에서 1열 5행이 되면 패널이 카드 밖으로 밀려
   잘린다. min() 으로 최소 폭을 낮춰 최소 2열을 확보한다 (04 §5). */
.pc-reactpanel{
  display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 86px), 1fr));
  gap: var(--ux-space-2); margin-top: var(--ux-space-2);
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2);
  /* 태블릿 세로처럼 칼럼 하나가 화면 폭을 다 쓰면 버튼이 과하게 늘어난다. */
  max-width: 560px;
}
.pc-react{
  display: flex; align-items: center; gap: 4px; justify-content: center;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 700;
  padding-left: var(--ux-space-2); padding-right: var(--ux-space-2);
  min-width: 0;
}
/* 선택은 색만으로 알리지 않는다 — 굵은 테두리와 체크를 함께 쓴다. */
.pc-react[aria-pressed="true"], .pc-react.on{
  border: 3px solid var(--ux-selected-border); background: var(--ux-primary-fill);
  color: var(--ux-primary-ink);
}
.pc-react-ico{ font-size: 1.15em; line-height: 1; }
/* 긴 번역(예: "Cheering you on")이 2열 칸을 넘치지 않게 접는다.
   아이콘만 남기지 않는다 — 아이콘 단독은 뜻이 모호하다. */
.pc-react-lb{ min-width: 0; overflow-wrap: anywhere; word-break: keep-all; }
.pc-react-n{ font-weight: 800; }
/* 데스크톱: 버튼이 한 줄에 하나씩 쌓이면 카드가 세로로 한없이 길어진다.
   마우스를 쓰는 폭에서는 칩처럼 줄여 한 줄에 여러 개가 들어가게 한다.
   '큰 글씨' 를 고른 사용자에게는 적용하지 않는다. */
@media (min-width: 1024px){
  :root:not([data-ux-text="large"]) .pc-btn[data-ux-role="control"]{
    min-width: 0;   /* 높이는 밀도 토큰(44px)을 그대로 지킨다 — 줄어드는 건 가로다 */
    font-size: var(--ux-font-secondary);
    padding: var(--ux-space-1) var(--ux-space-3);
    border-radius: var(--ux-radius-pill);
  }
}
.pc-btn{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
  white-space: normal; word-break: keep-all; overflow-wrap: anywhere;
  display: inline-flex; align-items: center; justify-content: center; gap: var(--ux-space-2);
  box-sizing: border-box; max-width: 100%;
}
.pc-btn.danger{ border-color: var(--ux-error); color: var(--ux-error); }
.pc-btn[aria-pressed="true"], .pc-btn.on{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }
.pc-btn[aria-disabled="true"]{ border-style: dashed; color: var(--ux-ink-soft); }

.pc-comments{ display: grid; gap: var(--ux-space-3); border-top: 2px solid var(--ux-surface-sunk); padding-top: var(--ux-space-3); }
.pc-comment{ display: grid; gap: var(--ux-space-2); background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface); padding: var(--ux-space-3); }
.pc-comment-who{ margin: 0; overflow-wrap: anywhere; }
.pc-input, .pc-textarea{
  width: 100%; box-sizing: border-box; min-height: var(--ux-control-min);
  font-family: inherit; font-size: var(--ux-font-body); font-weight: 600;
  color: var(--ux-ink); background: var(--ux-surface);
  border: 2px solid var(--ux-ink-soft); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2) var(--ux-space-3);
}
.pc-textarea{ line-height: var(--ux-lh-reading); resize: vertical; }
`;

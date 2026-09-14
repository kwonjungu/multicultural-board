"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
import AppIcon from "./ui/child/AppIcon";
import MoodArt from "./ui/child/MoodArt";
import { LEGACY_REACTIONS, reactionLabel, reactionOption, type ReactionOption } from "@/lib/cardReactions";
import { MOOD_QUADRANTS, moodsByQuadrant } from "@/lib/beeMoods";
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
  /** 소리가 안 났을 때 그 이유. 조용한 실패를 없애기 위한 것이다. */
  const [speakNote, setSpeakNote] = useState<string | null>(null);
  const playToken = useRef(0);
  /** 언마운트 정리에서 "지금 이 카드가 읽고 있었나" 를 보기 위한 거울. */
  const speakingRef = useRef<string | null>(null);

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

  useEffect(() => { speakingRef.current = speaking; }, [speaking]);

  /**
   * 카드가 사라지면 그 카드가 읽던 음성을 끊는다.
   *
   * 예전에는 무조건 cancelSpeak() 을 불렀다. 그런데 cancelSpeak() 은 **전역**
   * 정지다 — 실시간 방에서는 새 글이 올라오거나 목록이 바뀔 때 다른 카드가
   * 언마운트되고, 그때마다 지금 듣고 있던 글이 통째로 끊겼다. 읽고 있던
   * 카드일 때만 끊는다.
   */
  useEffect(() => {
    return () => { if (speakingRef.current) cancelSpeak(); };
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
  /** 무드미터 칸별 목록 — 렌더마다 다시 묶지 않는다. */
  const byQuadrant = useMemo(() => moodsByQuadrant(), []);

  /** 이미 눌려 있는 옛 5종만. 0 인 것은 보여줄 이유가 없다. */
  const legacyWithCounts = LEGACY_REACTIONS.filter((r: ReactionOption) => (counts[r.id] ?? 0) > 0);

  /** 하트 버튼에 쓸 글자. 꿀벌 감정은 이름이 데이터에 있고, 옛 5종은 i18n 키다. */
  function reactionText(id: string | null): string {
    if (!id) return tPlain("cardReactOpen", viewerLang);
    const opt = reactionOption(id);
    if (!opt) return tPlain("cardReactOpen", viewerLang);
    return opt.key ? tPlain(opt.key, viewerLang) : reactionLabel(id, viewerLang);
  }

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
    setSpeakNote(null);
    try {
      const r = await speak(text, lang);
      // 실패를 조용히 넘기지 않는다 — 왜 소리가 안 나는지 화면이 말해야
      // 아이도 선생님도 다음에 무엇을 할지 안다.
      if (r === "muted") setSpeakNote("소리가 꺼져 있어요. 설정에서 소리를 켜 주세요.");
      else if (r === "failed") setSpeakNote("소리를 낼 수 없어요. 기기 소리와 탭 음소거를 확인해 주세요.");
    } catch {
      setSpeakNote("소리를 낼 수 없어요. 기기 소리와 탭 음소거를 확인해 주세요.");
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
        className="pc-btn pc-listen"
        aria-pressed={on}
        onClick={() => toggleSpeak(id, text, lang)}
      >
        {/* U03 — 듣기에는 03 에셋가이드의 speaker 그림 아이콘을 쓴다.
            멈춤에 해당하는 그림은 manifest 에 없으므로 그때만 기호를 쓴다. */}
        {on
          ? <span aria-hidden className="pc-btn-ico">⏹</span>
          : <AppIcon name="speaker" size={22} className="pc-btn-ico" />}
        <span className="pc-btn-lb">
          {(on ? tPlain("cardStop", viewerLang) : tPlain("cardListen", viewerLang)) + suffix}
        </span>
      </button>
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

          {/* 펼친 다른 언어 본문만 여기 남는다. 여는 버튼은 아래 조작 줄로
              옮겼다 — 번역·스피커·댓글·하트가 한 행에 있어야 한다. */}
          {otherLangs.length > 0 && showOthers && (
            <div className="pc-sub">
              {otherLangs.map((l) => (
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

      {/* ── 5. 조작 한 줄 ──
             듣기(읽기 보조)는 왼쪽에서 낮은 강조, 답장·공감(대화)은 오른쪽.
             예전에는 이 줄과 공감 줄이 **따로** 있어 카드마다 조작이 두 줄로
             늘어났다(사용자 지적: "결국 1행에 다 끝나지게"). 한 줄로 합치고,
             칼럼이 좁아지면 컨테이너 질의로 글자 라벨만 접어 아이콘 + 숫자로
             남긴다 — 줄이 늘어나는 대신 라벨이 접힌다.

             반응 요약 칩은 이 줄에서 뺐다. 한 줄 안에 칩까지 두면 좁은 칼럼에서
             반드시 넘친다. 어떤 공감이 몇 개인지는 하트를 눌러 여는 패널이
             그대로 보여준다(패널의 pc-react-n). 줄에는 합계만 남긴다. */}
      <div className="pc-actions">
        <div className="pc-act-read">
          {/* 번역 — 다른 언어로 같은 글을 볼 수 있을 때만 나온다. */}
          {otherLangs.length > 0 && (
            <button
              type="button"
              data-ux-role="control"
              className="pc-btn pc-tr"
              aria-pressed={showOthers}
              onClick={() => setShowOthers((v) => !v)}
            >
              <span aria-hidden className="pc-btn-ico">🌐</span>
              <span className="pc-btn-lb">{tPlain("cardOtherLangs", viewerLang)}</span>
            </button>
          )}
          <ListenButton
            id="mine"
            text={translating || translateFailed ? card.originalText : readingText}
            lang={translating || translateFailed ? card.authorLang : viewerLang}
          />
        </div>
        <div className="pc-act-talk">
          {/* 답장 — 편지 */}
          <button
            type="button"
            data-ux-role="control"
            className="pc-btn pc-reply"
            aria-expanded={commentsOpen}
            onClick={() => setCommentsOpen((v) => !v)}
          >
            <span aria-hidden className="pc-btn-ico">💌</span>
            <span className="pc-btn-lb">{tPlain("cardReply", viewerLang)}</span>
            {commentCount > 0 && <span className="pc-btn-n">{commentCount}</span>}
          </button>

          {/* 공감 — 하트 하나로 열고, 세부 5종은 아래 패널에서 고른다.
              이미 고른 아이에게는 자기가 고른 아이콘이 하트 자리에 온다. */}
          <button
            type="button"
            ref={reactTriggerRef}
            data-ux-role="control"
            className={mine ? "pc-btn pc-heart on" : "pc-btn pc-heart"}
            aria-expanded={reactOpen}
            aria-controls={reactPanelId}
            aria-disabled={!myClientId}
            onClick={() => setReactOpen((v) => !v)}
          >
            {/* 고른 뒤에는 그 감정의 꿀벌이 하트 자리에 온다 — 무엇을 골랐는지
                패널을 열지 않고도 보인다. 아직 안 골랐으면 빈 하트. */}
            {mine
              ? <MoodArt id={myReaction?.art ?? mine} size={24} className="pc-btn-ico" />
              : <span aria-hidden className="pc-btn-ico">🤍</span>}
            <span className="pc-btn-lb">{reactionText(mine)}</span>
            {total > 0 && <span className="pc-btn-n">{total}</span>}
          </button>
        </div>
      </div>

      {reactOpen && (
        <div
          id={reactPanelId}
          ref={reactPanelRef}
          className="pc-reactpanel"
          role="group"
          aria-label={t("cardReactions", viewerLang)}
        >
          {/* 무드미터 네 칸. 20종을 한 덩어리로 늘어놓으면 아이가 못 고른다 —
              "기운이 솟을 때 / 마음이 놓일 때" 처럼 칸 이름을 붙여 나눈다. */}
          {(["yellow", "green", "red", "blue"] as const).map((q) => (
            <div key={q} className="pc-moodgroup">
              <p data-ux-role="secondary" className="pc-moodhead">
                <span aria-hidden className={`pc-mooddot ${q}`} />
                {viewerLang === "ko" ? MOOD_QUADRANTS[q].ko : MOOD_QUADRANTS[q].en}
              </p>
              <div className="pc-moodrow">
                {byQuadrant[q].map((m: { id: string }) => {
                  const on = mine === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      data-ux-role="control"
                      className={on ? "pc-react on" : "pc-react"}
                      aria-pressed={on}
                      aria-disabled={!myClientId}
                      onClick={() => pickReaction(m.id)}
                    >
                      <MoodArt id={m.id} size={34} className="pc-react-ico" />
                      <span className="pc-react-lb">{reactionLabel(m.id, viewerLang)}</span>
                      {/* 선택 표시는 색만으로 하지 않는다 — 체크와 테두리로도 알린다. */}
                      {on && <span aria-hidden className="pc-react-ck">✓</span>}
                      {counts[m.id] > 0 && <span className="pc-react-n">{counts[m.id]}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 옛 5종(좋아요·고마워…)은 더 고를 수 없지만, 이미 눌린 것은
              사라지면 안 된다. 개수가 있을 때만 읽기 전용으로 보여준다. */}
          {legacyWithCounts.length > 0 && (
            <div className="pc-moodgroup">
              <p data-ux-role="secondary" className="pc-moodhead">{tPlain("cardReactions", viewerLang)}</p>
              <div className="pc-moodrow">
                {legacyWithCounts.map((r: ReactionOption) => (
                  <span key={r.id} className="pc-react past">
                    <MoodArt id={r.art} size={28} className="pc-react-ico" />
                    <span className="pc-react-lb">{r.key ? tPlain(r.key, viewerLang) : r.id}</span>
                    <span className="pc-react-n">{counts[r.id]}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {speakNote && (
        <p data-ux-role="secondary" className="pc-note" role="status">🔇 {speakNote}</p>
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
  /* 조작 줄이 칼럼 폭에 반응해야 한다. 뷰포트 질의로는 안 된다 — 패들렛은
     넓은 화면에서도 칼럼 하나가 250px 안팎이라 "화면은 넓은데 카드는 좁은"
     상황이 정상이다. 카드 자신을 컨테이너로 삼아 카드 폭으로 판단한다. */
  container-type: inline-size;
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

/* ── 카드 안 글은 절대 글자 중간에서 잘리지 않는다 ────────────────────
   실측한 원인(추측 아님): 위의 .pc-name{overflow-wrap:anywhere} 는 **적용되지
   않고 있었다**. 전역 토큰 [data-ux-role]{overflow-wrap:break-word;
   word-break:keep-all} 이 특이도가 (0,1,0) 로 클래스 하나와 같은데, 토큰
   style 태그가 카드 CSS 보다 **뒤에** 주입돼 순서로 이긴다.
   (probe: .pc-name 의 computed overflow-wrap = break-word)

   break-word 는 정말 넘칠 때만 끊고 **min-content 폭은 가장 긴 토막을 지킨다**.
   그래서 공백 없는 45자 이름("응우옌티민카이…")이 .pc-who-text 그리드 트랙의
   최소 폭을 261px 로 밀었고, 205px 짜리 트랙을 넘쳐 카드(244px)가 333px 까지
   벌어졌다 — 사용자가 본 "오른쪽 끝에서 글자 중간에 잘림" 이 이것이다.
   아래 번역문이 멀쩡했던 이유는 그쪽에는 공백이 있어 어절로 끊겼기 때문이다.

   전역 토큰은 건드리지 않는다 — tokens.ts 의 주석대로 anywhere 를 전역에
   되돌리면 동물 선택 카드의 "토끼" 가 12px 폭으로 짜부라진다. 대신 **카드
   안에서만** 특이도를 (0,2,0) 으로 올려 anywhere 를 되살린다. 카드 안 글은
   전부 문장·이름이라 한 글자 폭으로 짜부라질 flex 라벨이 없다. */
.pc-card .pc-name,
.pc-card .pc-meta,
.pc-card .pc-body,
.pc-card .pc-note,
.pc-card .pc-state.warn,
.pc-card .pc-comment-who,
.pc-card .pc-read-tag,
.pc-card .pc-label{ overflow-wrap: anywhere; }
/* 그리드/플렉스 자식의 자동 최소 폭(min-content)이 카드를 벌리지 못하게 한다.
   위의 anywhere 로 min-content 자체가 작아지지만, 이미지·버튼처럼 줄일 수 없는
   자식이 섞여도 카드가 넘치지 않도록 상자 쪽에서도 한 번 더 막는다. */
.pc-card .pc-who, .pc-card .pc-read, .pc-card .pc-sub,
.pc-card .pc-alt, .pc-card .pc-comment{ min-width: 0; }

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

/* 카드 아래 조작 줄 — **한 줄로 끝난다**.
   예전에는 조작 줄(듣기·답장)과 공감 줄이 따로 있어 카드마다 두 줄이 됐고,
   flex-wrap:wrap 이라 칼럼이 좁아지면 세 줄, 네 줄로 계속 늘어났다
   (사용자 지적: "반응형으로 결국 1행에 다 끝나지게, 지금 봐봐 늘어나").

   규칙:
    - 한 줄. nowrap 이다. 좁아지면 줄을 늘리는 대신 **글자 라벨을 접는다**.
    - 왼쪽은 읽기 보조(듣기) — 테두리 없이 낮은 강조.
    - 오른쪽은 대화(답장 편지 · 공감 하트) — 평소 강조.
    - 라벨을 접어도 아이콘과 숫자는 남고, 뜻은 aria-label 이 아니라 버튼 안의
      .pc-btn-lb 가 스크린리더용으로 계속 읽힌다(감추는 건 시각뿐). */
.pc-actions{
  display: flex; gap: var(--ux-space-2); flex-wrap: nowrap;
  align-items: center; justify-content: space-between; min-width: 0;
}
.pc-act-read, .pc-act-talk{
  display: flex; gap: var(--ux-space-2); flex-wrap: nowrap;
  align-items: center; min-width: 0;
}
/* 읽기 쪽은 줄어들 수 있어야 한다. 안 그러면 자기 상자를 넘쳐 흘러 오른쪽
   대화 버튼 **아래로 깔리고**, 그 위를 답장 버튼이 덮어 듣기가 안 눌린다
   (한 줄로 합치면서 실제로 그렇게 됐다). 넘치는 대신 라벨이 접히게 둔다. */
.pc-act-read{ flex: 0 1 auto; }
.pc-act-talk{ margin-left: auto; flex: 0 0 auto; }

/* 네 버튼은 **같은 알약/원**이다.
   예전에는 왼쪽 둘만 border-color:transparent; background:transparent 라
   "두개는 원 속, 두개는 없" 어 보였다(사용자 지적: "다 원 안에 넣어").
   무게 차이는 테두리 유무가 아니라 **채움**으로만 남긴다:
     - 읽기 보조(번역·듣기) = 비운 원 (카드와 같은 흰 바탕)
     - 대화(답장·공감)      = 채운 원 (--ux-surface-sunk)
   테두리 색·두께·모서리·크기는 넷이 똑같다. */
/* 아래 규칙은 **카드 본체의 조작 줄에만** 건다(.pc-card > .pc-actions).
   답장 목록 안(.pc-comment .pc-actions)에도 같은 클래스가 쓰여서, 자손
   선택자로 걸면 교사용 '승인'·'삭제' 버튼까지 원이 되고 danger 의 빨간
   테두리가 특이도 싸움에서 밀려 사라진다. */
.pc-card > .pc-actions .pc-btn{
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  white-space: nowrap; min-width: 0;
  /* 크기는 토큰(--ux-control-min: 터치 48 / 마우스 44)에 맡긴다. 인라인으로
     px 을 박지 않는다 — 여기서는 '토큰 값 이하로 내려가지 않게' 만 못박는다. */
  /* 높이는 토큰 값 **그대로** 못박고 위아래 여백을 0 으로 둔다.
     왜: 스피커는 <img>(AppIcon size=22 를 인라인 style 로 박는다)이고 나머지
     셋은 이모지 글자다. 콘텐츠가 높이를 정하게 두면 같은 줄에서 50px 과 54px
     로 갈렸다(실측). 높이를 토큰이 정하면 안에 무엇이 들어와도 넷이 같다 —
     손가락 최소 크기(터치 48 / 마우스 44)는 그 토큰이 지킨다. */
  height: var(--ux-control-min);
  min-height: var(--ux-control-min);
  padding-top: 0; padding-bottom: 0;
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-pill);
  color: var(--ux-ink);
  position: relative;
}
.pc-card > .pc-actions .pc-act-read .pc-btn{ background: var(--ux-surface); font-weight: 700; }
.pc-card > .pc-actions .pc-act-talk .pc-btn{ background: var(--ux-surface-sunk); }
.pc-card > .pc-actions .pc-act-read .pc-btn:hover,
.pc-card > .pc-actions .pc-act-read .pc-btn:focus-visible{ background: var(--ux-surface-sunk); }
.pc-card > .pc-actions .pc-act-talk .pc-btn:hover,
.pc-card > .pc-actions .pc-act-talk .pc-btn:focus-visible{ background: var(--ux-primary-fill); color: var(--ux-primary-ink); }
/* 눌린 상태·공감 선택은 위 '채움' 규칙보다 뒤에, 더 높은 특이도로 둔다.
   아래쪽 .pc-btn[aria-pressed="true"] / .pc-heart.on 은 (0,2,0) 이라 위
   (0,4,0) 규칙에 밀린다 — 그대로 두면 하트를 골라도 노란 채움이 안 뜬다.
   테두리 3px 은 색 말고도 선택을 알리는 신호라 유지한다(box-sizing:
   border-box 라 바깥 크기는 넷이 그대로 같다). */
.pc-card > .pc-actions .pc-act-read .pc-btn[aria-pressed="true"],
.pc-card > .pc-actions .pc-act-talk .pc-btn[aria-pressed="true"],
.pc-card > .pc-actions .pc-act-read .pc-btn.on,
.pc-card > .pc-actions .pc-act-talk .pc-btn.on{
  border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk);
}
.pc-card > .pc-actions .pc-act-talk .pc-heart.on{
  border: 3px solid var(--ux-selected-border);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
}

/* 버튼 속 아이콘 · 라벨 · 숫자.
   아이콘 상자를 **고정 크기**로 만든다. 이모지(🌐·💌·🤍)는 글자라 글꼴이
   높이를 정하고 스피커·무드는 <img> 라 제 픽셀이 높이를 정한다 — 그래서
   같은 줄의 버튼 높이가 48.3px 과 50px 로 갈렸다(실측). 상자가 고정이면
   안에 무엇이 들어와도 버튼 높이가 같다. */
.pc-btn-ico{
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; flex: 0 0 auto;
  font-size: 1.15em; line-height: 1;
}
.pc-btn-ico > *{ display: block; max-width: 100%; max-height: 100%; }
.pc-btn-lb{ min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.pc-btn-n{
  font-weight: 800; flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
}

/* 공감 하트 — 고른 뒤에는 테두리와 바탕으로도 알린다(색만으로 알리지 않는다). */
.pc-heart.on{
  border-color: var(--ux-selected-border);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
}

/* 좁은 칼럼: 글자 라벨을 접고 아이콘(+숫자)만 남긴다. 줄은 절대 늘리지 않는다.

   문턱을 260px → 480px 로 올린 근거(전부 실측):
    - 라벨을 다 펴면 네 버튼이 97.5 + 107.2 + 105.8 + 122.7 = 433px, 간격 24px
      까지 **457px** 이 필요하다(베트남어 라벨 기준).
    - 390px 휴대폰의 카드 안쪽은 316px 이다. 옛 문턱 260px 을 넘으니 라벨이
      펴졌는데 457px 이 316px 에 들어갈 리 없어, 읽기 쪽 버튼이 36px 로
      짓눌리다 답장 버튼과 **겹쳤다**(실측: 390 에서 겹침 1건, .pc-act-read
      71<80). 문턱이 화면이 아니라 '라벨이 실제로 들어가는 폭' 이어야 했다.
    - 480px 이면 휴대폰(316px)과 칼럼 보기(카드 안쪽 242~303px)는 접히고,
      단일 주제 보기(820 세로, 카드 안쪽 620px)는 펴진 채로 남는다.
    - '큰 글씨' 도 같은 문턱을 쓴다. 칼럼 폭을 큰 글씨에서 340~420px 로 함께
      키웠기 때문에(PadletBoard) 카드 안쪽이 282~362px 로 480 아래에 머문다 —
      따로 400px 문턱을 둘 이유가 없어졌다. */
@container (max-width: 480px){
  .pc-card > .pc-actions .pc-btn-lb{
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  /* 라벨이 접히면 남는 건 아이콘뿐이다 — 이때 네 버튼은 **지름이 같은 정원**
     이어야 한다. 지름은 토큰이 정한다(--ux-control-min: 터치 48 / 마우스 44).
     숫자를 원 안에 두면 그 버튼만 넓어져 넷이 어긋난다(실측: 번역 28px,
     답장 48.5px, 하트 63.2px). 그래서 숫자는 원 위에 배지로 얹는다. */
  .pc-card > .pc-actions .pc-btn{
    width: var(--ux-control-min); height: var(--ux-control-min);
    min-width: var(--ux-control-min);
    padding-left: 0; padding-right: 0; gap: 0;
  }
  /* 배지는 **가로로는 원 밖으로 나가지 않는다** (right: 0 = 안쪽 상자 오른쪽
     끝). -4px 로 내밀었더니 원의 scrollWidth 가 clientWidth 를 4px 넘겨
     '카드 안 잘림 0개' 계약을 깼다(실측: 40<44). 위로만 6px 띄워 아이콘과
     겹치는 면을 줄이고, 카드 색 테두리로 원과 분리해 읽는다. */
  .pc-card > .pc-actions .pc-btn-n{
    position: absolute; top: -6px; right: 0;
    min-width: 20px; height: 20px; box-sizing: border-box; padding: 0 4px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: var(--ux-font-secondary); line-height: 1;
    background: var(--ux-selected-border); color: var(--ux-surface);
    border: 2px solid var(--ux-surface); border-radius: var(--ux-radius-pill);
  }
}
/* 그래도 더 좁아지면 간격만 줄인다. 원 지름은 손가락 최소 크기라 줄이지
   않는다 — 예전에 여기서 min-width 를 0 으로 풀어 버튼이 짓눌렸다. */
@container (max-width: 240px){
  .pc-card > .pc-actions{ gap: var(--ux-space-1); }
}
.pc-reactions{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; }

/* ── 반응 (U06) ─────────────────────────────────────────────────────
   조작 줄의 하트 하나로 열고, 세부 5종은 아래 패널에서 고른다 — 카드마다
   5개를 상시 깔면 카드 50개 화면에서 조작이 폭발한다. 어떤 공감이 몇 개인지도
   이 패널이 보여준다(요약 칩을 따로 두면 조작 줄이 한 줄을 넘긴다). */
/* 스크린리더에만 읽히는 반응 이름 — 아이콘만으로 뜻이 남지 않게 한다. */
.pc-sr{
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
/* 좁은 칼럼(패들렛은 250px 안팎)에서 1열 5행이 되면 패널이 카드 밖으로 밀려
   잘린다. min() 으로 최소 폭을 낮춰 최소 2열을 확보한다 (04 §5). */
/* 무드미터 패널 — 20종을 한 격자에 늘어놓으면 아이가 못 고른다.
   네 칸으로 나누고 칸마다 이름을 붙인다. 칸 안에서만 감싸 내려간다. */
.pc-reactpanel{
  display: grid; gap: var(--ux-space-3); margin-top: var(--ux-space-2);
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3);
  max-width: 620px;
  /* 20종이면 카드 안에서 1000px 넘게 길어진다(실측 1037px). 카드가 통째로
     늘어나면 그 아래 다른 글이 화면 밖으로 밀려난다. 패널 높이를 묶고 안에서
     스크롤한다 — 칸 제목이 있어 어디쯤인지 잃지 않는다. */
  max-height: min(52svh, 420px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.pc-moodgroup{ display: grid; gap: var(--ux-space-1); }
.pc-moodhead{
  display: flex; align-items: center; gap: 6px; margin: 0;
  color: var(--ux-ink-soft); font-weight: 700;
}
/* 칸 색은 무드미터 관례(빨강·노랑·파랑·초록)를 작은 점으로만 쓴다 —
   면을 칠하면 화면이 알록달록해져 정작 꿀벌 그림이 안 보인다. */
.pc-mooddot{ width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
.pc-mooddot.red{ background: #EF4444; }
.pc-mooddot.yellow{ background: #F59E0B; }
.pc-mooddot.blue{ background: #3B82F6; }
.pc-mooddot.green{ background: #22C55E; }
.pc-moodrow{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); }
/* 좁은 칼럼(패들렛은 250px 안팎)에서는 20개가 세로로 한없이 길어진다.
   글자 라벨을 접어 그림 격자로 바꾼다 — 라벨은 스크린리더용으로 남는다.
   조작 줄에서 쓴 것과 같은 규칙이다(줄을 늘리는 대신 글자를 접는다). */
@container (max-width: 420px){
  .pc-moodrow{ display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); }
  .pc-react .pc-react-lb{
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  .pc-react{ justify-content: center; padding-left: var(--ux-space-1); padding-right: var(--ux-space-1); }
}
/* 더 고를 수 없는 옛 항목 — 눌리는 것처럼 보이면 안 된다. */
.pc-react.past{ opacity: .75; cursor: default; border-style: dashed; }
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

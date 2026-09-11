"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, onValue, off, set, remove, update } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { COLUMNS_DEFAULT, LANGUAGES, CARD_PALETTES } from "@/lib/constants";
import { CardData, UserConfig, PostData, RoomConfig, CardStatus, CommentData } from "@/lib/types";
import { useBackLayer } from "@/lib/backStack";
import { t, tFmt } from "@/lib/i18n";
import PadletCard, { CARD_CSS } from "./PadletCard";
import PostModal from "./PostModal";
import PptxTranslateModal from "./PptxTranslateModal";
import DiscussionCreateModal from "./DiscussionCreateModal";
import DiscussionSession from "./DiscussionSession";
import SentencePracticeModal from "./SentencePracticeModal";
import EmotionCardDeck from "./EmotionCardDeck";
import ScopedStyle from "./ui/child/ScopedStyle";
import TextSizeMenu from "./ui/child/TextSizeMenu";
import { pushEmotion, awardEmotionStickerOncePerDay, type EmotionId } from "@/lib/emotions";
import { pushExpressionDedup } from "@/lib/expressionLog";
import { reportQuestEvent } from "@/lib/quests";
import { filterPracticeCards } from "@/lib/sentencePractice";
import { columnIconFor } from "@/lib/assets";
import { QRCodeSVG } from "qrcode.react";

type PendingItem =
  | { kind: "card"; data: CardData }
  | { kind: "comment"; data: CommentData; parentCard: CardData };

interface FirebaseColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

/**
 * 개발용 fixture 주입구 (HARNESS §2 G0). 값이 있으면 이 화면은 Firebase 를
 * 구독하지도, 쓰지도 않는다. 운영 방 명단·게시글을 fixture 로 복제하지 않는다.
 */
export interface BoardFixture {
  columns: FirebaseColumn[];
  cards: CardData[];
}

interface Props {
  user: UserConfig;
  roomCode: string;
  roomLangs: string[];
  onLogout: () => void;
  roomConfig: RoomConfig;
  myClientId: string;
  onPraiseStudent?: (clientId: string, name: string) => void;
  fixture?: BoardFixture;
}

const COL_COLORS = [
  "#F59E0B", "#FF6584", "#43C59E", "#F59E0B", "#3B82F6",
  "#D97706", "#EC4899", "#14B8A6", "#F97316", "#10B981",
];

/** 색 선택을 색동그라미(아이콘) 하나로 두지 않기 위한 이름표. */
const COL_COLOR_NAMES: Record<string, string> = {
  "#F59E0B": "노랑", "#FF6584": "분홍", "#43C59E": "민트", "#3B82F6": "파랑",
  "#D97706": "주황", "#EC4899": "진분홍", "#14B8A6": "청록", "#F97316": "살구", "#10B981": "초록",
};

/** 컬럼 제목 앞의 이모지·장식 문자를 떼어 읽을 제목만 남긴다. */
function cleanTitle(title: string) {
  return title.replace(/^[^A-Za-z가-힣]+/, "").trim() || title;
}

export default function PadletBoard({ user, roomCode, roomLangs, onLogout, roomConfig, myClientId, onPraiseStudent, fixture }: Props) {
  /** fixture 가 주입되면 네트워크 경계를 통째로 끈다. */
  const offline = !!fixture;
  const [cards, setCards] = useState<CardData[]>(fixture?.cards ?? []);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [columns, setColumns] = useState<FirebaseColumn[]>(
    fixture?.columns ?? COLUMNS_DEFAULT.map((col, i) => ({ ...col, order: i }))
  );
  const [modal, setModal] = useState<{ colId: string; colTitle: string; colColor: string } | null>(null);
  const [emotionOpen, setEmotionOpen] = useState(false);
  const [emotionToast, setEmotionToast] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const lang = user.myLang;

  // Teacher state
  const isTeacher = user.isTeacher ?? false;
  const [teacherLangs, setTeacherLangs] = useState<string[]>(roomLangs);

  // Management modal state
  const [showManage, setShowManage] = useState(false);
  const [editTitle, setEditTitle] = useState<Record<string, string>>({});

  // Room config state (live-updated)
  const [roomConfigState, setRoomConfigState] = useState<RoomConfig>(roomConfig);
  const [rosterText, setRosterText] = useState("");

  // Pending items (cards + comments) for approval panel
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  // Feature modals
  const [showQR, setShowQR] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showPptx, setShowPptx] = useState(false);
  const [showDiscussionCreate, setShowDiscussionCreate] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMinimized, setSessionMinimized] = useState(false);
  const [editModal, setEditModal] = useState<{ card: CardData; colTitle: string; colColor: string } | null>(null);

  // ── 화면 폭이 기준이다 ────────────────────────────────────────────────
  // 좁은 화면(휴대폰·태블릿 세로)은 '지금 주제' 하나만 본다 — 옆으로 미는 보드는
  // 아이가 자기 주제를 못 찾는다(README §6.1).
  // 넓은 화면은 반대다. 패들렛을 쓰는 사람은 전체를 한눈에 보는 걸 기대하고,
  // 데스크톱에는 그럴 공간이 있다. 그래서 넓은 화면의 기본은 '전체 보기'이고
  // 교사뿐 아니라 학생도 두 보기를 직접 고를 수 있다.
  const [wide, setWide] = useState(false);
  const [wideView, setWideView] = useState<"topic" | "all">("all");
  const view: "topic" | "all" = wide ? wideView : "topic";
  const [activeColId, setActiveColId] = useState<string | null>(fixture?.columns?.[0]?.id ?? null);
  /** 교사 전용 주제 관리 패널. 학생 화면에는 렌더되지 않는다. */
  const [colManageOpen, setColManageOpen] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // 컬럼이 바뀌어도(추가·삭제·정렬) 보고 있던 주제를 잃지 않는다.
  useEffect(() => {
    if (columns.length === 0) { setActiveColId(null); return; }
    setActiveColId((prev) => (prev && columns.some((c) => c.id === prev) ? prev : columns[0].id));
  }, [columns]);

  const activeCol = columns.find((c) => c.id === activeColId) ?? columns[0] ?? null;

  // Undo snackbar
  const [undoToast, setUndoToast] = useState<{
    message: string;
    onUndo: () => void;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  function showUndoToast(message: string, onUndo: () => void) {
    setUndoToast((prev) => {
      if (prev) clearTimeout(prev.timeoutId);
      const timeoutId = setTimeout(() => setUndoToast(null), 8000);
      return { message, onUndo, timeoutId };
    });
  }

  function handleUndo() {
    if (!undoToast) return;
    clearTimeout(undoToast.timeoutId);
    undoToast.onUndo();
    setUndoToast(null);
  }

  function dismissToast() {
    if (!undoToast) return;
    clearTimeout(undoToast.timeoutId);
    setUndoToast(null);
  }

  // ── Firebase: rooms/${roomCode}/columns ──
  useEffect(() => {
    if (offline) return;
    const db = getClientDb();
    const colsRef = ref(db, `rooms/${roomCode}/columns`);
    onValue(colsRef, (snap) => {
      const data = snap.val();
      if (!data) {
        const defaults: Record<string, Omit<FirebaseColumn, "id">> = {};
        COLUMNS_DEFAULT.forEach((col, i) => {
          defaults[col.id] = { title: col.title, color: col.color, order: i };
        });
        set(colsRef, defaults);
      } else {
        const list: FirebaseColumn[] = Object.entries(data).map(([id, val]) => ({
          id,
          ...(val as Omit<FirebaseColumn, "id">),
        }));
        list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setColumns(list);
        const initEdit: Record<string, string> = {};
        list.forEach((c) => { initEdit[c.id] = c.title; });
        setEditTitle(initEdit);
      }
    });
    return () => off(colsRef);
  }, [roomCode, offline]);

  // ── Firebase: rooms/${roomCode}/config (full config listener) ──
  useEffect(() => {
    if (offline) return;
    const db = getClientDb();
    const configRef = ref(db, `rooms/${roomCode}/config`);
    onValue(configRef, (snap) => {
      const val = snap.val() as RoomConfig | null;
      if (val) {
        // Normalize Firebase numeric-keyed objects back to arrays
        if (val.roster && !Array.isArray(val.roster)) {
          val.roster = Object.values(val.roster as unknown as Record<string, string>);
        }
        if (val.languages && !Array.isArray(val.languages)) {
          val.languages = Object.values(val.languages as unknown as Record<string, string>);
        }
        setRoomConfigState(val);
        if (Array.isArray(val.languages) && val.languages.length > 0) setTeacherLangs(val.languages);
      }
    });
    return () => off(configRef);
  }, [roomCode, offline]);

  // ── ESC key handler for modals ──
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showManage) setShowManage(false);
        else if (showQR) setShowQR(false);
        else if (showApproval) setShowApproval(false);
        else if (showPptx) setShowPptx(false);
        else if (showDiscussionCreate) setShowDiscussionCreate(false);
        else if (editModal) setEditModal(null);
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [showManage, showQR, showApproval, showPptx, showDiscussionCreate, editModal]);

  // ── Firebase: rooms/${roomCode}/activeSession ──
  useEffect(() => {
    if (offline) return;
    const db = getClientDb();
    const aRef = ref(db, `rooms/${roomCode}/activeSession`);
    const cb = onValue(aRef, (snap) => {
      const id = snap.val() as string | null;
      setActiveSessionId(id);
      if (id) setSessionMinimized(false);
    });
    return () => off(aRef, "value", cb);
  }, [roomCode, offline]);

  // ── Firebase: rooms/${roomCode}/cards ──
  useEffect(() => {
    if (offline) return;
    const db = getClientDb();
    const cardsRef = ref(db, `rooms/${roomCode}/cards`);
    onValue(cardsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setCards([]); setPendingItems([]); return; }

      // Raw data includes nested comments sub-tree
      type RawCard = CardData & { comments?: Record<string, CommentData> };
      const rawList: RawCard[] = Object.values(data);

      // Cards without comments for normal display
      const list: CardData[] = rawList.map(({ comments: _c, ...rest }) => rest as CardData);
      list.sort((a, b) => b.timestamp - a.timestamp);
      setCards(list);

      // Build pending items (cards + comments)
      const pending: PendingItem[] = [];
      for (const raw of rawList) {
        const card = list.find((c) => c.id === raw.id)!;
        if (!card) continue;
        if (raw.status === "pending") pending.push({ kind: "card", data: card });
        if (raw.comments) {
          for (const comment of Object.values(raw.comments)) {
            if (comment.status === "pending") {
              pending.push({ kind: "comment", data: comment, parentCard: card });
            }
          }
        }
      }
      pending.sort((a, b) => {
        const tsA = a.kind === "card" ? a.data.timestamp : a.data.timestamp;
        const tsB = b.kind === "card" ? b.data.timestamp : b.data.timestamp;
        return tsA - tsB;
      });
      setPendingItems(pending);
    });
    return () => off(cardsRef);
  }, [roomCode, offline]);

  // Card visibility
  const visibleCards = isTeacher ? cards : cards.filter((c) => !c.status || c.status === "approved");
  const pendingCount = pendingItems.length;
  const cardsOf = (colId: string) => visibleCards.filter((c) => c.colId === colId);
  const activeCards = activeCol ? cardsOf(activeCol.id) : [];

  // ── Column management ──
  function saveColTitle(colId: string) {
    const title = editTitle[colId]?.trim();
    if (!title || offline) return;
    const db = getClientDb();
    set(ref(db, `rooms/${roomCode}/columns/${colId}/title`), title);
  }

  function changeColColor(colId: string, color: string) {
    if (offline || !color) return;
    const db = getClientDb();
    set(ref(db, `rooms/${roomCode}/columns/${colId}/color`), color);
  }

  function deleteCol(colId: string) {
    const col = columns.find((c) => c.id === colId);
    if (!col || offline) return;
    const db = getClientDb();
    const { id: _id, ...colData } = col;
    remove(ref(db, `rooms/${roomCode}/columns/${colId}`));
    showUndoToast(`"${col.title}" 컬럼을 삭제했습니다`, () => {
      set(ref(db, `rooms/${roomCode}/columns/${colId}`), colData);
    });
  }

  // 삭제는 카드 개수까지 알리고 확인받는다. 삭제 뒤엔 되돌리기 토스트가 한 번 더 안전망.
  function confirmDeleteCol(colId: string) {
    const col = columns.find((c) => c.id === colId);
    if (!col) return;
    const cardCount = cards.filter((c) => c.colId === colId).length;
    const title = cleanTitle(col.title);
    const msg = cardCount > 0
      ? `"${title}" 칸을 삭제할까요?\n안에 있는 카드 ${cardCount}개도 함께 사라집니다.`
      : `"${title}" 칸을 삭제할까요?`;
    if (!window.confirm(msg)) return;
    deleteCol(colId);
  }

  function moveCol(colId: string, direction: "up" | "down") {
    const idx = columns.findIndex((c) => c.id === colId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= columns.length || offline) return;
    const db = getClientDb();
    const myOrder = columns[idx].order;
    const theirOrder = columns[swapIdx].order;
    set(ref(db, `rooms/${roomCode}/columns/${colId}/order`), theirOrder);
    set(ref(db, `rooms/${roomCode}/columns/${columns[swapIdx].id}/order`), myOrder);
  }

  async function deleteCard(cardId: string) {
    if (offline) return;
    const db = getClientDb();
    const { get: dbGet, ref: dbRef } = await import("firebase/database");
    const snap = await dbGet(dbRef(db, `rooms/${roomCode}/cards/${cardId}`));
    const fullCard = snap.val();
    if (!fullCard) return;
    await remove(ref(db, `rooms/${roomCode}/cards/${cardId}`));
    const authorName = typeof fullCard.authorName === "string" ? fullCard.authorName : "";
    showUndoToast(
      authorName ? `"${authorName}"님의 카드를 삭제했습니다` : "카드를 삭제했습니다",
      () => {
        set(ref(db, `rooms/${roomCode}/cards/${cardId}`), fullCard);
      }
    );
  }

  // 패들렛식 즉시 추가 — 누르면 칸이 바로 생기고 교사가 제목을 인라인 편집한다.
  function createColumn(title: string, color: string): void {
    if (offline) return;
    const db = getClientDb();
    const newId = `col_${Date.now()}`;
    const maxOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order)) : -1;
    const nextColor = color || COL_COLORS[columns.length % COL_COLORS.length];
    set(ref(db, `rooms/${roomCode}/columns/${newId}`), {
      title,
      color: nextColor,
      order: maxOrder + 1,
    });
  }

  function addColumnQuick() {
    createColumn("새 칸", COL_COLORS[columns.length % COL_COLORS.length]);
  }

  // ── Approval actions ──
  async function approveCard(cardId: string) {
    if (offline) return;
    const db = getClientDb();
    await update(ref(db, `rooms/${roomCode}/cards/${cardId}`), { status: "approved" as CardStatus });
  }

  async function rejectCard(cardId: string) {
    if (offline) return;
    const db = getClientDb();
    await remove(ref(db, `rooms/${roomCode}/cards/${cardId}`));
  }

  async function approveComment(cardId: string, commentId: string) {
    if (offline) return;
    const db = getClientDb();
    await set(ref(db, `rooms/${roomCode}/cards/${cardId}/comments/${commentId}/status`), "approved" as CardStatus);
  }

  async function rejectComment(cardId: string, commentId: string) {
    if (offline) return;
    const db = getClientDb();
    await remove(ref(db, `rooms/${roomCode}/cards/${cardId}/comments/${commentId}`));
  }

  const handlePost = useCallback(async (data: PostData) => {
    if (posting || !modal) return;
    const { cardType, text, writeLang, imageUrl, youtubeId, status, authorClientId } = data;
    if (cardType === "text" && !text.trim()) return;

    setPosting(true);

    // 교사가 설정한 방 언어 목록으로 번역 (학생도 동일하게 적용)
    const targetLangs =
      cardType === "text"
        ? teacherLangs.filter((l) => l !== writeLang)
        : [];

    const tempId = `temp_${Date.now()}`;
    const tempCard: CardData = {
      id: tempId,
      colId: modal.colId,
      cardType,
      authorLang: writeLang,
      authorName: user.myName,
      isTeacher,
      originalText: text,
      translations: { [writeLang]: text },
      paletteIdx: Math.floor(Math.random() * CARD_PALETTES.length),
      timestamp: Date.now(),
      loading: cardType === "text",
      flagged: false,
      imageUrl,
      youtubeId,
      ...(status ? { status } : {}),
      ...(authorClientId ? { authorClientId } : {}),
    };
    setCards((prev) => [tempCard, ...prev]);
    // 올린 글이 어느 주제로 갔는지 눈으로 확인되도록 그 주제로 이동한다.
    setActiveColId(modal.colId);
    setModal(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text, fromLang: writeLang, targetLangs,
          colId: modal.colId, authorName: user.myName,
          isTeacher, paletteIdx: tempCard.paletteIdx,
          roomCode, cardType, imageUrl, youtubeId,
          ...(data.status ? { status: data.status } : {}),
          ...(data.authorClientId ? { authorClientId: data.authorClientId } : {}),
        }),
      });
      if (!res.ok) throw new Error("API 오류");
      setCards((prev) => prev.filter((c) => c.id !== tempId));

      // 📋 일일 퀘스트 — 학생 카드 작성 성공 직후 (fire-and-forget, 내부 격리).
      // 표현 추출 블록은 텍스트+비모국어 조건부라 그 안에 두면 누락됨 → 성공 직후에 배치.
      // 퀘스트 키는 학생 이름 (village/stickers 동일 키 — myClientId 는 UUID 라 사용 금지).
      if (!isTeacher) reportQuestEvent(roomCode, user.myName, "board_card");

      // ── 학생 표현 자동 추출 (백그라운드) ──
      // 학생이 모국어 외 언어(주로 한국어)로 쓴 텍스트만 학습 가치가 있다고 보고 추출.
      if (
        !isTeacher &&
        cardType === "text" &&
        text.trim().length >= 5 &&
        writeLang !== user.myLang
      ) {
        (async () => {
          try {
            const ex = await fetch("/api/expression-extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, fromLang: writeLang, targetLang: user.myLang }),
            });
            if (!ex.ok) return;
            const j = (await ex.json()) as { expressions?: Array<{ text: string; translation: string }> };
            const list = j?.expressions || [];
            for (const e of list) {
              if (!e?.text) continue;
              await pushExpressionDedup({
                roomCode,
                clientId: myClientId,
                text: e.text,
                lang: writeLang,
                translation: e.translation,
                translationLang: user.myLang,
                source: tempId,
              });
            }
          } catch (err) {
            console.warn("[expression-extract] 실패", err);
          }
        })();
      }
    } catch {
      setCards((prev) =>
        prev.map((c) => c.id === tempId ? { ...c, loading: false, translateError: true } : c)
      );
    }
    setPosting(false);
  }, [posting, modal, user, isTeacher, teacherLangs, roomCode, myClientId]);

  // ── Edit post handler ──
  const handleEditPost = useCallback(async (data: PostData) => {
    if (!editModal || posting) return;
    setPosting(true);
    const db = getClientDb();
    const cardId = editModal.card.id;

    try {
      let translations: Record<string, string> = { [data.writeLang]: data.text || "" };

      // Re-translate text cards via translate API (cardType "comment" = translate-only, no Firebase save)
      if (data.cardType === "text" && data.text?.trim()) {
        const targetLangs = teacherLangs.filter((l) => l !== data.writeLang);
        if (targetLangs.length > 0) {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: data.text,
              fromLang: data.writeLang,
              targetLangs,
              colId: "comment",
              authorName: user.myName,
              isTeacher,
              paletteIdx: editModal.card.paletteIdx,
              roomCode,
              cardType: "comment", // translate-only mode, returns translations without saving
            }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.translations) translations = result.translations;
          }
        }
      }

      const updates: Record<string, unknown> = {
        originalText: data.text || editModal.card.originalText,
        authorLang: data.writeLang,
        translations,
        editedAt: Date.now(),
      };
      // Only update imageUrl if a new one was uploaded; otherwise preserve existing
      if (data.imageUrl) updates.imageUrl = data.imageUrl;
      if (data.youtubeId) updates.youtubeId = data.youtubeId;

      await update(ref(db, `rooms/${roomCode}/cards/${cardId}`), updates);
    } catch {
      // keep card as-is on error
    }
    setPosting(false);
    setEditModal(null);
  }, [editModal, posting, user, isTeacher, teacherLangs, roomCode]);

  // 뒤로 가기: 열려 있는 모달(글쓰기·연습·감정·편집)을 한 단계씩 닫는다
  // (소통창에서 바로 나가지 않음). 중앙 백스택이 가장 안쪽 모달부터 닫는다.
  useBackLayer(!!modal, () => setModal(null));
  useBackLayer(!!editModal, () => setEditModal(null));
  useBackLayer(practiceOpen, () => setPracticeOpen(false));
  useBackLayer(emotionOpen, () => setEmotionOpen(false));

  const practiceCards = (() => {
    if (isTeacher) return [];
    const byId: Record<string, CardData> = {};
    for (const c of cards) byId[c.id] = c;
    return filterPracticeCards(byId);
  })();

  function openCompose(col: FirebaseColumn) {
    // columnId 계약: 글쓰기 대상은 언제나 지금 보고 있는 주제의 실제 id 다.
    setModal({ colId: col.id, colTitle: col.title, colColor: col.color });
  }

  /** 카드 한 장. 주제 보기와 전체 보기가 같은 계약(카드 ID·columnId)을 쓴다. */
  function renderCard(card: CardData, col: FirebaseColumn) {
    return (
      <PadletCard
        key={card.id}
        card={card}
        viewerLang={lang}
        colColor={col.color}
        isTeacher={isTeacher}
        myClientId={myClientId}
        authorName={user.myName}
        isPending={isTeacher && card.status === "pending"}
        onEdit={() => setEditModal({ card, colTitle: col.title, colColor: col.color })}
        onDelete={isTeacher ? () => deleteCard(card.id) : undefined}
        onPraise={
          isTeacher && onPraiseStudent && !card.isTeacher
            ? () => onPraiseStudent(card.authorClientId || card.authorName, card.authorName)
            : undefined
        }
        roomCode={roomCode}
        roomLangs={teacherLangs}
        approvalMode={roomConfigState.approvalMode}
        fixture={offline}
      />
    );
  }

  /** 교사 전용 주제 관리 (이름·색·순서·삭제). 권한 검사는 그대로 두고 UI 만 숨긴다. */
  function ColumnAdmin({ col }: { col: FirebaseColumn }) {
    if (!isTeacher) return null;
    return (
      <div className="bd-admin" data-ux-surface>
        <label data-ux-role="label" className="bd-admin-label" htmlFor={`bd-title-${col.id}`}>주제 이름</label>
        <input
          id={`bd-title-${col.id}`}
          className="bd-input"
          value={editTitle[col.id] ?? col.title}
          onChange={(e) => setEditTitle((prev) => ({ ...prev, [col.id]: e.target.value }))}
          onBlur={() => saveColTitle(col.id)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
            saveColTitle(col.id);
          }}
        />
        <label data-ux-role="label" className="bd-admin-label" htmlFor={`bd-color-${col.id}`}>주제 색</label>
        <select
          id={`bd-color-${col.id}`}
          data-ux-role="control"
          className="bd-select"
          value={COL_COLORS.includes(col.color) ? col.color : ""}
          onChange={(e) => changeColColor(col.id, e.target.value)}
        >
          {!COL_COLORS.includes(col.color) && <option value="">지금 색 그대로</option>}
          {COL_COLORS.map((c, i) => (
            <option key={`${c}-${i}`} value={c}>{COL_COLOR_NAMES[c] ?? c}</option>
          ))}
        </select>
        <div className="bd-admin-row">
          <button type="button" data-ux-role="control" className="bd-btn" onClick={() => moveCol(col.id, "up")}>앞으로</button>
          <button type="button" data-ux-role="control" className="bd-btn" onClick={() => moveCol(col.id, "down")}>뒤로</button>
          <button type="button" data-ux-role="control" className="bd-btn danger" onClick={() => { setColManageOpen(null); confirmDeleteCol(col.id); }}>주제 삭제</button>
        </div>
      </div>
    );
  }

  return (
    <div data-ux-root className="bd-root">
      <ScopedStyle css={BOARD_CSS + CARD_CSS} />

      {/* ── 상단: 뒤로 · 소통창 · 설정 (README §6.1) ── */}
      <header data-tutorial-id="board-header" className="bd-bar">
        <button type="button" data-ux-role="control" className="bd-btn" onClick={onLogout}>
          <span aria-hidden>←</span> {t("boardLeave", lang)}
        </button>
        <div className="bd-id">
          <span data-ux-role="label" className="bd-id-name">꿀벌 소통창</span>
          <span data-ux-role="secondary" className="bd-id-sub">
            <bdi>{user.myName}</bdi> · {roomCode}
            {isTeacher ? ` · ${t("teacherTag", lang)}` : ""}
          </span>
        </div>
        <TextSizeMenu />
      </header>

      <main className={view === "all" ? "bd-main bd-main-full" : "bd-main"}>
        {/* 보기 전환 — 넓은 화면에서만. 좁은 화면에는 선택지 자체를 두지 않는다. */}
        {wide && (
          <div className="bd-viewswitch" role="group" aria-label={t("boardViewSwitch", lang)}>
            <button
              type="button"
              data-ux-role="control"
              className="bd-btn"
              aria-pressed={wideView === "all"}
              onClick={() => setWideView("all")}
            >{t("boardAllTopics", lang)}{wideView === "all" ? " ✓" : ""}</button>
            <button
              type="button"
              data-ux-role="control"
              className="bd-btn"
              aria-pressed={wideView === "topic"}
              onClick={() => setWideView("topic")}
            >{t("boardOneTopic", lang)}{wideView === "topic" ? " ✓" : ""}</button>
          </div>
        )}
        {/* ── 선생님 도구 — 아이의 일상 행동과 시각적으로 분리한다 (README §3.7) ── */}
        {isTeacher && (
          <section className="bd-teacher" aria-label="선생님 도구">
            <h2 data-ux-role="label" className="bd-teacher-title">선생님 도구</h2>
            <div className="bd-teacher-row">
              <button
                type="button"
                data-ux-role="control"
                className="bd-btn"
                aria-pressed={!!roomConfigState.approvalMode}
                onClick={() => {
                  if (offline) return;
                  const db = getClientDb();
                  set(ref(db, `rooms/${roomCode}/config/approvalMode`), !roomConfigState.approvalMode);
                }}
              >{t("approvalMode", lang)}{roomConfigState.approvalMode ? " ✓" : ""}</button>
              {pendingCount > 0 && (
                <button type="button" data-ux-role="control" className="bd-btn" onClick={() => setShowApproval(true)}>
                  {t("approvalPending", lang)} {pendingCount}
                </button>
              )}
              <button type="button" data-ux-role="control" className="bd-btn" onClick={() => setShowQR(true)}>QR</button>
              <button
                type="button"
                data-ux-role="control"
                className="bd-btn"
                onClick={() => {
                  if (activeSessionId) setSessionMinimized(false);
                  else setShowDiscussionCreate(true);
                }}
              >{activeSessionId ? "진행 중인 의견 나누기" : "의견 나누기"}</button>
              <button type="button" data-ux-role="control" className="bd-btn" onClick={() => setShowPptx(true)}>PPTX 번역</button>
              <button
                type="button"
                data-ux-role="control"
                className="bd-btn"
                onClick={() => {
                  if (offline) return;
                  const db = getClientDb();
                  set(ref(db, `rooms/${roomCode}/summon`), { target: "board", ts: Date.now() })
                    .then(() => { setEmotionToast("모두 불렀어요 — 학생 화면이 소통창으로 이동합니다"); setTimeout(() => setEmotionToast(null), 2600); })
                    .catch(() => { setEmotionToast("호출에 실패했어요. 다시 눌러주세요."); setTimeout(() => setEmotionToast(null), 2600); });
                }}
              >모두 부르기</button>
              <button
                type="button"
                data-ux-role="control"
                className="bd-btn"
                onClick={() => {
                  setRosterText((roomConfigState.roster || []).join("\n"));
                  setShowManage(true);
                }}
              >{t("manage", lang)}</button>
            </div>
          </section>
        )}
        {view === "topic" && (
          <>
            <h1 data-ux-role="title" className="bd-ask">{t("boardAskToday", lang)}</h1>

            {/* 주제 선택 — 색 말고 체크와 테두리로도 선택을 알린다. */}
            <div className="bd-topics" role="group" aria-label={t("boardPickTopic", lang)}>
              {columns.map((col) => {
                const active = activeCol?.id === col.id;
                const icon = columnIconFor(col.title);
                return (
                  <button
                    key={col.id}
                    type="button"
                    data-ux-role="control"
                    className={active ? "bd-topic on" : "bd-topic"}
                    aria-pressed={active}
                    onClick={() => setActiveColId(col.id)}
                  >
                    {icon && <img src={icon} alt="" aria-hidden="true" className="bd-topic-art" />}
                    <span className="bd-topic-text">
                      <span data-ux-role="label" className="bd-topic-name">{cleanTitle(col.title)}</span>
                      <span data-ux-role="secondary" className="bd-topic-count">
                        {tFmt("boardStoryCount", lang, { n: cardsOf(col.id).length })}
                      </span>
                    </span>
                    <span aria-hidden className="bd-check">{active ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>

            {activeCol ? (
              <section className="bd-stream" aria-label={cleanTitle(activeCol.title)}>
                <h2 data-ux-role="label" className="bd-now" aria-label={`${t("boardNowTopic", lang)}: ${cleanTitle(activeCol.title)}`}>
                  {cleanTitle(activeCol.title)}
                </h2>

                {isTeacher && (
                  <div className="bd-admin-wrap">
                    <button
                      type="button"
                      data-ux-role="control"
                      className="bd-btn"
                      aria-pressed={colManageOpen === activeCol.id}
                      onClick={() => setColManageOpen((prev) => (prev === activeCol.id ? null : activeCol.id))}
                    >주제 관리</button>
                    {colManageOpen === activeCol.id && <ColumnAdmin col={activeCol} />}
                  </div>
                )}

                {activeCards.length === 0 ? (
                  <div className="bd-empty" data-ux-surface>
                    <img src="/mascot/bee-sleep.png" alt="" aria-hidden="true" className="bd-empty-bee" />
                    <p data-ux-role="body-emphasis" data-ux-reading className="bd-empty-title">{t("boardEmptyExample", lang)}</p>
                    <button
                      type="button"
                      data-ux-role="action"
                      className="bd-cta"
                      data-tutorial-id="board-fab"
                      onClick={() => openCompose(activeCol)}
                    >{t("boardWriteMine", lang)}</button>
                  </div>
                ) : (
                  <div className="bd-cards">
                    {activeCards.map((card) => renderCard(card, activeCol))}
                  </div>
                )}
              </section>
            ) : (
              <p data-ux-role="body" className="bd-notice" role="status">{t("boardNoTopics", lang)}</p>
            )}
          </>
        )}

        {/* ── 데스크톱 교사용 전체 컬럼 보기 (기존 보기 유지) ── */}
        {view === "all" && (
          <>
          <h1 data-ux-role="title" className="bd-ask">{t("boardAllTopics", lang)}</h1>
          <div className="bd-columns" onClick={() => { if (colManageOpen) setColManageOpen(null); }}>
            {columns.map((col) => {
              const colCards = cardsOf(col.id);
              const icon = columnIconFor(col.title);
              return (
                <section key={col.id} className="bd-col" data-ux-surface="panel">
                  <div className="bd-col-head" style={{ background: col.color }}>
                    {icon && <img src={icon} alt="" aria-hidden="true" className="bd-col-art" />}
                    <span data-ux-role="label" className="bd-col-title">{cleanTitle(col.title)}</span>
                    <span data-ux-role="secondary" className="bd-col-count">
                      {tFmt("boardStoryCount", lang, { n: colCards.length })}
                    </span>
                  </div>
                  <div className="bd-col-tools">
                    <button
                      type="button"
                      data-ux-role="control"
                      className="bd-btn"
                      onClick={(e) => { e.stopPropagation(); openCompose(col); }}
                    >{t("addHere", lang)}</button>
                    <button
                      type="button"
                      data-ux-role="control"
                      className="bd-btn"
                      aria-pressed={colManageOpen === col.id}
                      onClick={(e) => { e.stopPropagation(); setColManageOpen((prev) => (prev === col.id ? null : col.id)); }}
                    >주제 관리</button>
                  </div>
                  {colManageOpen === col.id && (
                    <div onClick={(e) => e.stopPropagation()}><ColumnAdmin col={col} /></div>
                  )}
                  <div className="bd-col-body">
                    {colCards.length === 0 ? (
                      <p data-ux-role="body" className="bd-col-empty">{t("boardEmptyExample", lang)}</p>
                    ) : (
                      colCards.map((card) => renderCard(card, col))
                    )}
                  </div>
                </section>
              );
            })}
            <button type="button" data-ux-role="control" className="bd-col-add" onClick={addColumnQuick}>
              <span aria-hidden>＋</span> 새 주제 추가
            </button>
          </div>
          </>
        )}

        {!isTeacher && (
          <div className="bd-compose-side">
            {practiceCards.length > 0 && (
              <button type="button" data-ux-role="control" className="bd-btn" onClick={() => setPracticeOpen(true)}>
                문장 연습 {practiceCards.length}
              </button>
            )}
            <button
              type="button"
              data-ux-role="control"
              className="bd-btn"
              data-tutorial-id="board-emotion-fab"
              onClick={() => setEmotionOpen(true)}
            >오늘 기분 보내기</button>
          </div>
        )}

      </main>

      {/* ── 하단: 내 이야기 올리기 하나만. sticky 라 문서 스크롤을 막지 않는다.
           빈 주제에서는 안내 카드 안의 버튼 하나로 끝낸다 — 같은 주 동작을
           한 화면에 두 번 두지 않는다(README §3.1). ── */}
      {activeCol && !(view === "topic" && activeCards.length === 0) && (
        <div className="bd-compose">
          <button
            type="button"
            data-ux-role="action"
            className="bd-cta"
            data-tutorial-id="board-fab"
            onClick={() => openCompose(activeCol)}
          >{t("boardWriteMine", lang)}</button>
        </div>
      )}

      {/* ── Management modal ── */}
      {showManage && isTeacher && (
        <div
          className="bd-modal-back"
          role="dialog" aria-modal="true" aria-labelledby="modal-title-manage"
          onClick={(e) => { if (e.target === e.currentTarget) setShowManage(false); }}
        >
          <div className="bd-modal" data-ux-surface="panel">
            <div className="bd-modal-head">
              <h2 id="modal-title-manage" data-ux-role="body-emphasis" className="bd-modal-title">관리 패널</h2>
              <button type="button" data-ux-role="control" className="bd-btn" onClick={() => setShowManage(false)}>닫기</button>
            </div>

            <div className="bd-modal-body">
              <h3 data-ux-role="label" className="bd-admin-label">방 설정</h3>
              <div className="bd-teacher-row">
                <button
                  type="button" data-ux-role="control" className="bd-btn"
                  aria-pressed={!!roomConfigState.qrEntry}
                  onClick={() => {
                    if (offline) return;
                    const db = getClientDb();
                    set(ref(db, `rooms/${roomCode}/config/qrEntry`), !roomConfigState.qrEntry);
                  }}
                >{t("qrEntryToggle", lang)}{roomConfigState.qrEntry ? " ✓" : ""}</button>
                <button
                  type="button" data-ux-role="control" className="bd-btn"
                  aria-pressed={!!roomConfigState.approvalMode}
                  onClick={() => {
                    if (offline) return;
                    const db = getClientDb();
                    set(ref(db, `rooms/${roomCode}/config/approvalMode`), !roomConfigState.approvalMode);
                  }}
                >{t("approvalMode", lang)}{roomConfigState.approvalMode ? " ✓" : ""}</button>
                <button
                  type="button" data-ux-role="control" className="bd-btn"
                  aria-pressed={!!roomConfigState.rosterMode}
                  onClick={() => {
                    if (offline) return;
                    const db = getClientDb();
                    set(ref(db, `rooms/${roomCode}/config/rosterMode`), !roomConfigState.rosterMode);
                  }}
                >{t("rosterMode", lang)}{roomConfigState.rosterMode ? " ✓" : ""}</button>
              </div>

              {roomConfigState.rosterMode && (
                <div className="bd-admin-wrap">
                  <label data-ux-role="label" className="bd-admin-label" htmlFor="bd-roster">
                    {t("rosterSetup", lang)} (한 줄에 한 명)
                  </label>
                  <textarea
                    id="bd-roster"
                    className="bd-textarea"
                    value={rosterText}
                    onChange={(e) => setRosterText(e.target.value)}
                    rows={5}
                  />
                  <button
                    type="button" data-ux-role="control" className="bd-btn"
                    onClick={() => {
                      if (offline) return;
                      const db = getClientDb();
                      const names = rosterText.split("\n").map((s) => s.trim()).filter(Boolean);
                      set(ref(db, `rooms/${roomCode}/config/roster`), names);
                    }}
                  >명단 저장</button>
                </div>
              )}

              <p data-ux-role="body" className="bd-hint">
                주제(컬럼) 관리는 소통창 안에서 합니다. 주제를 고른 뒤 ‘주제 관리’를 누르면 이름·색·순서·삭제를 할 수 있고,
                지운 주제는 8초 안에 되돌릴 수 있습니다.
              </p>

              <h3 data-ux-role="label" className="bd-admin-label">언어 설정 (학생 입장 시 보이는 언어)</h3>
              <div className="bd-teacher-row">
                {Object.entries(LANGUAGES).map(([code, info]) => {
                  const active = teacherLangs.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      data-ux-role="control"
                      className="bd-btn"
                      aria-pressed={active}
                      lang={code}
                      onClick={() => {
                        if (offline) return;
                        const db = getClientDb();
                        const next = active
                          ? teacherLangs.filter((l) => l !== code)
                          : [...teacherLangs, code];
                        if (next.length === 0) return;
                        set(ref(db, `rooms/${roomCode}/config/languages`), next);
                      }}
                    >{info.label}{active ? " ✓" : ""}</button>
                  );
                })}
              </div>
              <p data-ux-role="secondary" className="bd-hint">선택된 언어: {teacherLangs.length}개 · 번역 대상 언어이기도 합니다</p>
            </div>
          </div>
        </div>
      )}

      {/* ── PPTX 번역 Modal ── */}
      {showPptx && isTeacher && (
        <PptxTranslateModal
          defaultFromLang={lang === "ko" ? "ko" : lang}
          defaultToLang={lang === "ko" ? "en" : "ko"}
          onClose={() => setShowPptx(false)}
        />
      )}

      {/* ── 오늘의 문장 연습 (학생) ── */}
      {practiceOpen && !isTeacher && (
        <SentencePracticeModal
          user={user}
          roomCode={roomCode}
          cards={practiceCards}
          onClose={() => setPracticeOpen(false)}
        />
      )}

      {/* ── 의견 나누기: 생성 모달 (교사) ── */}
      {showDiscussionCreate && isTeacher && (
        <DiscussionCreateModal
          roomCode={roomCode}
          teacherClientId={myClientId}
          teacherName={user.myName}
          teacherLang={lang}
          roomLangs={teacherLangs}
          onClose={() => setShowDiscussionCreate(false)}
        />
      )}

      {/* ── 의견 나누기: 활성 세션 오버레이 ── */}
      {activeSessionId && !sessionMinimized && (
        <DiscussionSession
          roomCode={roomCode}
          sessionId={activeSessionId}
          isTeacher={isTeacher}
          myClientId={myClientId}
          myName={user.myName}
          myLang={lang}
          onExit={() => setSessionMinimized(true)}
        />
      )}

      {/* ── QR Modal ── */}
      {showQR && (
        <div
          className="bd-modal-back"
          role="dialog" aria-modal="true" aria-labelledby="modal-title-qr"
          onClick={(e) => { if (e.target === e.currentTarget) setShowQR(false); }}
        >
          <div className="bd-modal narrow" data-ux-surface="panel">
            <h2 id="modal-title-qr" data-ux-role="body-emphasis" className="bd-modal-title">{t("qrCode", lang)}</h2>
            <p data-ux-role="body" data-ux-reading className="bd-hint">{t("qrDescription", lang)}</p>
            <div className="bd-qr">
              <QRCodeSVG
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/${roomCode}`}
                size={260}
              />
            </div>
            <p data-ux-role="secondary" className="bd-qr-url">
              {typeof window !== "undefined" ? window.location.origin : ""}/{roomCode}
            </p>
            <button type="button" data-ux-role="control" className="bd-btn" onClick={() => setShowQR(false)}>닫기</button>
          </div>
        </div>
      )}

      {/* ── Approval Modal ── */}
      {showApproval && isTeacher && (
        <div
          className="bd-modal-back"
          role="dialog" aria-modal="true" aria-labelledby="modal-title-approval"
          onClick={(e) => { if (e.target === e.currentTarget) setShowApproval(false); }}
        >
          <div className="bd-modal" data-ux-surface="panel">
            <div className="bd-modal-head">
              <h2 id="modal-title-approval" data-ux-role="body-emphasis" className="bd-modal-title">
                {t("approvalPending", lang)} {pendingCount}
              </h2>
              <button type="button" data-ux-role="control" className="bd-btn" onClick={() => setShowApproval(false)}>닫기</button>
            </div>
            <div className="bd-modal-body">
              {pendingItems.length === 0 ? (
                <p data-ux-role="body" className="bd-hint">승인 대기 중인 게시물이 없습니다</p>
              ) : (
                pendingItems.map((item) => {
                  if (item.kind === "card") {
                    const card = item.data;
                    const col = columns.find((c) => c.id === card.colId);
                    return (
                      <div key={`card-${card.id}`} className="bd-pending" data-ux-surface>
                        <p data-ux-role="label" className="bd-pending-who">
                          <bdi>{card.authorName}</bdi> → {col ? cleanTitle(col.title) : card.colId}
                        </p>
                        {card.cardType === "text" && (
                          <p data-ux-role="body" data-ux-reading className="bd-pending-text">{card.originalText}</p>
                        )}
                        {card.cardType === "image" && card.imageUrl && (
                          <img src={card.imageUrl} alt="" className="bd-pending-img" />
                        )}
                        {card.cardType === "youtube" && card.youtubeId && (
                          <p data-ux-role="secondary">YouTube: https://youtu.be/{card.youtubeId}</p>
                        )}
                        <div className="bd-admin-row">
                          <button type="button" data-ux-role="control" className="bd-btn" onClick={() => approveCard(card.id)}>{t("approve", lang)}</button>
                          <button type="button" data-ux-role="control" className="bd-btn danger" onClick={() => rejectCard(card.id)}>{t("reject", lang)}</button>
                        </div>
                      </div>
                    );
                  }
                  const comment = item.data;
                  const parentCard = item.parentCard;
                  const col = columns.find((c) => c.id === parentCard.colId);
                  return (
                    <div key={`comment-${comment.id}`} className="bd-pending" data-ux-surface>
                      <p data-ux-role="label" className="bd-pending-who">
                        <bdi>{comment.authorName}</bdi> → {col ? cleanTitle(col.title) : parentCard.colId} · {t("pendingComment", lang)}
                      </p>
                      <p data-ux-role="secondary" className="bd-pending-quote">
                        <bdi>{parentCard.authorName}</bdi>: {(parentCard.originalText || "").slice(0, 50)}{(parentCard.originalText || "").length > 50 ? "…" : ""}
                      </p>
                      <p data-ux-role="body" data-ux-reading className="bd-pending-text">{comment.text}</p>
                      <div className="bd-admin-row">
                        <button type="button" data-ux-role="control" className="bd-btn" onClick={() => approveComment(parentCard.id, comment.id)}>{t("approve", lang)}</button>
                        <button type="button" data-ux-role="control" className="bd-btn danger" onClick={() => rejectComment(parentCard.id, comment.id)}>{t("reject", lang)}</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Post Modal ── */}
      {modal && (
        <PostModal
          colId={modal.colId}
          colTitle={modal.colTitle}
          colColor={modal.colColor}
          user={{ ...user, isTeacher, teacherLangs: isTeacher ? teacherLangs : [] }}
          posting={posting}
          onPost={handlePost}
          onClose={() => setModal(null)}
          approvalMode={roomConfigState.approvalMode}
          myClientId={myClientId}
          roomCode={roomCode}
        />
      )}

      {/* ── Undo Snackbar ── */}
      {undoToast && (
        <div role="status" aria-live="polite" className="bd-toast">
          <span data-ux-role="body" className="bd-toast-text">{undoToast.message}</span>
          <button type="button" data-ux-role="control" className="bd-btn" onClick={handleUndo}>되돌리기</button>
          <button type="button" data-ux-role="control" className="bd-btn" onClick={dismissToast}>닫기</button>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editModal && (
        <PostModal
          colId={editModal.card.colId}
          colTitle={editModal.colTitle}
          colColor={editModal.colColor}
          user={{ ...user, isTeacher, teacherLangs: isTeacher ? teacherLangs : [] }}
          posting={posting}
          onPost={handleEditPost}
          onClose={() => setEditModal(null)}
          editCard={editModal.card}
          roomCode={roomCode}
        />
      )}

      {/* ── 감정 카드 데크 모달 ── */}
      {emotionOpen && (
        <div className="bd-modal-back" onClick={(e) => { if (e.target === e.currentTarget) setEmotionOpen(false); }}>
          <div className="bd-modal narrow" data-ux-surface="panel" role="dialog" aria-modal="true" aria-label="내 감정 표현하기">
            <div className="bd-modal-head">
              <h2 data-ux-role="body-emphasis" className="bd-modal-title">내 감정 표현하기</h2>
              <button type="button" data-ux-role="control" className="bd-btn" onClick={() => setEmotionOpen(false)}>닫기</button>
            </div>
            <EmotionCardDeck
              lang={lang}
              onPick={async (emotionId) => {
                if (offline) { setEmotionOpen(false); return; }
                try {
                  await pushEmotion({
                    roomCode,
                    emotionId: emotionId as EmotionId,
                    intensity: 2,
                    clientId: myClientId,
                    authorName: user.myName,
                    context: "padlet",
                  });
                  const awarded = await awardEmotionStickerOncePerDay({
                    roomCode,
                    clientId: myClientId,
                    studentName: user.myName,
                  });
                  setEmotionToast(
                    awarded
                      ? "감정을 보냈어요 💗 오늘의 호기심 스티커 +1"
                      : "감정을 친구들에게 보냈어요 💗"
                  );
                  setTimeout(() => setEmotionToast(null), 2400);
                  setEmotionOpen(false);
                } catch (err) {
                  console.error("pushEmotion failed", err);
                  setEmotionToast("문제가 생겼어요. 다시 눌러주세요.");
                  setTimeout(() => setEmotionToast(null), 2400);
                }
              }}
            />
          </div>
        </div>
      )}

      {emotionToast && (
        <div role="status" aria-live="polite" className="bd-toast">
          <span data-ux-role="body" className="bd-toast-text">{emotionToast}</span>
        </div>
      )}
    </div>
  );
}

/* ── 소통창 전용 규칙 ─────────────────────────────────────────────────
   글자 크기·간격·색은 전부 토큰에서 온다. 여기서 px 글자 크기를 새로 만들지
   않는다. 화면을 100vh + overflow:hidden 으로 잠그지 않고 문서가 스크롤하게
   둔다 — 큰 글씨·긴 번역·모바일 키보드에서 하단 버튼이 사라지지 않는 유일한
   방법이다 (README §5.1, §6.1). */
const BOARD_CSS = `
.bd-root{
  min-height: 100svh;
  background: var(--ux-bg);
  display: flex; flex-direction: column;
  font-family: 'Pretendard Variable','Pretendard','Noto Sans KR',sans-serif;
}
.bd-bar{
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; gap: var(--ux-space-3);
  padding: var(--ux-space-2) var(--ux-space-4);
  background: var(--ux-surface);
  border-bottom: 2px solid var(--ux-primary-border);
}
.bd-id{ display: grid; gap: 2px; min-width: 0; flex: 1; }
/* 좁은 화면에서는 방 정보를 아랫줄로 내린다 — 가운데 칸이 좁아 낱말이 쪼개졌다. */
@media (max-width: 599px){
  .bd-bar{ flex-wrap: wrap; }
  .bd-id{ order: 3; flex: 1 0 100%; }
}
.bd-id-name{ font-weight: 900; color: var(--ux-ink); word-break: keep-all; }
.bd-id-sub{ overflow-wrap: anywhere; }
/* 전체 주제 보기는 화면 폭을 다 쓴다 — 읽기 열 제한은 카드 안(42ch)에서 건다. */
.bd-main-full{ max-width: none !important; }
.bd-main{
  flex: 1; width: 100%; max-width: 760px; margin: 0 auto; box-sizing: border-box;
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-8);
  display: grid; gap: var(--ux-space-4); align-content: start;
}
.bd-ask{ margin: 0; color: var(--ux-ink); font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }

/* 주제 선택 — 한 열이 기본, 넓어지면 두 열까지. */
.bd-topics{ display: grid; grid-template-columns: 1fr; gap: var(--ux-space-3); }
@media (min-width: 600px){ .bd-topics{ grid-template-columns: 1fr 1fr; } }
.bd-topic{
  display: flex; align-items: center; gap: var(--ux-space-3); width: 100%; box-sizing: border-box;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); text-align: left; font-family: inherit; font-weight: 700;
}
.bd-topic.on{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }
.bd-topic{ padding: var(--ux-space-2) var(--ux-space-3); }
.bd-topic-art{ width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; }
.bd-topic-text{ display: grid; gap: 2px; min-width: 0; flex: 1; }
.bd-topic-name{ font-weight: 800; word-break: keep-all; overflow-wrap: anywhere; }
.bd-check{ width: 1.5em; text-align: center; font-weight: 900; color: var(--ux-selected-border); flex-shrink: 0; }

.bd-stream{ display: grid; gap: var(--ux-space-4); }
.bd-now{ margin: 0; color: var(--ux-ink); font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }
.bd-cards{ display: grid; gap: var(--ux-space-4); }

.bd-empty{
  display: grid; justify-items: center; gap: var(--ux-space-4);
  padding: var(--ux-space-6) var(--ux-space-4);
  border: 2px dashed var(--ux-primary-border);
  text-align: center;
}
.bd-empty-bee{ width: 96px; height: 96px; object-fit: contain; }
.bd-empty-title{ margin: 0; color: var(--ux-ink); word-break: keep-all; }

.bd-btn{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
  white-space: normal; word-break: keep-all; overflow-wrap: anywhere;
  display: inline-flex; align-items: center; justify-content: center; gap: var(--ux-space-2);
  box-sizing: border-box; max-width: 100%;
}
.bd-btn.danger{ border-color: var(--ux-error); color: var(--ux-error); }
.bd-btn[aria-pressed="true"]{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }
.bd-cta{
  width: 100%; box-sizing: border-box; font-family: inherit; font-weight: 900;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  white-space: normal; word-break: keep-all;
}

.bd-compose{
  position: sticky; bottom: 0; z-index: 20;
  display: grid; gap: var(--ux-space-2);
  padding: var(--ux-space-3) var(--ux-space-4) calc(var(--ux-space-3) + env(safe-area-inset-bottom, 0px));
  background: var(--ux-surface);
  border-top: 2px solid var(--ux-primary-border);
  box-sizing: border-box;
}
.bd-compose-side{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; }
.bd-compose .bd-cta{ max-width: 760px; margin: 0 auto; }

/* 선생님 도구 — 아이 화면과 시각적으로 분리한다. */
.bd-teacher{
  border: 2px dashed var(--ux-ink-soft); border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-3); display: grid; gap: var(--ux-space-3);
  background: var(--ux-surface-sunk);
}
.bd-teacher-title{ margin: 0; color: var(--ux-ink-soft); font-weight: 800; }
.bd-teacher-row{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); }

.bd-admin-wrap{ display: grid; gap: var(--ux-space-2); }
.bd-admin{ display: grid; gap: var(--ux-space-2); padding: var(--ux-space-3); border: 2px solid var(--ux-primary-border); }
.bd-admin-label{ font-weight: 800; color: var(--ux-ink); }
.bd-admin-row{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); }
.bd-input, .bd-textarea, .bd-select{
  width: 100%; box-sizing: border-box;
  min-height: var(--ux-control-min);
  font-family: inherit; font-size: var(--ux-font-body); font-weight: 700;
  color: var(--ux-ink); background: var(--ux-surface);
  border: 2px solid var(--ux-ink-soft); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2) var(--ux-space-3);
}
.bd-textarea{ line-height: var(--ux-lh-reading); resize: vertical; }
.bd-hint{ margin: 0; color: var(--ux-ink-soft); word-break: keep-all; overflow-wrap: anywhere; }
.bd-notice{
  margin: 0; padding: var(--ux-space-3); border: 2px dashed var(--ux-error);
  border-radius: var(--ux-radius-surface); color: var(--ux-error); font-weight: 700;
}

/* 전체 주제 보기 — 데스크톱 교사 전용. 가로 스크롤은 이 상자 안에서만 일어난다. */
.bd-columns{
  display: flex; gap: var(--ux-space-3); align-items: flex-start;
  overflow-x: auto; padding-bottom: var(--ux-space-3);
}
/* 전체 보기에서는 제목을 크게 반복하지 않는다 — 바로 위 전환 버튼이 이미 말한다. */
.bd-main-full .bd-ask{ font-size: var(--ux-font-label); color: var(--ux-ink-soft); }
.bd-col{
  /* 패들렛처럼 여러 주제가 한눈에 들어와야 한다. 1280px 에서 4개, 1920px 에서 6개. */
  width: clamp(240px, 19vw, 290px); flex-shrink: 0;
  display: flex; flex-direction: column; gap: var(--ux-space-2);
  border: 2px solid var(--ux-primary-border); padding: var(--ux-space-2);
  background: var(--ux-surface); box-sizing: border-box;
}
.bd-col-head{
  /* 좁아진 컬럼에서 주제 이름이 잘리면 안 된다 — 두 줄로 내려온다. */
  display: flex; align-items: center; flex-wrap: wrap; gap: var(--ux-space-2);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-2) var(--ux-space-3);
}
.bd-col-art{ width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; background: var(--ux-surface); border-radius: var(--ux-radius-surface); }
.bd-col-title{ flex: 1 1 100%; min-width: 0; font-weight: 900; color: var(--ux-ink); white-space: normal; word-break: keep-all; overflow-wrap: anywhere; }
.bd-col-count{ flex-shrink: 0; color: var(--ux-ink); margin-left: auto; }
.bd-col-tools{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; }
.bd-col-body{ display: grid; gap: var(--ux-space-3); max-height: clamp(320px, 62svh, 900px); overflow-y: auto; }
.bd-col-empty{ margin: 0; color: var(--ux-ink-soft); word-break: keep-all; }
.bd-col-add{
  width: clamp(180px, 16vw, 220px); flex-shrink: 0; align-self: stretch;
  border: 3px dashed var(--ux-primary-border); background: var(--ux-surface-sunk);
  color: var(--ux-ink); font-family: inherit; font-weight: 900;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--ux-space-2);
}

/* 모달 — 안쪽만 스크롤하고 문서를 잠그지 않는다. */
.bd-modal-back{
  position: fixed; inset: 0; z-index: 400;
  background: rgba(41,37,31,.62);
  display: flex; align-items: flex-start; justify-content: center;
  padding: var(--ux-space-4); overflow-y: auto;
}
.bd-modal{
  background: var(--ux-surface); width: 100%; max-width: 620px; box-sizing: border-box;
  display: grid; gap: var(--ux-space-4); padding: var(--ux-space-4);
  box-shadow: 0 18px 48px rgba(41,37,31,.35);
}
.bd-modal.narrow{ max-width: 460px; justify-items: center; text-align: center; }
.bd-modal-head{ display: flex; align-items: center; gap: var(--ux-space-3); width: 100%; }
.bd-modal-title{ margin: 0; flex: 1; min-width: 0; font-weight: 900; color: var(--ux-ink); word-break: keep-all; }
.bd-modal-body{ display: grid; gap: var(--ux-space-3); }
.bd-qr{ display: flex; justify-content: center; max-width: 100%; }
.bd-qr-url{ word-break: break-all; }
.bd-pending{ display: grid; gap: var(--ux-space-2); padding: var(--ux-space-3); border: 2px solid var(--ux-primary-border); }
.bd-pending-who{ margin: 0; font-weight: 800; word-break: keep-all; overflow-wrap: anywhere; }
.bd-pending-text{ margin: 0; word-break: keep-all; overflow-wrap: anywhere; }
.bd-pending-quote{ margin: 0; word-break: keep-all; overflow-wrap: anywhere; }
.bd-pending-img{ width: 100%; border-radius: var(--ux-radius-surface); }

.bd-toast{
  position: fixed; left: 50%; bottom: var(--ux-space-6); transform: translateX(-50%);
  z-index: 600; display: flex; align-items: center; gap: var(--ux-space-3);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 3px solid var(--ux-selected-border); border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-3) var(--ux-space-4);
  box-shadow: 0 12px 32px rgba(41,37,31,.28);
  max-width: min(92vw, 560px); flex-wrap: wrap; box-sizing: border-box;
}
.bd-toast-text{ word-break: keep-all; overflow-wrap: anywhere; }
`;

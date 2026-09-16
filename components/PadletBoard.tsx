"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ref, onValue, off, set, remove, update, query, limitToLast } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import {
  cardLikesPath, cardCommentsPath, cardCommentPath, roomCardCommentsPath,
  legacyCardCommentPath, mergeById,
} from "@/lib/boardPaths";
import type { RawReactions } from "@/lib/cardReactions";
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
  /**
   * 카드별 반응 노드 초기값 `{ cardId: { clientId: 반응문자열 | true } }`.
   * 구독을 끄면 반응이 늘 비어 있어 옛 `true` 호환·개수·내 선택 상태를
   * 화면으로 검수할 수 없다 (U06).
   */
  reactions?: Record<string, Record<string, string | boolean>>;
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
  /** 방금 이름을 저장한 주제. 잠깐 '저장했어요' 를 보여 주기 위한 것이다. */
  const [savedTitleAt, setSavedTitleAt] = useState<{ colId: string; at: number } | null>(null);

  // Room config state (live-updated)
  const [roomConfigState, setRoomConfigState] = useState<RoomConfig>(roomConfig);
  const [rosterText, setRosterText] = useState("");

  /**
   * 옛 방 호환 바탕값. 공감·답장을 cards 형제로 옮겼지만(lib/boardPaths.ts)
   * 이미 카드 밑에 쌓인 것은 옮기지 못한다 — 마이그레이션을 돌릴 자격증명이
   * 없다. 카드 구독이 어차피 그 값을 실어 오므로, 여기에 받아 두었다가
   * 카드에 내려보내 새 노드와 겹쳐 읽게 한다. 구독을 더 만들지 않는 게 핵심.
   */
  const [legacyLikes, setLegacyLikes] = useState<Record<string, RawReactions>>({});
  const [legacyComments, setLegacyComments] = useState<Record<string, Record<string, CommentData>>>({});
  /** 새 자리의 방 전체 답장. 교사만 구독한다(승인 대기 목록 재료). */
  const [liveComments, setLiveComments] = useState<Record<string, Record<string, CommentData>>>({});

  /**
   * C — cards 는 방이 쌓일수록 통째로 내려받는 양이 늘어난다. 처음엔 최근
   * N개만 받고, "더 보기" 를 누르면 한도를 늘려 다시 구독한다. 카드 id 는
   * 항상 push() 키다(app/api/translate/route.ts: `cardRef = ...push()`,
   * `id: cardId` 가 그 키 그대로) — push 키는 시간순이라 정렬용
   * orderByChild 없이 limitToLast 만으로 "가장 최근 N개"가 정확하다.
   */
  const [cardsLimit, setCardsLimit] = useState(60);
  /** 이번 스냅샷에 실려 온 카드 수. 한도와 같으면 더 있을 가능성이 있다는 뜻. */
  const [cardsLoadedCount, setCardsLoadedCount] = useState(0);
  /** A2 — 카드별 원본 JSON 스냅샷. 안 바뀐 카드는 새 객체를 만들지 않고
      이전 객체 참조를 그대로 재사용해 React.memo 가 실제로 동작하게 한다. */
  const prevRawJsonRef = useRef<Record<string, string>>({});
  const prevCardByIdRef = useRef<Record<string, CardData>>({});

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

  /** '어디에 올릴까요' 를 묻는 중인지. 주제가 둘 이상일 때만 뜬다. */
  const [askTopic, setAskTopic] = useState(false);

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
    // C — 최근 cardsLimit 개만 구독한다. 한도가 바뀌면(더 보기) 재구독한다.
    const cardsQuery = query(cardsRef, limitToLast(cardsLimit));
    const unsub = onValue(cardsQuery, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setCards([]); setLegacyLikes({}); setLegacyComments({}); setCardsLoadedCount(0);
        prevRawJsonRef.current = {};
        prevCardByIdRef.current = {};
        return;
      }

      // Raw data includes nested comments/likes sub-trees (옛 방에만 남아 있다)
      type RawCard = CardData & {
        comments?: Record<string, CommentData>;
        likes?: RawReactions;
      };
      const rawEntries = Object.entries(data) as [string, RawCard][];
      setCardsLoadedCount(rawEntries.length);

      /**
       * A2 — memo 가 실제로 먹으려면 안 바뀐 카드는 **객체 참조**도 그대로여야
       * 한다. onValue 는 형제 하나가 바뀌어도 트리 전체 스냅샷을 다시 주므로,
       * 매번 rest 를 새로 만들면 카드 25장이 전부 새 객체가 되어 memo 가
       * 죽는다. 카드별 원본 JSON 을 이전 스냅샷과 비교해, 안 바뀐 카드는
       * 이전 렌더에서 쓰던 바로 그 CardData 객체를 재사용한다.
       */
      const nextRawJson: Record<string, string> = {};
      const nextCardById: Record<string, CardData> = {};
      const oldLikes: Record<string, RawReactions> = {};
      const oldComments: Record<string, Record<string, CommentData>> = {};
      const list: CardData[] = [];

      for (const [key, raw] of rawEntries) {
        const { comments: rawComments, likes: rawLikes, ...rest } = raw;
        if (rawLikes) oldLikes[raw.id] = rawLikes;
        if (rawComments) oldComments[raw.id] = rawComments;

        const json = JSON.stringify(rest);
        nextRawJson[key] = json;
        const prevJson = prevRawJsonRef.current[key];
        const prevCard = prevCardByIdRef.current[key];
        const card: CardData = prevJson === json && prevCard ? prevCard : (rest as CardData);
        nextCardById[key] = card;
        list.push(card);
      }

      list.sort((a, b) => b.timestamp - a.timestamp);
      prevRawJsonRef.current = nextRawJson;
      prevCardByIdRef.current = nextCardById;

      setCards(list);
      /* 옛 곁가지를 카드에서 떼어 따로 모은다. 새 글에는 아예 없으므로 대개
         빈 객체이고, 옛 방에서는 값이 더 변하지 않는(쓰기가 새 자리로 가므로)
         고정된 바탕이 된다. */
      setLegacyLikes(oldLikes);
      setLegacyComments(oldComments);
    });
    return () => unsub();
  }, [roomCode, offline, cardsLimit]);

  /**
   * 새 자리의 방 전체 답장 — **교사만** 구독한다.
   *
   * 승인 대기 목록은 방 안의 모든 답장을 봐야 만들 수 있다. 학생에게까지
   * 이 구독을 주면 cards 에서 겪던 일(누가 답장할 때마다 전원 재구독)을
   * 나무만 바꿔 되풀이하게 된다. 답장은 공감보다 훨씬 드물어 교사 한 명이
   * 통째로 보는 비용은 감당할 수 있다.
   */
  useEffect(() => {
    if (offline || !isTeacher) return;
    const db = getClientDb();
    const commentsRef = ref(db, roomCardCommentsPath(roomCode));
    const cb = onValue(commentsRef, (snap) => {
      setLiveComments((snap.val() as Record<string, Record<string, CommentData>> | null) || {});
    });
    return () => off(commentsRef, "value", cb);
  }, [roomCode, offline, isTeacher]);

  /**
   * 승인 대기 목록. 예전에는 카드 구독 콜백 안에서 만들었지만, 이제 재료가
   * 두 곳(카드 + 새 답장 나무)에서 따로 도착하므로 계산으로 합친다.
   * 옛 답장은 바탕, 새 답장이 위 — 같은 id 면 새 것이 이긴다(옛 답장을
   * 승인하면 승인된 전문이 같은 id 로 새 자리에 쓰여 옛 것을 가린다).
   *
   * C 의 cardsLimit 창 밖으로 밀린 카드는 여기 안 잡힐 수 있다는 게 걱정거리
   * 였는데, pending 카드는 정의상 "방금 올라와 아직 승인 안 된" 새 글이다
   * (app/api/translate/route.ts 가 매번 새 timestamp 로 push() 한다) — 즉
   * push 키 순서로도 언제나 최신 축에 속해 limitToLast 창 안에 있다. 교실
   * 한 방에서 승인 대기 중에 다른 학생이 60개 넘게 새 글을 쏟아붓는 극단적인
   * 경우가 아니면 놓칠 일이 없다. 그런 진짜 빈틈이 생기면 여기 주석을 지우고
   * 승인 대기만은 별도로(예: status=="pending" 쿼리) 구독해야 한다.
   */
  const pendingItems: PendingItem[] = useMemo(() => {
    const pending: PendingItem[] = [];
    for (const card of cards) {
      if (card.status === "pending") pending.push({ kind: "card", data: card });
      const merged = mergeById(legacyComments[card.id], liveComments[card.id]);
      for (const comment of Object.values(merged)) {
        if (comment?.status === "pending") {
          pending.push({ kind: "comment", data: comment, parentCard: card });
        }
      }
    }
    pending.sort((a, b) => a.data.timestamp - b.data.timestamp);
    return pending;
  }, [cards, legacyComments, liveComments]);

  // Card visibility
  const visibleCards = isTeacher ? cards : cards.filter((c) => !c.status || c.status === "approved");
  const pendingCount = pendingItems.length;
  const cardsOf = (colId: string) => visibleCards.filter((c) => c.colId === colId);
  const activeCards = activeCol ? cardsOf(activeCol.id) : [];

  // ── Column management ──
  /**
   * 주제 이름 저장. 바뀐 게 없으면 쓰지 않는다(같은 값을 계속 덮어쓰면
   * 다른 사람 화면이 불필요하게 다시 그려진다).
   * 저장했으면 true — 부르는 쪽이 '저장했어요' 를 띄운다.
   */
  function saveColTitle(colId: string): boolean {
    const draft = editTitle[colId];
    if (draft === undefined || offline) return false;
    const title = draft.trim();
    const current = columns.find((c) => c.id === colId)?.title ?? "";
    if (!title || title === current) return false;
    const db = getClientDb();
    set(ref(db, `rooms/${roomCode}/columns/${colId}/title`), title);
    setSavedTitleAt({ colId, at: Date.now() });
    return true;
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
    /* 공감·답장이 카드 밖으로 나갔으니 카드만 지우면 그 둘이 주인 없이 남는다.
       되돌리기가 카드를 통째로 되살리는 화면이므로, 곁가지도 먼저 받아 두었다가
       같이 되살린다 — 지웠다 되돌렸는데 하트만 사라지면 안 된다. */
    const side = await readCardSideData(cardId);
    await remove(ref(db, `rooms/${roomCode}/cards/${cardId}`));
    await removeCardSideData(cardId);
    const authorName = typeof fullCard.authorName === "string" ? fullCard.authorName : "";
    showUndoToast(
      authorName ? `"${authorName}"님의 카드를 삭제했습니다` : "카드를 삭제했습니다",
      () => {
        set(ref(db, `rooms/${roomCode}/cards/${cardId}`), fullCard);
        restoreCardSideData(cardId, side);
      }
    );
  }

  /** 카드 밖으로 나간 곁가지(공감·답장)를 읽어 둔다. 되돌리기 재료다. */
  async function readCardSideData(cardId: string) {
    const db = getClientDb();
    const { get: dbGet, ref: dbRef } = await import("firebase/database");
    const [likes, comments] = await Promise.all([
      dbGet(dbRef(db, cardLikesPath(roomCode, cardId))),
      dbGet(dbRef(db, cardCommentsPath(roomCode, cardId))),
    ]);
    return { likes: likes.val(), comments: comments.val() };
  }

  /** 카드가 사라지면 곁가지도 함께 지운다 — 고아 노드가 쌓이지 않게. */
  async function removeCardSideData(cardId: string) {
    const db = getClientDb();
    await Promise.all([
      remove(ref(db, cardLikesPath(roomCode, cardId))),
      remove(ref(db, cardCommentsPath(roomCode, cardId))),
    ]);
  }

  function restoreCardSideData(cardId: string, side: { likes: unknown; comments: unknown }) {
    const db = getClientDb();
    if (side.likes) set(ref(db, cardLikesPath(roomCode, cardId)), side.likes);
    if (side.comments) set(ref(db, cardCommentsPath(roomCode, cardId)), side.comments);
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
    await removeCardSideData(cardId);
  }

  /**
   * 답장 승인. 새 자리에 **전문을 통째로** 쓴다.
   *
   * status 한 칸만 쓰지 않는 이유: 옛 방의 답장은 아직 카드 밑에 있고 새
   * 자리에는 아무것도 없다. 거기에 status 만 쓰면 `{status:"approved"}` 뿐인
   * 조각이 생기고, 새 것이 이기는 겹쳐 읽기 규칙 때문에 그 조각이 본문 있는
   * 옛 답장을 덮어 글이 사라진다. 전문을 쓰면 옛 것을 온전히 가리면서
   * 승인만 반영된다 — 그 답장 하나가 새 자리로 옮겨 오는 셈이다.
   */
  async function approveComment(cardId: string, comment: CommentData) {
    if (offline) return;
    const db = getClientDb();
    await set(ref(db, cardCommentPath(roomCode, cardId, comment.id)), {
      ...comment,
      status: "approved" as CardStatus,
    });
  }

  async function rejectComment(cardId: string, comment: CommentData) {
    if (offline) return;
    const db = getClientDb();
    await remove(ref(db, cardCommentPath(roomCode, cardId, comment.id)));
    /* 옛 자리에 있던 답장은 거기서 지워야 진짜로 사라진다. 가림 표시로는
       지울 수 없다 — 지웠다고 해 놓고 데이터가 남는 쪽이 더 나쁘다.
       이때만 cards 가 다시 울리는데, 반려는 드물고 한 번뿐이라 감수한다. */
    if (legacyComments[cardId]?.[comment.id]) {
      await remove(ref(db, legacyCardCommentPath(roomCode, cardId, comment.id)));
    }
  }

  const handlePost = useCallback(async (data: PostData) => {
    if (posting || !modal) return;
    const { cardType, text, writeLang, imageUrl, youtubeId, status, authorClientId } = data;
    if (cardType === "text" && !text.trim()) return;

    setPosting(true);

    // 교사가 설정한 방 언어 목록으로 번역 (학생도 동일하게 적용).
    // 종류가 아니라 **글이 있는지** 로 정한다 — 활동지(이미지 + OCR 글)와
    // 설명을 붙인 유튜브 카드도 번역되어야 한다.
    const targetLangs = text && text.trim()
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
      // U05 — 내 동물이 내가 쓴 글에도 바로 보이게 한다.
      ...(user.learnerId ? { authorLearnerId: user.learnerId } : {}),
      ...(user.animalId ? { authorAnimalId: user.animalId } : {}),
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
          ...(user.learnerId ? { authorLearnerId: user.learnerId } : {}),
          ...(user.animalId ? { authorAnimalId: user.animalId } : {}),
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

  /**
   * A — 카드에 내려줄 조작 콜백을 카드마다(renderCard 호출마다) 새로
   * 만들면(인라인 클로저) React.memo 가 무력화된다. 그래서 부모는 **카드
   * id 하나만 받는, 참조가 절대 안 바뀌는 함수 하나**를 모든 카드에 똑같이
   * 내려주고, 그 함수가 최신 카드·컬럼을 ref 에서 찾아 쓴다.
   */
  const cardsByIdRef = useRef<Record<string, CardData>>({});
  cardsByIdRef.current = useMemo(() => {
    const map: Record<string, CardData> = {};
    for (const c of cards) map[c.id] = c;
    return map;
  }, [cards]);

  const columnsByIdRef = useRef<Record<string, FirebaseColumn>>({});
  columnsByIdRef.current = useMemo(() => {
    const map: Record<string, FirebaseColumn> = {};
    for (const c of columns) map[c.id] = c;
    return map;
  }, [columns]);

  /** deleteCard·onPraiseStudent 는 렌더마다 참조가 바뀔 수 있어(클로저·props)
      거울 ref 에 최신 것만 담아 안정된 콜백 안에서 그때그때 꺼내 쓴다. */
  const deleteCardRef = useRef(deleteCard);
  deleteCardRef.current = deleteCard;
  const onPraiseStudentRef = useRef(onPraiseStudent);
  onPraiseStudentRef.current = onPraiseStudent;

  const handleCardEdit = useCallback((cardId: string) => {
    const card = cardsByIdRef.current[cardId];
    if (!card) return;
    const col = columnsByIdRef.current[card.colId];
    setEditModal({ card, colTitle: col?.title ?? "", colColor: col?.color ?? "" });
  }, []);

  const handleCardDelete = useCallback((cardId: string) => {
    deleteCardRef.current(cardId);
  }, []);

  const handleCardPraise = useCallback((cardId: string) => {
    const card = cardsByIdRef.current[cardId];
    const praise = onPraiseStudentRef.current;
    if (!card || !praise) return;
    praise(card.authorClientId || card.authorName, card.authorName);
  }, []);

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
        onEdit={handleCardEdit}
        onDelete={isTeacher ? handleCardDelete : undefined}
        onPraise={
          isTeacher && onPraiseStudent && !card.isTeacher
            ? handleCardPraise
            : undefined
        }
        roomCode={roomCode}
        roomLangs={teacherLangs}
        approvalMode={roomConfigState.approvalMode}
        fixture={offline}
        learners={roomConfigState.learners}
        fixtureReactions={fixture?.reactions?.[card.id]}
        /* 옛 방 호환 바탕값 — 카드 구독이 이미 실어 온 것이라 구독이 늘지 않는다. */
        legacyLikes={legacyLikes[card.id]}
        legacyComments={legacyComments[card.id]}
      />
    );
  }

  /** 교사 전용 주제 관리 (이름·색·순서·삭제). 권한 검사는 그대로 두고 UI 만 숨긴다. */
  function ColumnAdmin({ col }: { col: FirebaseColumn }) {
    /* 훅은 조건부 return 앞에 둔다 — 순서가 바뀌면 React 가 깨진다. */
    const draft = editTitle[col.id];
    const dirty = draft !== undefined && draft.trim() !== "" && draft.trim() !== col.title;
    const justSaved = savedTitleAt?.colId === col.id && Date.now() - savedTitleAt.at < 4000;

    /**
     * 패널이 닫히거나 화면을 떠날 때 **고친 이름을 잃지 않는다.**
     * '주제 관리' 를 다시 눌러 닫으면 입력칸이 사라지는데, 그때 blur 가
     * 보장되지 않아 편집이 그대로 날아갔다.
     */
    const dirtyRef = useRef(false);
    dirtyRef.current = dirty;
    useEffect(() => {
      return () => { if (dirtyRef.current) saveColTitle(col.id); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [col.id]);

    if (!isTeacher) return null;
    return (
      <div className="bd-admin" data-ux-surface>
        <label data-ux-role="label" className="bd-admin-label" htmlFor={`bd-title-${col.id}`}>주제 이름</label>
        <div className="bd-admin-titlerow">
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
        {/* 무엇을 눌러야 저장인지 보이게 둔다. 포커스 아웃·Enter 로도 저장되지만,
            그건 화면에 드러나지 않아 "저장이 안 된다" 로 읽혔다. */}
        <button
          type="button"
          data-ux-role="control"
          className="bd-btn"
          aria-disabled={!dirty}
          onClick={(e) => { e.stopPropagation(); saveColTitle(col.id); }}
        >{dirty ? "저장" : justSaved ? "저장했어요" : "저장됨"}</button>
        </div>
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
                    {/* 열 머리와 같은 이유로 자리를 늘 잡는다 — 아이콘 없는 열
                       (사용자가 만든 "새 칸")만 이름이 36px 왼쪽으로 밀려
                       세로로 늘어선 주제 이름이 들쭉날쭉해진다. */}
                    {icon
                      ? <img src={icon} alt="" aria-hidden="true" className="bd-topic-art" />
                      : <span aria-hidden="true" className="bd-topic-art bd-topic-art-empty" />}
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
                    <img src="/_opt/mascot/bee-sleep-384.webp"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/mascot/bee-sleep.png"; }} alt="" aria-hidden="true" className="bd-empty-bee" />
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
              // 전체 보기에서 주제(줄)를 눈으로 가르려면 머리띠만으로는
              // 부족하다 — 칼럼 바탕과 테두리에도 그 주제 색을 옅게 깐다.
              // 글자·카드는 흰 종이 위에 그대로 두어 대비를 지킨다.
              return (
                <section
                  key={col.id}
                  className="bd-col"
                  data-ux-surface="panel"
                  style={{ ["--col-tint" as string]: col.color }}
                >
                  <div className="bd-col-head" style={{ background: col.color }}>
                    {/* 그림 자리는 **아이콘이 없어도 늘 잡아 둔다**.
                       lib/assets.ts 의 columnIconFor 는 제목이 이모지로 시작할
                       때만 아이콘을 준다. 기본 3열은 "🙋 자기소개 …" 라 아이콘이
                       붙지만, addColumnQuick 이 만드는 "새 칸" 은 이모지가 없어
                       null 이다. 머리가 세로 배치라 그 열만 36px+gap 만큼 짧아져
                       옆 열과 어긋났다(사용자 지적: "사용자가 추가한 열에서
                       레이아웃 이슈"). 빈 자리는 보이지 않지만 높이는 맡는다. */}
                    {icon
                      ? <img src={icon} alt="" aria-hidden="true" className="bd-col-art" />
                      : <span aria-hidden="true" className="bd-col-art bd-col-art-empty" />}
                    <span data-ux-role="label" className="bd-col-title" title={cleanTitle(col.title)}>{cleanTitle(col.title)}</span>
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
                    {/* 주제 관리는 교사 도구다. 단일 주제 보기에서는 이미
                       isTeacher 로 가려 두었는데 전체 보기에서만 빠져 있어
                       아이 화면에도 나왔다(사용자 지적: "아이 입장에서 주제
                       관리가 뭐야?"). 같은 규칙으로 맞춘다. */}
                    {isTeacher && (
                      <button
                        type="button"
                        data-ux-role="control"
                        className="bd-btn"
                        aria-pressed={colManageOpen === col.id}
                        onClick={(e) => { e.stopPropagation(); setColManageOpen((prev) => (prev === col.id ? null : col.id)); }}
                      >주제 관리</button>
                    )}
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

        {/* C — 로딩한 카드 수가 지금 한도와 같으면 더 있을 수 있다는 뜻이다
            (limitToLast 가 한도 딱 채워 보낸 것과 "그게 전부인 것"은 구분되지
            않으니 넉넉하게 보여준다). fixture 는 구독 자체가 없어 늘 0 이라
            뜨지 않는다. */}
        {!offline && cardsLoadedCount === cardsLimit && (
          <div className="bd-loadmore">
            <button
              type="button"
              data-ux-role="control"
              className="bd-btn"
              onClick={() => setCardsLimit((n) => n + 60)}
            >더 보기</button>
          </div>
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
            onClick={() => {
              // 주제가 하나면 물을 것이 없다.
              if (columns.length <= 1) { openCompose(activeCol); return; }
              setAskTopic(true);
            }}
          >{t("boardWriteMine", lang)}</button>
        </div>
      )}

      {/* ── 어디에 올릴까요 ── */}
      {askTopic && (
        <div
          className="bd-modal-back"
          role="dialog" aria-modal="true" aria-labelledby="bd-asktopic-title"
          onClick={(e) => { if (e.target === e.currentTarget) setAskTopic(false); }}
        >
          <div className="bd-modal" data-ux-surface="panel">
            <div className="bd-modal-head">
              <h2 id="bd-asktopic-title" data-ux-role="body-emphasis" className="bd-modal-title">
                {t("boardAskTopic", lang)}
              </h2>
              <button type="button" data-ux-role="control" className="bd-btn" onClick={() => setAskTopic(false)}>
                {t("boardAskTopicCancel", lang)}
              </button>
            </div>
            <div className="bd-topicpick">
              {columns.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  data-ux-role="control"
                  className="bd-topicpick-btn"
                  style={{ ['--col-tint' as string]: col.color }}
                  onClick={() => { setAskTopic(false); setActiveColId(col.id); openCompose(col); }}
                >
                  <span data-ux-role="label" className="bd-topicpick-name">{cleanTitle(col.title)}</span>
                  <span data-ux-role="secondary">
                    {tFmt("boardStoryCount", lang, { n: cards.filter((c) => c.colId === col.id).length })}
                  </span>
                </button>
              ))}
            </div>
          </div>
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
                        <button type="button" data-ux-role="control" className="bd-btn" onClick={() => approveComment(parentCard.id, comment)}>{t("approve", lang)}</button>
                        <button type="button" data-ux-role="control" className="bd-btn danger" onClick={() => rejectComment(parentCard.id, comment)}>{t("reject", lang)}</button>
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
          <div className="bd-modal emotion" data-ux-surface="panel" role="dialog" aria-modal="true" aria-label="내 감정 표현하기">
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
.bd-topic-art{ display: block; width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; }
.bd-topic-art-empty{ background: none; }
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
.bd-loadmore{ display: flex; justify-content: center; margin: var(--ux-space-4) 0; }
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
  /* 패들렛처럼 여러 주제가 한눈에 들어와야 한다.
     예전 값 clamp(240px, 19vw, 290px) 는 1280px 에서 실측 243px 이라 카드
     안쪽이 185px 밖에 안 됐다 — 조작 버튼 넷(48px 원 x4 + 간격 8 x3 = 216px)이
     들어가지 못해 서로 겹쳤다(실측: 1280·1024 에서 겹침 1건). 사용자도 같은
     것을 봤다: "열 폭을 더 키우고 반응형 조절되도록".
     최소 300px = 216(버튼 넷) + 32(카드 안쪽 여백) + 10(카드 테두리) + 16(칸
     여백) + 여유. vw 로 따라 늘고 360px 에서 멈춘다(읽기 폭 42ch 안쪽). */
  width: clamp(300px, 22vw, 360px); flex-shrink: 0;
  display: flex; flex-direction: column; gap: var(--ux-space-2);
  padding: var(--ux-space-2);
  box-sizing: border-box;
  /* 주제마다 다른 색을 아주 옅게(12%) 깔아 전체 보기에서 줄이 갈린다.
     테두리는 같은 색을 진하게(55%) 써서 경계가 분명하다. 본문 카드는 흰
     종이 그대로라 글자 대비는 영향을 받지 않는다.
     color-mix 를 못 쓰는 브라우저를 위해 기존 값을 먼저 둔다. */
  border: 2px solid var(--ux-primary-border);
  background: var(--ux-surface);
  border-color: color-mix(in srgb, var(--col-tint, var(--ux-primary-border)) 55%, var(--ux-primary-border));
}
/* 토큰의 [data-ux-surface] 규칙이 background 를 var(--ux-surface) 로 되돌린다
   (특이도가 같아 나중 규칙이 이긴다). 클래스와 속성을 함께 걸어 이긴다.
   (이 주석은 template literal 안이라 백틱을 쓰면 문자열이 끊긴다.) */
.bd-col[data-ux-surface]{
  background: color-mix(in srgb, var(--col-tint, var(--ux-surface)) 14%, var(--ux-surface));
}
/* '큰 글씨' 를 고른 아이는 --ux-control-min 이 48px 이 아니라 56px 이다.
   버튼 넷이 4x56 + 8x3 = 248px 을 먹으므로 칸도 그만큼 넓어야 한 행이 유지된다.
   크게 보려고 고른 설정을 레이아웃이 되돌리면 안 된다(tokens.ts 의 원칙). */
:root[data-ux-text="large"] .bd-col{ width: clamp(340px, 25vw, 420px); }
/* 주제 머리 — 가운데 정렬.
   예전에는 그림이 왼쪽, 개수가 오른쪽 끝(margin-left:auto)에 붙어 한 칸 안에서
   좌우로 벌어져 보였다. 칼럼이 여러 개 늘어서면 그 어긋남이 더 눈에 띈다
   (사용자 지적: "이것들을 중앙 정렬"). 그림·이름·개수를 한 축에 가운데로 모은다. */
.bd-col-head{
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: var(--ux-space-1);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-2) var(--ux-space-3);
}
.bd-col-art{ display: block; width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; background: var(--ux-surface); border-radius: var(--ux-radius-surface); }
/* 아이콘 없는 열(사용자가 만든 "새 칸")의 빈 자리 — 높이만 맡고 보이지 않는다. */
.bd-col-art-empty{ background: none; }
/* 주제 이름은 **두 줄 자리를 늘 잡는다**.
   예전 주석은 "잘리면 안 된다 — 두 줄로 내려온다" 였는데, 실제로는 한 줄짜리
   이름과 두 줄짜리 이름의 머리 높이가 18.9px 어긋났고(실측), 아주 긴 이름은
   세 줄까지 내려가 열마다 제각각이 됐다. 계약의 의도는 "이름을 읽을 수 있게"
   이지 "몇 줄이든 다 편다" 가 아니다 — 그래서 **두 줄로 고정**한다:
    - min-height 로 한 줄 이름도 두 줄 자리를 차지해 옆 열과 높이가 같다.
    - 두 줄을 넘기면 말줄임으로 접는다. 글자는 DOM 에 그대로 남아 스크린리더가
      끝까지 읽고, 마우스에는 title 로 전체가 뜬다.
    - line-height 를 여기서 못박아 min-height 계산과 실제 줄 높이가 정확히
      맞는다(토큰 값과 같은 --ux-lh-tight 를 쓴다). */
.bd-col-title{
  width: 100%; min-width: 0; font-weight: 900; color: var(--ux-ink);
  white-space: normal; word-break: keep-all; overflow-wrap: anywhere;
  line-height: var(--ux-lh-tight);
  min-height: calc(2 * var(--ux-lh-tight) * 1em);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
  overflow: hidden;
}
.bd-col-count{ color: var(--ux-ink); }
/* 추가·관리 버튼도 같은 축에 가운데로. */
.bd-col-tools{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; justify-content: center; }

/* 어디에 올릴까요 — 주제를 색과 이름으로 고른다. 아이가 글을 쓰기 전에
   어디로 가는지 알아야 한다. */
/* 이름 입력칸과 저장 버튼을 한 줄로. 좁으면 버튼이 아래로 내려간다. */
.bd-admin-titlerow{ display: flex; gap: var(--ux-space-2); align-items: center; flex-wrap: wrap; }
.bd-admin-titlerow .bd-input{ flex: 1 1 140px; min-width: 0; }
.bd-admin-titlerow .bd-btn[aria-disabled="true"]{ opacity: .55; }

.bd-topicpick{ display: grid; gap: var(--ux-space-3); grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.bd-topicpick-btn{
  display: grid; gap: 2px; justify-items: center; text-align: center;
  padding: var(--ux-space-3);
  background: color-mix(in srgb, var(--col-tint, var(--ux-surface)) 18%, var(--ux-surface));
  border: 3px solid color-mix(in srgb, var(--col-tint, var(--ux-primary-border)) 60%, var(--ux-primary-border));
  border-radius: var(--ux-radius-surface);
  font-family: inherit; cursor: pointer; color: var(--ux-ink);
}
.bd-topicpick-name{ font-weight: 800; word-break: keep-all; overflow-wrap: anywhere; }
/* 튜토리얼 대화상자(화면 아래 고정)가 떠 있는 동안 칼럼 안쪽에 그만큼 스크롤
   여백을 준다. 없으면 칼럼 맨 아래 카드의 듣기·답장·공감 버튼이 상자에 가려
   끝까지 내려도 눌리지 않는다. --tutorial-dialogue-h 는 DialogueBox 가 떠
   있는 동안에만 존재하므로 평소 레이아웃은 그대로다. */
.bd-col-body{
  display: grid; gap: var(--ux-space-3);
  max-height: clamp(320px, 62svh, 900px); overflow-y: auto;
  padding-bottom: var(--tutorial-dialogue-h, 0px);
}
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
/* 감정 덱은 .narrow 를 쓰면 안 된다. 거기 걸린 justify-items:center 때문에
   격자가 내용 폭까지 쪼그라들어, 460px 모달 안에서 실제 폭이 253px 밖에 안
   됐다 — 어느 화면에서든 2열 고정이라 감정 20장이 10줄(974px)로 늘어졌다.
   폭을 그대로 쓰게 두고 조금 넓힌다. */
.bd-modal.emotion{ max-width: 560px; }
.bd-modal.emotion > *{ width: 100%; }
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

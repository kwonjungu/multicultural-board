import { ref, set, update, push, onValue, remove, get } from "firebase/database";
import { getClientDb } from "./firebase-client";
import type {
  StorybookSession,
  StorybookResponse,
  Storybook,
  StorybookPhase,
  StorybookChatTurn,
  StorybookAlert,
  StorybookLiveBoard,
} from "./types";

// Firebase path layout:
//   rooms/{roomCode}/storybook/session
//       { bookId, phase, currentPage, currentQuestionId, activeCharacterId, teacherClientId, startedAt }
//   rooms/{roomCode}/storybook/responses/{questionId}/{clientId}
//   rooms/{roomCode}/storybook/chat/{clientId}/{turnId}
//   rooms/{roomCode}/storybook/alerts/{alertId}

function sessionPath(roomCode: string): string {
  return `rooms/${roomCode}/storybook/session`;
}
function responsesPath(roomCode: string, questionId: string): string {
  return `rooms/${roomCode}/storybook/responses/${questionId}`;
}
function chatPath(roomCode: string, clientId: string): string {
  return `rooms/${roomCode}/storybook/chat/${clientId}`;
}
function alertsPath(roomCode: string): string {
  return `rooms/${roomCode}/storybook/alerts`;
}
// [#1] 책별 영속 답변 — storybook 서브트리 밖이라 endSession 의 wipe 영향을 받지 않는다.
//   rooms/{roomCode}/bookAnswers/{bookId}/{questionId}/{clientId}
function bookAnswersPath(roomCode: string, bookId: string, questionId: string): string {
  return `rooms/${roomCode}/bookAnswers/${bookId}/${questionId}`;
}

// === Book loading ===
// Static books live under /public/storybooks/{id}/book.json.
// Generated books live under Firebase at generated_books/{id}.

const STATIC_BOOK_IDS = ["curious-worlds", "seasons-beauty"];

export async function loadBook(bookId: string): Promise<Storybook> {
  if (STATIC_BOOK_IDS.includes(bookId)) {
    const res = await fetch(`/storybooks/${bookId}/book.json`);
    if (!res.ok) throw new Error(`Failed to load static book ${bookId}`);
    return (await res.json()) as Storybook;
  }
  // Firebase generated book
  const db = getClientDb();
  const snap = await get(ref(db, `generated_books/${bookId}`));
  const val = snap.val() as Storybook | null;
  if (!val) throw new Error(`Generated book ${bookId} not found`);
  return val;
}

// Firebase Realtime DB rejects `undefined`. Strip any undefined deeply before
// writing. Null values are kept (they actively signal "clear this field").
function stripUndefined<T>(value: T): T {
  if (value === undefined) return value;
  if (value === null) return value;
  if (Array.isArray(value)) {
    return value
      .map((v) => stripUndefined(v))
      .filter((v) => v !== undefined) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export async function saveGeneratedBook(book: Storybook): Promise<void> {
  const db = getClientDb();
  await set(ref(db, `generated_books/${book.id}`), stripUndefined(book));
}

export interface BookListEntry {
  id: string;
  titleKo: string;
  coverEmoji: string;
  coverImageUrl?: string;      // Present when the book has a generated/static cover image
  source: "static" | "generated";
  createdAt?: number;
  authorName?: string;
  visible?: boolean;           // [신규] 학생 자유 읽기 공개 여부 (기본=숨김)
  wordQuizEnabled?: boolean;   // [신규] 책별 단어 퀴즈 기본 사용 여부
  hasVocab?: boolean;          // [신규] 단어 퀴즈 가능 여부(어휘 4개 이상)
}

export async function listGeneratedBooks(): Promise<BookListEntry[]> {
  const db = getClientDb();
  const snap = await get(ref(db, "generated_books"));
  const val = snap.val() as Record<string, Storybook> | null;
  if (!val) return [];
  return Object.values(val)
    .filter(Boolean)
    .map((b) => ({
      id: b.id,
      titleKo: b.title?.ko || b.id,
      coverEmoji: b.cover?.emoji || "📖",
      coverImageUrl: b.cover?.imageUrl,
      source: "generated" as const,
      createdAt: b.createdAt,
      authorName: b.authorName,
      visible: b.visible ?? false,
      wordQuizEnabled: b.wordQuizEnabled ?? false,
      hasVocab: (b.vocab?.length ?? 0) >= 4,
    }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** [신규] 책의 공개 여부 / 단어 퀴즈 토글을 즉시 갱신. */
export async function setBookFlags(
  bookId: string,
  flags: { visible?: boolean; wordQuizEnabled?: boolean },
): Promise<void> {
  const db = getClientDb();
  const updates: Record<string, boolean> = {};
  if (typeof flags.visible === "boolean") updates.visible = flags.visible;
  if (typeof flags.wordQuizEnabled === "boolean") updates.wordQuizEnabled = flags.wordQuizEnabled;
  if (Object.keys(updates).length === 0) return;
  await update(ref(db, `generated_books/${bookId}`), updates);
}

export async function deleteGeneratedBook(bookId: string): Promise<void> {
  const db = getClientDb();
  await remove(ref(db, `generated_books/${bookId}`));
}

export async function updateGeneratedBookPageImage(
  bookId: string,
  pageIdx: number,
  imageUrl: string,
): Promise<void> {
  const db = getClientDb();
  const snap = await get(ref(db, `generated_books/${bookId}`));
  const book = snap.val() as Storybook | null;
  if (!book) throw new Error("book not found");
  if (pageIdx === 0) {
    // Cover image
    book.cover = { ...book.cover, imageUrl };
  } else {
    const page = book.pages.find((p) => p.idx === pageIdx);
    if (!page) throw new Error("page not found");
    page.illustration = { ...page.illustration, imageUrl };
  }
  await set(ref(db, `generated_books/${bookId}`), stripUndefined(book));
}

export async function updateGeneratedBookField(
  bookId: string,
  updates: Partial<Storybook>,
): Promise<void> {
  const db = getClientDb();
  const snap = await get(ref(db, `generated_books/${bookId}`));
  const book = snap.val() as Storybook | null;
  if (!book) throw new Error("book not found");
  const merged = { ...book, ...updates };
  await set(ref(db, `generated_books/${bookId}`), stripUndefined(merged));
}

export async function updateGeneratedBookCharacterAvatar(
  bookId: string,
  characterId: string,
  avatarUrl: string,
): Promise<void> {
  const db = getClientDb();
  const snap = await get(ref(db, `generated_books/${bookId}`));
  const book = snap.val() as Storybook | null;
  if (!book) throw new Error("book not found");
  book.characters = book.characters.map((c) =>
    c.id === characterId ? { ...c, avatarUrl } : c,
  );
  await set(ref(db, `generated_books/${bookId}`), stripUndefined(book));
}

// === Session ===

export async function startSession(
  roomCode: string,
  bookId: string,
  teacherClientId: string,
  opts?: { wordQuizEnabled?: boolean },
): Promise<void> {
  const db = getClientDb();
  // 명시값이 없으면 책의 기본 단어 퀴즈 설정을 따른다.
  let wordQuizEnabled = opts?.wordQuizEnabled;
  if (wordQuizEnabled === undefined) {
    try {
      const snap = await get(ref(db, `generated_books/${bookId}/wordQuizEnabled`));
      wordQuizEnabled = !!snap.val();
    } catch { wordQuizEnabled = false; }
  }
  const initial: StorybookSession = {
    bookId,
    phase: "before",
    currentPage: 0,
    currentQuestionId: null,
    activeCharacterId: null,
    teacherClientId,
    startedAt: Date.now(),
    wordQuizEnabled: !!wordQuizEnabled,
  };
  await set(ref(db, sessionPath(roomCode)), stripUndefined(initial));
}

export async function endSession(roomCode: string): Promise<void> {
  const db = getClientDb();
  // Wipe the entire storybook subtree (session + responses + chat + alerts).
  await remove(ref(db, `rooms/${roomCode}/storybook`));
}

export function subscribeSession(
  roomCode: string,
  cb: (session: StorybookSession | null) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, sessionPath(roomCode));
  const unsub = onValue(r, (snap) => {
    const val = snap.val() as StorybookSession | null;
    cb(val ?? null);
  });
  return () => { unsub(); };
}

export async function setPhase(roomCode: string, phase: StorybookPhase): Promise<void> {
  const db = getClientDb();
  await update(ref(db, sessionPath(roomCode)), { phase });
}

export async function setPage(roomCode: string, page: number): Promise<void> {
  const db = getClientDb();
  await update(ref(db, sessionPath(roomCode)), {
    currentPage: page,
    currentQuestionId: null,
  });
}

export async function showQuestion(
  roomCode: string,
  questionId: string | null,
): Promise<void> {
  const db = getClientDb();
  await update(ref(db, sessionPath(roomCode)), { currentQuestionId: questionId });
}

export async function setActiveCharacter(
  roomCode: string,
  characterId: string | null,
): Promise<void> {
  const db = getClientDb();
  await update(ref(db, sessionPath(roomCode)), { activeCharacterId: characterId });
}

// === Responses ===

export async function submitResponse(
  roomCode: string,
  questionId: string,
  clientId: string,
  studentName: string,
  studentLang: string,
  text: string,
  bookId?: string,
  opts?: { kind?: "text" | "drawing" | "emotion"; imageUrl?: string },
): Promise<void> {
  const db = getClientDb();
  const r = ref(db, `${responsesPath(roomCode, questionId)}/${clientId}`);
  const payload: StorybookResponse = {
    id: clientId,
    questionId,
    clientId,
    studentName,
    studentLang,
    text: text.trim(),
    timestamp: Date.now(),
  };
  if (opts?.kind) payload.kind = opts.kind;
  if (opts?.imageUrl) payload.imageUrl = opts.imageUrl;
  // [#1] 책별 영속 사본 — 세션이 끝나도 친구들 답변이 남아 자유 읽기에서 보인다.
  //   표시용 부가 쓰기이므로 fire-and-forget (가드레일: 부가 쓰기는 await 금지).
  if (bookId) {
    set(ref(db, `${bookAnswersPath(roomCode, bookId, questionId)}/${clientId}`), payload).catch(() => {});
  }
  await set(r, payload);
  // 그림 응답으로 제출되면 라이브 보드를 "제출됨"으로 표시 (교사 모니터링 종료 신호).
  if (opts?.kind === "drawing") {
    update(ref(db, `${liveBoardsPath(roomCode, questionId)}/${clientId}`), { submitted: true }).catch(() => {});
  }
}

// === [#6 그림책] 라이브 그림 보드 — 학생이 그리는 중 스냅샷, 교사 실시간 모니터링 ===

function liveBoardsPath(roomCode: string, questionId: string): string {
  return `rooms/${roomCode}/storybook/boards/${questionId}`;
}

// 학생: 그리는 중 스냅샷 업로드 (호출 측에서 디바운스). 제출 전이므로 submitted=false.
export async function pushStorybookBoard(
  roomCode: string,
  questionId: string,
  clientId: string,
  studentName: string,
  dataUrl: string,
): Promise<void> {
  const db = getClientDb();
  await set(ref(db, `${liveBoardsPath(roomCode, questionId)}/${clientId}`), {
    clientId,
    studentName,
    dataUrl,
    updatedAt: Date.now(),
    submitted: false,
  } satisfies StorybookLiveBoard);
}

// 교사: 현재 질문의 전 학생 라이브 보드 구독 (이름순).
export function subscribeStorybookBoards(
  roomCode: string,
  questionId: string,
  cb: (boards: StorybookLiveBoard[]) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, liveBoardsPath(roomCode, questionId));
  const unsub = onValue(r, (snap) => {
    const val = snap.val() as Record<string, StorybookLiveBoard> | null;
    const list: StorybookLiveBoard[] = val
      ? Object.values(val)
          .filter((b) => b && b.dataUrl)
          .sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""))
      : [];
    cb(list);
  });
  return () => { unsub(); };
}

// [#1] 책별 영속 답변 구독 — 자유 읽기 화면에서 친구들의 예전 답변 표시.
export function subscribeBookAnswers(
  roomCode: string,
  bookId: string,
  questionId: string,
  cb: (list: StorybookResponse[]) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, bookAnswersPath(roomCode, bookId, questionId));
  const unsub = onValue(r, (snap) => {
    const val = snap.val() as Record<string, StorybookResponse> | null;
    const list = val
      ? Object.values(val)
          .filter(Boolean)
          .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      : [];
    cb(list);
  });
  return () => { unsub(); };
}

export function subscribeResponses(
  roomCode: string,
  questionId: string,
  cb: (list: StorybookResponse[]) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, responsesPath(roomCode, questionId));
  const unsub = onValue(r, (snap) => {
    const val = snap.val() as Record<string, StorybookResponse> | null;
    const list = val
      ? Object.values(val)
          .filter(Boolean)
          .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      : [];
    cb(list);
  });
  return () => { unsub(); };
}

// === Chat ===

export async function appendChatTurn(
  roomCode: string,
  clientId: string,
  turn: Omit<StorybookChatTurn, "id">,
): Promise<string> {
  const db = getClientDb();
  const listRef = ref(db, chatPath(roomCode, clientId));
  const newRef = push(listRef);
  const id = newRef.key as string;
  await set(newRef, stripUndefined({ ...turn, id }));
  return id;
}

export function subscribeChat(
  roomCode: string,
  clientId: string,
  cb: (turns: StorybookChatTurn[]) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, chatPath(roomCode, clientId));
  const unsub = onValue(r, (snap) => {
    const val = snap.val() as Record<string, StorybookChatTurn> | null;
    const list = val
      ? Object.values(val)
          .filter(Boolean)
          .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      : [];
    cb(list);
  });
  return () => { unsub(); };
}

export async function getChatTurnCount(roomCode: string, clientId: string): Promise<number> {
  const db = getClientDb();
  const snap = await get(ref(db, chatPath(roomCode, clientId)));
  const val = snap.val() as Record<string, StorybookChatTurn> | null;
  if (!val) return 0;
  // Count only student turns for the 15-turn limit
  return Object.values(val).filter((t) => t && t.from === "student").length;
}

// === Alerts (teacher notifications) ===

export async function raiseAlert(
  roomCode: string,
  alert: Omit<StorybookAlert, "id">,
): Promise<void> {
  const db = getClientDb();
  const listRef = ref(db, alertsPath(roomCode));
  const newRef = push(listRef);
  const id = newRef.key as string;
  await set(newRef, stripUndefined({ ...alert, id }));
}

export function subscribeAlerts(
  roomCode: string,
  cb: (list: StorybookAlert[]) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, alertsPath(roomCode));
  const unsub = onValue(r, (snap) => {
    const val = snap.val() as Record<string, StorybookAlert> | null;
    const list = val
      ? Object.values(val)
          .filter(Boolean)
          .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      : [];
    cb(list);
  });
  return () => { unsub(); };
}

export async function clearAlert(roomCode: string, alertId: string): Promise<void> {
  const db = getClientDb();
  await remove(ref(db, `${alertsPath(roomCode)}/${alertId}`));
}

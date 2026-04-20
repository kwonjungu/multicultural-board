import { ref, set, update, push, onValue, off, remove, get } from "firebase/database";
import { getClientDb } from "./firebase-client";
import type {
  StorybookSession,
  StorybookResponse,
  Storybook,
  StorybookPhase,
  StorybookChatTurn,
  StorybookAlert,
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

// === Book loading ===
// Static books live under /public/storybooks/{id}/book.json.
// Generated books live under Firebase at generated_books/{id}.

const STATIC_BOOK_IDS = ["buzz-sharing"];

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
  source: "static" | "generated";
  createdAt?: number;
  authorName?: string;
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
      source: "generated" as const,
      createdAt: b.createdAt,
      authorName: b.authorName,
    }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
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
  const page = book.pages.find((p) => p.idx === pageIdx);
  if (!page) throw new Error("page not found");
  page.illustration = { ...page.illustration, imageUrl };
  await set(ref(db, `generated_books/${bookId}`), stripUndefined(book));
}

// === Session ===

export async function startSession(
  roomCode: string,
  bookId: string,
  teacherClientId: string,
): Promise<void> {
  const db = getClientDb();
  const initial: StorybookSession = {
    bookId,
    phase: "before",
    currentPage: 0,
    currentQuestionId: null,
    activeCharacterId: null,
    teacherClientId,
    startedAt: Date.now(),
  };
  await set(ref(db, sessionPath(roomCode)), initial);
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
  return () => { off(r); void unsub; };
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
  await set(r, payload);
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
  return () => { off(r); void unsub; };
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
  return () => { off(r); void unsub; };
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
  return () => { off(r); void unsub; };
}

export async function clearAlert(roomCode: string, alertId: string): Promise<void> {
  const db = getClientDb();
  await remove(ref(db, `${alertsPath(roomCode)}/${alertId}`));
}

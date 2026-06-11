// 퀴즈 시도 원본 로그 — 누적 데이터의 핵심.
// vocabProgress 는 집계(testPassed/Failed 카운트)만 보관하고,
// 여기서는 시도별 raw 이벤트를 쌓아 교사 대시보드 분석에 사용한다.
//
// Firebase path:
//   rooms/{roomCode}/vocab/attempts/{clientId}/{attemptId} = VocabAttempt

import { ref, push, set, onValue, off, get } from "firebase/database";
import { getClientDb } from "./firebase-client";
import type { QuizFormat } from "./quizFormats";

export interface VocabAttempt {
  id: string;
  ts: number;
  format: QuizFormat;
  wordId: string;
  sentenceIdx?: 0 | 1 | 2;
  correct: boolean;
  attempts: number;            // 같은 문항을 몇 번째 시도에서 맞췄는지 (1=첫 시도)
  durationMs?: number;
  inputMode?: "type" | "voice" | "tap";
  studentName: string;
  // 4지선다 등에서 학생이 누른 보기 (분석용 — 어떤 distractor 에 헷갈리는지)
  pickedWordId?: string;
}

function basePath(roomCode: string): string {
  return `rooms/${roomCode}/vocab/attempts`;
}

export interface LogParams {
  roomCode: string;
  clientId: string;
  studentName: string;
  format: QuizFormat;
  wordId: string;
  sentenceIdx?: 0 | 1 | 2;
  correct: boolean;
  attempts: number;
  durationMs?: number;
  inputMode?: "type" | "voice" | "tap";
  pickedWordId?: string;
}

export async function logAttempt(p: LogParams): Promise<string> {
  const db = getClientDb();
  const listRef = ref(db, `${basePath(p.roomCode)}/${p.clientId}`);
  const newRef = push(listRef);
  const id = newRef.key as string;
  const entry: VocabAttempt = {
    id,
    ts: Date.now(),
    format: p.format,
    wordId: p.wordId,
    correct: p.correct,
    attempts: p.attempts,
    studentName: p.studentName,
  };
  if (typeof p.sentenceIdx === "number") entry.sentenceIdx = p.sentenceIdx;
  if (typeof p.durationMs === "number") entry.durationMs = p.durationMs;
  if (p.inputMode) entry.inputMode = p.inputMode;
  if (p.pickedWordId) entry.pickedWordId = p.pickedWordId;
  await set(newRef, entry);
  return id;
}

function entriesOf<T>(val: unknown): Array<[string, T]> {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return (val as Array<T | null | undefined>)
      .map((v, i) => [String(i), v] as [string, T | null | undefined])
      .filter(([, v]) => v != null) as Array<[string, T]>;
  }
  if (typeof val === "object") {
    return Object.entries(val as Record<string, T | null | undefined>)
      .filter(([, v]) => v != null) as Array<[string, T]>;
  }
  return [];
}

// 교사 대시보드 — 한 학생의 시도 전체 구독.
export function subscribeStudentAttempts(
  roomCode: string,
  clientId: string,
  cb: (attempts: VocabAttempt[]) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, `${basePath(roomCode)}/${clientId}`);
  const handler = onValue(r, (snap) => {
    const out: VocabAttempt[] = entriesOf<VocabAttempt>(snap.val()).map(([, v]) => v);
    out.sort((a, b) => b.ts - a.ts);
    cb(out);
  });
  return () => off(r, "value", handler);
}

// 교사 대시보드 — 반 전체 시도 구독 (학생별로 그룹).
export function subscribeRoomAttempts(
  roomCode: string,
  cb: (byClient: Record<string, VocabAttempt[]>) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, basePath(roomCode));
  const handler = onValue(r, (snap) => {
    const out: Record<string, VocabAttempt[]> = {};
    const root = snap.val();
    if (root && typeof root === "object") {
      for (const [clientId, perStudent] of Object.entries(root)) {
        const list = entriesOf<VocabAttempt>(perStudent).map(([, v]) => v);
        list.sort((a, b) => b.ts - a.ts);
        out[clientId] = list;
      }
    }
    cb(out);
  });
  return () => off(r, "value", handler);
}

// 일회성 fetch — 학생 한 명의 시도 전체. 데일리 골 자동 산정용.
export async function fetchStudentAttempts(
  roomCode: string,
  clientId: string,
): Promise<VocabAttempt[]> {
  const db = getClientDb();
  const r = ref(db, `${basePath(roomCode)}/${clientId}`);
  const snap = await get(r);
  const list = entriesOf<VocabAttempt>(snap.val()).map(([, v]) => v);
  list.sort((a, b) => b.ts - a.ts);
  return list;
}

// 일회성 fetch — 대시보드 진입 시 빠른 초기 표시.
export async function fetchRoomAttempts(
  roomCode: string,
): Promise<Record<string, VocabAttempt[]>> {
  const db = getClientDb();
  const r = ref(db, basePath(roomCode));
  const snap = await get(r);
  const out: Record<string, VocabAttempt[]> = {};
  const root = snap.val();
  if (root && typeof root === "object") {
    for (const [clientId, perStudent] of Object.entries(root)) {
      const list = entriesOf<VocabAttempt>(perStudent).map(([, v]) => v);
      list.sort((a, b) => b.ts - a.ts);
      out[clientId] = list;
    }
  }
  return out;
}

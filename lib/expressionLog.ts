// 표현 복습 로그 — 학생이 패들렛에 쓴 글에서 추출된 핵심 표현을 누적.
// 각 표현은 Leitner SRS 박스를 가지고 자기 due 시각에 따라 복습 대상이 된다.
//
// Firebase path: rooms/{roomCode}/expressions/{clientId}/{exprId} = ExpressionEntry

import { ref, push, set, update, onValue, off, get } from "firebase/database";
import { getClientDb } from "./firebase-client";
import { initialBox, initialDue, nextBoxAfter, nextDueAt, isDueNow, type SrsBox } from "./srs";

export interface ExpressionEntry {
  id: string;
  text: string;            // 원문 표현 (보통 한국어 학습 대상)
  lang: string;            // 원문 언어 (ko 가 기본)
  translation?: string;    // 학생 모국어 번역
  translationLang?: string;
  source: string;          // cardId 또는 "manual"
  ts: number;              // 생성 시각
  box: SrsBox;
  nextDueAt: number;
  lastReviewedAt?: number;
  reviewCount: number;     // 총 복습 횟수
  correctCount: number;    // 정답(기억함) 횟수
}

function basePath(roomCode: string, clientId: string): string {
  return `rooms/${roomCode}/expressions/${clientId}`;
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

// ── Push ──

export interface PushExpressionParams {
  roomCode: string;
  clientId: string;
  text: string;
  lang?: string;
  translation?: string;
  translationLang?: string;
  source: string;
}

export async function pushExpression(p: PushExpressionParams): Promise<string> {
  const db = getClientDb();
  const listRef = ref(db, basePath(p.roomCode, p.clientId));
  const newRef = push(listRef);
  const id = newRef.key as string;
  const now = Date.now();
  const entry: ExpressionEntry = {
    id,
    text: p.text.trim(),
    lang: p.lang || "ko",
    source: p.source,
    ts: now,
    box: initialBox(),
    nextDueAt: initialDue(now),
    reviewCount: 0,
    correctCount: 0,
  };
  if (p.translation && p.translation.trim()) entry.translation = p.translation.trim();
  if (p.translationLang) entry.translationLang = p.translationLang;
  await set(newRef, entry);
  return id;
}

// 같은 표현이 이미 있는지 가벼운 dedup — 텍스트가 같으면 push 안 함.
// 캐시 없이 매번 fetch 하므로 호출 자주 하지 말 것 (PadletBoard 카드 1회 작성당 1회).
export async function pushExpressionDedup(p: PushExpressionParams): Promise<string | null> {
  const db = getClientDb();
  const snap = await get(ref(db, basePath(p.roomCode, p.clientId)));
  const list = entriesOf<ExpressionEntry>(snap.val()).map(([, v]) => v);
  const normalized = p.text.trim().toLowerCase();
  const dup = list.find((e) => e.text.trim().toLowerCase() === normalized);
  if (dup) return null;
  return pushExpression(p);
}

// ── Subscribe ──

export function subscribeExpressions(
  roomCode: string,
  clientId: string,
  cb: (list: ExpressionEntry[]) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, basePath(roomCode, clientId));
  const handler = onValue(r, (snap) => {
    const list = entriesOf<ExpressionEntry>(snap.val()).map(([, v]) => v);
    // 신규 → 오래된 순 (ts 내림차순)
    list.sort((a, b) => b.ts - a.ts);
    cb(list);
  });
  return () => off(r, "value", handler);
}

// 일회성 fetch — VocabHub due 배지용.
export async function fetchExpressions(roomCode: string, clientId: string): Promise<ExpressionEntry[]> {
  const db = getClientDb();
  const snap = await get(ref(db, basePath(roomCode, clientId)));
  const list = entriesOf<ExpressionEntry>(snap.val()).map(([, v]) => v);
  list.sort((a, b) => b.ts - a.ts);
  return list;
}

// 지금 복습 대상.
export function filterDue(list: ExpressionEntry[], now: number = Date.now()): ExpressionEntry[] {
  return list
    .filter((e) => isDueNow(e.nextDueAt, now))
    .sort((a, b) => a.nextDueAt - b.nextDueAt); // 가장 오래 기다린 것부터
}

// ── Review 결과 반영 ──

export async function recordReviewResult(
  roomCode: string,
  clientId: string,
  exprId: string,
  correct: boolean,
): Promise<void> {
  const db = getClientDb();
  const r = ref(db, `${basePath(roomCode, clientId)}/${exprId}`);
  const snap = await get(r);
  const cur = snap.val() as ExpressionEntry | null;
  if (!cur) return;
  const now = Date.now();
  const newBox = nextBoxAfter(cur.box, correct);
  const patch: Partial<ExpressionEntry> = {
    box: newBox,
    nextDueAt: nextDueAt(newBox, now),
    lastReviewedAt: now,
    reviewCount: (cur.reviewCount ?? 0) + 1,
    correctCount: (cur.correctCount ?? 0) + (correct ? 1 : 0),
  };
  await update(r, patch);
}

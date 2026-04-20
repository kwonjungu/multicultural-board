// 소통창 문장 연습 — 오늘 카드 필터 + 연습 이력
// Firebase path: rooms/{roomCode}/practice/{clientId}/{cardId}
//   = { listened: bool, spoken: bool, written: bool, lastPracticed: ms }

import { ref, set, onValue } from "firebase/database";
import { getClientDb } from "./firebase-client";
import type { CardData } from "./types";

export interface PracticeRecord {
  listened: boolean;
  spoken: boolean;
  written: boolean;
  lastPracticed: number;
}

export type PracticeMap = Record<string, PracticeRecord>;

// Firebase 키 안전 인코딩
function encodeKey(s: string): string {
  return s.replace(/[.$#/\[\]]/g, "_");
}

function fbPath(roomCode: string, clientId: string): string {
  return `rooms/${roomCode}/practice/${encodeKey(clientId)}`;
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 오늘 작성된 텍스트 카드만 뽑아서 반환.
 * - text/comment 타입 (image/youtube 제외)
 * - originalText 있음
 * - timestamp 가 오늘 00:00 이후
 * - 최근에 올라온 것부터
 */
export function filterTodayCards(cards: Record<string, CardData> | null | undefined): CardData[] {
  if (!cards || typeof cards !== "object") return [];
  const since = startOfTodayMs();
  const out: CardData[] = [];
  for (const [id, c] of Object.entries(cards)) {
    if (!c || typeof c !== "object") continue;
    if (c.cardType !== "text") continue;
    if (!c.originalText || !c.originalText.trim()) continue;
    if (typeof c.timestamp !== "number" || c.timestamp < since) continue;
    out.push({ ...c, id: c.id ?? id });
  }
  out.sort((a, b) => b.timestamp - a.timestamp);
  return out;
}

/**
 * 카드에서 "한국어 문장" 뽑기.
 * - 작성자가 한국어면 originalText
 * - 아니면 translations.ko
 * - 둘 다 없으면 null (연습 불가)
 */
export function getKoreanText(card: CardData): string | null {
  if (card.authorLang === "ko" && card.originalText?.trim()) return card.originalText.trim();
  const ko = card.translations?.ko;
  if (typeof ko === "string" && ko.trim()) return ko.trim();
  return null;
}

/**
 * 카드에서 "학생 모국어 문장" 뽑기. 한국어 학생이면 null (번역 줄 숨김).
 */
export function getNativeText(card: CardData, studentLang: string): string | null {
  if (studentLang === "ko") return null;
  if (card.authorLang === studentLang && card.originalText?.trim()) return card.originalText.trim();
  const t = card.translations?.[studentLang];
  if (typeof t === "string" && t.trim()) return t.trim();
  return null;
}

// ───────── Firebase 이력 ─────────

export function subscribePractice(
  roomCode: string,
  clientId: string,
  cb: (map: PracticeMap) => void,
): () => void {
  const db = getClientDb();
  const unsub = onValue(ref(db, fbPath(roomCode, clientId)), (snap) => {
    const val = snap.val();
    if (!val || typeof val !== "object") { cb({}); return; }
    const map: PracticeMap = {};
    for (const [k, v] of Object.entries(val as Record<string, PracticeRecord>)) {
      if (!v || typeof v !== "object") continue;
      map[k] = {
        listened: !!v.listened,
        spoken: !!v.spoken,
        written: !!v.written,
        lastPracticed: Number(v.lastPracticed ?? 0),
      };
    }
    cb(map);
  });
  return () => unsub();
}

/** 카드별 연습 기록 업데이트 (낙관적). 기존 필드 보존하며 새 플래그 추가. */
export async function recordPractice(
  roomCode: string,
  clientId: string,
  cardId: string,
  patch: Partial<Pick<PracticeRecord, "listened" | "spoken" | "written">>,
  prev?: PracticeRecord,
): Promise<void> {
  const next: PracticeRecord = {
    listened: patch.listened ?? prev?.listened ?? false,
    spoken: patch.spoken ?? prev?.spoken ?? false,
    written: patch.written ?? prev?.written ?? false,
    lastPracticed: Date.now(),
  };
  try {
    const db = getClientDb();
    await set(ref(db, `${fbPath(roomCode, clientId)}/${cardId}`), next);
  } catch (err) {
    console.warn("[sentencePractice] 이력 저장 실패", err);
  }
}

/** 한 카드가 연습 완료 (듣기·말하기·쓰기 다 ✓) 인지 */
export function isCardFullyPracticed(rec?: PracticeRecord): boolean {
  if (!rec) return false;
  return !!(rec.listened && rec.spoken && rec.written);
}

/** 한 카드에서 몇 개 모드 완료했는지 (0~3) */
export function practiceProgress(rec?: PracticeRecord): number {
  if (!rec) return 0;
  return (rec.listened ? 1 : 0) + (rec.spoken ? 1 : 0) + (rec.written ? 1 : 0);
}

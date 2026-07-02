// 칭찬 전시장 (설계서 항목 7) — 우리 반 전원의 꾸민 벌 캐릭터 전시 +
// 하루 1회 좋아요/응원 댓글. 제한 단위: "보는 학생 1명 → 대상 학생 1명당"
// 하루 좋아요 1회 + 댓글 1회 (반 전체를 골고루 칭찬하도록 유도).
//
// rooms/{roomCode}/gallery/{targetClientId}/
//   ├─ likes/{voterClientId}        = { last: "YYYY-MM-DD", count: n }
//   ├─ commentGuard/{voterClientId} = "YYYY-MM-DD"
//   └─ comments/{pushId}            = GalleryComment
//
// 일일 1회 제한은 반드시 runTransaction 으로 원자화 (CLAUDE.md 가드레일 —
// get+set 분리하면 동시 탭에서 중복 지급된다).

import { ref, push, set, onValue, off, runTransaction } from "firebase/database";
import { getClientDb } from "./firebase-client";

export interface GalleryComment {
  id: string;
  fromClientId: string;
  fromName: string;
  fromLang: string;
  text: string;
  timestamp: number;
}

export interface GalleryLikeEntry {
  last: string;   // "YYYY-MM-DD" — 마지막으로 좋아요 누른 날
  count: number;  // 누적 좋아요 수 (이 voter 가 이 target 에게)
}

export interface GalleryEntry {
  likes?: Record<string, GalleryLikeEntry>;
  commentGuard?: Record<string, string>;
  comments?: Record<string, GalleryComment>;
}

export type GalleryData = Record<string, GalleryEntry>;

function galleryPath(roomCode: string): string {
  return `rooms/${roomCode}/gallery`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 이 학생이 받은 좋아요 총합 (모든 voter 의 누적 count 합) */
export function likeTotal(entry: GalleryEntry | undefined): number {
  if (!entry?.likes) return 0;
  return Object.values(entry.likes).reduce((a, e) => a + (e?.count ?? 0), 0);
}

/** 댓글 목록 (오래된 순) */
export function commentsOf(entry: GalleryEntry | undefined): GalleryComment[] {
  if (!entry?.comments) return [];
  return Object.values(entry.comments)
    .filter(Boolean)
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

/**
 * 하루 1회 좋아요 — runTransaction 원자화.
 * @returns true = 반영됨, false = 오늘 이미 눌러서 거부됨.
 */
export async function likeOncePerDay(
  roomCode: string,
  targetClientId: string,
  voterClientId: string,
): Promise<boolean> {
  const db = getClientDb();
  const r = ref(db, `${galleryPath(roomCode)}/${targetClientId}/likes/${voterClientId}`);
  const today = todayStr();
  const result = await runTransaction(r, (cur: GalleryLikeEntry | null) => {
    if (cur && cur.last === today) return; // abort — 오늘 이미 좋아요
    return { last: today, count: (cur?.count ?? 0) + 1 };
  });
  return result.committed;
}

/**
 * 하루 1회 응원 댓글 — guard 노드를 트랜잭션으로 선점한 뒤 push.
 * @returns true = 등록됨, false = 오늘 이미 남겨서 거부됨.
 */
export async function commentOncePerDay(
  roomCode: string,
  targetClientId: string,
  voter: { clientId: string; name: string; lang: string },
  text: string,
): Promise<boolean> {
  const trimmed = text.trim().slice(0, 120);
  if (!trimmed) return false;
  const db = getClientDb();
  const today = todayStr();
  const guardRef = ref(db, `${galleryPath(roomCode)}/${targetClientId}/commentGuard/${voter.clientId}`);
  const result = await runTransaction(guardRef, (cur: string | null) => {
    if (cur === today) return; // abort — 오늘 이미 댓글
    return today;
  });
  if (!result.committed) return false;

  const listRef = ref(db, `${galleryPath(roomCode)}/${targetClientId}/comments`);
  const newRef = push(listRef);
  const id = newRef.key as string;
  const comment: GalleryComment = {
    id,
    fromClientId: voter.clientId,
    fromName: voter.name,
    fromLang: voter.lang,
    text: trimmed,
    timestamp: Date.now(),
  };
  await set(newRef, comment);
  return true;
}

/** 방 전체 전시장 데이터 구독 (학급 규모라 단일 노드 구독으로 충분) */
export function subscribeGallery(
  roomCode: string,
  cb: (data: GalleryData) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, galleryPath(roomCode));
  const unsub = onValue(r, (snap) => {
    const val = snap.val() as GalleryData | null;
    cb(val ?? {});
  });
  return () => { off(r); void unsub; };
}

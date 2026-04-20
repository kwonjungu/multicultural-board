/**
 * 어휘 학습 녹음 — Firebase Storage 업로드 + RTDB 포인터 + 30일 자동 만료
 *
 * Storage path: vocab-recordings/{roomCode}/{clientId}/{wordId}_{sentenceIdx}.webm
 * RTDB pointer: rooms/{roomCode}/vocab/recordings/{clientId}/{wordId}_{sentenceIdx}
 *               { audioUrl, timestamp, duration, storagePath }
 *
 * 만료 정책 (30일):
 *   1차 방어 — 클라이언트 측 정리: VocabHub 마운트 시 본인 녹음 중 30일 초과건을 삭제
 *   2차 방어 (권장) — GCS Object Lifecycle Management 으로 30일 경과 객체 자동 삭제.
 *     콘솔/gsutil 에서 bucket 에 다음 룰 설정:
 *       {
 *         "lifecycle": { "rule": [{
 *           "action": { "type": "Delete" },
 *           "condition": { "age": 30, "matchesPrefix": ["vocab-recordings/"] }
 *         }]}
 *       }
 */

import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  ref as dbRef,
  set,
  get,
  remove,
  onValue,
} from "firebase/database";
import { getClientStorage, getClientDb } from "./firebase-client";

export const RECORDING_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

export interface RecordingPointer {
  audioUrl: string;
  timestamp: number;
  duration: number;
  storagePath: string;
}

function pointerPath(roomCode: string, clientId: string, wordId: string, sentenceIdx: number): string {
  return `rooms/${roomCode}/vocab/recordings/${encodeKey(clientId)}/${wordId}_${sentenceIdx}`;
}

function clientRecordingsPath(roomCode: string, clientId: string): string {
  return `rooms/${roomCode}/vocab/recordings/${encodeKey(clientId)}`;
}

function storagePathFor(roomCode: string, clientId: string, wordId: string, sentenceIdx: number): string {
  return `vocab-recordings/${roomCode}/${encodeKey(clientId)}/${wordId}_${sentenceIdx}.webm`;
}

// Firebase 키에 / . $ # [ ] 는 못 씀 — 이름을 안전 변환
function encodeKey(s: string): string {
  return s.replace(/[.$#/\[\]]/g, "_");
}

/**
 * Blob 업로드 → 기존 녹음 있으면 덮어쓰기. 포인터를 RTDB 에 기록하고 URL 반환.
 */
export async function uploadRecording(params: {
  roomCode: string;
  clientId: string;
  wordId: string;
  sentenceIdx: number;
  blob: Blob;
  duration: number;
}): Promise<RecordingPointer> {
  const { roomCode, clientId, wordId, sentenceIdx, blob, duration } = params;
  const path = storagePathFor(roomCode, clientId, wordId, sentenceIdx);

  const storage = getClientStorage();
  const objectRef = storageRef(storage, path);
  const contentType = blob.type || "audio/webm";
  await uploadBytes(objectRef, blob, { contentType });
  const url = await getDownloadURL(objectRef);

  const pointer: RecordingPointer = {
    audioUrl: url,
    timestamp: Date.now(),
    duration,
    storagePath: path,
  };
  const db = getClientDb();
  await set(dbRef(db, pointerPath(roomCode, clientId, wordId, sentenceIdx)), pointer);
  return pointer;
}

/**
 * 특정 단어의 내 녹음 포인터 구독 — 첫 fire 는 캐시, 이후는 실시간.
 * @returns unsubscribe
 */
export function subscribeRecordings(
  roomCode: string,
  clientId: string,
  wordId: string,
  cb: (byIdx: Record<number, RecordingPointer>) => void,
): () => void {
  const db = getClientDb();
  const path = clientRecordingsPath(roomCode, clientId);
  const r = dbRef(db, path);
  const unsub = onValue(r, (snap) => {
    const val = snap.val();
    if (!val || typeof val !== "object") { cb({}); return; }
    const out: Record<number, RecordingPointer> = {};
    for (const [k, v] of Object.entries(val as Record<string, RecordingPointer>)) {
      if (!k.startsWith(`${wordId}_`)) continue;
      const idx = Number(k.slice(wordId.length + 1));
      if (!Number.isFinite(idx)) continue;
      if (v && typeof v === "object") out[idx] = v;
    }
    cb(out);
  });
  return () => unsub();
}

/**
 * 개별 녹음 삭제 (재녹음 전에 이전 것 정리할 때 사용).
 * Storage 삭제 실패는 무시 (이미 없는 경우) — 포인터만 확실히 지움.
 */
export async function deleteRecording(ptr: RecordingPointer, pointerFullPath: string): Promise<void> {
  const storage = getClientStorage();
  const db = getClientDb();
  try {
    await deleteObject(storageRef(storage, ptr.storagePath));
  } catch { /* 이미 없거나 권한 이슈 — RTDB 만 정리 */ }
  await remove(dbRef(db, pointerFullPath));
}

/**
 * 30일 초과 녹음 정리 — VocabHub 마운트 시 1회 호출.
 * 본인 (clientId) 레코드만 스캔해 TTL 넘은 것 삭제.
 */
export async function cleanupExpiredRecordings(
  roomCode: string,
  clientId: string,
): Promise<number> {
  try {
    const db = getClientDb();
    const listPath = clientRecordingsPath(roomCode, clientId);
    const snap = await get(dbRef(db, listPath));
    const val = snap.val();
    if (!val || typeof val !== "object") return 0;

    const now = Date.now();
    let deleted = 0;
    const ops: Promise<void>[] = [];
    for (const [key, ptr] of Object.entries(val as Record<string, RecordingPointer>)) {
      if (!ptr || typeof ptr !== "object") continue;
      const ts = Number(ptr.timestamp);
      if (!Number.isFinite(ts)) continue;
      if (now - ts < RECORDING_TTL_MS) continue;
      ops.push(deleteRecording(ptr, `${listPath}/${key}`).then(() => { deleted++; }));
    }
    await Promise.allSettled(ops);
    return deleted;
  } catch (err) {
    console.warn("[vocabRecordings] 만료 정리 실패", err);
    return 0;
  }
}

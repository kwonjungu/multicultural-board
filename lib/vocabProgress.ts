// 단어 학습 진행도 — localStorage(오프라인 캐시) + Firebase RTDB(다기기 동기화) 이중 저장
// roomCode + studentName 단위로 키 분리.
//
// Firebase path: rooms/{roomCode}/vocab/progress/{clientId}/{wordId} = WordProgress
// 머지 규칙: 같은 wordId 면 doneSentences 합집합 + 최신 lastStudied/listenCount.
// 원격 > 로컬 시 원격 승리 (다른 기기/세션 편집 반영).

import { ref, set, onValue, update } from "firebase/database";
import { getClientDb } from "./firebase-client";

export interface WordProgress {
  doneSentences: number[]; // 완료한 예문 index (0,1,2 중)
  listenCount: number;     // 듣기 탭한 횟수 (참고용)
  lastStudied: number;     // ms timestamp
}

export type ProgressMap = Record<string, WordProgress>;

function storageKey(roomCode: string, studentName: string): string {
  return `vocab:${roomCode}:${studentName}`;
}

// Firebase 키에 / . $ # [ ] 는 못 씀 — 이름을 안전 변환
function encodeKey(s: string): string {
  return s.replace(/[.$#/\[\]]/g, "_");
}

function fbPath(roomCode: string, studentName: string): string {
  return `rooms/${roomCode}/vocab/progress/${encodeKey(studentName)}`;
}

export function loadProgress(roomCode: string, studentName: string): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(roomCode, studentName));
    if (!raw) return {};
    return JSON.parse(raw) as ProgressMap;
  } catch {
    return {};
  }
}

export function saveProgress(
  roomCode: string,
  studentName: string,
  map: ProgressMap,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(roomCode, studentName), JSON.stringify(map));
  } catch {
    // quota or privacy mode — 조용히 무시
  }
}

export function markSentenceDone(
  map: ProgressMap,
  wordId: string,
  sentenceIdx: number,
): ProgressMap {
  const prev = map[wordId] ?? { doneSentences: [], listenCount: 0, lastStudied: 0 };
  const set = new Set(prev.doneSentences);
  set.add(sentenceIdx);
  return {
    ...map,
    [wordId]: {
      ...prev,
      doneSentences: Array.from(set).sort((a, b) => a - b),
      lastStudied: Date.now(),
    },
  };
}

export function bumpListen(map: ProgressMap, wordId: string): ProgressMap {
  const prev = map[wordId] ?? { doneSentences: [], listenCount: 0, lastStudied: 0 };
  return {
    ...map,
    [wordId]: {
      ...prev,
      listenCount: prev.listenCount + 1,
      lastStudied: Date.now(),
    },
  };
}

export function wordDoneCount(map: ProgressMap, wordId: string): number {
  return map[wordId]?.doneSentences.length ?? 0;
}

export function masteredCount(map: ProgressMap): number {
  let n = 0;
  for (const v of Object.values(map)) {
    if (v.doneSentences.length >= 3) n++;
  }
  return n;
}

// ────────────── Firebase sync ──────────────

/** 두 ProgressMap 을 병합: 예문 doneSentences 합집합, max(lastStudied/listenCount). */
export function mergeProgress(a: ProgressMap, b: ProgressMap): ProgressMap {
  const out: ProgressMap = { ...a };
  for (const [wordId, pb] of Object.entries(b)) {
    if (!pb) continue;
    const pa = out[wordId];
    if (!pa) { out[wordId] = pb; continue; }
    const sentSet = new Set<number>();
    (pa.doneSentences ?? []).forEach((s) => sentSet.add(s));
    (pb.doneSentences ?? []).forEach((s) => sentSet.add(s));
    out[wordId] = {
      doneSentences: Array.from(sentSet).sort((x, y) => x - y),
      listenCount: Math.max(pa.listenCount ?? 0, pb.listenCount ?? 0),
      lastStudied: Math.max(pa.lastStudied ?? 0, pb.lastStudied ?? 0),
    };
  }
  return out;
}

/**
 * Firebase 에서 원격 진행도 구독.
 * - 첫 fire: 원격 전체를 현재 상태와 머지해 콜백으로 넘김
 * - 이후 fire: 원격 스냅샷 전체를 현재와 머지 — 새 완료/듣기가 있으면 반영
 * @returns unsubscribe
 */
export function subscribeProgress(
  roomCode: string,
  studentName: string,
  cb: (remote: ProgressMap) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, fbPath(roomCode, studentName));
  const unsub = onValue(r, (snap) => {
    const val = snap.val();
    if (!val || typeof val !== "object") { cb({}); return; }
    // Firebase 는 숫자 키를 배열로 변환할 수 있음 — 객체 엔트리로 통일
    const normalized: ProgressMap = {};
    for (const [k, v] of Object.entries(val as Record<string, WordProgress>)) {
      if (!v || typeof v !== "object") continue;
      normalized[k] = {
        doneSentences: Array.isArray(v.doneSentences)
          ? v.doneSentences.filter((n) => Number.isFinite(n))
          : [],
        listenCount: Number.isFinite(v.listenCount) ? v.listenCount : 0,
        lastStudied: Number.isFinite(v.lastStudied) ? v.lastStudied : 0,
      };
    }
    cb(normalized);
  });
  return () => unsub();
}

/**
 * 단일 단어 진행도를 Firebase 에 쓴다 (낙관적 — await 없이 호출 가능).
 * 실패는 로그만, 로컬 상태는 손상되지 않음.
 */
export async function writeWordProgress(
  roomCode: string,
  studentName: string,
  wordId: string,
  progress: WordProgress,
): Promise<void> {
  try {
    const db = getClientDb();
    await set(ref(db, `${fbPath(roomCode, studentName)}/${wordId}`), progress);
  } catch (err) {
    console.warn("[vocabProgress] Firebase 쓰기 실패", wordId, err);
  }
}

/** 여러 단어를 한 번에 쓴다 (update — 기존 다른 단어는 보존). */
export async function writeProgressBatch(
  roomCode: string,
  studentName: string,
  partial: ProgressMap,
): Promise<void> {
  try {
    const db = getClientDb();
    await update(ref(db, fbPath(roomCode, studentName)), partial);
  } catch (err) {
    console.warn("[vocabProgress] Firebase 배치 쓰기 실패", err);
  }
}

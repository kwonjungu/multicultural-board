// 로컬 단어 학습 진행도 (localStorage)
// roomCode + studentName 단위로 키 분리해 여러 방/학생이 섞이지 않게.

export interface WordProgress {
  doneSentences: number[]; // 완료한 예문 index (0,1,2 중)
  listenCount: number;     // 듣기 탭한 횟수 (참고용)
  lastStudied: number;     // ms timestamp
}

export type ProgressMap = Record<string, WordProgress>;

function storageKey(roomCode: string, studentName: string): string {
  return `vocab:${roomCode}:${studentName}`;
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

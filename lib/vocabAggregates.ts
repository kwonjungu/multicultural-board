// 반 단위 집계 — 교사 대시보드용.
// rooms/{roomCode}/vocab/progress/* + rooms/{roomCode}/vocab/attempts/* 를
// 한 번에 가져와 학생별/단어별/포맷별/카테고리별 통계로 롤업한다.

import { ref, get, onValue, off } from "firebase/database";
import { getClientDb } from "./firebase-client";
import { VOCAB_WORDS, type VocabWord } from "./vocabWords";
import type { WordProgress, ProgressMap } from "./vocabProgress";
import type { VocabAttempt } from "./vocabAttempts";
import type { QuizFormat } from "./quizFormats";

export interface ClassStudent {
  clientId: string;       // 저장 키 (= studentName encoded)
  name: string;           // 표시명 (디코딩 시도)
  progress: ProgressMap;
  attempts: VocabAttempt[];
}

export interface ClassSnapshot {
  roomCode: string;
  fetchedAt: number;
  students: ClassStudent[];
}

function decodeKey(k: string): string {
  // encodeKey 가 /._$#[] 를 _ 로 치환만 함 → 정확 복원 불가, 그대로 노출.
  return k;
}

function normalizeProgress(val: unknown): ProgressMap {
  if (!val || typeof val !== "object") return {};
  const out: ProgressMap = {};
  for (const [k, v] of Object.entries(val as Record<string, WordProgress>)) {
    if (!v || typeof v !== "object") continue;
    out[k] = {
      doneSentences: Array.isArray(v.doneSentences)
        ? (v.doneSentences as number[]).filter((n) => Number.isFinite(n))
        : [],
      listenCount: Number.isFinite(v.listenCount) ? v.listenCount : 0,
      lastStudied: Number.isFinite(v.lastStudied) ? v.lastStudied : 0,
      testPassed: Number.isFinite(v.testPassed) ? v.testPassed : 0,
      testFailed: Number.isFinite(v.testFailed) ? v.testFailed : 0,
      lastTested: Number.isFinite(v.lastTested) ? v.lastTested : 0,
    };
  }
  return out;
}

function normalizeAttempts(val: unknown): VocabAttempt[] {
  if (!val || typeof val !== "object") return [];
  const out: VocabAttempt[] = [];
  const entries = Array.isArray(val)
    ? (val as Array<VocabAttempt | null>).map((v, i) => [String(i), v] as const)
    : Object.entries(val as Record<string, VocabAttempt | null>);
  for (const [, v] of entries) {
    if (!v || typeof v !== "object") continue;
    out.push(v as VocabAttempt);
  }
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

// 한 번에 fetch — 대시보드 진입 시 사용.
export async function fetchClassSnapshot(roomCode: string): Promise<ClassSnapshot> {
  const db = getClientDb();
  const [progressSnap, attemptsSnap] = await Promise.all([
    get(ref(db, `rooms/${roomCode}/vocab/progress`)),
    get(ref(db, `rooms/${roomCode}/vocab/attempts`)),
  ]);
  const progressRoot = progressSnap.val() as Record<string, unknown> | null;
  const attemptsRoot = attemptsSnap.val() as Record<string, unknown> | null;

  const clientIds = new Set<string>();
  if (progressRoot) Object.keys(progressRoot).forEach((k) => clientIds.add(k));
  if (attemptsRoot) Object.keys(attemptsRoot).forEach((k) => clientIds.add(k));

  const students: ClassStudent[] = Array.from(clientIds).map((cid) => ({
    clientId: cid,
    name: decodeKey(cid),
    progress: normalizeProgress(progressRoot?.[cid]),
    attempts: normalizeAttempts(attemptsRoot?.[cid]),
  }));

  students.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return { roomCode, fetchedAt: Date.now(), students };
}

// 실시간 구독 — 대시보드 열려있는 동안 시도/진도가 들어오면 즉시 반영.
export function subscribeClassSnapshot(
  roomCode: string,
  cb: (snap: ClassSnapshot) => void,
): () => void {
  const db = getClientDb();
  const pRef = ref(db, `rooms/${roomCode}/vocab/progress`);
  const aRef = ref(db, `rooms/${roomCode}/vocab/attempts`);
  let progressRoot: Record<string, unknown> | null = null;
  let attemptsRoot: Record<string, unknown> | null = null;
  let initial = 0;

  function emit() {
    const ids = new Set<string>();
    if (progressRoot) Object.keys(progressRoot).forEach((k) => ids.add(k));
    if (attemptsRoot) Object.keys(attemptsRoot).forEach((k) => ids.add(k));
    const students: ClassStudent[] = Array.from(ids).map((cid) => ({
      clientId: cid,
      name: decodeKey(cid),
      progress: normalizeProgress(progressRoot?.[cid]),
      attempts: normalizeAttempts(attemptsRoot?.[cid]),
    }));
    students.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    cb({ roomCode, fetchedAt: Date.now(), students });
  }

  const onP = onValue(pRef, (s) => {
    progressRoot = (s.val() ?? null) as Record<string, unknown> | null;
    initial |= 1;
    if (initial === 3) emit();
    else if (initial !== 1) emit();
  });
  const onA = onValue(aRef, (s) => {
    attemptsRoot = (s.val() ?? null) as Record<string, unknown> | null;
    initial |= 2;
    if (initial === 3) emit();
    else if (initial !== 2) emit();
  });

  return () => {
    off(pRef, "value", onP);
    off(aRef, "value", onA);
  };
}

// ── 롤업 헬퍼 ──

export interface StudentRollup {
  clientId: string;
  name: string;
  wordsStudied: number;
  wordsMastered: number;             // doneSentences >= 3
  sentencesDone: number;             // 모든 단어의 doneSentences 합
  attemptCount: number;
  correctRate: number;               // 0~1
  lastActivity: number;              // ms
  formatCounts: Record<QuizFormat, { correct: number; total: number }>;
}

const EMPTY_FMT: Record<QuizFormat, { correct: number; total: number }> = {
  cloze: { correct: 0, total: 0 },
  mc4: { correct: 0, total: 0 },
  "mc4-image": { correct: 0, total: 0 },
  matching: { correct: 0, total: 0 },
  listening: { correct: 0, total: 0 },
  speak: { correct: 0, total: 0 },
};

export function rollupStudent(s: ClassStudent): StudentRollup {
  const studied = Object.values(s.progress).filter((p) => (p.doneSentences?.length ?? 0) > 0).length;
  const mastered = Object.values(s.progress).filter((p) => (p.doneSentences?.length ?? 0) >= 3).length;
  const sentences = Object.values(s.progress).reduce((acc, p) => acc + (p.doneSentences?.length ?? 0), 0);

  const fmt: Record<QuizFormat, { correct: number; total: number }> = JSON.parse(JSON.stringify(EMPTY_FMT));
  let correct = 0;
  let lastTs = 0;
  for (const a of s.attempts) {
    fmt[a.format] = fmt[a.format] ?? { correct: 0, total: 0 };
    fmt[a.format].total += 1;
    if (a.correct) { fmt[a.format].correct += 1; correct += 1; }
    if (a.ts > lastTs) lastTs = a.ts;
  }
  const studiedTs = Math.max(0, ...Object.values(s.progress).map((p) => p.lastStudied ?? 0));
  const finalLast = Math.max(lastTs, studiedTs);

  return {
    clientId: s.clientId,
    name: s.name,
    wordsStudied: studied,
    wordsMastered: mastered,
    sentencesDone: sentences,
    attemptCount: s.attempts.length,
    correctRate: s.attempts.length === 0 ? 0 : correct / s.attempts.length,
    lastActivity: finalLast,
    formatCounts: fmt,
  };
}

export interface WordRollup {
  word: VocabWord;
  studentsStudied: number;            // 이 단어를 1회 이상 학습한 학생 수
  studentsMastered: number;           // 모든 예문 done
  attemptCount: number;
  correctRate: number;
  weakestFormat?: QuizFormat;         // 정답률 최저 포맷 (시도 ≥3)
}

export function rollupWord(word: VocabWord, students: ClassStudent[]): WordRollup {
  let studied = 0;
  let mastered = 0;
  let attempts = 0;
  let correct = 0;
  const fmt: Record<QuizFormat, { c: number; t: number }> = {
    cloze: { c: 0, t: 0 }, mc4: { c: 0, t: 0 }, "mc4-image": { c: 0, t: 0 },
    matching: { c: 0, t: 0 }, listening: { c: 0, t: 0 }, speak: { c: 0, t: 0 },
  };
  for (const s of students) {
    const p = s.progress[word.id];
    if (p && (p.doneSentences?.length ?? 0) > 0) studied += 1;
    if (p && (p.doneSentences?.length ?? 0) >= 3) mastered += 1;
    for (const a of s.attempts) {
      if (a.wordId !== word.id) continue;
      attempts += 1;
      if (a.correct) correct += 1;
      fmt[a.format].t += 1;
      if (a.correct) fmt[a.format].c += 1;
    }
  }
  let weakest: QuizFormat | undefined;
  let weakestRate = 2;
  (Object.keys(fmt) as QuizFormat[]).forEach((f) => {
    if (fmt[f].t >= 3) {
      const rate = fmt[f].c / fmt[f].t;
      if (rate < weakestRate) { weakestRate = rate; weakest = f; }
    }
  });
  return {
    word,
    studentsStudied: studied,
    studentsMastered: mastered,
    attemptCount: attempts,
    correctRate: attempts === 0 ? 0 : correct / attempts,
    weakestFormat: weakest,
  };
}

export function rollupAllWords(students: ClassStudent[]): WordRollup[] {
  return VOCAB_WORDS.map((w) => rollupWord(w, students));
}

export interface FormatRollup {
  format: QuizFormat;
  total: number;
  correct: number;
  rate: number;
  avgDurationMs?: number;
}

export function rollupFormats(students: ClassStudent[]): FormatRollup[] {
  const acc: Record<QuizFormat, { total: number; correct: number; durSum: number; durN: number }> = {
    cloze: { total: 0, correct: 0, durSum: 0, durN: 0 },
    mc4: { total: 0, correct: 0, durSum: 0, durN: 0 },
    "mc4-image": { total: 0, correct: 0, durSum: 0, durN: 0 },
    matching: { total: 0, correct: 0, durSum: 0, durN: 0 },
    listening: { total: 0, correct: 0, durSum: 0, durN: 0 },
    speak: { total: 0, correct: 0, durSum: 0, durN: 0 },
  };
  for (const s of students) {
    for (const a of s.attempts) {
      const k = acc[a.format] ?? { total: 0, correct: 0, durSum: 0, durN: 0 };
      k.total += 1;
      if (a.correct) k.correct += 1;
      if (typeof a.durationMs === "number") { k.durSum += a.durationMs; k.durN += 1; }
      acc[a.format] = k;
    }
  }
  return (Object.keys(acc) as QuizFormat[]).map((f) => {
    const v = acc[f];
    return {
      format: f,
      total: v.total,
      correct: v.correct,
      rate: v.total === 0 ? 0 : v.correct / v.total,
      avgDurationMs: v.durN === 0 ? undefined : Math.round(v.durSum / v.durN),
    };
  });
}

export interface SubcategoryRollup {
  subcategory: string;
  total: number;
  correct: number;
  rate: number;
}

export function rollupSubcategories(students: ClassStudent[]): SubcategoryRollup[] {
  const byWord = new Map<string, VocabWord>(VOCAB_WORDS.map((w) => [w.id, w]));
  const acc: Record<string, { total: number; correct: number }> = {};
  for (const s of students) {
    for (const a of s.attempts) {
      const w = byWord.get(a.wordId);
      if (!w) continue;
      const k = acc[w.subcategory] ?? { total: 0, correct: 0 };
      k.total += 1;
      if (a.correct) k.correct += 1;
      acc[w.subcategory] = k;
    }
  }
  return Object.entries(acc).map(([subcategory, v]) => ({
    subcategory,
    total: v.total,
    correct: v.correct,
    rate: v.total === 0 ? 0 : v.correct / v.total,
  })).sort((a, b) => b.total - a.total);
}

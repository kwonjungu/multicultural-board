import { VOCAB_WORDS, type VocabWord } from "./vocabWords";
import type { ProgressMap } from "./vocabProgress";
import { buildQuiz, punchHole, type QuizQuestion as ClozeRaw } from "./vocabTest";
import { wordsForLesson } from "./lessons";
import { pickDistractors as pickDistractorsPure } from "./distractorMeta";

export type QuizFormat = "cloze" | "mc4" | "mc4-image" | "matching" | "listening";

export interface QuizChoice {
  wordId: string;
  label: string;
  iconUrl?: string;
}

export interface BaseItem {
  id: string;          // 문항 고유 ID — vocabAttempts 로그 키
  format: QuizFormat;
  wordId: string;      // 주제 단어 (matching 의 경우 첫 단어)
  word: VocabWord;
}

export interface ClozeItem extends BaseItem {
  format: "cloze";
  sentenceIdx: 0 | 1 | 2;
  cloze: string;
  answer: string;
  acceptedAnswers: string[];
}

export interface Mc4Item extends BaseItem {
  format: "mc4";
  prompt: string;          // 빈칸 처리된 문장
  choices: QuizChoice[];   // 4개 — 정답 + distractor 3
  correctIdx: 0 | 1 | 2 | 3;
}

export interface Mc4ImageItem extends BaseItem {
  format: "mc4-image";
  prompt: string;          // ko 문장 + 단어 자리는 ___
  choices: QuizChoice[];   // 4개 icon
  correctIdx: 0 | 1 | 2 | 3;
}

export interface MatchingPair {
  wordId: string;
  ko: string;       // 단어 원형
  hint: string;     // 매칭 대상 (예문 상황 또는 첫 예문)
}

export interface MatchingItem extends BaseItem {
  format: "matching";
  pairs: MatchingPair[];   // 4 쌍
}

export interface ListeningItem extends BaseItem {
  format: "listening";
  ttsText: string;         // 들려줄 한국어 문장 (정답 단어 포함)
  ttsLang: string;         // "ko"
  prompt: string;          // 화면 안내문
  choices: QuizChoice[];   // 4개
  correctIdx: 0 | 1 | 2 | 3;
}

export type QuizItem = ClozeItem | Mc4Item | Mc4ImageItem | MatchingItem | ListeningItem;

// ── 공통 헬퍼 ──

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 오답 선정은 distractorMeta 의 순수 함수에 위임 (복수 정답 방지 가드 포함).
function pickDistractors(target: VocabWord, n: number): VocabWord[] {
  return pickDistractorsPure(target, n, VOCAB_WORDS);
}

function genId(format: QuizFormat, wordId: string): string {
  return `${format}_${wordId}_${Math.random().toString(36).slice(2, 7)}`;
}

function iconUrlFor(wordId: string): string {
  return `/vocab-images/icons/${wordId}.png`;
}

// ── 포맷별 빌더 ──

function buildClozeItem(word: VocabWord, sentenceIdx: 0 | 1 | 2): ClozeItem | null {
  const sentence = word.sentences[sentenceIdx];
  const punched = punchHole(sentence.ko, word);
  if (!punched) return null;
  return {
    id: genId("cloze", word.id),
    format: "cloze",
    wordId: word.id,
    word,
    sentenceIdx,
    cloze: punched.cloze,
    answer: punched.answer,
    acceptedAnswers: [word.ko, ...word.conjugations].filter((f) => f.length >= 2),
  };
}

function buildMc4Item(word: VocabWord, sentenceIdx: 0 | 1 | 2): Mc4Item | null {
  const sentence = word.sentences[sentenceIdx];
  const punched = punchHole(sentence.ko, word);
  if (!punched) return null;
  const distractors = pickDistractors(word, 3);
  if (distractors.length < 3) return null;
  const correct: QuizChoice = { wordId: word.id, label: punched.answer };
  const choices = shuffle<QuizChoice>([
    correct,
    ...distractors.map((d) => ({ wordId: d.id, label: d.ko })),
  ]);
  const correctIdx = choices.findIndex((c) => c.wordId === word.id) as 0 | 1 | 2 | 3;
  return {
    id: genId("mc4", word.id),
    format: "mc4",
    wordId: word.id,
    word,
    prompt: punched.cloze,
    choices,
    correctIdx,
  };
}

function buildMc4ImageItem(word: VocabWord, sentenceIdx: 0 | 1 | 2): Mc4ImageItem | null {
  const sentence = word.sentences[sentenceIdx];
  const punched = punchHole(sentence.ko, word);
  if (!punched) return null;
  const distractors = pickDistractors(word, 3);
  if (distractors.length < 3) return null;
  const choices = shuffle<QuizChoice>([
    { wordId: word.id, label: word.ko, iconUrl: iconUrlFor(word.id) },
    ...distractors.map((d) => ({ wordId: d.id, label: d.ko, iconUrl: iconUrlFor(d.id) })),
  ]);
  const correctIdx = choices.findIndex((c) => c.wordId === word.id) as 0 | 1 | 2 | 3;
  return {
    id: genId("mc4-image", word.id),
    format: "mc4-image",
    wordId: word.id,
    word,
    prompt: punched.cloze,
    choices,
    correctIdx,
  };
}

function buildMatchingItem(word: VocabWord): MatchingItem | null {
  const distractors = pickDistractors(word, 3);
  if (distractors.length < 3) return null;
  const all = [word, ...distractors];
  const pairs: MatchingPair[] = all.map((w) => {
    const s = w.sentences[0];
    const hint = (s?.situation || s?.ko || w.ko).slice(0, 24);
    return { wordId: w.id, ko: w.ko, hint };
  });
  return {
    id: genId("matching", word.id),
    format: "matching",
    wordId: word.id,
    word,
    pairs,
  };
}

function buildListeningItem(word: VocabWord, sentenceIdx: 0 | 1 | 2): ListeningItem | null {
  const sentence = word.sentences[sentenceIdx];
  const distractors = pickDistractors(word, 3);
  if (distractors.length < 3) return null;
  const choices = shuffle<QuizChoice>([
    { wordId: word.id, label: word.ko },
    ...distractors.map((d) => ({ wordId: d.id, label: d.ko })),
  ]);
  const correctIdx = choices.findIndex((c) => c.wordId === word.id) as 0 | 1 | 2 | 3;
  return {
    id: genId("listening", word.id),
    format: "listening",
    wordId: word.id,
    word,
    ttsText: sentence.ko,
    ttsLang: "ko",
    prompt: "들어보고 알맞은 단어를 골라요",
    choices,
    correctIdx,
  };
}

const DEFAULT_FORMAT_CYCLE: QuizFormat[] = ["cloze", "mc4", "mc4-image", "listening", "matching"];

/**
 * 혼합 포맷 퀴즈 — 기존 buildQuiz 로 단어를 뽑고, 각 단어에 라운드로빈으로 포맷을 배정.
 * 빌더가 null 을 반환하면 자동으로 다음 포맷을 시도해 폴백한다.
 */
export function buildMixedQuiz(
  progress: ProgressMap,
  limit = 5,
  fallbackWordIds?: string[],
  formatCycle: QuizFormat[] = DEFAULT_FORMAT_CYCLE,
): QuizItem[] {
  const base = buildQuiz(progress, limit, fallbackWordIds);
  const out: QuizItem[] = [];

  base.forEach((q: ClozeRaw, i) => {
    const primary = formatCycle[i % formatCycle.length];
    const order: QuizFormat[] = [primary, ...formatCycle.filter((f) => f !== primary)];
    for (const fmt of order) {
      const item = makeItem(fmt, q.word, q.sentenceIdx);
      if (item) {
        out.push(item);
        return;
      }
    }
    // 모든 포맷 실패 → cloze 원본을 그대로 wrap
    out.push({
      id: genId("cloze", q.wordId),
      format: "cloze",
      wordId: q.wordId,
      word: q.word,
      sentenceIdx: q.sentenceIdx,
      cloze: q.cloze,
      answer: q.answer,
      acceptedAnswers: q.acceptedAnswers,
    });
  });

  return out;
}

function makeItem(fmt: QuizFormat, word: VocabWord, sentenceIdx: 0 | 1 | 2): QuizItem | null {
  switch (fmt) {
    case "cloze": return buildClozeItem(word, sentenceIdx);
    case "mc4": return buildMc4Item(word, sentenceIdx);
    case "mc4-image": return buildMc4ImageItem(word, sentenceIdx);
    case "matching": return buildMatchingItem(word);
    case "listening": return buildListeningItem(word, sentenceIdx);
  }
}

// 단원 레슨용 — 5단어 고정 풀에서 5포맷 라운드로빈으로 5문제 생성.
export function buildLessonQuiz(lessonId: string, formatCycle: QuizFormat[] = DEFAULT_FORMAT_CYCLE): QuizItem[] {
  const words = wordsForLesson(lessonId);
  const out: QuizItem[] = [];
  words.forEach((w, i) => {
    const primary = formatCycle[i % formatCycle.length];
    const order: QuizFormat[] = [primary, ...formatCycle.filter((f) => f !== primary)];
    for (const fmt of order) {
      const item = makeItem(fmt, w, 0);
      if (item) {
        out.push(item);
        return;
      }
    }
  });
  return out;
}

// 일일 챌린지용 — "단순/듣고 찾기" 중심의 탭형 포맷 (타이핑 cloze 제외).
export const CHALLENGE_FORMAT_CYCLE: QuizFormat[] = ["listening", "mc4-image", "mc4"];

function pickSentenceIdx(progress: ProgressMap, wordId: string): 0 | 1 | 2 {
  const done = progress[wordId]?.doneSentences ?? [];
  if (done.length > 0) {
    return done[Math.floor(Math.random() * done.length)] as 0 | 1 | 2;
  }
  return 0;
}

/**
 * 나의 단어 일일 챌린지 — **약점 단어 + 소통판 단어**를 섞어 듀오링고식 릴레이로.
 * 약점 우선(buildQuiz 의 priority), 소통판 단어 교차 삽입, 부족하면 기초(level≤2) 단어로
 * 채워 항상 target 문항을 보장한다. 포맷은 듣고 찾기/그림 중심(단순).
 *
 * @param progress 학습 이력
 * @param boardWordIds 소통판에서 추출된 단어 id (matched)
 * @param target 문항 수 (기본 10)
 */
export function buildDailyChallenge(
  progress: ProgressMap,
  boardWordIds: string[] = [],
  target = 10,
  formatCycle: QuizFormat[] = CHALLENGE_FORMAT_CYCLE,
): QuizItem[] {
  // 1) 약점/학습이력 단어 (priority>0, 정렬됨)
  const weakWords = buildQuiz(progress, Math.max(target, 8)).map((q) => q.word);
  // 2) 소통판 단어
  const boardWords = boardWordIds
    .map((id) => VOCAB_WORDS.find((w) => w.id === id))
    .filter((w): w is VocabWord => !!w);

  const seen = new Set<string>();
  const ordered: VocabWord[] = [];
  const push = (w?: VocabWord) => {
    if (w && !seen.has(w.id)) { seen.add(w.id); ordered.push(w); }
  };

  // 약점·소통판 교차 삽입 (둘 다 골고루)
  const maxLen = Math.max(weakWords.length, boardWords.length);
  for (let i = 0; i < maxLen && ordered.length < target; i++) {
    push(weakWords[i]);
    push(boardWords[i]);
  }
  // 부족하면 기초 단어로 채움
  if (ordered.length < target) {
    for (const w of shuffle(VOCAB_WORDS.filter((w) => w.level <= 2))) {
      push(w);
      if (ordered.length >= target) break;
    }
  }

  const finalWords = ordered.slice(0, target);

  // 포맷 라운드로빈 배정 (실패 시 다른 포맷으로 폴백)
  const out: QuizItem[] = [];
  finalWords.forEach((w, i) => {
    const sIdx = pickSentenceIdx(progress, w.id);
    const primary = formatCycle[i % formatCycle.length];
    const order: QuizFormat[] = [
      primary,
      ...formatCycle.filter((f) => f !== primary),
      ...DEFAULT_FORMAT_CYCLE.filter((f) => !formatCycle.includes(f)),
    ];
    for (const fmt of order) {
      const item = makeItem(fmt, w, sIdx);
      if (item) { out.push(item); return; }
    }
  });
  return out;
}

export const FORMAT_LABEL: Record<QuizFormat, string> = {
  cloze: "빈칸 채우기",
  mc4: "4지선다",
  "mc4-image": "그림 4지선다",
  matching: "단어-상황 짝짓기",
  listening: "듣고 고르기",
};

export const FORMAT_ICON: Record<QuizFormat, string> = {
  cloze: "✏️",
  mc4: "🔤",
  "mc4-image": "🖼️",
  matching: "🔗",
  listening: "🎧",
};

import { VOCAB_WORDS, VocabWord } from "./vocabWords";
import { ProgressMap, WordProgress } from "./vocabProgress";

export interface QuizQuestion {
  wordId: string;
  word: VocabWord;
  sentenceIdx: 0 | 1 | 2;
  cloze: string;              // 빈칸 처리된 예문 (ex: "상을 받아서 정말 ___")
  answer: string;             // 빈칸에 들어갈 원본 (ex: "기뻐요")
  acceptedAnswers: string[];  // 정답으로 인정할 활용형 목록
}

/**
 * 예문에서 단어의 활용형 중 하나를 찾아 ___ 로 치환한다.
 * 가장 긴 활용형부터 매칭 (더 구체적인 형태 우선).
 * @returns 매칭이 없으면 null
 */
export function punchHole(
  sentence: string,
  word: VocabWord,
): { cloze: string; answer: string } | null {
  const forms = [word.ko, ...word.conjugations]
    .filter((f) => f.length >= 2)
    .sort((a, b) => b.length - a.length);

  for (const form of forms) {
    const i = sentence.indexOf(form);
    if (i >= 0) {
      const cloze = sentence.slice(0, i) + "_____" + sentence.slice(i + form.length);
      return { cloze, answer: form };
    }
  }
  return null;
}

/**
 * 복습 우선순위 점수 — 높을수록 먼저 출제.
 * - 한 번도 안 배운 단어: 0 (출제 대상 아님)
 * - 미완주 (doneSentences < 3) 보너스
 * - 시험 실패 이력 → 반복 가중치
 * - 오래 안 본 것 (staleness) 가중
 * - 최근 시험 바로 직후는 낮춰서 다양성 확보
 */
function priority(p: WordProgress | undefined, now: number): number {
  if (!p) return 0;
  if (!p.doneSentences || p.doneSentences.length === 0) return 0;  // 학습 이력 없음

  let score = 10;

  // 미완주 우선
  if (p.doneSentences.length < 3) score += 15;

  // 실패 이력 가중 — failed 많을수록 반복
  const failed = p.testFailed ?? 0;
  const passed = p.testPassed ?? 0;
  const failRate = failed / Math.max(1, failed + passed);
  score += failed * 5 + failRate * 10;

  // Staleness — 마지막 학습 후 시간 경과 (일 단위)
  const lastStudied = p.lastStudied ?? 0;
  const daysSince = (now - lastStudied) / (24 * 60 * 60 * 1000);
  score += Math.min(20, daysSince * 2);

  // 시험 직후는 잠깐 낮춤 (10분 내)
  const lastTested = p.lastTested ?? 0;
  if (now - lastTested < 10 * 60 * 1000) score *= 0.4;

  return score;
}

/**
 * 시험 세트 생성 — 이력 기반 상위 N개 단어를 뽑아 각각 예문 1개를 출제.
 * @param progress 현재 학습 이력
 * @param limit 문제 수 (기본 5)
 * @param fallbackIfEmpty 이력이 비면 board-matched / 기초 10개로 폴백
 */
export function buildQuiz(
  progress: ProgressMap,
  limit = 5,
  fallbackWordIds?: string[],
): QuizQuestion[] {
  const now = Date.now();

  // 후보 풀 — 학습 이력 있는 단어
  const candidates = VOCAB_WORDS
    .map((w) => ({ w, score: priority(progress[w.id], now) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // 학습 이력이 부족하면 (< 3개) 폴백 단어 섞기
  let chosenWords: VocabWord[];
  if (candidates.length < 3 && fallbackWordIds && fallbackWordIds.length > 0) {
    const fb = fallbackWordIds
      .map((id) => VOCAB_WORDS.find((w) => w.id === id))
      .filter((w): w is VocabWord => !!w);
    const seen = new Set<string>();
    chosenWords = [];
    for (const w of [...candidates.map((c) => c.w), ...fb]) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      chosenWords.push(w);
      if (chosenWords.length >= limit) break;
    }
  } else {
    chosenWords = candidates.slice(0, limit).map((c) => c.w);
  }

  // 각 단어마다 예문 1개 선택 + 빈칸 뚫기
  const out: QuizQuestion[] = [];
  for (const w of chosenWords) {
    const p = progress[w.id];
    // 완료한 예문 우선 (이미 본 것 → 복습), 없으면 0
    const doneIndices = (p?.doneSentences ?? []);
    const candidateIndices = doneIndices.length > 0 ? doneIndices : [0];
    const pickIdx = candidateIndices[Math.floor(Math.random() * candidateIndices.length)] as 0 | 1 | 2;
    const sentence = w.sentences[pickIdx];

    const punched = punchHole(sentence.ko, w);
    if (!punched) continue; // 활용형 매칭 실패 → 스킵 (드문 케이스)

    out.push({
      wordId: w.id,
      word: w,
      sentenceIdx: pickIdx,
      cloze: punched.cloze,
      answer: punched.answer,
      acceptedAnswers: [w.ko, ...w.conjugations].filter((f) => f.length >= 2),
    });
  }

  return out;
}

/** 제출된 답이 정답 활용형 중 하나인지 검사 */
export function isAnswerCorrect(given: string, accepted: string[]): boolean {
  const norm = given.replace(/\s+/g, "").replace(/[.!?,~·•…'"()[\]]/g, "");
  if (!norm) return false;
  return accepted.some((a) => {
    const na = a.replace(/\s+/g, "");
    return norm.includes(na) || na.includes(norm);
  });
}

import { VOCAB_WORDS, VocabWord } from "./vocabWords";

export interface MatchedWord {
  wordId: string;
  score: number;      // 1~5
  reason: string;
}

/**
 * 로컬(무LLM) 폴백 추출 — 활용형 매칭 기반 빈도 카운트.
 * 서버/클라이언트 어디에서도 동작.
 */
export function extractVocabLocal(cardTexts: string[], limit = 12): MatchedWord[] {
  const joined = cardTexts.join("\n");
  if (!joined.trim()) return [];

  const freq: Record<string, number> = {};

  for (const word of VOCAB_WORDS) {
    const forms = [word.ko, ...word.conjugations];
    for (const form of forms) {
      if (form.length < 2) continue;
      const re = new RegExp(escapeRegExp(form), "g");
      const matches = joined.match(re);
      if (matches && matches.length > 0) {
        freq[word.id] = (freq[word.id] || 0) + matches.length;
      }
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({
      wordId: id,
      score: Math.min(5, Math.ceil(count / 2) + 2),
      reason: `${count}회 등장`,
    }));
}

export function wordById(id: string): VocabWord | undefined {
  return VOCAB_WORDS.find((w) => w.id === id);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 한국어 문장 유사도 (Jaccard 문자 집합 + 길이 비율). 0~1. */
export function sentenceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const normA = a.replace(/\s+/g, "").replace(/[.!?,~·•…'"()[\]]/g, "");
  const normB = b.replace(/\s+/g, "").replace(/[.!?,~·•…'"()[\]]/g, "");
  if (!normA || !normB) return 0;
  const setA = new Set(normA.split(""));
  const setB = new Set(normB.split(""));
  const arrA = Array.from(setA);
  const arrB = Array.from(setB);
  const common = arrA.filter((c) => setB.has(c)).length;
  const union = new Set(arrA.concat(arrB)).size;
  const jaccard = common / union;
  const lenRatio = Math.min(normA.length, normB.length) / Math.max(normA.length, normB.length);
  return jaccard * 0.7 + lenRatio * 0.3;
}

/** 인식된 문장이 단어의 활용형(또는 원형) 중 하나를 포함하는지. */
export function containsAnyForm(recognized: string, forms: string[]): boolean {
  const norm = recognized.replace(/\s+/g, "");
  return forms.some((f) => {
    const nf = f.replace(/\s+/g, "");
    if (nf.length < 2) return false;
    return norm.includes(nf);
  });
}

/**
 * 말하기 통과 기준 검사.
 * - 유사도 ≥ threshold (기본 0.7)
 * - 단어 활용형 중 하나 포함
 * @returns { passed, similarity, hasForm }
 */
export function checkSpeechMatch(params: {
  recognized: string;
  target: string;
  wordForms: string[];
  threshold?: number;
}): { passed: boolean; similarity: number; hasForm: boolean } {
  const similarity = sentenceSimilarity(params.recognized, params.target);
  const hasForm = containsAnyForm(params.recognized, params.wordForms);
  const passed = similarity >= (params.threshold ?? 0.7) && hasForm;
  return { passed, similarity, hasForm };
}

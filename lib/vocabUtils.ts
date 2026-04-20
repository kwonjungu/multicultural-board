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

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

/** 발음 매칭 전 공용 정규화: NFC → 공백/제로폭 제거 → 모든 문장부호·기호 제거 → 소문자.
 *  이 한 함수를 모든 비교가 공유해 '안녕하세요!' ≡ '안녕하세요.' ≡ '안녕하세요' 를 보장한다. */
export function normalizeForMatch(s: string): string {
  // \p{P}/u 는 tsconfig target es5 에서 불가(TS1501) → BMP 코드포인트 범위로 부호·기호 제거(u 플래그 불필요).
  // 모든 클래스를 \uXXXX 이스케이프로만 표기(리터럴 / [ ] 로 인한 정규식 종료 방지).
  return (s ?? "")
    .normalize("NFC")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "") // 공백 + 제로폭
    // ASCII 부호 + 라틴 ¡¿ + 하이픈/대시/따옴표/생략부호 + CJK 부호 + 전각형
    .replace(/[\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E\u00A1\u00BF\u2010-\u2027\u2030-\u205E\u3000-\u303F\uFF00-\uFF65]/g, "")
    .toLowerCase();
}

/** 문자 bigram Dice 계수 (0~1). 한국어 어순/반복에 견고. Map 대신 Record 사용(es5 다운레벨 안전). */
function diceBigram(a: string, b: string): number {
  if (a === b) return a.length === 0 ? 0 : 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s: string): Record<string, number> => {
    const m: Record<string, number> = {};
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m[g] = (m[g] ?? 0) + 1;
    }
    return m;
  };
  const ga = grams(a);
  const gb = grams(b);
  let inter = 0;
  for (const g of Object.keys(ga)) {
    inter += Math.min(ga[g], gb[g] ?? 0);
  }
  const total = (a.length - 1) + (b.length - 1);
  return total === 0 ? 0 : (2 * inter) / total;
}

function lenRatio(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;
  return Math.min(la, lb) / Math.max(la, lb);
}

/** 한국어 문장 유사도 0~1. (bigram Dice 0.7 + 길이비율 0.3, 공용 정규화) */
export function sentenceSimilarity(a: string, b: string): number {
  const normA = normalizeForMatch(a);
  const normB = normalizeForMatch(b);
  if (!normA || !normB) return 0;
  return diceBigram(normA, normB) * 0.7 + lenRatio(normA, normB) * 0.3;
}

/** 인식된 문장이 단어의 활용형(또는 원형) 중 하나를 포함하는지. 부호/공백 무시. */
export function containsAnyForm(recognized: string, forms: string[]): boolean {
  const norm = normalizeForMatch(recognized);
  if (!norm) return false;
  return forms.some((f) => {
    const nf = normalizeForMatch(f);
    return nf.length >= 2 && norm.includes(nf);
  });
}

/**
 * 말하기/답안 통과 기준 검사. 부호·공백 차이는 normalizeForMatch 로 흡수된다
 * ('안녕하세요!' ≡ '안녕하세요.').
 * - pass="both"(기본): 유사도 ≥ threshold **그리고** 핵심어 포함. (단어 시험 채점 등 기존 호환)
 * - pass="either"(발음 연습): 핵심어를 실제로 말함 **또는** 유사도 ≥ threshold.
 *   wordForms 미지정(자유 문장) 시엔 유사도만으로 판정(빈 forms 의 vacuous true 로 자동통과 안 함).
 * - 반환 hasForm 은 표시용: forms 미지정이면 요구 없음(true).
 */
export function checkSpeechMatch(params: {
  recognized: string;
  target: string;
  wordForms?: string[];
  threshold?: number;
  pass?: "both" | "either";
}): { passed: boolean; similarity: number; hasForm: boolean } {
  const similarity = sentenceSimilarity(params.recognized, params.target);
  const forms = params.wordForms ?? [];
  const hasForm = forms.length === 0 ? true : containsAnyForm(params.recognized, forms);
  const thr = params.threshold ?? 0.7;
  const passed = (params.pass ?? "both") === "either"
    ? (forms.length > 0 && hasForm) || similarity >= thr   // 핵심어 또는 유사도 (발음 연습)
    : similarity >= thr && hasForm;                          // 유사도 그리고 핵심어 (기존 채점)
  return { passed, similarity, hasForm };
}

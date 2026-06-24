// #5 오답(distractor) 품질 — 복수 정답 방지.
//
// 기존 pickDistractors 는 "같은 subcategory/category 에서 무작위 추출"만 해서
// 정답과 같은 극성·유사 의미의 단어(예: 기쁘다 ↔ 신나다)가 오답으로 섞여
// "정답이 사실상 여러 개"인 문항이 생겼다. 여기서는 단어별 극성(긍정/부정/중립)과
// 동의어군(sense group)을 정의해 정답과 "복수 정답 위험이 있는" 단어를 오답에서
// 배제한다. 반대 극성·다른 범주 단어는 (같은 품사라도) 명백한 오답이므로 허용한다.
//
// ⚠️ 순수 모듈(런타임 import 없음 — VocabWord 는 type-only). 단어 풀은 호출자가
//    주입한다. 덕분에 번들러 없이 node --test 로 직접 검증 가능하다.

import type { VocabWord } from "./vocabWords";

export type Polarity = "pos" | "neg" | "neu";

// 정서/의향이 뚜렷한 단어의 극성. (없는 단어는 극성 중립으로 간주 — 차단 안 함)
export const WORD_POLARITY: Record<string, Polarity> = {
  // 감정
  happy: "pos", fun: "pos", proud: "pos", thankful: "pos", excited: "pos", comfortable: "pos",
  sad: "neg", angry: "neg", scared: "neg", boring: "neg", lonely: "neg",
  sorry: "neg", worried: "neg", shy: "neg",
  surprised: "neu",
  // 의사표현
  want: "pos", like: "pos", need: "pos", ok: "pos", help: "pos", know: "pos", yes: "pos",
  dislike: "neg", dunno: "neg", no: "neg",
};

// 사실상 같은 뜻이라 서로 정답이 바뀌어도 자연스러운 동의어군.
// (범주가 달라도 복수 정답 위험이 있으므로 명시적으로 묶는다)
export const SENSE_GROUPS: string[][] = [
  ["thankful", "thanks"],   // 고맙다 ↔ 감사합니다
];

// 빈칸/문장 문맥에서 서로 바꿔도 자연스러워 "복수 정답"이 되기 쉬운 subcategory.
// 예: "선생님, ___!" 에는 안녕하세요·안녕히 가세요·감사합니다·축하해요가 다 들어간다.
// 이런 카테고리는 극성과 무관하게 같은 subcategory 단어끼리 오답으로 쓰지 않는다.
const INTERCHANGEABLE_SUBCATS = new Set<string>(["인사"]);

const groupIndex = new Map<string, number>();
SENSE_GROUPS.forEach((g, i) => g.forEach((id) => groupIndex.set(id, i)));

export function sameSenseGroup(aId: string, bId: string): boolean {
  const ga = groupIndex.get(aId);
  if (ga === undefined) return false;
  return ga === groupIndex.get(bId);
}

/**
 * 오답 후보 b 가 정답 a 와 "복수 정답"으로 헷갈릴 위험이 있는가 (= 오답 부적격).
 * - 같은 단어
 * - 같은 동의어군
 * - 문맥 호환 subcategory(인사 등) + 같은 subcategory
 * - 같은 의미 범주(subcategory) + 같은 극성 (예: 둘 다 긍정 감정)
 */
export function areConfusable(a: VocabWord, b: VocabWord): boolean {
  if (a.id === b.id) return true;
  if (sameSenseGroup(a.id, b.id)) return true;
  if (a.subcategory === b.subcategory) {
    // 인사말처럼 문맥상 서로 바꿔도 자연스러운 카테고리는 전부 혼동 가능.
    if (INTERCHANGEABLE_SUBCATS.has(a.subcategory)) return true;
    const pa = WORD_POLARITY[a.id];
    const pb = WORD_POLARITY[b.id];
    if (pa && pb && pa === pb) return true;
  }
  return false;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 정답과 혼동되지 않는 오답 n개 선정.
 * 우선순위: 같은 subcategory(같은 품사 → 진짜 시험) → 같은 category → 그 외.
 * 모든 단계에서 areConfusable 인 단어는 제외해 복수 정답을 원천 차단한다.
 */
export function pickDistractors(target: VocabWord, n: number, pool: VocabWord[]): VocabWord[] {
  const ok = (w: VocabWord) => w.id !== target.id && !areConfusable(target, w);
  const sameSub = pool.filter((w) => ok(w) && w.subcategory === target.subcategory);
  const sameCat = pool.filter((w) => ok(w) && w.category === target.category && w.subcategory !== target.subcategory);
  const others = pool.filter((w) => ok(w) && w.category !== target.category);
  const ordered = [...shuffle(sameSub), ...shuffle(sameCat), ...shuffle(others)];
  const seen = new Set<string>();
  const out: VocabWord[] = [];
  for (const w of ordered) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    out.push(w);
    if (out.length >= n) break;
  }
  return out;
}

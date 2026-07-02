// [신규] 그림책 단어 퀴즈 (알고리즘 B) — Storybook.vocab 으로부터 4지선다 문항 생성.
//
// 저학년 친화 기본형 = "낱말 → 뜻 고르기".
//  - 발문: 그림책에 나온 낱말 '{word}'의 뜻은?
//  - 정답: 해당 단어의 gloss
//  - 오답: distractors(부족하면 다른 추출어의 gloss 로 보충)
//
// 셔플 가드레일: 표시 순서 = 채점 순서 (단일 배열 + correct 플래그).
// VocabTest 규칙(표시·채점 일치)을 따른다.

import type { StorybookVocabWord } from "./types";

export interface SbQuizChoice {
  label: string;
  correct: boolean;
}

export interface SbQuizItem {
  id: string;
  wordId: string;
  promptLang: string;
  question: string;                 // 학생 언어 발문
  choices: SbQuizChoice[];          // 길이 4, 셔플 완료
}

// 어휘가 이보다 적으면 퀴즈를 만들지 않는다.
const MIN_VOCAB = 4;
const CHOICES = 4;

function pick<T>(map: Record<string, T> | undefined, lang: string): T | undefined {
  if (!map) return undefined;
  return map[lang] ?? map.ko ?? Object.values(map)[0];
}

// 학생 보기 언어 발문. 언어별 템플릿(없으면 한국어/영어).
const QUESTION_TEMPLATE: Record<string, (w: string) => string> = {
  ko: (w) => `그림책에 나온 낱말 ‘${w}’의 뜻은 무엇일까요?`,
  en: (w) => `What does the word “${w}” from the storybook mean?`,
  vi: (w) => `Từ “${w}” trong truyện có nghĩa là gì?`,
  zh: (w) => `绘本里的词语“${w}”是什么意思？`,
  fil: (w) => `Ano ang ibig sabihin ng salitang “${w}” sa kwento?`,
  ja: (w) => `絵本に出てきた言葉「${w}」の意味はなに？`,
};

function questionFor(word: string, lang: string): string {
  const fn = QUESTION_TEMPLATE[lang] || QUESTION_TEMPLATE.ko;
  return fn(word);
}

/**
 * 길이 편향 교정 — AI 가 정답 뜻풀이를 오답보다 길게 쓰는 경향이 있어,
 * "제일 긴 게 정답"이라는 메타 힌트가 생긴다. 정답이 오답 최장보다
 * 뚜렷이 길면(1.3배+ & +6자+) 정답을 첫 절/문장까지만 잘라 길이를 맞춘다.
 * (구두점 경계에서만 자르므로 뜻은 보존 — 자를 수 없으면 원문 유지)
 */
function trimAnswerBias(answer: string, distractors: string[]): string {
  const maxD = Math.max(0, ...distractors.map((d) => d.length));
  if (maxD === 0) return answer;
  if (answer.length <= maxD * 1.3 || answer.length - maxD <= 6) return answer;
  // 구두점(문장/절 경계) 후보 위치 중, 오답 최장에 가장 가까운 지점으로 컷
  // (matchAll 은 tsconfig target 이 낮아 이터레이션 불가 — exec 루프 사용)
  const cutPoints: number[] = [];
  const re = /[.。!?,，·;:]|(?:이에요|예요|해요|어요|아요|이다|한다)\s/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    const end = m.index + m[0].trimEnd().length;
    if (end >= 6) cutPoints.push(end);
    if (m.index === re.lastIndex) re.lastIndex++; // 무한루프 가드
  }
  // 목표: maxD 근처(±40%) 길이가 되는 가장 긴 컷
  const target = cutPoints.filter((p) => p <= maxD * 1.4 && p < answer.length);
  if (target.length === 0) return answer;
  const cut = Math.max(...target);
  const trimmed = answer.slice(0, cut).replace(/[,，;:]$/, "").trim();
  return trimmed.length >= 6 ? trimmed : answer;
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
 * vocab 으로부터 4지선다 문항 세트 생성.
 * @param vocab 추출 어휘 세트
 * @param viewerLang 학생 보기 언어
 */
export function buildStorybookQuiz(
  vocab: StorybookVocabWord[] | undefined,
  viewerLang: string,
): SbQuizItem[] {
  if (!vocab || vocab.length < MIN_VOCAB) return [];

  // 보충용 풀: 모든 단어의 gloss (정답 단어 제외하고 사용)
  const glossById = new Map<string, string>();
  for (const w of vocab) {
    const g = pick(w.gloss, viewerLang);
    if (g) glossById.set(w.id, g);
  }

  const out: SbQuizItem[] = [];
  for (const w of vocab) {
    const wordLabel = pick(w.word, viewerLang) || w.lemma;
    const answer = pick(w.gloss, viewerLang);
    if (!answer) continue; // 정답 뜻풀이가 없으면 출제 불가

    // 1) 단어별 distractors 우선
    const used = new Set<string>([answer]);
    const distractors: string[] = [];
    for (const d of pick(w.distractors, viewerLang) || []) {
      if (d && !used.has(d)) { used.add(d); distractors.push(d); }
      if (distractors.length >= CHOICES - 1) break;
    }
    // 2) 부족하면 다른 추출어 gloss 로 보충
    if (distractors.length < CHOICES - 1) {
      for (const w2 of shuffle(vocab)) {
        if (w2.id === w.id) continue;
        const g = glossById.get(w2.id);
        if (g && !used.has(g)) { used.add(g); distractors.push(g); }
        if (distractors.length >= CHOICES - 1) break;
      }
    }
    // 그래도 4개를 못 채우면 이 문항은 제외 (엣지: 어휘 풀이 너무 빈약)
    if (distractors.length < CHOICES - 1) continue;

    // 길이 편향 교정 — "제일 긴 보기 = 정답" 힌트 제거 (기존 생성 책에도 적용)
    const answerLabel = trimAnswerBias(answer, distractors);

    const choices: SbQuizChoice[] = shuffle([
      { label: answerLabel, correct: true },
      ...distractors.map((d) => ({ label: d, correct: false })),
    ]);

    out.push({
      id: `sbq_${w.id}_${Math.random().toString(36).slice(2, 7)}`,
      wordId: w.id,
      promptLang: viewerLang,
      question: questionFor(wordLabel, viewerLang),
      choices,
    });
  }
  return out;
}

// Duolingo 스타일 단원/레슨 구조 — 7서브카테고리를 Unit, 5단어씩 Lesson 으로 분할.
// 단어 풀(VOCAB_WORDS) 은 자동 생성됨, 여기서는 메타데이터(아이콘/색/순서) 만 정의.

import { VOCAB_WORDS, type VocabWord } from "./vocabWords";

export interface Unit {
  id: string;            // 안전 키 (영문)
  subcategory: string;   // 한국어 서브카테고리 (VocabWord.subcategory 와 일치)
  title: string;
  emoji: string;
  color: string;         // 단원 카드/노드 강조색 (그라데이션의 메인 hue)
  order: number;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;            // unitId + "-" + index (예: emotions-1)
  unitId: string;
  index: number;         // 1부터
  title: string;
  wordIds: string[];     // 이 레슨에서 다룰 단어 (5개)
}

const LESSON_SIZE = 5;

// 표시 순서 + 색 + 이모지 — 황의순 교사 요구 키워드 순서 고려
// (1) 인사 → (2) 감정 → (3) 지칭어 → (4) 학교생활 → (5) 일상동사 → (6) 일상형용사 → (7) 의사표현
const UNIT_META: Array<{ id: string; subcategory: string; title: string; emoji: string; color: string }> = [
  { id: "greetings",   subcategory: "인사",       title: "인사와 만남",   emoji: "👋", color: "#10B981" },
  { id: "emotions",    subcategory: "감정",       title: "내 마음과 감정", emoji: "😊", color: "#F59E0B" },
  { id: "pointers",    subcategory: "지칭어",     title: "이것과 저것",   emoji: "👉", color: "#22D3EE" },
  { id: "school",      subcategory: "학교생활",   title: "학교 생활",     emoji: "🏫", color: "#8B5CF6" },
  { id: "verbs",       subcategory: "일상동사",   title: "매일 하는 일",  emoji: "🏃", color: "#EF4444" },
  { id: "adjectives",  subcategory: "일상형용사", title: "어떤 모양일까", emoji: "📏", color: "#3B82F6" },
  { id: "expressions", subcategory: "의사표현",   title: "내 생각 말하기", emoji: "💬", color: "#EC4899" },
];

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

let _cache: Unit[] | null = null;

export function getUnits(): Unit[] {
  if (_cache) return _cache;
  const out: Unit[] = [];
  UNIT_META.forEach((meta, order) => {
    const words = VOCAB_WORDS
      .filter((w) => w.subcategory === meta.subcategory)
      .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
    if (words.length === 0) return;
    const groups = chunk(words, LESSON_SIZE);
    const lessons: Lesson[] = groups.map((g, idx) => ({
      id: `${meta.id}-${idx + 1}`,
      unitId: meta.id,
      index: idx + 1,
      title: `레슨 ${idx + 1}`,
      wordIds: g.map((w) => w.id),
    }));
    out.push({
      id: meta.id,
      subcategory: meta.subcategory,
      title: meta.title,
      emoji: meta.emoji,
      color: meta.color,
      order,
      lessons,
    });
  });
  _cache = out;
  return out;
}

export function findLesson(lessonId: string): { unit: Unit; lesson: Lesson } | null {
  for (const u of getUnits()) {
    const l = u.lessons.find((x) => x.id === lessonId);
    if (l) return { unit: u, lesson: l };
  }
  return null;
}

export function wordsForLesson(lessonId: string): VocabWord[] {
  const f = findLesson(lessonId);
  if (!f) return [];
  return f.lesson.wordIds
    .map((id) => VOCAB_WORDS.find((w) => w.id === id))
    .filter((w): w is VocabWord => !!w);
}

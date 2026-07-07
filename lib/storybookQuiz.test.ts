// [신규] 그림책 단어 퀴즈 생성기 단위 테스트.
// 실행: node --experimental-strip-types --test lib/storybookQuiz.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { StorybookVocabWord } from "./types.ts";
import { buildStorybookQuiz } from "./storybookQuiz.ts";

function vw(id: string, lemma: string, gloss: string, distractors: string[]): StorybookVocabWord {
  return {
    id,
    lemma,
    word: { ko: lemma, en: id },
    gloss: { ko: gloss, en: `${id}-gloss` },
    distractors: { ko: distractors, en: distractors.map((d) => `${d}-en`) },
    pageIdx: 1,
    difficulty: "mid",
  };
}

const SAMPLE: StorybookVocabWord[] = [
  vw("w1", "꿀", "벌이 모으는 단 음식", ["바위", "구름", "신발"]),
  vw("w2", "날개", "하늘을 나는 몸의 부분", ["바퀴", "지붕", "연필"]),
  vw("w3", "꽃밭", "꽃이 많이 핀 곳", ["교실", "냉장고", "주머니"]),
  vw("w4", "친구", "함께 노는 사람", ["돌멩이", "우산", "달력"]),
];

test("어휘 1개당 1문항씩 생성한다", () => {
  const quiz = buildStorybookQuiz(SAMPLE, "ko");
  assert.equal(quiz.length, 4);
});

test("각 문항은 보기 4개(정답 1 + 오답 3)를 가진다", () => {
  const quiz = buildStorybookQuiz(SAMPLE, "ko");
  for (const item of quiz) {
    assert.equal(item.choices.length, 4);
    assert.equal(item.choices.filter((c) => c.correct).length, 1);
  }
});

test("정답 보기는 해당 단어의 뜻풀이(gloss)다", () => {
  const quiz = buildStorybookQuiz(SAMPLE, "ko");
  const item = quiz.find((q) => q.wordId === "w1")!;
  const correct = item.choices.find((c) => c.correct)!;
  assert.equal(correct.label, "벌이 모으는 단 음식");
});

test("발문에 학생 보기 언어로 낱말이 들어간다", () => {
  const quiz = buildStorybookQuiz(SAMPLE, "ko");
  const item = quiz.find((q) => q.wordId === "w1")!;
  assert.ok(item.question.includes("꿀"));
});

test("어휘 4개 미만이면 빈 배열(퀴즈 생략)", () => {
  assert.equal(buildStorybookQuiz(SAMPLE.slice(0, 3), "ko").length, 0);
});

test("distractor 가 부족하면 다른 단어 gloss 로 보충해 4지선다를 채운다", () => {
  const lacking = SAMPLE.map((w) => ({ ...w, distractors: { ko: [], en: [] } }));
  const quiz = buildStorybookQuiz(lacking, "ko");
  // 각 문항이 그래도 보기 4개를 가져야 함 (다른 단어 gloss 보충)
  for (const item of quiz) {
    assert.equal(item.choices.length, 4);
    // 보기 라벨 중복 없음
    const labels = item.choices.map((c) => c.label);
    assert.equal(new Set(labels).size, labels.length);
  }
});

test("보기 언어 fallback — 해당 언어 데이터 없으면 ko 로 폴백", () => {
  const quiz = buildStorybookQuiz(SAMPLE, "vi");
  const item = quiz.find((q) => q.wordId === "w1")!;
  // vi gloss 가 없으므로 ko 로 폴백되어야 하고 빈 보기는 없어야 함
  assert.equal(item.choices.length, 4);
  for (const c of item.choices) assert.ok(c.label && c.label.length > 0);
});

test("정답 위치가 항상 0..3 범위이고 correct 플래그와 일치한다 (셔플 일관성)", () => {
  for (let i = 0; i < 30; i++) {
    const quiz = buildStorybookQuiz(SAMPLE, "ko");
    for (const item of quiz) {
      const idx = item.choices.findIndex((c) => c.correct);
      assert.ok(idx >= 0 && idx < 4);
    }
  }
});

test("example 필드가 있으면 문항에 예문이 실린다", () => {
  const withEx = SAMPLE.map((w) => ({ ...w, example: { ko: `우리는 ${w.lemma}를 보았어요.` } }));
  const quiz = buildStorybookQuiz(withEx, "ko");
  assert.ok(quiz.every((q) => q.example && q.example.includes("보았어요")));
});

test("example 이 없으면 페이지 본문에서 낱말이 든 문장을 찾는다", () => {
  const pages = [{
    idx: 1,
    text: { ko: "아침이 밝았어요. 붕붕이는 꿀을 모았어요. 참 신났어요." },
    illustration: { emoji: "🐝", bgGradient: "" },
  }];
  const quiz = buildStorybookQuiz(SAMPLE, "ko", pages as never);
  const q1 = quiz.find((q) => q.wordId === "w1"); // 꿀
  assert.ok(q1?.example?.includes("꿀"));
});

test("본문에도 낱말이 없으면 example 은 비운다 (undefined)", () => {
  const quiz = buildStorybookQuiz(SAMPLE, "ko", [] as never);
  assert.ok(quiz.every((q) => q.example === undefined));
});

test("어간 축약형이 1글자면 본문 매칭에 쓰지 않는다 (과매칭 방지)", () => {
  const vocab = [
    vw("w1", "모으다", "여기저기서 가져와 한데 합치다", ["바위", "구름", "신발"]),
    vw("w2", "날개", "하늘을 나는 몸의 부분", ["바퀴", "지붕", "연필"]),
    vw("w3", "꽃밭", "꽃이 많이 핀 곳", ["교실", "냉장고", "주머니"]),
    vw("w4", "친구", "함께 노는 사람", ["돌멩이", "우산", "달력"]),
  ];
  const pages = [{ idx: 1, text: { ko: "붕붕이가 모자를 썼어요." }, illustration: { emoji: "🐝", bgGradient: "" } }];
  const quiz = buildStorybookQuiz(vocab, "ko", pages as never);
  const q1 = quiz.find((q) => q.wordId === "w1");
  assert.equal(q1?.example, undefined);
});

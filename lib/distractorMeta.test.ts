// #5 오답(distractor) 품질 — 복수 정답 방지 단위 테스트.
// 실행: node --experimental-strip-types --test lib/distractorMeta.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { VocabWord } from "./vocabWords.ts";
import { VOCAB_WORDS } from "./vocabWords.ts";
import { areConfusable, pickDistractors } from "./distractorMeta.ts";

function word(id: string): VocabWord {
  const w = VOCAB_WORDS.find((x) => x.id === id);
  if (!w) throw new Error(`no vocab ${id}`);
  return w;
}

test("같은 subcat·같은 극성 감정 동의어는 혼동 가능 (오답 부적격)", () => {
  // 기쁘다(pos) vs 신나다(pos) — 둘 다 긍정 감정 → 복수 정답 위험
  assert.equal(areConfusable(word("happy"), word("excited")), true);
});

test("같은 subcat·반대 극성 감정은 혼동 아님 (명확한 오답 → 허용)", () => {
  // 기쁘다(pos) vs 슬프다(neg) — 문맥상 명백히 다름 → 좋은 오답
  assert.equal(areConfusable(word("happy"), word("sad")), false);
});

test("동의어군(cross-subcat) 은 혼동 가능", () => {
  // 고맙다(감정) vs 감사합니다(인사) — 사실상 같은 뜻
  assert.equal(areConfusable(word("thankful"), word("thanks")), true);
});

test("다른 의미 범주는 혼동 아님", () => {
  assert.equal(areConfusable(word("happy"), word("eat")), false);
});

test("인사말끼리는 혼동 가능 — 빈칸 문맥에서 서로 자연스러워 복수 정답 위험", () => {
  // "선생님, ___!" 에는 안녕하세요/안녕히 가세요/감사합니다 모두 들어간다.
  assert.equal(areConfusable(word("hello"), word("goodbye")), true);
  assert.equal(areConfusable(word("hello"), word("thanks")), true);
  assert.equal(areConfusable(word("goodbye"), word("congrats")), true);
});

test("pickDistractors(hello) 는 다른 인사말을 오답으로 내지 않는다", () => {
  const target = word("hello");
  for (let i = 0; i < 60; i++) {
    const ds = pickDistractors(target, 3, VOCAB_WORDS);
    assert.equal(ds.length, 3);
    for (const d of ds) {
      assert.notEqual(d.subcategory, "인사", `오답에 다른 인사말 ${d.id} 가 섞임`);
    }
  }
});

test("pickDistractors 는 정답과 혼동 가능한 단어를 절대 오답으로 내지 않는다", () => {
  // 셔플 무작위성 때문에 여러 번 반복 검증.
  const targets = ["happy", "excited", "like", "want", "thankful", "hello", "goodbye"];
  for (const id of targets) {
    const target = word(id);
    for (let i = 0; i < 40; i++) {
      const ds = pickDistractors(target, 3, VOCAB_WORDS);
      assert.equal(ds.length, 3, `${id}: 오답 3개 확보 실패`);
      for (const d of ds) {
        assert.equal(
          areConfusable(target, d),
          false,
          `${id} 의 오답으로 혼동 단어 ${d.id} 가 섞임`,
        );
        assert.notEqual(d.id, target.id);
      }
      // 오답끼리 중복 없어야 함
      const ids = ds.map((d) => d.id);
      assert.equal(new Set(ids).size, ids.length, `${id}: 오답 중복`);
    }
  }
});

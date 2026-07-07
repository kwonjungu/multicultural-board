// #8 언어 가드 — 외국어(중국어 등) 혼입 차단 단위 테스트.
// 실행: node --experimental-strip-types --test lib/langGuard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubDelta, sanitizeReply, targetScriptRatio, resolveReplyLang } from "./langGuard.ts";

test("sanitizeReply 는 한국어 답에서 한자를 제거하고 공백을 정리한다", () => {
  assert.equal(sanitizeReply("안녕 朋友 반가워", "ko"), "안녕 반가워");
});

test("sanitizeReply 는 영어 고유명사·이모지·숫자를 보존한다 (공통 허용)", () => {
  assert.equal(sanitizeReply("안녕 Tom 😀 123", "ko"), "안녕 Tom 😀 123");
});

test("sanitizeReply(vi) 는 한자를 제거하고 베트남어/라틴을 보존한다", () => {
  assert.equal(sanitizeReply("Xin chào 你好", "vi"), "Xin chào");
});

test("targetScriptRatio 는 오염된 답에 낮은 값을 준다", () => {
  assert.ok(targetScriptRatio("你好 세계", "ko") < 0.6);
});

test("targetScriptRatio 는 깨끗한 답에 높은 값을 준다", () => {
  assert.ok(targetScriptRatio("안녕하세요 반가워요", "ko") >= 0.99);
});

test("scrubDelta 는 허용 외 스크립트 문자를 실시간 제거한다", () => {
  assert.equal(scrubDelta("좋아 中", "ko"), "좋아 ");
});

// 과교정 방지 (불변식 §8): zh/ja 타깃에서 한자/가나 제거 금지
test("sanitizeReply(zh) 는 한자를 보존한다 (과교정 금지)", () => {
  assert.equal(sanitizeReply("你好 世界", "zh"), "你好 世界");
});

test("sanitizeReply(ja) 는 가나와 한자를 보존한다", () => {
  assert.equal(sanitizeReply("こんにちは 世界", "ja"), "こんにちは 世界");
});

test("targetScriptRatio(zh) 는 한자 답에 높은 값", () => {
  assert.ok(targetScriptRatio("你好 世界", "zh") >= 0.99);
});

// 알 수 없는 언어는 아무것도 제거하지 않는다 (안전)
test("알 수 없는 언어는 원문을 그대로 둔다", () => {
  assert.equal(sanitizeReply("안녕 你好 hello", "xx"), "안녕 你好 hello");
});

// 튜터: 비한국어 학생에게 한국어를 가르칠 때 [vi, ko] 허용 — 한국어는
// 보존하되 중국어는 제거한다.
test("다중 언어 허용은 한국어를 보존하고 중국어는 제거한다 (튜터)", () => {
  assert.equal(sanitizeReply("Xin chào! 안녕 是 friend", ["vi", "ko"]), "Xin chào! 안녕 friend");
});

test("다중 언어 허용에서 targetScriptRatio 는 한국어+베트남어를 타깃으로 본다", () => {
  assert.ok(targetScriptRatio("안녕 chào", ["vi", "ko"]) >= 0.99);
  assert.ok(targetScriptRatio("안녕 你好", ["vi", "ko"]) < 0.6);
});

// [항목 13] resolveReplyLang — 학생이 실제로 쓴 언어로 답한다
test("한국어로 쓴 학생 메시지는 프로필 언어와 무관하게 ko", () => {
  assert.equal(resolveReplyLang("붕붕이는 왜 슬펐어요?", "vi"), "ko");
});

test("모국어(비한국어)로 쓴 메시지는 프로필 언어 유지", () => {
  assert.equal(resolveReplyLang("Tại sao con ong buồn?", "vi"), "vi");
});

test("이모지·숫자만 있으면 프로필 언어 유지", () => {
  assert.equal(resolveReplyLang("😀 123", "ja"), "ja");
});

test("한글 한두 글자 섞인 외국어 문장은 프로필 언어 유지", () => {
  assert.equal(resolveReplyLang("Kkulbi 꿀 is sweet, why?", "en"), "en");
});

test("라틴 문자 위주 문장에 한글 2자 이상 있어도 라틴이 많으면 프로필 언어 유지", () => {
  assert.equal(resolveReplyLang("please tell me 꿀벌 story", "en"), "en");
});

// 실행: node --experimental-strip-types --test lib/furigana.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRuby, type RubySeg } from "./furiganaCore.ts";

test("세그먼트 연결이 원문과 같으면 유효", () => {
  const segs: RubySeg[] = [{ t: "山", r: "やま" }, { t: "に のぼる" }];
  assert.equal(validateRuby("山に のぼる", segs), true);
});

test("원문과 다르면 무효 (LLM 이 글자를 바꾼 경우)", () => {
  const segs: RubySeg[] = [{ t: "川", r: "かわ" }, { t: "に のぼる" }];
  assert.equal(validateRuby("山に のぼる", segs), false);
});

test("공백 차이는 허용 (정규화 비교)", () => {
  const segs: RubySeg[] = [{ t: "山", r: "やま" }, { t: "にのぼる" }];
  assert.equal(validateRuby("山に のぼる", segs), true);
});

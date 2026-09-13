/**
 * lib/detectScriptLang.ts 회귀 검사 — 활동지 OCR 글의 언어 판정.
 *
 *   실행: node scripts/test-detect-script-lang.mjs
 *
 * 이 함수의 계약은 "확실할 때만 답한다" 이다. 틀린 확신은 카드를 엉뚱한
 * 언어로 박제해 번역을 통째로 어긋나게 하므로, 애매하면 null 이어야 한다.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "bee-detect-"));
let mod;
try {
  const out = ts.transpileModule(readFileSync(join(root, "lib/detectScriptLang.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, "d.mjs"), out);
  mod = await import(pathToFileURL(join(dir, "d.mjs")));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const d = mod.detectScriptLang;

let n = 0;
const check = (name, fn) => { fn(); n++; console.log("PASS", name); };

check("한국어 활동지 본문", () => {
  assert.equal(d("1. 다음 그림을 보고 알맞은 낱말을 써 봅시다."), "ko");
  assert.equal(d("이름: ______  날짜: 2026 년 9 월 13 일"), "ko");
});

check("숫자와 빈칸이 많은 활동지에서도 한국어를 놓치지 않는다", () => {
  assert.equal(d("1) ____ + 2 = 5    2) 7 - ____ = 3    < 덧셈과 뺄셈 >"), "ko");
});

check("일본어는 가나로, 중국어는 한자만일 때", () => {
  assert.equal(d("これは にほんごの プリントです。漢字もあります。"), "ja");
  assert.equal(d("请看图片并写出正确的词语。"), "zh");
});

check("한자가 섞인 한국어를 중국어로 오판하지 않는다", () => {
  assert.equal(d("다음 漢字의 뜻을 써 봅시다."), "ko");
});

check("다른 문자 체계", () => {
  assert.equal(d("กรุณาเขียนคำที่ถูกต้อง"), "th");
  assert.equal(d("សូមសរសេរពាក្យត្រឹមត្រូវ"), "km");
  assert.equal(d("सही शब्द लिखिए।"), "hi");
  assert.equal(d("اكتب الكلمة الصحيحة"), "ar");
  assert.equal(d("Напишите правильное слово"), "ru");
});

check("베트남어는 성조 부호로 알아본다", () => {
  assert.equal(d("Hôm nay cơm chiên kim chi rất ngon."), "vi");
});

check("애매하면 null — 틀린 확신을 주지 않는다", () => {
  for (const t of ["Write the correct word.", "Nama: ______", "12345", "   ", ""]) {
    assert.equal(d(t), null, `"${t}" 는 null 이어야 한다`);
  }
  assert.equal(d(null), null);
  assert.equal(d(undefined), null);
});

check("한 글자 섞였다고 언어가 바뀌지 않는다 (비율 문턱)", () => {
  // 영어 문장에 한글 한 글자 — 비율이 낮아 ko 로 단정하지 않는다.
  const s = "This is a very long English sentence about the weather today 가";
  assert.notEqual(d(s), "ko");
});

console.log(`\n${n} checks passed`);

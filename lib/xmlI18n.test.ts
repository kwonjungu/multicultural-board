// XML 번역 공용 유틸 단위 테스트.
// 실행: node --experimental-strip-types --test lib/xmlI18n.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeXml, encodeXml, visualWidth,
  mergePptxRuns, mergeHwpxRuns,
  pptxFontForLang, hwpxFontForLang,
} from "./xmlI18n.ts";
import { sanitizeOcrBlocks } from "./ocrBlocks.ts";

test("decodeXml 은 &amp; 를 마지막에 풀어 이중 이스케이프를 보존한다", () => {
  assert.equal(decodeXml("&amp;lt;b&amp;gt;"), "&lt;b&gt;");
  assert.equal(decodeXml("&lt;tag&gt; &amp; &quot;x&quot;"), '<tag> & "x"');
  assert.equal(decodeXml("&#44608;&#xAE40;"), "김김");
});

test("encode(decode(s)) 라운드트립이 원본 XML 텍스트를 보존한다", () => {
  const samples = ["&amp;lt;", "1 &lt; 2 &amp;&amp; 3 &gt; 2", "&quot;안녕&quot;"];
  for (const s of samples) {
    assert.equal(encodeXml(decodeXml(s)), s);
  }
});

test("visualWidth 는 CJK 를 2칸으로 센다", () => {
  assert.equal(visualWidth("안녕", "ko"), 4);
  assert.equal(visualWidth("ab", "en"), 2);
});

test("mergePptxRuns 는 서식이 같은 인접 run 을 합친다", () => {
  const xml =
    `<a:p><a:r><a:rPr lang="ko-KR" sz="1800" dirty="0"/><a:t>안녕</a:t></a:r>` +
    `<a:r><a:rPr lang="en-US" sz="1800" dirty="1"/><a:t>하세요</a:t></a:r></a:p>`;
  const merged = mergePptxRuns(xml);
  assert.ok(merged.includes("<a:t>안녕하세요</a:t>"));
  assert.equal((merged.match(/<a:r>/g) || []).length, 1);
});

test("mergePptxRuns 는 글자 크기가 다른 run 은 합치지 않는다", () => {
  const xml =
    `<a:p><a:r><a:rPr sz="1800"/><a:t>제목</a:t></a:r>` +
    `<a:r><a:rPr sz="1200"/><a:t>부제</a:t></a:r></a:p>`;
  assert.equal(mergePptxRuns(xml), xml);
});

test("mergePptxRuns 는 줄바꿈(<a:br/>)이나 문단 경계를 넘어 합치지 않는다", () => {
  const brXml =
    `<a:r><a:rPr sz="1800"/><a:t>첫줄</a:t></a:r><a:br/>` +
    `<a:r><a:rPr sz="1800"/><a:t>둘째줄</a:t></a:r>`;
  assert.equal(mergePptxRuns(brXml), brXml);
  const paraXml =
    `<a:p><a:r><a:t>하나</a:t></a:r></a:p><a:p><a:r><a:t>둘</a:t></a:r></a:p>`;
  assert.equal(mergePptxRuns(paraXml), paraXml);
});

test("mergePptxRuns 는 rPr 에 자식 요소가 있는 run 은 건드리지 않는다", () => {
  const xml =
    `<a:r><a:rPr sz="1800"><a:latin typeface="Arial"/></a:rPr><a:t>가</a:t></a:r>` +
    `<a:r><a:rPr sz="1800"><a:latin typeface="Arial"/></a:rPr><a:t>나</a:t></a:r>`;
  assert.equal(mergePptxRuns(xml), xml);
});

test("mergeHwpxRuns 는 charPrIDRef 가 같은 인접 run 을 합친다", () => {
  const xml =
    `<hp:p><hp:run charPrIDRef="5"><hp:t>다문화 </hp:t></hp:run>` +
    `<hp:run charPrIDRef="5"><hp:t>소통판</hp:t></hp:run></hp:p>`;
  const merged = mergeHwpxRuns(xml);
  assert.ok(merged.includes("<hp:t>다문화 소통판</hp:t>"));
  assert.equal((merged.match(/<hp:run/g) || []).length, 1);
});

test("mergeHwpxRuns 는 서식이 다르거나 사이에 다른 요소가 있으면 합치지 않는다", () => {
  const diffStyle =
    `<hp:run charPrIDRef="1"><hp:t>가</hp:t></hp:run>` +
    `<hp:run charPrIDRef="2"><hp:t>나</hp:t></hp:run>`;
  assert.equal(mergeHwpxRuns(diffStyle), diffStyle);
  const withCtrl =
    `<hp:run charPrIDRef="1"><hp:t>가</hp:t></hp:run><hp:ctrl/>` +
    `<hp:run charPrIDRef="1"><hp:t>나</hp:t></hp:run>`;
  assert.equal(mergeHwpxRuns(withCtrl), withCtrl);
});

test("폰트 맵 — 스크립트별 폰트가 나오고 기본은 Arial/함초롬바탕", () => {
  assert.equal(pptxFontForLang("th"), "Leelawadee UI");
  assert.equal(pptxFontForLang("ko"), "맑은 고딕");
  assert.equal(pptxFontForLang("vi"), "Arial");
  assert.equal(hwpxFontForLang("ko"), "함초롬바탕");
  assert.equal(hwpxFontForLang("km"), "Khmer UI");
});

test("sanitizeOcrBlocks — 범위 클램프, % 좌표 변환, 쓰레기 폐기", () => {
  const blocks = sanitizeOcrBlocks([
    { x: 0.1, y: 0.2, w: 0.5, h: 0.05, text: "정상" },
    { x: 10, y: 20, w: 50, h: 5, text: "퍼센트" },        // % → 분수 변환
    { x: 500, y: 20, w: 50, h: 5, text: "픽셀" },          // 픽셀 추정 → 폐기
    { x: 0.9, y: 0.9, w: 0.5, h: 0.5, text: "넘침" },      // w/h 클램프
    { x: 0.1, y: 0.1, w: 0.2, h: 0.1, text: "" },          // 빈 텍스트 폐기
    { x: NaN, y: 0.1, w: 0.2, h: 0.1, text: "NaN" },       // 폐기
  ]);
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[1], { x: 0.1, y: 0.2, w: 0.5, h: 0.05, text: "퍼센트" });
  const over = blocks[2];
  assert.ok(over.x + over.w <= 1.0001 && over.y + over.h <= 1.0001);
});

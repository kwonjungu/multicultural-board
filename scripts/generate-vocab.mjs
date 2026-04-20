/**
 * Gemini Batch API로 100개 한국어 어휘 카드 데이터 생성
 * 모델: gemini-2.0-flash-lite (최저가)
 * 실행: node scripts/generate-vocab.mjs
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_KEY = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE";
const MODEL = "gemini-2.5-flash-lite";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

// ── 100개 단어 기본 정보 ──
const WORDS = [
  // A. 감정 (15)
  { id:"happy",       ko:"기쁘다",     cat:"adjective", sub:"감정", lv:1 },
  { id:"sad",         ko:"슬프다",     cat:"adjective", sub:"감정", lv:1 },
  { id:"angry",       ko:"화나다",     cat:"verb",      sub:"감정", lv:1 },
  { id:"scared",      ko:"무섭다",     cat:"adjective", sub:"감정", lv:1 },
  { id:"fun",         ko:"재미있다",   cat:"adjective", sub:"감정", lv:1 },
  { id:"boring",      ko:"지루하다",   cat:"adjective", sub:"감정", lv:2 },
  { id:"lonely",      ko:"외롭다",     cat:"adjective", sub:"감정", lv:2 },
  { id:"proud",       ko:"자랑스럽다", cat:"adjective", sub:"감정", lv:2 },
  { id:"sorry",       ko:"미안하다",   cat:"adjective", sub:"감정", lv:1 },
  { id:"thankful",    ko:"고맙다",     cat:"adjective", sub:"감정", lv:1 },
  { id:"worried",     ko:"걱정되다",   cat:"verb",      sub:"감정", lv:2 },
  { id:"excited",     ko:"신나다",     cat:"verb",      sub:"감정", lv:1 },
  { id:"shy",         ko:"부끄럽다",   cat:"adjective", sub:"감정", lv:2 },
  { id:"surprised",   ko:"놀라다",     cat:"verb",      sub:"감정", lv:2 },
  { id:"comfortable", ko:"편하다",     cat:"adjective", sub:"감정", lv:2 },

  // B. 지칭어/위치 (12)
  { id:"here",       ko:"여기",   cat:"noun", sub:"지칭어", lv:1 },
  { id:"there",      ko:"저기",   cat:"noun", sub:"지칭어", lv:1 },
  { id:"that_place", ko:"거기",   cat:"noun", sub:"지칭어", lv:1 },
  { id:"this",       ko:"이것",   cat:"noun", sub:"지칭어", lv:1 },
  { id:"that",       ko:"저것",   cat:"noun", sub:"지칭어", lv:1 },
  { id:"i_me",       ko:"나",     cat:"noun", sub:"지칭어", lv:1 },
  { id:"you",        ko:"너",     cat:"noun", sub:"지칭어", lv:1 },
  { id:"we",         ko:"우리",   cat:"noun", sub:"지칭어", lv:1 },
  { id:"who",        ko:"누구",   cat:"noun", sub:"지칭어", lv:1 },
  { id:"what",       ko:"뭐",     cat:"noun", sub:"지칭어", lv:1 },
  { id:"where",      ko:"어디",   cat:"noun", sub:"지칭어", lv:1 },
  { id:"when",       ko:"언제",   cat:"noun", sub:"지칭어", lv:1 },

  // C. 의사표현 (13)
  { id:"want",    ko:"원하다",     cat:"verb",       sub:"의사표현", lv:1 },
  { id:"dislike", ko:"싫다",       cat:"adjective",  sub:"의사표현", lv:1 },
  { id:"like",    ko:"좋다",       cat:"adjective",  sub:"의사표현", lv:1 },
  { id:"need",    ko:"필요하다",   cat:"adjective",  sub:"의사표현", lv:2 },
  { id:"ok",      ko:"괜찮다",     cat:"adjective",  sub:"의사표현", lv:1 },
  { id:"help",    ko:"도와주다",   cat:"verb",       sub:"의사표현", lv:1 },
  { id:"dunno",   ko:"모르다",     cat:"verb",       sub:"의사표현", lv:1 },
  { id:"know",    ko:"알다",       cat:"verb",       sub:"의사표현", lv:1 },
  { id:"yes",     ko:"네",         cat:"expression", sub:"의사표현", lv:1 },
  { id:"no",      ko:"아니요",     cat:"expression", sub:"의사표현", lv:1 },
  { id:"please",  ko:"주세요",     cat:"expression", sub:"의사표현", lv:1 },
  { id:"wait",    ko:"기다리다",   cat:"verb",       sub:"의사표현", lv:2 },
  { id:"again",   ko:"다시",       cat:"expression", sub:"의사표현", lv:1 },

  // D. 학교생활 명사 (25)
  { id:"friend",       ko:"친구",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"teacher",      ko:"선생님",   cat:"noun", sub:"학교생활", lv:1 },
  { id:"school",       ko:"학교",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"classroom",    ko:"교실",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"desk",         ko:"책상",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"chair",        ko:"의자",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"book",         ko:"책",       cat:"noun", sub:"학교생활", lv:1 },
  { id:"pencil",       ko:"연필",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"eraser",       ko:"지우개",   cat:"noun", sub:"학교생활", lv:1 },
  { id:"notebook_item",ko:"공책",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"bag",          ko:"가방",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"lunch",        ko:"급식",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"water",        ko:"물",       cat:"noun", sub:"학교생활", lv:1 },
  { id:"toilet",       ko:"화장실",   cat:"noun", sub:"학교생활", lv:1 },
  { id:"playground",   ko:"운동장",   cat:"noun", sub:"학교생활", lv:1 },
  { id:"gym",          ko:"체육관",   cat:"noun", sub:"학교생활", lv:2 },
  { id:"music_room",   ko:"음악실",   cat:"noun", sub:"학교생활", lv:2 },
  { id:"library",      ko:"도서관",   cat:"noun", sub:"학교생활", lv:1 },
  { id:"homework",     ko:"숙제",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"test",         ko:"시험",     cat:"noun", sub:"학교생활", lv:2 },
  { id:"class_hour",   ko:"수업",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"break_time",   ko:"쉬는시간", cat:"noun", sub:"학교생활", lv:1 },
  { id:"art_supplies", ko:"크레파스", cat:"noun", sub:"학교생활", lv:1 },
  { id:"scissors",     ko:"가위",     cat:"noun", sub:"학교생활", lv:1 },
  { id:"glue",         ko:"풀",       cat:"noun", sub:"학교생활", lv:1 },

  // E. 일상 동사 (20)
  { id:"eat",     ko:"먹다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"drink",   ko:"마시다",   cat:"verb", sub:"일상동사", lv:1 },
  { id:"go",      ko:"가다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"come",    ko:"오다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"sit",     ko:"앉다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"stand",   ko:"서다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"read",    ko:"읽다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"write",   ko:"쓰다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"speak",   ko:"말하다",   cat:"verb", sub:"일상동사", lv:1 },
  { id:"listen",  ko:"듣다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"play",    ko:"놀다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"study",   ko:"공부하다", cat:"verb", sub:"일상동사", lv:1 },
  { id:"draw",    ko:"그리다",   cat:"verb", sub:"일상동사", lv:1 },
  { id:"sing",    ko:"노래하다", cat:"verb", sub:"일상동사", lv:1 },
  { id:"run",     ko:"달리다",   cat:"verb", sub:"일상동사", lv:1 },
  { id:"wash",    ko:"씻다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"sleep",   ko:"자다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"give",    ko:"주다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"receive", ko:"받다",     cat:"verb", sub:"일상동사", lv:1 },
  { id:"make",    ko:"만들다",   cat:"verb", sub:"일상동사", lv:1 },

  // F. 일상 형용사 (10)
  { id:"big",       ko:"크다",     cat:"adjective", sub:"일상형용사", lv:1 },
  { id:"small",     ko:"작다",     cat:"adjective", sub:"일상형용사", lv:1 },
  { id:"hot",       ko:"덥다",     cat:"adjective", sub:"일상형용사", lv:1 },
  { id:"cold",      ko:"춥다",     cat:"adjective", sub:"일상형용사", lv:1 },
  { id:"pretty",    ko:"예쁘다",   cat:"adjective", sub:"일상형용사", lv:1 },
  { id:"delicious", ko:"맛있다",   cat:"adjective", sub:"일상형용사", lv:1 },
  { id:"difficult", ko:"어렵다",   cat:"adjective", sub:"일상형용사", lv:2 },
  { id:"easy",      ko:"쉽다",     cat:"adjective", sub:"일상형용사", lv:1 },
  { id:"fast",      ko:"빠르다",   cat:"adjective", sub:"일상형용사", lv:1 },
  { id:"slow",      ko:"느리다",   cat:"adjective", sub:"일상형용사", lv:2 },

  // G. 인사/생활 표현 (5)
  { id:"hello",     ko:"안녕하세요",    cat:"expression", sub:"인사", lv:1 },
  { id:"goodbye",   ko:"안녕히 가세요", cat:"expression", sub:"인사", lv:1 },
  { id:"thanks",    ko:"감사합니다",    cat:"expression", sub:"인사", lv:1 },
  { id:"excuse_me", ko:"잠깐만요",      cat:"expression", sub:"인사", lv:1 },
  { id:"congrats",  ko:"축하해요",      cat:"expression", sub:"인사", lv:1 },
];

// ── 배치 단위로 분할 (10개씩) ──
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Gemini API 호출 ──
async function callGemini(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        const wait = attempt * 5000;
        console.log(`  ⏳ ${res.status} — ${wait/1000}s 후 재시도 (${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("빈 응답");

      // JSON 파싱 (코드펜스 제거)
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      return JSON.parse(cleaned);
    } catch (e) {
      if (attempt === retries) throw e;
      console.log(`  ⚠️ 에러: ${e.message} — 재시도 ${attempt}/${retries}`);
      await new Promise(r => setTimeout(r, attempt * 3000));
    }
  }
}

// ── 배치 프롬프트 생성 ──
function buildPrompt(wordBatch) {
  const wordList = wordBatch.map(w =>
    `- id: "${w.id}", 한국어: "${w.ko}", 품사: ${w.cat}, 분류: ${w.sub}`
  ).join("\n");

  return `당신은 초등학교(1~3학년) 한국어 교육 전문가입니다.
아래 단어 목록에 대해 각각:

1. **conjugations**: 주요 활용형 5~7개 (해요체, 합니다체, 관형형, 과거형 포함)
   - 명사는 조사 결합형 (이/가, 을/를, 에, 와/과, 은/는)
   - 표현(expression)은 변형/축약형

2. **sentences**: 학교생활 맥락의 예문 3개. 각 예문은:
   - ko: 한국어 문장 (4~10어절, 해요체)
   - situation: 어떤 학교 상황인지 한 줄 설명
   - imagePrompt: 영문 이미지 생성 프롬프트 (아래 스타일 준수)

3. **imagePrompt**: 단어를 상징하는 아이콘형 이미지 프롬프트 (영문)

**예문 규칙:**
- 예문1: "나는 ~해요" 형태 1인칭 기본
- 예문2: 학교에서 벌어지는 구체적 상황 묘사
- 예문3: 친구/선생님과의 관계 속 표현

**이미지 프롬프트 스타일 (예문용):**
"[장면 묘사], soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"

**이미지 프롬프트 스타일 (아이콘용):**
"A simple [상징물] icon, round frame, [색상] tones, soft watercolor, child-friendly, minimal, no text"

**단어 목록:**
${wordList}

**JSON 응답 형식 (배열):**
[
  {
    "id": "단어id",
    "conjugations": ["활용형1", "활용형2", ...],
    "sentences": [
      { "ko": "예문", "situation": "상황설명", "imagePrompt": "영문 프롬프트" },
      { "ko": "예문", "situation": "상황설명", "imagePrompt": "영문 프롬프트" },
      { "ko": "예문", "situation": "상황설명", "imagePrompt": "영문 프롬프트" }
    ],
    "imagePrompt": "단어 아이콘 프롬프트"
  },
  ...
]

정확히 ${wordBatch.length}개 객체를 배열로 반환하세요. JSON만 출력.`;
}

// ── 메인 실행 ──
async function main() {
  console.log(`\n🐝 어휘 카드 데이터 생성 시작 (${WORDS.length}개 단어)\n`);
  console.log(`   모델: ${MODEL}`);
  console.log(`   배치 크기: 10개씩\n`);

  const batches = chunk(WORDS, 10);
  const allResults = [];
  let processed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const ids = batch.map(w => w.id).join(", ");
    console.log(`📦 배치 ${i+1}/${batches.length}: [${ids}]`);

    try {
      const prompt = buildPrompt(batch);
      const results = await callGemini(prompt);

      if (!Array.isArray(results)) {
        console.log(`  ❌ 배열이 아닌 응답, 스킵`);
        continue;
      }

      // 기본 정보와 병합
      for (const result of results) {
        const base = batch.find(w => w.id === result.id);
        if (!base) {
          console.log(`  ⚠️ 알 수 없는 id: ${result.id}`);
          continue;
        }
        allResults.push({
          id: base.id,
          ko: base.ko,
          category: base.cat,
          subcategory: base.sub,
          level: base.lv,
          conjugations: result.conjugations || [],
          sentences: (result.sentences || []).slice(0, 3),
          imagePrompt: result.imagePrompt || "",
        });
        processed++;
      }

      console.log(`  ✅ ${results.length}개 완료 (누적: ${processed}/${WORDS.length})\n`);

      // Rate limit 방지: 배치 간 1.5초 대기
      if (i < batches.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {
      console.log(`  ❌ 배치 실패: ${e.message}\n`);
      // 실패한 배치의 단어들은 기본값으로 채움
      for (const w of batch) {
        if (!allResults.find(r => r.id === w.id)) {
          allResults.push({
            id: w.id,
            ko: w.ko,
            category: w.cat,
            subcategory: w.sub,
            level: w.lv,
            conjugations: [],
            sentences: [],
            imagePrompt: "",
          });
          processed++;
        }
      }
    }
  }

  // ── TypeScript 파일 생성 ──
  const tsContent = `// 자동 생성됨 — scripts/generate-vocab.mjs
// 생성일: ${new Date().toISOString()}
// 모델: ${MODEL}

export interface SentenceCard {
  ko: string;
  situation: string;
  imagePrompt: string;
}

export interface VocabWord {
  id: string;
  ko: string;
  category: "noun" | "adjective" | "verb" | "expression";
  subcategory: string;
  level: 1 | 2 | 3;
  conjugations: string[];
  sentences: [SentenceCard, SentenceCard, SentenceCard];
  imagePrompt: string;
}

export const VOCAB_WORDS: VocabWord[] = ${JSON.stringify(allResults, null, 2)} as VocabWord[];

export const VOCAB_BY_ID: Record<string, VocabWord> = Object.fromEntries(
  VOCAB_WORDS.map(w => [w.id, w])
);

export const VOCAB_BY_CATEGORY: Record<string, VocabWord[]> = {};
for (const w of VOCAB_WORDS) {
  (VOCAB_BY_CATEGORY[w.subcategory] ??= []).push(w);
}
`;

  const outPath = resolve(ROOT, "lib", "vocabWords.ts");
  writeFileSync(outPath, tsContent, "utf-8");

  console.log(`\n✨ 완료! ${processed}/${WORDS.length}개 단어 생성`);
  console.log(`📄 출력: ${outPath}\n`);

  // 누락된 단어 체크
  const missing = allResults.filter(r => r.sentences.length < 3);
  if (missing.length > 0) {
    console.log(`⚠️  예문 부족 단어 (${missing.length}개):`);
    missing.forEach(m => console.log(`   - ${m.id} (${m.ko}): ${m.sentences.length}개 예문`));
  }
}

main().catch(e => {
  console.error("❌ 치명적 오류:", e);
  process.exit(1);
});

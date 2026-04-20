/**
 * Gemini Nano Banana (gemini-2.5-flash-image)로 어휘 카드 이미지 배치 생성
 * 총 400장: 단어 아이콘 100 + 예문 이미지 300
 * 실행: node scripts/generate-vocab-images.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_KEY = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE";
const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

// 출력 디렉토리
const OUT_DIR = resolve(ROOT, "public", "vocab-images");
const ICON_DIR = resolve(OUT_DIR, "icons");
const SENT_DIR = resolve(OUT_DIR, "sentences");

// 동시 요청 수 & 딜레이
const CONCURRENCY = 2;
const DELAY_MS = 2000; // 요청 간 대기 (rate limit 방지)

// ── vocabWords.ts에서 데이터 파싱 ──
function loadVocabWords() {
  const raw = readFileSync(resolve(ROOT, "lib", "vocabWords.ts"), "utf-8");
  const match = raw.match(/VOCAB_WORDS[^=]*=\s*(\[[\s\S]*?\])\s*as\s/);
  if (!match) throw new Error("VOCAB_WORDS 파싱 실패");
  return JSON.parse(match[1]);
}

// ── Gemini 이미지 생성 API 호출 ──
async function generateImage(prompt, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
          },
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        const wait = attempt * 8000;
        console.log(`    ⏳ ${res.status} — ${wait/1000}s 후 재시도 (${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = await res.json();
      const parts = json.candidates?.[0]?.content?.parts || [];

      // 이미지 데이터 찾기
      for (const part of parts) {
        if (part.inlineData) {
          return Buffer.from(part.inlineData.data, "base64");
        }
      }

      throw new Error("응답에 이미지 없음");
    } catch (e) {
      if (attempt === retries) throw e;
      const wait = attempt * 5000;
      console.log(`    ⚠️ ${e.message} — ${wait/1000}s 후 재시도 (${attempt}/${retries})`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// ── 이미지 작업 목록 생성 ──
function buildTasks(words) {
  const tasks = [];

  for (const word of words) {
    // 단어 아이콘
    tasks.push({
      id: `icon_${word.id}`,
      filename: resolve(ICON_DIR, `${word.id}.png`),
      prompt: `Generate this image: ${word.imagePrompt}`,
      type: "icon",
      wordId: word.id,
    });

    // 예문 3개
    for (let i = 0; i < word.sentences.length; i++) {
      tasks.push({
        id: `sent_${word.id}_${i}`,
        filename: resolve(SENT_DIR, `${word.id}_${i}.png`),
        prompt: `Generate this image: ${word.sentences[i].imagePrompt}`,
        type: "sentence",
        wordId: word.id,
        sentIdx: i,
      });
    }
  }

  return tasks;
}

// ── 순차 배치 처리 (동시성 제한) ──
async function processBatch(tasks, concurrency) {
  let completed = 0;
  let failed = 0;
  const total = tasks.length;
  const failedTasks = [];

  // concurrency개씩 동시 실행
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async (task) => {
        // 이미 존재하면 스킵
        if (existsSync(task.filename)) {
          completed++;
          return { task, skipped: true };
        }

        const imgBuf = await generateImage(task.prompt);
        writeFileSync(task.filename, imgBuf);
        completed++;
        return { task, skipped: false };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        const { task, skipped } = r.value;
        const icon = task.type === "icon" ? "🎨" : "📸";
        const skip = skipped ? " (스킵)" : "";
        console.log(`  ${icon} [${completed}/${total}] ${task.id}${skip}`);
      } else {
        failed++;
        const failedTask = batch[results.indexOf(r)];
        failedTasks.push(failedTask);
        console.log(`  ❌ [${completed + failed}/${total}] ${failedTask?.id}: ${r.reason?.message?.slice(0, 80)}`);
      }
    }

    // Rate limit 대기
    if (i + concurrency < tasks.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  return { completed, failed, failedTasks };
}

// ── 메인 ──
async function main() {
  console.log("\n🐝 어휘 카드 이미지 배치 생성\n");
  console.log(`   모델: ${MODEL} (Nano Banana)`);
  console.log(`   동시 요청: ${CONCURRENCY}개`);
  console.log(`   요청 간격: ${DELAY_MS}ms\n`);

  // 디렉토리 생성
  mkdirSync(ICON_DIR, { recursive: true });
  mkdirSync(SENT_DIR, { recursive: true });

  // 데이터 로드
  const words = loadVocabWords();
  console.log(`   단어 수: ${words.length}개`);

  // 작업 목록
  const allTasks = buildTasks(words);
  const newTasks = allTasks.filter(t => !existsSync(t.filename));
  const skipped = allTasks.length - newTasks.length;

  console.log(`   전체 이미지: ${allTasks.length}장`);
  console.log(`   이미 생성됨: ${skipped}장`);
  console.log(`   새로 생성: ${newTasks.length}장\n`);

  if (newTasks.length === 0) {
    console.log("✨ 모든 이미지가 이미 생성되어 있습니다!\n");
    return;
  }

  // 배치 처리
  const startTime = Date.now();
  const { completed, failed, failedTasks } = await processBatch(newTasks, CONCURRENCY);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✨ 완료! (${elapsed}s)`);
  console.log(`   성공: ${completed}장`);
  console.log(`   실패: ${failed}장`);
  console.log(`   스킵: ${skipped}장`);
  console.log(`   출력: ${OUT_DIR}\n`);

  // 실패 목록 저장 (재실행 시 자동 재시도)
  if (failedTasks.length > 0) {
    const failLog = resolve(OUT_DIR, "failed.json");
    writeFileSync(failLog, JSON.stringify(failedTasks.map(t => t.id), null, 2));
    console.log(`   ⚠️ 실패 목록: ${failLog}`);
    console.log(`   → 스크립트를 다시 실행하면 실패한 것만 재시도합니다.\n`);
  }
}

main().catch(e => {
  console.error("❌ 치명적 오류:", e);
  process.exit(1);
});

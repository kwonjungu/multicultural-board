// Gemini Batch API(50% 할인)로 게임 에셋 생성 — 나노바나나1(gemini-2.5-flash-image).
// 대상: 감정 얼굴 16종(EmotionQuiz + 마블 감정퀴즈 공용) + 스무고개 잔여 16종.
//
// Usage:
//   node scripts/gen-batch-assets.mjs submit    # 배치 제출
//   node scripts/gen-batch-assets.mjs status    # 상태 확인
//   node scripts/gen-batch-assets.mjs collect   # 완료 시 다운로드
//   node scripts/gen-batch-assets.mjs run       # submit → poll → collect (블로킹)
//
// 완료 후 반드시: node scripts/clean-bg.mjs --only=emotions,twentyq  (흰 배경 제거)

import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// .env.local 폴백 로드 (커밋 금지 파일)
function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const envPath = path.join(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf-8").match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  console.error("GEMINI_API_KEY 필요 (.env.local 또는 env)");
  process.exit(1);
}
const API_KEY = loadKey();

const MODEL = "gemini-2.5-flash-image";
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const OUT_DIR = path.join(process.cwd(), "public", "game-assets");
const STATE_FILE = path.join(process.cwd(), "scripts", ".asset_batch_job.json");

const FACE = "Cute kid-friendly cartoon sticker of a single round honey-yellow bee face, big expressive eyes, simple bold outlines, bright colors, plain white background, no text, centered, square composition.";
const OBJ = "Cute kid-friendly storybook cartoon sticker, simple bold outlines, bright warm colors, plain white background, no text, centered, square composition.";
const PERSON = "Cute kid-friendly storybook cartoon character sticker, friendly smiling person, simple bold outlines, bright colors, plain white background, no text, centered, full body, square composition.";

// 감정 16종 — EmotionQuiz EMOJI_POOL 순서와 파일명 매핑 (components/games/emotionFaces.ts 참조)
const EMOTION_TASKS = [
  { name: "emotions/happy.png",       prompt: `${FACE} Expression: happy warm smile with closed curved eyes.` },
  { name: "emotions/sad.png",         prompt: `${FACE} Expression: sad with a single tear drop on one cheek.` },
  { name: "emotions/angry.png",       prompt: `${FACE} Expression: angry frown with furrowed brows, slightly red cheeks.` },
  { name: "emotions/scared.png",      prompt: `${FACE} Expression: scared, wide open worried eyes, small open mouth, blue shadow on forehead.` },
  { name: "emotions/embarrassed.png", prompt: `${FACE} Expression: embarrassed blushing, deep pink cheeks, shy averted eyes.` },
  { name: "emotions/hug.png",         prompt: `${FACE} Expression: warm welcoming smile with two small open arms reaching forward for a hug.` },
  { name: "emotions/sleepy.png",      prompt: `${FACE} Expression: sleepy, closed eyes, tiny "zzz" bubbles floating above (no letters, just curly sleep swirls).` },
  { name: "emotions/surprised.png",   prompt: `${FACE} Expression: surprised, round wide eyes and round open mouth.` },
  { name: "emotions/thinking.png",    prompt: `${FACE} Expression: thinking, eyes looking up to the side, one small hand on chin, small thought bubble.` },
  { name: "emotions/party.png",       prompt: `${FACE} Expression: celebrating, joyful open smile, tiny party hat, confetti pieces around.` },
  { name: "emotions/love.png",        prompt: `${FACE} Expression: loving, smiling with pink heart-shaped eyes, small hearts floating.` },
  { name: "emotions/crying.png",      prompt: `${FACE} Expression: crying loudly, squeezed shut eyes, big tears streaming.` },
  { name: "emotions/trophy.png",      prompt: `${OBJ} A shiny golden trophy cup with a small honey-bee emblem.` },
  { name: "emotions/handshake.png",   prompt: `${OBJ} Two cartoon hands doing a friendly handshake, one yellow and one orange sleeve.` },
  { name: "emotions/worried.png",     prompt: `${FACE} Expression: worried, tilted eyebrows, small uneasy frown, hands clasped.` },
  { name: "emotions/heartbroken.png", prompt: `${OBJ} A big pink heart broken in two halves with a zigzag crack.` },
];

// 스무고개 잔여 — 음식 6 + 직업 10 (lib/gameData.ts TWENTYQ_ITEMS id와 파일명 일치)
const TWENTYQ_TASKS = [
  { name: "twentyq/f-ramen.png",  prompt: `${OBJ} A steaming bowl of ramen noodles with chopsticks.` },
  { name: "twentyq/f-kimchi.png", prompt: `${OBJ} A dish of Korean kimchi, red spicy cabbage.` },
  { name: "twentyq/f-pizza.png",  prompt: `${OBJ} A cheesy pizza slice with pepperoni.` },
  { name: "twentyq/f-sushi.png",  prompt: `${OBJ} Two pieces of salmon sushi on a small plate.` },
  { name: "twentyq/f-curry.png",  prompt: `${OBJ} A plate of curry rice with steam.` },
  { name: "twentyq/f-ice.png",    prompt: `${OBJ} A soft-serve ice cream cone, vanilla swirl.` },
  { name: "twentyq/p-teacher.png",     prompt: `${PERSON} A teacher holding a book in front of a small chalkboard.` },
  { name: "twentyq/p-doctor.png",      prompt: `${PERSON} A doctor in a white coat with a stethoscope.` },
  { name: "twentyq/p-chef.png",        prompt: `${PERSON} A chef in a white hat holding a frying pan.` },
  { name: "twentyq/p-police.png",      prompt: `${PERSON} A police officer in uniform waving kindly.` },
  { name: "twentyq/p-firefighter.png", prompt: `${PERSON} A firefighter in helmet and suit holding a small hose.` },
  { name: "twentyq/p-farmer.png",      prompt: `${PERSON} A farmer in a straw hat holding a basket of vegetables.` },
  { name: "twentyq/p-driver.png",      prompt: `${PERSON} A friendly bus driver with a steering wheel.` },
  { name: "twentyq/p-nurse.png",       prompt: `${PERSON} A nurse in scrubs holding a clipboard.` },
  { name: "twentyq/p-artist.png",      prompt: `${PERSON} An artist with a beret holding a palette and brush.` },
  { name: "twentyq/p-singer.png",      prompt: `${PERSON} A singer holding a microphone with music notes around.` },
];

const TASKS = [...EMOTION_TASKS, ...TWENTYQ_TASKS];

async function submit() {
  // 이미 있는 파일은 제외 (멱등 재실행)
  const pending = [];
  for (const t of TASKS) {
    const p = path.join(OUT_DIR, t.name);
    const stat = await fs.stat(p).catch(() => null);
    if (stat && stat.size > 1000) continue;
    pending.push(t);
  }
  if (pending.length === 0) { console.log("생성할 것 없음 (전부 존재)"); return; }
  console.log(`배치 제출: ${pending.length}건`);

  const body = {
    batch: {
      displayName: `game-assets-${Date.now()}`,
      inputConfig: {
        requests: {
          requests: pending.map((t) => ({
            request: {
              contents: [{ role: "user", parts: [{ text: t.prompt }] }],
              generationConfig: { responseModalities: ["IMAGE"] },
            },
            metadata: { key: t.name },
          })),
        },
      },
    },
  };
  const res = await fetch(`${BASE}/models/${MODEL}:batchGenerateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`submit HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const op = await res.json();
  await fs.writeFile(STATE_FILE, JSON.stringify({ name: op.name, count: pending.length, submittedAt: Date.now() }, null, 2));
  console.log(`job: ${op.name}`);
}

async function getJob() {
  const state = JSON.parse(await fs.readFile(STATE_FILE, "utf-8"));
  const res = await fetch(`${BASE}/${state.name}?key=${API_KEY}`);
  if (!res.ok) throw new Error(`status HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

async function status() {
  const job = await getJob();
  const st = job.metadata?.state ?? job.state ?? (job.done ? "DONE" : "RUNNING");
  console.log(`state=${JSON.stringify(st)} done=${!!job.done}`);
  return job;
}

function extractImage(response) {
  for (const cand of response?.candidates ?? []) {
    for (const part of cand?.content?.parts ?? []) {
      const data = part?.inlineData?.data;
      if (data) return Buffer.from(data, "base64");
    }
  }
  return null;
}

async function collect() {
  const job = await getJob();
  if (!job.done) { console.log("아직 실행 중"); return false; }
  const inlined =
    job.response?.inlinedResponses?.inlinedResponses ??
    job.response?.inlinedResponses ??
    [];
  let ok = 0, fail = 0;
  for (const item of inlined) {
    const key = item.metadata?.key ?? `unknown_${ok + fail}.png`;
    const outPath = path.join(OUT_DIR, key);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const buf = item.response ? extractImage(item.response) : null;
    if (buf) {
      await fs.writeFile(outPath, buf);
      console.log(`OK   ${key} (${(buf.length / 1024).toFixed(0)}KB)`);
      ok++;
    } else {
      console.log(`FAIL ${key} err=${JSON.stringify(item.error ?? "no image").slice(0, 200)}`);
      fail++;
    }
  }
  console.log(`\n저장 ${ok} / 실패 ${fail}`);
  return true;
}

async function run() {
  await submit();
  if (!existsSync(STATE_FILE)) return;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 30_000));
    const job = await status();
    if (job.done) break;
    console.log(`  [${i + 1}] running...`);
  }
  await collect();
}

const cmd = process.argv[2] ?? "run";
if (cmd === "submit") await submit();
else if (cmd === "status") await status();
else if (cmd === "collect") await collect();
else if (cmd === "run") await run();
else { console.error(`unknown cmd: ${cmd}`); process.exit(2); }

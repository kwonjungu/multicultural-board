/**
 * 감정 카드 목록(lib/emotions.ts) 검수.
 *
 *   node scripts/test-emotions.mjs
 *
 * 확인하는 것:
 *   1. id 중복이 없다.
 *   2. 모든 감정이 15개 언어 라벨을 빠짐없이 갖는다(빈 문자열도 실패).
 *   3. EMOTION_MOOD 가 모든 감정을 덮고, 남는 짝이 없다.
 *   4. 그 짝이 실제 꿀벌 무드 id 이고, 그림 파일 {id}-64.png / {id}-128.png 이
 *      public/ui-icons/v1/moods 에 실제로 있다.
 *   5. 한 꿀벌 무드를 두 감정이 나눠 쓰지 않는다(카드 두 장이 같은 얼굴 방지).
 *   6. hue 가 #RRGGBB 형식이다.
 *   7. 라벨이 문장이 아니라 낱말이다(카드 라벨 길이 가드).
 *
 * TS 를 직접 읽을 수 없으므로 소스에서 필요한 부분만 뽑아 판단한다
 * (scripts/test-bee-mood-assets.mjs 와 같은 방식).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOODS_DIR = join(ROOT, "public", "ui-icons", "v1", "moods");

const EXPECTED_LANGS = [
  "ko", "en", "vi", "zh", "fil", "ja", "th",
  "km", "mn", "ru", "uz", "hi", "id", "ar", "my",
];
/** 카드 라벨은 낱말이어야 한다 — 이보다 길면 카드가 두 줄 이상으로 터진다. */
const MAX_LABEL_LEN = 22;

const problems = [];
const fail = (m) => problems.push(m);

const emotionsSrc = readFileSync(join(ROOT, "lib", "emotions.ts"), "utf8");
const beeSrc = readFileSync(join(ROOT, "lib", "beeMoods.ts"), "utf8");

// ── lib/beeMoods.ts 에서 무드 id 수집 ──
const beeIds = new Set(
  [...beeSrc.matchAll(/^\s*\{\s*id:\s*"([^"]+)"/gm)].map((m) => m[1]),
);
if (beeIds.size === 0) fail("beeMoods.ts 에서 무드 id 를 하나도 못 읽었다 — 이 스크립트의 파싱이 깨졌다");

// ── EXPRESS_EMOTIONS 블록 잘라내기 ──
const listStart = emotionsSrc.indexOf("export const EXPRESS_EMOTIONS");
const listEnd = emotionsSrc.indexOf("\n];", listStart);
if (listStart < 0 || listEnd < 0) {
  console.error("✗ EXPRESS_EMOTIONS 배열을 찾지 못했다");
  process.exit(1);
}
const listSrc = emotionsSrc.slice(listStart, listEnd);

// 항목 하나 = { id: "x", emoji: "y", hue: "#z", label: { ... } }
const entryRe =
  /\{\s*id:\s*"([^"]+)"\s*,\s*emoji:\s*"([^"]*)"\s*,\s*hue:\s*"([^"]*)"\s*,\s*label:\s*\{([\s\S]*?)\}\s*\}/g;

const emotions = [];
for (const m of listSrc.matchAll(entryRe)) {
  const [, id, emoji, hue, labelBody] = m;
  const label = {};
  for (const l of labelBody.matchAll(/(\w+):\s*"((?:[^"\\]|\\.)*)"/g)) label[l[1]] = l[2];
  emotions.push({ id, emoji, hue, label });
}

if (emotions.length === 0) {
  console.error("✗ 감정 항목을 하나도 파싱하지 못했다 — 파일 형식이 바뀌었나?");
  process.exit(1);
}

// ── 1. id 중복 ──
const seen = new Set();
for (const e of emotions) {
  if (seen.has(e.id)) fail(`id 중복: "${e.id}"`);
  seen.add(e.id);
}

// ── 2. 15개 언어 ──
for (const e of emotions) {
  const missing = EXPECTED_LANGS.filter((l) => !e.label[l] || !e.label[l].trim());
  if (missing.length) fail(`${e.id}: 언어 누락 ${missing.length}개 → ${missing.join(", ")}`);
  const extra = Object.keys(e.label).filter((l) => !EXPECTED_LANGS.includes(l));
  if (extra.length) fail(`${e.id}: 알 수 없는 언어 키 → ${extra.join(", ")}`);

  // 6. hue 형식
  if (!/^#[0-9A-Fa-f]{6}$/.test(e.hue)) fail(`${e.id}: hue "${e.hue}" 가 #RRGGBB 형식이 아니다`);
  if (!e.emoji.trim()) fail(`${e.id}: emoji 가 비어 있다 (StorybookRoom 이 e.emoji 를 쓴다)`);

  // 7. 낱말 길이 가드
  for (const [l, v] of Object.entries(e.label)) {
    if (v.length > MAX_LABEL_LEN) fail(`${e.id}.${l}: 라벨이 너무 길다(${v.length}자) "${v}"`);
    if (/[.。!?]$/.test(v)) fail(`${e.id}.${l}: 라벨이 문장으로 끝난다 "${v}"`);
  }
}

// ── 3~5. EMOTION_MOOD ──
const moodStart = emotionsSrc.indexOf("export const EMOTION_MOOD");
const moodEnd = emotionsSrc.indexOf("\n};", moodStart);
const moodSrc = moodStart >= 0 ? emotionsSrc.slice(moodStart, moodEnd) : "";
const moodMap = {};
for (const m of moodSrc.matchAll(/^\s*"?([\w-]+)"?:\s*"([^"]+)"/gm)) {
  if (m[1] === "EMOTION_MOOD") continue;
  moodMap[m[1]] = m[2];
}

const usedMoods = new Map();
for (const e of emotions) {
  const mood = moodMap[e.id];
  if (!mood) {
    fail(`${e.id}: EMOTION_MOOD 에 짝이 없다`);
    continue;
  }
  if (!beeIds.has(mood)) {
    fail(`${e.id} → "${mood}" 는 lib/beeMoods.ts 에 없는 무드 id 다`);
    continue;
  }
  if (usedMoods.has(mood)) {
    fail(`무드 "${mood}" 를 ${usedMoods.get(mood)} 와 ${e.id} 가 나눠 쓴다 — 카드 두 장이 같은 얼굴이 된다`);
  } else {
    usedMoods.set(mood, e.id);
  }
  for (const size of [64, 128]) {
    const file = join(MOODS_DIR, `${mood}-${size}.png`);
    if (!existsSync(file)) fail(`${e.id} → ${mood}: 그림 없음 public/ui-icons/v1/moods/${mood}-${size}.png`);
  }
}

const orphan = Object.keys(moodMap).filter((k) => !seen.has(k));
if (orphan.length) fail(`EMOTION_MOOD 에 감정 목록에 없는 키가 있다 → ${orphan.join(", ")}`);

// ── 보고 ──
const unusedBee = [...beeIds].filter((b) => !usedMoods.has(b));
console.log(`감정 ${emotions.length}종 · 언어 ${EXPECTED_LANGS.length}개 · 라벨 ${emotions.length * EXPECTED_LANGS.length}칸`);
console.log(`꿀벌 무드 ${beeIds.size}종 중 ${usedMoods.size}종 사용, 남은 그림 ${unusedBee.length}종${unusedBee.length ? ` (${unusedBee.join(", ")})` : ""}`);

if (problems.length) {
  console.error(`\n✗ 문제 ${problems.length}건`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("\n✓ 통과 — 언어 누락 0, id 중복 0, 무드 짝 누락 0, 그림 404 0");

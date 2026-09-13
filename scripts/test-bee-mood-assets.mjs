/**
 * 꿀벌 감정 이모티콘 20종 에셋 QA — 03 에셋가이드 §에셋 QA.
 *
 *   실행: node scripts/test-bee-mood-assets.mjs
 *
 * 생성 모델이 "transparent" 를 진짜 알파가 아니라 **투명 체크무늬 그림**으로
 * 그려 내는 사고가 실제로 있었다(동물 8종 전부 3채널·완전 불투명). 여기서는
 * 마젠타 배경으로 뽑아 크로마키로 알파를 만들기 때문에, 반대로 **크로마키가
 * 그림까지 지웠는지**와 **보라 테두리가 남았는지**를 함께 본다.
 *
 * 목록은 lib/beeMoods.ts 하나에서만 읽는다 — 기대값을 여기 복사해 두면 소스가
 * 바뀌어도 검사가 통과해 버린다.
 */
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(root, "public/ui-icons/v1/moods");
const SIZES = [128, 64];

/* lib/beeMoods.ts 를 그대로 실행해 목록을 얻는다. */
const tmp = mkdtempSync(join(tmpdir(), "bee-mood-qa-"));
let BEE_MOODS, MOOD_QUADRANTS;
try {
  const out = ts.transpileModule(readFileSync(join(root, "lib/beeMoods.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(tmp, "m.mjs"), out);
  ({ BEE_MOODS, MOOD_QUADRANTS } = await import(pathToFileURL(join(tmp, "m.mjs"))));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const problems = [];
const ok = [];
const missing = [];
const stats = [];

for (const m of BEE_MOODS) {
  let bad = false;
  const fail = (msg) => { problems.push(`${m.id}: ${msg}`); bad = true; };

  for (const size of SIZES) {
    const p = join(DIR, `${m.id}-${size}.png`);
    if (!existsSync(p)) { missing.push(`${m.id}-${size}`); bad = true; continue; }

    const buf = readFileSync(p);
    const meta = await sharp(buf).metadata();

    if (meta.width !== size || meta.height !== size) fail(`${size}: 크기가 ${meta.width}x${meta.height}`);
    if (!meta.hasAlpha || meta.channels < 4) fail(`${size}: 알파 채널 없음(ch=${meta.channels})`);

    const bytes = statSync(p).size;
    if (bytes === 0) fail(`${size}: 0 바이트`);
    if (bytes > 60_000) fail(`${size}: ${(bytes / 1024).toFixed(0)}KB — 아이콘치고 너무 크다`);

    if (!meta.hasAlpha) continue;
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const a = (x, y) => data[(y * W + x) * 4 + 3];

    // 1) 네 모서리는 투명해야 한다 — 배경이 남아 있으면 원 아바타에서 네모로 보인다.
    const corners = [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]].map(([x, y]) => a(x, y));
    if (corners.some((v) => v > 8)) fail(`${size}: 모서리가 불투명(${corners.join(",")})`);

    // 2) 가장자리에 닿으면 잘려 보인다.
    let edge = 0;
    for (let x = 0; x < W; x++) { if (a(x, 0) > 64) edge++; if (a(x, H - 1) > 64) edge++; }
    for (let y = 0; y < H; y++) { if (a(0, y) > 64) edge++; if (a(W - 1, y) > 64) edge++; }
    if (edge > 0) fail(`${size}: 가장자리에 불투명 픽셀 ${edge}개`);

    // 3) 점유율 — 크로마키가 그림까지 지웠거나, 반대로 배경이 통째로 남았는지.
    let opaque = 0, purple = 0;
    for (let i = 0; i < W * H; i++) {
      const al = data[i * 4 + 3];
      if (al <= 32) continue;
      opaque++;
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (Math.min(r, b) - g > 40) purple++;   // 남은 마젠타 끼
    }
    const ratio = opaque / (W * H);
    if (ratio < 0.12) fail(`${size}: 실루엣이 너무 작다(${(ratio * 100).toFixed(1)}%) — 크로마키가 그림을 지웠을 수 있다`);
    if (ratio > 0.85) fail(`${size}: 실루엣이 화면을 꽉 채운다(${(ratio * 100).toFixed(1)}%) — 배경이 남았을 수 있다`);

    // 4) 보라 테두리(디스필 실패)는 눈에 확 띈다.
    if (purple > opaque * 0.02) fail(`${size}: 마젠타 잔여 ${purple}px (${(purple / opaque * 100).toFixed(1)}%)`);

    if (size === 128) stats.push({ id: m.id, quadrant: m.quadrant, ratio, bytes });
  }

  if (!bad) ok.push(m.id);
}

/* 목록에 없는 파일이 섞여 들어왔는지. */
const known = new Set(BEE_MOODS.flatMap((m) => SIZES.map((s) => `${m.id}-${s}.png`)));
const stray = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".png") && !known.has(f)) : [];

/* 무드미터 계약: 네 칸에 고르게 있어야 한다. 한 칸만 잔뜩 있으면 무드미터가 아니다. */
const perQuadrant = {};
for (const m of BEE_MOODS) perQuadrant[m.quadrant] = (perQuadrant[m.quadrant] || 0) + 1;
const quadrantProblems = Object.entries(MOOD_QUADRANTS)
  .filter(([q]) => (perQuadrant[q] || 0) < 4)
  .map(([q]) => `${q} 칸에 ${perQuadrant[q] || 0}종뿐 — 무드미터는 네 칸이 고르게 있어야 한다`);

/* 서로 다른 그림인지 — 같은 파일이 복사됐는지 본다. */
const seen = new Map();
for (const m of BEE_MOODS) {
  const p = join(DIR, `${m.id}-128.png`);
  if (!existsSync(p)) continue;
  const key = statSync(p).size;
  if (seen.has(key)) {
    const other = seen.get(key);
    const a = readFileSync(p), b = readFileSync(join(DIR, `${other}-128.png`));
    if (a.equals(b)) problems.push(`${m.id}: ${other} 와 완전히 같은 그림이다`);
  } else seen.set(key, m.id);
}

console.log(`통과 ${ok.length}/${BEE_MOODS.length}`);
console.log(`칸 분포: ${Object.entries(perQuadrant).map(([q, n]) => `${q} ${n}`).join(" · ")}`);
if (stats.length) {
  const rs = stats.map((s) => s.ratio);
  console.log(`점유율 ${(Math.min(...rs) * 100).toFixed(1)}~${(Math.max(...rs) * 100).toFixed(1)}%`);
}
if (missing.length) console.log(`없는 파일 ${missing.length}: ${missing.join(" ")}`);
if (stray.length) console.log(`목록 밖 파일: ${stray.join(" ")}`);
for (const q of quadrantProblems) problems.push(q);
if (problems.length) {
  console.log("\n문제:");
  for (const m of problems) console.log("  -", m);
}

const done = ok.length === BEE_MOODS.length && problems.length === 0 && missing.length === 0;
console.log(done ? "\n꿀벌 감정 20종 에셋 QA 통과" : `\n아직 완료 아님 — 통과 ${ok.length}/${BEE_MOODS.length}, 문제 ${problems.length}건`);
process.exitCode = done ? 0 : 1;

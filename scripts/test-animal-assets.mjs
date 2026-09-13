/**
 * 동물 아바타(U05) 에셋 QA — 03 에셋가이드 §에셋 QA.
 *
 * 생성 모델이 "transparent alpha" 를 실제 알파가 아니라 **투명 체크무늬 그림**
 * 으로 그려 내는 사고가 실제로 있었다(8종 전부 3채널·완전 불투명). 그대로 쓰면
 * 아바타가 회색 격자 네모 판으로 보인다. 눈으로는 작은 크기에서 놓치기 쉬우니
 * 기계로 잡는다.
 *
 *   실행: node scripts/test-animal-assets.mjs
 *   아직 안 들어온 동물은 '미도착' 으로 세고, 들어온 것만 검사한다 —
 *   없는 파일을 통과시키지도, 있는 파일을 봐주지도 않는다.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(root, "public/ui-icons/v1/animals");

/** lib/animals.ts 의 8종과 같아야 한다. */
const IDS = ["rabbit", "bear", "cat", "dog", "fox", "panda", "penguin", "otter"];

const problems = [];
const ok = [];
const missing = [];

for (const id of IDS) {
  const p = join(DIR, `${id}.png`);
  if (!existsSync(p)) { missing.push(id); continue; }

  const buf = readFileSync(p);
  const meta = await sharp(buf).metadata();
  const stats = await sharp(buf).stats();
  const fail = (msg) => problems.push(`${id}: ${msg}`);

  // 1) 진짜 알파가 있어야 한다. 체크무늬를 그려 넣은 파일은 여기서 걸린다.
  if (!meta.hasAlpha || meta.channels < 4) {
    fail(`알파 채널 없음(ch=${meta.channels}) — 투명 배경이 아니라 그림으로 그린 배경일 수 있다`);
  }
  if (stats.isOpaque) {
    fail("완전 불투명 — 잘라낸 실루엣이 아니다");
  }

  // 2) 네 모서리는 투명해야 한다. 실루엣이 정사각을 꽉 채우면 아바타 원에서 잘린다.
  if (meta.hasAlpha) {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const a = (x, y) => data[(y * W + x) * 4 + 3];
    const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]].map(([x, y]) => a(x, y));
    if (corners.some((v) => v > 8)) fail(`모서리가 불투명(${corners.join(",")}) — 배경이 남아 있다`);

    // 3) 실루엣이 차지하는 비율. 03 가이드의 "약 75% 점유, 넉넉한 여백".
    let opaque = 0;
    for (let k = 0; k < W * H; k++) if (data[k * 4 + 3] > 32) opaque++;
    const ratio = opaque / (W * H);
    if (ratio < 0.15) fail(`실루엣이 너무 작다(${(ratio * 100).toFixed(1)}%) — 배경 제거가 그림까지 지웠을 수 있다`);
    if (ratio > 0.92) fail(`실루엣이 화면을 꽉 채운다(${(ratio * 100).toFixed(1)}%) — 여백이 없다`);

    // 4) 실루엣이 화면 가장자리에 닿는가.
    //    sharp 의 trim() 은 좌상단 픽셀 색을 기준으로 잘라서, 모서리가 투명한
    //    RGBA 에서는 신뢰할 수 없었다(가장자리 픽셀이 0인 깨끗한 파일도 '안
    //    잘린다'고 잡았다). 알파를 직접 훑어 판단한다.
    let edgeOpaque = 0;
    for (let x = 0; x < W; x++) { if (a(x, 0) > 64) edgeOpaque++; if (a(x, H - 1) > 64) edgeOpaque++; }
    for (let y = 0; y < H; y++) { if (a(0, y) > 64) edgeOpaque++; if (a(W - 1, y) > 64) edgeOpaque++; }
    if (edgeOpaque > 0) {
      fail(`가장자리에 불투명 픽셀 ${edgeOpaque}개 — 배경 조각이 남아 있다`);
    }
  }

  // 5) 정사각형이어야 아바타 원에서 찌그러지지 않는다.
  if (meta.width !== meta.height) fail(`정사각형이 아님(${meta.width}x${meta.height})`);

  if (!problems.some((m) => m.startsWith(`${id}:`))) ok.push(id);
}

/** 목록에 없는 파일이 섞여 들어왔는지 (오타 파일명 등). */
const stray = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => f.endsWith(".png") && !IDS.includes(f.replace(".png", "")))
  : [];

console.log(`통과 ${ok.length}/${IDS.length}: ${ok.join(" ") || "(없음)"}`);
if (missing.length) console.log(`미도착 ${missing.length}: ${missing.join(" ")}`);
if (stray.length) console.log(`목록 밖 파일: ${stray.join(" ")}`);
if (problems.length) {
  console.log("\n문제:");
  for (const m of problems) console.log("  -", m);
}

// 8종이 전부 통과해야 성공이다. 일부만 들어온 상태를 통과로 쓰지 않는다.
const done = ok.length === IDS.length && problems.length === 0;
console.log(done ? "\n동물 8종 에셋 QA 통과" : `\n아직 완료 아님 — 통과 ${ok.length}/8, 문제 ${problems.length}건, 미도착 ${missing.length}건`);
process.exitCode = done ? 0 : 1;

// 왕관 오버레이 좌표 튜닝용 합성 실험 도구.
// 여왕벌 베이스 위에 왕관을 후보 좌표들로 합성해 그리드 PNG 로 출력한다.
// 사용: node scripts/compose-crown-test.mjs [--skin=pink] [--out=.cosmetics-batch-out/crown-test]
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, ".cosmetics-batch-out", "crown-test");
mkdirSync(OUT, { recursive: true });

const BOX = 360; // 합성 캔버스 (정사각, CSS 박스와 동일 개념)

// 후보 파라미터: 왕관 가로폭(박스 %), 왕관 바닥 y(박스 %), 중심 x(박스 %)
const CANDIDATES = [
  { w: 40, bottom: 20, cx: 50 },
  { w: 44, bottom: 24, cx: 50 },
  { w: 48, bottom: 27, cx: 52 },
  { w: 44, bottom: 24, cx: 56 },
  { w: 50, bottom: 30, cx: 52 },
  { w: 56, bottom: 32, cx: 52 },
];

const CROWNS = ["crown-rose", "crown-sapphire", "crown-honey"];

async function loadBoxImage(rel) {
  // CSS objectFit:contain 과 동일하게 BOX 정사각 안에 맞춘다
  return sharp(resolve(ROOT, "public", rel))
    .resize(BOX, BOX, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function composeOne(baseBuf, crownRel, { w, bottom, cx }) {
  const meta = await sharp(resolve(ROOT, "public", crownRel)).metadata();
  const targetW = Math.round((w / 100) * BOX);
  const targetH = Math.round(targetW * (meta.height / meta.width)); // 종횡비 보존
  const crownBuf = await sharp(resolve(ROOT, "public", crownRel))
    .resize(targetW, targetH)
    .png()
    .toBuffer();
  const left = Math.round((cx / 100) * BOX - targetW / 2);
  const top = Math.round((bottom / 100) * BOX - targetH);
  return sharp({
    create: { width: BOX, height: BOX, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: baseBuf, left: 0, top: 0 },
      { input: crownBuf, left, top },
    ])
    .png()
    .toBuffer();
}

async function grid(cells, cols, label) {
  const rows = Math.ceil(cells.length / cols);
  const canvas = sharp({
    create: { width: BOX * cols, height: BOX * rows, channels: 4, background: { r: 240, g: 240, b: 240, alpha: 1 } },
  });
  const composites = cells.map((buf, i) => ({
    input: buf,
    left: (i % cols) * BOX,
    top: Math.floor(i / cols) * BOX,
  }));
  const out = resolve(OUT, `${label}.png`);
  await canvas.composite(composites).png().toFile(out);
  console.log(`→ ${out}  (${cells.length}칸, 열 순서 = 후보 순서)`);
}

const skinArg = process.argv.find((a) => a.startsWith("--skin="));
const skin = skinArg ? skinArg.split("=")[1] : "classic";
const baseRel = skin === "classic"
  ? "stickers/stage-5-queen.png"
  : `stickers/skins/stage-5-queen-${skin}.png`;

const baseBuf = await loadBoxImage(baseRel);

for (const crown of CROWNS) {
  const cells = [];
  for (const cand of CANDIDATES) {
    cells.push(await composeOne(baseBuf, `stickers/hat-${crown}.png`, cand));
  }
  await grid(cells, 3, `queen-${skin}-${crown}`);
}
console.log("후보:", JSON.stringify(CANDIDATES));

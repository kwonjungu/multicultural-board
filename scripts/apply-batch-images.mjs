// .image-batch-out/ 의 생성 이미지를 프로젝트 에셋 위치로 가공·배치한다.
// 사용법: node scripts/apply-batch-images.mjs
//
// sticker 타입: 흰 배경 제거(에지 flood-fill) → 트림 → 패딩 → 리사이즈
// scene  타입: 리사이즈만
// raw    타입: 리사이즈만 (배경 유지 — 로고/OG 등)

import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, ".image-batch-out");

const PLAN = [
  { key: "app-logo",        out: "app/icon.png",                              type: "raw",     size: 512 },
  { key: "og-share",        out: "app/opengraph-image.png",                   type: "raw",     w: 1200, h: 630 },
  { key: "kkulbi-tutor",    out: "public/mascot/bee-tutor.png",               type: "sticker", size: 360 },
  { key: "bee-headset",     out: "public/mascot/bee-headset.png",             type: "sticker", size: 360 },
  { key: "bee-book",        out: "public/mascot/bee-book.png",                type: "sticker", size: 360 },
  { key: "game-icon-globe", out: "public/game-icons/globe.png",               type: "sticker", size: 256 },
  { key: "story-friend",    out: "public/story/friend.png",                   type: "sticker", size: 360 },
  { key: "story-family",    out: "public/story/family.png",                   type: "sticker", size: 360 },
  { key: "story-thanks",    out: "public/story/thanks.png",                   type: "sticker", size: 360 },
  { key: "puzzle-aodai",    out: "public/game-assets/puzzle/aodai.png",       type: "scene",   size: 768 },
  { key: "puzzle-songkran", out: "public/game-assets/puzzle/songkran.png",    type: "scene",   size: 768 },
  { key: "puzzle-naadam",   out: "public/game-assets/puzzle/naadam.png",      type: "scene",   size: 768 },
  { key: "puzzle-jeepney",  out: "public/game-assets/puzzle/jeepney.png",     type: "scene",   size: 768 },
  { key: "puzzle-taekwondo",out: "public/game-assets/puzzle/taekwondo.png",   type: "scene",   size: 768 },
];

// ── 흰 배경 제거: 4변 에지에서 흰색 계열만 flood-fill (clean-bg.mjs 축약판) ──
function removeWhiteBg(data, width, height) {
  const TOL = 38;
  const isWhite = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return r >= 255 - TOL && g >= 255 - TOL && b >= 255 - TOL
      && Math.max(r, g, b) - Math.min(r, g, b) <= 24;
  };
  const visited = new Uint8Array(width * height);
  const queue = [];
  const seed = (x, y) => {
    const pos = y * width + x;
    if (!visited[pos] && isWhite(pos * 4)) queue.push(pos);
  };
  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }
  let cleared = 0;
  while (queue.length) {
    const pos = queue.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;
    const px = pos * 4;
    if (!isWhite(px)) continue;
    if (data[px + 3] !== 0) { data[px + 3] = 0; cleared++; }
    const x = pos % width, y = (pos - x) / width;
    if (x > 0) queue.push(pos - 1);
    if (x < width - 1) queue.push(pos + 1);
    if (y > 0) queue.push(pos - width);
    if (y < height - 1) queue.push(pos + width);
  }
  return cleared;
}

let ok = 0, miss = 0;
for (const job of PLAN) {
  const srcFile = join(SRC, `${job.key}.png`);
  if (!existsSync(srcFile)) {
    console.warn(`✗ 원본 없음: ${job.key}.png`);
    miss++;
    continue;
  }
  const outAbs = join(ROOT, job.out);
  await mkdir(dirname(outAbs), { recursive: true });
  const raw = await readFile(srcFile);

  if (job.type === "sticker") {
    const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    removeWhiteBg(data, info.width, info.height);
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .trim()
      .toBuffer()
      .then((buf) =>
        sharp(buf)
          .resize(job.size, job.size, { fit: "inside", withoutEnlargement: true })
          .extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png({ compressionLevel: 9 })
          .toFile(outAbs),
      );
  } else if (job.w && job.h) {
    await sharp(raw).resize(job.w, job.h, { fit: "cover" }).png({ compressionLevel: 9, quality: 90 }).toFile(outAbs);
  } else {
    await sharp(raw).resize(job.size, job.size, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(outAbs);
  }
  console.log(`✓ ${job.key} → ${job.out}`);
  ok++;
}
console.log(`\n적용 ${ok}건, 누락 ${miss}건`);

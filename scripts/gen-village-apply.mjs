// .village-batch-out/ 의 생성 이미지를 public/stickers/ 로 가공·배치.
// 사용법: node scripts/gen-village-apply.mjs
// 가공 규칙은 gen-cosmetics-apply.mjs 와 동일 (sticker/aura/backdrop 3타입).

import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, ".village-batch-out");

const PLAN = [
  { key: "pet-fox",        out: "public/stickers/pet-fox.png",        type: "sticker",  size: 360 },
  { key: "pet-owl",        out: "public/stickers/pet-owl.png",        type: "sticker",  size: 360 },
  { key: "trophy-diamond", out: "public/stickers/trophy-diamond.png", type: "sticker",  size: 360 },
  { key: "backdrop-galaxy", out: "public/stickers/backdrop-galaxy.png", type: "backdrop", size: 768 },
  { key: "aura-prism",     out: "public/stickers/aura-prism.png",     type: "aura",     size: 512 },
];

// ── 흰 배경 제거: 4변 에지에서 흰색 계열만 flood-fill (gen-cosmetics-apply 와 동일) ──
function removeWhiteBg(data, width, height, centerSeed = false) {
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
  if (centerSeed) {
    const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
    for (const [dx, dy] of [[0,0],[-20,0],[20,0],[0,-20],[0,20],[-40,-40],[40,40]]) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < width && y >= 0 && y < height) seed(x, y);
    }
  }
  while (queue.length) {
    const pos = queue.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;
    const px = pos * 4;
    if (!isWhite(px)) continue;
    data[px + 3] = 0;
    const x = pos % width, y = (pos - x) / width;
    if (x > 0) queue.push(pos - 1);
    if (x < width - 1) queue.push(pos + 1);
    if (y > 0) queue.push(pos - width);
    if (y < height - 1) queue.push(pos + width);
  }
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

  if (job.type === "sticker" || job.type === "aura") {
    const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    removeWhiteBg(data, info.width, info.height, job.type === "aura");
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
  } else {
    await sharp(raw).resize(job.size, job.size, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(outAbs);
  }
  console.log(`✓ ${job.key} → ${job.out}`);
  ok++;
}
console.log(`\n적용 ${ok}건, 누락 ${miss}건`);

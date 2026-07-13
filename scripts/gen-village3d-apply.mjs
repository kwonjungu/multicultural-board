// .village3d-batch-out/ 의 꿀벌 마을 3D 에셋 21종을 public/village/ 로 가공·배치.
// 사용법: node scripts/gen-village3d-apply.mjs
// 규칙 (docs/꿀벌마을-3D-설계.md §2):
//   - 스프라이트 20장: 흰배경 flood-fill 제거 → 트림 → 512px
//   - ground-meadow: 투명화 없이 1024px 풀블리드 리사이즈만

import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, ".village3d-batch-out");

const SPRITES = [
  "house-hive", "house-mushroom", "house-tent", "house-castle",
  "plate-wood", "plate-honey", "plate-flower",
  "fence-wood", "fence-flower",
  "yard-tree-honey", "yard-tree-cherry", "yard-bench", "yard-mailbox",
  "yard-pond", "yard-flowerbed-tulip", "yard-flowerbed-rose", "yard-lamp",
  "facility-fountain", "facility-clock", "facility-festival",
];

const PLAN = [
  ...SPRITES.map((key) => ({ key, out: `public/village/${key}.png`, type: "sprite", size: 512 })),
  { key: "ground-meadow", out: "public/village/ground-meadow.png", type: "ground", size: 1024 },
];

// ── 흰 배경 제거: 4변 에지에서 흰색 계열만 flood-fill (gen-village-apply 와 동일) ──
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

  if (job.type === "sprite") {
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
  } else {
    // ground: 투명화 없이 풀블리드 리사이즈만
    await sharp(raw).resize(job.size, job.size, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(outAbs);
  }
  console.log(`✓ ${job.key} → ${job.out}`);
  ok++;
}
console.log(`\n적용 ${ok}건, 누락 ${miss}건`);

// Remove SOLID BLACK backgrounds from composite character PNGs.
//
// clean-bg.mjs 는 dark seed 를 의도적으로 비활성(본체 검은 외곽선 침식 사고)
// 이라 검정 배경 합성본은 남는다. 이 스크립트는 "알파가 전혀 없는(불투명)"
// 파일만 골라 가장자리에서 dark flood-fill 을 수행한다 — 캐릭터는 흰 스티커
// 테두리로 둘러싸여 있어 검은 배경 플러드가 본체 외곽선으로 새지 않는다.
//
// Usage:  node scripts/clean-dark-bg.mjs
// Idempotent — 이미 투명 픽셀이 있는 파일은 건너뛴다.

import sharp from "sharp";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DIRS = [
  "public/stickers/stage-hats",
  "public/stickers/skins",
  "public/stickers/skin-hats",
];

// 배경 판정: 아주 어두운 픽셀. 흰 테두리와의 안티앨리어스 halo(회색 fringe)
// 까지 먹도록 110 까지 허용 — 배경과 맞닿는 것은 흰 테두리뿐이라 안전.
const isDark = (r, g, b) => Math.max(r, g, b) <= 110 && Math.max(r, g, b) - Math.min(r, g, b) <= 45;
const isSeedDark = (r, g, b) => Math.max(r, g, b) <= 50;

function floodDark(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];
  const trySeed = (x, y) => {
    const pos = y * width + x;
    const i = pos * 4;
    if (data[i + 3] < 10) return;
    if (isSeedDark(data[i], data[i + 1], data[i + 2])) queue.push(pos);
  };
  for (let x = 0; x < width; x++) { trySeed(x, 0); trySeed(x, height - 1); }
  for (let y = 0; y < height; y++) { trySeed(0, y); trySeed(width - 1, y); }

  let cleared = 0;
  while (queue.length > 0) {
    const pos = queue.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;
    const i = pos * 4;
    if (data[i + 3] < 10) continue;
    if (!isDark(data[i], data[i + 1], data[i + 2])) continue;
    data[i + 3] = 0;
    cleared++;
    const x = pos % width;
    const y = (pos - x) / width;
    if (x > 0) queue.push(pos - 1);
    if (x < width - 1) queue.push(pos + 1);
    if (y > 0) queue.push(pos - width);
    if (y < height - 1) queue.push(pos + width);
  }
  return cleared;
}

async function main() {
  let cleaned = 0, skipped = 0;
  for (const dir of DIRS) {
    const abs = join(ROOT, dir);
    for (const name of await readdir(abs)) {
      if (!name.toLowerCase().endsWith(".png")) continue;
      const file = join(abs, name);
      const raw = await readFile(file);
      const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { width, height } = info;

      // 이미 투명 픽셀이 있으면(정상 or clean-bg 처리 완료) 건드리지 않는다
      let hasTransparent = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 250) { hasTransparent = true; break; }
      }
      if (hasTransparent) { skipped++; continue; }

      const cleared = floodDark(data, width, height);
      if (cleared / (width * height) < 0.05) {
        console.log(`[warn] ${dir}/${name} — 불투명인데 dark 배경도 아님 (cleared=${cleared}), 수동 확인 필요`);
        skipped++;
        continue;
      }

      const stripped = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
      let trimmed = stripped, tw = width, th = height;
      try {
        trimmed = await sharp(stripped).trim({ threshold: 1 }).png().toBuffer();
        const m = await sharp(trimmed).metadata();
        tw = m.width; th = m.height;
      } catch { /* keep untrimmed */ }
      const PAD = 6;
      const side = Math.max(tw, th) + PAD * 2;
      const out = await sharp({
        create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: trimmed, left: Math.round((side - tw) / 2), top: Math.round((side - th) / 2) }])
        .png({ compressionLevel: 9 })
        .toBuffer();
      await writeFile(file, out);
      cleaned++;
      console.log(`[ok  ] ${dir}/${name}  cleared=${cleared}  trim=${tw}x${th}  final=${side}x${side}`);
    }
  }
  console.log(`\nDone. cleaned=${cleaned}  skipped(투명 있음/비대상)=${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

// Auto-trim transparent borders on sticker/mascot PNGs and re-pad to square.
// Usage:  node scripts/trim-stickers.mjs
// Overwrites files in place; commit first if you want a safety net.

import sharp from "sharp";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = [
  "public/stickers",
  "public/mascot",
];
const SQUARE_PAD_PX = 6; // padding around trimmed content in the final square canvas

async function processPng(file) {
  const raw = await readFile(file);

  // Trim fully transparent borders. Threshold 1 = only alpha=0 pixels are bg.
  let trimmed;
  let trimMeta;
  try {
    trimmed = await sharp(raw).trim({ threshold: 1 }).png().toBuffer();
    trimMeta = await sharp(trimmed).metadata();
  } catch {
    // Nothing to trim — file was already flush.
    const meta = await sharp(raw).metadata();
    return { file, before: { w: meta.width, h: meta.height }, after: { w: meta.width, h: meta.height }, changed: false };
  }

  const before = await sharp(raw).metadata();

  // Re-pad to a square canvas so anchors/aspect stay stable when rendered.
  const side = Math.max(trimMeta.width, trimMeta.height) + SQUARE_PAD_PX * 2;
  const offsetX = Math.round((side - trimMeta.width) / 2);
  const offsetY = Math.round((side - trimMeta.height) / 2);

  const out = await sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, left: offsetX, top: offsetY }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(file, out);

  return {
    file,
    before: { w: before.width, h: before.height },
    after: { w: side, h: side },
    trimmed: { w: trimMeta.width, h: trimMeta.height },
    changed: true,
  };
}

async function main() {
  const allResults = [];
  for (const dir of TARGETS) {
    const abs = join(ROOT, dir);
    const entries = (await readdir(abs)).filter((f) => f.endsWith(".png"));
    for (const name of entries) {
      const file = join(abs, name);
      try {
        const res = await processPng(file);
        allResults.push(res);
        const tag = res.changed ? "trim" : "skip";
        const t = res.trimmed ? `  trimmed=${res.trimmed.w}x${res.trimmed.h}` : "";
        console.log(`[${tag}] ${dir}/${name}  ${res.before.w}x${res.before.h} -> ${res.after.w}x${res.after.h}${t}`);
      } catch (e) {
        console.error(`[fail] ${file}:`, e.message);
      }
    }
  }
  const changed = allResults.filter((r) => r.changed).length;
  console.log(`\nDone. ${changed}/${allResults.length} files rewritten.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

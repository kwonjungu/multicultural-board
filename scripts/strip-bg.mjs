// Remove solid background colors from specific PNGs.
// - stage-3-pupa: solid black bg → transparent
// - sticker-brave, sticker-cooperative, sticker-curious, skin-classic,
//   trophy-star, stage-5-queen, stage-2-larva: fake transparency checker
//   (light grey/white alternating pattern) baked as opaque pixels → transparent
//
// Usage:  node scripts/strip-bg.mjs
// Idempotent. Safe to re-run.

import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Strip pixels matching a predicate by setting alpha=0.
 * After the pass, trim and re-pad to square.
 */
async function strip(fileRel, pred) {
  const abs = join(ROOT, fileRel);
  const raw = await readFile(abs);
  const { data, info } = await sharp(raw)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`${fileRel}: expected 4 channels, got ${channels}`);

  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a === 0) continue;
    if (pred(r, g, b, a)) {
      data[i + 3] = 0;
      changed++;
    }
  }

  // Write stripped buffer, then trim + re-pad to square.
  const stripped = await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  // Trim transparent borders.
  let trimmed, trimMeta;
  try {
    trimmed = await sharp(stripped).trim({ threshold: 1 }).png().toBuffer();
    trimMeta = await sharp(trimmed).metadata();
  } catch {
    trimmed = stripped;
    trimMeta = { width, height };
  }

  const SQUARE_PAD = 6;
  const side = Math.max(trimMeta.width, trimMeta.height) + SQUARE_PAD * 2;
  const offX = Math.round((side - trimMeta.width) / 2);
  const offY = Math.round((side - trimMeta.height) / 2);

  const out = await sharp({
    create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: trimmed, left: offX, top: offY }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(abs, out);
  console.log(`[${fileRel}] cleared ${changed} px  ${width}x${height} -> ${side}x${side}  (trim ${trimMeta.width}x${trimMeta.height})`);
}

// Predicates
const isNearBlack = (r, g, b) => r < 40 && g < 40 && b < 40;
// Fake-transparency checker pattern: light grey or white pixels with low
// saturation (R ≈ G ≈ B and all > 200 OR around 220 grey). We DON'T touch the
// bee's body which is vivid yellow/orange.
const isChecker = (r, g, b) => {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const sat = maxC - minC;
  // Near-grey pixel, bright (200+), low saturation → part of checker
  return sat <= 20 && maxC >= 200;
};

async function main() {
  // Black background
  await strip("public/stickers/stage-3-pupa.png", isNearBlack);

  // Checker-baked PNGs — only those that the first trim couldn't clean.
  const checkerFiles = [
    "public/stickers/stage-2-larva.png",
    "public/stickers/stage-5-queen.png",
    "public/stickers/sticker-brave.png",
    "public/stickers/sticker-curious.png",
    "public/stickers/sticker-cooperative.png",
    "public/stickers/skin-classic.png",
    "public/stickers/trophy-star.png",
  ];
  for (const f of checkerFiles) {
    await strip(f, isChecker);
  }

  console.log("\nDone. Review the images and the app before committing.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

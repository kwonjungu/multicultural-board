// Generalized background cleaner for all public PNG assets.
//
// Strategy: multi-pass flood-fill from the 4 edges. Each pass seeds from the
// first opaque pixel inward at many sample positions along every edge, then
// flood-fills pixels of the SAME bg kind (light vs dark) that are reachable.
// Passes converge when nothing new gets cleared — needed for patterns where
// one ring opens up access to the next.
//
// Kind gating prevents a light-bg fill from walking into a subject's black
// outline (or vice versa). We currently seed ONLY on `light` kind since
// dark-seed fills are too easy to over-apply.
//
// Safe to re-run. Writes back in place; trim + re-pad to square after.
//
// Usage:  node scripts/clean-bg.mjs          # default run
//         node scripts/clean-bg.mjs --dry    # preview, don't write

import sharp from "sharp";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

// Folders to clean. Patterns are tileable and MUST stay intact.
const TARGETS = [
  "public/stickers",
  "public/mascot",
  "public/landmarks",
  "public/icons",
  "public/spotit",
  "public/game-icons",
  "public/interpreter",
  "public/halligalli",
  "public/spot-diff",
];
const SKIP = new Set([]);

const CORNER_TOLERANCE = 42;
const SQUARE_PAD_PX = 6;
const MIN_EDGE_FRACTION = 0.002;
const MAX_PASSES = 6;
const SAMPLE_POSITIONS = 16;

// Two bg kinds — light and dark. A flood only matches pixels of its own kind.
function seedKind(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (max >= 150 && sat <= 35) return "light";
  if (max <= 40) return "dark";
  return "none";
}
function matchesKind(r, g, b, kind) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (kind === "light") return max >= 150 && sat <= 40;
  if (kind === "dark") return max <= 50;
  return false;
}

function collectEdgeSeeds(data, width, height) {
  const seeds = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = (y * width + x) * 4;
    if (data[idx + 3] < 10) return;
    const kind = seedKind(data[idx], data[idx + 1], data[idx + 2]);
    if (kind !== "light") return; // dark seeds disabled
    seeds.push({ x, y, kind });
  };
  for (let s = 0; s <= SAMPLE_POSITIONS; s++) {
    const xi = Math.min(width - 1, Math.round(((width - 1) * s) / SAMPLE_POSITIONS));
    const yi = Math.min(height - 1, Math.round(((height - 1) * s) / SAMPLE_POSITIONS));
    // top → down
    for (let y = 0; y < height; y++) {
      const idx = (y * width + xi) * 4;
      if (data[idx + 3] >= 10) { push(xi, y); break; }
    }
    // bottom → up
    for (let y = height - 1; y >= 0; y--) {
      const idx = (y * width + xi) * 4;
      if (data[idx + 3] >= 10) { push(xi, y); break; }
    }
    // left → right
    for (let x = 0; x < width; x++) {
      const idx = (yi * width + x) * 4;
      if (data[idx + 3] >= 10) { push(x, yi); break; }
    }
    // right → left
    for (let x = width - 1; x >= 0; x--) {
      const idx = (yi * width + x) * 4;
      if (data[idx + 3] >= 10) { push(x, yi); break; }
    }
  }
  // dedup by position
  const seen = new Set();
  return seeds.filter((p) => {
    const k = `${p.x},${p.y}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function runPass(data, width, height) {
  const seeds = collectEdgeSeeds(data, width, height);
  if (seeds.length === 0) return 0;
  const visited = new Uint8Array(width * height);
  let cleared = 0;

  for (const { x: cx, y: cy, kind } of seeds) {
    const startIdx = (cy * width + cx) * 4;
    const sr = data[startIdx];
    const sg = data[startIdx + 1];
    const sb = data[startIdx + 2];
    if (data[startIdx + 3] < 10) continue;

    const queue = [cy * width + cx];
    while (queue.length > 0) {
      const pos = queue.pop();
      if (visited[pos]) continue;
      visited[pos] = 1;

      const px = pos * 4;
      const r = data[px];
      const g = data[px + 1];
      const b = data[px + 2];
      const a = data[px + 3];
      if (a < 10) continue;

      const dr = Math.abs(r - sr);
      const dg = Math.abs(g - sg);
      const db = Math.abs(b - sb);
      const similarToSeed = Math.max(dr, dg, db) <= CORNER_TOLERANCE;
      if (!similarToSeed && !matchesKind(r, g, b, kind)) continue;

      if (a !== 0) {
        data[px + 3] = 0;
        cleared++;
      }

      const x = pos % width;
      const y = (pos - x) / width;
      if (x > 0) queue.push(pos - 1);
      if (x < width - 1) queue.push(pos + 1);
      if (y > 0) queue.push(pos - width);
      if (y < height - 1) queue.push(pos + width);
    }
  }
  return cleared;
}

async function cleanPng(fileAbs) {
  const raw = await readFile(fileAbs);
  const { data, info } = await sharp(raw)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) return { skipped: true };

  let cleared = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const n = runPass(data, width, height);
    if (n === 0) break;
    cleared += n;
  }

  if (cleared / (width * height) < MIN_EDGE_FRACTION) {
    return { skipped: true, cleared, width, height };
  }
  if (DRY) return { cleared, width, height, dry: true };

  const cleaned = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  let trimmed = cleaned;
  let trimW = width;
  let trimH = height;
  try {
    const t = await sharp(cleaned).trim({ threshold: 1 }).png().toBuffer();
    const meta = await sharp(t).metadata();
    trimmed = t;
    trimW = meta.width;
    trimH = meta.height;
  } catch { /* nothing */ }

  const side = Math.max(trimW, trimH) + SQUARE_PAD_PX * 2;
  const offX = Math.round((side - trimW) / 2);
  const offY = Math.round((side - trimH) / 2);
  const out = await sharp({
    create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: trimmed, left: offX, top: offY }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(fileAbs, out);
  return { cleared, width, height, trim: { w: trimW, h: trimH }, final: side };
}

async function walkFolder(rel) {
  const abs = join(ROOT, rel);
  let entries;
  try { entries = await readdir(abs); } catch { return []; }
  const out = [];
  for (const name of entries) {
    const p = join(abs, name);
    const s = await stat(p);
    if (s.isDirectory()) continue;
    if (!name.toLowerCase().endsWith(".png")) continue;
    const key = `${rel}/${name}`;
    if (SKIP.has(key)) continue;
    out.push({ rel: key, abs: p });
  }
  return out;
}

async function main() {
  const summary = { total: 0, cleaned: 0, skipped: 0 };
  for (const dir of TARGETS) {
    const files = await walkFolder(dir);
    for (const f of files) {
      summary.total++;
      try {
        const res = await cleanPng(f.abs);
        if (res.skipped) {
          summary.skipped++;
          console.log(`[skip] ${f.rel}  cleared=${res.cleared ?? 0}`);
        } else if (res.dry) {
          summary.cleaned++;
          console.log(`[dry ] ${f.rel}  would-clear=${res.cleared} (${res.width}x${res.height})`);
        } else {
          summary.cleaned++;
          console.log(`[ok  ] ${f.rel}  cleared=${res.cleared}  trim=${res.trim.w}x${res.trim.h}  final=${res.final}x${res.final}`);
        }
      } catch (e) {
        console.error(`[fail] ${f.rel}:`, e.message);
      }
    }
  }
  console.log(`\nDone. total=${summary.total}  cleaned=${summary.cleaned}  skipped=${summary.skipped}${DRY ? "  (DRY RUN)" : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

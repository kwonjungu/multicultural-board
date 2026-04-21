import sharp from "sharp";

/**
 * Edge-seeded flood-fill background removal for AI-generated character
 * portraits that come on a cream/white solid background.
 *
 * Why flood-fill (and not just "erase all light pixels"):
 *   Character bodies often contain legit light regions (highlights, whites
 *   of eyes, cream fur). A predicate-only strip would eat those. Flood-fill
 *   from edge seeds only erases background pixels that the character isn't
 *   covering — interior light pixels stay because no light path connects
 *   them to the outside.
 *
 * Threshold values are tuned for AI-generated cream/white backgrounds:
 *   - PASTEL_THRESHOLD ≈ 225 → catches pale creams and near-whites
 *   - A secondary color-variance check keeps us from eating colorful pastels
 */

const PASTEL_THRESHOLD = 218;
const VARIANCE_THRESHOLD = 22;        // max RGB channel spread to still be "neutral"
const EDGE_SAMPLE_STRIDE = 1;          // every pixel on the border seeds

export async function removeLightBackground(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const w = meta.width;
  const h = meta.height;
  if (!w || !h) return input;

  // Decode to raw RGBA so we can mutate pixels directly.
  const raw = await sharp(input).ensureAlpha().raw().toBuffer();
  const channels = 4;

  // Cheap test: is this pixel a near-white/cream *neutral* color?
  const isBg = (i: number): boolean => {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < PASTEL_THRESHOLD) return false;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    return spread <= VARIANCE_THRESHOLD;
  };

  // Visited/bg-mask, one bit per pixel.
  const bg = new Uint8Array(w * h);
  const queue: number[] = [];

  // Seed: every boundary pixel that looks like background.
  for (let x = 0; x < w; x += EDGE_SAMPLE_STRIDE) {
    const top = x;                    // row 0
    const bot = (h - 1) * w + x;
    if (!bg[top] && isBg(top * channels)) { bg[top] = 1; queue.push(top); }
    if (!bg[bot] && isBg(bot * channels)) { bg[bot] = 1; queue.push(bot); }
  }
  for (let y = 0; y < h; y += EDGE_SAMPLE_STRIDE) {
    const left = y * w;
    const right = y * w + (w - 1);
    if (!bg[left]  && isBg(left  * channels)) { bg[left]  = 1; queue.push(left);  }
    if (!bg[right] && isBg(right * channels)) { bg[right] = 1; queue.push(right); }
  }

  // 4-connected flood-fill. Inline neighbor math — hot loop.
  while (queue.length > 0) {
    const idx = queue.pop()!;
    const x = idx % w;
    const y = (idx / w) | 0;

    // up
    if (y > 0) {
      const n = idx - w;
      if (!bg[n] && isBg(n * channels)) { bg[n] = 1; queue.push(n); }
    }
    // down
    if (y < h - 1) {
      const n = idx + w;
      if (!bg[n] && isBg(n * channels)) { bg[n] = 1; queue.push(n); }
    }
    // left
    if (x > 0) {
      const n = idx - 1;
      if (!bg[n] && isBg(n * channels)) { bg[n] = 1; queue.push(n); }
    }
    // right
    if (x < w - 1) {
      const n = idx + 1;
      if (!bg[n] && isBg(n * channels)) { bg[n] = 1; queue.push(n); }
    }
  }

  // Apply — set alpha=0 on every flagged pixel. Also feather the very edge
  // of the subject (pixels next to a bg pixel) with partial alpha so we
  // don't get a hard halo against dark page backgrounds.
  for (let i = 0; i < bg.length; i++) {
    if (bg[i]) {
      raw[i * channels + 3] = 0;
    }
  }
  // 1-pass alpha feather for subject pixels touching a removed pixel.
  // Keeps the RGB but pulls alpha down a touch where the subject meets bg.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (bg[i]) continue;
      const touchesBg =
        bg[i - 1] || bg[i + 1] || bg[i - w] || bg[i + w];
      if (touchesBg) {
        const a = raw[i * channels + 3];
        if (a > 200) raw[i * channels + 3] = 200;
      }
    }
  }

  return sharp(raw, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

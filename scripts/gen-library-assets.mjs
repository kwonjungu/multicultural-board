/**
 * 그림책 읽기(전자 도서관) 화면용 에셋 2종.
 *
 *   실행: GEMINI_API_KEY=... node scripts/gen-library-assets.mjs [--force]
 *
 *   1) 꿀벌 도서관 배경  → public/backgrounds/bee-library.jpg (가로 16:9, 알파 불필요)
 *   2) 꿀벌 사서 선생님  → public/ui-icons/v1/library/bee-librarian-{256,128}.png (알파)
 *
 * 배경은 뒤에 깔리는 그림이라 알파가 필요 없다 — 모델이 주는 JPEG 를 그대로
 * 쓴다. 사서는 화면 위에 얹는 로고라 투명 배경이 필요하므로, 동물·감정 에셋과
 * 같은 방식으로 순수 마젠타 배경에 그린 뒤 크로마키한다
 * (scripts/gen-bee-moods.mjs 의 설명 참조).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "gemini-3.1-flash-image";     // Nano Banana 2 — Flash 계열
const API = "https://generativelanguage.googleapis.com/v1beta";
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY 가 없다."); process.exit(1); }
const force = process.argv.includes("--force");

const STYLE =
  "Soft 2.5D matte storybook illustration for a Korean elementary school app. " +
  "Warm honey-yellow, cream and cocoa-brown palette with gentle mint accents. " +
  "Bold rounded cocoa outlines, minimal flat shading, no glossy plastic, no realistic texture, " +
  "no photographic detail. Friendly and calm, aimed at 7 to 9 year old children. " +
  "No text, no letters, no numbers, no watermark, no signature.";

async function gen(prompt, aspect) {
  const body = { contents: [{ parts: [{ text: prompt }] }] };
  if (aspect) body.generationConfig = { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${API}/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const j = await res.json();
      const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
      if (img) return Buffer.from(img.inlineData.data, "base64");
      console.warn(`  이미지 파트 없음 (시도 ${attempt})`);
    } else {
      console.warn(`  ${res.status} (시도 ${attempt}) ${(await res.text()).slice(0, 120)}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error("생성 실패");
}

/* ── 1) 배경 ── */
const BG_DIR = join(root, "public/backgrounds");
const BG = join(BG_DIR, "bee-library.jpg");
mkdirSync(BG_DIR, { recursive: true });

if (force || !existsSync(BG)) {
  console.log("도서관 배경 생성…");
  const prompt = [
    "A cozy children's library interior seen straight on, drawn as a wide background.",
    "Tall warm wooden bookshelves filled with colourful book spines fill the left and right sides,",
    "with a soft empty area in the middle where content will be placed on top.",
    "A few honeycomb-shaped shelf openings, a small round rug, a reading lamp with warm light,",
    "and two or three tiny cartoon bees flying gently between the shelves.",
    "The middle band must stay calm and low-contrast so text and cards placed over it stay readable.",
    STYLE,
    "No people, no faces, no close-up characters in the centre.",
  ].join(" ");
  const buf = await gen(prompt, "16:9");
  // 위에 카드가 얹히므로 살짝 부드럽게 눌러 준다 — 글자 대비를 지키기 위해서다.
  await sharp(buf).resize(1920, 1080, { fit: "cover" }).modulate({ saturation: 0.9, brightness: 1.04 })
    .jpeg({ quality: 82, mozjpeg: true }).toFile(BG);
  const kb = (readFileSync(BG).length / 1024).toFixed(0);
  console.log(`  → public/backgrounds/bee-library.jpg (${kb}KB)`);
} else {
  console.log("배경은 이미 있다 (--force 로 다시 생성)");
}

/* ── 2) 사서 선생님 ── */
const LIB_DIR = join(root, "public/ui-icons/v1/library");
mkdirSync(LIB_DIR, { recursive: true });
const NEED = [256, 128].some((n) => !existsSync(join(LIB_DIR, `bee-librarian-${n}.png`)));

if (force || NEED) {
  console.log("꿀벌 사서 선생님 생성…");
  const prompt = [
    "One friendly cartoon honeybee character as a school librarian, standing front-facing and",
    "holding one open picture book in both arms in front of the chest.",
    "Round honey-yellow body with soft dark brown stripes, cream face, two tiny rounded wings,",
    "two small antennae, simple black dot eyes, a warm small smile.",
    "It wears a simple round pair of glasses and a small cocoa-brown scarf - nothing else.",
    STYLE,
    "BACKGROUND RULE (critical): place the character on a COMPLETELY FLAT, UNIFORM, PURE MAGENTA",
    "background, hex #FF00FF, filling the whole square edge to edge. One single solid colour with",
    "NO gradient, NO texture, NO vignette, NO glow, NO drop shadow and nothing else in the frame.",
    "Do not draw a transparency checkerboard.",
    "Centered square composition, the character occupies about 72 percent of the frame with even margins.",
    "Readable at 48 pixels.",
  ].join(" ");
  const buf = await gen(prompt, "1:1");

  /* 크로마키 — gen-bee-moods.mjs 와 같은 규칙(마젠타 정도 d = min(r,b) - g). */
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    let r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const d = Math.min(r, b) - g;
    let a = 255;
    if (d >= 150) a = 0;
    else if (d > 60) a = Math.round(255 * (1 - (d - 60) / 90));
    if (a > 0 && d > 25) { const cap = g + 25; if (r > cap) r = cap; if (b > cap) b = cap; }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[(y * W + x) * 4 + 3] > 40) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("크로마키가 그림까지 지웠다");
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  for (const size of [256, 128]) {
    const target = Math.round(size * 0.94);
    const scale = target / Math.max(cw, ch);
    const rw = Math.max(1, Math.round(cw * scale)), rh = Math.max(1, Math.round(ch * scale));
    const cropped = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
      .extract({ left: x0, top: y0, width: cw, height: ch })
      .resize(rw, rh, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
    const png = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, left: Math.round((size - rw) / 2), top: Math.round((size - rh) / 2) }])
      .png({ compressionLevel: 9 }).toBuffer();
    writeFileSync(join(LIB_DIR, `bee-librarian-${size}.png`), png);
    console.log(`  → bee-librarian-${size}.png (${(png.length / 1024).toFixed(1)}KB)`);
  }
} else {
  console.log("사서는 이미 있다 (--force 로 다시 생성)");
}

console.log("\n완료");

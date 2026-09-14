/**
 * 화면마다 놓는 '장면 꿀벌' 그림.
 *
 *   실행: GEMINI_API_KEY=... node scripts/gen-scene-bees.mjs [--only=id] [--force]
 *   결과: public/ui-icons/v1/scene/{id}-{256,128}.png (투명 배경)
 *
 * 감정 이모티콘(gen-bee-moods.mjs)과 같은 캐릭터·같은 화풍이되, 이쪽은 화면의
 * 성격을 한눈에 알리는 큰 그림이다. 모델이 JPEG 만 주므로 순수 마젠타 배경에
 * 그린 뒤 크로마키로 알파를 만든다.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "public/ui-icons/v1/scene");
const MODEL = "gemini-3.1-flash-image";
const API = "https://generativelanguage.googleapis.com/v1beta";
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY 가 없다."); process.exit(1); }

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice(7).split(",") : null;
const force = args.includes("--force");

/** id → 그 화면이 무엇을 하는 곳인지 한 장면으로 보여 주는 묘사. */
export const SCENE_BEES = [
  {
    id: "bee-gamer",
    what: "친구랑 놀기(게임) 화면",
    pose: "sitting cross-legged and holding a chunky rounded handheld game console with both hands, " +
      "looking down at it with a delighted open smile, one leg bouncing, a couple of tiny sparkles above",
  },
  {
    id: "bee-team",
    what: "친구랑 놀기(게임 로비) 머리 그림",
    pose: "FOUR of the same honeybee characters sitting close together in a circle seen from the front, " +
      "all four leaning in over ONE shared board game laid flat between them, hands reaching to the board, " +
      "looking at each other and smiling, clearly cooperating on the same thing rather than competing. " +
      "Keep all four the same size and the same character design so none looks more important",
  },
  {
    id: "bee-idea",
    what: "동화책 '새 생각 남기기' 버튼",
    pose: "floating happily and writing on a small note card held in one hand with a fat pencil in the other, " +
      "eyes bright with an idea, one small simple lightbulb-free sparkle above the head, leaning slightly forward",
  },
  {
    id: "bee-writing",
    what: "쓰기 학습지 화면",
    pose: "sitting at a small desk seen from the front, holding a fat pencil in one hand and writing " +
      "on an open lined notebook on the desk, tongue slightly out in concentration, eyes looking down at the page",
  },
];

const STYLE = [
  "SUBJECT: the same friendly cartoon honeybee character used across this app - a round honey-yellow body",
  "with soft dark brown stripes, a cream face, two tiny rounded translucent wings, two small antennae,",
  "simple black dot eyes, no nose, short simple arms and legs. Chubby and cute, for 7 to 9 year old children.",
  "STYLE: bold rounded cocoa-brown outline of even weight, honey yellow and cream palette with restrained",
  "accents, soft 2.5D matte volume, minimal flat shading, no glossy plastic highlights, no realistic texture.",
  "BACKGROUND RULE (critical): a COMPLETELY FLAT, UNIFORM, PURE MAGENTA background, hex #FF00FF, filling the",
  "entire square edge to edge. One single solid colour with NO gradient, NO texture, NO vignette, NO glow,",
  "NO drop shadow and nothing else in the frame. Do not draw a transparency checkerboard.",
  "COMPOSITION: centered square, the character and its props occupy about 78 percent of the frame with even margins.",
  "DO NOT include: text, letters, numbers, speech bubbles, watermarks, badge tiles, border frames, other characters.",
].join(" ");

async function gen(prompt) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${API}/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      }),
    });
    if (res.ok) {
      const j = await res.json();
      const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
      if (img) return Buffer.from(img.inlineData.data, "base64");
    } else {
      console.warn(`  ${res.status} (시도 ${attempt})`);
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error("생성 실패");
}

/** 마젠타 배경을 알파로 (gen-bee-moods.mjs 와 같은 규칙). */
async function keyOut(buf) {
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
  return { raw: out, W, H };
}

async function normalize({ raw, W, H }, size) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (raw[(y * W + x) * 4 + 3] > 40) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("크로마키가 그림까지 지웠다");
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const target = Math.round(size * 0.94);
  const scale = target / Math.max(cw, ch);
  const rw = Math.max(1, Math.round(cw * scale)), rh = Math.max(1, Math.round(ch * scale));
  const cropped = await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .resize(rw, rh, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cropped, left: Math.round((size - rw) / 2), top: Math.round((size - rh) / 2) }])
    .png({ compressionLevel: 9 }).toBuffer();
}

mkdirSync(OUT, { recursive: true });
let ok = 0;
for (const b of SCENE_BEES) {
  if (only && !only.includes(b.id)) continue;
  if (!force && existsSync(join(OUT, `${b.id}-256.png`))) { console.log(`${b.id} 이미 있음`); continue; }
  console.log(`${b.id} (${b.what}) 생성…`);
  const buf = await gen(`Create ONE sticker illustration for a Korean elementary classroom app. ACTION: ${b.pose}. ${STYLE}`);
  const keyed = await keyOut(buf);
  for (const size of [256, 128]) {
    const png = await normalize(keyed, size);
    writeFileSync(join(OUT, `${b.id}-${size}.png`), png);
    console.log(`  → ${b.id}-${size}.png (${(png.length / 1024).toFixed(1)}KB)`);
  }
  ok++;
}
console.log(`\n완료 ${ok}종`);

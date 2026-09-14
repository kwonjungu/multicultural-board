/**
 * 화면 전용 배경 그림 생성기.
 *
 *   실행: GEMINI_API_KEY=... node scripts/gen-backgrounds.mjs [이름...] [--force|--reuse]
 *   예:   GEMINI_API_KEY=... node scripts/gen-backgrounds.mjs bee-playground --force
 *
 *   --force  이미 파일이 있어도 모델을 다시 불러 새로 그린다
 *   --reuse  모델은 부르지 않고, 마지막 원본으로 후처리(채도·밝기·품질)만 다시 한다
 *
 * scripts/gen-library-assets.mjs 의 배경 생성부와 같은 규칙이다:
 *   - Gemini 이미지 모델(Flash 계열)에 16:9 로 뽑게 한다
 *   - sharp 로 1920x1080 cover 리사이즈 + 채도/밝기 조정
 *   - jpeg 로 public/backgrounds/<이름>.jpg 에 저장 (배경은 알파가 필요 없다)
 *
 * 배경 위에는 카드와 헤더 글자가 얹힌다. 그래서 그림 자체를 "가운데가 조용한"
 * 구도로 부탁하고, 저장할 때 채도를 낮춰 한 번 더 눌러 준다. 밝기는 아주 조금만
 * 올린다 — 크게 올리면 크림색 벽이 순백(255)으로 잘려 따뜻함과 결이 사라진다.
 * 화면 쪽 CSS 는 그 위에 크림색 반투명 막을 덮어 대비를 최종적으로 지킨다.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "gemini-3.1-flash-image";     // Nano Banana 2 — Flash 계열(비용 규칙)
const API = "https://generativelanguage.googleapis.com/v1beta";
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY 가 없다."); process.exit(1); }

const args = process.argv.slice(2);
const force = args.includes("--force");
/** 모델을 다시 부르지 않고, 마지막에 받은 원본으로 후처리(리사이즈·채도·품질)만 다시 한다. */
const reuse = args.includes("--reuse");
const want = args.filter((a) => !a.startsWith("--"));

/* 모델이 준 원본은 저장소 밖(임시 폴더)에 둔다. 후처리 값을 손볼 때마다
   유료 호출을 반복하지 않기 위한 캐시일 뿐이라 커밋 대상이 아니다. */
const CACHE = join(tmpdir(), "mcb-gen-backgrounds");
mkdirSync(CACHE, { recursive: true });

const STYLE =
  "Soft 2.5D matte storybook illustration for a Korean elementary school app. " +
  "Warm honey-yellow, cream and cocoa-brown palette with gentle mint accents. " +
  "Bold rounded cocoa outlines, minimal flat shading, no glossy plastic, no realistic texture, " +
  "no photographic detail. Friendly and calm, aimed at 7 to 9 year old children. " +
  "No text, no letters, no numbers, no watermark, no signature.";

/** 배경 공통 규칙 — 이 위에 카드/글자가 얹힌다는 사실을 매번 모델에게 알린다. */
const BG_RULE = [
  "Composition rule (critical): this is a BACKGROUND plate.",
  "Keep the whole middle of the frame calm, soft and LOW CONTRAST - a wide open, almost empty",
  "pale cream area - because cards and headings will be drawn on top of it.",
  "Put all the detail near the outer edges and the bottom corners.",
  "No people, no human faces, no big close-up characters in the centre.",
  "Even, soft, diffuse lighting - no harsh shadows, no dark vignette, no strong spotlight.",
].join(" ");

/** 만들 배경들. 이름 = 파일명(확장자 제외). */
const BACKGROUNDS = {
  "bee-playground": {
    file: "bee-playground.jpg",
    // 게임 로비(친구랑 놀기) 전용. '교실 한켠의 꿀벌 놀이터'.
    prompt: [
      "A cozy indoor play corner of a warm classroom, seen straight on as a wide background plate.",
      "A honey-coloured wooden floor and a warm CREAM wall (never white, never grey).",
      "The wall carries a very subtle honeycomb pattern in a barely-visible slightly darker cream -",
      "so faint it reads as texture, not as a drawing.",
      "Along the LEFT edge: a small rounded wooden slide and a low shelf of round wooden toys and blocks.",
      "Along the RIGHT edge: a soft mint bean-bag cushion, a rolled play mat and a low shelf with a",
      "board-game box and a stack of hexagon honeycomb tiles.",
      "Along the BOTTOM edge: a big soft round rug in pale cream and honey stripes, a few scattered",
      "wooden blocks and one bouncy ball, all small and near the corners.",
      "Along the TOP edge: a gentle garland of small paper honeycomb bunting hanging in a shallow",
      "curve, and two or three small cartoon bumblebees flying, drawn small and far away.",
      "The garland must be soft and pale, in muted cream, honey and dusty mint tones only -",
      "no bright saturated colours - because a heading will be drawn over the top of the picture.",
      "The whole centre of the picture is simply the calm cream wall and the rug - nothing drawn there.",
      BG_RULE,
      STYLE,
    ].join(" "),
    // 위에 카드가 얹히므로 살짝 부드럽게 눌러 준다 — 글자 대비를 지키기 위해서다.
    modulate: { saturation: 0.86, brightness: 1.03 },
    quality: 80,
  },
};

const DIR = join(root, "public/backgrounds");
mkdirSync(DIR, { recursive: true });

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
      console.warn(`  ${res.status} (시도 ${attempt}) ${(await res.text()).slice(0, 160)}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error("생성 실패");
}

const names = want.length ? want : Object.keys(BACKGROUNDS);
for (const name of names) {
  const spec = BACKGROUNDS[name];
  if (!spec) { console.error(`모르는 배경: ${name} (가능: ${Object.keys(BACKGROUNDS).join(", ")})`); process.exitCode = 1; continue; }
  const out = join(DIR, spec.file);
  if (!force && !reuse && existsSync(out)) { console.log(`${spec.file} 는 이미 있다 (--force 로 다시 생성)`); continue; }

  const cached = join(CACHE, `${name}.bin`);
  let buf;
  if (reuse && existsSync(cached)) {
    console.log(`${name} — 캐시된 원본으로 후처리만 다시 한다`);
    buf = readFileSync(cached);
  } else {
    console.log(`${name} 배경 생성…`);
    buf = await gen(spec.prompt, "16:9");
    writeFileSync(cached, buf);
  }

  // 배경 한 장이 500KB 를 넘으면 안 된다 — 품질을 한 단계씩 내려 다시 굽는다.
  let quality = spec.quality ?? 82;
  let bytes = 0;
  for (;;) {
    await sharp(buf)
      .resize(1920, 1080, { fit: "cover" })
      .modulate(spec.modulate ?? { saturation: 0.9, brightness: 1.04 })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toFile(out);
    bytes = readFileSync(out).length;
    if (bytes <= 500 * 1024 || quality <= 55) break;
    quality -= 6;
    console.log(`  ${(bytes / 1024).toFixed(0)}KB 는 크다 — quality ${quality} 로 다시`);
  }
  const meta = await sharp(out).metadata();
  console.log(`  → public/backgrounds/${spec.file} (${meta.width}x${meta.height}, ${(bytes / 1024).toFixed(0)}KB, q${quality})`);
}

console.log("\n완료");

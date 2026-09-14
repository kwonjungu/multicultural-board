/**
 * '지도에서 나라 찾기' 게임 아이콘 한 장.
 *
 *   실행: GEMINI_API_KEY=... node scripts/gen-worldmap-icon.mjs
 *   결과: public/game-icons/worldmap.png (1024x1024)
 *
 * 옆자리 '이 나라는 어디?'(country.png)와 같은 화풍으로 맞춘다 — 흰 바탕,
 * 굵은 검정 윤곽, 꿀색/크림 두 가지 색. 그쪽은 둥근 지구본이므로 이쪽은
 * **펼친 평면 지도**로 두어 한눈에 구분되게 한다.
 */
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const OUT = "public/game-icons/worldmap.png";
const MODEL = "gemini-3.1-flash-image";
const API = "https://generativelanguage.googleapis.com/v1beta";
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY 가 없다."); process.exit(1); }
if (existsSync(OUT) && !process.argv.includes("--force")) {
  console.log("이미 있음 — 다시 만들려면 --force");
  process.exit(0);
}

const PROMPT = [
  "Create ONE flat sticker icon for a Korean elementary classroom app.",
  "SUBJECT: an UNROLLED FLAT WORLD MAP (rectangular, not a globe) shown straight on,",
  "with simplified continent shapes, and one chunky rounded map PIN standing on it.",
  "STYLE: flat vector sticker, bold even black outline, only two fills - warm honey yellow",
  "for the land and soft cream for the ocean. No gradients, no shadows, no texture, no gloss.",
  "Simple and chunky enough to read at 48 pixels.",
  "BACKGROUND: completely flat pure white, filling the entire square edge to edge.",
  "DO NOT include: text, letters, numbers, country names, flags, borders of specific real",
  "countries drawn accurately, watermarks, frames, characters.",
  "COMPOSITION: centered square, the map occupies about 78 percent of the frame.",
].join(" ");

async function gen() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${API}/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
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

mkdirSync("public/game-icons", { recursive: true });
const buf = await gen();
const png = await sharp(buf).resize(1024, 1024, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(OUT, png);
console.log(`→ ${OUT} (${(png.length / 1024).toFixed(0)}KB)`);

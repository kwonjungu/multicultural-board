// Generate game asset images via Gemini 2.5 Flash Image (nano-banana).
// Run once: `node scripts/gen-game-images.mjs`
// Saves into public/game-assets/
import fs from "node:fs/promises";
import path from "node:path";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const MODEL = "gemini-2.5-flash-image";
const OUT_DIR = path.join(process.cwd(), "public", "game-assets");

const CUTE = "Cute friendly kid-storybook cartoon, rounded shapes, bright warm palette, honey-gold accents, clean plain pastel or white background, no text, centered composition.";

const TASKS = [
  // Culture puzzle
  { name: "puzzle/hanbok.png",  ratio: "1:1", prompt: `${CUTE} A colorful traditional Korean hanbok dress on a simple pastel background.` },
  { name: "puzzle/pho.png",     ratio: "1:1", prompt: `${CUTE} A steaming bowl of Vietnamese pho noodle soup on a simple pastel background.` },
  { name: "puzzle/yurt.png",    ratio: "1:1", prompt: `${CUTE} A Mongolian ger yurt tent on green grassland with blue sky.` },

  // Draw-and-guess vocab (matches lib/gameData.ts VOCAB keys)
  { name: "draw/apple.png",   ratio: "1:1", prompt: `${CUTE} A single bright red apple.` },
  { name: "draw/banana.png",  ratio: "1:1", prompt: `${CUTE} A single yellow banana.` },
  { name: "draw/dog.png",     ratio: "1:1", prompt: `${CUTE} A happy friendly cartoon puppy dog sitting.` },
  { name: "draw/cat.png",     ratio: "1:1", prompt: `${CUTE} A cute cartoon cat sitting with big eyes.` },
  { name: "draw/book.png",    ratio: "1:1", prompt: `${CUTE} An open storybook with colorful pages.` },
  { name: "draw/water.png",   ratio: "1:1", prompt: `${CUTE} A glass of clear drinking water with a water drop.` },
  { name: "draw/school.png",  ratio: "1:1", prompt: `${CUTE} A small cute school building with a clock tower.` },
  { name: "draw/friend.png",  ratio: "1:1", prompt: `${CUTE} Two cartoon kids holding hands smiling together.` },
  { name: "draw/family.png",  ratio: "1:1", prompt: `${CUTE} A cute cartoon family of parents and children hugging.` },
  { name: "draw/house.png",   ratio: "1:1", prompt: `${CUTE} A cute simple house with a red roof and a chimney.` },
  { name: "draw/sun.png",     ratio: "1:1", prompt: `${CUTE} A smiling cartoon sun with rays, bright yellow.` },
  { name: "draw/moon.png",    ratio: "1:1", prompt: `${CUTE} A crescent moon with stars, night sky.` },
  { name: "draw/rice.png",    ratio: "1:1", prompt: `${CUTE} A bowl of fluffy white rice.` },
  { name: "draw/tea.png",     ratio: "1:1", prompt: `${CUTE} A warm cup of tea with steam.` },
  { name: "draw/thanks.png",  ratio: "1:1", prompt: `${CUTE} A cute cartoon bee bowing politely to say thank you.` },
];

async function generate(prompt, aspectRatio) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error("no image in response");
  return Buffer.from(img.inlineData.data, "base64");
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  let ok = 0, skip = 0, fail = 0;
  for (const t of TASKS) {
    const outPath = path.join(OUT_DIR, t.name);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    try {
      const stat = await fs.stat(outPath).catch(() => null);
      if (stat && stat.size > 1000) { console.log(`SKIP ${t.name}`); skip++; continue; }
      process.stdout.write(`GEN  ${t.name} ... `);
      const buf = await generate(t.prompt, t.ratio);
      await fs.writeFile(outPath, buf);
      console.log(`${(buf.length / 1024).toFixed(0)} KB`);
      ok++;
      await new Promise((r) => setTimeout(r, 1200)); // rate-limit cushion
    } catch (err) {
      console.error(`FAIL ${t.name}: ${err.message}`);
      fail++;
    }
  }
  console.log(`\nDone. ok=${ok} skip=${skip} fail=${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// One-time generator for the 3 response-mode icons (입력/그림/말하기).
// These are static assets. Run once, commit, never regenerate.
//
// Usage:
//   GEMINI_API_KEY=... node scripts/gen-response-icons.mjs
//
// Cheapest path: 3 parallel calls via regular Gemini image API. Total cost
// ~$0.09 one-time. For larger asset packs (20+) consider Gemini Batch mode.
//
// Output: public/assets/response-modes/{input,draw,voice}.png
//
// The prompts are tuned to:
//  - Soft watercolor children's book style
//  - Centered single subject
//  - Warm honey-themed palette matching the app's bee mascot
//  - "No text in the image" (icons, not posters)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public/assets/response-modes");

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error("❌ GEMINI_API_KEY env var required");
  process.exit(1);
}

const MODEL = "gemini-2.5-flash-image";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;

const STYLE_GUARD =
  "Style: soft watercolor children's book illustration, cute cartoon, " +
  "honey-warm pastel palette (cream, soft yellow, peach), centered single " +
  "subject on a clean pastel-cream background, gentle rounded shapes, no " +
  "text in the image, no letters, no photorealism, kid-friendly.";

const ICONS = [
  {
    id: "input",
    prompt:
      "A cute cheerful cartoon pencil gently writing on a yellow honeycomb-edged " +
      "sticky note. The pencil is orange-yellow with a happy little face. " +
      "Tiny sparkles around the tip suggesting writing. " +
      STYLE_GUARD,
  },
  {
    id: "draw",
    prompt:
      "A cute cartoon crayon with a smiling face drawing a heart on white paper, " +
      "with a small splash of colorful crayon marks around it. Warm yellows, " +
      "soft pinks, a hint of green. Joyful mood. " +
      STYLE_GUARD,
  },
  {
    id: "voice",
    prompt:
      "A cute friendly cartoon microphone with a happy face and two tiny " +
      "musical notes floating beside it. Soft honey-yellow body with a pastel " +
      "pink top. " +
      STYLE_GUARD,
  },
];

async function genOne(prompt) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const b64 = p?.inlineData?.data;
    if (b64) return Buffer.from(b64, "base64");
  }
  throw new Error("no inline image in response");
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`→ generating ${ICONS.length} icons in parallel...`);
  const started = Date.now();
  const results = await Promise.allSettled(
    ICONS.map(async (icon) => {
      const buf = await genOne(icon.prompt);
      const outPath = path.join(OUT_DIR, `${icon.id}.png`);
      await fs.writeFile(outPath, buf);
      console.log(`✅ ${icon.id}.png  (${(buf.length / 1024).toFixed(1)} KB)`);
      return icon.id;
    }),
  );
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const fails = results.filter((r) => r.status === "rejected");
  if (fails.length > 0) {
    console.error(`\n❌ ${fails.length} failed:`);
    for (const f of fails) console.error("  -", f.reason?.message || f.reason);
    process.exit(1);
  }
  console.log(`\n🎉 done in ${elapsed}s. Files in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});

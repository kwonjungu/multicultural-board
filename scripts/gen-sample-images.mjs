#!/usr/bin/env node
// One-time generator for static sample storybook images.
// Reads public/storybooks/*/book.json, finds every imagePrompt /
// avatarImagePrompt, generates the image via Gemini, writes PNG alongside
// the book.json, and updates the JSON with local /storybooks/... paths.
//
// Usage:
//   GEMINI_API_KEY=... node scripts/gen-sample-images.mjs [bookId ...]
//
// If no bookId args are given, all samples in public/storybooks/ are
// processed. Safe to re-run — already-generated PNGs are overwritten only if
// the prompt changed (by default we re-generate unless --skip-existing).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES_DIR = path.join(ROOT, "public/storybooks");

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("❌ GEMINI_API_KEY env var required");
  process.exit(1);
}

const MODEL = "gemini-2.5-flash-image";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(KEY)}`;

const STYLE_GUARD =
  "Soft watercolor children's picture book illustration. Warm, gentle " +
  "palette. Cute cartoon characters. No scary, violent, or photorealistic " +
  "imagery. No text in the image.";
const PORTRAIT_GUARD =
  " The character alone on a clean solid pastel-cream background. No scene, " +
  "no other characters, no props, no text, just the character centered.";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const SKIP_EXISTING = flags.has("--skip-existing");

async function genImage(prompt, attempt = 1) {
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
    // Simple 1-retry on 429/503
    if ((res.status === 429 || res.status === 503) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 4000 * attempt));
      return genImage(prompt, attempt + 1);
    }
    throw new Error(`${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const b64 = p?.inlineData?.data;
    if (b64) return Buffer.from(b64, "base64");
  }
  throw new Error("no inline image data");
}

async function listBooks() {
  if (positional.length > 0) return positional;
  const entries = await fs.readdir(SAMPLES_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function processBook(bookId) {
  const dir = path.join(SAMPLES_DIR, bookId);
  const bookPath = path.join(dir, "book.json");
  if (!(await fileExists(bookPath))) {
    console.warn(`  ⚠️  ${bookId}: no book.json, skip`);
    return { bookId, success: 0, fails: 0, skipped: 0 };
  }
  const book = JSON.parse(await fs.readFile(bookPath, "utf8"));

  const tasks = [];

  if (book.cover?.imagePrompt) {
    const outPath = path.join(dir, "cover.png");
    tasks.push({
      target: "cover",
      outPath,
      urlField: () => { book.cover.imageUrl = `/storybooks/${bookId}/cover.png`; },
      prompt: `${book.cover.imagePrompt}\n\nStyle: ${STYLE_GUARD}`,
    });
  }

  for (const page of book.pages || []) {
    if (!page.imagePrompt) continue;
    const outPath = path.join(dir, `page-${page.idx}.png`);
    tasks.push({
      target: `page-${page.idx}`,
      outPath,
      urlField: () => { page.illustration = { ...page.illustration, imageUrl: `/storybooks/${bookId}/page-${page.idx}.png` }; },
      prompt: `${page.imagePrompt}\n\nStyle: ${STYLE_GUARD}`,
    });
  }

  for (const char of book.characters || []) {
    if (!char.avatarImagePrompt) continue;
    const outPath = path.join(dir, `char-${char.id}.png`);
    tasks.push({
      target: `char-${char.id}`,
      outPath,
      urlField: () => { char.avatarUrl = `/storybooks/${bookId}/char-${char.id}.png`; },
      prompt: `${char.avatarImagePrompt}\n\nStyle: ${STYLE_GUARD}${PORTRAIT_GUARD}`,
    });
  }

  console.log(`\n📚 ${bookId}: ${tasks.length} images`);

  const BATCH = 6;
  let success = 0, fails = 0, skipped = 0;

  for (let i = 0; i < tasks.length; i += BATCH) {
    const batch = tasks.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map(async (t) => {
      if (SKIP_EXISTING && await fileExists(t.outPath)) {
        t.urlField();
        skipped++;
        console.log(`  ⏭  ${t.target} (exists)`);
        return;
      }
      const started = Date.now();
      const buf = await genImage(t.prompt);
      await fs.writeFile(t.outPath, buf);
      t.urlField();
      const dt = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`  ✅ ${t.target}  ${(buf.length / 1024).toFixed(0)}KB  ${dt}s`);
    }));
    for (const r of settled) {
      if (r.status === "fulfilled") success++;
      else { fails++; console.error(`  ❌ ${r.reason?.message || r.reason}`); }
    }
  }

  // Write updated book.json (imageUrl / avatarUrl fields filled in)
  await fs.writeFile(bookPath, JSON.stringify(book, null, 2) + "\n");
  console.log(`  📝 book.json updated (${success} ok / ${fails} fail / ${skipped} skip)`);

  return { bookId, success, fails, skipped };
}

const books = await listBooks();
console.log(`→ processing ${books.length} book(s): ${books.join(", ")}`);
const results = [];
for (const b of books) {
  results.push(await processBook(b));
}
console.log("\n=== summary ===");
for (const r of results) {
  console.log(`  ${r.bookId}: ✅ ${r.success}  ❌ ${r.fails}  ⏭ ${r.skipped}`);
}
const totalFails = results.reduce((s, r) => s + r.fails, 0);
process.exit(totalFails > 0 ? 1 : 0);

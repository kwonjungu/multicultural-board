// 그림책 그림 도구 — 교사 PC 에서만 실행한다.
//
// 학생이 접속하는 웹앱은 그림을 생성하지 않는다(2026-11-11, lib/featureLimits.ts).
// 교사가 수업 전에 이 도구로 그림을 만들어 등록한다. 이 도구는 웹사이트·앱이 아니며
// 성인 교사가 자기 PC 에서 직접 실행한다. 전송되는 내용은 그림책에 저장된 그림
// 지시문(영문)과 이미 만든 등장인물 그림뿐이다. 학생의 입력이나 정보는 전송되지 않는다.
//
// 사용법 (PowerShell):
//   node scripts/storybook-images-local.mjs <책번호> --dry-run      # 만들 그림 목록만 확인 (과금 없음)
//   $env:GEMINI_API_KEY = "..."
//   node scripts/storybook-images-local.mjs <책번호>                # 등장인물 → 표지·페이지 순서로 생성·등록
//   node scripts/storybook-images-local.mjs <책번호> --force        # 이미 그림이 있는 것도 다시 생성
//   node scripts/storybook-images-local.mjs <책번호> --only=cover,page-3,char-rabbit
//   node scripts/storybook-images-local.mjs <책번호> --resume=batches/XXX --phase=chars|scenes
//
// 책번호는 그림책 만들기 미리보기 화면에 표시된다 (gen-...).
// 비용 규칙(CLAUDE.md): Flash 이미지 모델만, 배치 API(50% 할인)만 쓴다. 실행은 과금이다.
// ⚠ API 키는 환경변수로만 넘긴다. 파일에 적지 말 것.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";
import sharp from "sharp";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, update } from "firebase/database";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mod = (rel) => pathToFileURL(join(ROOT, rel)).href;

// ── 인자 ─────────────────────────────────────────────
const args = process.argv.slice(2);
const bookId = args.find((a) => !a.startsWith("--"));
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DRY = flag("dry-run");
const FORCE = flag("force");
const ONLY = opt("only")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const RESUME = opt("resume");
const PHASE = opt("phase");
const APP_URL = (opt("app") || "https://multicultural-board.vercel.app").replace(/\/$/, "");

if (!bookId || !/^gen-[a-z0-9-]+$/.test(bookId)) {
  console.error("책번호가 필요합니다. 예: node scripts/storybook-images-local.mjs gen-abc123-x1y2 --dry-run");
  process.exit(1);
}
if (RESUME && PHASE !== "chars" && PHASE !== "scenes") {
  console.error("--resume 에는 --phase=chars 또는 --phase=scenes 가 필요합니다.");
  process.exit(1);
}

// ── .env.local 에서 공개 Firebase 설정만 읽는다 (Gemini 키는 환경변수로만) ──
function loadPublicEnv() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^(NEXT_PUBLIC_FIREBASE_[A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
}
loadPublicEnv();
if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
  console.error("NEXT_PUBLIC_FIREBASE_DATABASE_URL 이 없습니다 (.env.local 확인).");
  process.exit(1);
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!DRY && !API_KEY) {
  console.error("GEMINI_API_KEY 환경변수가 필요합니다. (목록만 보려면 --dry-run)");
  process.exit(1);
}

// 모델은 허용 목록 상수에서 가져온다 (비용 하드캡).
const { GEMINI_IMAGE_MODEL } = await import(mod("scripts/local/gemini.ts"));
const { removeLightBackground } = await import(mod("lib/image-bg-removal.ts"));
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const OUT_DIR = join(ROOT, ".storybook-images-out", bookId);

const db = getDatabase(initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}));

// ── 프롬프트 (종전 그림 라우트와 같은 문구) ─────────────────
const BASE_STYLE = "Soft watercolor children's picture book illustration. Warm, gentle palette. Cute cartoon characters. No scary, violent, or photorealistic imagery. No text in the image.";
const PORTRAIT_GUARD = " The character alone on a clean solid pastel-cream background. No scene, no other characters, no props, no text, just the character centered.";
const REF_GUARD = "CHARACTER REFERENCE (STRICT): The attached image(s) show the exact character design(s) of this book. Redraw the SAME character(s) — identical species, body shape, colors, face, and clothing/accessories — placed into the scene described below. Do NOT invent a different-looking character.\n\n";

async function loadBook() {
  const snap = await get(ref(db, `generated_books/${bookId}`));
  const book = snap.val();
  if (!book) { console.error(`책을 찾지 못했습니다: ${bookId}`); process.exit(1); }
  book.pages = (book.pages || []).filter(Boolean);
  book.characters = (book.characters || []).filter(Boolean);
  return book;
}

const wanted = (key) => !ONLY || ONLY.includes(key);

function charJobs(book) {
  return book.characters
    .filter((c) => c.avatarImagePrompt && (FORCE || !c.avatarUrl) && wanted(`char-${c.id}`))
    .map((c) => ({
      key: `char-${c.id}`, kind: "char", characterId: c.id,
      prompt: `${c.avatarImagePrompt}\n\nStyle: ${BASE_STYLE}${PORTRAIT_GUARD}`,
      refs: [],
    }));
}

function sceneJobs(book, charImages) {
  const designFor = (ids) => {
    const pool = ids?.length ? book.characters.filter((c) => ids.includes(c.id)) : book.characters;
    const lines = pool.map((c) => c.designEn).filter(Boolean);
    return lines.length ? `\n\nCharacter design (must match exactly): ${lines.join(" / ")}` : "";
  };
  const refsFor = (ids) => {
    const pool = ids?.length ? ids : book.characters.map((c) => c.id);
    return pool.map((id) => charImages[id]).filter(Boolean).slice(0, 3);
  };
  const make = (key, basePrompt, ids, extra) => {
    const refs = refsFor(ids);
    return {
      key, kind: "scene", ...extra,
      prompt: `${refs.length ? REF_GUARD : ""}${basePrompt}${designFor(ids)}\n\nStyle: ${BASE_STYLE}`,
      refs,
    };
  };
  const jobs = [];
  if ((FORCE || !book.cover?.imageUrl) && wanted("cover")) {
    jobs.push(make("cover",
      book.cover?.imagePrompt || `Book cover illustration: "${book.title?.ko}". Cute cartoon, soft watercolor, warm palette.`,
      undefined, { pageIdx: 0 }));
  }
  for (const p of book.pages) {
    const key = `page-${p.idx}`;
    if ((FORCE || !p.illustration?.imageUrl) && wanted(key)) {
      jobs.push(make(key,
        p.imagePrompt || `A children's book illustration of: ${p.illustration?.emoji || ""}`,
        p.characterIds, { pageIdx: p.idx }));
    }
  }
  return jobs;
}

// ── Gemini 배치 API ──────────────────────────────────
async function api(path, init = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: { "x-goog-api-key": API_KEY, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

async function submitBatch(jobs, label) {
  const requests = jobs.map((j) => ({
    request: {
      contents: [{
        role: "user",
        parts: [
          ...j.refs.map((r) => ({ inlineData: { data: r.base64, mimeType: r.mimeType } })),
          { text: j.prompt },
        ],
      }],
      generationConfig: { responseModalities: ["IMAGE"] },
    },
    metadata: { key: j.key },
  }));
  const op = await api(`models/${GEMINI_IMAGE_MODEL}:batchGenerateContent`, {
    method: "POST",
    body: JSON.stringify({ batch: { display_name: `storybook-${bookId}-${label}`, input_config: { requests: { requests } } } }),
  });
  console.log(`배치 제출: ${op.name} (${jobs.length}건, ${label})`);
  return op.name;
}

async function poll(name, phase) {
  const start = Date.now();
  let fails = 0;
  for (;;) {
    try {
      const op = await api(name);
      fails = 0;
      const mins = Math.round((Date.now() - start) / 60000);
      console.log(`  …${op.metadata?.state || (op.done ? "done" : "running")} (${mins}분 경과)`);
      if (op.done) return op;
    } catch (err) {
      fails++;
      console.warn(`  폴링 실패 ${fails}회: ${String(err?.message ?? err).slice(0, 120)}`);
    }
    if (fails >= 10 || Date.now() - start > 90 * 60 * 1000) {
      console.log(`나중에 이어서: node scripts/storybook-images-local.mjs ${bookId} --resume=${name} --phase=${phase}`);
      process.exit(fails >= 10 ? 1 : 0);
    }
    await new Promise((r) => setTimeout(r, 60_000)); // 60초 간격 (요청 수 부풀림 방지)
  }
}

function resultsOf(op) {
  if (op.error) throw new Error(`배치 실패: ${JSON.stringify(op.error).slice(0, 400)}`);
  const inlined =
    op.response?.inlinedResponses?.inlinedResponses ??
    op.response?.inlined_responses?.inlined_responses ?? [];
  if (inlined.length === 0) {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, "batch-raw.json"), JSON.stringify(op, null, 2));
    throw new Error(`배치 응답에 결과가 없습니다. 원본을 ${OUT_DIR}/batch-raw.json 에 저장했습니다.`);
  }
  const out = {};
  inlined.forEach((item, i) => {
    const key = item.metadata?.key || `item-${i}`;
    if (item.error) { console.error(`  ✗ ${key}: ${JSON.stringify(item.error).slice(0, 200)}`); return; }
    for (const p of item.response?.candidates?.[0]?.content?.parts || []) {
      const d = p.inlineData || p.inline_data;
      if (d?.data) { out[key] = Buffer.from(d.data, "base64"); return; }
    }
    console.error(`  ✗ ${key}: 이미지 없음`);
  });
  return out;
}

// ── 후처리 · 등록 ────────────────────────────────────
async function toWebp(buffer, isChar) {
  let buf = buffer;
  if (isChar) {
    try { buf = Buffer.from(await removeLightBackground(buf)); }
    catch (err) { console.warn("  배경 제거 실패 — 원본 사용:", err?.message ?? err); }
  }
  return Buffer.from(await sharp(buf).webp({ quality: 86, alphaQuality: 100, effort: 4 }).toBuffer());
}

async function uploadImage(target, webp) {
  const form = new FormData();
  form.append("kind", "storybook-image");
  form.append("bookId", bookId);
  form.append("target", target);
  form.append("file", new Blob([webp], { type: "image/webp" }), `${target}.webp`);
  const res = await fetch(`${APP_URL}/api/upload`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(`업로드 실패(${res.status}): ${data.error || ""}`);
  return data.url;
}

async function registerChar(characterId, url) {
  const snap = await get(ref(db, `generated_books/${bookId}/characters`));
  const pos = (snap.val() || []).findIndex((c) => c?.id === characterId);
  if (pos < 0) throw new Error(`등장인물을 찾지 못했습니다: ${characterId}`);
  await set(ref(db, `generated_books/${bookId}/characters/${pos}/avatarUrl`), url);
}

async function registerScene(pageIdx, url) {
  if (pageIdx === 0) {
    await set(ref(db, `generated_books/${bookId}/cover/imageUrl`), url);
    await update(ref(db, `generated_books_index/${bookId}`), { coverImageUrl: url }).catch(() => {});
    return;
  }
  const snap = await get(ref(db, `generated_books/${bookId}/pages`));
  const pos = (snap.val() || []).findIndex((p) => p?.idx === pageIdx);
  if (pos < 0) throw new Error(`페이지를 찾지 못했습니다: ${pageIdx}`);
  await set(ref(db, `generated_books/${bookId}/pages/${pos}/illustration/imageUrl`), url);
}

async function finishPhase(jobs, images) {
  mkdirSync(OUT_DIR, { recursive: true });
  let ok = 0;
  for (const j of jobs) {
    const raw = images[j.key];
    if (!raw) continue;
    try {
      const webp = await toWebp(raw, j.kind === "char");
      writeFileSync(join(OUT_DIR, `${j.key}.webp`), webp); // 눈으로 검수할 사본
      const url = await uploadImage(j.key, webp);
      if (j.kind === "char") await registerChar(j.characterId, url);
      else await registerScene(j.pageIdx, url);
      console.log(`  ✓ ${j.key} 등록 (${Math.round(webp.length / 1024)}KB)`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${j.key}: ${err?.message ?? err}`);
    }
  }
  console.log(`  등록 ${ok} / 요청 ${jobs.length} — 사본: ${OUT_DIR}`);
}

/** 등록된 등장인물 그림을 내려받아 참조 이미지로 쓴다 (개당 1.5MB 이하, 종전 규칙). */
async function fetchCharImages(book) {
  const out = {};
  for (const c of book.characters) {
    if (!c.avatarUrl) continue;
    try {
      const res = await fetch(c.avatarUrl);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > 1.5 * 1024 * 1024) continue;
      out[c.id] = { base64: buf.toString("base64"), mimeType: res.headers.get("content-type") || "image/webp" };
    } catch { /* 참조 없이 진행 */ }
  }
  return out;
}

// ── 실행 ─────────────────────────────────────────────
let book = await loadBook();
console.log(`책: ${book.title?.ko || bookId} — 페이지 ${book.pages.length}장, 등장인물 ${book.characters.length}명`);

if (DRY) {
  const cj = charJobs(book);
  const sj = sceneJobs(book, {});
  console.log(`[dry-run] 모델 ${GEMINI_IMAGE_MODEL} · 등록 주소 ${APP_URL}`);
  console.log(`[dry-run] 1단계 등장인물 ${cj.length}건: ${cj.map((j) => j.key).join(", ") || "-"}`);
  console.log(`[dry-run] 2단계 표지·페이지 ${sj.length}건: ${sj.map((j) => j.key).join(", ") || "-"}`);
  console.log("[dry-run] 호출·과금 없이 끝냅니다.");
  process.exit(0);
}

// 1단계: 등장인물
if (!RESUME || PHASE === "chars") {
  const jobs = charJobs(book);
  if (jobs.length > 0) {
    console.log(`1단계 — 등장인물 ${jobs.length}건`);
    const name = RESUME && PHASE === "chars" ? RESUME : await submitBatch(jobs, "chars");
    await finishPhase(jobs, resultsOf(await poll(name, "chars")));
    book = await loadBook();
  } else {
    console.log("1단계 — 만들 등장인물 그림 없음");
  }
}

// 2단계: 표지·페이지 (등장인물 그림을 참조로 첨부)
{
  const jobs = sceneJobs(book, await fetchCharImages(book));
  if (jobs.length > 0) {
    console.log(`2단계 — 표지·페이지 ${jobs.length}건`);
    const name = RESUME && PHASE === "scenes" ? RESUME : await submitBatch(jobs, "scenes");
    await finishPhase(jobs, resultsOf(await poll(name, "scenes")));
  } else {
    console.log("2단계 — 만들 표지·페이지 그림 없음");
  }
}
console.log("끝. 웹앱 서재에서 그림이 보이는지 확인하세요.");
process.exit(0);

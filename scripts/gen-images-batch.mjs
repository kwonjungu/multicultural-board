// Gemini Batch API 로 에셋 이미지 일괄 생성 (나노바나나 1 = gemini-2.5-flash-image).
// 배치 모드는 일반 호출 대비 50% 할인.
//
// 사용법:
//   $env:GEMINI_API_KEY = "..."           (PowerShell)
//   node scripts/gen-images-batch.mjs              # 제출 + 폴링 + 저장
//   node scripts/gen-images-batch.mjs batches/XXX  # 기존 배치 폴링 재개
//
// 결과: .image-batch-out/<key>.png 로 저장. 통합(배경 제거/경로 적용)은 별도 단계.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const MODEL = "gemini-2.5-flash-image"; // 나노바나나 1
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const OUT_DIR = ".image-batch-out";

// 공통 스타일 — 기존 앱 에셋(플랫 카툰, 굵은 외곽선, 꿀벌 테마)과 톤 맞춤
const STICKER_STYLE =
  "Flat cartoon sticker style for a children's app, bold rounded dark outlines, " +
  "soft cel shading, warm friendly colors, simple shapes, kid-friendly, " +
  "single centered subject on a pure solid white background, no text, no watermark, no border.";

const SCENE_STYLE =
  "Bright flat cartoon illustration for an elementary school learning app, " +
  "bold clean outlines, cheerful warm colors, simple readable composition, " +
  "kid-friendly, full-bleed square scene, no text, no watermark.";

// 2차 배치 — 코드(CSS/이모지)로 그려져 있던 게임 비주얼 교체.
// (1차: 로고·OG·마스코트·퍼즐 — 76dc100 커밋에 적용 완료)
const FOOD_STYLE =
  "Appetizing flat cartoon food illustration for a children's cooking game, " +
  "served on a cute dish, bold rounded outlines, soft cel shading, warm colors, " +
  "single centered dish on a pure solid white background, no text, no watermark.";

const JOBS = [
  // ── 윷가락 (현재 CSS 사각형) — 앞면/뒷면 ──
  {
    key: "yut-stick-flat",
    aspectRatio: "9:16",
    prompt: "A single traditional Korean yut game stick standing vertically, flat pale birch wood face up showing subtle wood grain, rounded ends, bold cartoon outline style. Single centered object on a pure solid white background, no text.",
  },
  {
    key: "yut-stick-round",
    aspectRatio: "9:16",
    prompt: "A single traditional Korean yut game stick standing vertically, dark walnut rounded back side up with a subtle curved highlight, rounded ends, bold cartoon outline style. Single centered object on a pure solid white background, no text.",
  },
  // ── 할리갈리 종 (현재 🔔 이모지) ──
  {
    key: "halligalli-bell",
    prompt: `A shiny golden desk bell (call bell) with a red base, ready to be slapped, slight sparkle. ${STICKER_STYLE}`,
  },
  // ── 결과 화면 공용 트로피 (현재 🏆 이모지) ──
  {
    key: "trophy-honeypot",
    prompt: `A golden trophy cup shaped like a honey pot, dripping honey, with a little honeybee sitting proudly on the rim and a star on the front. ${STICKER_STYLE}`,
  },
  // ── 단어탑 꿀블록 (현재 CSS div) ──
  {
    key: "honey-block",
    prompt: `A single glossy hexagonal honeycomb cell block filled with golden honey, like a building block for a tower game. ${STICKER_STYLE}`,
  },
  // ── 랜딩 히어로 (현재 패턴+마스코트뿐) ──
  {
    key: "hero-landing",
    aspectRatio: "16:9",
    prompt:
      "Wide warm illustration: a diverse group of happy elementary school kids from different countries sitting in a sunny classroom, " +
      "a friendly cartoon honeybee flying above them carrying an empty speech bubble, soft honeycomb pattern in the sky. " +
      "Flat cartoon style, bold outlines, cheerful, no text, no watermark.",
  },
  // ── 꿀벌카페 메뉴 12종 (현재 전부 이모지) ──
  { key: "cafe-kimchi-jjigae", prompt: `Korean kimchi jjigae — bubbling red kimchi stew in a black stone pot with tofu and scallions. ${FOOD_STYLE}` },
  { key: "cafe-bibimbap",      prompt: `Korean bibimbap — colorful rice bowl with neatly arranged vegetables, egg yolk on top, in a stone bowl. ${FOOD_STYLE}` },
  { key: "cafe-pho",           prompt: `Vietnamese pho — rice noodle soup with sliced beef, herbs and lime in a big bowl, chopsticks beside. ${FOOD_STYLE}` },
  { key: "cafe-banh-mi",       prompt: `Vietnamese banh mi — crispy baguette sandwich filled with vegetables, cilantro and meat. ${FOOD_STYLE}` },
  { key: "cafe-pad-thai",      prompt: `Thai pad thai — stir-fried noodles with shrimp, bean sprouts, peanuts and a lime wedge on a plate. ${FOOD_STYLE}` },
  { key: "cafe-mango-sticky",  prompt: `Thai mango sticky rice — sliced golden mango with white sticky rice and coconut cream drizzle on a plate. ${FOOD_STYLE}` },
  { key: "cafe-curry-rice",    prompt: `Japanese curry rice — golden brown curry sauce with carrots and potato over white rice on an oval plate. ${FOOD_STYLE}` },
  { key: "cafe-dumpling",      prompt: `Chinese dumplings — a bamboo steamer with plump pleated dumplings, steam rising. ${FOOD_STYLE}` },
  { key: "cafe-sushi",         prompt: `Japanese sushi — assorted nigiri and rolls neatly arranged on a wooden board with wasabi. ${FOOD_STYLE}` },
  { key: "cafe-adobo",         prompt: `Filipino chicken adobo — glossy soy-braised chicken with bay leaves over rice in a bowl. ${FOOD_STYLE}` },
  { key: "cafe-nasi-goreng",   prompt: `Indonesian nasi goreng — fried rice topped with a fried egg, cucumber slices and crackers on a plate. ${FOOD_STYLE}` },
  { key: "cafe-plov",          prompt: `Uzbek plov — golden rice pilaf with carrots, raisins and tender meat piled on a large platter. ${FOOD_STYLE}` },
];

async function api(path, init = {}) {
  // 일시적 네트워크 오류(ECONNRESET 등)는 5회까지 백오프 재시도
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`${BASE}/${path}`, {
        ...init,
        headers: {
          "x-goog-api-key": API_KEY,
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
      }
      return body;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.cause?.code ?? err?.message ?? err);
      const transient = /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket/i.test(msg);
      if (!transient || attempt === 5) throw err;
      console.warn(`  ⚠ 네트워크 오류(${msg}) — ${attempt}/5 재시도…`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  throw lastErr;
}

async function submitBatch() {
  const requests = JOBS.map((j) => ({
    request: {
      contents: [{ parts: [{ text: j.prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: j.aspectRatio || "1:1" },
      },
    },
    metadata: { key: j.key },
  }));

  const body = {
    batch: {
      display_name: "multicultural-board-assets",
      input_config: { requests: { requests } },
    },
  };
  const op = await api(`models/${MODEL}:batchGenerateContent`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log(`배치 제출 완료: ${op.name} (${JOBS.length}건)`);
  return op.name;
}

async function poll(name) {
  const start = Date.now();
  let netFails = 0;
  for (;;) {
    let op = null;
    try {
      op = await api(name);
      netFails = 0;
    } catch (err) {
      // 일시적 네트워크 끊김(ECONNRESET 등)은 재시도 — 배치는 서버에서 계속 돈다
      netFails++;
      console.warn(`  ⚠ 폴링 실패 ${netFails}회: ${String(err?.message ?? err).slice(0, 120)}`);
      if (netFails >= 10) {
        console.error(`연속 실패 — 나중에 재개: node scripts/gen-images-batch.mjs ${name}`);
        process.exit(1);
      }
    }
    if (op) {
      const state = op.metadata?.state || (op.done ? "done" : "running");
      const mins = Math.round((Date.now() - start) / 60000);
      console.log(`  …${state} (${mins}분 경과)`);
      if (op.done) return op;
    }
    if (Date.now() - start > 60 * 60 * 1000) {
      console.log(`1시간 초과 — 나중에 재개: node scripts/gen-images-batch.mjs ${name}`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 20000));
  }
}

function saveResults(op) {
  mkdirSync(OUT_DIR, { recursive: true });
  if (op.error) {
    console.error("배치 실패:", JSON.stringify(op.error).slice(0, 500));
    process.exit(1);
  }
  const inlined =
    op.response?.inlinedResponses?.inlinedResponses ??
    op.response?.inlined_responses?.inlined_responses ?? [];
  if (inlined.length === 0) {
    console.error("inlinedResponses 없음 — 원본 응답 저장: batch-raw.json");
    writeFileSync(join(OUT_DIR, "batch-raw.json"), JSON.stringify(op, null, 2));
    process.exit(1);
  }
  let ok = 0, bad = 0;
  inlined.forEach((item, i) => {
    const key = item.metadata?.key || `item-${i}`;
    if (item.error) {
      bad++;
      console.error(`✗ ${key}: ${JSON.stringify(item.error).slice(0, 200)}`);
      return;
    }
    const parts = item.response?.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    if (!img) {
      bad++;
      console.error(`✗ ${key}: 이미지 파트 없음`);
      return;
    }
    const data = img.inlineData?.data ?? img.inline_data?.data;
    const file = join(OUT_DIR, `${key}.png`);
    writeFileSync(file, Buffer.from(data, "base64"));
    ok++;
    console.log(`✓ ${key}.png`);
  });
  console.log(`\n완료: ${ok}장 저장, ${bad}장 실패 → ${OUT_DIR}/`);
}

const resumeName = process.argv[2];
const name = resumeName || (await submitBatch());
const op = await poll(name);
saveResults(op);

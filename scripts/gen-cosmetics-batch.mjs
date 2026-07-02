// 칭찬 꿀벌집 코스메틱 에셋 일괄 생성 — Gemini Batch API (나노바나나 1, 50% 할인).
// docs/코스메틱-확장계획.md 의 프롬프트 세트를 그대로 배치 제출한다.
//
// 사용법:
//   GEMINI_API_KEY=... node scripts/gen-cosmetics-batch.mjs          # 제출 + 폴링 + 저장
//   GEMINI_API_KEY=... node scripts/gen-cosmetics-batch.mjs batches/XXX  # 폴링 재개
//   GEMINI_API_KEY=... node scripts/gen-cosmetics-batch.mjs retry key1,key2  # 하자 건 즉시 재생성(비배치)
//
// 결과: .cosmetics-batch-out/<key>.png — 반영은 gen-cosmetics-apply.mjs 로.
// ⚠ API 키는 환경변수로만 — 이 파일이나 다른 파일에 절대 쓰지 말 것.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const MODEL = "gemini-2.5-flash-image"; // 나노바나나 1
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const OUT_DIR = ".cosmetics-batch-out";

// 기존 스티커(굵은 외곽선 플랫 카툰)와 시리즈 톤 통일
const STICKER =
  "Cute kawaii cartoon sticker illustration for a children's education app, " +
  "single subject centered, thick clean dark outline, soft cel shading, bright cheerful colors, " +
  "consistent with a friendly round honeybee mascot series, " +
  "plain solid white background, no text, no watermark, no border, square composition.";

const BACKDROP =
  "Background illustration for a character portrait in a children's app, " +
  "flat cartoon style with soft painterly light, cheerful and warm, " +
  "empty uncluttered center area for a mascot to stand in front, " +
  "full-bleed square composition, no text, no watermark.";

const JOBS = [
  // ── 🥇 스테이지 아트 v2 ──
  {
    key: "stage-2-larva",
    prompt: `An adorable realistic-proportioned bee larva: plump segmented cream-white C-shaped grub with soft body rings, tiny sleepy smile, rosy cheeks, slight honey-yellow sheen — clearly a real larva shape but lovable. ${STICKER}`,
  },
  {
    key: "stage-3-pupa",
    prompt: `A cute bee pupa: translucent golden-amber chrysalis capsule standing upright, the developing baby bee visible inside as a soft silhouette with folded wings and closed eyes, gentle inner glow, subtle wax texture — clearly a real pupa but charming. ${STICKER}`,
  },
  {
    key: "stage-1-egg",
    prompt: `A tiny glossy pearl-white bee egg, slightly oval, standing upright in a golden hexagonal honeycomb cell base, subtle pearly shimmer, one small sparkle. ${STICKER}`,
  },
  // ── 🥈 배경 4종 + 왕좌 ──
  {
    key: "backdrop-flower",
    prompt: `Dreamy flower meadow: soft-focus pink and yellow wildflowers, pastel blue sky, gentle bokeh circles, warm sunlight. ${BACKDROP}`,
  },
  {
    key: "backdrop-hive",
    prompt: `Warm golden honeycomb wall: glowing hexagon cells, dripping honey highlights at the top, cozy amber light. ${BACKDROP}`,
  },
  {
    key: "backdrop-rainbow",
    prompt: `Cheerful sky with a soft pastel rainbow arc, fluffy white clouds, tiny sparkles. ${BACKDROP}`,
  },
  {
    key: "backdrop-night",
    prompt: `Magical night sky: deep navy, crescent moon, twinkling stars, glowing fireflies. ${BACKDROP}`,
  },
  {
    key: "backdrop-throne",
    prompt: `Royal throne room: golden throne with honeycomb motifs, warm spotlights, red carpet leading forward. ${BACKDROP}`,
  },
  // ── 🥈 오라 3종 + 로열 ──
  {
    key: "aura-sparkle",
    prompt: `A ring of golden sparkles and tiny stars forming a circular frame around an EMPTY center (nothing in the middle), magical glitter particles. ${STICKER}`,
  },
  {
    key: "aura-heart",
    prompt: `Floating pink and red hearts of various sizes forming a loose circular frame around an EMPTY center (nothing in the middle). ${STICKER}`,
  },
  {
    key: "aura-stardust",
    prompt: `Swirling pastel stardust trail forming a gentle spiral frame around an EMPTY center (nothing in the middle), tiny white stars. ${STICKER}`,
  },
  {
    key: "aura-royal",
    prompt: `Radiant golden royal aura: rays of light and floating tiny gold crowns and sparkles forming a majestic circular frame around an EMPTY center (nothing in the middle). ${STICKER}`,
  },
  // ── 🥉 소지품 3종 ──
  {
    key: "held-honeypot",
    prompt: `A tiny cute honey pot with dripping golden honey and a little wooden dipper, sized to be held by a small round mascot. ${STICKER}`,
  },
  {
    key: "held-book",
    prompt: `A tiny open storybook with colorful pages and a star on the cover, sized for a small round mascot to hold. ${STICKER}`,
  },
  {
    key: "held-flag",
    prompt: `A tiny triangular pennant flag on a wooden stick, honey-yellow with a small bee emblem (simple bee shape, no letters). ${STICKER}`,
  },
  // ── 🥉 액세서리 3종 + 망토 ──
  {
    key: "acc-scarf",
    prompt: `A cozy knitted scarf in red-and-white stripes, curved as if wrapped around a small round neck, front knot visible, front view. ${STICKER}`,
  },
  {
    key: "acc-glasses",
    prompt: `Round cute reading glasses with thin gold frames, slightly oversized lenses, front view. ${STICKER}`,
  },
  {
    key: "acc-necklace",
    prompt: `A dainty flower-petal necklace with a honey-drop pendant, curved for a small round character, front view. ${STICKER}`,
  },
  {
    key: "acc-cape",
    prompt: `A tiny royal velvet cape in deep crimson with white fur trim and a gold clasp, spread as if worn by a small round character, front view. ${STICKER}`,
  },
  // ── 👑 여왕벌 왕관 3종 ──
  {
    key: "hat-crown-rose",
    prompt: `An ornate rose-gold royal crown decorated with tiny pink gem roses, luxurious but cute, front view. ${STICKER}`,
  },
  {
    key: "hat-crown-sapphire",
    prompt: `A royal crown with deep blue sapphire jewels and silver filigree, front view. ${STICKER}`,
  },
  {
    key: "hat-crown-honey",
    prompt: `A golden crown shaped like dripping honey with hexagon honeycomb jewels, front view. ${STICKER}`,
  },
];

async function api(path, init = {}) {
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
}

async function submitBatch() {
  const requests = JOBS.map((j) => ({
    request: {
      contents: [{ parts: [{ text: j.prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "1:1" },
      },
    },
    metadata: { key: j.key },
  }));

  const body = {
    batch: {
      display_name: "praise-hive-cosmetics",
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
      netFails++;
      console.warn(`  ⚠ 폴링 실패 ${netFails}회: ${String(err?.message ?? err).slice(0, 120)}`);
      if (netFails >= 10) {
        console.error(`연속 실패 — 나중에 재개: node scripts/gen-cosmetics-batch.mjs ${name}`);
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
      console.log(`1시간 초과 — 나중에 재개: node scripts/gen-cosmetics-batch.mjs ${name}`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 20000));
  }
}

function extractImage(parts) {
  for (const p of parts || []) {
    const d = p.inlineData || p.inline_data;
    if (d?.data) return Buffer.from(d.data, "base64");
  }
  return null;
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
      console.error(`  ✗ ${key}: ${JSON.stringify(item.error).slice(0, 200)}`);
      bad++;
      return;
    }
    const parts = item.response?.candidates?.[0]?.content?.parts;
    const img = extractImage(parts);
    if (!img) {
      console.error(`  ✗ ${key}: 이미지 파트 없음`);
      bad++;
      return;
    }
    writeFileSync(join(OUT_DIR, `${key}.png`), img);
    console.log(`  ✓ ${key}.png (${Math.round(img.length / 1024)}KB)`);
    ok++;
  });
  console.log(`완료: 성공 ${ok} / 실패 ${bad} → ${OUT_DIR}/`);
}

// 하자 건 즉시 재생성 (비배치 — 소량이라 할인 포기하고 빠르게)
async function retry(keysCsv) {
  mkdirSync(OUT_DIR, { recursive: true });
  const keys = keysCsv.split(",").map((s) => s.trim()).filter(Boolean);
  for (const key of keys) {
    const job = JOBS.find((j) => j.key === key);
    if (!job) { console.error(`  ✗ 알 수 없는 key: ${key}`); continue; }
    console.log(`재생성: ${key} …`);
    const res = await api(`models/${MODEL}:generateContent`, {
      method: "POST",
      body: JSON.stringify({
        contents: [{ parts: [{ text: job.prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: "1:1" },
        },
      }),
    });
    const img = extractImage(res.candidates?.[0]?.content?.parts);
    if (!img) { console.error(`  ✗ ${key}: 이미지 없음`); continue; }
    writeFileSync(join(OUT_DIR, `${key}.png`), img);
    console.log(`  ✓ ${key}.png (${Math.round(img.length / 1024)}KB)`);
  }
}

const arg = process.argv[2];
if (arg === "retry") {
  await retry(process.argv[3] || "");
} else if (arg) {
  saveResults(await poll(arg));
} else {
  const name = await submitBatch();
  saveResults(await poll(name));
}

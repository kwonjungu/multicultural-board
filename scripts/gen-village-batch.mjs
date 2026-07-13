// 꿀벌 마을 로열 마일스톤 신규 에셋 5종 — Gemini Batch API (나노바나나 1, 50% 할인).
// docs/꿀벌마을-마스터플랜.md 의 로열 웨이브 프롬프트를 배치 제출한다.
//
// 사용법:
//   GEMINI_API_KEY=... node scripts/gen-village-batch.mjs               # 제출 + 폴링 + 저장
//   GEMINI_API_KEY=... node scripts/gen-village-batch.mjs batches/XXX   # 폴링 재개
//   GEMINI_API_KEY=... node scripts/gen-village-batch.mjs retry key1,key2  # 하자 건 즉시 재생성(비배치)
//
// 결과: .village-batch-out/<key>.png — 반영은 gen-village-apply.mjs 로.
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
const OUT_DIR = ".village-batch-out";

// 기존 스티커(굵은 외곽선 플랫 카툰)와 시리즈 톤 통일 — gen-cosmetics-batch 와 동일 블록
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
  // ── 🌟 로열 I (스티커 20) ──
  {
    key: "pet-fox",
    prompt: `A tiny cute fox friend sitting: fluffy orange fur, cream chest, big sparkly eyes, white-tipped bushy tail curled around its paws, happy smile — a small companion pet, ANIMAL ONLY, no bee, no other character. ${STICKER}`,
  },
  {
    key: "backdrop-galaxy",
    prompt: `Dreamy pastel galaxy: swirling purple-and-blue nebula clouds, twinkling stars, a few tiny planets and one shooting star, soft magical space colors, not too dark. ${BACKDROP}`,
  },
  // ── 🌙 로열 II (스티커 25) ──
  {
    key: "pet-owl",
    prompt: `A tiny round baby owl perched: soft lavender-brown feathers, huge curious golden eyes, tiny wing nubs, small ear tufts, sweet gentle smile — a small companion pet, ANIMAL ONLY, no bee, no other character. ${STICKER}`,
  },
  {
    key: "aura-prism",
    prompt: `Floating rainbow crystal prism shards and refracted light beams with sparkling dots, loosely arranged in an OPEN circular frame with big gaps between clusters, large EMPTY area in the middle, airy and light, NOT a solid ring, NOT a donut shape, no filled circle. ${STICKER}`,
  },
  // ── 💎 로열 III (스티커 30) ──
  {
    key: "trophy-diamond",
    prompt: `A shining diamond trophy OBJECT ONLY: a large faceted brilliant-cut crystal diamond mounted on a small golden pedestal base with a tiny bee emblem, subtle rainbow light refractions, front view — absolutely NO character, NO bee mascot, just the trophy. ${STICKER}`,
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
      display_name: "bee-village-royal",
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
        console.error(`연속 실패 — 나중에 재개: node scripts/gen-village-batch.mjs ${name}`);
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
      console.log(`1시간 초과 — 나중에 재개: node scripts/gen-village-batch.mjs ${name}`);
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

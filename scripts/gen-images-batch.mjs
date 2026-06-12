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

const JOBS = [
  // ── 브랜드: 로고 + 공유 카드 (현재 favicon 조차 없음) ──
  {
    key: "app-logo",
    prompt:
      "App logo mark for a children's communication app called Honeybee Board: " +
      "one adorable round honeybee with big friendly eyes hugging a bright speech bubble, " +
      "hexagon honeycomb accent behind, golden honey-yellow and warm amber palette. " +
      `Iconic, simple, instantly readable at small sizes. ${STICKER_STYLE}`,
  },
  {
    key: "og-share",
    aspectRatio: "16:9",
    prompt:
      "Wide hero illustration for a children's classroom app link preview: " +
      "a cheerful cartoon honeybee flying over a small smiling planet Earth, " +
      "colorful empty speech bubbles floating around (no letters inside), " +
      "honeycomb pattern subtly in the warm yellow sky background. " +
      "Flat cartoon style, bold outlines, joyful, no text, no watermark.",
  },
  // ── 허브 섹션 전용 마스코트 (현재 bee-think 가 통역·단어에 중복 사용) ──
  {
    key: "bee-headset",
    prompt: `An adorable chubby cartoon honeybee wearing a headset with microphone like an interpreter, one hand raised as if talking, friendly smile. ${STICKER_STYLE}`,
  },
  {
    key: "bee-book",
    prompt: `An adorable chubby cartoon honeybee happily reading a big open picture book, tiny Korean-style word cards floating around (blank cards, no letters). ${STICKER_STYLE}`,
  },
  // ── 이야기 주사위 전용 아이콘 3종 (현재 그림맞히기 에셋 차용 중) ──
  {
    key: "story-friend",
    prompt: `Two smiling elementary school kids of different ethnicities giving each other a cheerful high-five, friendship. ${STICKER_STYLE}`,
  },
  {
    key: "story-family",
    prompt: `A happy family — mom, dad and a child — holding hands together, warm and loving. ${STICKER_STYLE}`,
  },
  {
    key: "story-thanks",
    prompt: `A cute elementary school kid politely bowing with both hands together to say thank you, small pink heart floating above. ${STICKER_STYLE}`,
  },
  // ── 게임룸 지구본 게임 아이콘 (현재 이모지뿐) ──
  {
    key: "game-icon-globe",
    prompt: `A cute smiling planet Earth with tiny famous landmarks on top (palace, pagoda, torii gate) and a small cartoon honeybee flying around it. ${STICKER_STYLE}`,
  },
  // ── AI 튜터 꿀비 아바타 (현재 이모지 🐝 뿐) ──
  {
    key: "kkulbi-tutor",
    prompt: `An adorable chubby cartoon honeybee wearing a tiny graduation cap and round glasses, holding a small open book, looking smart and friendly. ${STICKER_STYLE}`,
  },
  // ── 문화 퍼즐 전용 일러스트 5종 (차용 이미지 교체용) ──
  {
    key: "puzzle-aodai",
    prompt: `A Vietnamese girl wearing a beautiful white ao dai traditional dress and conical hat, standing among lotus flowers. ${SCENE_STYLE}`,
  },
  {
    key: "puzzle-songkran",
    prompt: `Thai Songkran water festival — happy kids splashing water with buckets and water guns under the sun, golden temple roof in the background. ${SCENE_STYLE}`,
  },
  {
    key: "puzzle-naadam",
    prompt: `Mongolian Naadam festival — a young rider on a galloping horse across a vast green steppe, round white ger tents and blue sky in the background. ${SCENE_STYLE}`,
  },
  {
    key: "puzzle-jeepney",
    prompt: `A colorful decorated Filipino jeepney bus driving on a sunny street, palm trees in the background, cheerful and vibrant. ${SCENE_STYLE}`,
  },
  {
    key: "puzzle-taekwondo",
    prompt: `Two kids in white taekwondo uniforms with colored belts doing a high kick pose in a dojang, Korean flag on the wall. ${SCENE_STYLE}`,
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
  for (;;) {
    const op = await api(name);
    const state = op.metadata?.state || (op.done ? "done" : "running");
    const mins = Math.round((Date.now() - start) / 60000);
    console.log(`  …${state} (${mins}분 경과)`);
    if (op.done) return op;
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

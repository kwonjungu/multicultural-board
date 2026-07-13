// 꿀벌 마을 3D 에셋 21종 — Gemini Batch API (나노바나나 1, 50% 할인).
// docs/꿀벌마을-3D-설계.md §2 에셋 매니페스트를 배치 제출한다. 파일명(key) 변경 금지.
//
// 사용법:
//   GEMINI_API_KEY=... node scripts/gen-village3d-batch.mjs               # 제출 + 폴링 + 저장
//   GEMINI_API_KEY=... node scripts/gen-village3d-batch.mjs batches/XXX   # 폴링 재개
//   GEMINI_API_KEY=... node scripts/gen-village3d-batch.mjs retry key1,key2  # 하자 건 즉시 재생성(비배치)
//
// 결과: .village3d-batch-out/<key>.png — 반영은 gen-village3d-apply.mjs 로.
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
const OUT_DIR = ".village3d-batch-out";

// §2 공통 아이소 스타일 블록 (설계서 원문 — 스프라이트 20장 공통)
const ISO =
  "Cute kawaii cartoon game asset in isometric 3/4 top-down view, " +
  "single object centered, thick clean dark outline, soft cel shading, " +
  "bright cheerful colors, consistent with a friendly honeybee mascot " +
  "children's game, plain solid white background, no text, no watermark, " +
  "no ground shadow beyond a soft small ellipse, square composition.";

// 문패 3종 전용: 빈 판 강조 (이름은 런타임 캔버스 합성)
const PLATE =
  "Cute kawaii cartoon game asset, front view, single flat empty name plate " +
  "sign centered, completely BLANK surface with absolutely NO text, NO letters, " +
  "NO characters, NO symbols engraved or painted on it, thick clean dark outline, " +
  "soft cel shading, bright cheerful colors, consistent with a friendly honeybee " +
  "mascot children's game, plain solid white background, no watermark, " +
  "square composition.";

// ground-meadow 전용: 풀블리드 배경 (투명화 안 함, 타일링 가능)
const GROUND =
  "Seamless tileable ground texture for a children's game map, top-down view, " +
  "flat cartoon style with soft cel shading, bright cheerful colors, " +
  "full-bleed square composition filling the entire frame edge to edge, " +
  "no text, no watermark, no characters, no objects, no border.";

const JOBS = [
  // ── 집 4종 (iso) ──
  {
    key: "house-hive",
    prompt: `A small beehive cottage house: rounded golden-yellow hive-shaped hut with horizontal honeycomb ridges, a tiny arched wooden door, one round window, warm and cozy — building only, no bee, no character. ${ISO}`,
  },
  {
    key: "house-mushroom",
    prompt: `A small mushroom house: chubby red mushroom cap roof with white spots, cream stem-shaped walls, a tiny arched wooden door, one round window, storybook cozy — building only, no bee, no character. ${ISO}`,
  },
  {
    key: "house-tent",
    prompt: `A small camping tent house: cheerful striped canvas tent in yellow and orange, triangular shape with an open front flap as the door, tiny wooden pegs and rope, cozy — building only, no bee, no character. ${ISO}`,
  },
  {
    key: "house-castle",
    prompt: `A tiny fairytale castle house: small round stone tower with a pointed honey-orange cone roof, little golden flag on top, arched wooden door, small windows, charming miniature castle — building only, no bee, no character. ${ISO}`,
  },
  // ── 문패 3종 (정면, 빈 판 — NO text) ──
  {
    key: "plate-wood",
    prompt: `A blank wooden name plate: simple horizontal rounded wooden board with visible wood grain, hanging from a small wooden post, empty smooth surface. ${PLATE}`,
  },
  {
    key: "plate-honey",
    prompt: `A blank honey-themed name plate: horizontal rounded board shaped like golden dripping honey with a honeycomb hexagon corner decoration, empty smooth glossy surface, hanging from a small post. ${PLATE}`,
  },
  {
    key: "plate-flower",
    prompt: `A blank flower name plate: horizontal rounded SOLID wooden board painted in soft pastel pink, the entire board face fully filled with opaque pastel color (NOT white, NOT hollow, NOT just an outline frame), decorated with tiny daisy and tulip flowers along the border edge only, wide empty smooth pastel surface in the middle, hanging from a small post. ${PLATE}`,
  },
  // ── 울타리 2종 (iso) ──
  {
    key: "fence-wood",
    prompt: `A short section of wooden picket fence: warm light-brown wooden pickets with rounded tops, two horizontal rails, simple and cute — fence section only, no bee, no character. ${ISO}`,
  },
  {
    key: "fence-flower",
    prompt: `A short section of white picket fence covered with blooming flowers: white wooden pickets with pink and yellow flowers and green vines winding along the rail — fence section only, no bee, no character. ${ISO}`,
  },
  // ── 마당 아이템 8종 (iso) ──
  {
    key: "yard-tree-honey",
    prompt: `A magical honey tree: round leafy green tree with small golden honey pot jars hanging from its branches like fruit, sturdy brown trunk, drops of glossy honey — tree only, no bee, no character. ${ISO}`,
  },
  {
    key: "yard-tree-cherry",
    prompt: `A cherry blossom tree: fluffy pastel pink blossom canopy, a few petals falling, sturdy brown trunk — tree only, no bee, no character. ${ISO}`,
  },
  {
    key: "yard-bench",
    prompt: `A small wooden garden bench: warm brown wooden slats, rounded armrests, cute sturdy legs — bench only, no bee, no character. ${ISO}`,
  },
  {
    key: "yard-mailbox",
    prompt: `A cute mailbox on a wooden post: rounded honey-yellow mailbox with a small red flag and a slightly open lid, hexagon honeycomb pattern accent — mailbox only, no letters visible, no bee, no character. ${ISO}`,
  },
  {
    key: "yard-pond",
    prompt: `A mini garden pond: small oval pond of clear blue water with soft white highlight sparkles, ring of smooth round stones, one lily pad and a tiny reed — pond only, no fish, no bee, no character. ${ISO}`,
  },
  {
    key: "yard-flowerbed-tulip",
    prompt: `A small flower bed of tulips: neat oval patch of brown soil with a cluster of red, yellow and pink tulips and green leaves — flower bed only, no bee, no character. ${ISO}`,
  },
  {
    key: "yard-flowerbed-rose",
    prompt: `A small flower bed of roses: neat oval patch of brown soil with a cluster of blooming red and pink roses and green leaves — flower bed only, no bee, no character. ${ISO}`,
  },
  {
    key: "yard-lamp",
    prompt: `A honey street lamp: short curved dark metal lamp post holding a glowing hexagonal honeycomb-shaped lantern filled with warm golden honey light — lamp only, no bee, no character. ${ISO}`,
  },
  // ── 공동 시설 3종 (iso) ──
  {
    key: "facility-fountain",
    prompt: `A village fountain: round stone fountain with a honey-pot shaped centerpiece spouting water, gentle water arcs and sparkles, low stone basin — fountain only, no bee, no character. ${ISO}`,
  },
  {
    key: "facility-clock",
    prompt: `A village clock tower: charming small clock tower with warm brick walls, a round clock face with simple hands but NO numbers or letters, honey-orange pointed roof with a tiny flag — tower only, no bee, no character. ${ISO}`,
  },
  {
    key: "facility-festival",
    prompt: `A festival stage decoration: small round wooden stage platform with a striped canopy tent roof, colorful triangle bunting garlands and paper lanterns, celebratory and bright — stage only, blank flags with no letters, no bee, no character. ${ISO}`,
  },
  // ── 지면 텍스처 (풀블리드) ──
  {
    key: "ground-meadow",
    prompt: `A gentle green grass meadow texture: fresh light-green grass with subtle darker green tufts, a few tiny white and yellow wildflowers sparsely scattered in the middle area only, mostly plain and uncluttered so game sprites placed on top stay readable. CRITICAL for seamless tiling: all four edges must be perfectly plain uniform light-green grass with the exact same color and brightness, absolutely NO dirt patches, NO sand, NO bushes, NO flowers, NO vignette and NO darker shading anywhere near any edge or corner. ${GROUND}`,
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
      display_name: "bee-village-3d",
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
        console.error(`연속 실패 — 나중에 재개: node scripts/gen-village3d-batch.mjs ${name}`);
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
      console.log(`1시간 초과 — 나중에 재개: node scripts/gen-village3d-batch.mjs ${name}`);
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

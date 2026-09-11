/**
 * public/stickers/manifest-v2.json 생성기 — 작업 D (README §7.2).
 *
 * 원본 PNG 는 **읽기만** 한다. 이 스크립트는 어떤 이미지도 쓰지 않는다.
 * 실행: node scripts/build-sticker-manifest.mjs   (재현 가능, 결정적)
 *
 * ── 좌표계 ──────────────────────────────────────────────────────────
 * 모든 좌표는 **그 파일의 최종 trim 캔버스 픽셀**이다. 퍼센트는 화면
 * (contain) 변환 뒤에만 쓴다. anchors.json 의 퍼센트 값은 여기서 픽셀로
 * 환산해 기록하고, 환산식은 meta.anchorConversion 에 남긴다.
 *
 * ── 앵커를 채우는 규칙 (추측 금지) ──────────────────────────────────
 *  measured:alpha-bbox   알파 경계에서 결정적으로 계산되는 접점.
 *                        ground = (알파 경계 좌우 중앙 x, 경계 하단+1)
 *  measured:anchors.json 사람이 트림 이미지에서 잰 값(퍼센트)을 px 로 환산.
 *                        stage 기본 5종에만 존재한다.
 *  derived:bbox-transfer 같은 단계의 기본 자산과 실루엣이 충분히 같을 때
 *                        (정규화 IoU ≥ 0.90) 알파 bbox 정규화로 옮긴 값.
 *  (없음)                위 어느 것으로도 얻을 수 없는 앵커는 **비운다**.
 *                        특히 손 접점(leftGrip/rightGrip)은 어떤 자산에서도
 *                        측정할 수 없어 전부 비어 있다 → held 는 손에 쥐지
 *                        않고 바닥 소품으로만 배치한다(meta.heldPlacement).
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

// Windows 한글 경로: import.meta.url 의 pathname 은 URL 인코딩된다 (CLAUDE.md).
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ALPHA_THRESHOLD = 8; // asset-evidence.json 과 동일 기준
const IOU_MIN = 0.9;       // 앵커 이식을 허용하는 실루엣 일치도 하한
const IOU_GRID = 64;       // 실루엣 비교 해상도

const STAGES = [
  { stage: "egg", key: "stage-1-egg" },
  { stage: "larva", key: "stage-2-larva" },
  { stage: "pupa", key: "stage-3-pupa" },
  { stage: "bee", key: "stage-4-bee" },
  { stage: "queen", key: "stage-5-queen" },
];
const SKINS = ["classic", "orange", "green", "sky", "pink", "purple"];
const HATS = ["top", "cap", "party", "crown", "crown-rose", "crown-sapphire", "crown-honey"];
const ACCS = ["scarf", "glasses", "necklace", "cape"];
const HELDS = ["honeypot", "book", "flag"];
const BACKDROPS = ["flower", "hive", "rainbow", "night", "throne", "galaxy"];
const AURAS = ["sparkle", "heart", "stardust", "royal", "prism"];
const ALL_STAGES = STAGES.map((s) => s.stage);

/** 자산 1장 측정: 알파 경계 + 접지점 + 실루엣 마스크. */
async function measure(webPath) {
  const disk = resolve(ROOT, "public", webPath.replace(/^\//, ""));
  const bytes = await readFile(disk);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const opaque = (x, y) => data[(y * W + x) * C + C - 1] > ALPHA_THRESHOLD;

  let left = W, top = H, right = -1, bottom = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (opaque(x, y)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) throw new Error(`${webPath}: 불투명 픽셀이 없다`);

  // 접지점 = 실루엣 좌우 중앙의 최하단. 바닥 몇 줄만 보고 x 를 정하면
  // 벌처럼 한쪽 날개 끝이 가장 낮은 그림에서 중심이 화면 끝으로 끌려간다
  // (측정으로 확인: stage-4-bee 는 바닥 4px 띠 중앙이 x=18.5 였다).
  const ground = { x: round3((left + right + 1) / 2), y: bottom + 1 };

  const bw = right - left + 1, bh = bottom - top + 1;
  const mask = new Uint8Array(IOU_GRID * IOU_GRID);
  for (let j = 0; j < IOU_GRID; j++) {
    for (let i = 0; i < IOU_GRID; i++) {
      const sx = Math.min(W - 1, Math.floor(left + ((i + 0.5) / IOU_GRID) * bw));
      const sy = Math.min(H - 1, Math.floor(top + ((j + 0.5) / IOU_GRID) * bh));
      mask[j * IOU_GRID + i] = opaque(sx, sy) ? 1 : 0;
    }
  }
  return {
    file: webPath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sourceWidth: W,
    sourceHeight: H,
    alphaBounds: { left, top, right, bottom },
    ground,
    mask,
  };
}

function iou(a, b) {
  let inter = 0, union = 0;
  for (let k = 0; k < a.length; k++) {
    if (a[k] || b[k]) union++;
    if (a[k] && b[k]) inter++;
  }
  return union === 0 ? 0 : inter / union;
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/** 알파 bbox 정규화 이식: base 의 px 앵커를 target 의 px 앵커로. */
function transferAnchor(pt, base, target) {
  const bb = base.alphaBounds, tb = target.alphaBounds;
  const bw = bb.right - bb.left + 1, bh = bb.bottom - bb.top + 1;
  const tw = tb.right - tb.left + 1, th = tb.bottom - tb.top + 1;
  return {
    x: round3(tb.left + ((pt.x - bb.left) / bw) * tw),
    y: round3(tb.top + ((pt.y - bb.top) / bh) * th),
  };
}

async function main() {
  const anchorsJson = JSON.parse(await readFile(resolve(ROOT, "public/stickers/anchors.json"), "utf8"));
  const records = [];
  const notes = [];

  // ── 1. stage 기본 5종: anchors.json 퍼센트 → px ──────────────────
  const baseByStage = {};
  for (const { stage, key } of STAGES) {
    const m = await measure(`/stickers/${key}.png`);
    const a = anchorsJson[key] ?? {};
    const anchors = { ground: m.ground };
    const sources = { ground: "measured:alpha-bbox" };
    if (typeof a.headXPct === "number" && typeof a.headTopYPct === "number") {
      anchors.headTop = { x: round3((a.headXPct / 100) * m.sourceWidth), y: round3((a.headTopYPct / 100) * m.sourceHeight) };
      sources.headTop = "measured:anchors.json";
    }
    if (typeof a.headXPct === "number" && typeof a.faceYPct === "number") {
      anchors.eyes = { x: round3((a.headXPct / 100) * m.sourceWidth), y: round3((a.faceYPct / 100) * m.sourceHeight) };
      sources.eyes = "measured:anchors.json";
    }
    if (typeof a.headXPct === "number" && typeof a.neckYPct === "number") {
      anchors.neck = { x: round3((a.headXPct / 100) * m.sourceWidth), y: round3((a.neckYPct / 100) * m.sourceHeight) };
      sources.neck = "measured:anchors.json";
    }
    const rec = entry({
      assetId: `body/${key}`, m, anchors, sources,
      slots: ["body"], compatibleStages: [stage],
      extra: {
        stage, skin: "classic", hat: null,
        /** anchors.json 의 액세서리 기준 폭(%). 화면 폭 계산의 유일한 근거. */
        accScalePct: typeof a.accScalePct === "number" ? a.accScalePct : null,
        hatScalePct: typeof a.hatScalePct === "number" ? a.hatScalePct : null,
        silhouetteIoU: null,
      },
    });
    records.push(rec);
    baseByStage[key] = { m, rec };
  }

  // ── 2. 색 스킨 / 모자 합성본 ────────────────────────────────────
  const bodyDirs = [
    { dir: "skins", parse: parseSkinFile },
    { dir: "stage-hats", parse: parseStageHatFile },
    { dir: "skin-hats", parse: parseSkinHatFile },
  ];
  for (const { dir, parse } of bodyDirs) {
    const files = (await readdir(resolve(ROOT, "public/stickers", dir))).filter((f) => f.endsWith(".png")).sort();
    for (const f of files) {
      const parsed = parse(f);
      if (!parsed) { notes.push(`파싱 불가 파일: ${dir}/${f}`); continue; }
      const { key, skin, hat } = parsed;
      const stage = STAGES.find((s) => s.key === key)?.stage;
      if (!stage) { notes.push(`알 수 없는 stage: ${dir}/${f}`); continue; }
      const m = await measure(`/stickers/${dir}/${f}`);
      const base = baseByStage[key];
      const similarity = round3(iou(base.m.mask, m.mask));

      const anchors = { ground: m.ground };
      const sources = { ground: "measured:alpha-bbox" };
      // 실루엣이 사실상 같은 그림일 때만 머리/눈/목 앵커를 옮긴다.
      // 색 스킨과 합성본은 대부분 **다시 그려진 별도 그림**이라 옮길 수 없다.
      if (similarity >= IOU_MIN) {
        for (const name of ["headTop", "eyes", "neck"]) {
          const p = base.rec.anchors[name];
          if (p) { anchors[name] = transferAnchor(p, base.m, m); sources[name] = `derived:bbox-transfer(IoU ${similarity})`; }
        }
      }
      records.push(entry({
        assetId: `body/${key}${skin === "classic" && !hat ? "" : `+${skin}`}${hat ? `+${hat}` : ""}`,
        m, anchors, sources,
        slots: ["body"], compatibleStages: [stage],
        extra: {
          stage, skin, hat: hat ?? null,
          accScalePct: base.rec.accScalePct,
          hatScalePct: base.rec.hatScalePct,
          silhouetteIoU: similarity,
        },
      }));
    }
  }

  // ── 3. 오버레이 자산: 모자 / 액세서리 / 소지품 ──────────────────
  for (const hat of HATS) {
    const m = await measure(`/stickers/hat-${hat}.png`);
    // 모자의 자체 접점 = 알파 경계 아래 중앙(챙/테두리 바닥). 이 점을 몸의
    // headTop 에 맞춘다. 챙이 앞으로 처지는 모자(cap)는 이 점이 실제 착용
    // 접점보다 조금 아래다 — 합성본이 1순위인 이유.
    records.push(entry({
      assetId: `hat/${hat}`, m,
      anchors: { ground: m.ground },
      sources: { ground: "measured:alpha-bbox" },
      slots: ["hat"],
      compatibleStages: ALL_STAGES,
      extra: { attachTo: "headTop", grip: "ground", silhouetteIoU: null },
    }));
  }
  for (const acc of ACCS) {
    const m = await measure(`/stickers/acc-${acc}.png`);
    const cx = round3((m.alphaBounds.left + m.alphaBounds.right + 1) / 2);
    const anchors = { ground: m.ground };
    const sources = { ground: "measured:alpha-bbox" };
    let attachTo, grip;
    if (acc === "glasses") {
      // 안경은 좌우대칭 한 덩어리라 경계 중심 = 눈높이 중심.
      anchors.eyes = { x: cx, y: round3((m.alphaBounds.top + m.alphaBounds.bottom + 1) / 2) };
      sources.eyes = "measured:alpha-bbox(center)";
      attachTo = "eyes"; grip = "eyes";
    } else {
      // 목도리/목걸이/망토는 위쪽 가장자리가 목에 닿는다.
      anchors.neck = { x: cx, y: m.alphaBounds.top };
      sources.neck = "measured:alpha-bbox(top-center)";
      attachTo = "neck"; grip = "neck";
    }
    records.push(entry({
      assetId: `acc/${acc}`, m, anchors, sources,
      slots: [acc === "cape" ? "cape" : "acc"],
      compatibleStages: ALL_STAGES,
      extra: { attachTo, grip, silhouetteIoU: null },
    }));
  }
  for (const held of HELDS) {
    const m = await measure(`/stickers/held-${held}.png`);
    records.push(entry({
      assetId: `held/${held}`, m,
      anchors: { ground: m.ground },
      sources: { ground: "measured:alpha-bbox" },
      slots: ["held"],
      compatibleStages: ALL_STAGES,
      extra: { attachTo: "ground", grip: "ground", placement: "ground-prop", silhouetteIoU: null },
    }));
  }

  // ── 4. 환경 자산: 배경 / 오라 ───────────────────────────────────
  for (const id of BACKDROPS) {
    const m = await measure(`/stickers/backdrop-${id}.png`);
    records.push(entry({
      assetId: `backdrop/${id}`, m, anchors: {}, sources: {},
      slots: ["backdrop"], compatibleStages: ALL_STAGES, extra: { silhouetteIoU: null },
    }));
  }
  for (const id of AURAS) {
    const m = await measure(`/stickers/aura-${id}.png`);
    records.push(entry({
      assetId: `aura/${id}`, m, anchors: {}, sources: {},
      slots: ["aura"], compatibleStages: ALL_STAGES, extra: { silhouetteIoU: null },
    }));
  }

  records.sort((a, b) => (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0));

  const withAttach = records.filter((r) => r.slots[0] === "body" && (r.anchors.eyes || r.anchors.neck)).length;
  const manifest = {
    meta: {
      version: 2,
      generatedBy: "scripts/build-sticker-manifest.mjs",
      sourceCommitNote: "원본 PNG 는 읽기 전용. 이 파일은 이미지에서 재생성할 수 있다.",
      coordinateSpace: "그 파일의 최종 trim 캔버스 픽셀. 퍼센트는 contain 변환 뒤에만 쓴다.",
      alphaThreshold: ALPHA_THRESHOLD,
      anchorConversion: "anchors.json 은 PNG 폭/높이 대비 퍼센트다. x = headXPct/100 * sourceWidth, y = (headTopYPct|faceYPct|neckYPct)/100 * sourceHeight.",
      anchorSources: {
        "measured:alpha-bbox": "알파 경계에서 결정적으로 계산. ground = (알파 경계 좌우 중앙, 경계 하단+1).",
        "measured:anchors.json": "사람이 트림 이미지에서 잰 퍼센트를 px 로 환산. stage 기본 5종만.",
        "derived:bbox-transfer": `같은 단계 기본 자산과 실루엣 IoU ≥ ${IOU_MIN} 일 때만 알파 bbox 정규화로 이식.`,
      },
      unmeasured: {
        grips: "leftGrip/rightGrip 은 어떤 자산에서도 측정할 수 없다. 그래서 전부 비어 있다.",
        headOnRepaints: "skins/ 와 합성본은 재채색이 아니라 다시 그린 그림이라(IoU 0.45~0.96) 대부분 머리/눈/목 앵커를 옮길 수 없다.",
        authoredViewLight: "authoredView / lightDirection 은 실측하지 않았다. 타입이 필수라 중립값을 넣었을 뿐 미술 승인 근거가 아니다.",
      },
      heldPlacement: "몸 자산에 손 접점이 없으므로 held 는 손에 쥐지 않는다. 캐릭터 접지선 옆에 서는 바닥 소품으로만 배치한다(README §7.3).",
      approvedMeans: "기계 무결성(파일 존재·sha256 일치·알파 경계 유효) + 그 자산을 쓰는 데 필요한 자체 앵커가 실측으로 채워짐. 시각 승인은 별개이며 이 값이 아니다.",
      attachSupport: `몸 자산에 액세서리를 붙이려면 eyes/neck 앵커가 있어야 한다. 현재 ${withAttach}/${records.filter((r) => r.slots[0] === "body").length} 종만 가능하다.`,
      counts: { total: records.length },
      notes,
    },
    assets: records,
  };

  const out = resolve(ROOT, "public/stickers/manifest-v2.json");
  await writeFile(out, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const noAttach = records.filter((r) => r.slots[0] === "body" && !r.anchors.eyes && !r.anchors.neck).length;
  console.log(`manifest-v2.json: ${records.length} assets`);
  console.log(`  body 자산 중 액세서리 부착 가능: ${withAttach}, 불가(앵커 없음): ${noAttach}`);
  console.log(`  approved=false: ${records.filter((r) => !r.approved).length}`);
  if (notes.length) console.log("  notes:", notes.join(" | "));
}

/** ManifestEntry(계약 타입) + 감사용 부가 필드. */
function entry({ assetId, m, anchors, sources, slots, compatibleStages, extra }) {
  // 자체 앵커가 있어야 쓸 수 있는 자산(hat/acc/held)은 그 앵커가 없으면 미승인.
  const needsOwnAnchor = slots[0] === "hat" || slots[0] === "acc" || slots[0] === "cape" || slots[0] === "held";
  const hasOwnAnchor = Object.keys(anchors).length > 0;
  return {
    assetId,
    version: 2,
    sha256: m.sha256,
    file: m.file,
    sourceWidth: m.sourceWidth,
    sourceHeight: m.sourceHeight,
    alphaBounds: m.alphaBounds,
    anchors,
    slots,
    compatibleStages,
    authoredView: "front",
    lightDirection: "front",
    approved: needsOwnAnchor ? hasOwnAnchor : true,
    anchorSources: sources,
    ...extra,
  };
}

function parseSkinFile(f) {
  const base = f.replace(/\.png$/, "");
  for (const { key } of STAGES) {
    if (!base.startsWith(key + "-")) continue;
    const skin = base.slice(key.length + 1);
    if (SKINS.includes(skin) && skin !== "classic") return { key, skin, hat: null };
  }
  return null;
}
function parseStageHatFile(f) {
  const base = f.replace(/\.png$/, "");
  for (const { key } of STAGES) {
    if (!base.startsWith(key + "-")) continue;
    const hat = base.slice(key.length + 1);
    if (HATS.includes(hat)) return { key, skin: "classic", hat };
  }
  return null;
}
function parseSkinHatFile(f) {
  const base = f.replace(/\.png$/, "");
  for (const { key } of STAGES) {
    if (!base.startsWith(key + "-")) continue;
    const rest = base.slice(key.length + 1);
    for (const skin of SKINS) {
      if (skin === "classic" || !rest.startsWith(skin + "-")) continue;
      const hat = rest.slice(skin.length + 1);
      if (HATS.includes(hat)) return { key, skin, hat };
    }
  }
  return null;
}

await main();

// 액세서리/소지품 배치 미리보기 — AccessoryLayer(CharacterComposite.tsx)의
// CSS 좌표 계산을 sharp 로 그대로 재현해 스테이지×아이템 그리드 PNG 를 만든다.
// anchors.json 의 faceYPct/neckYPct/accScalePct 튜닝 후 재실행해 눈으로 검증.
// 사용법: node scripts/preview-accessories.mjs  → .acc-preview/stage-*.png

import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ST = (f) => join(ROOT, "public/stickers", f);
const OUT = join(ROOT, ".acc-preview");
mkdirSync(OUT, { recursive: true });

const B = 480; // 캐릭터 박스 (정사각)
const ANCHORS = JSON.parse(readFileSync(ST("anchors.json"), "utf8"));

const STAGES = [
  "stage-1-egg", "stage-2-larva", "stage-3-pupa", "stage-4-bee", "stage-5-queen",
];

// AccessoryLayer 와 동일한 배치 파라미터 (박스 % 단위)
function accPlacement(kind, a) {
  const x = a.headXPct, face = a.faceYPct ?? 34, neck = a.neckYPct ?? 52, s = a.accScalePct ?? 46;
  switch (kind) {
    case "glasses":  return { wPct: s * 0.92, leftPct: x - (s * 0.92) / 2, topPct: face - s * 0.92 * 0.21, z: "front" };
    case "scarf":    return { wPct: s * 1.02, leftPct: x - (s * 1.02) / 2, topPct: neck - s * 1.02 * 0.16, z: "front" };
    case "necklace": return { wPct: s * 0.92, leftPct: x - (s * 0.92) / 2, topPct: neck - s * 0.92 * 0.06, z: "front" };
    case "cape": {
      const w = Math.min(100, s * 1.9);
      return { wPct: w, leftPct: x - w / 2, topPct: neck - w * 0.14, z: "back" };
    }
  }
}

async function fitContain(file, boxW, boxH) {
  // CSS object-fit: contain 재현 — 축소 후 중앙 오프셋 반환
  const img = sharp(file);
  const meta = await img.metadata();
  const s = Math.min(boxW / meta.width, boxH / meta.height);
  const dw = Math.round(meta.width * s), dh = Math.round(meta.height * s);
  const buf = await img.resize(dw, dh).png().toBuffer();
  return { buf, left: Math.round((boxW - dw) / 2), top: Math.round((boxH - dh) / 2), dw, dh };
}

async function resizedByWidthPct(file, wPct) {
  const px = Math.round((B * wPct) / 100);
  const img = sharp(file);
  const meta = await img.metadata();
  const h = Math.round((meta.height / meta.width) * px);
  return { buf: await img.resize(px, h).png().toBuffer(), w: px, h };
}

const CELLS = ["glasses", "scarf", "necklace", "cape", "held"];

for (const key of STAGES) {
  const a = ANCHORS[key];
  const cells = [];
  for (const kind of CELLS) {
    const layers = [];
    const char = await fitContain(ST(`${key}.png`), B, B);
    if (kind === "held") {
      layers.push({ input: char.buf, left: char.left, top: char.top });
      const held = await resizedByWidthPct(ST("held-honeypot.png"), 30);
      layers.push({ input: held.buf, left: Math.round(B * 0.01), top: B - held.h - Math.round(B * 0.02) });
    } else {
      const p = accPlacement(kind, a);
      const acc = await resizedByWidthPct(ST(`acc-${kind}.png`), p.wPct);
      const accLayer = { input: acc.buf, left: Math.round((B * p.leftPct) / 100), top: Math.round((B * p.topPct) / 100) };
      if (p.z === "back") {
        layers.push(accLayer, { input: char.buf, left: char.left, top: char.top });
      } else {
        layers.push({ input: char.buf, left: char.left, top: char.top }, accLayer);
      }
    }
    cells.push(
      await sharp({ create: { width: B, height: B, channels: 4, background: { r: 255, g: 251, b: 235, alpha: 1 } } })
        .composite(layers.map((l) => ({ ...l, left: Math.max(-B, l.left), top: Math.max(-B, l.top) })))
        .png().toBuffer(),
    );
  }
  await sharp({ create: { width: B * CELLS.length, height: B, channels: 4, background: { r: 255, g: 251, b: 235, alpha: 1 } } })
    .composite(cells.map((buf, i) => ({ input: buf, left: i * B, top: 0 })))
    .png()
    .toFile(join(OUT, `${key}.png`));
  console.log(`✓ ${key}.png (안경|목도리|목걸이|망토|소지품)`);
}
console.log(`→ ${OUT}`);

// 여왕벌 전용 왕관 3종(rose/sapphire/honey) 합성본 생성 + 불량 classic queen-crown 복구.
// Gemini 배치 대신 sharp 로컬 합성 — 왕관 PNG(트림 상태)를 종횡비 보존으로
// 머리 앵커에 얹는다. 좌표는 compose-crown-test.mjs 로 시각 튜닝한 값.
//
// 출력:
//   classic → public/stickers/stage-hats/stage-5-queen-{hat}.png
//   skin    → public/stickers/skin-hats/stage-5-queen-{skin}-{hat}.png
//
// 사용: node scripts/gen-queen-crown-composites.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const P = (rel) => resolve(ROOT, "public", rel);

const SKINS = ["classic", "orange", "green", "sky", "pink", "purple"];

// 좌표는 정사각 베이스 기준 %: w=왕관 가로폭, bottom=왕관 바닥 y, cx=중심 x.
// trim:true 면 원본의 투명 여백을 먼저 제거해 콘텐츠 기준으로 배치한다.
// 제약: bottom - 왕관높이(w × h/w비) ≥ 0 이어야 상단이 캔버스에서 안 잘린다.
// 동시에 베이스에 구워진 작은 금왕관(x47~70%, y3~20%)을 가려야 한다.
const CROWNS = [
  { id: "crown-rose",     w: 38, bottom: 32, cx: 52 },
  { id: "crown-sapphire", w: 42, bottom: 32, cx: 51 },
  { id: "crown-honey",    w: 34, bottom: 32, cx: 53 }, // 세로로 길어 폭 축소
  // classic 전용 복구: Gemini 합성본에서 왕관이 누락됐던 조합.
  { id: "crown", w: 40, bottom: 30, cx: 52, trim: true, classicOnly: true },
];

async function crownBuffer(id, targetW, trim) {
  let img = sharp(P(`stickers/hat-${id}.png`));
  if (trim) img = sharp(await img.trim().png().toBuffer());
  const meta = await img.metadata();
  const targetH = Math.round(targetW * (meta.height / meta.width));
  return {
    buf: await img.resize(targetW, targetH).png().toBuffer(),
    w: targetW,
    h: targetH,
  };
}

let n = 0;
for (const skin of SKINS) {
  const baseRel = skin === "classic"
    ? "stickers/stage-5-queen.png"
    : `stickers/skins/stage-5-queen-${skin}.png`;
  const baseMeta = await sharp(P(baseRel)).metadata();
  const BOX = Math.max(baseMeta.width, baseMeta.height); // 전부 정사각이지만 방어적으로

  for (const c of CROWNS) {
    if (c.classicOnly && skin !== "classic") continue;
    const outRel = skin === "classic"
      ? `stickers/stage-hats/stage-5-queen-${c.id}.png`
      : `stickers/skin-hats/stage-5-queen-${skin}-${c.id}.png`;
    const targetW = Math.round((c.w / 100) * BOX);
    const { buf, h } = await crownBuffer(c.id, targetW, c.trim);
    const left = Math.round((c.cx / 100) * BOX - targetW / 2);
    const top = Math.round((c.bottom / 100) * BOX - h);
    await sharp(P(baseRel))
      .composite([{ input: buf, left, top }])
      .png()
      .toFile(P(outRel));
    n++;
    console.log(`✅ ${outRel}`);
  }
}
console.log(`총 ${n}장 생성 완료.`);

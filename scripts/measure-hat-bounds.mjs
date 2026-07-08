// 임시 측정 도구 — 모자/캐릭터 PNG 의 불투명 콘텐츠 경계를 % 로 출력.
// 오버레이 모자 좌표 튜닝용. (커밋 대상 아님이어도 무해한 읽기 전용 도구)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function bounds(rel) {
  const file = resolve(ROOT, "public", rel);
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3];
      if (a > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pct = (v, total) => Math.round((v / total) * 1000) / 10;
  console.log(
    `${rel}  ${W}x${H}  content x:[${pct(minX, W)}%..${pct(maxX + 1, W)}%] y:[${pct(minY, H)}%..${pct(maxY + 1, H)}%]  contentW:${pct(maxX - minX + 1, W)}% contentH:${pct(maxY - minY + 1, H)}%  aspect(w/h):${Math.round(((maxX - minX + 1) / (maxY - minY + 1)) * 100) / 100}`,
  );
}

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "stickers/hat-crown.png",
      "stickers/hat-crown-rose.png",
      "stickers/hat-crown-sapphire.png",
      "stickers/hat-crown-honey.png",
      "stickers/hat-top.png",
      "stickers/hat-cap.png",
      "stickers/hat-party.png",
      "stickers/stage-5-queen.png",
      "stickers/skins/stage-5-queen-pink.png",
      "stickers/stage-hats/stage-5-queen-crown.png",
      "stickers/stage-1-egg.png",
      "stickers/stage-2-larva.png",
      "stickers/stage-3-pupa.png",
      "stickers/stage-4-bee.png",
    ];

for (const t of targets) await bounds(t);

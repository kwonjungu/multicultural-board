// .cosmetics-batch-out/ 의 생성 이미지를 public/stickers/ 로 가공·배치.
// 사용법: node scripts/gen-cosmetics-apply.mjs
//
// sticker  : 흰 배경 제거(에지 flood-fill) → 트림 → 패딩 → 리사이즈 (투명 PNG)
// backdrop : 풀블리드 정사각 리사이즈만 (배경류는 배경이 콘텐츠)
//
// ⚠ stage-* v2 는 기존 파일을 덮어쓴다 — 적용 전 git 상태가 깨끗한지 확인.
//   스킨 재채색본(skins/)·모자 합성본과 어긋나므로, v2 확정 후 재채색 배치가 후속.

import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, ".cosmetics-batch-out");

const PLAN = [
  // 스테이지 v2 — 기존 파일 교체 (코드 무수정 반영)
  { key: "stage-1-egg",        out: "public/stickers/stage-1-egg.png",        type: "sticker", size: 512 },
  { key: "stage-2-larva",      out: "public/stickers/stage-2-larva.png",      type: "sticker", size: 512 },
  { key: "stage-3-pupa",       out: "public/stickers/stage-3-pupa.png",       type: "sticker", size: 512 },
  // 배경 (풀블리드)
  { key: "backdrop-flower",    out: "public/stickers/backdrop-flower.png",    type: "backdrop", size: 768 },
  { key: "backdrop-hive",      out: "public/stickers/backdrop-hive.png",      type: "backdrop", size: 768 },
  { key: "backdrop-rainbow",   out: "public/stickers/backdrop-rainbow.png",   type: "backdrop", size: 768 },
  { key: "backdrop-night",     out: "public/stickers/backdrop-night.png",     type: "backdrop", size: 768 },
  { key: "backdrop-throne",    out: "public/stickers/backdrop-throne.png",    type: "backdrop", size: 768 },
  // 오라 — 링이 중앙을 밀폐하는 경우가 있어 중앙 시드도 함께 flood ("aura" 타입)
  { key: "aura-sparkle",       out: "public/stickers/aura-sparkle.png",       type: "aura", size: 512 },
  { key: "aura-heart",         out: "public/stickers/aura-heart.png",         type: "aura", size: 512 },
  { key: "aura-stardust",      out: "public/stickers/aura-stardust.png",      type: "aura", size: 512 },
  { key: "aura-royal",         out: "public/stickers/aura-royal.png",         type: "aura", size: 512 },
  // 소지품
  { key: "held-honeypot",      out: "public/stickers/held-honeypot.png",      type: "sticker", size: 360 },
  { key: "held-book",          out: "public/stickers/held-book.png",          type: "sticker", size: 360 },
  { key: "held-flag",          out: "public/stickers/held-flag.png",          type: "sticker", size: 360 },
  // 액세서리
  { key: "acc-scarf",          out: "public/stickers/acc-scarf.png",          type: "sticker", size: 360 },
  { key: "acc-glasses",        out: "public/stickers/acc-glasses.png",        type: "sticker", size: 360 },
  { key: "acc-necklace",       out: "public/stickers/acc-necklace.png",       type: "sticker", size: 360 },
  { key: "acc-cape",           out: "public/stickers/acc-cape.png",           type: "sticker", size: 360 },
  // 여왕벌 왕관
  { key: "hat-crown-rose",     out: "public/stickers/hat-crown-rose.png",     type: "sticker", size: 360 },
  { key: "hat-crown-sapphire", out: "public/stickers/hat-crown-sapphire.png", type: "sticker", size: 360 },
  { key: "hat-crown-honey",    out: "public/stickers/hat-crown-honey.png",    type: "sticker", size: 360 },
];

// ── 흰 배경 제거: 4변 에지에서 흰색 계열만 flood-fill (apply-batch-images 와 동일) ──
// centerSeed=true 면 중앙 픽셀도 시드 — 오라처럼 링이 중앙 흰 영역을 밀폐한 경우
// (에지 flood 가 못 들어가 캐릭터를 가리는 흰 원이 남는 문제) 해결.
function removeWhiteBg(data, width, height, centerSeed = false) {
  const TOL = 38;
  const isWhite = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return r >= 255 - TOL && g >= 255 - TOL && b >= 255 - TOL
      && Math.max(r, g, b) - Math.min(r, g, b) <= 24;
  };
  const visited = new Uint8Array(width * height);
  const queue = [];
  const seed = (x, y) => {
    const pos = y * width + x;
    if (!visited[pos] && isWhite(pos * 4)) queue.push(pos);
  };
  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }
  if (centerSeed) {
    // 중앙 부근 여러 점 시드 — 중앙에 작은 장식이 있어도 근처 흰 픽셀로 진입
    const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
    for (const [dx, dy] of [[0,0],[-20,0],[20,0],[0,-20],[0,20],[-40,-40],[40,40]]) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < width && y >= 0 && y < height) seed(x, y);
    }
  }
  while (queue.length) {
    const pos = queue.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;
    const px = pos * 4;
    if (!isWhite(px)) continue;
    data[px + 3] = 0;
    const x = pos % width, y = (pos - x) / width;
    if (x > 0) queue.push(pos - 1);
    if (x < width - 1) queue.push(pos + 1);
    if (y > 0) queue.push(pos - width);
    if (y < height - 1) queue.push(pos + width);
  }
}

let ok = 0, miss = 0;
for (const job of PLAN) {
  const srcFile = join(SRC, `${job.key}.png`);
  if (!existsSync(srcFile)) {
    console.warn(`✗ 원본 없음: ${job.key}.png`);
    miss++;
    continue;
  }
  const outAbs = join(ROOT, job.out);
  await mkdir(dirname(outAbs), { recursive: true });
  const raw = await readFile(srcFile);

  if (job.type === "sticker" || job.type === "aura") {
    const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    removeWhiteBg(data, info.width, info.height, job.type === "aura");
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .trim()
      .toBuffer()
      .then((buf) =>
        sharp(buf)
          .resize(job.size, job.size, { fit: "inside", withoutEnlargement: true })
          .extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png({ compressionLevel: 9 })
          .toFile(outAbs),
      );
  } else {
    await sharp(raw).resize(job.size, job.size, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(outAbs);
  }
  console.log(`✓ ${job.key} → ${job.out}`);
  ok++;
}
console.log(`\n적용 ${ok}건, 누락 ${miss}건`);
if (ok > 0) {
  console.log("다음: stage-* 교체분은 트림 상태에서 head 앵커 재측정 → public/stickers/anchors.json 갱신");
}

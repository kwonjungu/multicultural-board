/**
 * 배경 제거 후 남은 **체크무늬 조각** 지우기.
 *
 * 생성 모델이 투명 배경을 체크무늬 그림으로 그려 낸 것을 걷어냈는데, 일부
 * 동물(bear 645px, cat 53px)의 가장자리에 회색 조각이 alpha=255 로 남았다.
 * 아바타 원 안에서 회색 얼룩으로 보인다.
 *
 * 앞선 시도와 무엇이 다른가: 그때는 알파가 아예 없어 배경 전체가 불투명
 * 회색이었고, 테두리 flood fill 이 크림색 털을 타고 동물 안으로 새어 들어가
 * 토끼를 통째로 지웠다. 지금은 **이미 알파가 있다** — 동물은 투명으로 둘러싸여
 * 있고 남은 조각은 그와 분리된 섬이다. 그래서 다음 두 조건을 모두 만족하는
 * 픽셀만 지운다:
 *   1) 테두리에서 투명·회색만 밟고 도달할 수 있다 (연결성)
 *   2) 색이 체크무늬 회색 대역이다 (채도 <= 12, 밝기 115~215)
 * 판다의 흰 배(~250)·검은 무늬(~40), 따뜻한 크림 털(채도 > 12)은 대역 밖이라
 * 건드리지 않는다.
 *
 *   실행: node scripts/clean-animal-specks.mjs [--dry]
 */
import sharp from "sharp";
import { readdirSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "public/ui-icons/v1/animals";
const KEEP = join(DIR, "_prealpha");
const DRY = process.argv.includes("--dry");
const IDS = ["rabbit", "bear", "cat", "dog", "fox", "panda", "penguin", "otter"];

/** 체크무늬 회색 대역인가. 좁게 잡아 동물 색을 건드리지 않는다. */
function isCheckerGray(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min > 12) return false;      // 따뜻한 털·분홍 볼 등은 제외
  return max >= 115 && max <= 215;        // 흰 배(>215)·검은 무늬(<115) 제외
}

async function clean(id) {
  const src = join(DIR, `${id}.png`);
  const { data, info } = await sharp(src).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const seen = new Uint8Array(W * H);
  const kill = [];

  const stack = [];
  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (seen[k]) return;
    const i = k * 4;
    const a = data[i + 3];
    // 투명하면 그냥 통과(연결 통로), 불투명이면 회색 대역일 때만 지우고 통과.
    if (a > 8 && !isCheckerGray(data[i], data[i + 1], data[i + 2])) return;
    seen[k] = 1;
    if (a > 0) kill.push(k);
    stack.push(k);
  };
  for (let x = 0; x < W; x++) { visit(x, 0); visit(x, H - 1); }
  for (let y = 0; y < H; y++) { visit(0, y); visit(W - 1, y); }
  while (stack.length) {
    const k = stack.pop();
    const x = k % W, y = (k / W) | 0;
    visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
  }

  for (const k of kill) data[k * 4 + 3] = 0;

  const out = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 }).toBuffer();
  return { out, removed: kill.length };
}

if (!existsSync(KEEP)) {
  mkdirSync(KEEP, { recursive: true });
  for (const id of IDS) copyFileSync(join(DIR, `${id}.png`), join(KEEP, `${id}.png`));
  console.log(`알파 적용본 ${IDS.length}개를 ${KEEP} 로 보존했다`);
}

for (const id of IDS) {
  const { out, removed } = await clean(id);
  const line = `${id.padEnd(8)} 조각 제거 ${String(removed).padStart(7)}px`;
  if (DRY) { console.log("[dry] " + line); continue; }
  await sharp(out).toFile(join(DIR, `${id}.png`) + ".tmp");
  copyFileSync(join(DIR, `${id}.png`) + ".tmp", join(DIR, `${id}.png`));
  const { unlinkSync } = await import("node:fs");
  unlinkSync(join(DIR, `${id}.png`) + ".tmp");
  console.log(line);
}
console.log(DRY ? "\n(dry run)" : "\n완료 — scripts/test-animal-assets.mjs 로 확인할 것");

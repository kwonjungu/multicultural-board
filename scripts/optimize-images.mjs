/**
 * 배포용 파생 이미지 생성 — 원본은 절대 건드리지 않는다.
 *
 * 사용법:
 *   node scripts/optimize-images.mjs            # 바뀐 것만 변환
 *   node scripts/optimize-images.mjs --all      # 전부 다시 변환
 *   node scripts/optimize-images.mjs --dry      # 무엇을 할지만 출력
 *   node scripts/optimize-images.mjs --only mascot
 *
 * 왜 이렇게 하나 (설계: 바탕화면 꿀벌소통창_연장작업_20260916 의 02·04)
 * -----------------------------------------------------------------
 * 실측(04)에서 소통창 14.9MB · 게임 고르기 16.2MB · 칭찬 15.4MB 가 나왔고,
 * 그 대부분이 "화면에서는 64px 인데 파일은 2.6MB" 인 그림들이었다. 문제는
 * 그림의 質이 아니라 **배포본이 원본 그대로라는 것**이다.
 *
 * 그래서 원본(public/**)은 그대로 두고, 실제 표시 크기에 맞춘 파생본을
 * `public/_opt/**` 에 따로 만든다. 코드가 어떤 URL 을 쓸지는 매니페스트
 * (`lib/image-manifest.json`)가 정한다. 롤백은 매니페스트를 비우면 끝이고,
 * 그 순간 모든 화면이 원본 URL 로 돌아간다.
 *
 * 지키는 규칙
 * - 원본 파일을 지우거나 덮어쓰지 않는다.
 * - 원본보다 키우지 않는다(withoutEnlargement).
 * - 비율·투명도를 유지한다.
 * - 사다리의 모든 폭을 반드시 만든다 — 코드가 URL 을 규칙으로 계산하므로
 *   하나라도 비면 그 자리가 404 가 된다.
 * - 한 장이 실패해도 전체를 멈추지 않는다. 그 항목은 원본만 쓰게 둔다.
 * - 내용 해시로 증분 처리한다 — 원본이 그대로면 다시 만들지 않는다.
 */
import sharp from "sharp";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const OUT_DIR = path.join(PUBLIC, "_opt");
const MANIFEST = path.join(ROOT, "lib", "image-manifest.json");

const args = process.argv.slice(2);
const FORCE = args.includes("--all");
const DRY = args.includes("--dry");
// indexOf 가 -1 일 때 args[0] 을 그룹 이름으로 읽던 버그가 있었다 —
// `--all` 만 주면 어떤 그룹과도 안 맞아 한 장도 변환되지 않았다.
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;

/**
 * 폴더별 파생 폭. **화면에서 실제로 쓰이는 최대 CSS 크기**에서 왔다 —
 * 표를 줄여 그림을 작게 만드는 것은 경량화가 아니다(02 §3).
 * 각 항목의 `max` 는 그 폴더의 최대 표시 크기, `widths` 는 DPR 1~3 을 덮는 폭이다.
 */
const GROUPS = [
  {
    id: "animals",
    dir: "ui-icons/v1/animals",
    // 최대 표시 72px (SetupScreen 미리보기). 40·44 자리가 더 많다.
    widths: [96, 144, 256],
    quality: 86,
  },
  {
    id: "mascot",
    dir: "mascot",
    widths: [256, 384, 768],
    quality: 86,
  },
  {
    id: "game-icons",
    dir: "game-icons",
    widths: [160, 320, 480],
    quality: 86,
  },
  {
    id: "stickers",
    dir: "stickers",
    widths: [128, 256, 512],
    quality: 86,
    recursive: true,
  },
  {
    // 내장 동화책. 실측 26장 전부 1024x1024 PNG 로 장당 1.1~1.9 MB 였다.
    // 자리는 등장인물 얼굴 120px(BookStudy), 서재 표지 200px, 읽기 판 600px 이다.
    id: "storybooks",
    dir: "storybooks",
    widths: [256, 480, 1024],
    quality: 86,
    recursive: true,
  },
  {
    id: "story",
    dir: "story",
    widths: [256, 480, 1024],
    quality: 86,
  },
  {
    id: "ui-icons",
    dir: "ui-icons/v1",
    widths: [64, 128, 256],
    quality: 86,
    recursive: true,
    // animals 는 자체 그룹으로 따로 다룬다
    skip: (rel) => rel.includes("/animals/"),
  },
];

const IMG_RE = /\.(png|jpe?g)$/i;

async function walk(dir, recursive, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // 원본 보관용 폴더와 산출물 폴더는 배포 대상이 아니다
      if (e.name === "_raw" || e.name === "_prealpha" || e.name === "_opt") continue;
      if (recursive) await walk(full, recursive, acc);
    } else if (IMG_RE.test(e.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const toUrl = (abs) => "/" + path.relative(PUBLIC, abs).split(path.sep).join("/");
const hashOf = (buf) => createHash("sha1").update(buf).digest("hex").slice(0, 12);

async function loadManifest() {
  if (FORCE || !existsSync(MANIFEST)) return { version: 1, generated: "", entries: {} };
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return { version: 1, generated: "", entries: {} };
  }
}

const manifest = await loadManifest();
const next = { version: 1, generated: new Date().toISOString(), entries: {} };

let converted = 0, reused = 0, skipped = 0, failed = 0, oversized = 0;
let beforeBytes = 0, afterBytes = 0;

for (const group of GROUPS) {
  if (ONLY && ONLY !== group.id) continue;
  const base = path.join(PUBLIC, group.dir);
  const files = await walk(base, group.recursive ?? false);
  if (!files.length) {
    console.log(`[${group.id}] 대상 없음 (${group.dir})`);
    continue;
  }
  console.log(`\n[${group.id}] ${files.length}개 · 폭 ${group.widths.join("/")}`);

  for (const abs of files) {
    const url = toUrl(abs);
    if (group.skip?.(url)) continue;

    let src;
    try {
      src = await readFile(abs);
    } catch (e) {
      console.log(`  ! 읽기 실패 ${url}: ${e.message}`);
      failed++;
      continue;
    }
    const hash = hashOf(src);
    const prev = manifest.entries?.[url];
    beforeBytes += src.length;

    // 원본이 그대로면 다시 만들지 않는다
    if (!FORCE && prev?.hash === hash && prev.derived?.every((d) => existsSync(path.join(PUBLIC, d.url.slice(1))))) {
      next.entries[url] = prev;
      afterBytes += prev.derived.at(-1)?.bytes ?? src.length;
      reused++;
      continue;
    }

    let meta;
    try {
      meta = await sharp(src).metadata();
    } catch (e) {
      console.log(`  ! 메타 실패 ${url}: ${e.message}`);
      failed++;
      continue;
    }

    const derived = [];
    for (const w of group.widths) {
      // **사다리의 모든 폭을 반드시 만든다.** 코드가 URL 을 규칙으로 계산하므로
      // (lib/imageOpt.ts) 하나라도 빠지면 그 자리에서 404 가 난다 — 원본보다
      // 큰 폭을 건너뛰었다가 실제로 42장이 깨졌다. withoutEnlargement 가
      // 확대를 막으므로, 작은 원본은 같은 크기로 저장될 뿐 화질은 그대로다.
      // 원본의 폴더 구조를 그대로 옮긴다. basename 만 쓰면 하위 폴더가
      // 뭉개져서 stickers/skins 와 stickers/skin-hats 의 같은 이름이 서로를
      // 덮어쓰고, lib/imageOpt.ts 가 계산한 URL 은 404 가 된다 — 실제로 그랬다.
      const relDir = path.relative(PUBLIC, path.dirname(abs));
      const outRel = path.join("_opt", relDir, `${path.basename(abs, path.extname(abs))}-${w}.webp`);
      const outAbs = path.join(PUBLIC, outRel);
      if (DRY) { derived.push({ w, url: "/" + outRel.split(path.sep).join("/"), bytes: 0 }); continue; }
      try {
        const buf = await sharp(src)
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: group.quality, alphaQuality: 100, effort: 5 })
          .toBuffer();
        // 파생본이 원본보다 커도 쓴다 — URL 이 비면 404 가 나기 때문이다.
        // (작은 아이콘 몇 개에서 실제로 생긴다. 수백 바이트 차이다.)
        if (buf.length >= src.length) oversized++;
        await mkdir(path.dirname(outAbs), { recursive: true });
        await writeFile(outAbs, buf);
        derived.push({ w, url: "/" + outRel.split(path.sep).join("/"), bytes: buf.length });
      } catch (e) {
        console.log(`  ! 변환 실패 ${url} @${w}: ${e.message}`);
      }
    }

    if (!derived.length) {
      // 줄일 수 없는 그림이다. 매니페스트에 넣지 않으면 코드가 원본을 쓴다.
      skipped++;
      afterBytes += src.length;
      continue;
    }

    next.entries[url] = {
      hash,
      width: meta.width ?? null,
      height: meta.height ?? null,
      bytes: src.length,
      alpha: Boolean(meta.hasAlpha),
      derived,
    };
    afterBytes += derived.at(-1).bytes;
    converted++;
    if (converted % 50 === 0) process.stdout.write(`  ...${converted}개 변환\n`);
  }
}

// --only 로 일부만 돌렸다면 나머지 항목은 기존 값을 유지한다
if (ONLY) {
  for (const [k, v] of Object.entries(manifest.entries ?? {})) {
    if (!(k in next.entries)) next.entries[k] = v;
  }
}

if (!DRY) {
  await mkdir(path.dirname(MANIFEST), { recursive: true });
  await writeFile(MANIFEST, JSON.stringify(next, null, 2) + "\n", "utf8");
}

const mib = (b) => (b / 1048576).toFixed(1);
console.log(`\n변환 ${converted} · 재사용 ${reused} · 건너뜀 ${skipped} · 원본보다 큰 파생본 ${oversized} · 실패 ${failed}`);
console.log(`가장 큰 파생본 기준: ${mib(beforeBytes)} MiB -> ${mib(afterBytes)} MiB`);
console.log(DRY ? "(--dry: 파일을 쓰지 않았다)" : `매니페스트: ${path.relative(ROOT, MANIFEST)}`);

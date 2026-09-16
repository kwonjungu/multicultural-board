/**
 * 동화책 성능 회귀 가드 — 설계서 05 의 3.9(쓰기 좁히기)와 3.3(WebP 저장).
 * 사용법: node scripts/test-storybook-perf.mjs
 * 서버도 브라우저도 필요 없다. 실패하면 0이 아닌 값으로 끝난다.
 *
 * 재는 것
 *  A. 소스 계약 — 함수 **본문 범위** 안에서만 판정한다. 파일 전체를 grep 하면
 *     다른 함수에 같은 문자열이 있다는 이유로 거짓 통과/실패가 난다
 *     (설계서 10 의 P4 가 지적한 바로 그 문제다).
 *  B. 실제 인코딩 — 내장 동화책 원본 한 장을 라우트와 같은 설정으로 변환해
 *     크기·해상도·투명도를 확인한다. 문자열 검사만으로는 "정말 줄어드는가" 를
 *     알 수 없다.
 *
 * 못 재는 것: Firebase 에 실제로 쓰이는 값, 생성 모델의 응답, 교실 부하.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";

const problems = [];
const ok = [];
const check = (cond, label, detail = "") => {
  if (cond) ok.push(label);
  else problems.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

/** 함수 하나의 본문을 중괄호 짝으로 잘라낸다. 문자열/주석까지 파싱하지는
 *  않지만, 이 파일들의 형태에서는 충분하고 grep 보다 훨씬 정확하다. */
function functionBody(source, name) {
  const at = source.indexOf(`function ${name}(`);
  if (at < 0) return null;
  const open = source.indexOf("{", at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

// ── A. 소스 계약 ──────────────────────────────────────────────
const storybook = await readFile("lib/storybook.ts", "utf8");

for (const name of ["updateGeneratedBookPageImage", "updateGeneratedBookCharacterAvatar"]) {
  const body = functionBody(storybook, name);
  check(body !== null, `${name} 를 찾았다`);
  if (!body) continue;
  // 책 전체를 다시 쓰면 작업 풀 3이 서로의 imageUrl 을 덮어쓴다.
  const writesWholeBook = /set\(\s*ref\(db,\s*`generated_books\/\$\{bookId\}`\s*\)/.test(body);
  check(!writesWholeBook, `${name} 가 책 전체를 set 하지 않는다`,
    "generated_books/{bookId} 통째 set 은 동시 쓰기에서 imageUrl 을 잃는다");
  // 잎까지 내려간 경로로 써야 한다.
  check(/set\(\s*ref\(db,\s*`generated_books\/\$\{bookId\}\/[^`]+`\s*\)/.test(body),
    `${name} 가 잎 경로로 쓴다`);
}

{
  const body = functionBody(storybook, "updateGeneratedBookField");
  check(body !== null, "updateGeneratedBookField 를 찾았다");
  if (body) {
    check(/\bupdate\(/.test(body), "updateGeneratedBookField 가 update() 로 합친다",
      "get -> merge -> set 은 형제 항목을 덮어쓴다");
    check(!/\bget\(/.test(body), "updateGeneratedBookField 가 읽지 않는다");
  }
}

// ── A2. 이미지 라우트 ─────────────────────────────────────────
const routePath = "app/api/storybook-agent/image/route.ts";
const route = await readFile(routePath, "utf8");

check(/\.webp\(\s*\{/.test(route), "이미지 라우트가 WebP 로 인코딩한다");
check(/alphaQuality/.test(route), "WebP 인코딩이 alphaQuality 를 지정한다",
  "캐릭터 초상은 배경을 지운 투명 PNG 다");
// 실패해도 생성 자체는 성공해야 한다.
const encodeBlock = route.slice(route.indexOf(".webp("));
check(/catch\s*\(/.test(encodeBlock.slice(0, 600)), "WebP 인코딩 실패에 폴백이 있다");
// 파일명이 실제 인코딩 결과를 따라가야 한다 — .png 를 하드코딩하면 거짓말이 된다.
const filenameBlock = route.slice(route.indexOf("const filename"), route.indexOf("const filename") + 400);
check(/\$\{ext\}/.test(filenameBlock), "저장 파일명이 실제 포맷(ext)을 따른다");
check(!/storybooks\/\$\{body\.bookId\}\/cover\.png/.test(filenameBlock),
  "저장 파일명에 .png 가 하드코딩돼 있지 않다");
check(!/resize\(/.test(route), "이미지 라우트가 해상도를 줄이지 않는다",
  "생성본은 1024x1024 이고 그게 표시 사다리의 상단이다");

// ── B. 실제 인코딩 — 정말 줄어드는가 ──────────────────────────
const sample = "public/storybooks/curious-worlds/char-buzzy.png";
if (!existsSync(sample)) {
  problems.push(`표본 이미지가 없다: ${sample} (sparse checkout?)`);
} else {
  const src = await readFile(sample);
  const before = await sharp(src).metadata();
  const out = await sharp(src).webp({ quality: 86, alphaQuality: 100, effort: 4 }).toBuffer();
  const after = await sharp(out).metadata();
  const ratio = out.length / src.length;

  check(after.width === before.width && after.height === before.height,
    "변환이 해상도를 바꾸지 않는다", `${before.width}x${before.height} -> ${after.width}x${after.height}`);
  // 내장 표본은 알파가 없다. 정작 지켜야 하는 건 배경을 지운 캐릭터 초상이므로
  // 투명한 그림을 직접 만들어 따로 확인한다 — 표본에 알파가 없으면 이 검사가
  // 공회전한다(처음 작성했을 때 실제로 그랬다).
  const transparent = await sharp({
    create: { width: 256, height: 256, channels: 4, background: { r: 255, g: 210, b: 90, alpha: 0 } },
  }).png().toBuffer();
  const tOut = await sharp(transparent).webp({ quality: 86, alphaQuality: 100, effort: 4 }).toBuffer();
  const tMeta = await sharp(tOut).metadata();
  check(tMeta.hasAlpha === true, "투명한 그림의 투명도가 유지된다",
    `alpha true -> ${tMeta.hasAlpha}`);
  check(ratio < 0.4, "변환본이 원본의 40% 미만이다",
    `${(src.length / 1024).toFixed(0)}KiB -> ${(out.length / 1024).toFixed(0)}KiB (${(ratio * 100).toFixed(1)}%)`);

  console.log(`표본 ${sample}`);
  console.log(`  ${before.width}x${before.height} · ${(src.length / 1024).toFixed(0)} KiB`
    + ` -> ${(out.length / 1024).toFixed(0)} KiB (${(ratio * 100).toFixed(1)}%)`
    + ` · alpha ${before.hasAlpha} -> ${after.hasAlpha}`);
}

// ── C. 파생본이 빠짐없이 있는가 ───────────────────────────────
// CSS background 자리는 폴백이 없다(lib/imageOpt.ts 주석 참조) — 파생본이 하나만
// 없어도 그 자리가 빈 채로 뜬다. 사다리의 모든 폭이 실제로 있는지 확인한다.
{
  const { readdir } = await import("node:fs/promises");
  const LADDER = [256, 480, 1024];
  const groups = [
    ["public/storybooks", true],
    ["public/story", false],
  ];
  let checked = 0;
  const missing = [];
  for (const [dir, recursive] of groups) {
    if (!existsSync(dir)) continue;
    const walk = async (d) => {
      for (const e of await readdir(d, { withFileTypes: true })) {
        const full = `${d}/${e.name}`;
        if (e.isDirectory()) { if (recursive) await walk(full); continue; }
        if (!/\.(png|jpe?g)$/i.test(e.name)) continue;
        const stem = e.name.replace(/\.[^.]+$/, "");
        const rel = d.replace(/^public\//, "");
        for (const w of LADDER) {
          const derived = `public/_opt/${rel.replace(/^public\//, "")}/${stem}-${w}.webp`
            .replace("public/_opt/public/", "public/_opt/");
          checked++;
          if (!existsSync(derived)) missing.push(derived);
        }
      }
    };
    await walk(dir);
  }
  check(missing.length === 0, `동화책 파생본이 빠짐없이 있다 (${checked}개 확인)`,
    missing.length ? `없는 것 ${missing.length}개, 예: ${missing[0]}` : "");
}

// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n통과 ${ok.length}건`);
for (const o of ok) console.log(`  · ${o}`);
if (problems.length) {
  console.log(`\n실패 ${problems.length}건`);
  for (const p of problems) console.log(`  ! ${p}`);
  process.exit(1);
}
console.log("\n문제 없음");

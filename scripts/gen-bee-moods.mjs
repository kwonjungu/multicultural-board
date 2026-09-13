/**
 * 꿀벌 감정 이모티콘 20종 생성 — lib/beeMoods.ts 가 단일 소스다.
 *
 *   실행: GEMINI_API_KEY=... node scripts/gen-bee-moods.mjs [--only=id1,id2] [--force]
 *
 * 왜 이렇게 하나:
 *   Nano Banana 는 **JPEG 로만** 돌려준다(알파 없음). 아바타는 투명 배경이어야
 *   원 안에서 잘리지 않으므로, 순수 마젠타(#FF00FF) 배경으로 생성한 뒤
 *   크로마키로 알파를 만든다. 마젠타를 고른 이유는 꿀벌 팔레트(노랑·크림·코코아)
 *   와 색 거리가 가장 멀어 경계 오판이 없기 때문이다.
 *
 *   "transparent background" 라고 프롬프트에 적는 방식은 예전에 **투명 체크무늬를
 *   그림으로 그려 내는** 사고를 냈다(03 에셋가이드 §에셋 QA). 그래서 쓰지 않는다.
 *
 * 원본(JPEG)은 설계 패키지 assets/moods/_raw 에 보존하고, 제품에는 128/64
 * 파생본만 넣는다 — 32~48px 아이콘에 1024px 원본을 내려받게 하지 않는다.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public/ui-icons/v1/moods");
const RAW_DIR = "C:/Users/권준구/Desktop/꿀벌소통창_Opus_실행설계_20260913/assets/moods/_raw";
const MODEL = "gemini-3.1-flash-image";            // Nano Banana 2 — Flash 계열(비용 하드캡 준수)
const API = "https://generativelanguage.googleapis.com/v1beta";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("GEMINI_API_KEY 가 없다. 키를 파일이나 코드에 적지 말고 환경변수로 넘겨라.");
  process.exit(1);
}

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice(7).split(",").map((s) => s.trim()).filter(Boolean) : null;
const force = args.includes("--force");

/* ── lib/beeMoods.ts 를 그대로 읽어 쓴다 (목록을 여기 복사해 두지 않는다) ── */
const tmp = mkdtempSync(join(tmpdir(), "bee-moods-"));
let BEE_MOODS;
try {
  const out = ts.transpileModule(readFileSync(join(root, "lib/beeMoods.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(tmp, "m.mjs"), out);
  ({ BEE_MOODS } = await import(pathToFileURL(join(tmp, "m.mjs"))));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const targets = BEE_MOODS.filter((m) => !only || only.includes(m.id));
console.log(`대상 ${targets.length}종${only ? " (--only)" : ""}`);

/* ── 프롬프트 — 20종이 같은 캐릭터·같은 화풍이어야 한다 ── */
function promptFor(m) {
  return [
    "Create ONE emoji-style sticker for a Korean elementary school classroom app.",
    "",
    "SUBJECT: the same friendly cartoon honeybee character in every image - a round honey-yellow body with soft dark brown stripes, a cream face, two tiny rounded translucent wings, two small antennae, simple black dot eyes, no nose, short simple arms and legs. Front-facing, chubby and cute, aimed at 7 to 9 year old children.",
    "",
    `EMOTION TO SHOW: "${m.en}" (${m.ko}). ${m.pose}.`,
    "The emotion must be readable from the face and body pose alone, with no words and no symbols other than what is described.",
    "",
    "STYLE: bold rounded cocoa-brown outline of even weight, honey yellow and cream palette with restrained accents, soft 2.5D matte volume, minimal flat shading, no glossy plastic highlights, no gradient mesh, no realistic texture. Keep the head scale, eye line, outline weight and proportions identical across the set so all twenty stickers look like one family.",
    "",
    "BACKGROUND RULE (critical): the bee sits on a COMPLETELY FLAT, UNIFORM, PURE MAGENTA background, hex #FF00FF, filling the entire square edge to edge. The background must be ONE single solid colour with NO gradient, NO texture, NO vignette, NO glow, NO drop shadow, and nothing else in the frame. Do not draw a transparency checkerboard.",
    "",
    "COMPOSITION: centered square, the bee occupies about 70 percent of the frame with generous even margins on all four sides. The silhouette must stay readable at 32 pixels.",
    "",
    "DO NOT include: text, letters, numbers, speech bubbles, watermarks, badge tiles, border frames, drop shadows on the background, multiple characters, or any object not described above.",
  ].join("\n");
}

/* ── 1) 배치 생성 ── */
async function generateBatch(list) {
  const requests = list.map((m) => ({
    request: { contents: [{ parts: [{ text: promptFor(m) }] }] },
    metadata: { key: m.id },
  }));
  const res = await fetch(`${API}/models/${MODEL}:batchGenerateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      batch: {
        display_name: `bee-moods-${Date.now()}`,
        input_config: { requests: { requests } },
      },
    }),
  });
  if (!res.ok) throw new Error(`batch 시작 실패 ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const op = await res.json();
  console.log("배치 작업:", op.name);

  // 폴링 — 배치는 비동기다.
  const deadline = Date.now() + 30 * 60_000;
  let state = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 15_000));
    const s = await fetch(`${API}/${op.name}`, { headers: { "x-goog-api-key": KEY } });
    if (!s.ok) throw new Error(`폴링 실패 ${s.status}`);
    state = await s.json();
    const st = state.metadata?.state || (state.done ? "DONE" : "RUNNING");
    process.stdout.write(`\r  상태: ${st}     `);
    if (state.done) break;
  }
  process.stdout.write("\n");
  if (!state?.done) throw new Error("배치가 제한 시간 안에 끝나지 않았다");
  if (state.error) throw new Error(`배치 오류: ${JSON.stringify(state.error).slice(0, 300)}`);

  const inlined = state.response?.inlinedResponses?.inlinedResponses || [];
  if (inlined.length === 0) {
    throw new Error(`배치 응답이 비어 있다: ${JSON.stringify(state.response || {}).slice(0, 300)}`);
  }
  const out = new Map();
  inlined.forEach((r, i) => {
    const id = r.metadata?.key ?? list[i]?.id;
    const parts = r.response?.candidates?.[0]?.content?.parts || [];
    const img = parts.find((p) => p.inlineData);
    if (img) out.set(id, Buffer.from(img.inlineData.data, "base64"));
    else console.warn(`  ${id}: 이미지 없음 — ${JSON.stringify(r.error || parts).slice(0, 160)}`);
  });
  return out;
}

/* ── 1-b) 배치가 막히면 동시 4개씩 개별 호출 ── */
async function generateParallel(list, concurrency = 4) {
  const out = new Map();
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const m = list[i++];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(`${API}/models/${MODEL}:generateContent`, {
            method: "POST",
            headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptFor(m) }] }] }),
          });
          if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
          const j = await res.json();
          const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
          if (!img) throw new Error("이미지 파트 없음");
          out.set(m.id, Buffer.from(img.inlineData.data, "base64"));
          console.log(`  ${m.id} ✓`);
          break;
        } catch (e) {
          console.warn(`  ${m.id} 시도 ${attempt} 실패: ${String(e.message).slice(0, 120)}`);
          if (attempt === 3) break;
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  return out;
}

/* ── 2) 크로마키 ──
   마젠타 정도를 d = min(r,b) - g 로 잰다. 배경은 d 가 230 안팎이고 꿀벌색은
   전부 0 아래라 경계가 넉넉하다. 가장자리는 부드럽게 깎고, 남은 마젠타 끼는
   초록 쪽으로 눌러 보라 테두리가 생기지 않게 한다(디스필). */
const D_OPAQUE = 60;    // 이 아래는 완전 불투명
const D_CLEAR = 150;    // 이 위는 완전 투명

async function keyOut(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    let r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const d = Math.min(r, b) - g;
    let a = 255;
    if (d >= D_CLEAR) a = 0;
    else if (d > D_OPAQUE) a = Math.round(255 * (1 - (d - D_OPAQUE) / (D_CLEAR - D_OPAQUE)));
    if (a > 0 && d > 25) {
      const cap = g + 25;
      if (r > cap) r = cap;
      if (b > cap) b = cap;
    }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  return { raw: out, W, H };
}

/** 알파 기준 내용 상자를 찾아 잘라내고, 정사각 캔버스에 약 78% 크기로 가운데 놓는다. */
async function normalize({ raw, W, H }, size) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (raw[(y * W + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("내용이 없다 — 크로마키가 그림까지 지웠다");
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const target = Math.round(size * 0.78);
  const scale = target / Math.max(cw, ch);
  const rw = Math.max(1, Math.round(cw * scale));
  const rh = Math.max(1, Math.round(ch * scale));
  const cropped = await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .resize(rw, rh, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cropped, left: Math.round((size - rw) / 2), top: Math.round((size - rh) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/* ── 실행 ── */
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(RAW_DIR, { recursive: true });

const todo = force ? targets : targets.filter((m) => !existsSync(join(OUT_DIR, `${m.id}-128.png`)));
if (todo.length === 0) {
  console.log("이미 다 있다. 다시 만들려면 --force");
  process.exit(0);
}
console.log(`생성할 것 ${todo.length}종`);

let images;
try {
  console.log("배치 API 로 생성한다…");
  images = await generateBatch(todo);
} catch (e) {
  console.warn(`배치 실패(${String(e.message).slice(0, 200)}) — 개별 호출로 넘어간다`);
  images = await generateParallel(todo);
}

let ok = 0;
const failed = [];
for (const m of todo) {
  const buf = images.get(m.id);
  if (!buf) { failed.push(`${m.id}: 생성 안 됨`); continue; }
  writeFileSync(join(RAW_DIR, `${m.id}.jpg`), buf);
  try {
    const keyed = await keyOut(buf);
    for (const size of [128, 64]) {
      writeFileSync(join(OUT_DIR, `${m.id}-${size}.png`), await normalize(keyed, size));
    }
    ok++;
    console.log(`  ${m.id} → 128/64 저장`);
  } catch (e) {
    failed.push(`${m.id}: ${String(e.message).slice(0, 120)}`);
  }
}

console.log(`\n완료 ${ok}/${todo.length}`);
if (failed.length) {
  console.log("실패:");
  for (const f of failed) console.log("  -", f);
}
process.exitCode = ok === todo.length && failed.length === 0 ? 0 : 1;

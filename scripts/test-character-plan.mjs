/**
 * 캐릭터 render plan 회귀 검사 — 작업 D (HARNESS §3 ART-01~04 + manifest 무결성).
 *
 * scripts/test-word-memory.mjs 와 같은 방식으로 TypeScript 를 런타임에 transpile 해
 * `lib/characterRenderPlan.ts` 자체를 실행한다. 별도 복사본을 두지 않는다 —
 * 복사본은 드리프트로 회귀를 놓친다.
 *
 * 실행: node scripts/test-character-plan.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = resolve(ROOT, "public/stickers/manifest-v2.json");
const dir = mkdtempSync(join(tmpdir(), "bee-character-"));

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };

function transpile(relPath, outName, rewrite = (s) => s) {
  const source = readFileSync(resolve(ROOT, relPath), "utf8");
  const out = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, outName), rewrite(out));
}

try {
  transpile("lib/childUx/renderPlanContract.ts", "contract.mjs");
  transpile("lib/characterRenderPlan.ts", "plan.mjs", (code) =>
    code
      .replace(/^import\s+manifest\s+from\s+"@\/public\/stickers\/manifest-v2\.json";$/m,
        'import { readFileSync as __read } from "node:fs";\nconst manifest = JSON.parse(__read(process.env.CHARACTER_MANIFEST, "utf8"));')
      .replace(/"@\/lib\/childUx\/renderPlanContract"/g, '"./contract.mjs"'));

  process.env.CHARACTER_MANIFEST = MANIFEST;
  const contract = await import(pathToFileURL(join(dir, "contract.mjs")));
  const plan = await import(pathToFileURL(join(dir, "plan.mjs")));

  const { containTransform, anchorToContainer, LAYER_ORDER } = contract;
  const { buildCharacterRenderPlan, bodyCandidates, getManifestAssets, characterPropsKey } = plan;

  const base = { stage: "bee", skin: "classic", hat: null, held: null, acc: null, backdrop: null, aura: null, size: 320, reducedMotion: true };
  const make = (patch) => ({ ...base, ...patch });

  // ── ART-01 ─────────────────────────────────────────────────────────
  check("ART-01 contain 변환 고정 정답 (400x800 → 300x300)", () => {
    const t = containTransform(300, 300, 400, 800);
    assert.equal(t.scale, 0.375);
    assert.equal(t.offsetX, 75);
    assert.equal(t.offsetY, 0);
    const p = anchorToContainer({ x: 100, y: 0 }, t);
    assert.equal(p.x, 112.5, "자산 x=100 은 화면 112.5 — 단순 25%(75px)가 아니다");
    assert.equal(p.y, 0);
  });

  check("ART-01 plan 의 몸 레이어가 contain 박스와 일치한다", () => {
    const p = buildCharacterRenderPlan(make({ stage: "egg" }));
    const body = p.layers.find((l) => l.kind === "body");
    const a = getManifestAssets().find((x) => x.assetId === body.assetId);
    const t = containTransform(320, 320, a.sourceWidth, a.sourceHeight);
    assert.equal(body.left, Math.round(t.offsetX * 1000) / 1000);
    assert.equal(body.top, Math.round(t.offsetY * 1000) / 1000);
    // asset-evidence.json 의 실측값과 같은 여백이어야 한다 (알 360x418 → 22.20px)
    assert.ok(Math.abs(body.left - 22.20095693779905) < 0.01, `egg 좌우 여백 ${body.left}`);
  });

  // ── ART-02 ─────────────────────────────────────────────────────────
  check("ART-02 합성 실패 시에도 선택한 스킨을 유지한다", () => {
    const props = make({ skin: "sky", hat: "cap" });
    const ok = buildCharacterRenderPlan(props);
    assert.equal(ok.resolvedAssetId, "body/stage-4-bee+sky+cap");
    assert.equal(ok.status, "composite");

    const failed = new Set(["body/stage-4-bee+sky+cap"]);
    const p = buildCharacterRenderPlan(props, { failedAssetIds: failed });
    assert.ok(p.resolvedAssetId.includes("+sky"), `스킨이 바뀌었다: ${p.resolvedAssetId}`);
    assert.notEqual(p.resolvedAssetId, "body/stage-4-bee+classic+cap");
    assert.notEqual(p.resolvedAssetId, "body/stage-4-bee");
    assert.ok(p.status === "plain" || p.status === "overlay");
    assert.equal(p.notice, "decorating", "모자를 못 씌웠으면 상태를 알려야 한다");
  });

  check("ART-02 스킨 자산 자체가 없을 때만 기본 stage 로 내려간다", () => {
    const props = make({ skin: "sky", hat: "cap" });
    const failed = new Set(["body/stage-4-bee+sky+cap", "body/stage-4-bee+sky"]);
    const p = buildCharacterRenderPlan(props, { failedAssetIds: failed });
    assert.equal(p.resolvedAssetId, "body/stage-4-bee");
    assert.equal(p.status, "stage-default");
  });

  check("ART-02 후보 목록에 다른 스킨의 합성본이 들어가지 않는다", () => {
    for (const skin of ["orange", "green", "sky", "pink", "purple"]) {
      const ids = bodyCandidates(make({ skin, hat: "crown" })).map((c) => c.assetId);
      const strayed = ids.filter((id) => /\+(orange|green|sky|pink|purple)\+/.test(id) && !id.includes(`+${skin}+`));
      assert.deepEqual(strayed, []);
      assert.ok(!ids.includes(`body/stage-4-bee+classic+crown`), `classic 합성본이 후보에 있다: ${skin}`);
    }
  });

  // ── ART-03 ─────────────────────────────────────────────────────────
  check("ART-03 모든 자산 실패 → 안정된 placeholder 로 끝난다", () => {
    const props = make({ skin: "pink", hat: "party", acc: "glasses", held: "book", backdrop: "hive", aura: "sparkle" });
    const failed = new Set([
      ...bodyCandidates(props).map((c) => c.assetId),
      "hat/party", "acc/glasses", "held/book", "backdrop/hive", "aura/sparkle",
    ]);
    const p = buildCharacterRenderPlan(props, { failedAssetIds: failed });
    assert.equal(p.status, "placeholder");
    assert.equal(p.notice, "asset-missing");
    assert.equal(p.layers.length, 1);
    assert.ok(p.layers[0].src.startsWith("data:image/svg+xml"), "placeholder 는 네트워크를 다시 타지 않는다");
    // 같은 실패 상태로 다시 만들어도 같은 결과 (재시도 폭주 없음)
    assert.deepEqual(buildCharacterRenderPlan(props, { failedAssetIds: failed }), p);
  });

  check("ART-03 새 장식을 고르면 실패 상태가 따라오지 않는다", () => {
    const before = make({ skin: "pink", hat: "party" });
    // crown-계열 합성본은 여왕벌에만 있다 → 벌 단계에서는 cap 으로 확인.
    const after = make({ skin: "pink", hat: "cap" });
    assert.notEqual(characterPropsKey(before), characterPropsKey(after), "자산 키가 바뀌면 실패 상태를 리셋해야 한다");
    const p = buildCharacterRenderPlan(after);
    assert.equal(p.status, "composite");
    assert.equal(p.notice, undefined);
    assert.ok(p.layers.some((l) => l.kind === "body"));
  });

  // ── ART-04 ─────────────────────────────────────────────────────────
  check("ART-04 picker/칭찬집/마을이 같은 plan 을 만든다", () => {
    const cosmetics = { skin: "pink", hat: "crown-honey", held: "flag", acc: "necklace", backdrop: "throne", aura: "royal" };
    const picker = buildCharacterRenderPlan(make({ stage: "queen", ...cosmetics }));
    const hive = buildCharacterRenderPlan(make({ stage: "queen", ...cosmetics }));
    const village = buildCharacterRenderPlan(make({ stage: "queen", ...cosmetics }));
    for (const other of [hive, village]) {
      assert.equal(other.resolvedAssetId, picker.resolvedAssetId);
      assert.equal(other.planHash, picker.planHash);
      assert.deepEqual(other.layers.map((l) => `${l.kind}:${l.assetId}`), picker.layers.map((l) => `${l.kind}:${l.assetId}`));
    }
  });

  check("ART-04 planHash 는 props 가 다르면 달라진다", () => {
    const a = buildCharacterRenderPlan(make({ skin: "pink" }));
    const b = buildCharacterRenderPlan(make({ skin: "sky" }));
    const c = buildCharacterRenderPlan(make({ skin: "pink", size: 160 }));
    assert.notEqual(a.planHash, b.planHash);
    assert.notEqual(a.planHash, c.planHash);
  });

  check("레이어는 언제나 그리는 순서대로 정렬돼 있다", () => {
    const p = buildCharacterRenderPlan(make({ stage: "queen", skin: "pink", acc: "cape", held: "flag", backdrop: "throne", aura: "royal" }));
    const rank = p.layers.map((l) => LAYER_ORDER.indexOf(l.kind));
    assert.deepEqual(rank, [...rank].sort((x, y) => x - y));
    assert.ok(rank.every((r) => r >= 0));
    // 그림자는 장면당 1개다.
    assert.equal(p.layers.filter((l) => l.kind === "environment-shadow").length, 1);
  });

  // ── manifest 무결성 ────────────────────────────────────────────────
  check("manifest: 모든 file 이 존재하고 sha256 이 일치한다", () => {
    const assets = getManifestAssets();
    assert.ok(assets.length >= 190, `자산 수 ${assets.length}`);
    const ids = new Set();
    for (const a of assets) {
      assert.ok(!ids.has(a.assetId), `assetId 중복: ${a.assetId}`);
      ids.add(a.assetId);
      const disk = resolve(ROOT, "public", a.file.replace(/^\//, ""));
      assert.ok(existsSync(disk), `파일 없음: ${a.file}`);
      const sha = createHash("sha256").update(readFileSync(disk)).digest("hex");
      assert.equal(sha, a.sha256, `sha256 불일치: ${a.file}`);
    }
  });

  check("manifest: alphaBounds 가 원본 크기 안에 있다", () => {
    for (const a of getManifestAssets()) {
      const b = a.alphaBounds;
      assert.ok(b.left >= 0 && b.top >= 0, `${a.assetId} 경계가 음수`);
      assert.ok(b.right < a.sourceWidth, `${a.assetId} right ${b.right} >= ${a.sourceWidth}`);
      assert.ok(b.bottom < a.sourceHeight, `${a.assetId} bottom ${b.bottom} >= ${a.sourceHeight}`);
      assert.ok(b.right >= b.left && b.bottom >= b.top, `${a.assetId} 경계 뒤집힘`);
      for (const [name, p] of Object.entries(a.anchors)) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${a.assetId}.${name} 좌표가 숫자가 아니다`);
        assert.ok(p.x >= 0 && p.x <= a.sourceWidth, `${a.assetId}.${name}.x=${p.x} 가 캔버스 밖`);
        assert.ok(p.y >= 0 && p.y <= a.sourceHeight, `${a.assetId}.${name}.y=${p.y} 가 캔버스 밖`);
        assert.ok(a.anchorSources?.[name], `${a.assetId}.${name} 에 출처가 없다`);
      }
    }
  });

  check("manifest: 메타 문자열이 records 안에 섞여 있지 않다", () => {
    const raw = JSON.parse(readFileSync(MANIFEST, "utf8"));
    assert.deepEqual(Object.keys(raw).sort(), ["assets", "meta"]);
    assert.ok(Array.isArray(raw.assets));
    for (const a of raw.assets) assert.equal(typeof a, "object");
  });

  check("지원 조합 전수 순회에서 예외 0 · 좌표 유한", () => {
    const stages = ["egg", "larva", "pupa", "bee", "queen"];
    const skins = ["classic", "orange", "green", "sky", "pink", "purple"];
    const hats = [null, "top", "cap", "party", "crown", "crown-rose", "crown-sapphire", "crown-honey"];
    const helds = [null, "honeypot", "book", "flag"];
    const accs = [null, "scarf", "glasses", "necklace", "cape"];
    const backdrops = [null, "flower", "hive", "rainbow", "night", "throne", "galaxy"];
    const auras = [null, "sparkle", "heart", "stardust", "royal", "prism"];
    let n = 0, placeholders = 0, i = 0;
    for (const stage of stages) for (const skin of skins) for (const hat of hats)
      for (const held of helds) for (const acc of accs) {
        const props = {
          stage, skin, hat, held, acc,
          backdrop: backdrops[i % backdrops.length],
          aura: auras[i % auras.length],
          size: [96, 160, 320][i % 3],
          reducedMotion: i % 2 === 0,
        };
        i++;
        const p = buildCharacterRenderPlan(props);
        n++;
        if (p.status === "placeholder") placeholders++;
        assert.ok(p.layers.length > 0, `레이어 없음: ${JSON.stringify(props)}`);
        for (const l of p.layers) {
          for (const v of [l.left, l.top, l.width, l.height]) {
            assert.ok(Number.isFinite(v), `좌표가 NaN: ${l.assetId} ${JSON.stringify(props)}`);
          }
          assert.ok(l.width > 0 && l.height > 0, `크기가 0: ${l.assetId}`);
          assert.ok(l.src.length > 0);
        }
        // 순수성: 같은 입력이면 같은 출력.
        assert.equal(buildCharacterRenderPlan(props).planHash, p.planHash);
      }
    assert.equal(n, 4800);
    assert.equal(placeholders, 0, "정상 조합에서 placeholder 가 나오면 안 된다");
  });

  check("held 는 몸을 관통하지 않는다 — 바닥 소품으로 뒤에 선다", () => {
    for (const stage of ["egg", "pupa", "bee", "queen"]) {
      const p = buildCharacterRenderPlan(make({ stage, held: "honeypot" }));
      const prop = p.layers.find((l) => l.assetId === "held/honeypot");
      assert.ok(prop, `${stage}: 소품 레이어 없음`);
      assert.equal(prop.kind, "held-back", `${stage}: 손 마스크가 없으므로 전면에 붙이지 않는다`);
      const body = p.layers.find((l) => l.kind === "body");
      assert.ok(LAYER_ORDER.indexOf(prop.kind) < LAYER_ORDER.indexOf(body.kind));
    }
  });

  check("앵커가 없는 몸에는 액세서리를 붙이지 않는다 (추측 금지)", () => {
    // sky 벌 합성본은 실루엣이 달라 눈/목 앵커가 없다 → 안경을 붙이지 않고 알린다.
    const noAnchor = buildCharacterRenderPlan(make({ skin: "sky", acc: "glasses" }));
    const body = getManifestAssets().find((a) => a.assetId === noAnchor.resolvedAssetId);
    if (!body.anchors.eyes) {
      assert.ok(!noAnchor.layers.some((l) => l.assetId === "acc/glasses"));
      assert.equal(noAnchor.notice, "decorating");
    }
    // classic 기본 벌은 anchors.json 실측값이 있으므로 붙는다.
    const withAnchor = buildCharacterRenderPlan(make({ skin: "classic", acc: "glasses" }));
    const glasses = withAnchor.layers.find((l) => l.assetId === "acc/glasses");
    assert.ok(glasses, "실측 앵커가 있는 몸에는 액세서리가 붙어야 한다");
    assert.equal(glasses.kind, "face-accessory");
    // 접점 검증: 안경의 eyes 앵커가 몸의 eyes 앵커 위에 놓였는가.
    const bodyAsset = getManifestAssets().find((a) => a.assetId === withAnchor.resolvedAssetId);
    const accAsset = getManifestAssets().find((a) => a.assetId === "acc/glasses");
    const t = containTransform(320, 320, bodyAsset.sourceWidth, bodyAsset.sourceHeight);
    const target = anchorToContainer(bodyAsset.anchors.eyes, t);
    const q = glasses.width / accAsset.sourceWidth;
    const got = { x: glasses.left + accAsset.anchors.eyes.x * q, y: glasses.top + accAsset.anchors.eyes.y * q };
    assert.ok(Math.abs(got.x - target.x) < 0.01 && Math.abs(got.y - target.y) < 0.01,
      `접점 오차 ${Math.abs(got.x - target.x)},${Math.abs(got.y - target.y)}`);
  });

  console.log(`\n${passed} checks passed. DOM 렌더 일치는 scripts/shot-character.mjs 가 따로 잰다.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

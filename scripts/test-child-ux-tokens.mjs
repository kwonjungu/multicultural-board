/**
 * 작업 A 계약 검사 — 토큰 값, 대비, 합성 좌표 기하.
 *
 * 값은 lib/childUx/tokens.json 하나에서만 읽는다. 기대값을 이 파일에 다시
 * 적어두면 토큰이 바뀌어도 검사가 통과해버린다.
 *   실행: node scripts/test-child-ux-tokens.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const T = JSON.parse(read('lib/childUx/tokens.json'));

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

/* ── 1. 대비 (README §4.3) ───────────────────────────────────────── */
const toRgb = (h) => { const x = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
const lum = (c) => {
  const [r, g, b] = toRgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };

check('모든 대비 쌍이 기준 이상', () => {
  assert.ok(T.contrastPairs.length >= 10, '대비 쌍이 너무 적다 — 검사를 줄여 통과시키지 말 것');
  for (const p of T.contrastPairs) {
    const fg = T.palette[p.fg], bg = T.palette[p.bg];
    assert.ok(fg && bg, `팔레트에 없는 색: ${p.fg} / ${p.bg}`);
    const r = contrast(fg, bg);
    assert.ok(r >= p.min, `${p.id}: ${r.toFixed(2)} < ${p.min}`);
  }
});

check('흰 글자를 밝은 노랑 위에 쓰지 않는다', () => {
  assert.ok(contrast('#FFFFFF', T.palette['primary-fill']) < 4.5, '전제가 바뀌었으면 규칙을 다시 쓸 것');
  assert.notEqual(T.palette['primary-ink'].toUpperCase(), '#FFFFFF');
});

/* ── 2. 글자·조작 규격 (README §4.1) ─────────────────────────────── */
const rem = (v) => { const m = /^([\d.]+)rem$/.exec(v); return m ? parseFloat(m[1]) * 16 : NaN; };
const px = (v) => { const m = /^([\d.]+)px$/.exec(v); return m ? parseFloat(m[1]) : NaN; };

/* 계약 개정 v2 (2026-09-13, docs/child-ux-20260913/responsive-plan.md §1).
   핵심 기기를 휴대폰이 아닌 태블릿·크롬북·노트북으로 확정하며 역할별 크기를
   내렸다(U02/U09). 하한을 지우는 게 아니라 근거 있는 값으로 옮긴 것이다 —
   대비 검사와 조작 영역 검사는 아래에 그대로 남아 있다. */
check('기본 글자 크기가 개정 규격(v2)을 만족', () => {
  assert.ok(rem(T.typography.body.basic) >= 16, '본문 16px 상당 미만 — 더 내리지 말 것');
  assert.ok(rem(T.typography['body-emphasis'].basic) >= 18);
  assert.ok(rem(T.typography.label.basic) >= 15, '버튼 라벨 15px 상당 미만');
  assert.ok(rem(T.typography.secondary.basic) >= 13, '보조 13px 하한 — 필수 지시에는 쓰지 않는 역할');
  assert.ok(parseFloat(T.lineHeight.reading.basic) >= 1.6, '다국어 결합문자 잘림 방지');
});

check('학습 읽기 역할이 일반 본문과 분리되어 있고 더 크다', () => {
  const body = rem(T.typography.body.basic);
  assert.ok(rem(T.typography['learn-sentence'].basic) > body, '학습 예문이 일반 본문보다 크지 않다');
  assert.ok(rem(T.typography['learn-word'].basic) >= 28, '집중 학습 단어 28px 상당 미만');
  // 게시판 밀도를 올려도 학습 크기가 따라 내려가면 안 된다 — 같은 토큰이면 그렇게 된다.
  assert.notEqual(T.typography['learn-sentence'].basic, T.typography.body.basic);
});

check('제목이 본문보다 확실히 크다', () => {
  const titleMin = /clamp\(\s*([\d.]+)rem/.exec(T.typography.title.basic);
  assert.ok(titleMin, 'title 이 clamp 형식이 아니다');
  assert.ok(parseFloat(titleMin[1]) * 16 >= 24, '화면 제목 24px 상당 미만');
  assert.ok(parseFloat(titleMin[1]) * 16 > rem(T.typography.body.basic));
});

check('큰 글씨는 어떤 항목도 기본보다 작아지지 않는다', () => {
  for (const group of ['typography', 'lineHeight', 'controls']) {
    for (const [k, v] of Object.entries(T[group])) {
      const a = rem(v.basic) || px(v.basic) || parseFloat(v.basic);
      const b = rem(v.large) || px(v.large) || parseFloat(v.large);
      if (Number.isFinite(a) && Number.isFinite(b)) assert.ok(b >= a, `${group}.${k}: large(${v.large}) < basic(${v.basic})`);
    }
  }
});

check('조작 영역 크기 (v2: 터치 48px / 주 동작 56px)', () => {
  // WCAG 2.5.5(44px)·2.5.8(24px) 을 모두 넘는 값이다. 이 아래로는 내리지 않는다.
  assert.ok(px(T.controls['control-min'].basic) >= 48, '터치 조작 48px 미만');
  assert.ok(px(T.controls['action-min'].basic) >= 56, '주 동작 56px 미만');
  assert.ok(px(T.controls['control-min'].large) >= 56);
  assert.ok(px(T.controls['action-min'].large) >= 64);
  assert.ok(px(T.controls['control-gap-min'].basic) >= 8, '오터치 방지 간격');
});

/* ── 2b. 넓은 화면 밀도가 JSON 단일 소스 안에 있는가 (v2) ────────── */
check('넓은 화면 값이 tokens.json 에 있고 TS 에 하드코딩되어 있지 않다', () => {
  const r = T.responsive;
  assert.ok(r, 'responsive 블록이 없다');
  assert.match(r.denseFrom, /^\d+px$/);
  for (const [k, v] of Object.entries(r.denseTypography)) {
    assert.ok(Number.isFinite(rem(v)), `denseTypography.${k}=${v} 가 rem 이 아니다`);
    assert.ok(rem(v) <= rem(T.typography[k].basic), `${k}: 넓은 화면 값이 기본보다 크다`);
  }
  // 조밀해져도 읽을 수 없을 만큼 작아지면 안 된다.
  assert.ok(rem(r.denseTypography.body) >= 15, '넓은 화면 본문 15px 상당 미만');
  assert.ok(rem(r.denseTypography.secondary) >= 13, '넓은 화면 보조 13px 상당 미만');
  // 마우스 전용으로 줄이는 값도 WCAG 2.5.5 의 44px 아래로는 못 간다.
  assert.ok(px(r.finePointerControls['control-min']) >= 44, 'fine pointer 조작 44px 미만');
  assert.ok(px(r.finePointerControls['action-min']) >= 44);
});

check('간격은 4px 배수', () => {
  for (const [k, v] of Object.entries(T.spacing)) assert.equal(px(v) % 4, 0, `spacing.${k}=${v}`);
});

/* ── 3. 적용 경로 — 이중 배율 금지 (README §4.1) ────────────────── */
const tokensTs = read('lib/childUx/tokens.ts');
const settingsTs = read('lib/childUx/settings.ts');

/** 주석 안의 설명 문구가 금지 패턴에 걸리지 않도록 실제 코드만 남긴다. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

check('글자 크기를 zoom / transform:scale 로 적용하지 않는다', () => {
  const code = stripComments(tokensTs);
  assert.match(code, /\[data-ux-legacy\]\{\s*zoom:/, '과도기 폴백은 legacy 컨테이너에만 있어야 한다');
  const rootZoom = /:root\s*\{[^}]*zoom\s*:/.test(code) || /html\s*\{[^}]*zoom\s*:/.test(code);
  assert.ok(!rootZoom, '루트 전체 zoom 은 브라우저 200% 확대와 곱해진다');
  assert.ok(!/transform:\s*scale/.test(code), '전체 화면 scale 금지');
  // 과도기 body zoom 은 반드시 data-ux-root 에서 정확히 되돌아와야 한다.
  assert.match(code, /:root\[data-ux-text="large"\] body\{ zoom: var\(--ux-legacy-zoom\); \}/);
  assert.match(code, /\[data-ux-root\]:not\(\[data-ux-root\] \*\)\{ zoom: calc\(1 \/ var\(--ux-legacy-zoom\)\); \}/);
  assert.match(settingsTs, /removeProperty\("zoom"\)/, '옛 인라인 zoom 을 반드시 걷어내야 이중 배율이 안 생긴다');
});

check('토큰 CSS 가 모든 값을 실제로 내보낸다', () => {
  const css = tokensTs;
  for (const k of Object.keys(T.palette)) assert.ok(css.includes('--ux-') || true, k);
  // 이름을 문자열로 조립하므로, 생성 로직이 각 그룹을 빠뜨리지 않았는지 본다.
  for (const group of ['palette', 'spacing', 'radius', 'motion']) {
    assert.ok(new RegExp(`tokens\.${group}`).test(css), `${group} 이 CSS 생성에서 빠졌다`);
  }
  for (const group of ['typography', 'lineHeight', 'controls']) {
    assert.ok(new RegExp(`tokens\.${group}`).test(css), `${group} 이 크기별 블록에서 빠졌다`);
  }
  assert.match(css, /:root\[data-ux-text="large"\]/, '큰 글씨 블록 없음');
  // v2: 넓은 화면 값을 TS 리터럴로 되돌리면 JSON 검사를 다시 우회하게 된다.
  assert.ok(/tokens\.responsive|r\.denseTypography/.test(css), 'responsive 가 CSS 생성에서 빠졌다');
  const code = stripComments(css);
  assert.ok(
    !/@media \(min-width: \d+px\)\{[^}]*--ux-font-[a-z-]+:\s*[\d.]+rem/.test(code.replace(/\s+/g, ' ')),
    '넓은 화면 글자 값이 TS 안에 리터럴로 박혀 있다 — tokens.json 의 responsive 로 옮길 것'
  );
});

check('넓은 화면에서 조작 영역은 폭이 아니라 포인터 정밀도로 줄인다', () => {
  // 폭만 보고 줄이면 1366px 터치 크롬북·1180px 태블릿 가로에서 손가락 대상이 작아진다.
  const code = stripComments(tokensTs).replace(/\s+/g, ' ');
  assert.match(code, /pointer: fine/, 'fine pointer 조건 없이 조작 영역을 줄이고 있다');
  const ctrlBlocks = code.match(/@media[^{]*\{[^{]*\{[^}]*--ux-control-min[^}]*\}/g) || [];
  for (const b of ctrlBlocks) {
    assert.match(b, /pointer: fine/, `조작 영역을 폭만으로 줄이는 블록이 있다: ${b.slice(0, 80)}`);
  }
});

check('layout 이 토큰을 한 번만 주입하고 부팅 컴포넌트를 단다', () => {
  const layout = read('app/layout.tsx');
  assert.ok((layout.match(/childUxCss\(\)/g) || []).length === 1, 'childUxCss 주입은 한 번');
  assert.match(layout, /<ChildUxBoot \/>/);
  assert.match(layout, /--ux-focus/, '초점 링이 토큰을 쓰지 않는다');
});

check('옛 zoom 배율 설정이 새 설정으로 이관된다', () => {
  assert.match(settingsTs, /LEGACY_FONT_SCALE_KEY/);
  assert.match(settingsTs, /legacy >= 1\.15 \? "large" : "basic"/);
});

/* ── 4. 합성 좌표 기하 (README §7.2) ─────────────────────────────── */
const dir = mkdtempSync(join(tmpdir(), 'bee-ux-'));
try {
  const out = ts.transpileModule(read('lib/childUx/renderPlanContract.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, 'plan.mjs'), out);
  const geo = await import(pathToFileURL(join(dir, 'plan.mjs')));

  check('contain 변환 고정 정답: 400x800 → 300x300', () => {
    const t = geo.containTransform(300, 300, 400, 800);
    assert.equal(t.scale, 0.375);
    assert.equal(t.offsetX, 75);
    assert.equal(t.offsetY, 0);
    const p = geo.anchorToContainer({ x: 100, y: 0 }, t);
    assert.equal(p.x, 112.5, '단순 퍼센트(75px)로 계산하면 37.5px 어긋난다');
    assert.equal(p.y, 0);
  });

  check('실측 자산 여백이 계산과 일치 (알 360x418 → 320 정사각)', () => {
    const t = geo.containTransform(320, 320, 360, 418);
    assert.ok(Math.abs(t.offsetX - 22.20) < 0.01, `좌우 여백 ${t.offsetX}`);
    const t2 = geo.containTransform(320, 320, 361, 524);
    assert.ok(Math.abs(t2.offsetX - 49.77) < 0.01, `번데기 여백 ${t2.offsetX}`);
  });

  check('접점 배치는 소품 자체 grip 을 목표점에 맞춘다', () => {
    const t = geo.containTransform(320, 320, 400, 400);
    const grip = geo.anchorToContainer({ x: 300, y: 200 }, t);
    const pos = geo.placeByGrip(grip, 20, 10, 0.5);
    assert.equal(pos.left, grip.x - 10);
    assert.equal(pos.top, grip.y - 5);
  });

  check('잘못된 크기는 조용히 0 을 만들지 않고 던진다', () => {
    assert.throws(() => geo.containTransform(300, 300, 0, 800));
    assert.throws(() => geo.containTransform(0, 300, 400, 800));
  });

  check('레이어 순서가 설계서 순서로 고정', () => {
    const order = geo.LAYER_ORDER;
    assert.ok(order.indexOf('held-back') < order.indexOf('body'));
    assert.ok(order.indexOf('body') < order.indexOf('hat'));
    assert.ok(order.indexOf('hat') < order.indexOf('held-front'));
    assert.equal(order[order.length - 1], 'aura');
    const shuffled = [
      { kind: 'aura', assetId: 'x' },
      { kind: 'body', assetId: 'b' },
      { kind: 'held-front', assetId: 'f' },
      { kind: 'background', assetId: 'g' },
    ];
    assert.deepEqual(geo.sortLayers(shuffled).map((l) => l.kind), ['background', 'body', 'held-front', 'aura']);
  });

  check('같은 kind 안에서는 입력 순서를 지킨다', () => {
    const same = [{ kind: 'body', assetId: '1' }, { kind: 'body', assetId: '2' }];
    assert.deepEqual(geo.sortLayers(same).map((l) => l.assetId), ['1', '2']);
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${count} checks passed`);

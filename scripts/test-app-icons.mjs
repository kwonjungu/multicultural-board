/**
 * U03 회귀 검사 — 03 에셋가이드 아이콘 6종이 실제로 연결되어 있는가.
 *
 *   실행: node scripts/test-app-icons.mjs
 *
 * test-child-ux-tokens.mjs 와 같은 형태: 값은 lib/uiIcons.ts 하나에서만
 * 읽고, 기대값을 여기 다시 적어두지 않는다(적어두면 소스가 바뀌어도 검사가
 * 통과해버린다). AppIcon.tsx·HomeHub.tsx 는 JSX 라 그대로 import 할 수
 * 없으므로, 주석을 걷어낸 소스 문자열에 대한 정규식 검사로 계약을 확인한다
 * (README 의 "블록 주석보다 줄 주석을 먼저 지운다" 함정을 그대로 따른다).
 */
import assert from 'node:assert/strict';
import { readFileSync, statSync, mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const abs = (p) => join(root, p);

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

/** 줄 주석을 먼저 지운다 — 블록 주석을 먼저 지우면 줄 주석 안의 "/*" 가
 *  블록 시작으로 오인되어 그 뒤 수십 줄이 통째로 사라진다. */
const stripComments = (src) => src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/* ── 0. lib/uiIcons.ts 를 실제로 실행해 테스트한다 ───────────────── */
const dir = mkdtempSync(join(tmpdir(), 'bee-ui-icons-'));
let mod;
try {
  const out = ts.transpileModule(read('lib/uiIcons.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, 'uiIcons.mjs'), out);
  mod = await import(pathToFileURL(join(dir, 'uiIcons.mjs')));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const EXPECTED_IDS = ['globe', 'speaker', 'storybook', 'friends', 'praise', 'enter'];

check('03 에셋가이드의 6개 id 와 정확히 같다 (더 많지도 적지도 않다)', () => {
  const ids = mod.UI_ICONS.map((i) => i.id);
  assert.deepEqual([...ids].sort(), [...EXPECTED_IDS].sort());
});

check('isUiIconId 가 allowlist 밖 값을 거부한다', () => {
  for (const id of EXPECTED_IDS) assert.ok(mod.isUiIconId(id), `${id} 는 통과해야 한다`);
  for (const bad of ['bee', 'globe2', 'GLOBE', ' globe', '', 123, null, undefined, {}, ['globe']]) {
    assert.ok(!mod.isUiIconId(bad), `${JSON.stringify(bad)} 는 거부되어야 한다`);
  }
});

check('uiIconAssetPath 가 allowlist 밖 id 에서 던진다(조용히 넘어가지 않는다)', () => {
  for (const bad of ['bee', 'globe2', '', 'ANIMALS']) {
    assert.throws(() => mod.uiIconAssetPath(bad), `"${bad}" 에서 던지지 않는다`);
  }
});

check('uiIconAssetPath 는 항상 파생본(64/128) 경로만 돌려주고 원본을 돌려주지 않는다', () => {
  for (const id of EXPECTED_IDS) {
    for (const size of [1, 24, 32, 64, 65, 100, 128, 500, -5, 0]) {
      const p = mod.uiIconAssetPath(id, size);
      assert.match(p, /^\/ui-icons\/v1\/[a-z]+-(64|128)\.png$/, `${id}@${size} → ${p}`);
      assert.ok(p.includes(`/${id}-`), `${p} 가 ${id} 를 가리키지 않는다`);
    }
    // 크기를 아예 안 주는 기본 호출도 파생본이어야 한다.
    assert.match(mod.uiIconAssetPath(id), /-(64|128)\.png$/);
  }
});

check('uiIconEmoji 가 모든 id 에 서로 다른 폴백 이모지를 준다', () => {
  const emojis = EXPECTED_IDS.map((id) => mod.uiIconEmoji(id));
  assert.equal(new Set(emojis).size, emojis.length, '이모지가 겹치면 폴백에서 의미를 구분할 수 없다');
  for (const e of emojis) assert.ok(e && e.length > 0);
});

/* ── 1. public/ui-icons/v1 에 manifest 가 말하는 파일이 실제로 있다 ── */

/**
 * 원본(500KB~930KB)은 **public 에 두지 않는다.** 코드가 참조하는 것은 -64/-128
 * 파생본뿐이라(uiIconAssetPath 검사 참조) 원본을 public 에 두면 아무도 쓰지
 * 않는 4.6MB 가 배포 번들에 실린다. 원본의 보관처는 설계 패키지
 * `꿀벌소통창_Opus_실행설계_20260913/assets/` 다 (03 에셋가이드: "원본 PNG 는
 * 원본 폴더에 보존").
 */
check('원본 PNG 를 public 에 두지 않는다 (파생본만 배포된다)', () => {
  for (const id of EXPECTED_IDS) {
    const p = abs(`public/ui-icons/v1/${id}.png`);
    assert.ok(!existsSync(p),
      `원본이 public 에 있다: ${p} — 코드가 참조하지 않는 무게다. 파생본만 남길 것`);
  }
  // 이 폴더에 남아도 되는 **파일**은 파생본뿐이다. 하위 폴더(animals 등)는
  // 각자의 검사가 따로 있으므로(예: scripts/test-animal-assets.mjs) 세지 않는다.
  const stray = readdirSync(abs('public/ui-icons/v1'), { withFileTypes: true })
    .filter((e) => e.isFile() && !/-(64|128)\.png$/.test(e.name))
    .map((e) => e.name);
  assert.deepEqual(stray, [], `파생본이 아닌 파일이 있다: ${stray.join(', ')}`);
});

check('64/128 파생본이 실제로 존재하고, 작고, 0 바이트가 아니다', () => {
  for (const id of EXPECTED_IDS) {
    for (const size of mod.UI_ICON_SIZES) {
      const p = abs(`public/ui-icons/v1/${id}-${size}.png`);
      assert.ok(existsSync(p), `파생본 없음: ${p}`);
      const s = statSync(p).size;
      assert.ok(s > 0, `${id}-${size}.png 크기 0`);
      // 32px 아이콘에 900KB 원본을 그대로 내려받는 사고를 막는 상한.
      assert.ok(s < 50_000, `${id}-${size}.png(${s}B) 가 파생본치고 너무 크다`);
    }
    // 64px 이 128px 보다 커지는 이상 현상(잘못된 리사이즈)이 없는지.
    const s64 = statSync(abs(`public/ui-icons/v1/${id}-64.png`)).size;
    const s128 = statSync(abs(`public/ui-icons/v1/${id}-128.png`)).size;
    assert.ok(s64 <= s128, `${id}: 64px(${s64}B) 이 128px(${s128}B) 보다 크다`);
  }
});

/* ── 2. AppIcon.tsx — fallback 경로가 실제로 코드에 있다 ─────────── */
const appIconSrc = stripComments(read('components/ui/child/AppIcon.tsx'));

check('AppIcon 이 lib/uiIcons.ts 의 allowlist 를 실제로 쓴다', () => {
  assert.match(appIconSrc, /isUiIconId\(/, 'allowlist 검증 호출이 없다');
  assert.match(appIconSrc, /from ["']@\/lib\/uiIcons["']/);
});

check('AppIcon 에 실패 상태와 onError 폴백 경로가 있다(AnimalArt 패턴)', () => {
  assert.match(appIconSrc, /useState/, 'failed 상태가 없다');
  assert.match(appIconSrc, /onError=\{/, 'img onError 핸들러가 없다');
  assert.match(appIconSrc, /setFailed\(true\)/, 'onError 가 실패 상태로 안 바뀐다');
});

check('AppIcon 이 실패 시(또는 잘못된 id 일 때) 깨진 이미지가 아니라 이모지로 내려온다', () => {
  // failed || !valid 분기에서 <img> 가 아니라 이모지 <span> 을 돌려줘야 한다.
  const fallbackBranch = /if \(failed \|\| !valid\) \{[\s\S]*?\n  \}/.exec(appIconSrc);
  assert.ok(fallbackBranch, 'failed/!valid 분기를 찾지 못함');
  assert.doesNotMatch(fallbackBranch[0], /<img/, '폴백 분기에 <img> 가 남아있으면 깨진 이미지가 뜬다');
  assert.match(fallbackBranch[0], /\{emoji\}/, '폴백이 이모지를 렌더하지 않는다');
});

check('AppIcon 이 decorative 기본값 true 를 유지한다(라벨과 함께 쓰는 것을 전제)', () => {
  assert.match(appIconSrc, /decorative\s*=\s*true/, 'decorative 기본값이 true 가 아니다');
});

/* ── 3. HomeHub — 아이콘만 두고 라벨을 지우지 않았다 ─────────────── */
const homeHubSrc = stripComments(read('components/HomeHub.tsx'));

/* 한때 홈 활동 타일 4개를 이 아이콘들로 바꿨다가, 사용자가 "홈은 아이콘
   원래거 그대로 둬" 라고 해서 되돌렸다(2026-09-13). 아이콘 기반 시설
   (manifest·AppIcon·파생본)은 남겨 두되 **홈에는 쓰지 않는다** — 다시 몰래
   끼워 넣지 않도록 여기서 못 박는다. */
check('홈 활동 타일은 기존 마스코트를 그대로 쓴다 (아이콘으로 바꾸지 않는다)', () => {
  assert.doesNotMatch(homeHubSrc, /<AppIcon/,
    '홈이 다시 AppIcon 을 쓰고 있다 — 사용자가 원래 마스코트를 유지하라고 했다');
  assert.doesNotMatch(homeHubSrc, /icon:\s*"(globe|storybook|praise|friends|speaker|enter)"/,
    '홈 ACTIVITIES 에 아이콘 매핑이 다시 들어왔다');
  assert.match(homeHubSrc, /className="hub-point-bee"/, '마스코트 렌더가 사라졌다');
});

check('활동 타일에 글자 라벨이 항상 붙어 있다', () => {
  const mapBlock = /\{ACTIVITIES\.map\([\s\S]*?\)\)\}/.exec(homeHubSrc);
  assert.ok(mapBlock, 'ACTIVITIES.map 렌더 블록을 찾지 못함');
  assert.match(mapBlock[0], /hub-point-label/, '활동 타일에 라벨이 없다');
});

/* ── 4. U03 실제 연결 — speaker 는 듣기 버튼, enter 는 입장 CTA ───── */
const cardSrc = stripComments(read('components/PadletCard.tsx'));
const rootSrc = stripComments(read('app/page.tsx'));

check('듣기 버튼이 speaker 아이콘을 쓴다', () => {
  assert.ok(cardSrc.includes('<AppIcon name="speaker"'), '듣기에 speaker 아이콘이 없다');
  assert.ok(cardSrc.includes('from "./ui/child/AppIcon"'), 'AppIcon import 가 없다');
});

check('입장 CTA 가 enter 아이콘을 쓴다', () => {
  assert.ok(rootSrc.includes('<AppIcon name="enter"'), '입장 CTA 에 enter 아이콘이 없다');
});

check('아이콘을 붙여도 글자 라벨을 지우지 않았다', () => {
  /* 아이콘만 남기면 뜻이 모호해진다(04 문서). 두 자리 모두 글자가 함께 있어야 한다. */
  assert.ok(rootSrc.includes('들어가기'), '입장 CTA 의 글자가 사라졌다');
  assert.ok(cardSrc.includes('cardListen'), '듣기 버튼의 라벨 키가 사라졌다');
});

check('아이콘 기반 시설은 남아 있다 (다음에 쓸 자리를 위해)', () => {
  // 홈에서 뺐다고 manifest·컴포넌트·파생본까지 지우면 다음 연결 때 처음부터
  // 다시 만들어야 한다. 자산과 계약은 유지한다.
  assert.ok(existsSync(abs('lib/uiIcons.ts')), 'uiIcons manifest 가 사라졌다');
  assert.ok(existsSync(abs('components/ui/child/AppIcon.tsx')), 'AppIcon 이 사라졌다');
});

console.log(`\n${count} checks passed`);

/**
 * U11 지구본 크기/반응형 회귀 검사 — 정적.
 *
 * 실측(before/after 구체 지름 비율, canvas=stage 일치, 클릭 좌표, 회전/줌 보존)은
 * 브라우저가 필요해 여기서 하지 않는다 — reports/audit-20260913/ 의 before-u11 /
 * after-u11 measurements.json 과 스크린샷이 그 증거다. 여기서는 07 계약이 코드에서
 * 되돌려지지 않았는지만 기계로 잡는다.
 *   실행: node scripts/test-globe-stage.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'components/games/GlobeQuest.tsx'), 'utf8');

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

/**
 * 주석 속 설명이 금지 패턴에 걸리지 않게 코드만 남긴다.
 * **줄 주석을 먼저 지운다** — 블록 주석을 먼저 지우면 줄 주석 안의 `/*` 가
 * 블록 시작으로 오인돼 다음 `*​/` 까지(수십 줄) 통째로 사라진다.
 */
const code = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const c = code(src);

/* ── 1. 기기별 고정 camera distance 를 늘어놓지 않는다 ─────────────── */

check('camera 초기 위치가 (0,60,320) 같은 고정 리터럴로 곧장 set 되지 않는다', () => {
  assert.ok(!/camera\.position\.set\(\s*0\s*,\s*60\s*,\s*320\s*\)/.test(c),
    '카메라 위치가 여전히 기기와 무관한 고정 좌표로 박혀 있다');
});

check('OrbitControls min/maxDistance 가 150/480 같은 리터럴로 고정되지 않는다', () => {
  assert.ok(!/controls\.minDistance\s*=\s*150\b/.test(c), 'minDistance 가 고정 리터럴 150 이다');
  assert.ok(!/controls\.maxDistance\s*=\s*480\b/.test(c), 'maxDistance 가 고정 리터럴 480 이다');
  // 대신 fitDistance 로부터 매번 계산되어야 한다.
  assert.match(c, /controls\.minDistance\s*=\s*fitDistance\s*\*/, 'minDistance 가 fitDistance 로부터 계산되지 않는다');
  assert.match(c, /controls\.maxDistance\s*=\s*fitDistance\s*\*/, 'maxDistance 가 fitDistance 로부터 계산되지 않는다');
});

check('구를 담는 거리를 stage w/h 로부터 계산하는 함수가 있다(기기별 표 대신 공식)', () => {
  assert.match(c, /function\s+fitDistanceForFraction\s*\([^)]*\bR\b[^)]*\bf\b[^)]*\bw\b[^)]*\bh\b[^)]*\)/,
    'fitDistanceForFraction(R, f, w, h, …) 형태의 계산 함수가 없다');
  // 가로/세로 중 짧은 변의 half-FOV 를 쓰는지 — w>=h 분기가 있어야 "제한되는 쪽" 선택이다.
  assert.match(c, /w\s*>=\s*h\s*\?\s*tanHalfVFov\s*:\s*tanHalfVFov\s*\*\s*\(\s*w\s*\/\s*h\s*\)/,
    '짧은 변 쪽 FOV 를 선택하는 분기가 없다');
});

check('마커(핀)가 잘리지 않도록 별도 안전 반지름/비율로 거리를 한 번 더 검사한다', () => {
  assert.match(c, /MARKER_OUTER_R/, '핀 외곽 반지름 상수가 없다');
  assert.match(c, /MARKER_SAFE_FRACTION/, '핀 안전 비율 상수가 없다');
  assert.match(c, /Math\.max\(\s*dGlobe\s*,\s*dMarker\s*\)/,
    '구체 목표와 마커 안전 거리 중 더 제한적인(먼) 쪽을 택하지 않는다 — 마커가 잘릴 수 있다');
});

check('디바이스별 고정 distance 표(픽셀 값 나열)가 없다', () => {
  // 흔한 안티패턴: { tablet: 300, laptop: 400, ... } 처럼 기기명 키를 가진 distance 맵.
  assert.ok(!/(tablet|laptop|chromebook|desktop|phone)\s*:\s*\d{2,4}\s*[,}]/i.test(c),
    '기기 이름별 고정 distance 표가 발견됐다');
});

/* ── 2. ResizeObserver 로 실제 stage 크기 변화에 대응한다 ──────────── */

check('ResizeObserver 를 사용하고 stage 엘리먼트를 관찰한다', () => {
  assert.match(c, /new ResizeObserver\(/, 'ResizeObserver 를 쓰지 않는다');
  assert.match(c, /ro\.observe\(\s*stageEl\s*\)/, 'stage 엘리먼트를 관찰하지 않는다');
});

check('window resize 이벤트 리스너에만 의존하지 않는다', () => {
  // 예전 버그: window resize 만 구독 — 정보 패널 열기/부모 grid 재배치/큰 글씨에는 반응하지 않았다.
  assert.ok(!/window\.addEventListener\(\s*["']resize["']/.test(c),
    'window resize 리스너가 남아있다 — ResizeObserver 로 대체했어야 한다');
});

/* ── 3. 0 크기 가드 ────────────────────────────────────────────────── */

check('width/height 가 0 이하일 때 나누기/렌더를 피한다', () => {
  assert.match(c, /!\(w > 0\)\s*\|\|\s*!\(h > 0\)|w\s*<=\s*0\s*\|\|\s*h\s*<=\s*0/,
    '0(또는 음수) 크기 가드가 없다 — camera.aspect = w/h 가 Infinity/NaN 이 될 수 있다');
  assert.match(c, /hasValidSize/, '유효 크기 여부를 추적하는 플래그가 없다');
  assert.match(c, /if\s*\(\s*hasValidSize\s*\)\s*renderer\.render/,
    '0 크기일 때도 renderer.render 를 계속 호출한다');
});

/* ── 4. observer/RAF/renderer cleanup ─────────────────────────────── */

check('effect cleanup 이 ResizeObserver·RAF·컨트롤·렌더러를 모두 정리한다', () => {
  assert.match(c, /ro\.disconnect\(\)/, 'ResizeObserver 를 disconnect 하지 않는다');
  assert.match(c, /cancelAnimationFrame\(\s*raf\s*\)/, 'requestAnimationFrame 을 취소하지 않는다');
  assert.match(c, /controls\.dispose\(\)/, 'OrbitControls 를 dispose 하지 않는다');
  assert.match(c, /renderer\.dispose\(\)/, 'renderer 를 dispose 하지 않는다');
});

/* ── 5. canvas 를 CSS 로만 늘려 흐릿해지는 수정이 아니다 ──────────── */

check('renderer.setSize 가 실측 w/h 로 호출되어 drawing buffer 자체를 갱신한다', () => {
  const sigMatch = /function\s+applySize\s*\([^)]*\bw\b[^)]*\bh\b[^)]*\)\s*\{/.exec(c);
  assert.ok(sigMatch, 'applySize(w, h) 함수가 없다');
  // 중괄호 깊이를 세어 applySize 함수 몸통만 정확히 잘라낸다 — 안에 if 블록이
  // 중첩돼 있어 "첫 닫는 중괄호까지"로 자르면 renderer.setSize 호출 이전에 끊긴다.
  const bodyStart = sigMatch.index + sigMatch[0].length;
  let depth = 1, i = bodyStart;
  while (i < c.length && depth > 0) {
    if (c[i] === '{') depth++;
    else if (c[i] === '}') depth--;
    i++;
  }
  const applyBody = c.slice(bodyStart, i - 1);
  assert.match(applyBody, /renderer\.setSize\(\s*w\s*,\s*h\s*\)/,
    'applySize 안에서 renderer.setSize(w, h) 를 호출하지 않는다 — CSS 크기만 바뀌고 실제 drawing buffer 는 그대로일 수 있다');
  assert.match(applyBody, /camera\.aspect\s*=\s*w\s*\/\s*h/, 'applySize 가 camera.aspect 를 갱신하지 않는다');
  assert.match(applyBody, /camera\.updateProjectionMatrix\(\)/, 'applySize 가 updateProjectionMatrix 를 호출하지 않는다');
});

check('mount div 가 부모의 height:100% 상속에 기대지 않고 absolute+inset:0 로 채운다', () => {
  // 실측(before-u11): mount 의 height:100% 는 flex(auto-height) 조상 아래서 신뢰할 수
  // 없었다 — 그 결과 mount 가 canvas 기본 크기(150px)에 갇혔다. absolute+inset:0 는
  // 부모(.gq-stage, position:relative)의 실제 box 를 직접 기준으로 삼아 이를 피한다.
  assert.match(c, /position:\s*["']absolute["'],\s*inset:\s*0/, 'mount div 가 absolute+inset:0 로 채우지 않는다');
  assert.ok(!/style=\{\{\s*width:\s*["']100%["'],\s*height:\s*["']100%["']/.test(c),
    'mount div 가 여전히 percentage width/height 에 기대고 있다');
});

check('DPR 상한은 화질 조절용이지 표시 크기 축소 수단이 아니다', () => {
  assert.match(c, /setPixelRatio\(\s*Math\.min\(\s*window\.devicePixelRatio\s*,\s*2\s*\)\s*\)/,
    'DPR 상한(성능/화질용) 설정이 없다');
});

/* ── 6. 사용자 조작과 기본 fit 을 분리 — resize 때마다 원위치로 덮지 않는다 ── */

check('사용자가 조작했으면 resize 로 카메라 위치를 원위치시키지 않는다', () => {
  assert.match(c, /userAdjusted/, 'userAdjusted 같은 조작 여부 플래그가 없다');
  assert.match(c, /onStart\s*=\s*\(\)\s*=>\s*\{\s*userAdjusted\s*=\s*true/,
    '드래그/줌 시작 시 userAdjusted 를 세우지 않는다');
  assert.match(c, /if\s*\(\s*!userAdjusted\s*\)\s*\{\s*\n?\s*camera\.position\.copy/,
    'applySize 가 사용자 조작 여부와 무관하게 항상 카메라 위치를 덮어쓴다');
});

/* ── 7. 클릭 좌표는 canvas 의 최신 boundingClientRect 기준 ────────── */

check('클릭(raycast) 이 매번 최신 getBoundingClientRect 를 읽는다', () => {
  assert.match(c, /onPointerUp\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]{0,400}getBoundingClientRect\(\)/,
    'pointerup 핸들러가 클릭 시점에 boundingClientRect 를 다시 읽지 않는다 — 캐시된 rect 를 쓰면 리사이즈 후 어긋난다');
});

/* ── 8. .gq-stage 가 실제 남는 공간을 받도록 .gq-shell 이 정의된 높이를 가진다 ── */

check('.gq-shell 이 height:100% 로 부모의 실제 남는 높이를 물려받는다', () => {
  const shellBlock = /\.gq-shell\{([^}]*)\}/.exec(c)?.[1] ?? '';
  assert.match(shellBlock, /height:\s*100%/,
    '.gq-shell 에 height:100% 가 없다 — flex:1 인 .gq-stage 가 분배받을 여유 공간이 생기지 않는다(auto-height 함정)');
});

check('.gq-stage 가 position:relative 로 mount 의 absolute 앵커를 제공한다', () => {
  const stageBlock = /\.gq-stage\{([^}]*)\}/.exec(c)?.[1] ?? '';
  assert.match(stageBlock, /position:\s*relative/, '.gq-stage 에 position:relative 가 없다');
  assert.match(stageBlock, /min-height:\s*clamp\(/,
    '.gq-stage 의 min-height 바닥값이 없다 — 저높이/큰 글씨에서 stage 가 0 으로 짜부라질 수 있다');
});

/* ── 9. U11b(07 배치 계약): 나라 카드가 stage 를 상시 덮는 절대배치 오버레이가
   아니라 stage 와 정상 흐름으로 나란한 패널이다 ─────────────────────────── */

function extractBalancedBlock(text, startIndex) {
  const braceIdx = text.indexOf('{', startIndex);
  if (braceIdx === -1) return null;
  let depth = 1, i = braceIdx + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    i++;
  }
  return text.slice(braceIdx + 1, i - 1);
}

check('예전 .gq-cardlayer(하단 절대배치 시트)가 더 남아있지 않다 — panel 로 대체됐다', () => {
  assert.ok(!/\.gq-cardlayer/.test(c),
    '.gq-cardlayer 가 여전히 있다 — 나라 카드가 아직 stage 를 덮는 절대배치 오버레이일 수 있다');
});

check('GlobeShell 이 상시 정보는 panel(정상 흐름), 스쳐가는 토스트는 overlay(절대배치)로 분리한다', () => {
  // prop 이 더 늘어나는 것은 허용한다(예: panelPlaceholder — 2열에서 옆 칸을 미리
  // 비워 두어 나라를 누른 순간 지구본이 줄지 않게 하는 자리표시자). 계약은
  // "topBar/children/overlay/panel 네 경로가 그대로 있는가" 이지 prop 개수가 아니다.
  assert.match(c, /function\s+GlobeShell\s*\(\s*\{\s*topBar\s*,\s*children\s*,\s*overlay\s*,\s*panel\s*[,}]/,
    'GlobeShell 이 panel prop 을 받지 않는다');
  assert.match(c, /<div className="gq-stagewrap">/, '.gq-stagewrap 컨테이너가 없다');
});

check('ExploreMode 의 나라 카드가 overlay 가 아니라 panel 로 전달된다', () => {
  assert.match(c, /panel=\{selected\s*&&/, 'ExploreMode 가 선택된 나라 카드를 panel 로 넘기지 않는다');
  // 게임하기 모드의 정오답 토스트는 여전히 stage 공간을 뺏지 않는 절대배치 overlay 여야 한다.
  assert.match(c, /overlay=\{flash\s*&&/, 'QuizMode 의 플래시 토스트가 overlay 경로에서 빠졌다 — 절대배치를 잃으면 안 된다');
});

check('.gq-panel 이 position:absolute 로 stage 위를 덮지 않는다(정상 흐름 배치)', () => {
  const panelBlock = /\.gq-panel\{([^}]*)\}/.exec(c)?.[1] ?? '';
  assert.ok(panelBlock.length > 0, '.gq-panel{...} 기본 규칙을 찾지 못했다');
  assert.ok(!/position:\s*absolute/.test(panelBlock),
    '.gq-panel 이 position:absolute 다 — stage(지구본) 위를 상시 덮는 옛 방식으로 되돌아갔다');
});

check('.gq-stagewrap 이 flex 컨테이너라 패널이 나타나면 stage 실측 크기가 실제로 바뀐다', () => {
  const wrapBlock = /\.gq-stagewrap\{([^}]*)\}/.exec(c)?.[1] ?? '';
  assert.match(wrapBlock, /display:\s*flex/,
    '.gq-stagewrap 이 flex 가 아니다 — 패널이 나타나도 stage 폭/높이가 반응하지 않을 수 있다(ResizeObserver 가 관찰하는 .gq-stage 크기 자체가 안 바뀜)');
});

check('폭이 충분하면 컨테이너 쿼리로 stage 옆에 패널을 두고, 패널 폭을 제한한다(07: "정보 패널 폭은 제한")', () => {
  const idx = c.indexOf('@container');
  assert.ok(idx !== -1, '@container 규칙이 없다 — 07 이 요구하는, 실제 stage 공간 기준(뷰포트가 아니라) 폭 판단이 없다');
  const wideBlock = extractBalancedBlock(c, idx) ?? '';
  assert.match(wideBlock, /\.gq-stagewrap\{[^}]*flex-direction:\s*row/,
    '넓을 때 .gq-stagewrap 을 가로(row)로 바꿔 stage 옆에 패널을 두는 규칙이 없다');
  // 상한이 있으면 된다 — min(…px, …) / clamp(…, …, …px) / max-width:…px 모두 인정.
  // clamp 는 하한(좁은 크롬북에서 안 찌그러짐)까지 같이 정하므로 오히려 낫다.
  assert.match(wideBlock, /\.gq-panel\{[^}]*(?:width|max-width):\s*(?:min\(\s*\d+px|clamp\([^)]*\d+px\s*\)|\d+px)/,
    '넓을 때 .gq-panel 폭이 제한되지 않는다 — "정보 패널 폭은 제한" 계약 위반(패널이 stage 를 밀어낼 수 있다)');
});

check('.gq-shell 이 container-type 을 선언해 뷰포트가 아니라 실제 자기 폭으로 배치를 판단한다', () => {
  const shellBlock = /\.gq-shell\{([^}]*)\}/.exec(c)?.[1] ?? '';
  assert.match(shellBlock, /container-type:\s*inline-size/,
    '.gq-shell 에 container-type:inline-size 가 없다 — @container 규칙이 뷰포트가 아닌 셸 자신의 실제 폭을 기준으로 판단하지 못한다(나중에 GameRoom 이 셸을 더 좁게 배치해도 반응 못 함)');
});

console.log(`\n${count} checks passed`);

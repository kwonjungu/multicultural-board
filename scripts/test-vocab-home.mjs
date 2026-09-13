/**
 * U07 단어 배우기 홈 계약 검사 — 정적.
 *
 * DOM 테스트가 아니다. 실제 열 수·페이지 높이는
 * `node scripts/audit/measure-density.mjs` 와 shot-baseline 이 브라우저에서 잰다.
 * 여기서는 사용자 요구(U07)가 코드에서 되돌려지지 않았는지만 기계로 잡는다.
 *   실행: node scripts/test-vocab-home.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const hub = read('components/VocabHub.tsx');
const fixturePage = read('app/ux-fixture/vocab/page.tsx');
const fixture = read('app/ux-fixture/vocab/fixture.tsx');

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

/**
 * 주석 속 설명이 금지 패턴에 걸리지 않게 코드만 남긴다.
 *
 * **줄 주석을 먼저 지운다.** 저장소의 다른 검사들은 블록 주석을 먼저 지우는데,
 * 그러면 `// … /api/* 는 canned 응답` 처럼 줄 주석 안에 `/*` 가 있을 때 그것이
 * 블록 주석의 시작으로 오인돼 다음 `*​/` 까지(수십 줄) 통째로 사라진다.
 * 실제로 이 검사를 쓰다 fixture 의 roomCode 선언이 통째로 잘려 오탐이 났다.
 */
const code = (src) => src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const hc = code(hub);

/* ── 진도 0 학생에게 0 으로 채운 상태를 먼저 보여주지 않는다 ───────── */

check('진도 유무 판단이 존재하고 HUD·진행표시·챌린지를 게이트한다', () => {
  assert.match(hc, /const hasAnyProgress\s*=/, 'hasAnyProgress 판단이 없다');
  assert.match(hc, /\{hasAnyProgress && <LearnerHUD/, 'HUD 가 진도 없이도 그려진다');
  assert.match(hc, /hasAnyProgress && \(\s*<div data-ux-role="secondary"/,
    '헤더 진행 표시(0/100 완료)가 진도 없이도 그려진다');
  assert.match(hc, /hasOwnSource\s*=\s*boardIds\.length > 0 \|\| hasAnyProgress/,
    '챌린지가 내 단어 출처 유무로 게이트되지 않는다');
});

check('낼 문제가 없으면 챌린지를 아예 그리지 않는다', () => {
  // 예전 버그: q.length > 0 가드가 클릭 시점에만 있어서, 0문제여도 배너는
  // 계속 보이고 눌러도 조용히 아무 일이 없었다.
  assert.match(hc, /if \(items\.length === 0\) return null;/,
    '0문제일 때 배너를 그리지 않는 가드가 없다');
  const clickOnlyGuard = /const startDailyChallenge[\s\S]{0,400}?if \(q\.length > 0\)/.test(hc);
  assert.ok(!clickOnlyGuard, '클릭 시점에만 검사하는 옛 가드가 남아 있다');
});

/* ── 첫 화면에서 학습이 장식·상태와 경쟁하지 않는다 ───────────────── */

check('챌린지 배너가 무한 애니메이션과 그라디언트로 강조되지 않는다', () => {
  for (const re of [/dailyChallengePulse/, /dailyChallengeSparkle/]) {
    assert.ok(!re.test(hub), `무한 강조 애니메이션이 남아 있다: ${re}`);
  }
  assert.ok(!/linear-gradient\(135deg, #F97316, #DB2777\)/.test(hc),
    '주황→핑크 그라디언트 배너가 남아 있다');
  assert.ok(!/✨ 도전!/.test(hub), "반짝이는 '도전!' 리본이 남아 있다");
});

/* ── 폭이 넓어지면 학습 내용이 더 보인다 (04 §5) ─────────────────── */

check('레슨 트리가 폭에 따라 열 수를 바꾼다', () => {
  assert.match(hc, /SKILL_TREE_CSS/, '레슨 트리 반응형 CSS 가 없다');
  assert.match(hc, /className="vh-lessons"/, '레슨 격자 클래스가 붙지 않았다');
  assert.match(hc, /className="vh-tree"/, '트리 컨테이너 클래스가 붙지 않았다');
  // 폭 고정 520px 로 되돌아가면 "세로로 늘린 휴대폰" 이 다시 된다.
  assert.ok(!/maxWidth: 520, margin: "0 auto", padding: "0 4px 30px"/.test(hc),
    '트리 컨테이너가 520px 고정으로 되돌아갔다');
  for (const bp of ['640px', '960px']) {
    assert.ok(hc.includes(`min-width:${bp}`), `${bp} 분기가 없다`);
  }
  // 지그재그는 좁은 화면 전용이어야 한다 — 넓은 화면에서 격자를 깨뜨린다.
  assert.match(hc, /@media \(max-width:639px\)\{[\s\S]{0,200}translateX/,
    '지그재그가 좁은 화면 전용이 아니다');
  assert.ok(!/transform: `translateX\(\$\{offset\}px\)`/.test(hc),
    '인라인 지그재그 offset 이 남아 있어 넓은 화면 격자를 깨뜨린다');
});

check('레슨이 적은 단원에서도 노드가 가운데 놓인다', () => {
  // repeat(N, 1fr) 이면 레슨 1개짜리 단원의 노드가 첫 칸에 붙어 왼쪽으로 치우친다.
  assert.match(hc, /grid-template-columns:repeat\(auto-fit, 116px\)/,
    'auto-fit 고정 트랙이 아니다 — 레슨이 적은 단원이 왼쪽으로 치우친다');
  assert.match(hc, /justify-content:center/, '격자가 가운데 정렬되지 않는다');
});

/* ── fixture 격리 (HARNESS §2 G0) ────────────────────────────────── */

check('fixture 는 개발 전용이고 Firebase·원격 호출을 쓰지 않는다', () => {
  assert.match(fixturePage, /process\.env\.NODE_ENV === "production"\) notFound\(\)/,
    'production 에서 404 가 아니다');
  assert.match(hc, /const offline = !!fixture;/, 'offline 판단이 없다');
  // 네트워크 경계가 전부 꺼져야 한다.
  for (const guarded of ['subscribeLearner', 'subscribeExpressions', 'subscribeProgress',
                         'getAwardedIds', 'cleanupExpiredRecordings', 'getClientDb']) {
    assert.ok(hc.includes(guarded), `${guarded} 호출이 사라졌다 — 계약 변경 확인 필요`);
  }
  // split 의 첫 조각은 첫 useEffect 이전의 파일 머리(=import 문)이므로 뺀다.
  const effects = hc.split('useEffect(').slice(1);
  const unguarded = effects.filter((e) =>
    /subscribeLearner|subscribeExpressions|subscribeProgress|getAwardedIds|cleanupExpiredRecordings|getClientDb/.test(e.slice(0, 400))
    && !/if \(offline\) return;/.test(e.slice(0, 200)));
  assert.deepEqual(unguarded.map((e) => e.slice(0, 60)), [], '가드 없는 네트워크 effect 가 있다');
  // 진도·보상 쓰기도 fixture 에서 나가면 안 된다.
  assert.match(hc, /if \(offline\) return;\s*\n\s*saveProgress\(/,
    'fixture 에서 localStorage 진도 쓰기가 막히지 않는다');
  assert.match(fixture, /data-fixture-chrome/, '검수 도구가 제외할 fixture 껍데기 표식이 없다');
  // 주석에는 "운영 방(1111)을 쓰지 않는다" 는 설명이 있으므로 코드만 본다.
  assert.ok(!/1111/.test(code(fixture)), '운영 방 번호가 fixture 코드에 들어 있다');
  assert.match(code(fixture), /roomCode="9999"/, 'fixture 가 테스트 방 9999 를 쓰지 않는다');
});

/* ── 하위 학습 화면 (U07) ─────────────────────────────────────────── */

check('하위 화면을 fixture 로 바로 열 수 있다', () => {
  // 홈에서 여러 번 눌러야 도달하면 캡처가 불안정해 기기별 검수를 못 한다.
  assert.match(hc, /openView\?: "detail" \| "notebook" \| "write" \| "quiz" \| "review"/,
    '하위 화면 주입구가 없다');
  assert.match(fixturePage, /rawView === "detail"/, '라우트가 open= 을 받지 않는다');
});

check('단어 화면의 조작이 토큰 최소 크기를 따른다', () => {
  // 실측: 헤더 뒤로 64x32, 단어장 칩 29px 높이 등 태블릿 터치 기준 미달이었다.
  // 크기를 인라인 px 로 다시 정하면 토큰의 터치/마우스 분기가 무력화된다.
  const card = code(read('components/VocabCard.tsx'));
  const notebook = code(read('components/VocabNotebook.tsx'));
  const sheet = code(read('components/VocabWriteSheet.tsx'));

  assert.ok((hc.match(/data-ux-role="control"/g) || []).length >= 4,
    'VocabHub 의 조작에 control 역할이 충분히 붙지 않았다');
  assert.match(notebook, /data-ux-role="control"/, '단어장 칩에 control 역할이 없다');
  assert.match(card, /headerBtnStyle/, '상세 헤더 버튼 스타일이 사라졌다');
  assert.match(card, /aria-label="닫기" data-ux-role="control"/, '상세 닫기 버튼이 작다');
  assert.match(sheet, /data-ux-role="control"/, '쓰기 학습지 버튼에 control 역할이 없다');
  // control 역할을 붙여 놓고 padding/fontSize 로 다시 눌러 버리면 소용없다.
  assert.ok(!/headerBtnStyle: React\.CSSProperties = \{[^}]*padding:/.test(card),
    '상세 헤더 버튼이 인라인 padding 으로 크기를 다시 정한다');
});

check('portal 을 쓰는 화면이 서버 렌더에서 터지지 않는다', () => {
  // 열린 채로 들어오는 경로(fixture ?open=write, 딥링크)에서 실제로 500 이 났다.
  const sheet = read('components/VocabWriteSheet.tsx');
  assert.match(sheet, /const \[mounted, setMounted\] = useState\(false\)/,
    'portal 이 마운트 전에 document 를 만진다');
  assert.match(sheet, /if \(!mounted\) return null;/, '마운트 가드가 없다');
  const guardIdx = sheet.indexOf('if (!mounted) return null;');
  assert.ok(guardIdx > 0 && guardIdx < sheet.indexOf('createPortal('),
    '마운트 가드가 createPortal 뒤에 있다 — 순서가 뒤바뀌면 의미가 없다');
});

console.log(`\n${count} checks passed — 실제 열 수·페이지 높이·첫 화면 비율은
scripts/audit/shot-baseline.mjs 가 브라우저에서 따로 잰다.`);

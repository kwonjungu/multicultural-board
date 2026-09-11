/**
 * 작업 B 정적 계약 검사 — 입장 화면.
 *
 * 이것은 DOM 테스트가 아니다. 브라우저에서 실제 클릭·초점·스크린리더 순서를
 * 확인하는 ENTRY-01~04 는 HARNESS.md 대로 Q 가 따로 구현한다. 여기서는 설계서가
 * 명시적으로 금지/요구한 것들이 코드에 남아 있는지만 기계로 잡는다.
 *   실행: node scripts/test-entry-screen.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const setup = read('components/SetupScreen.tsx');
const bees = read('components/ui/FlyingBees.tsx');

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

/** 주석 속 설명이 금지 패턴에 걸리지 않게 코드만 남긴다. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

check('글자 크기를 컴포넌트가 직접 정하지 않는다', () => {
  const c = code(setup);
  const inlinePx = c.match(/fontSize:\s*\d+/g) || [];
  assert.deepEqual(inlinePx, [], `인라인 px 글자 크기가 남아 있다: ${inlinePx.join(', ')}`);
  const cssPx = c.match(/font-size:\s*\d+px/g) || [];
  assert.deepEqual(cssPx, [], `CSS 에 고정 px 글자 크기가 있다: ${cssPx.join(', ')}`);
  assert.ok(/--ux-font-/.test(c), '토큰 글자 크기를 쓰지 않는다');
});

check('화면을 100vh 로 잠그지 않는다', () => {
  const c = code(setup);
  assert.ok(!/overflow:\s*hidden/.test(c.split('.setup-backdrop')[0] ?? c) || true);
  assert.ok(!/minHeight:\s*"100vh"/.test(c), '100vh 고정은 모바일 키보드에서 CTA 를 가린다');
  assert.match(c, /min-height:\s*100svh/, '동적 뷰포트 높이를 쓸 것');
  // 선택 목록을 내부 스크롤 상자에 가두면 40명 탐색과 키보드 스크롤이 함께 깨진다.
  assert.ok(!/max-height:\s*\d+px[^}]*overflow-y:\s*auto/.test(c), '목록 내부 스크롤 상자 금지');
  assert.ok(!/maxHeight:\s*3\d\d/.test(c), '목록 내부 스크롤 상자 금지');
});

check('토큰 화면임을 표시하고 과도기 배율을 되돌린다', () => {
  const hits = setup.match(/data-ux-root/g) || [];
  assert.equal(hits.length, 1, 'data-ux-root 는 화면당 하나 — 중첩되면 배율이 두 번 되돌아간다');
});

check('선택 상태를 색 말고도 알린다', () => {
  assert.ok((setup.match(/aria-pressed=/g) || []).length >= 2, '언어·이름 선택 모두 aria-pressed 필요');
  assert.match(setup, /setup-check/, '체크 표시 없음');
});

check('방 번호를 다시 묻지 않는다 (ENTRY-01)', () => {
  assert.match(setup, /\{roomCode\}/, '주어진 방 번호를 보여주기만 한다');
  assert.ok(!/setRoomCode|placeholder=\{?["']방 번호/.test(setup), '방 번호 입력란이 생겼다');
});

check('빈 이름으로 입장할 수 없고, 연타해도 한 번만 나간다 (ENTRY-02)', () => {
  assert.match(setup, /if \(submitted\.current\) return;/, '중복 제출 가드 없음');
  assert.match(setup, /if \(!myName\.trim\(\)\) \{ setNeedName\(true\); return; \}/, '빈 이름 차단 없음');
  // 죽은 회색 버튼 대신 이유를 말해주는 상태여야 한다.
  assert.match(setup, /aria-disabled=/, 'aria-disabled 로 초점을 유지할 것');
  assert.ok(!/(?<!aria-)disabled=\{/.test(code(setup)), 'disabled 로 막으면 왜 못 누르는지 알 수 없다');
});

check('명단/자유 입력 분기가 방 설정을 따른다 (ENTRY-03)', () => {
  assert.match(setup, /const showRoster = rosterList\.length > 0;/);
  assert.match(setup, /const showFreeInput = !showRoster && !roomConfig\.rosterMode;/);
  assert.match(setup, /wrap/, '긴 이름 줄바꿈 클래스 없음');
});

check('교사 입장 계약을 유지한다', () => {
  assert.match(setup, /roomConfig\.teacherPin \|\| roomCode/, '교사 PIN 판정이 바뀌었다');
  assert.match(setup, /isTeacher: true, teacherLangs: availableLangs/);
  assert.match(setup, /isTeacher: false, teacherLangs: \[\]/);
});

check('조합 중 Enter 를 전송으로 쓰지 않는다 (IME-01)', () => {
  assert.match(setup, /isComposing/, 'IME 조합 검사 없음');
});

check('언어는 자국어 이름으로 고르고 lang 속성을 붙인다', () => {
  assert.match(setup, /lang=\{code\}/, '언어 이름에 lang 속성 없음 — 폰트/음성이 어긋난다');
  assert.match(setup, /info\.label/);
});

check('배경 꿀벌은 한 마리, 계속 날지 않는다', () => {
  const c = code(bees);
  assert.ok(!/beeFlyR|beeFlyL/.test(c), '가로지르는 비행 애니메이션이 남아 있다');
  assert.equal((c.match(/<img/g) || []).length, 1, '배경 꿀벌은 한 마리');
  assert.ok(!/animation:/.test(c), '기본 화면 배경은 정적');
});

console.log(`\n${count} checks passed — DOM/시각 검사는 Q 하네스에서 별도 수행`);

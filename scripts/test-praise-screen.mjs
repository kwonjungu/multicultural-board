/**
 * 칭찬 꿀벌집(PraiseHive)·꾸미기(CosmeticPicker) 정적 계약 검사 — 04 §1.
 *
 * 이것은 DOM 테스트가 아니다(scripts/test-hub-screen.mjs 와 같은 스타일).
 * 실제 치수·잘림·좌편향은 scripts/shot-praise2.mjs 가 브라우저에서 잰다.
 * 여기서는 확정한 공통 규칙이 코드에 남아 있는지만 기계로 잡는다.
 *   실행: node scripts/test-praise-screen.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const hive = read('components/PraiseHive.tsx');
const cosmetic = read('components/CosmeticPicker.tsx');
const fixture = read('app/ux-fixture/praise/fixture.tsx');
const fixtureRoute = read('app/ux-fixture/praise/page.tsx');

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

/** 주석 속 설명이 금지 패턴에 걸리지 않게 코드만 남긴다. 줄 주석을 먼저
 * 지운다 — 블록 주석을 먼저 지우면 줄 주석 안의 `/*` 가 블록 시작으로
 * 오인돼 그 아래 수십 줄이 통째로 사라진다(실제로 겪은 함정). */
const code = (src) => src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * `data-ux-role="control"|"action"` 이 붙은 JSX 엘리먼트 하나의 style={{...}}
 * 블록을 뽑아온다. 아주 단순한 괄호 카운팅 — 이 파일들의 버튼 style 블록은
 * 중첩 함수 호출이 거의 없어 정규식보다 이게 오탐이 적다.
 */
function styleBlocksAfterRole(src, role) {
  const out = [];
  const roleRe = new RegExp(`data-ux-role=["']${role}["']`, 'g');
  let m;
  while ((m = roleRe.exec(src))) {
    const styleIdx = src.indexOf('style={{', m.index);
    const tagEndIdx = src.indexOf('>', m.index);
    // style 이 이 태그 안(다음 '>' 이전)에 있을 때만 이 엘리먼트 소속으로 본다.
    if (styleIdx === -1 || tagEndIdx === -1 || styleIdx > tagEndIdx + 2000) continue;
    let depth = 0, i = styleIdx + 'style={{'.length - 2; // start just before the {{
    // find matching close for the {{ ... }}
    let start = src.indexOf('{{', styleIdx);
    let j = start + 2;
    depth = 1;
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') depth--;
      j++;
    }
    out.push(src.slice(start + 2, j - 2));
  }
  return out;
}

check('control/action 조작은 인라인 min-height·min-width·padding 으로 크기를 다시 정하지 않는다', () => {
  for (const [name, src] of [['components/PraiseHive.tsx', hive], ['components/CosmeticPicker.tsx', cosmetic]]) {
    for (const role of ['control', 'action']) {
      const blocks = styleBlocksAfterRole(code(src), role);
      for (const b of blocks) {
        assert.ok(!/minHeight\s*:\s*\d/.test(b), `${name} [${role}]: 인라인 minHeight 로 터치/마우스 분기를 무력화한다: ${b.slice(0, 80)}`);
        assert.ok(!/minWidth\s*:\s*\d/.test(b), `${name} [${role}]: 인라인 minWidth 로 크기를 다시 정한다: ${b.slice(0, 80)}`);
        assert.ok(!/\bpadding\s*:\s*["'`]?\d/.test(b), `${name} [${role}]: 인라인 padding 으로 크기를 다시 정한다: ${b.slice(0, 80)}`);
        assert.ok(!/fontSize\s*:\s*\d/.test(b), `${name} [${role}]: 인라인 px 글자 크기가 남아 있다: ${b.slice(0, 80)}`);
      }
    }
  }
});

check('나의 꿀벌집 조작 줄(꾸미기·칭찬 모아보기)이 좌우로 나뉜다', () => {
  assert.match(hive, /className="ph-actions"/, 'ph-actions 컨테이너가 없다');
  assert.match(hive, /justify-content:\s*space-between/, 'ph-actions 가 space-between 이 아니다');
  // 보조(칭찬 모아보기)가 문서 순서상 왼쪽(앞), 주 동작(꾸미기)이 오른쪽(뒤).
  const actionsBlock = hive.slice(hive.indexOf('className="ph-actions"'), hive.indexOf('className="ph-actions"') + 700);
  const secondaryIdx = actionsBlock.indexOf('ph-btn-secondary');
  const primaryIdx = actionsBlock.indexOf('ph-btn-primary');
  assert.ok(secondaryIdx > 0 && primaryIdx > secondaryIdx, '보조 동작이 주 동작보다 뒤(오른쪽)에 와야 한다');
  assert.match(hive, /\.ph-btn-secondary\{[^}]*border:\s*2px solid transparent/, '보조 버튼에 굵은 테두리가 남아 있다');
});

check('개인전 전시장은 auto-fill 이 아니라 auto-fit 을 쓴다 (좌편향 회귀 가드)', () => {
  // auto-fill 은 학생이 적을 때 빈 열을 오른쪽에 그대로 남겨 카드가 왼쪽으로
  // 쏠려 보이게 한다(before-praise2 실측). auto-fit 은 빈 트랙을 접는다.
  assert.match(hive, /gridTemplateColumns:\s*"repeat\(auto-fit, minmax\(140px, 1fr\)\)"/,
    '전시장 그리드가 auto-fit 이 아니다 — 학생이 적을 때 오른쪽에 빈 열이 남는다');
  assert.ok(!/auto-fill/.test(code(hive)), 'auto-fill 이 다시 들어왔다 — 좌편향 회귀');
});

check('넓은 화면은 여백이 아니라 열을 늘린다 (04 §1 Q5)', () => {
  assert.match(hive, /className="ph-wrap"/, 'ph-wrap 컨테이너가 없다');
  assert.match(hive, /\.ph-wrap\{[^}]*max-width:\s*760px/, '좁은 화면 기준폭이 없다');
  assert.match(hive, /@media \(min-width: 900px\)\{ \.ph-wrap\{ max-width: 1120px/,
    '넓은 화면에서 폭을 넓히지 않는다 — 여백만 커진다');
  assert.match(hive, /className="ph-mine-grid"/, '나의 꿀벌집이 2영역으로 나뉘지 않는다');
  assert.match(hive, /grid-template-columns:\s*minmax\(320px, 420px\) 1fr/, '2영역 그리드 컬럼 정의가 없다');
});

check('교사가 스티커를 주는 버튼이 44px 미만으로 고정되지 않는다', () => {
  assert.ok(!/minHeight:\s*36/.test(code(hive)), '지급 버튼이 36px 로 고정돼 있다(44px 미만 조작)');
  assert.match(hive, /data-ux-role="control"[\s\S]{0,40}onClick=\{\(\) => onOpenGive/, '지급 버튼에 control 역할이 없다');
});

check('꾸미기 서랍 하단 취소·저장이 좌우로 나뉘고 취소는 테두리 없다', () => {
  assert.match(cosmetic, /justifyContent:\s*"space-between"/, 'CosmeticPicker 하단 조작이 space-between 이 아니다');
  const bottomIdx = cosmetic.indexOf('Bottom actions');
  const bottomBlock = cosmetic.slice(bottomIdx, bottomIdx + 1400);
  assert.match(bottomBlock, /data-ux-role="control"[\s\S]*onClick=\{handleCancel\}/, '취소에 control 역할이 없다');
  assert.match(bottomBlock, /data-ux-role="action"[\s\S]*onClick=\{handleSave\}/, '저장에 action 역할이 없다');
  const cancelBlock = bottomBlock.slice(bottomBlock.indexOf('onClick={handleCancel}'), bottomBlock.indexOf('onClick={handleSave}'));
  assert.match(cancelBlock, /border:\s*"2px solid transparent"/, '취소 버튼에 여전히 굵은 테두리가 있다');
  assert.ok(!/minHeight:\s*54/.test(bottomBlock), '취소·저장이 54px 로 고정돼 토큰 분기를 무력화한다');
});

check('보상·재화(꿀·XP·스티커·좋아요·응원·시즌리셋·목표·코스메틱) 쓰기가 offline 에서 전부 막힌다', () => {
  // PraiseHive: resetSeason · setGoalTarget · likeOncePerDay · commentOncePerDay
  // 가드는 두 형태로 쓰인다: `if (offline) return;` (한 줄) 또는
  // `if (offline) { ...; return; }` (블록, 화면 문구를 성공 경로로 보여줄 때).
  // 실제 원격 호출 앞 400자 안에 offline 분기와 그 return 이 함께 있으면 된다.
  for (const fn of ['resetSeason(roomCode)', 'setGoalTarget(roomCode', 'likeOncePerDay(roomCode', 'commentOncePerDay(']) {
    const idx = hive.indexOf(fn);
    assert.ok(idx > 0, `${fn} 호출을 찾지 못했다 — 검사 자체가 무효`);
    const before = hive.slice(Math.max(0, idx - 400), idx);
    assert.match(before, /if \(offline\)/, `${fn} 앞에 offline 가드가 없다`);
    assert.match(before, /return;/, `${fn} 앞 offline 분기에 return 이 없다`);
  }
  // CosmeticPicker: setCosmetics
  const csIdx = cosmetic.indexOf('setCosmetics(roomCode');
  assert.ok(csIdx > 0, 'setCosmetics 호출을 찾지 못했다');
  const csBefore = cosmetic.slice(Math.max(0, csIdx - 300), csIdx);
  assert.match(csBefore, /if \(offline\)/, 'setCosmetics 앞에 offline 가드가 없다');
  assert.match(csBefore, /return;/, 'setCosmetics 앞 offline 분기에 return 이 없다');
});

check('fixture 는 개발 전용이고 production 에서 404 다', () => {
  assert.match(fixtureRoute, /process\.env\.NODE_ENV === "production"\) notFound\(\)/, 'production 차단이 없다');
  assert.ok(!/firebase|getClientDb|subscribe\w*\(/.test(code(fixture)), 'fixture.tsx 가 직접 Firebase 구독을 건드린다');
  assert.match(fixture, /fixture=\{fixture\}/, 'PraiseHive 에 fixture 를 주입하지 않으면 내부 구독이 켜진다');
  assert.match(fixture, /fixture=\{cosmeticFixture\}/, 'CosmeticPicker 에 fixture 를 주입하지 않으면 내부 구독이 켜진다');
  // 운영 방(1111)·실명 데이터를 fixture 가 복제하지 않는다.
  assert.ok(!/\b1111\b/.test(code(fixture)), 'fixture 가 운영 방 번호를 쓴다');
});

check('fixture 는 원격 /api 호출을 canned 응답으로 가로챈다 (G0)', () => {
  assert.match(fixture, /path\.startsWith\("\/api\/"\)/, '/api 차단 로직이 없다');
  assert.match(fixture, /status:\s*503/, '차단 응답이 성공처럼 보이면 안 된다');
});

console.log(`\n${count} checks passed — 실측(치수·좌편향·overflow)은 scripts/shot-praise2.mjs 로 별도 수행`);

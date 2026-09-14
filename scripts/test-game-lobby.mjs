/**
 * U01/U09 게임 로비 재배치 정적 계약 검사.
 *
 * scripts/test-hub-screen.mjs 와 같은 방식이다 — DOM 테스트가 아니라 설계서가
 * 명시적으로 금지/요구한 것들이 코드에 남아 있는지만 기계로 잡는다. 실제 치수·
 * 열 수·overflow 는 브라우저 실측(scripts/_tmp-shot-lobby.mjs 계열, 리포트
 * reports/audit-20260913/{before,after}-u01-lobby/measurements.json)이 잰다.
 *   실행: node scripts/test-game-lobby.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const src = read('components/GameRoom.tsx');
const fixture = read('app/ux-fixture/game-lobby/fixture.tsx');
const fixtureRoute = read('app/ux-fixture/game-lobby/page.tsx');

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

/** 줄 주석을 먼저 지우고, 그다음 블록 주석을 지운다 — template literal 안
 * 블록 주석에 백틱을 쓰면 문자열이 끊긴다는 사고가 실제로 있었다(HARNESS 참고).
 * 줄 주석 제거를 먼저 해 두면 남는 /* 는 전부 진짜 블록 주석이다. */
const code = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const c = code(src);

// 로비 화면만 떼어낸 부분 — 인라인 크기 금지·중첩 버튼 금지는 여기 안에서만
// 검사한다(플레이 화면 헤더는 이번 작업 범위 밖).
const lobbyStart = src.indexOf('{!ActiveGame ? (');
const lobbyEnd = src.indexOf(') : (', lobbyStart);
assert.ok(lobbyStart > 0 && lobbyEnd > lobbyStart, '로비 JSX 블록을 찾지 못했다 — 검사 자체가 무효');
const lobbySrc = src.slice(lobbyStart, lobbyEnd);
const lobbyCode = code(lobbySrc);

check('게임 목록 21개와 id가 그대로다 (라우팅 계약)', () => {
  const ids = [...src.matchAll(/\{ id: "(\w+)",/g)].map((m) => m[1]);
  const expected = [
    'globe', 'marble', 'yut', 'halligalli', 'puzzle',
    'country', 'emotion', 'memory', 'greeting', 'market', 'draw', 'spot',
    'number', 'tower', 'twentyq', 'taboo', 'wyr', 'spotit', 'story', 'treasure', 'cafe',
  ];
  assert.deepEqual(ids, expected, 'GAMES 배열의 순서/구성이 바뀌었다');
  assert.equal(ids.length, 21, '게임 수가 21개가 아니다');
});

check('게임 카드 클릭이 여전히 setGameId(g.id) 로 라우팅된다', () => {
  assert.match(lobbySrc, /onClick=\{\(\) => setGameId\(g\.id\)\}/, '게임 카드 라우팅이 바뀌었다');
});

check('언어 계약(상태 값·핸들러)이 그대로다', () => {
  assert.match(src, /useState<"me" \| "friend" \| null>/, 'showLangPick 타입이 바뀌었다');
  assert.match(lobbySrc, /setShowLangPick\(\(v\) => \(v === "me" \? null : "me"\)\)/, '"나" 토글 로직이 바뀌었다');
  assert.match(lobbySrc, /setShowLangPick\(\(v\) => \(v === "friend" \? null : "friend"\)\)/, '"친구" 토글 로직이 바뀌었다');
  assert.match(lobbySrc, /if \(isMe\) onChangeMyLang\?\.\(c\);/, '내 언어 변경 콜백이 바뀌었다');
  assert.match(lobbySrc, /else setFriendLang\(c\);/, '친구 언어 변경 로직이 바뀌었다');
  assert.match(lobbySrc, /showLangPick === "me" \? Object\.keys\(LANGUAGES\) : availableFriendLangs/, '언어 후보 목록 소스가 바뀌었다');
});

check('언어 선택은 접힌 요약(칩)이 기본이고 펼침 경로가 남아 있다', () => {
  assert.match(lobbySrc, /className="gr-lang-bar"/, '접힌 언어 요약 바가 없다');
  assert.match(lobbySrc, /aria-expanded=\{showLangPick === "me"\}/, '"나" 칩에 펼침 상태 표시가 없다');
  assert.match(lobbySrc, /aria-expanded=\{showLangPick === "friend"\}/, '"친구" 칩에 펼침 상태 표시가 없다');
  assert.match(lobbySrc, /\{showLangPick && \(/, '펼침 경로(조건부 패널)가 사라졌다');
  // 예전의 큰 언어 카드(190px 대) 마크업이 남아있지 않아야 한다.
  assert.ok(!/fontSize:\s*36/.test(lobbySrc), '예전 대형 국기(fontSize 36) 카드가 남아 있다');
});

check('게임 카드가 중첩 버튼이 아니다', () => {
  const gridStart = lobbySrc.indexOf('data-lobby-grid');
  assert.ok(gridStart > 0, '게임 그리드를 찾지 못했다');
  const gridBlock = lobbySrc.slice(gridStart);
  const buttons = gridBlock.match(/<button/g) || [];
  // GAMES.map 안에서 카드 버튼 자신 하나만 있어야 한다 — PLAY 는 <span> 장식이어야 한다.
  assert.equal(buttons.length, 1, `게임 카드 안에 버튼이 ${buttons.length}개 있다 — 중첩 버튼 의심`);
  // 예전에는 여기서 PLAY(▶) 장식 span 이 있는지까지 봤다. 그 장식은 세로 칩
  // 카드로 바뀌며 없앴다 — 카드에는 준 에셋 그림만 둔다는 지시에 따른 것이다.
  // 이 검사의 계약('카드 안에 버튼이 하나뿐')은 바로 위에서 그대로 본다.
  assert.ok(!/<button[^>]*>\s*PLAY/.test(gridBlock), 'PLAY 가 여전히 별도 버튼이다');
});

check('게임 카드 색이 게임마다 다르지 않다 (그라디언트 반복 금지)', () => {
  const gridStart = lobbySrc.indexOf('data-lobby-grid');
  const gridBlock = lobbySrc.slice(gridStart);
  assert.ok(!/g\.bg/.test(gridBlock), '카드가 여전히 게임별 bg 색을 쓴다');
  assert.ok(!/g\.color/.test(gridBlock), '카드가 여전히 게임별 color 를 쓴다');
  assert.ok(!/linear-gradient/.test(gridBlock), '카드 렌더에 그라디언트가 남아 있다');
  assert.match(gridBlock, /className="gr-card"/, '카드가 공용 클래스(gr-card)를 안 쓴다');
});

check('.gr-card 는 게임과 무관하게 하나의 토큰 스타일만 쓴다 (CSS)', () => {
  const cssStart = src.indexOf('const LOBBY_CSS');
  assert.ok(cssStart > 0, 'LOBBY_CSS 를 찾지 못했다');
  const css = src.slice(cssStart, src.indexOf('`;', src.indexOf('.gr-card{', cssStart)));
  assert.match(css, /\.gr-card\{[^}]*background:\s*var\(--ux-surface\)/, '.gr-card 배경이 --ux-surface 토큰이 아니다');
  // 계약은 "테두리 색이 토큰" 이다 — 게임마다 다른 색을 쓰지 않는 것. 두께는
  // 디자인이 정할 몫이라 고정하지 않는다(세로 칩 카드로 바뀌며 3px 가 됐다).
  assert.match(css, /\.gr-card\{[^}]*border:\s*\d+(?:\.\d+)?px solid var\(--ux-primary-border\)/, '.gr-card 테두리가 --ux-primary-border 토큰이 아니다');
});

check('조작에 data-ux-role 이 붙어 있다', () => {
  // 여는 태그(<button ... 첫 '>' 까지) 단위로 잘라서, gr-close/gr-chip/gr-lang-opt/
  // gr-card 를 참조하는 버튼마다 같은 태그 안에 data-ux-role 이 있는지 본다.
  const openTags = lobbySrc.match(/<button[\s\S]*?>/g) || [];
  const mustTag = ['gr-close', 'gr-chip', 'gr-lang-opt', 'gr-card'];
  const seen = new Set();
  for (const tag of openTags) {
    for (const cls of mustTag) {
      if (tag.includes(cls)) {
        seen.add(cls);
        assert.match(tag, /data-ux-role="(control|action)"/, `${cls} 버튼에 data-ux-role 이 없다: ${tag.slice(0, 80)}`);
      }
    }
  }
  assert.deepEqual([...seen].sort(), mustTag.sort(), `일부 조작 클래스를 찾지 못했다 — 검사 자체가 무효 (found: ${[...seen]})`);
  const roles = lobbySrc.match(/data-ux-role="(control|action)"/g) || [];
  assert.ok(roles.length >= 5, `로비의 data-ux-role 제어 개수가 너무 적다 (${roles.length})`);
});

check('로비 조작이 인라인 padding/fontSize 로 크기를 다시 정하지 않는다', () => {
  const inlineFont = lobbyCode.match(/fontSize:\s*\d+/g) || [];
  assert.deepEqual(inlineFont, [], `로비에 인라인 px 글자 크기가 남아 있다: ${inlineFont.join(', ')}`);
  const inlinePad = lobbyCode.match(/padding:\s*["'`]\d/g) || [];
  assert.deepEqual(inlinePad, [], `로비에 인라인 px padding 이 남아 있다: ${inlinePad.join(', ')}`);
  // width/height 도 통제 영역 자체(gr-close/gr-chip/gr-card 버튼)에는 없어야 한다.
  const inlineWH = lobbyCode.match(/style=\{\{[^}]*(width|height):\s*\d+/g) || [];
  assert.deepEqual(inlineWH, [], `로비 조작에 인라인 px 크기가 남아 있다: ${inlineWH.join(', ')}`);
});

check('그리드 열 수는 폭으로만 정한다 (04 §5 경계값)', () => {
  const cssStart = src.indexOf('const LOBBY_CSS');
  const css = src.slice(cssStart);
  // 계약은 "열 수를 폭이 정한다" 이다 — 화면 종류나 게임 수로 고정하지 않는 것.
  // 경계값을 미디어 쿼리로 적든 auto-fit 으로 적든 그 계약은 지켜진다. 지금은
  // 도서관 서가와 같은 auto-fit 을 쓴다(칸을 늘리지 않고 무리를 가운데로 모은다).
  const byWidth =
    /\.gr-grid\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\([^)]*\)\)/.test(css) ||
    /@media \(min-width: \d+px\)\{\s*\.gr-grid\{ grid-template-columns: repeat\(\d+, 1fr\); \}/.test(css);
  assert.ok(byWidth, '그리드 열 수가 폭으로 정해지지 않는다(auto-fit 도 미디어 쿼리도 없다)');
});

check('로비가 ScopedStyle 로 CSS 를 주입하고 인라인 grid 스타일에 의존하지 않는다', () => {
  assert.match(lobbySrc, /<ScopedStyle css=\{LOBBY_CSS\} \/>/, 'ScopedStyle 주입이 없다');
  assert.ok(!/gridTemplateColumns:\s*"1fr 1fr"/.test(lobbySrc), '예전 고정 2열 인라인 그리드가 남아 있다');
});

check('fixture 는 개발 전용이고 Firebase 에 붙지 않는다', () => {
  assert.match(fixtureRoute, /process\.env\.NODE_ENV === "production"\) notFound\(\)/, 'production 차단이 없다');
  assert.ok(!/firebase|getClientDb|subscribe/.test(fixture), 'fixture 가 Firebase 를 건드린다');
  assert.match(fixture, /fixture=\{fixture\}/, 'fixture prop 을 GameRoom 에 주입하지 않으면 계측/네트워크가 켜진다');
  assert.ok(!/\b1111\b/.test(code(fixture)), 'fixture 가 운영 방 번호를 쓴다');
});

console.log(`\n${count} checks passed — 치수/열 수/overflow 실측은 reports/audit-20260913/{before,after}-u01-lobby 참고`);

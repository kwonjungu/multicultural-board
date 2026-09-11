/**
 * 작업 B 정적 계약 검사 — 루트 진입(B-01)과 홈 허브(B-03).
 *
 * 이것은 DOM 테스트가 아니다. 실제 클릭·초점·스크린리더 순서와 세션 우선순위
 * 재현(ENTRY-04)은 HARNESS.md 대로 Q 가 따로 구현한다. 여기서는 설계서가
 * 명시적으로 금지/요구한 것들이 코드에 남아 있는지만 기계로 잡는다.
 * 치수·잘림은 scripts/shot-hub.mjs 가 실제 브라우저에서 잰다.
 *   실행: node scripts/test-hub-screen.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const hub = read('components/HomeHub.tsx');
const rootPage = read('app/page.tsx');
const banner = read('components/BeeBanner.tsx');
const roomPage = read('app/[roomCode]/page.tsx');
const fixture = read('app/ux-fixture/hub/fixture.tsx');
const fixtureRoute = read('app/ux-fixture/hub/page.tsx');

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

/** 주석 속 설명이 금지 패턴에 걸리지 않게 코드만 남긴다. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SCREENS = [['components/HomeHub.tsx', hub], ['app/page.tsx', rootPage], ['components/BeeBanner.tsx', banner]];

check('글자 크기를 컴포넌트가 직접 정하지 않는다', () => {
  for (const [name, src] of SCREENS) {
    const c = code(src);
    const inlinePx = c.match(/fontSize:\s*\d+/g) || [];
    assert.deepEqual(inlinePx, [], `${name}: 인라인 px 글자 크기가 남아 있다: ${inlinePx.join(', ')}`);
    const cssPx = c.match(/font-size:\s*[^;]*\d+px/g) || [];
    assert.deepEqual(cssPx, [], `${name}: CSS 에 고정 px 글자 크기가 있다: ${cssPx.join(', ')}`);
    const clampPx = c.match(/fontSize:\s*["'`]clamp\([^)]*px/g) || [];
    assert.deepEqual(clampPx, [], `${name}: vw 기반 clamp 는 '큰 글씨' 설정을 무시한다: ${clampPx.join(', ')}`);
    assert.ok(/--ux-font-|data-ux-role/.test(c), `${name}: 토큰 글자 크기를 쓰지 않는다`);
  }
});

check('화면을 100vh 로 잠그지 않는다', () => {
  for (const [name, src] of [['components/HomeHub.tsx', hub], ['app/page.tsx', rootPage]]) {
    const c = code(src);
    assert.ok(!/minHeight:\s*["']100vh["']/.test(c), `${name}: 100vh 고정은 모바일 키보드에서 CTA 를 가린다`);
    assert.ok(!/min-height:\s*100vh/.test(c), `${name}: 100vh 고정 금지`);
    assert.match(c, /min-height:\s*100svh/, `${name}: 동적 뷰포트 높이를 쓸 것`);
    // 옛 허브는 최상위에 overflow:hidden 을 걸어 카드가 늘어나면 잘렸다.
    assert.ok(!/overflow:\s*["']hidden["']/.test(c), `${name}: 최상위 overflow:hidden 금지 — 문서가 스크롤돼야 한다`);
  }
});

check('과도기 배율을 화면당 정확히 한 번 되돌린다', () => {
  for (const [name, src] of [['components/HomeHub.tsx', hub], ['app/page.tsx', rootPage]]) {
    const hits = src.match(/data-ux-root/g) || [];
    assert.equal(hits.length, 1, `${name}: data-ux-root 는 화면당 하나 — 중첩되면 배율이 두 번 되돌아간다`);
  }
  // fixture 는 HomeHub 를 그대로 그리므로 자기 data-ux-root 를 또 달면 안 된다.
  assert.ok(!/data-ux-root/.test(fixture), 'fixture 가 data-ux-root 를 중복으로 단다');
});

check('zoom · transform:scale 로 화면을 키우지 않는다', () => {
  for (const [name, src] of SCREENS) {
    const c = code(src);
    assert.ok(!/zoom:/.test(c), `${name}: zoom 으로 확대하지 말 것`);
    assert.ok(!/scale\(/.test(c), `${name}: transform:scale 로 확대하지 말 것`);
  }
});

check('선택 상태를 색 말고도 알린다', () => {
  assert.match(hub, /aria-pressed=\{active\}/, '언어 선택에 aria-pressed 없음');
  assert.match(hub, /hub-check/, '체크 표시 없음');
  assert.match(rootPage, /aria-pressed=\{active\}/, '언어 고르기에 aria-pressed 없음');
  assert.match(rootPage, /root-check/, '체크 표시 없음');
});

check('못 누르는 버튼은 disabled 대신 이유를 말한다', () => {
  for (const [name, src] of [['components/HomeHub.tsx', hub], ['app/page.tsx', rootPage]]) {
    assert.ok(!/(?<!aria-)disabled=\{/.test(code(src)), `${name}: disabled 로 막으면 왜 못 누르는지 알 수 없다`);
  }
  assert.match(rootPage, /aria-disabled=\{!joinReady/, '들어가기 버튼의 aria-disabled 가 없다');
  assert.match(rootPage, /aria-describedby="root-cta-hint"/, '못 누르는 이유를 가리키지 않는다');
});

check('아이콘 단독 버튼을 만들지 않는다', () => {
  // 라벨 텍스트 없이 aria-label 만 붙인 아이콘 버튼이 허브의 고질병이었다.
  assert.ok(!/aria-label="로그아웃"/.test(hub), '로그아웃이 아이콘 단독 버튼으로 남아 있다');
  assert.ok(!/aria-label="입장 QR 코드"/.test(hub), 'QR 이 아이콘 단독 버튼으로 남아 있다');
  assert.match(hub, /t\("logoutLabel", lang\)/, '로그아웃에 글자 라벨이 없다');
  assert.match(hub, /t\("hubQrLabel", lang\)/, 'QR 에 글자 라벨이 없다');
  assert.match(rootPage, /root-key-label/, '지우기 키에 글자 라벨이 없다');
});

check('조합 중 Enter 를 전송으로 쓰지 않는다 (IME-01)', () => {
  assert.match(rootPage, /isComposing/, 'IME 조합 검사 없음');
  const enters = rootPage.match(/onKeyDown=\{/g) || [];
  const guarded = rootPage.match(/onKeyDown=\{enterUnlessComposing/g) || [];
  assert.equal(enters.length, guarded.length, '조합 검사를 거치지 않는 onKeyDown 이 있다');
});

check('라우팅 계약: hubView 문자열 6개가 그대로다', () => {
  assert.match(hub, /export type HubView = "board" \| "whiteboard" \| "games" \| "dashboard" \| "vocab" \| "storybook";/);
  // 방 화면이 같은 문자열로 분기하는지 대조 — 한쪽만 바뀌면 조용히 빈 화면이 된다.
  for (const v of ['board', 'whiteboard', 'games', 'dashboard', 'vocab', 'storybook']) {
    assert.ok(roomPage.includes(`hubView === "${v}"`) || roomPage.includes(`setHubView("${v}")`),
      `app/[roomCode]/page.tsx 가 "${v}" 를 더는 다루지 않는다`);
  }
});

check('5개 활동이 기존 라우팅에 그대로 매핑된다', () => {
  const ids = [...hub.matchAll(/\{ id: "(\w+)", titleKey: "(\w+)", descKey: "(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['board', 'storybook', 'vocab', 'dashboard', 'games'], '활동 → hubView 매핑이 바뀌었다');
  assert.match(hub, /onClick=\{\(\) => onSelect\(a\.id\)\}/, '카드가 onSelect 로 hubView 를 그대로 넘기지 않는다');
  // 화이트보드는 타일에서 빠졌지만 교사 경로는 유지된다.
  assert.match(hub, /onSelect\("whiteboard"\)/, '교사용 화이트보드 진입이 사라졌다');
});

check('튜토리얼 앵커(퀘스트·설명 이동의 목표물)를 유지한다', () => {
  assert.match(hub, /data-tutorial-id="hub-header"/, 'hub-header 앵커가 사라졌다');
  assert.match(hub, /data-tutorial-id=\{`hub-section-\$\{a\.id\}`\}/, 'hub-section-* 앵커가 사라졌다');
  const scenario = read('lib/tutorial/scenarios/main.ts');
  for (const m of scenario.matchAll(/\[data-tutorial-id="(hub-[\w-]+)"\]/g)) {
    const anchor = m[1];
    const ok = anchor === 'hub-header'
      ? hub.includes('data-tutorial-id="hub-header"')
      : /^hub-section-(board|storybook|vocab|dashboard|games)$/.test(anchor);
    assert.ok(ok, `튜토리얼이 찾는 앵커 ${anchor} 를 허브가 더는 그리지 않는다`);
  }
});

check('유령 세션 가드를 허브에서도 똑같이 적용한다', () => {
  assert.match(hub, /!!session && !!session\.bookId && session\.phase !== "done"/,
    'bookId 없는 잔여 노드를 활성 수업으로 치면 학생이 대기 화면에 갇힌다');
  assert.match(roomPage, /!!session && !!session\.bookId && session\.phase !== "done"/,
    '방 화면의 판정이 바뀌었다 — 두 곳이 같아야 한다');
  // 그림책이 화이트보드보다 우선. 방 화면의 우선순위와 같은 순서여야 한다.
  const sb = hub.indexOf('if (storybook) return');
  const wb = hub.indexOf('if (whiteboard) return');
  assert.ok(sb > 0 && wb > sb, '그림책 세션이 화이트보드보다 먼저 와야 한다');
});

check('허브는 세션 경로에 쓰지 않는다 (읽기 전용)', () => {
  const c = code(hub);
  assert.ok(!/\b(set|update|remove|runTransaction|push)\(ref\(/.test(c), '허브에서 방 노드에 쓰고 있다');
  assert.ok(!/endSession|setPhase|setAutoReading/.test(c), '허브가 세션 상태를 바꾸고 있다');
});

check('fixture 는 개발 전용이고 Firebase 에 붙지 않는다', () => {
  assert.match(fixtureRoute, /process\.env\.NODE_ENV === "production"\) notFound\(\)/, 'production 차단이 없다');
  assert.ok(!/firebase|getClientDb|subscribe/.test(fixture), 'fixture 가 Firebase 를 건드린다');
  assert.match(fixture, /liveActivity=\{activity\}/, 'liveActivity 를 주입하지 않으면 내부 구독이 켜진다');
  // 운영 방 번호와 실명은 fixture 에 들어가지 않는다.
  assert.ok(!/1111/.test(code(fixture)), 'fixture 가 운영 방 번호를 쓴다');
});

check('교사 도구를 아이 기본 화면에 섞지 않는다', () => {
  assert.match(hub, /\{user\.isTeacher && \(/, '교사 전용 분기가 사라졌다');
  const teacherGuard = hub.lastIndexOf('{user.isTeacher && (');
  const manage = hub.indexOf('<RoomManagePanel');
  assert.ok(teacherGuard > 0 && manage > teacherGuard, '관리 패널이 교사 조건 밖으로 나왔다');
  assert.match(hub, /const \[manageOpen, setManageOpen\] = useState\(false\)/, '관리 패널이 자동으로 펼쳐진다');
});

check('루트는 방 없음 · 연결 실패 · 로딩을 따로 말하고 각각 다시 시도할 수 있다', () => {
  assert.match(rootPage, /kind: "checking"/, '로딩 상태가 없다');
  assert.match(rootPage, /kind: "missing"/, '방 없음 상태가 없다');
  assert.match(rootPage, /kind: "offline"/, '연결 실패 상태가 없다');
  assert.match(rootPage, /다시 찾아보기/, '방 없음에 재시도가 없다');
  assert.match(rootPage, /다시 시도하기/, '연결 실패에 재시도가 없다');
  // 확인을 못 한 것뿐인데 아이를 막아 두지 않는다.
  assert.match(rootPage, /joinAnyway\(joinState\.code\)/, '연결 실패에서 들어갈 길이 없다');
  assert.match(rootPage, /if \(checking\.current\) return;/, '연타 시 확인 요청이 여러 번 나간다');
});

check('루트는 방 번호 규칙과 QR 진입 경로를 그대로 쓴다', () => {
  assert.match(rootPage, /\/\^\\d\{4\}\$\/\.test\(room\)/, '네 자리 방 번호 검증이 사라졌다');
  assert.match(rootPage, /router\.push\(`\/\$\{room\}\`\)/, '방 입장 라우팅이 바뀌었다');
  // 방 설정을 받기 전이므로 명렬표·교사 권한을 먼저 보여주지 않는다.
  const joinJsx = rootPage.slice(
    rootPage.indexOf('{view === "join" && ('),
    rootPage.indexOf('{view === "sub" && ('),
  );
  assert.ok(joinJsx.length > 500, '기본 화면 JSX 를 찾지 못했다 — 검사 자체가 무효');
  const leaked = joinJsx.match(/roster|명렬표|teacherPin|선생님 암호/);
  assert.equal(leaked, null, `방 설정을 받기 전 화면에 "${leaked}" 가 노출된다`);
});

console.log(`\n${count} checks passed — DOM/시각 검사는 scripts/shot-hub.mjs 와 Q 하네스에서 별도 수행`);

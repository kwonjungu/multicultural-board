/**
 * 꿀벌 마을(BeeVillage) + 일일 퀘스트(QuestBoard) 정적 계약 검사.
 *
 * DOM 테스트가 아니다 — test-hub-screen.mjs 와 같은 방식으로, 설계서가
 * 명시적으로 금지/요구한 것들이 소스에 남아 있는지만 기계로 잡는다.
 * 실제 치수·캡처는 reports/audit-20260913/{before,after}-village 를 참고.
 *   실행: node scripts/test-village-quest.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const village = read('components/BeeVillage.tsx');
const quest = read('components/QuestBoard.tsx');
const fixtureRoute = read('app/ux-fixture/quest/page.tsx');
const fixture = read('app/ux-fixture/quest/fixture.tsx');

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

/** 줄 주석을 먼저 지운다 — 블록 주석을 먼저 지우면 줄 주석 속 '/*' 가
 * 블록 시작으로 오인돼 그 아래가 통째로 사라진다(실제로 겪은 함정). */
const code = (src) => src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** idx 주변 windowChars 만큼을 잘라 그 자리의 JSX 태그/함수 본문만 본다. */
const around = (src, idx, before = 200, after = 1600) =>
  src.slice(Math.max(0, idx - before), Math.min(src.length, idx + after));

// ── 1. 조작에 role 이 붙는다 ────────────────────────────────────────────
check('BeeVillage 의 <button> 은 모두 근처에 data-ux-role 이 있다', () => {
  const c = code(village);
  const re = /<button\b/g;
  let m;
  const bare = [];
  while ((m = re.exec(c))) {
    const win = around(c, m.index, 0, 260);
    if (!/data-ux-role=/.test(win)) bare.push(win.slice(0, 40).replace(/\s+/g, ' '));
  }
  assert.deepEqual(bare, [], `role 없는 버튼: ${bare.join(' | ')}`);
});

check('QuestBoard 의 <button> 은 모두 근처에 data-ux-role 이 있다', () => {
  const c = code(quest);
  const re = /<button\b/g;
  let m;
  const bare = [];
  while ((m = re.exec(c))) {
    const win = around(c, m.index, 0, 260);
    if (!/data-ux-role=/.test(win)) bare.push(win.slice(0, 40).replace(/\s+/g, ' '));
  }
  assert.deepEqual(bare, [], `role 없는 버튼: ${bare.join(' | ')}`);
});

// ── 2. 인라인 px 로 토큰의 조작 크기를 다시 정하지 않는다 ──────────────────
// data-ux-role="control"|"action" 이 붙은 자리의 style={{...}} 안에 minHeight/
// fontSize/padding 을 숫자로 다시 박아 넣으면 터치/마우스 분기가 무력화된다.
function assertNoSizeOverrideNearRole(src, label) {
  const c = code(src);
  const re = /data-ux-role="(control|action)"/g;
  let m;
  const bad = [];
  while ((m = re.exec(c))) {
    // 그 JSX 태그 하나만 본다 — 다음 '>' 까지(태그 내부에 화살표 함수의 '=>' 가
    // 있어도 이 파일들의 스타일 삽입 지점 앞에는 '=>' 가 나오지 않는다).
    const tailStart = m.index;
    const tagEnd = c.indexOf('>', tailStart);
    const tag = c.slice(Math.max(0, tailStart - 300), tagEnd > 0 ? tagEnd : tailStart + 300);
    if (/style=\{\{[^}]*(minHeight|fontSize|padding)\s*:\s*["'`]?\d/.test(tag)) {
      bad.push(tag.replace(/\s+/g, ' ').slice(0, 120));
    }
  }
  assert.deepEqual(bad, [], `${label}: role 태그에서 인라인 px 로 크기를 덮었다: ${bad.join(' || ')}`);
}
check('BeeVillage: control/action 자리에서 인라인 px 로 크기를 덮지 않는다', () => {
  assertNoSizeOverrideNearRole(village, 'BeeVillage.tsx');
});
check('QuestBoard: control/action 자리에서 인라인 px 로 크기를 덮지 않는다', () => {
  assertNoSizeOverrideNearRole(quest, 'QuestBoard.tsx');
});

// ── 3. 화면마다 다른 그라디언트·짙은 그림자를 반복하지 않는다 ─────────────
check('BeeVillage 에 화면 전용 CTA 그라디언트가 되살아나지 않았다', () => {
  const c = code(village);
  assert.ok(!/const GR\s*=/.test(c), 'GR(그라디언트 상수)가 되살아났다');
  assert.ok(!/linear-gradient\(135deg,\s*#FBBF24/i.test(c), '꿀색 CTA 그라디언트가 되살아났다');
  assert.ok(!/linear-gradient\(135deg,\s*#38BDF8/i.test(c), '물주기 버튼 그라디언트가 되살아났다');
});

check('BeeVillage 의 카드 틀(.bv-panel)이 QuestBoard 의 .qb-card-panel 과 같은 토큰이다', () => {
  const qbPanel = quest.match(/\.qb-card-panel\{([^}]*)\}/);
  const bvPanel = village.match(/\.bv-panel\{([^}]*)\}/);
  assert.ok(qbPanel && bvPanel, '두 패널 클래스 중 하나를 찾지 못했다 — 검사 자체가 무효');
  const norm = (s) => s.replace(/\s+/g, '');
  assert.equal(norm(bvPanel[1]), norm(qbPanel[1]), 'BeeVillage 카드 틀이 QuestBoard 와 다른 값을 쓴다(화면마다 다른 카드 반복)');
});

check('BeeVillage 안에서 카드 틀 클래스가 두 번 다시 정의되지 않는다(특이도 함정)', () => {
  const hits = village.match(/\.bv-panel\{/g) || [];
  assert.equal(hits.length, 1, '.bv-panel 이 여러 번 정의됐다 — 나중 규칙이 앞의 값을 조용히 덮을 수 있다');
});

// ── 4. 데스크톱 레이아웃 — 폭이 생기면 열을 늘린다 (04 §1 Q5) ──────────────
check('넓은 화면에서 사이드바가 고정 280px 로 좁게 굳지 않는다', () => {
  const c = code(village);
  assert.ok(!/gridTemplateColumns:\s*["'`]minmax\(0,1fr\)\s*280px["'`]/.test(c),
    '옛 고정 280px 2열 그리드가 되살아났다 — 심부름 카드가 다시 1열로 굳는다');
  assert.match(c, /grid-template-columns:\s*minmax\(0,1fr\)\s*minmax\(/, '반응형 사이드바 폭(minmax)을 쓰지 않는다');
});

check('데스크톱 재배치는 JS 미디어쿼리 분기 없이 CSS 만으로 한다(마크업 중복 금지)', () => {
  const c = code(village);
  assert.ok(!/window\.matchMedia\(["'`]\(min-width:\s*900px\)["'`]\)/.test(c),
    'isDesktop 미디어쿼리 분기가 되살아났다 — 같은 블록을 두 벌 그리게 된다');
  assert.match(c, /grid-template-areas/, 'grid-template-areas 로 재배치하지 않는다');
});

// ── 5. 0 배지 — 새싹(레벨 0)을 "Lv.0" 으로 그대로 보여주지 않는다 ─────────
check('정원 레벨 0 을 "Lv.0" 으로 그대로 보여주지 않는다', () => {
  assert.ok(!/`\s*·\s*Lv\.\$\{gardenLevel\}`/.test(village) || /gardenLevel > 0/.test(village),
    'gardenLevel 0 조건 분기 없이 항상 Lv.{gardenLevel} 을 찍는다');
  assert.match(village, /gardenLevel > 0 \? ` · Lv\.\$\{gardenLevel\}` : " · 새싹"/,
    '레벨 0 일 때의 대체 문구(새싹)가 없다');
});

// ── 6. 보상·재화 쓰기는 offline 에서 전부 막힌다 ──────────────────────────
// (계약을 깨지 않았는지 "확인"하는 회귀 가드 — 이 목록이 그대로면 지급 경로가
//  전과 같은 자리에서 offline 가드를 통과해야만 불린다는 뜻이다.)
function assertGuardedBefore(src, guardRe, callRe, label) {
  const c = code(src);
  const re = new RegExp(callRe.source, 'g');
  let m;
  let found = 0;
  while ((m = re.exec(c))) {
    found++;
    const win = around(c, m.index, 1200, 0); // 호출 지점 "앞" 구간만 본다
    assert.match(win, guardRe, `${label}: "${callRe.source}" 호출 앞에 offline 가드가 없다`);
  }
  assert.ok(found > 0, `${label}: "${callRe.source}" 호출을 찾지 못했다 — 검사 자체가 무효`);
}

check('BeeVillage: 꿀 이슬·환전·구매·장착·물주기 쓰기가 모두 offline 가드 뒤에 있다', () => {
  const guard = /if\s*\(offline\)/;
  assertGuardedBefore(village, guard, /await collectDailyDew\(/, 'collectDailyDew');
  assertGuardedBefore(village, guard, /await exchangeStickerHoney\(/, 'exchangeStickerHoney');
  assertGuardedBefore(village, guard, /await buyOrEquipDeco\(/, 'buyOrEquipDeco');
  assertGuardedBefore(village, guard, /equipDeco\(roomCode/, 'equipDeco');
  assertGuardedBefore(village, guard, /await waterFriendGarden\(/, 'waterFriendGarden');
});

check('QuestBoard: 심부름·보너스·복구 지급이 모두 offline 가드 뒤에 있다', () => {
  const guard = /if\s*\(offline\)/;
  assertGuardedBefore(quest, guard, /claimQuestReward\(roomCode/, 'claimQuestReward');
  assertGuardedBefore(quest, guard, /claimBonusReward\(roomCode/, 'claimBonusReward');
  assertGuardedBefore(quest, guard, /recoverDayRewards\(roomCode/, 'recoverDayRewards');
});

check('BeeVillage: offline 가드 개수가 줄지 않았다(최소 7곳)', () => {
  const hits = code(village).match(/if\s*\(offline\b/g) || [];
  assert.ok(hits.length >= 7, `offline 가드가 ${hits.length}곳뿐이다 — 구독/쓰기 경로 중 하나가 가드를 잃었을 수 있다`);
});

// ── 7. dayKey 계산 · 라우팅 계약을 건드리지 않았다 ────────────────────────
check('QuestBoard: dayKey 는 여전히 dayKeyAt(tz) 한 곳에서 정한다', () => {
  assert.match(quest, /dayKeyAt\(Date\.now\(\),\s*tz\)/, 'evaluateDay 의 dayKey 계산이 사라졌다');
  assert.match(quest, /msUntilNextDay\(Date\.now\(\),\s*tz\)/, '자정 타이머 계산이 사라졌다');
});

check('QuestBoard: 심부름 클릭 이동(onGoTo)과 물주기 특수 처리가 남아있다', () => {
  assert.match(village, /event === "village_water"/, '물주기 심부름의 특수 이동 처리가 사라졐다');
  assert.match(village, /onQuestNavigate\?\.\(event\)/, '나머지 심부름의 상위 이동 위임이 사라졌다');
});

// ── 8. fixture 는 개발 전용이고 production 에서 404 ───────────────────────
check('quest fixture 는 production 에서 404 다', () => {
  assert.match(fixtureRoute, /process\.env\.NODE_ENV === "production"\) notFound\(\)/, 'production 차단이 없다');
  assert.ok(!/firebase|getClientDb|subscribe/.test(fixture), 'fixture 가 Firebase 를 건드린다');
});

check('BeeVillage: fixture 주입 시 QuestBoard 에도 항상 offline fixture 를 내려보낸다', () => {
  assert.match(village, /const offline = !!fixture;/, 'BeeVillage 의 offline 판정이 사라졌다');
  assert.match(
    village,
    /fixture\?\.quest \?\? \{ quests: \[\], state: \{\} \}/,
    'village 가 offline 인데 quest fixture 를 안 받은 경우의 안전망이 사라졌다',
  );
});

console.log(`\n${count} checks passed — 실측·캡처는 reports/audit-20260913/{before,after}-village 참고`);

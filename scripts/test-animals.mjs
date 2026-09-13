/**
 * U05 내 동물 데이터 계약 — **실제로 실행해서** 검사한다.
 *
 * 공용 기기 섞임·동명이인 병합·렌더마다 바뀌는 폴백은 소스를 눈으로 읽어
 * 판단할 수 없다. lib/animals.ts 를 transpile 해 진짜로 돌린다
 * (scripts/test-learner-id.mjs 와 같은 방식).
 *   실행: node scripts/test-animals.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'bee-animals-'));
let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

const compile = (rel, out) => {
  const src = readFileSync(join(root, rel), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, out), js);
};

try {
  // animals.ts 가 learnerId.ts 의 contentHash 를 쓴다 — 둘 다 올려 실제 조합으로 돈다.
  compile('lib/learnerId.ts', 'learnerId.js');
  compile('lib/animals.ts', 'animals.js');
  // import "./learnerId" → "./learnerId.js" 로 바꿔 준다.
  const a = readFileSync(join(dir, 'animals.js'), 'utf8').replace(/["']\.\/learnerId["']/g, '"./learnerId.js"');
  writeFileSync(join(dir, 'animals.js'), a);
  const A = await import(pathToFileURL(join(dir, 'animals.js')));

  /* ── 목록과 allowlist ──────────────────────────────────────────── */

  check('동물 8종이고 잠금·가격·희귀도가 없다', () => {
    assert.equal(A.ANIMALS.length, 8);
    const want = ['rabbit', 'bear', 'cat', 'dog', 'fox', 'panda', 'penguin', 'otter'];
    assert.deepEqual(A.ANIMALS.map((x) => x.id), want, '8종 구성이 설계와 다르다');
    assert.equal(new Set(A.ANIMALS.map((x) => x.id)).size, 8, 'id 중복');
    for (const an of A.ANIMALS) {
      assert.ok(an.ko && an.emoji, `${an.id}: 이름/임시 표시 누락`);
      // 잠금·가격·희귀도·순위를 도입하지 않는다 — 모두 동등하다.
      for (const banned of ['locked', 'price', 'cost', 'rarity', 'rank', 'unlockAt']) {
        assert.ok(!(banned in an), `${an.id}: 서열/잠금 필드가 생겼다 (${banned})`);
      }
    }
  });

  check('allowlist 밖의 값은 거부한다', () => {
    for (const bad of ['dragon', 'RABBIT', '', ' rabbit', null, undefined, 1, {}, true]) {
      assert.equal(A.isAnimalId(bad), false, `허용되면 안 되는 값: ${String(bad)}`);
    }
    for (const an of A.ANIMALS) assert.equal(A.isAnimalId(an.id), true);
  });

  /* ── 결정적 폴백 ──────────────────────────────────────────────── */

  check('폴백은 같은 입력이면 항상 같다 (렌더마다 random 아님)', () => {
    for (let i = 0; i < 50; i++) {
      const id = `student-${i}`;
      const first = A.fallbackAnimal('1234', id);
      for (let k = 0; k < 5; k++) {
        assert.equal(A.fallbackAnimal('1234', id), first, `${id}: 호출마다 달라진다`);
      }
      assert.ok(A.isAnimalId(first));
    }
  });

  check('방이 다르면 배치가 달라지고, 한 반이 한 동물로 몰리지 않는다', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `learner-${i}`);
    const roomA = ids.map((i) => A.fallbackAnimal('1234', i));
    const roomB = ids.map((i) => A.fallbackAnimal('5678', i));
    assert.notDeepEqual(roomA, roomB, '방이 달라도 배치가 같다');
    // 30명이면 8종 중 최소 절반은 나와야 '여러 동물로 보인다' 고 할 수 있다.
    assert.ok(new Set(roomA).size >= 4, `한 방에 동물이 ${new Set(roomA).size}종뿐`);
    assert.ok(new Set(roomB).size >= 4);
  });

  /* ── 해석 순서 ────────────────────────────────────────────────── */

  check('프로필 선택이 스냅샷·폴백보다 우선한다', () => {
    const r = A.resolveAnimal({
      roomCode: '1234',
      authorLearnerId: 'L1',
      profiles: { L1: { avatarAnimalId: 'fox' } },
      snapshotAnimalId: 'bear',
      stableId: 'c-1',
    });
    assert.deepEqual(r, { id: 'fox', source: 'profile' });
  });

  check('프로필이 없으면 스냅샷, 스냅샷도 없으면 폴백', () => {
    const snap = A.resolveAnimal({
      roomCode: '1234', authorLearnerId: 'L9', profiles: {}, snapshotAnimalId: 'bear', stableId: 'c-1',
    });
    assert.deepEqual(snap, { id: 'bear', source: 'snapshot' });

    const fb = A.resolveAnimal({ roomCode: '1234', stableId: 'c-1' });
    assert.equal(fb.source, 'fallback');
    assert.equal(fb.id, A.fallbackAnimal('1234', 'c-1'));
  });

  check('프로필의 잘못된 값은 무시하고 다음 근거로 넘어간다', () => {
    const r = A.resolveAnimal({
      roomCode: '1234', authorLearnerId: 'L1',
      profiles: { L1: { avatarAnimalId: 'dragon' } },
      snapshotAnimalId: 'cat', stableId: 'c-1',
    });
    assert.deepEqual(r, { id: 'cat', source: 'snapshot' }, '오염된 저장값이 그대로 쓰였다');
  });

  check('이름이 같아도 서로 다른 학습자의 동물이 섞이지 않는다', () => {
    // 동명이인 두 명 — learnerId 가 다르면 각자의 선택을 따른다.
    const profiles = { L1: { avatarAnimalId: 'fox' }, L2: { avatarAnimalId: 'panda' } };
    const a = A.resolveAnimal({ roomCode: '1234', authorLearnerId: 'L1', profiles, stableId: '김민준' });
    const b = A.resolveAnimal({ roomCode: '1234', authorLearnerId: 'L2', profiles, stableId: '김민준' });
    assert.equal(a.id, 'fox');
    assert.equal(b.id, 'panda');
    // 이름만으로는 프로필을 찾지 않는다 — learnerId 없이 넘기면 폴백이어야 한다.
    const byName = A.resolveAnimal({ roomCode: '1234', profiles, stableId: '김민준' });
    assert.equal(byName.source, 'fallback', '이름으로 프로필을 찾아 합쳤다');
  });

  check('공용 기기: 같은 clientId 라도 학습자가 다르면 동물이 섞이지 않는다', () => {
    // A→B→A 가 같은 태블릿(clientId 동일)을 돌려 쓴다.
    const sharedClient = 'device-uuid-1';
    const profiles = { LA: { avatarAnimalId: 'otter' }, LB: { avatarAnimalId: 'dog' } };
    const seq = ['LA', 'LB', 'LA'].map((lid) =>
      A.resolveAnimal({ roomCode: '1234', authorLearnerId: lid, profiles, stableId: sharedClient }).id);
    assert.deepEqual(seq, ['otter', 'dog', 'otter'], '공용 기기에서 선택이 섞였다');
  });

  /* ── 저장 전이 ────────────────────────────────────────────────── */

  check('선택·변경·해제가 프로필에 반영되고 updatedAt 이 움직인다', () => {
    const base = { learnerId: 'L1', displayName: '학생 A', updatedAt: 100 };
    const picked = A.setLearnerAnimal(base, 'fox', 200);
    assert.equal(picked.avatarAnimalId, 'fox');
    assert.equal(picked.updatedAt, 200);
    assert.equal(base.avatarAnimalId, undefined, '원본을 변형했다');

    const changed = A.setLearnerAnimal(picked, 'bear', 300);
    assert.equal(changed.avatarAnimalId, 'bear');

    const cleared = A.setLearnerAnimal(changed, null, 400);
    assert.ok(!('avatarAnimalId' in cleared), '해제해도 필드가 남아 있다');

    // 같은 값 재선택은 새 객체를 만들지 않는다(불필요한 쓰기 방지).
    assert.equal(A.setLearnerAnimal(picked, 'fox', 999), picked);
  });

  check('허용되지 않은 동물 저장은 조용히 무시하지 않고 던진다', () => {
    const base = { updatedAt: 1 };
    assert.throws(() => A.setLearnerAnimal(base, 'dragon', 2), /허용되지 않은 동물/);
    assert.throws(() => A.setLearnerAnimal(base, 'RABBIT', 2));
  });

  console.log(`\n${count} checks passed — 실제 저장/복원, 다른 기기 복원, 저장 실패
안내는 화면 검수와 운영 연결에서 따로 확인한다(현재 미검증).`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

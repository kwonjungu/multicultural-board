/**
 * U06 반응 데이터 계약 — **실제로 실행해서** 검사한다.
 *
 * 옛 `likes/{clientId} === true` 호환은 소스를 눈으로 읽어 판단할 수 없는
 * 종류의 규칙이라, lib/cardReactions.ts 를 transpile 해 진짜로 돌린다.
 * (정적 소스 검사는 scripts/test-board-screen.mjs 쪽에 있다.)
 *   실행: node scripts/test-card-reactions.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'bee-react-'));
let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

try {
  /* cardReactions 는 이제 beeMoods 를 가져온다 — 둘 다 옮겨 놓아야 import 가 풀린다. */
  const tsc = (rel) => ts.transpileModule(readFileSync(join(root, rel), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, 'beeMoods.mjs'), tsc('lib/beeMoods.ts'));
  writeFileSync(join(dir, 'r.mjs'), tsc('lib/cardReactions.ts').split('./beeMoods').join('./beeMoods.mjs'));
  const { readReactions, nextReaction, REACTIONS, ALL_REACTIONS, LEGACY_REACTIONS } =
    await import(pathToFileURL(join(dir, 'r.mjs')));

  /* ── 종류 목록 ─────────────────────────────────────────────────── */

  check('고를 수 있는 공감은 꿀벌 감정 20종이다', () => {
    const ids = REACTIONS.map((r) => r.id);
    assert.equal(ids.length, 20, `고를 수 있는 공감이 ${ids.length}종`);
    assert.equal(new Set(ids).size, 20, 'id 중복');
    for (const r of REACTIONS) assert.ok(r.pickable, `${r.id} 가 고를 수 없다`);
  });

  check('옛 5종 id 는 지우지 않았다 — 저장된 값이 그대로 그 문자열이다', () => {
    const all = ALL_REACTIONS.map((r) => r.id);
    for (const legacyId of ['like', 'thanks', 'nice', 'cheer', 'same']) {
      assert.ok(all.includes(legacyId), `옛 반응 id 가 사라졌다: ${legacyId}`);
    }
    // 옛 것은 더 고를 수 없어야 한다(새로 쌓이면 안 된다).
    for (const r of LEGACY_REACTIONS) assert.equal(r.pickable, false, `${r.id} 가 아직 고를 수 있다`);
    // 그림은 반드시 꿀벌 감정 중 하나를 빌려야 한다 — 빈 칸이면 깨져 보인다.
    const moodIds = new Set(REACTIONS.map((r) => r.id));
    for (const r of LEGACY_REACTIONS) assert.ok(moodIds.has(r.art), `${r.id} 의 그림 ${r.art} 가 목록에 없다`);
  });

  /* ── 옛 true 호환 ──────────────────────────────────────────────── */

  check('옛 true 는 좋아요로 집계되고 사라지지 않는다', () => {
    const s = readReactions({ a: true, b: true, c: true });
    assert.equal(s.counts.like, 3, '옛 좋아요가 집계에서 사라졌다');
    assert.equal(s.legacy, 3);
    assert.equal(s.total, 3);
  });

  check('옛 true 와 새 문자열이 섞여도 두 번 세지 않는다', () => {
    const s = readReactions({
      a: true, b: 'like', c: 'thanks', d: 'same', e: 'nice', f: 'cheer',
    });
    assert.equal(s.counts.like, 2, 'true 1 + like 1 = 2 여야 한다');
    assert.equal(s.counts.thanks, 1);
    assert.equal(s.counts.same, 1);
    assert.equal(s.counts.nice, 1);
    assert.equal(s.counts.cheer, 1);
    assert.equal(s.legacy, 1, 'legacy 는 아직 문자열이 아닌 항목 수');
    assert.equal(s.total, 6, '합계가 실제 사용자 수와 다르다');
    // legacy 를 다시 더하면 안 된다.
    assert.equal(s.total, Object.keys({ a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 }).length);
  });

  check('옛 true 사용자가 새 반응으로 바꾸면 합계가 유지된다', () => {
    const before = readReactions({ me: true, x: 'nice' });
    assert.equal(before.total, 2);
    assert.equal(before.counts.like, 1);
    // 같은 clientId 자리의 값이 교체된다 — 한 사람이 두 칸을 차지할 수 없다.
    const after = readReactions({ me: 'cheer', x: 'nice' });
    assert.equal(after.total, 2, '전환하면서 합계가 변했다');
    assert.equal(after.counts.like, 0);
    assert.equal(after.counts.cheer, 1);
    assert.equal(after.legacy, 0);
  });

  check('내 반응은 옛 true 여도 좋아요로 선택 표시된다', () => {
    assert.equal(readReactions({ me: true }, 'me').mine, 'like');
    assert.equal(readReactions({ me: 'thanks' }, 'me').mine, 'thanks');
    assert.equal(readReactions({ other: 'thanks' }, 'me').mine, null);
  });

  /* ── 오염 방어 ─────────────────────────────────────────────────── */

  check('알 수 없는 값은 개수를 부풀리지 않는다', () => {
    const s = readReactions({ a: 'wat', b: '', c: false, d: 'like' });
    assert.equal(s.total, 1, '알 수 없는 값이 집계에 들어갔다');
    assert.equal(s.counts.like, 1);
    assert.equal(s.legacy, 0);
  });

  check('빈 입력에서 음수나 NaN 이 나오지 않는다', () => {
    for (const raw of [null, undefined, {}]) {
      const s = readReactions(raw, 'me');
      assert.equal(s.total, 0);
      assert.equal(s.mine, null);
      for (const r of REACTIONS) {
        assert.equal(s.counts[r.id], 0);
        assert.ok(Number.isInteger(s.counts[r.id]) && s.counts[r.id] >= 0);
      }
    }
  });

  /* ── 선택 전이 ─────────────────────────────────────────────────── */

  check('같은 반응 재선택은 취소, 다른 반응은 교체', () => {
    assert.equal(nextReaction(null, 'like'), 'like');
    assert.equal(nextReaction('like', 'like'), null, '재선택이 취소가 아니다');
    assert.equal(nextReaction('like', 'cheer'), 'cheer', '교체가 되지 않는다');
    assert.equal(nextReaction('thanks', 'thanks'), null);
  });

  check('연속 전이에서 개수가 음수로 가거나 중복되지 않는다', () => {
    // 한 사용자가 여러 번 바꿔도 노드에는 항상 값 하나뿐이다.
    let mine = null;
    const node = {};
    for (const pick of ['like', 'like', 'cheer', 'nice', 'nice', 'thanks']) {
      mine = nextReaction(mine, pick);
      if (mine) node.me = mine; else delete node.me;
      const s = readReactions(node, 'me');
      assert.ok(s.total === (mine ? 1 : 0), `총합이 어긋났다 (mine=${mine})`);
      assert.equal(s.mine, mine);
      for (const r of REACTIONS) assert.ok(s.counts[r.id] >= 0);
    }
    assert.equal(mine, 'thanks');
  });

  console.log(`\n${count} checks passed — 화면 동작(패널 열기·Escape·바깥 클릭·
포커스 복원·연타 직렬화)은 fixture 캡처와 별도 검수에서 확인한다.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

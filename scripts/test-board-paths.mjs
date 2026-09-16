/**
 * 소통창 곁가지 데이터의 **저장 위치** 계약 — 실제로 실행해서 검사한다.
 *
 * ── 왜 이 검사가 따로 있는가 ──────────────────────────────────────────
 * 공감·답장은 원래 `rooms/{room}/cards/{cardId}/likes|comments` 로 카드 **안에**
 * 있었다. 보드는 `cards` 하나를 통째로 구독하는데, RTDB 의 onValue 는 하위
 * 어디가 바뀌어도 부모를 다시 쏜다. 그래서 아이 하나가 하트를 누를 때마다
 * 교실의 모든 기기가 카드 전체를 다시 받아 목록을 통째로 다시 그렸다.
 * 25명 수업에서 가장 느린 길이었다. 그래서 둘을 `cards` 의 **형제**로 옮겼다
 * (lib/boardPaths.ts).
 *
 * 문제는 옛 방이다. 운영 자격증명이 없어 마이그레이션을 돌릴 수 없으므로
 * 몇 달치 공감·답장이 카드 밑에 그대로 남는다. 그래서 **읽기는 둘 다, 쓰기는
 * 새 곳만** 이라는 규칙을 쓴다 — 옛 것을 바탕에 깔고 새 것을 위에 겹치며,
 * 같은 열쇠는 새 것이 이긴다(mergeById).
 *
 * 이 겹쳐 읽기가 맞는지는 **소스를 눈으로 읽어서는 판단할 수 없다.** 특히:
 *
 *   · 옛 공감을 누른 아이가 새 반응을 고르면 두 번 세지 않는가
 *     (열쇠가 같은 clientId 라 자리 하나가 갈아끼워질 뿐이어야 한다)
 *   · 옛 공감을 **취소**하면 정말 꺼지는가. 새 자리에서 지우기만 하면 바탕의
 *     옛 값이 다시 비쳐 나와 취소가 없던 일이 된다. 옛 자리를 직접 지우면
 *     되겠지만 그건 cards 를 건드리는 일이고, 우리가 고친 바로 그 길이 다시
 *     깨어난다 — 공감은 가장 자주 눌리는 버튼이라 예외를 둘 수 없다.
 *     그래서 새 자리에 `false` 가림표를 남긴다. readReactions 가 거짓값을
 *     세지 않는다는 성질에 기대는 것이라, 그 성질이 깨지면 여기서 잡아야 한다.
 *   · 옛 답장을 **승인**할 때 status 한 칸만 쓰면 안 된다. 새 자리에
 *     `{status:"approved"}` 뿐인 조각이 생기고, 새 것이 이기는 규칙 때문에
 *     그 조각이 본문 있는 옛 답장을 덮어 **글이 통째로 사라진다.** 전문을
 *     써야 한다. 아래에 그 함정을 대조군으로 같이 박아 둔다.
 *
 * 화면 쪽 정적 계약은 scripts/test-board-screen.mjs 가 본다.
 *   실행: node scripts/test-board-paths.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'board-paths-'));
let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

try {
  const tsc = (rel) => ts.transpileModule(readFileSync(join(root, rel), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  /* cardReactions 는 beeMoods 를 가져온다 — 둘 다 옮겨 놓아야 import 가 풀린다. */
  writeFileSync(join(dir, 'beeMoods.mjs'), tsc('lib/beeMoods.ts'));
  writeFileSync(join(dir, 'r.mjs'), tsc('lib/cardReactions.ts').split('./beeMoods').join('./beeMoods.mjs'));
  writeFileSync(join(dir, 'p.mjs'), tsc('lib/boardPaths.ts'));

  const { readReactions } = await import(pathToFileURL(join(dir, 'r.mjs')));
  const P = await import(pathToFileURL(join(dir, 'p.mjs')));
  const { mergeById } = P;

  /** 화면이 실제로 보는 값: 옛 자리 위에 새 자리를 겹쳐 센다. */
  const show = (legacy, fresh, me) => readReactions(mergeById(legacy, fresh), me);

  /* ── 위치 ──────────────────────────────────────────────────────────
     형제가 아니라 자식으로 되돌아가면 느린 길이 그대로 살아난다. */

  check('공감·답장은 cards 의 형제다 — 자식으로 되돌아가지 않았다', () => {
    assert.equal(P.cardLikesPath('1234', 'c1'), 'rooms/1234/cardLikes/c1');
    assert.equal(P.cardLikePath('1234', 'c1', 'stu-7'), 'rooms/1234/cardLikes/c1/stu-7');
    assert.equal(P.cardCommentsPath('1234', 'c1'), 'rooms/1234/cardComments/c1');
    assert.equal(P.cardCommentPath('1234', 'c1', 'm1'), 'rooms/1234/cardComments/c1/m1');
    assert.equal(P.roomCardCommentsPath('1234'), 'rooms/1234/cardComments');
    for (const [name, p] of Object.entries({
      cardLikesPath: P.cardLikesPath('1234', 'c1'),
      cardLikePath: P.cardLikePath('1234', 'c1', 'stu-7'),
      cardCommentsPath: P.cardCommentsPath('1234', 'c1'),
      cardCommentPath: P.cardCommentPath('1234', 'c1', 'm1'),
      roomCardCommentsPath: P.roomCardCommentsPath('1234'),
    })) {
      assert.ok(!p.includes('/cards/'), `${name} 가 cards 밑으로 되돌아갔다: ${p}`);
    }
  });

  check('옛 답장 자리는 지우기 위해서만 남겨 둔다', () => {
    // 가림표로는 삭제를 표현할 수 없다 — 없앴다고 해 놓고 데이터가 남는 쪽이 더 나쁘다.
    assert.equal(P.legacyCardCommentPath('1234', 'c1', 'm1'), 'rooms/1234/cards/c1/comments/m1');
  });

  /* ── 공감 겹쳐 읽기 ────────────────────────────────────────────────── */

  check('옛 방의 공감은 새 노드가 비어도 그대로 보인다', () => {
    // 마이그레이션이 없으므로 이게 깨지면 몇 달치 공감이 화면에서 사라진다.
    const s = show({ a: true, b: 'thanks', c: 'happy' }, null, 'me');
    assert.equal(s.total, 3, '옛 공감이 사라졌다');
    assert.equal(s.counts.like, 1, '옛 true 가 좋아요로 세어지지 않는다');
    assert.equal(s.counts.thanks, 1);
    assert.equal(s.counts.happy, 1);
  });

  check('옛 카드에 새 공감이 더해지면 그만큼만 는다', () => {
    const before = show({ a: true, b: 'thanks', c: 'happy' }, null, 'me');
    const after = show({ a: true, b: 'thanks', c: 'happy' }, { me: 'excited' }, 'me');
    assert.equal(before.total, 3);
    assert.equal(after.total, 4, '새 공감이 개수에 반영되지 않는다');
    assert.equal(after.mine, 'excited');
  });

  check('같은 아이의 옛 공감은 교체될 뿐 두 번 세지 않는다', () => {
    // 열쇠가 clientId 라 한 사람이 두 칸을 차지할 수 없다 — 겹쳐 읽기의 핵심.
    const s = show({ me: true, b: 'thanks' }, { me: 'cheer' }, 'me');
    assert.equal(s.total, 2, '한 사람이 두 번 세어졌다');
    assert.equal(s.counts.like, 0, '옛 값이 아직 남아 세어진다');
    assert.equal(s.counts.cheer, 1);
    assert.equal(s.mine, 'cheer');
  });

  check('옛 공감 취소는 false 가림표로 정확히 꺼진다', () => {
    // 새 자리에서 그냥 지우면 바탕의 옛 값이 다시 비쳐 나와 취소가 풀린다.
    const s = show({ me: 'happy', b: 'thanks' }, { me: false }, 'me');
    assert.equal(s.total, 1, '취소가 먹지 않았다 — 옛 값이 다시 비쳐 나온다');
    assert.equal(s.counts.happy, 0);
    assert.equal(s.mine, null, '취소했는데 아직 내가 고른 것으로 보인다');
    // 대조: 가림표 없이 지우기만 했다면 되살아났을 것이다.
    assert.equal(show({ me: 'happy', b: 'thanks' }, {}, 'me').total, 2);
  });

  check('취소한 뒤 다시 고르면 되살아난다', () => {
    const s = show({ me: 'happy' }, { me: 'curious' }, 'me');
    assert.equal(s.total, 1);
    assert.equal(s.mine, 'curious');
    assert.equal(s.counts.happy, 0, '옛 값과 새 값이 겹쳐 세어졌다');
  });

  check('옛 자리가 비어 있어도(새 방) 새 공감만으로 정상 동작한다', () => {
    // 새로 만든 방에는 바탕이 없다 — mergeById 가 없는 바탕을 그냥 넘겨야 한다.
    for (const legacy of [null, undefined, {}]) {
      const s = show(legacy, { me: 'hopeful', x: 'excited' }, 'me');
      assert.equal(s.total, 2);
      assert.equal(s.mine, 'hopeful');
    }
  });

  /* ── 답장 겹쳐 읽기 ────────────────────────────────────────────────── */

  check('옛 답장과 새 답장이 같이 보인다', () => {
    const legacy = { m1: { id: 'm1', text: '옛 답장', timestamp: 1 } };
    const merged = mergeById(legacy, { m2: { id: 'm2', text: '새 답장', timestamp: 2 } });
    assert.equal(Object.keys(merged).length, 2, '한쪽이 사라졌다');
    assert.equal(merged.m1.text, '옛 답장');
    assert.equal(merged.m2.text, '새 답장');
  });

  check('옛 답장 승인은 본문을 잃지 않고 승인만 반영된다', () => {
    const legacy = {
      m1: { id: 'm1', text: '옛 답장', translations: { ko: '옛 답장' }, timestamp: 1, status: 'pending' },
    };
    // 승인은 **전문을 통째로** 새 자리에 쓴다 — 그 답장 하나가 옮겨 오는 셈이다.
    const merged = mergeById(legacy, { m1: { ...legacy.m1, status: 'approved' } });
    assert.equal(merged.m1.text, '옛 답장', '승인하면서 본문이 사라졌다');
    assert.equal(merged.m1.translations.ko, '옛 답장', '승인하면서 번역이 사라졌다');
    assert.equal(merged.m1.status, 'approved', '승인이 반영되지 않았다');
  });

  check('대조군: status 조각만 썼다면 옛 답장 본문이 통째로 사라졌을 것이다', () => {
    // 이 함정을 피하려고 전문을 쓴다. 규칙이 되돌아가면 여기가 먼저 깨진다.
    const legacy = { m1: { id: 'm1', text: '옛 답장', timestamp: 1, status: 'pending' } };
    const bad = mergeById(legacy, { m1: { status: 'approved' } });
    assert.equal(bad.m1.text, undefined,
      '겹쳐 읽기가 더는 새 것을 우선하지 않는다 — 다른 가정이 깨졌을 수 있다');
  });

  console.log(`\n${count} checks passed — 화면 쪽 정적 계약은 scripts/test-board-screen.mjs 가 본다.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

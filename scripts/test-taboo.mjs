/**
 * 꿀벌 금칙어 순수 상태 회귀 테스트 — HARNESS TABOO-01 / TABOO-02.
 *
 * scripts/test-word-memory.mjs 와 같은 방식으로 TypeScript 를 런타임에
 * transpile 해서 reducer 만 직접 돌린다. React·DOM·Firebase 를 켜지 않으므로
 * 운영 방(1111)에 아무것도 쓰지 않는다.
 *
 * 이 suite 는 상태 전이만 검사한다. 실제 탭 전환/오디오/unmount 같은 UI
 * lifecycle 은 별도 하네스의 몫이며 여기 결과로 대신 주장하지 않는다.
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'bee-taboo-'));
try {
  const source = readFileSync(join(root, 'lib/tabooState.ts'), 'utf8');
  const out = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
  }});
  writeFileSync(join(dir, 'taboo.mjs'), out.outputText);
  const {
    tabooReducer: reduce, initialTabooState: init, remainingMs, currentCardId,
    isExpired, TABOO_MODES,
  } = await import(pathToFileURL(join(dir, 'taboo.mjs')));

  const T0 = 1000000;            // 고정 시작 시각 — 실제 시계를 쓰지 않는다
  const DECK = ['c1', 'c2', 'c3'];
  const start = (mode, opts = {}) => {
    const { deck = DECK, passes = 3, now = T0, roundId = 1 } = opts;
    return reduce(init(mode), { type: 'start', roundId, deck, mode, passes, now });
  };
  const answer = (s, cardId, result, now, roundId = s.roundId) =>
    reduce(s, { type: 'answer', roundId, cardId, result, now });

  let count = 0;
  const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

  check('start sets a wall-clock deadline per mode; free has none', () => {
    assert.equal(start('race').deadlineAt, T0 + TABOO_MODES.race.limitMs);
    assert.equal(start('paced').deadlineAt, T0 + TABOO_MODES.paced.limitMs);
    assert.equal(start('free').deadlineAt, null);
    assert.equal(remainingMs(start('free'), T0 + 999999), null);
    assert.equal(currentCardId(start('race')), 'c1');
  });

  check('correct answer before the deadline scores exactly once', () => {
    const s = answer(start('race'), 'c1', 'correct', T0 + 1000);
    assert.equal(s.score, 1);
    assert.deepEqual([...s.outcomes], [{ cardId: 'c1', result: 'correct' }]);
    assert.equal(currentCardId(s), 'c2');
  });

  check('TABOO-01 answer at/after the deadline adds no score and ends the round', () => {
    const s0 = start('race');
    const dl = s0.deadlineAt;
    const atDeadline = answer(s0, 'c1', 'correct', dl);
    assert.equal(atDeadline.score, 0, '만료 시각 정각의 정답은 점수가 없다');
    assert.equal(atDeadline.phase, 'result');
    assert.equal(atDeadline.endedBy, 'time');
    const late = answer(s0, 'c1', 'pass', dl + 5000);
    assert.equal(late.score, 0);
    assert.equal(late.passesLeft, s0.passesLeft, '만료 뒤 패스는 패스 수도 줄이지 않는다');
    assert.equal(late.outcomes.every((o) => o.result === 'missed'), true);
  });

  check('TABOO-01 five rapid taps on the same card produce one outcome', () => {
    let s = start('race');
    for (let i = 0; i < 5; i++) s = answer(s, 'c1', 'correct', T0 + 100 + i);
    assert.equal(s.score, 1);
    assert.equal(s.outcomes.filter((o) => o.cardId === 'c1').length, 1);
    assert.equal(s.idx, 1);
  });

  check('an answer for a card that is not on screen is ignored', () => {
    const s = start('race');
    assert.deepEqual(answer(s, 'c3', 'correct', T0 + 10), s, '아직 안 나온 카드');
    const after = answer(s, 'c1', 'correct', T0 + 10);
    assert.deepEqual(answer(after, 'c1', 'pass', T0 + 20), after, '이미 끝난 카드');
    assert.deepEqual(answer(s, 'nope', 'correct', T0 + 10), s, '없는 카드');
  });

  check('an event from an older round never touches the new round', () => {
    let s = start('race', { roundId: 1 });
    s = answer(s, 'c1', 'correct', T0 + 10);
    const fresh = reduce(s, { type: 'start', roundId: 2, deck: DECK, mode: 'race', passes: 3, now: T0 + 50000 });
    assert.equal(fresh.score, 0);
    const stale = answer(fresh, 'c1', 'correct', T0 + 50100, 1);
    assert.deepEqual(stale, fresh, '이전 roundId 의 이벤트는 무시');
    assert.equal(answer(fresh, 'c1', 'correct', T0 + 50100, 2).score, 1);
  });

  check('pass decrements the budget and stops at zero', () => {
    let s = start('paced', { deck: ['a', 'b', 'c', 'd'], passes: 1 });
    s = answer(s, 'a', 'pass', T0 + 10);
    assert.equal(s.passesLeft, 0);
    const blocked = answer(s, 'b', 'pass', T0 + 20);
    assert.deepEqual(blocked, s, '패스가 없으면 카드도 넘어가지 않는다');
    assert.equal(answer(s, 'b', 'correct', T0 + 20).score, 1);
  });

  check('running out of cards ends the round with no missed entries', () => {
    let s = start('race');
    s = answer(s, 'c1', 'correct', T0 + 1);
    s = answer(s, 'c2', 'pass', T0 + 2);
    s = answer(s, 'c3', 'correct', T0 + 3);
    assert.equal(s.phase, 'result');
    assert.equal(s.endedBy, 'deck');
    assert.equal(s.score, 2);
    assert.equal(s.outcomes.length, 3);
    assert.equal(s.outcomes.some((o) => o.result === 'missed'), false);
  });

  check('time-out marks every unplayed card missed exactly once', () => {
    const s0 = answer(start('race'), 'c1', 'correct', T0 + 1);
    const timedOut = reduce(s0, { type: 'tick', now: s0.deadlineAt + 1 });
    assert.equal(timedOut.phase, 'result');
    assert.deepEqual(timedOut.outcomes.map((o) => o.cardId), ['c1', 'c2', 'c3']);
    assert.deepEqual(timedOut.outcomes.map((o) => o.result), ['correct', 'missed', 'missed']);
    const again = reduce(timedOut, { type: 'tick', now: T0 + 999999 });
    assert.deepEqual(again, timedOut, 'tick 재실행이 결과를 부풀리지 않는다');
  });

  check('TABOO-02 paced pauses while hidden and returns the exact remaining time', () => {
    const s0 = start('paced');
    const hidden = reduce(s0, { type: 'visibility', hidden: true, now: T0 + 30000 });
    assert.equal(hidden.paused, true);
    assert.equal(hidden.remainingMs, 60000);
    assert.equal(isExpired(hidden, T0 + 999999), false, '일시정지 중에는 만료되지 않는다');
    assert.deepEqual(reduce(hidden, { type: 'tick', now: T0 + 999999 }), hidden);
    const back = reduce(hidden, { type: 'visibility', hidden: false, now: T0 + 130000 });
    assert.equal(back.phase, 'play');
    assert.equal(remainingMs(back, T0 + 130000), 60000, '멈춘 만큼만 돌려주고 더 주지 않는다');
    assert.equal(back.deadlineAt, T0 + 190000);
  });

  check('TABOO-02 race keeps the wall clock running while hidden', () => {
    const s0 = start('race');
    const hidden = reduce(s0, { type: 'visibility', hidden: true, now: T0 + 30000 });
    assert.equal(hidden.paused, false, '경쟁 모드는 멈추지 않는다');
    const back = reduce(hidden, { type: 'visibility', hidden: false, now: T0 + 130000 });
    assert.equal(back.phase, 'result');
    assert.equal(back.endedBy, 'time');
    assert.equal(back.score, 0);
  });

  check('free practice mode never expires and never gains silent time', () => {
    let s = start('free');
    assert.deepEqual(reduce(s, { type: 'tick', now: T0 + 10000000 }), s);
    const hidden = reduce(s, { type: 'visibility', hidden: true, now: T0 + 1000 });
    const back = reduce(hidden, { type: 'visibility', hidden: false, now: T0 + 500000 });
    assert.equal(back.deadlineAt, null);
    assert.equal(remainingMs(back, T0 + 500000), null);
    s = answer(back, 'c1', 'correct', T0 + 900000);
    assert.equal(s.score, 1, '제한시간 없는 연습에서는 늦은 정답도 정답이다');
  });

  check('quit closes the round without scoring the rest', () => {
    const s = reduce(answer(start('paced'), 'c1', 'correct', T0 + 5), { type: 'quit' });
    assert.equal(s.phase, 'result');
    assert.equal(s.endedBy, 'quit');
    assert.equal(s.score, 1);
    assert.equal(s.outcomes.length, 3);
  });

  check('20,000 deterministic actions preserve every invariant', () => {
    const modes = ['free', 'paced', 'race'];
    const ids = ['c1', 'c2', 'c3', 'ghost'];
    let seed = 99, rounds = 0, timeEnds = 0, deckEnds = 0;
    const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    let mode = 'race';
    let s = start(mode, { roundId: 1 });
    let now = T0, roundId = 1;
    for (let i = 0; i < 20000; i++) {
      const prev = s;
      now += rnd() % 9000;                       // 시계는 절대 뒤로 가지 않는다
      const expiredBefore = isExpired(prev, now);
      const pick = rnd() % 10;
      if (pick < 5) {
        s = answer(s, ids[rnd() % ids.length], rnd() % 2 ? 'correct' : 'pass', now,
          rnd() % 8 === 0 ? roundId - 1 : roundId);   // 가끔 오래된 라운드 이벤트를 섞는다
      } else if (pick < 7) {
        s = reduce(s, { type: 'tick', now });
      } else if (pick < 9) {
        s = reduce(s, { type: 'visibility', hidden: rnd() % 2 === 0, now });
      } else if (s.phase === 'result') {
        rounds++;
        if (s.endedBy === 'time') timeEnds++;
        if (s.endedBy === 'deck') deckEnds++;
        roundId++; mode = modes[rnd() % modes.length];
        s = reduce(s, { type: 'start', roundId, deck: DECK, mode, passes: rnd() % 4, now });
      }

      // 불변식
      assert.ok(s.idx <= s.deck.length);
      assert.ok(s.passesLeft >= 0);
      assert.equal(new Set(s.outcomes.map((o) => o.cardId)).size, s.outcomes.length, '같은 카드 결과는 1개');
      assert.ok(s.outcomes.every((o) => s.deck.includes(o.cardId)), '덱에 없는 카드가 결과에 들어갔다');
      assert.equal(s.score, s.outcomes.filter((o) => o.result === 'correct').length, '점수 = 정답 결과 수');
      assert.ok(s.score <= s.deck.length);
      if (s.phase === 'result') assert.equal(s.outcomes.length, s.deck.length, '결과에는 모든 카드가 정확히 한 번');
      if (s.paused) assert.equal(s.deadlineAt, null);
      if (s.phase === 'play' && !TABOO_MODES[s.mode].pauseWhenHidden) assert.equal(s.paused, false);
      if (s.roundId === prev.roundId) {
        assert.ok(s.score >= prev.score && s.score <= prev.score + 1, '한 액션이 점수를 2 이상 올릴 수 없다');
        // 만료 뒤에는 절대 점수가 오르지 않는다
        if (expiredBefore) assert.equal(s.score, prev.score);
      }
    }
    assert.ok(rounds > 20, `라운드 재시작이 너무 적다 (${rounds})`);
    assert.ok(timeEnds > 0 && deckEnds > 0, `두 종료 경로 모두 밟아야 한다 (time=${timeEnds}, deck=${deckEnds})`);
    console.log(`      (rounds=${rounds}, time-outs=${timeEnds}, deck-outs=${deckEnds})`);
  });

  console.log(`${count} checks passed. 상태 전이만 검사했다 — 탭 전환/오디오/unmount 는 별도 UI 하네스.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

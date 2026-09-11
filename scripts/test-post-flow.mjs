/**
 * 작업 C-03/C-04 검사 — 두 부분.
 *
 *  (a) lib/postDraftState.ts 순수 reducer 단위 테스트.
 *      scripts/test-word-memory.mjs 와 같은 방식으로 TypeScript 를 런타임
 *      transpile 해서 import 한다. 그래서 postDraftState.ts 는 다른 모듈을
 *      import 하지 않아야 한다.
 *  (b) 설계서가 금지/요구한 것이 코드에 남아 있는지 보는 정적 계약 검사.
 *      이것은 DOM 테스트가 아니다 — POST-01~03·IME-01·STREAM-01 의 실제 클릭/
 *      스트림 검증은 HARNESS 대로 Q 가 따로 구현한다. 치수/시각 실측은
 *      scripts/shot-post.mjs 가 브라우저로 잰다.
 *
 *   실행: node scripts/test-post-flow.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

const dir = mkdtempSync(join(tmpdir(), 'bee-post-'));
try {
  // ── (a) 순수 reducer ────────────────────────────────────────────────
  const source = read('lib/postDraftState.ts');
  assert.ok(!/^\s*import\s/m.test(source),
    'postDraftState.ts 는 import 를 가지면 안 된다 — 이 테스트가 단일 파일 transpile 로 돈다');
  const out = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
  }});
  writeFileSync(join(dir, 'post.mjs'), out.outputText);
  const {
    postDraftReducer: reduce,
    initialPostDraft: init,
    submitBlock,
    hasContent,
    isSettled,
    createClientRequestId,
  } = await import(pathToFileURL(join(dir, 'post.mjs')));

  const run = (steps, start) => steps.reduce(reduce, start ?? init());
  const typed = (text) => [{ type: 'edit', patch: { text } }];
  const upToPreview = (text) => [...typed(text), { type: 'preview' }];

  check('작성 → 미리보기 → 올리기 → 서버 확인 이 한 방향으로 흐른다', () => {
    const s1 = run(typed('오늘 급식이 맛있었어'));
    assert.equal(s1.phase, 'compose');
    const s2 = reduce(s1, { type: 'preview' });
    assert.equal(s2.phase, 'preview');
    const s3 = reduce(s2, { type: 'submit', requestId: 'rq1' });
    assert.equal(s3.phase, 'sending');
    assert.equal(s3.attempts, 1);
    const s4 = reduce(s3, { type: 'serverAccepted', requestId: 'rq1' });
    assert.equal(s4.phase, 'published');
    assert.equal(s4.serverConfirmed, true);
  });

  check('로컬 에코를 서버 저장 완료로 쓰지 않는다 (POST-02)', () => {
    const sending = run([...upToPreview('아직 확인 안 됨'), { type: 'submit', requestId: 'rq1' }]);
    assert.equal(sending.localEcho, true, '보내는 동안 화면에는 먼저 보인다');
    assert.equal(sending.serverConfirmed, false, '그건 저장 완료가 아니다');
    assert.equal(isSettled(sending), false);
    // 부모가 결과를 알려주지 않는 경로도 성공으로 승격되지 않는다.
    const unknown = reduce(sending, { type: 'serverUnknown', requestId: 'rq1' });
    assert.equal(unknown.phase, 'sentUnconfirmed');
    assert.equal(unknown.serverConfirmed, false);
    assert.equal(isSettled(unknown), false);
  });

  check('실패 → 재시도 → 성공: 본문이 보존되고 카드는 하나다 (POST-01)', () => {
    const text = '친구랑 공놀이를 했어';
    const failed = run([
      ...upToPreview(text),
      { type: 'submit', requestId: 'rq-a' },
      { type: 'serverRejected', requestId: 'rq-a', error: 'server' },
    ]);
    assert.equal(failed.phase, 'failed');
    assert.equal(failed.draft.text, text, '실패해도 아이가 쓴 글은 남는다');
    assert.equal(failed.localEcho, false, '저장 안 된 카드를 화면에 남기지 않는다');
    assert.equal(failed.error, 'server');

    const retry = reduce(failed, { type: 'submit', requestId: 'rq-DIFFERENT' });
    assert.equal(retry.clientRequestId, 'rq-a', '재시도는 같은 id 를 다시 보낸다');
    assert.equal(retry.attempts, 2);
    const ok = reduce(retry, { type: 'serverAccepted', requestId: 'rq-a' });
    assert.equal(ok.phase, 'published');
    assert.equal(ok.draft.text, text);
  });

  check('성공 후 중복 전송·중복 응답을 무시한다', () => {
    const ok = run([
      ...upToPreview('한 번만 올라간다'),
      { type: 'submit', requestId: 'rq1' },
      { type: 'serverAccepted', requestId: 'rq1' },
    ]);
    assert.deepEqual(reduce(ok, { type: 'submit', requestId: 'rq1' }), ok);
    assert.deepEqual(reduce(ok, { type: 'serverAccepted', requestId: 'rq1' }), ok);
    assert.deepEqual(reduce(ok, { type: 'serverRejected', requestId: 'rq1', error: 'server' }), ok,
      '늦게 온 실패가 성공을 덮지 않는다');
    assert.equal(submitBlock(ok), 'settled');
  });

  check('오래된/다른 요청의 응답은 버린다 (abort 후 늦은 응답)', () => {
    const sending = run([...upToPreview('취소한 요청'), { type: 'submit', requestId: 'rq-new' }]);
    assert.deepEqual(reduce(sending, { type: 'serverAccepted', requestId: 'rq-old' }), sending);
    assert.deepEqual(reduce(sending, { type: 'serverRejected', requestId: 'rq-old', error: 'network' }), sending);
    assert.deepEqual(reduce(sending, { type: 'serverUnknown', requestId: 'rq-old' }), sending);
    // 보내지도 않았는데 도착한 응답도 버린다.
    const composing = run(typed('아직 안 보냄'));
    assert.deepEqual(reduce(composing, { type: 'serverAccepted', requestId: 'rq-ghost' }), composing);
  });

  check('교사 승인 모드는 공개 성공으로 오인시키지 않는다 (POST-03)', () => {
    const pend = run([
      ...upToPreview('선생님이 먼저 본다'),
      { type: 'submit', requestId: 'rq1', approval: true },
      { type: 'serverAccepted', requestId: 'rq1', approval: true },
    ]);
    assert.equal(pend.phase, 'awaitingReview');
    assert.notEqual(pend.phase, 'published');
    assert.equal(pend.awaitingTeacher, true);
    assert.equal(pend.serverConfirmed, true, '서버에는 저장됐다 — 다만 공개는 아니다');
  });

  check('보내는 중에는 내용이 바뀌지 않고, 되돌아가지도 않는다', () => {
    const sending = run([...upToPreview('보내는 중'), { type: 'submit', requestId: 'rq1' }]);
    assert.deepEqual(reduce(sending, { type: 'edit', patch: { text: '몰래 수정' } }), sending);
    assert.deepEqual(reduce(sending, { type: 'back' }), sending);
    assert.equal(submitBlock(sending), 'inFlight');
    assert.deepEqual(reduce(sending, { type: 'submit', requestId: 'rq2' }), sending, '연타해도 한 번만 나간다');
  });

  check('실패 뒤 내용을 고치면 다른 글이므로 새 id 를 받는다', () => {
    const failed = run([
      ...upToPreview('처음 쓴 글'),
      { type: 'submit', requestId: 'rq-a' },
      { type: 'serverRejected', requestId: 'rq-a', error: 'network' },
    ]);
    const edited = reduce(failed, { type: 'edit', patch: { text: '고쳐 쓴 글' } });
    assert.equal(edited.phase, 'compose');
    assert.equal(edited.clientRequestId, null, '내용이 달라졌으면 중복 방지 id 를 물려주지 않는다');
    assert.equal(edited.draft.text, '고쳐 쓴 글');
    const resent = run([{ type: 'preview' }, { type: 'submit', requestId: 'rq-b' }], edited);
    assert.equal(resent.clientRequestId, 'rq-b');
    assert.equal(resent.attempts, 2, '시도 횟수는 줄지 않는다');
  });

  check('빈 글은 보내지 않고, 왜 못 누르는지 코드로 알려준다', () => {
    const empty = init();
    assert.equal(hasContent(empty.draft), false);
    assert.equal(submitBlock(empty), 'empty');
    assert.deepEqual(reduce(empty, { type: 'preview' }), empty);
    assert.deepEqual(reduce(run(typed('   ')), { type: 'preview' }).phase, 'compose', '공백만도 빈 글이다');
    // 사진/그림은 본문이 없어도 올릴 수 있다.
    const photo = run([{ type: 'edit', patch: { kind: 'image', mediaRef: 'photo_1' } }]);
    assert.equal(hasContent(photo.draft), true);
    assert.equal(reduce(photo, { type: 'preview' }).phase, 'preview');
  });

  check('미리보기를 건너뛰고 바로 전송할 수 없다', () => {
    const composing = run(typed('바로 보내기 시도'));
    assert.deepEqual(reduce(composing, { type: 'submit', requestId: 'rq1' }), composing);
  });

  check('clientRequestId 는 매번 다른 값을 만든다', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createClientRequestId()));
    assert.equal(ids.size, 200);
  });

  check('20,000개 결정적 무작위 입력에서 불변식이 깨지지 않는다', () => {
    const IDS = ['rq-1', 'rq-2', 'rq-stale'];
    const ERRORS = ['network', 'server', 'rejected', 'tooLarge'];
    const TEXTS = ['', '가', '오늘 있었던 일', '   ', 'a'.repeat(300)];
    let seed = 17;
    const rnd = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };

    let s = init();
    let settledCount = 0;
    for (let i = 0; i < 20000; i++) {
      const prev = s;
      const pick = rnd(9);
      let action;
      if (pick === 0) action = { type: 'edit', patch: { text: TEXTS[rnd(TEXTS.length)] } };
      else if (pick === 1) action = { type: 'edit', patch: { kind: 'image', mediaRef: rnd(2) ? 'photo' : null } };
      else if (pick === 2) action = { type: 'preview' };
      else if (pick === 3) action = { type: 'back' };
      else if (pick === 4) action = { type: 'submit', requestId: IDS[rnd(IDS.length)], approval: rnd(2) === 0 };
      else if (pick === 5) action = { type: 'serverAccepted', requestId: IDS[rnd(IDS.length)], approval: rnd(2) === 0 };
      else if (pick === 6) action = { type: 'serverRejected', requestId: IDS[rnd(IDS.length)], error: ERRORS[rnd(ERRORS.length)] };
      else if (pick === 7) action = { type: 'serverUnknown', requestId: IDS[rnd(IDS.length)] };
      else action = { type: 'reset' };

      s = reduce(s, action);

      // 1. 확정 상태와 serverConfirmed 는 서로를 정확히 함의한다.
      assert.equal(isSettled(s), s.serverConfirmed, `phase ${s.phase} 와 serverConfirmed 가 어긋났다`);
      // 2. 서버가 확정하지 않은 채 공개/승인대기로 가지 않는다.
      assert.ok(!(s.phase === 'published' && s.awaitingTeacher));
      // 3. 응답은 자기 id 에만 반응한다 — 다른 id 면 상태가 그대로여야 한다.
      if ((action.type === 'serverAccepted' || action.type === 'serverRejected' || action.type === 'serverUnknown')
          && action.requestId !== prev.clientRequestId) {
        assert.deepEqual(s, prev, '다른 id 의 응답이 상태를 바꿨다');
      }
      // 4. 시도 횟수는 reset 이 아닌 한 줄지 않는다.
      if (action.type !== 'reset') assert.ok(s.attempts >= prev.attempts);
      // 5. 본문은 edit/reset 으로만 바뀐다 — 실패해도 사라지지 않는다.
      if (action.type !== 'edit' && action.type !== 'reset') {
        assert.equal(s.draft.text, prev.draft.text, '본문이 저절로 바뀌었다');
      }
      // 6. 성공은 한 번만 — 확정 뒤에는 reset 말고 어떤 것도 상태를 바꾸지 않는다.
      if (isSettled(prev)) {
        if (action.type === 'reset') { assert.equal(s.phase, 'compose'); }
        else assert.deepEqual(s, prev, '확정 뒤에 상태가 또 바뀌었다');
      }
      if (!isSettled(prev) && isSettled(s)) settledCount++;
    }
    assert.ok(settledCount > 0, '무작위 루프가 성공 경로를 한 번도 밟지 못했다');
  });

  // ── (b) 정적 계약 ──────────────────────────────────────────────────
  const post = read('components/PostModal.tsx');
  const tutor = read('components/TutorChat.tsx');
  const fixture = read('app/ux-fixture/post/fixture.tsx');
  const fixturePage = read('app/ux-fixture/post/page.tsx');
  /** 주석 속 설명이 금지 패턴에 걸리지 않게 코드만 남긴다. */
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  check('고정 px 글자 크기가 0개다', () => {
    for (const [name, src] of [['PostModal', post], ['TutorChat', tutor]]) {
      const c = code(src);
      const inline = c.match(/fontSize:\s*["']?\d/g) || [];
      assert.deepEqual(inline, [], `${name}: 인라인 px 글자 크기 ${inline.join(', ')}`);
      const css = c.match(/font-size:\s*[\d.]+px/g) || [];
      assert.deepEqual(css, [], `${name}: CSS 고정 px 글자 크기 ${css.join(', ')}`);
      assert.ok(/--ux-font-/.test(c), `${name}: 토큰 글자 크기를 쓰지 않는다`);
    }
  });

  check('zoom / transform:scale 확대와 100vh 잠금을 쓰지 않는다', () => {
    for (const [name, src] of [['PostModal', post], ['TutorChat', tutor]]) {
      const c = code(src);
      assert.ok(!/\bzoom\s*:/.test(c), `${name}: zoom 확대 금지`);
      assert.ok(!/transform:\s*scale/.test(c), `${name}: transform:scale 확대 금지`);
      assert.ok(!/100vh/.test(c), `${name}: 100vh 고정 금지 — svh/dvh 를 쓸 것`);
      assert.ok(!/overflow:\s*hidden/.test(c), `${name}: 화면 잠금 금지`);
    }
    assert.match(code(post), /100dvh/, 'PostModal: 동적 뷰포트 높이를 쓸 것');
    assert.match(code(tutor), /100dvh/, 'TutorChat: 동적 뷰포트 높이를 쓸 것');
  });

  check('모바일 키보드에서 입력·올리기가 가려지지 않게 visualViewport 를 쓴다', () => {
    for (const [name, src] of [['PostModal', post], ['TutorChat', tutor]]) {
      assert.match(src, /visualViewport/, `${name}: visualViewport 대응 없음`);
    }
    assert.match(code(post), /env\(safe-area-inset-bottom/, 'PostModal: safe-area 여백 없음');
    assert.match(code(post), /overflow-y:\s*auto/, 'PostModal: 시트가 넘칠 때 스크롤할 수 있어야 한다');
  });

  check('조합 중 Enter/Ctrl+Enter 를 전송으로 쓰지 않는다 (IME-01)', () => {
    for (const [name, src] of [['PostModal', post], ['TutorChat', tutor]]) {
      assert.match(src, /isComposing/, `${name}: IME 조합 검사 없음`);
      // Enter 처리 블록 안에 반드시 isComposing 가드가 함께 있어야 한다.
      const handlers = src.match(/e\.key !== "Enter"[\s\S]{0,220}/g) || [];
      assert.ok(handlers.length > 0, `${name}: Enter 처리부를 찾지 못했다`);
      for (const h of handlers) assert.match(h, /isComposing/, `${name}: Enter 처리에 조합 가드가 없다`);
      assert.ok(!/e\.key === "Enter"\)\s*handleSend\(\)/.test(code(src)), `${name}: 가드 없는 Enter 전송`);
    }
  });

  check('못 누르는 버튼은 disabled 가 아니라 aria-disabled + 이유 안내다', () => {
    for (const [name, src] of [['PostModal', post], ['TutorChat', tutor]]) {
      const c = code(src);
      assert.match(c, /aria-disabled=/, `${name}: aria-disabled 없음`);
      const bare = c.match(/(?<!aria-)\bdisabled=\{/g) || [];
      assert.deepEqual(bare, [], `${name}: disabled 로 막으면 왜 못 누르는지 알 수 없다`);
    }
    // 이유 문구가 실제로 화면에 뜨는 경로가 있어야 한다.
    assert.match(post, /blockHint/, 'PostModal: 못 누르는 이유 안내 없음');
    assert.match(post, /postNeedText|postBusyWait/, 'PostModal: 이유 문구 키 없음');
    assert.match(tutor, /blockHint/, 'TutorChat: 못 누르는 이유 안내 없음');
  });

  check('아이콘 단독 버튼을 만들지 않는다', () => {
    for (const [name, src] of [['PostModal', post], ['TutorChat', tutor]]) {
      // aria-hidden 아이콘 옆에는 반드시 글자가 온다 (t(...) 또는 텍스트 노드).
      const iconOnly = src.match(/<span aria-hidden>[^<]*<\/span>\s*<\/button>/g) || [];
      assert.deepEqual(iconOnly, [], `${name}: 라벨 없는 아이콘 버튼 ${iconOnly.join(' ')}`);
      assert.ok(!/aria-label="close"/.test(src), `${name}: 글자 라벨 없는 닫기 버튼`);
    }
  });

  check('로컬 에코와 서버 확정이 코드에서 구분돼 있다 (POST-02)', () => {
    assert.match(post, /serverAccepted/, 'PostModal: 서버 확정 전이 없음');
    assert.match(post, /serverUnknown/, 'PostModal: 결과 미보고 경로가 성공으로 승격된다');
    // 결과를 모를 때 serverAccepted 를 쓰면 안 된다 — ok 가 true 인 분기에서만 쓴다.
    const accepts = post.match(/dispatch\(\{ type: "serverAccepted"[^)]*\)/g) || [];
    assert.ok(accepts.length >= 1);
    for (const a of accepts) {
      const at = post.indexOf(a);
      const ctx = post.slice(Math.max(0, at - 260), at);
      assert.match(ctx, /outcome\.ok/, '서버가 ok 를 말하지 않았는데 성공으로 표시한다');
    }
    assert.match(post, /postSentUnconfirmed/, 'PostModal: 확인 못 한 상태 문구가 없음');
    assert.match(post, /postAwaitTeacher/, 'PostModal: 승인 대기 문구가 없음 (POST-03)');
  });

  check('clientRequestId 를 만들어 같은 재시도에 다시 쓴다', () => {
    assert.match(post, /createClientRequestId/, 'PostModal: 요청 id 생성 없음');
    assert.match(post, /cur\.clientRequestId \?\? createClientRequestId\(\)/, '재시도가 새 id 를 만든다');
    assert.match(post, /clientRequestId: requestId/, '전송 payload 에 id 를 싣지 않는다');
  });

  check('기존 작성 기능을 지우지 않았다', () => {
    for (const needle of ['DrawBoard', 'WorksheetTab', 'WorksheetAnalyzeView', 'MediaRecorder', '/api/stt', 'compressToUnder1MB', 'extractYouTubeId']) {
      assert.ok(post.includes(needle), `PostModal 에서 ${needle} 경로가 사라졌다`);
    }
    for (const key of ['postWayWrite', 'postWaySpeak', 'postWayPicture']) {
      assert.ok(post.includes(key), `첫 선택 ${key} 가 없다`);
    }
    assert.match(post, /postHint1|HINTS/, '문장 시작 힌트가 없다');
    assert.match(post, /postHintNone/, '힌트 없이 쓰기 선택지가 없다');
  });

  check('마이크 거부/미지원은 글쓰기로 바로 전환하고, 닫으면 녹음이 멈춘다', () => {
    assert.match(post, /fallbackToWriting/, '마이크 실패 시 글쓰기 전환 경로가 없다');
    assert.match(post, /postMicUnavailable/, '마이크 미지원 안내가 없다');
    assert.match(post, /function micUsable/, '마이크 지원 여부 검사가 없다');
    assert.match(post, /recSecs/, '녹음 시간 표시가 없다');
    assert.match(post, /postRecordStop/, '중지 버튼 라벨이 없다');
    assert.match(post, /function closeModal[\s\S]{0,220}stopRecording\(\)/, '모달을 닫을 때 녹음을 멈추지 않는다');
  });

  check('튜터: 멈추기·재시도·최신 요청 ID 검사·abort 가 모두 있다 (STREAM-01)', () => {
    assert.match(tutor, /AbortController/, 'abort 수단이 없다');
    assert.match(tutor, /signal: ctrl\.signal/, 'fetch 에 signal 을 넘기지 않는다');
    assert.match(tutor, /reqSeqRef\.current !== mySeq/, '최신 요청 ID 검사가 없다');
    assert.ok((tutor.match(/reqSeqRef\.current !== mySeq/g) || []).length >= 3,
      '스트림 조각·최종 응답·예외 모두에서 최신 요청을 확인해야 한다');
    assert.match(tutor, /function stopStream[\s\S]{0,200}abortRef\.current\?\.abort\(\)/, '멈추기가 abort 하지 않는다');
    assert.match(tutor, /aliveRef\.current = false;[\s\S]{0,120}abortRef\.current\?\.abort\(\)/, 'unmount 에서 abort 하지 않는다');
    assert.match(tutor, /if \(hidden\) stopStream\(\)/, 'hidden 으로 숨길 때 생성을 남긴다');
    assert.match(tutor, /tutorRetry/, '스트림 실패 재시도가 없다');
    assert.match(tutor, /handleRetry/, '재시도 처리기가 없다');
  });

  check('튜터: 기존 SSE·안전성 후처리 계약을 유지한다', () => {
    for (const needle of ['/api/tutor-chat', 'readChatStream', 'checkSafety', 'replyForSafety', 'raiseAlert', 'sessionStorage']) {
      assert.ok(tutor.includes(needle), `TutorChat 에서 ${needle} 계약이 사라졌다`);
    }
    assert.match(tutor, /if \(hidden \|\| !mounted\) return null;/, 'hidden prop 동작이 바뀌었다');
  });

  check('튜터: 소통창과 튜터를 화면에서 구분한다 (README §6.4)', () => {
    assert.match(tutor, /tutorPrivateNote/, '친구에게 보이지 않는다는 표시가 없다');
    assert.match(tutor, /tutorPrivateLong/, '공유하려면 소통창에 올려야 한다는 안내가 없다');
    assert.match(tutor, /tutorCollapse/, '접기가 없다');
    assert.match(tutor, /data-ux-role="body"/, '대화문이 본문 크기 토큰을 쓰지 않는다');
  });

  check('data-ux-root 는 화면당 하나이고 본체와 겹치지 않는다', () => {
    for (const [name, src] of [['PostModal', post], ['TutorChat', tutor]]) {
      const hits = code(src).match(/data-ux-root/g) || [];
      assert.equal(hits.length, 1, `${name}: data-ux-root 는 하나여야 한다`);
      assert.match(src, /createPortal\([\s\S]{0,80}document\.body\)/, `${name}: 본체와 중첩되지 않게 body 로 띄울 것`);
    }
  });

  check('fixture 는 개발 전용이고 운영 방·원격 호출을 쓰지 않는다', () => {
    assert.match(fixturePage, /process\.env\.NODE_ENV === "production"\) notFound\(\)/, 'production 차단이 없다');
    assert.ok(!/1111/.test(fixture + fixturePage), '운영 방 1111 이 fixture 에 등장한다');
    assert.ok(!/from "@\/lib\/firebase"|getClientDb|ref\(db|rooms\/\$\{/.test(fixture), 'fixture 가 Firebase 에 닿는다');
    assert.match(fixture, /차단된 호출/, '차단되지 않은 네트워크 경로가 남아 있다');
    for (const id of ['duplicate', 'outOfOrder', 'lateAfterAbort', 'retrySameId', 'approval']) {
      assert.ok(fixture.includes(`id: "${id}"`), `fixture 에 ${id} 결함 주입이 없다`);
    }
    for (const sc of ['ok', 'fail', 'slow', 'offline', 'silent']) {
      assert.ok(fixture.includes(`id: "${sc}"`), `fixture 에 ${sc} 시나리오가 없다`);
    }
  });

  check('새로 쓴 i18n 키가 15개 언어에 모두 있다', () => {
    const i18n = read('lib/i18n.ts');
    const LANGS = ['ko','en','vi','zh','fil','ja','th','km','mn','ru','uz','hi','id','ar','my'];
    const used = new Set();
    for (const src of [post, tutor]) {
      for (const m of src.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"/g)) used.add(m[1]);
      for (const m of src.matchAll(/"(post[A-Z][A-Za-z0-9]*|tutor[A-Z][A-Za-z0-9]*)"/g)) used.add(m[1]);
    }
    assert.ok(used.size > 25, `검사한 키가 너무 적다 (${used.size})`);
    for (const key of used) {
      const block = i18n.match(new RegExp(`\\n  ${key}: \\{([\\s\\S]*?)\\n  \\},`));
      assert.ok(block, `i18n 키 없음: ${key}`);
      for (const l of LANGS) {
        assert.ok(new RegExp(`\\b${l}: "`).test(block[1]), `${key}: ${l} 번역이 빠졌다`);
      }
    }
  });

  console.log(`\n${count} checks passed — reducer ${'20,000'}개 무작위 입력 포함.`);
  console.log('DOM/시각 검사는 scripts/shot-post.mjs 와 Q 하네스에서 별도 수행한다.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

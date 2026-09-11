/**
 * 작업 C 정적 계약 검사 — 소통창(보기)과 읽기 카드.
 *
 * 이것은 DOM 테스트가 아니다. 실제 클릭·초점·음성 재생을 확인하는 BOARD-01/02,
 * AUDIO-01 은 HARNESS.md 대로 Q 가 따로 구현한다. 여기서는 설계서가 명시적으로
 * 금지/요구한 것과, 건드리면 안 되는 데이터 계약이 코드에 그대로 있는지만
 * 기계로 잡는다. 치수·잘림은 scripts/shot-board.mjs 가 실제 브라우저에서 잰다.
 *   실행: node scripts/test-board-screen.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const board = read('components/PadletBoard.tsx');
const card = read('components/PadletCard.tsx');
const fixture = read('app/ux-fixture/board/fixture.tsx');
const fixturePage = read('app/ux-fixture/board/page.tsx');
const i18n = read('lib/i18n.ts');

let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };

/** 주석 속 설명이 금지 패턴에 걸리지 않게 코드만 남긴다. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const bc = code(board);
const cc = code(card);

check('글자 크기를 컴포넌트가 직접 정하지 않는다', () => {
  for (const [name, src] of [['PadletBoard', bc], ['PadletCard', cc]]) {
    const inlinePx = src.match(/fontSize:\s*\d+/g) || [];
    assert.deepEqual(inlinePx, [], `${name}: 인라인 px 글자 크기가 남아 있다: ${inlinePx.join(', ')}`);
    const cssPx = src.match(/font-size:\s*\d+(\.\d+)?px/g) || [];
    assert.deepEqual(cssPx, [], `${name}: CSS 에 고정 px 글자 크기가 있다: ${cssPx.join(', ')}`);
    assert.ok(/--ux-font-/.test(src), `${name}: 토큰 글자 크기를 쓰지 않는다`);
  }
});

check('화면당 data-ux-root 는 하나', () => {
  assert.equal((board.match(/data-ux-root/g) || []).length, 1, '보드 최상위에 하나만 — 중첩되면 큰 글씨 배율이 두 번 되돌아간다');
  assert.equal((card.match(/data-ux-root/g) || []).length, 0, '카드는 화면이 아니다');
});

check('화면을 100vh + overflow:hidden 으로 잠그지 않는다', () => {
  assert.ok(!/100vh/.test(bc), '100vh 고정은 모바일 키보드에서 하단 버튼을 가린다');
  assert.match(bc, /min-height:\s*100svh/, '동적 뷰포트 높이를 쓸 것');
  assert.ok(!/height:\s*"100vh"/.test(bc));
  // 문서 스크롤을 막는 잠금이 없어야 한다 (카드 목록·모달은 자기 상자 안에서만 스크롤).
  const rootBlock = bc.split('.bd-root{')[1]?.split('}')[0] ?? '';
  assert.ok(!/overflow:\s*hidden/.test(rootBlock), '루트에서 overflow:hidden 금지');
});

check('좁은 화면은 주제 하나, 넓은 화면 기본은 전체 한눈에 보기', () => {
  // 계약 변경(2026-09-12): 전체 보기를 데스크톱 교사 전용에서 '넓은 화면의 기본'으로
  // 옮겼다. 패들렛을 쓰는 사람은 전체가 한눈에 보이길 기대하고 데스크톱에는 공간이
  // 있다. 좁은 화면에서 옆으로 미는 보드를 주는 것은 여전히 금지다.
  assert.match(bc, /const view: "topic" \| "all" = wide \? wideView : "topic";/,
    '좁은 화면은 언제나 주제 중심, 넓은 화면만 선택 가능해야 한다');
  assert.match(bc, /useState<"topic" \| "all">\("all"\)/, '넓은 화면 기본값이 전체 보기가 아니다');
  assert.match(bc, /bd-viewswitch/, '보기 전환이 교사 전용에 갇혀 있거나 사라졌다');
  assert.ok(!/isTeacher && wide/.test(bc), '보기 선택을 교사에게만 주지 않는다');
  assert.match(bc, /matchMedia\("\(min-width: 1024px\)"\)/, '데스크톱 판정이 없다');
  assert.match(bc, /view === "all"/, '전체 컬럼 보기 분기가 사라졌다');
  assert.match(bc, /bd-columns/, '전체 컬럼 보기 레이아웃이 사라졌다');
  assert.match(bc, /boardAskToday/, "'오늘 무엇을 이야기할까?' 안내가 없다");
  assert.match(bc, /boardWriteMine/, "하단 '내 이야기 올리기'가 없다");
  assert.match(bc, /boardEmptyExample/, '빈 주제 예시 문장이 없다');
});

check('컬럼(주제) 데이터·정렬·추가·삭제 계약을 그대로 쓴다', () => {
  assert.match(bc, /rooms\/\$\{roomCode\}\/columns/, '컬럼 구독 경로가 바뀌었다');
  assert.match(bc, /list\.sort\(\(a, b\) => \(a\.order \?\? 0\) - \(b\.order \?\? 0\)\)/, '컬럼 정렬 규칙이 바뀌었다');
  assert.match(bc, /columns\/\$\{colId\}\/order/, '순서 변경(moveCol)이 사라졌다');
  assert.match(bc, /const newId = `col_\$\{Date\.now\(\)\}`/, '컬럼 추가 규칙이 바뀌었다');
  assert.match(bc, /remove\(ref\(db, `rooms\/\$\{roomCode\}\/columns\/\$\{colId\}`\)\)/, '컬럼 삭제가 사라졌다');
  assert.match(bc, /showUndoToast/, '삭제 되돌리기가 사라졌다');
});

check('카드 ID·columnId 계약이 유지된다', () => {
  assert.match(bc, /rooms\/\$\{roomCode\}\/cards/, '카드 구독 경로가 바뀌었다');
  assert.match(bc, /list\.sort\(\(a, b\) => b\.timestamp - a\.timestamp\)/, '카드 정렬이 바뀌었다');
  assert.match(bc, /setModal\(\{ colId: col\.id, colTitle: col\.title, colColor: col\.color \}\)/,
    '글쓰기 대상 columnId 가 실제 주제 id 가 아니다 (BOARD-01)');
  assert.match(bc, /colId: modal\.colId/, '게시 payload 의 colId 가 바뀌었다');
  assert.match(bc, /visibleCards\.filter\(\(c\) => c\.colId === colId\)/, '주제별 카드 선별 규칙이 바뀌었다');
  assert.match(bc, /key=\{card\.id\}/, '카드 키가 카드 ID 가 아니다');
  assert.match(bc, /cards\/\$\{cardId\}/, '카드 쓰기 경로가 바뀌었다');
});

check('교사 권한 검사와 승인 흐름을 UI 숨김으로 대체하지 않았다', () => {
  assert.match(bc, /const visibleCards = isTeacher \? cards : cards\.filter\(\(c\) => !c\.status \|\| c\.status === "approved"\);/,
    '학생에게 미승인 카드가 보이면 안 된다');
  assert.match(bc, /function ColumnAdmin\(\{ col \}: \{ col: FirebaseColumn \}\) \{\s*if \(!isTeacher\) return null;/,
    '주제 관리는 교사만');
  assert.ok((bc.match(/isTeacher && \(/g) || []).length >= 2, '교사 전용 블록이 사라졌다');
  assert.match(bc, /showApproval && isTeacher/, '승인 패널 권한 검사가 사라졌다');
  assert.match(bc, /approvalMode/, '승인 모드 설정이 사라졌다');
  assert.match(cc, /isTeacher \? list : list\.filter\(\(c\) => !c\.status \|\| c\.status === "approved"\)/,
    '학생에게 미승인 답장이 보이면 안 된다');
});

check('읽기 카드: 42ch 읽기 영역과 역할 토큰', () => {
  assert.ok((card.match(/data-ux-reading/g) || []).length >= 3, '읽는 글줄에 42ch 제한이 없다');
  assert.match(cc, /data-ux-role="body"/, '본문 역할 표시가 없다');
  assert.match(cc, /data-ux-role="label"/, '작성자 라벨 역할 표시가 없다');
  assert.match(cc, /data-ux-role="secondary"/, '시간은 보조 역할이어야 한다');
});

check("'번역 중' / '번역 실패' / '원문 보기' 는 서로 다른 상태다", () => {
  assert.match(cc, /const translating = !sameLang && !!card\.loading && !myText;/);
  assert.match(cc, /const translateFailed = !sameLang && !card\.loading && \(!!card\.translateError \|\| !myText\);/);
  assert.match(cc, /cardTranslating/, '번역 중 문구가 없다');
  assert.match(cc, /cardTranslateFailed/, '번역 실패 문구가 없다');
  assert.match(cc, /cardRetryTranslate/, '다시 번역해 보기가 없다');
  assert.match(cc, /cardShowOriginal/, '원문 보기가 없다');
  // 실패해도 빈 카드가 되지 않는다 — 실패 상태에서는 원문을 그대로 읽힌다.
  assert.match(cc, /translating \|\| translateFailed \? card\.originalText : readingText/,
    '번역 실패 시 원문이 보이지 않는다 (BOARD-02)');
  assert.match(cc, /cardReadMore/, '긴 글은 잘라 없애지 말고 더 읽기를 준다');
  assert.ok(!/slice\(0, \d+\) \+ "…"/.test(cc.split('bd-pending')[0]), '본문을 잘라 버리면 안 된다');
});

check('모든 언어를 한 번에 쌓지 않는다', () => {
  assert.match(cc, /showKorean/, '한국어 학습 보기는 명시적 선택이어야 한다');
  assert.match(cc, /showOthers/, '다른 언어는 눌렀을 때만 펼친다');
  assert.match(cc, /const otherLangs = Object\.keys\(card\.translations \|\| \{\}\)\.filter\(/);
  assert.ok(/showOthers && otherLangs\.map/.test(cc), '다른 언어가 기본 노출된다');
});

check('음성은 한 번에 하나, 떠날 때 정리한다 (AUDIO-01)', () => {
  assert.match(cc, /import \{ speak, cancelSpeak \} from "@\/lib\/ttsMulti";/, '기존 TTS cancel 경로를 쓸 것');
  assert.ok((cc.match(/cancelSpeak\(\)/g) || []).length >= 2, '재생 전 정리와 unmount 정리가 모두 필요하다');
  assert.match(cc, /useEffect\(\(\) => \{\s*return \(\) => \{ cancelSpeak\(\); \};\s*\}, \[card\.id\]\);/,
    '카드 이동/제거 시 음성 정리가 없다');
  assert.match(cc, /cardStop/, "재생 중 '멈추기'로 바뀌지 않는다");
  assert.ok(!/new SpeechSynthesisUtterance/.test(cc), '카드가 자체 TTS 엔진을 또 만들면 정리 경로가 갈라진다');
  assert.ok(!/autoplay|\.play\(\)/.test(cc.replace(/allow="[^"]*"/g, '')), '자동 재생 금지');
});

check('반응은 의미 있는 말이고, 기존 좋아요 데이터를 보존한다', () => {
  assert.match(cc, /reactThanks/); assert.match(cc, /reactSame/); assert.match(cc, /reactNice/);
  assert.match(cc, /rooms\/\$\{roomCode\}\/cards\/\$\{card\.id\}\/likes/, '반응 저장 경로(likes)를 바꾸지 말 것');
  assert.match(cc, /let legacy = 0;/, '옛 true 값을 세는 호환 어댑터가 없다');
  assert.match(cc, /cardLegacyLikes/, '예전 좋아요가 화면에서 사라졌다');
  assert.ok(!/sort\(\(a, b\) => b\.likeCount/.test(cc), '인기 순위를 기본 노출하지 말 것');
});

check('선택 상태는 색 말고도 알린다', () => {
  assert.ok((board.match(/aria-pressed=/g) || []).length >= 3, '주제 선택·토글에 aria-pressed 필요');
  assert.ok((card.match(/aria-pressed=/g) || []).length >= 2, '반응·펼치기에 aria-pressed 필요');
  assert.match(bc, /bd-check/, '체크 표시가 없다');
});

check('죽은 disabled 대신 이유를 말하는 aria-disabled 를 쓴다', () => {
  for (const [name, src] of [['PadletBoard', bc], ['PadletCard', cc]]) {
    assert.ok(!/(?<!aria-)disabled=\{/.test(src), `${name}: disabled 로 막으면 왜 못 누르는지 알 수 없다`);
  }
  assert.match(cc, /aria-disabled=/, 'aria-disabled 안내가 없다');
});

check('조합 중 Enter 를 전송으로 쓰지 않는다 (IME-01)', () => {
  assert.match(cc, /isComposing/, '답장 입력에 IME 조합 검사가 없다');
  assert.match(bc, /isComposing/, '주제 이름 입력에 IME 조합 검사가 없다');
});

check('아이콘 단독 버튼을 두지 않는다', () => {
  for (const [name, src] of [['PadletBoard', bc], ['PadletCard', cc]]) {
    const iconOnly = src.match(/>\s*[🔊🗑✏️✕🌟📱⚙📊📢💗📖]+\s*<\/button>/g) || [];
    assert.deepEqual(iconOnly, [], `${name}: 글자 라벨 없는 아이콘 버튼: ${iconOnly.join(', ')}`);
  }
  assert.ok(!/SpeakButton/.test(cc), '아이콘만 있는 SpeakButton 대신 라벨 있는 듣기 버튼을 쓴다');
});

check('fixture 는 개발 전용이고 Firebase 를 건드리지 않는다', () => {
  assert.match(fixturePage, /process\.env\.NODE_ENV === "production"\) notFound\(\)/, 'production 에서 열리면 안 된다');
  assert.ok(!/firebase/i.test(fixture), 'fixture 가 Firebase 를 import 했다');
  assert.ok(!/1111/.test(fixture), '운영 방 번호를 fixture 에 쓰지 말 것');
  assert.match(fixture, /fixture=\{FIXTURE\}/, '가짜 데이터 주입구가 없다');
  // 주입되면 구독·쓰기·외부 API 를 모두 끈다.
  assert.ok((bc.match(/if \(offline\) return;/g) || []).length >= 8, '보드의 Firebase 경계가 덜 막혔다');
  assert.ok((cc.match(/if \(fixture\) return;/g) || []).length >= 2, '카드의 Firebase 경계가 덜 막혔다');
  assert.match(cc, /fixture \|\| retryState === "loading"/, 'fixture 에서 번역 API 를 부르면 안 된다');
  // 고정 입력 (HARNESS §2)
  assert.match(fixture, /2026-09-11T00:00:00Z/, '고정 시각이 없다');
  assert.match(fixture, /makeRng\(17\)/, 'seed=17 고정이 없다');
  assert.equal((fixture.match(/id: "fx-col-\d"/g) || []).length, 3, '주제 3개 고정');
  assert.match(fixture, /i < 50/, '카드 50개 고정이 없다');
  assert.match(fixture, /slice\(0, 2000\)/, '2,000자 본문이 없다');
  assert.match(fixture, /translateError: true/, '번역 실패 카드가 없다');
  assert.match(fixture, /this-image-does-not-exist/, '이미지 404 카드가 없다');
});

check('새 문구는 15개 언어 키를 모두 갖는다', () => {
  const LANGS = ['ko', 'en', 'vi', 'zh', 'fil', 'ja', 'th', 'km', 'mn', 'ru', 'uz', 'hi', 'id', 'ar', 'my'];
  const keys = [
    'boardAskToday', 'boardPickTopic', 'boardNowTopic', 'boardStoryCount', 'boardWriteMine',
    'boardEmptyExample', 'boardAllTopics', 'boardOneTopic', 'cardTranslating', 'cardTranslateFailed',
    'cardRetryTranslate', 'cardShowOriginal', 'cardReadMore', 'cardListen', 'cardStop', 'cardReply',
    'cardAlsoKorean', 'cardOtherLangs', 'cardImageFailed', 'cardLegacyLikes',
    'reactThanks', 'reactSame', 'reactNice',
  ];
  for (const key of keys) {
    const block = i18n.split(new RegExp(`\\n  ${key}: \\{`))[1];
    assert.ok(block, `i18n 키 없음: ${key}`);
    const body = block.split('\n  },')[0];
    for (const l of LANGS) {
      assert.ok(new RegExp(`\\b${l}:\\s*"`).test(body), `${key} 에 ${l} 없음`);
    }
  }
});

console.log(`\n${count} checks passed — DOM/음성/시각 검사는 shot-board.mjs 와 Q 하네스에서 별도 수행`);

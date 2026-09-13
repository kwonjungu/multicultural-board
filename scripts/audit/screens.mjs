/**
 * 45개 계약 화면의 감사 가능 여부 확정표 (품질 하네스, 2026-09-14).
 *
 * probe-routes.mjs 로 45개 후보를 전부 실제 Chrome 에서 열어본 결과를 반영했다.
 * 추측이 아니라 조사 결과다. `status` 의미:
 *
 *   ok       — 그 URL 이 그 화면을 실제로 그린다. 감사 대상.
 *   act      — URL 진입 후 조작을 거쳐야 그 화면이 된다. 조작 스크립트가 있으면 감사 대상.
 *   none     — 이 저장소에 그 화면을 그릴 fixture 가 없다. 만들 수도 없다(사유 명시).
 *
 * before 출처:
 *   same     — 601a8f0 에도 같은 fixture 라우트가 있었다. 진짜 같은 화면의 before.
 *   flow     — 601a8f0 에는 이 fixture 가 없었다(이번 라운드 신규). 05 문서 지침대로
 *              "실제 이전 진입 흐름"(그 시점 아이가 실제로 거치던 화면)을 before 로 쓴다.
 *   none     — before 를 만들 수 없다.
 */

/** 601a8f0(before) 에 실제로 존재하던 fixture 라우트. */
export const BEFORE_ROUTES = new Set([
  "/ux-fixture/board", "/ux-fixture/character", "/ux-fixture/entry", "/ux-fixture/game",
  "/ux-fixture/hub", "/ux-fixture/post", "/ux-fixture/quest", "/ux-fixture/recorder",
  "/ux-fixture/roster",
]);

/** 신규 화면의 before 로 쓰는 "이전 진입 흐름" — 601a8f0 당시 아이가 실제로 거치던 화면. */
export const FLOW_BEFORE = "/ux-fixture/hub";

export const SCREENS = [
  // ── 직접 진입 가능 + 같은 라우트의 before 존재 ────────────────────────────
  { id: "entry", status: "ok", url: "/ux-fixture/entry", before: "same",
    childGoal: "내 언어를 고르고 이름을 넣어 우리 교실에 들어가는 것." },
  { id: "home", status: "ok", url: "/ux-fixture/hub", before: "same",
    childGoal: "오늘 무엇을 할지 스스로 골라 활동을 시작하는 것." },
  { id: "board", status: "ok", url: "/ux-fixture/board", before: "same",
    childGoal: "친구들 이야기를 읽고 내 이야기를 올리는 것." },
  // ?open=1 을 붙여야 실제 작성 UI(PostModal)가 뜬다. 안 붙이면 fixture 조작판만 찍힌다.
  { id: "post", status: "ok", url: "/ux-fixture/post?open=1", before: "same",
    childGoal: "글과 그림과 목소리로 내 이야기를 만들어 올리는 것." },
  // TutorChat 은 post fixture 안에 마운트된다. fixture 가 /api/* 를 가로채므로
  // 실제 /api/tutor-chat 로 나가지 않는다 — 조사로 확인했다.
  { id: "tutor", status: "ok", url: "/ux-fixture/post?tutor=stream", before: "same",
    childGoal: "AI 꿀비에게 물어보고 한국어로 답을 얻는 것." },
  { id: "vocab-speaking", status: "ok", url: "/ux-fixture/recorder", before: "same",
    childGoal: "예문을 듣고 따라 말하고 내 소리를 다시 들어보는 것." },
  { id: "teacher", status: "ok", url: "/ux-fixture/roster", before: "same",
    childGoal: "(교사 화면) 명렬표를 고치고 보관하고 되돌리는 것." },
  { id: "game-play", status: "ok", url: "/ux-fixture/game?game=taboo", before: "same",
    childGoal: "친구와 말로 설명하고 맞히며 노는 것." },
  { id: "marble-setup", status: "ok", url: "/ux-fixture/game?game=marble", before: "same",
    childGoal: "내 말과 색과 나라를 골라 마블 놀이를 준비하는 것." },
  // 첫 화면은 공부/놀이 고르기(=prepare)다. 지구본은 "공부하기"를 눌러야 나온다.
  { id: "featured-globe", status: "act", url: "/ux-fixture/game?game=globe", before: "same",
    steps: "globeExplore",
    childGoal: "지구본에서 나라를 찾고 인사말을 들어보는 것." },
  { id: "featured-yut", status: "ok", url: "/ux-fixture/game?game=yut", before: "same",
    childGoal: "윷을 던져 말을 옮기며 친구와 겨루는 것." },
  // 첫 화면은 인원 고르기(=prepare)다. 놀이판은 "시작하기"를 눌러야 나온다.
  { id: "featured-halligalli", status: "act", url: "/ux-fixture/game?game=halligalli", before: "same",
    steps: "halligalliStart",
    childGoal: "과일이 다섯 개일 때 종을 빨리 치는 것." },
  { id: "featured-puzzle", status: "ok", url: "/ux-fixture/game?game=puzzle", before: "same",
    childGoal: "조각을 맞춰 다른 나라 문화 그림을 완성하는 것." },

  // ── 직접 진입 가능 + 이번 라운드 신규 fixture (before = 이전 진입 흐름) ──
  { id: "vocab-home", status: "ok", url: "/ux-fixture/vocab", before: "flow",
    childGoal: "오늘 배울 단원을 고르고 내 진도를 확인하는 것." },
  { id: "vocab-detail", status: "ok", url: "/ux-fixture/vocab?open=detail", before: "flow",
    childGoal: "단어 하나를 그림·소리·내 말로 익히는 것." },
  { id: "vocab-writing", status: "ok", url: "/ux-fixture/vocab?open=write", before: "flow",
    childGoal: "배운 단어를 손으로 따라 쓰며 익히는 것." },
  { id: "vocab-quiz", status: "ok", url: "/ux-fixture/vocab?open=quiz", before: "flow",
    childGoal: "듣고 맞는 그림을 골라 내가 아는지 확인하는 것." },
  { id: "vocab-notebook", status: "ok", url: "/ux-fixture/vocab?open=notebook", before: "flow",
    childGoal: "내가 모은 단어를 모아 보고 다시 복습하는 것." },
  { id: "storybook", status: "ok", url: "/ux-fixture/storybook?view=read", before: "flow",
    childGoal: "그림책을 한 쪽씩 읽고 이야기를 따라가는 것." },
  { id: "game-lobby", status: "ok", url: "/ux-fixture/game-lobby", before: "flow",
    childGoal: "친구와 할 놀이를 고르고 언어를 맞추는 것." },
  { id: "praise", status: "ok", url: "/ux-fixture/praise", before: "flow",
    childGoal: "내가 받은 칭찬을 보고 꿀벌집을 키우는 것." },
  { id: "interpreter", status: "ok", url: "/ux-fixture/interpreter", before: "flow",
    childGoal: "내 말을 상대 언어로 바꿔 전달하는 것." },
  { id: "drawing", status: "ok", url: "/ux-fixture/drawing", before: "flow",
    childGoal: "그림으로 내 생각을 표현하는 것." },
  { id: "whiteboard", status: "ok", url: "/ux-fixture/whiteboard", before: "flow",
    childGoal: "선생님이 낸 주제에 내 그림으로 답하는 것." },
  { id: "discussion", status: "ok", url: "/ux-fixture/discussion", before: "flow",
    childGoal: "친구들 생각을 함께 보고 내 생각을 더하는 것." },
  { id: "advanced-menu", status: "ok", url: "/ux-fixture/globe?mode=menu", before: "flow",
    childGoal: "지구본으로 공부할지 놀이할지 고르는 것." },
  { id: "live-globe-explore", status: "ok", url: "/ux-fixture/globe?mode=explore", before: "flow",
    childGoal: "지구를 돌려 나라를 찾고 그 나라 인사말을 듣는 것." },

  // ── 조작을 거쳐야 도달하는 화면 ───────────────────────────────────────────
  { id: "animal-picker", status: "act", url: "/ux-fixture/entry", before: "same",
    steps: "entryToAnimal",
    childGoal: "교실에 들어가기 전 나를 나타낼 동물을 고르는 것." },
  { id: "reaction-picker", status: "act", url: "/ux-fixture/board", before: "same",
    steps: "boardReaction",
    childGoal: "친구 이야기에 마음을 눌러 표현하는 것." },
  { id: "featured-halligalli-prepare", status: "act", url: "/ux-fixture/game?game=halligalli",
    before: "same", steps: "none",
    childGoal: "몇 명이 함께 할지 정하고 놀이를 시작하는 것." },
  { id: "featured-globe-prepare", status: "act", url: "/ux-fixture/game?game=globe",
    before: "same", steps: "none",
    childGoal: "지구본 놀이를 시작하기 전 무엇을 할지 고르는 것." },

  // ── fixture 가 없거나 도달 불가 ───────────────────────────────────────────
  { id: "vocab-result", status: "none",
    reason: "후보였던 /ux-fixture/vocab?open=review 가 ExpressionReview 에서 Firebase Realtime Database 에 붙으려다 FIREBASE FATAL ERROR 로 죽는다(제품 결함 D-01). 화면이 그려지지 않아 감사 대상이 될 수 없다." },
  { id: "advanced-world-map-quiz", status: "none",
    reason: "globe fixture 의 mode 는 menu|explore|quiz 뿐이고 quiz 는 3D 지구본 탭 퀴즈다. 2D 세계지도 퀴즈 화면은 이 저장소에 구현이 없다(08 문서 U12 미구현, state.json blocker 2번과 같은 사유)." },
  { id: "advanced-globe-quiz", status: "none",
    reason: "/ux-fixture/globe?mode=quiz 가 React hydration 불일치로 Next 에러 오버레이를 띄운다(제품 결함 D-02). 오버레이가 화면을 덮어 디자인 캡처가 불가능하다." },
  { id: "advanced-globe-results", status: "none",
    reason: "8라운드를 다 풀어야 나오는 결과 화면인데, 정답 나라 선택이 매 렌더 무작위라(D-02 와 같은 원인) 자동 조작으로 안정적으로 완주시킬 수 없다. 억지로 도달해 캡처하면 재현 불가능한 증거가 된다." },
  { id: "marble-board", status: "none",
    reason: "캐릭터 설정 완료 후 진입하는 판. BeeWorldMarble 에 fixture prop 이 없어 초기 상태를 고정할 수 없고, 주사위·타일이 무작위라 같은 화면을 두 번 캡처할 수 없다. 기기 10칸 비교 증거로 쓸 수 없다." },
  { id: "marble-dice-move", status: "none",
    reason: "주사위 결과가 무작위라 기기·글자 크기 10칸에서 같은 화면이 나오지 않는다. 고정 seed 주입 경로(fixture prop)가 BeeWorldMarble 에 없다." },
  { id: "marble-event-result", status: "none",
    reason: "특정 이벤트 칸에 도착해야 나오는 화면. 무작위 주사위로는 도달을 보장할 수 없고 seed 주입 경로가 없다." },
  { id: "marble-fallback", status: "none",
    reason: "WebGL 을 끈 2D 폴백 화면. 폴백 분기가 BeeWorldMarble 내부 런타임 감지라 fixture 로 강제할 수 없고, headless Chrome 에서 WebGL 을 끄면 마블 외 화면까지 같이 바뀌어 이 화면만의 증거가 되지 않는다." },
  { id: "featured-yut-prepare", status: "none",
    reason: "HoneyYut 은 준비 화면 없이 바로 판으로 들어간다(조사 결과 첫 화면이 이미 '윷 던지기' 판). 계약이 요구하는 준비 화면이 제품에 존재하지 않는다 — 미구현." },
  { id: "featured-puzzle-prepare", status: "none",
    reason: "CulturePuzzle 도 준비 화면 없이 바로 조각 화면이다. 계약이 요구하는 준비 화면이 제품에 존재하지 않는다 — 미구현." },
  { id: "featured-globe-result", status: "none",
    reason: "8라운드 완주가 필요하고 문제 나라가 무작위다(D-02). 자동 조작으로 재현 가능한 결과 화면을 만들 수 없다." },
  { id: "featured-yut-result", status: "none",
    reason: "말 4개를 모두 통과시켜야 나오는 승리 화면. 윷 결과가 무작위라 재현 불가." },
  { id: "featured-halligalli-result", status: "none",
    reason: "카드를 다 소진해야 나오는 결과 화면. 카드 배열이 무작위라 재현 불가." },
  { id: "featured-puzzle-result", status: "none",
    reason: "조각 10개를 정확한 자리에 끌어다 놓아야 나오는 완성 화면. 드래그 좌표가 기기별로 달라 10칸 모두에서 동일하게 완주시킬 수 없다." },
];

export const BY_ID = new Map(SCREENS.map((s) => [s.id, s]));

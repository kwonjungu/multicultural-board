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
  // 2b256e4 이후 21개 게임이 공용 "놀이 방법" 준비판(GameGuidePanel)으로 시작한다.
  // 그래서 이 URL 의 첫 화면은 이제 놀이판이 아니라 준비판이다 —
  // 놀이판을 재려면 "알겠어요, 시작할래요" 를 눌러 넘어가야 한다.
  { id: "featured-yut", status: "act", url: "/ux-fixture/game?game=yut", before: "same",
    steps: "guideStart", beforeSteps: "none",
    childGoal: "윷을 던져 말을 옮기며 친구와 겨루는 것." },
  // 첫 화면은 인원 고르기(=prepare)다. 놀이판은 "시작하기"를 눌러야 나온다.
  { id: "featured-halligalli", status: "act", url: "/ux-fixture/game?game=halligalli", before: "same",
    steps: "halligalliStart",
    childGoal: "과일이 다섯 개일 때 종을 빨리 치는 것." },
  { id: "featured-puzzle", status: "act", url: "/ux-fixture/game?game=puzzle", before: "same",
    steps: "guideStart", beforeSteps: "none",
    childGoal: "조각을 맞춰 다른 나라 문화 그림을 완성하는 것." },

  // ── 직접 진입 가능 + 이번 라운드 신규 fixture (before = 이전 진입 흐름) ──
  { id: "vocab-home", status: "ok", url: "/ux-fixture/vocab", before: "flow",
    childGoal: "오늘 배울 단원을 고르고 내 진도를 확인하는 것." },
  { id: "vocab-detail", status: "ok", url: "/ux-fixture/vocab?open=detail", before: "flow",
    childGoal: "단어 하나를 그림·소리·내 말로 익히는 것." },
  { id: "vocab-writing", status: "ok", url: "/ux-fixture/vocab?open=write", before: "flow",
    childGoal: "배운 단어를 손으로 따라 쓰며 익히는 것." },
  // seed=7: 시험 문제 10개는 buildDailyChallenge → shuffle → Math.random 이라
  // 새로 고칠 때마다 달라졌다. fixture 가 마운트 전에 Math.random 을 시드로
  // 고정하므로(app/ux-fixture/vocab/fixture.tsx) 같은 시드면 늘 같은 10문제다.
  { id: "vocab-quiz", status: "ok", url: "/ux-fixture/vocab?open=quiz&seed=7", before: "flow",
    childGoal: "듣고 맞는 그림을 골라 내가 아는지 확인하는 것." },
  // 시험 결과 = VocabTest 의 allDone 분기(VocabTest.tsx:109 → 379 SessionResultScreen).
  // 2026-09-14 재조사: 이 화면을 막고 있던 것은 두 가지였고 둘 다 풀렸다.
  //   (1) VocabTest.tsx 의 subscribeLearner 가 offline prop 과 무관하게 항상 구독해
  //       fixture 에서 FIREBASE FATAL ERROR 가 났다 → offline 이면 구독하지 않도록
  //       고쳐졌다. 지금 /ux-fixture/vocab?open=quiz 는 Firebase 호출 0건이고
  //       data-ux-text 도 정상으로 붙는다(실측 확인).
  //   (2) 문제 10개가 Math.random 으로 매번 달라져 재현이 안 됐고, 같은 이유로 서버
  //       렌더와 클라이언트 렌더의 보기 순서가 달라 하이드레이션 경고 2건이 났다
  //       ("Text content did not match. Server: 놀라다 Client: 슬프다") →
  //       fixture 가 Math.random 을 시드로 고정하고 마운트 뒤에 그리도록 고쳤다.
  // 그래서 이제 vocabQuizFinish 스텝으로 10문제를 실제로 풀어 결과 화면에 도달한다.
  // 같은 시드 = 항상 같은 결과 화면(정답 10/10 · 최고 콤보 10 · 획득 XP +180).
  { id: "vocab-result", status: "act", url: "/ux-fixture/vocab?open=quiz&seed=7",
    before: "flow", steps: "vocabQuizFinish",
    childGoal: "시험이 끝나고 내가 몇 개 맞혔는지 보고 다시 할지 고르는 것." },
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

  // ── 2차 라운드에서 감사 가능해진 화면 ─────────────────────────────────────
  //
  // (1) D-02 는 실제로 고쳐졌다. cc21b8f "지구본 하이드레이션" 이후
  //     components/games/GlobeQuest.tsx QuizMode 가 첫 렌더에서 pickN 을 부르지
  //     않고 마운트 뒤 useEffect 에서 뽑는다(startedAt 도 0 으로 시작).
  //     2026-09-14 재확인: /ux-fixture/globe?mode=quiz 를 chrome=game / bare
  //     양쪽으로 열어 nextjs-portal 없음, hydration 콘솔 오류 0건,
  //     "문제 1 / 8" 까지 정상 렌더. 증거: reports/audit-20260914b/probe/globequiz-*.png
  { id: "advanced-globe-quiz", status: "ok", url: "/ux-fixture/globe?mode=quiz", before: "flow",
    childGoal: "문제로 나온 나라를 돌아가는 지구본에서 찾아 손가락으로 콕 짚는 것." },

  // (2) 마블 4화면 — BeeWorldMarble 에 fixture prop 이 없다는 사실은 그대로다.
  //     컴포넌트는 이 작업자의 소유가 아니므로 prop 을 넣지 않았다. 대신
  //     app/ux-fixture/marble 이 **컴포넌트를 마운트하기 전에 Math.random 을
  //     결정적 시드로 바꾼다.** 주사위(index.tsx:137-138)와 찬스 카드 뽑기
  //     (lib/marbleEffects.ts:98)가 모두 그 시드에 종속되므로 같은 시드 + 같은
  //     클릭 순서 = 항상 같은 화면이 나온다. 시드 값은 추측이 아니라
  //     scripts/audit/marble-seed-scan.mjs 로 1..16 을 실제로 굴려 고른 것이다:
  //       seed 3  → 주사위 합이 도시가 아닌 칸에 떨어져 "🎲 a + b = N 칸" 도착 카드
  //       seed 12 → 찬스 칸(3번)에 떨어져 찬스 카드(.mb-chance)가 열림
  //     before 는 601a8f0 의 같은 게임 진입 경로(/ux-fixture/game?game=marble)다 —
  //     그 시점에도 "게임 시작" / "주사위 굴리기" 라벨이 같아서 같은 조작이 먹는다.
  { id: "marble-board", status: "act", url: "/ux-fixture/marble?seed=3", before: "same",
    beforeUrl: "/ux-fixture/game?game=marble", steps: "marbleStart", motion: "no-preference",
    childGoal: "내 말이 어디 있는지, 지금 누구 차례인지 보고 굴릴 준비를 하는 것." },
  { id: "marble-dice-move", status: "act", url: "/ux-fixture/marble?seed=3", before: "same",
    beforeUrl: "/ux-fixture/game?game=marble", steps: "marbleRoll", motion: "no-preference",
    childGoal: "주사위를 굴려 나온 수만큼 내 말이 옮겨 가는 것을 눈으로 따라가는 것." },
  { id: "marble-event-result", status: "act", url: "/ux-fixture/marble?seed=12", before: "same",
    beforeUrl: "/ux-fixture/game?game=marble", steps: "marbleRoll", motion: "reduce",
    childGoal: "찬스 칸에 서서 무슨 일이 생겼는지 카드로 읽고 이해하는 것." },
  // 06 §7 의 "2D 대체" — 마블에는 WebGL 이 없다(Board/Tile/PieceLayer 전부 DOM+CSS).
  // 제품에 실제로 구현된 폴백 경로는 **움직임 줄이기** 하나뿐이라, 이 화면은
  // prefers-reduced-motion: reduce 로 같은 한 턴을 굴린 상태를 잰다.
  // 같은 시드에서 marble-dice-move 와 주사위·도착 칸이 같아야 06 §7 의
  // "전환 시 동일 game state·주사위 결과 유지"가 지켜진 것이다.
  { id: "marble-fallback", status: "act", url: "/ux-fixture/marble?seed=3", before: "same",
    beforeUrl: "/ux-fixture/game?game=marble", steps: "marbleRoll", motion: "reduce",
    childGoal: "움직임을 줄여도 굴리기·이동·도착이 똑같이 되는 것." },

  // (3) 윷·퍼즐 준비 화면 — **1차 라운드의 "제품에 없음" 판정은 이제 틀렸다.**
  //     2b256e4 "게임 헤더 21종 통일, 지구본 2열, 놀이 방법 안내" 가 공용
  //     GameGuidePanel(components/ui/game/GameHeader.tsx:186-228)을 넣으면서
  //     인원 · 예상 시간 · 한 문장 규칙 · 연습 1문제 · "▶ 알겠어요, 시작할래요"
  //     로 이루어진 준비판이 두 게임 모두에 생겼다. 처음 들어온 아이에게만
  //     펼쳐지는데(localStorage guideSeen), Playwright 는 매번 새 프로필이라
  //     항상 펼친 상태로 열린다 = 재현 가능하다.
  { id: "featured-yut-prepare", status: "act", url: "/ux-fixture/game?game=yut", before: "same",
    steps: "none",
    childGoal: "윷놀이가 어떤 놀이인지 읽고 한 문제 연습해 본 뒤 시작하는 것." },
  { id: "featured-puzzle-prepare", status: "act", url: "/ux-fixture/game?game=puzzle", before: "same",
    steps: "none",
    childGoal: "퍼즐이 어떤 놀이인지 읽고 한 문제 연습해 본 뒤 시작하는 것." },

  // (4) 결과 화면 2종 — 완주가 필요한 화면 중 **자동 조작으로 재현 가능한 것만**
  //     감사한다. 나머지 3종(globe 계열 2개, yut)은 아래 none 에 사유를 남겼다.
  //
  //     퍼즐: 드래그가 아니라 제품이 이미 지원하는 "고르고 놓기"(조각 두 번 탭 =
  //     자리 교환)로 맞춘다. 각 칸의 inline backgroundPosition 이 그 칸이 지금
  //     들고 있는 조각 번호를 담고 있어 화면만 읽고 선택 정렬로 풀 수 있다 —
  //     기기별 드래그 좌표에 의존하지 않아 10칸 모두에서 똑같이 완성된다.
  //     주제 그림 순서만 무작위라 replay fixture 의 시드로 고정했다(seed=5 →
  //     "한복 (한국의 전통 옷)").
  { id: "featured-puzzle-result", status: "act", url: "/ux-fixture/replay?game=puzzle&seed=5",
    before: "same", beforeUrl: "/ux-fixture/game?game=puzzle", steps: "puzzleSolve", beforeSteps: "none",
    childGoal: "조각을 다 맞춰 완성된 그림과 그 그림이 무엇인지 읽는 것." },
  //     할리갈리: 정식 룰대로 56장을 다 넘기면 결과가 된다. 종을 누르지 않으므로
  //     점수는 항상 0:0 무승부 — 덱을 어떻게 섞든 결과 화면이 같다(그래도 카드
  //     그림까지 같게 하려고 시드를 고정했다). 실측 24초에 완주한다.
  { id: "featured-halligalli-result", status: "act", url: "/ux-fixture/replay?game=halligalli&seed=5",
    before: "same", beforeUrl: "/ux-fixture/game?game=halligalli", steps: "halligalliFinish", beforeSteps: "none",
    childGoal: "한 판이 끝나고 누가 몇 점인지, 다시 할지 고르는 것." },

  // (5) 3차 라운드 — 종전에 "도달 불가" 로 적혀 있던 결과 화면 3종.
  //     그 기록은 components/** 를 고칠 수 없던 작업자가 쓴 것이다. 이번에는
  //     둘 중 하나를 골랐고, 어느 쪽을 골랐는지 항목마다 남긴다.
  //
  //     윷놀이: 컴포넌트를 **한 줄도 고치지 않고** 제품 경로 그대로 끝까지 둔다.
  //     종전 기록의 "시드를 고정해도 재현되지 않는다" 는 코드를 다시 읽어보니
  //     사실이 아니었다 — throwSticks() 는 handleThrow 첫 줄에서 먼저 뽑히고
  //     (YutSticks.tsx:41), 깜빡임용 Math.random 은 130~650ms 타이머, 다음
  //     던지기는 780ms 뒤에 열린다. 던지기마다 난수 소비 순서가 고정이라
  //     조작 순서만 정하면 판 전체가 재현된다(capture.mjs 의 yutFinish 주석).
  //     실측(1366x768 · 820x1180 · 800x768 세 모양에서 모두 같았다):
  //     시드 5 · 던지기 58회 · 말 옮기기 57회 · 문화카드 11회 → A팀 승리.
  { id: "featured-yut-result", status: "act", url: "/ux-fixture/replay?game=yut&seed=5",
    before: "same", beforeUrl: "/ux-fixture/game?game=yut", steps: "yutFinish", beforeSteps: "none",
    childGoal: "한 판이 끝나고 누가 이겼는지 보고 다시 할지 고르는 것." },
  //     지구본 결과(2종): 자동 플레이로 8라운드를 실제로 다 맞혀서 연다.
  //     다만 정답 입력이 3D 핀 레이캐스트뿐이고 핀 15개가 동아시아에서 서로
  //     겹쳐, "그 나라를 누르려면 화면 어디인가" 를 컴포넌트 밖에서 계산할 수
  //     없었다. 그래서 GlobeQuest 에 fixture 전용 **조준 훅**만 달았다
  //     (auditPins → window.__globeAuditPins, ?pins=audit 로만 켜진다).
  //     훅이 내보내는 것은 좌표 하나뿐이고 정답 판정·점수·시간은 제품이 그대로
  //     정한다. 누르는 것도 실제 pointerdown/up 이다. 아이 화면(GameRoom)은
  //     이 prop 을 넘기지 않으므로 훅 자체가 존재하지 않는다.
  //     실측: 두 라우트 × 여러 화면 크기에서 모두 8번 눌러(지구를 돌린 횟수 0)
  //     "🏆 8 / 8 ⏱ 0:14" 라는 같은 결과 화면이 나왔다.
  { id: "advanced-globe-results", status: "act", url: "/ux-fixture/globe?mode=quiz&pins=audit",
    before: "flow", steps: "globeQuizFinish",
    childGoal: "지구본 놀이가 끝나고 내가 몇 개 맞혔는지 보고 다시 할지 고르는 것." },
  { id: "featured-globe-result", status: "act", url: "/ux-fixture/game?game=globe&pins=audit",
    before: "same", beforeUrl: "/ux-fixture/game?game=globe", steps: "globeQuizFinish", beforeSteps: "none",
    childGoal: "지구본 놀이 한 판이 끝나고 점수와 걸린 시간을 보는 것." },

  // (5) 평면 세계지도 나라 찾기 — **1차 라운드의 "제품에 구현이 없다" 판정은 이제 틀렸다.**
  //     4694dc7 "U12: 평면 세계지도 나라 찾기 구현" 이 화면(components/games/WorldMapQuiz.tsx),
  //     순수 로직(lib/worldMapQuiz.ts), 정답 데이터(public/maps/world-quiz.v1.json, Natural
  //     Earth 10m 에서 빌드), 재현 fixture(/ux-fixture/world-map?seed=N), 로비 진입로
  //     (components/GameRoom.tsx 의 worldmap)를 함께 넣었다. 시드가 문제 순서를 고정하므로
  //     10칸이 같은 문제·같은 지도로 재현된다. 검사는 이미 있다:
  //       node scripts/test-world-map-quiz.mjs     (순수 로직 24항목)
  //       node scripts/verify-world-map-quiz.mjs   (브라우저 24항목)
  //
  //     before 는 "flow" 다 — "same" 도 "none" 도 아니다. 근거:
  //       · "same" 이 아니다: 601a8f0 에 이 라우트가 없었고, **화면 자체가 제품에 없었다.**
  //         3402 에서 /ux-fixture/world-map 을 열면 404 다. 같은 화면의 이전 모습은
  //         이 세상에 존재하지 않으므로 지어내지 않는다.
  //       · "none" 도 아니다: 위 규약이 정한 flow 의 뜻이 바로 이 경우다 —
  //         "601a8f0 에는 이 fixture 가 없었다. 그 시점 아이가 실제로 거치던 화면을
  //         before 로 쓴다." 601a8f0 당시 "지도에서 나라를 찾고 싶은" 아이가 실제로
  //         닿을 수 있던 곳은 홈 허브(FLOW_BEFORE=/ux-fixture/hub)까지였고, 거기서
  //         이 놀이로 가는 길은 없었다. 그 '길이 없던 상태'가 before 다.
  //       · 다만 다른 flow 화면들과 무게가 다르다. vocab-*/storybook/praise 는 제품
  //         기능은 있었고 fixture 만 새로 난 것이지만, 이 화면은 **기능 자체가 없었다.**
  //         그래서 칸별 review 에 "before 는 이 화면의 이전 판이 아니다" 를 명시한다.
  { id: "advanced-world-map-quiz", status: "ok", url: "/ux-fixture/world-map?seed=1",
    before: "flow", steps: "worldMapReady",
    childGoal: "이름을 들은 나라를 세계지도에서 찾아 손가락으로 콕 짚는 것." },

  // ── fixture 가 없거나 도달 불가 ───────────────────────────────────────────
  // 2026-09-14 3차 라운드 기준으로 이 칸은 비어 있다. 45개 화면이 모두 감사
  // 대상이다. status:"none" 을 다시 쓰게 되면 "왜 만들 수도 없는지" 를 코드
  // 위치까지 적고, 그 사유가 **컴포넌트를 고칠 수 없어서**라면 그건 사유가
  // 아니라 할 일이라는 것을 이번 라운드가 보여줬다(윷·지구본 결과 3종).
];

export const BY_ID = new Map(SCREENS.map((s) => [s.id, s]));

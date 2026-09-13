/**
 * contract.json 45개 화면 ↔ 실제 fixture 라우트 매핑 (품질 하네스, 2026-09-14).
 *
 * AFTER  = 3300 (C:/Users/권준구/multicultural-board, HEAD 4dca8c5)
 * BEFORE = 3402 (C:/Users/권준구/mb-before-601a8f0, 601a8f0 — 이번 라운드 직전 상태)
 *
 * `beforeUrl` 이 없는 화면은 601a8f0 시점에 fixture 자체가 없던 신규 화면이다.
 * 그런 화면의 before 는 지어내지 않는다 — 없는 것은 없다고 기록한다.
 */
export const AFTER_ORIGIN = "http://localhost:3300";
export const BEFORE_ORIGIN = "http://localhost:3402";

/** 601a8f0 에 존재하던 fixture 라우트 (before 캡처가 가능한 범위). */
export const BEFORE_ROUTES = new Set([
  "board", "character", "entry", "game", "hub", "post", "quest", "recorder", "roster",
]);

/**
 * 1차 조사 후보. probe-routes.mjs 가 이걸 열어보고 실제 렌더 결과를 남긴다.
 * 여기 url 은 "추정"이며, 조사 결과로 확정한다.
 */
export const CANDIDATES = [
  { screen: "entry", url: "/ux-fixture/entry" },
  { screen: "home", url: "/ux-fixture/hub" },
  { screen: "board", url: "/ux-fixture/board" },
  { screen: "post", url: "/ux-fixture/post" },
  { screen: "vocab-home", url: "/ux-fixture/vocab" },
  { screen: "vocab-detail", url: "/ux-fixture/vocab?open=detail" },
  { screen: "vocab-speaking", url: "/ux-fixture/recorder" },
  { screen: "vocab-writing", url: "/ux-fixture/vocab?open=write" },
  { screen: "vocab-quiz", url: "/ux-fixture/vocab?open=quiz" },
  { screen: "vocab-result", url: "/ux-fixture/vocab?open=review" },
  { screen: "vocab-notebook", url: "/ux-fixture/vocab?open=notebook" },
  { screen: "storybook", url: "/ux-fixture/storybook?view=read" },
  { screen: "game-lobby", url: "/ux-fixture/game-lobby" },
  { screen: "game-play", url: "/ux-fixture/game?game=taboo" },
  { screen: "praise", url: "/ux-fixture/praise" },
  { screen: "animal-picker", url: "/ux-fixture/character" },
  { screen: "reaction-picker", url: "/ux-fixture/board" },
  { screen: "interpreter", url: "/ux-fixture/interpreter" },
  { screen: "tutor", url: "/ux-fixture/hub" },
  { screen: "drawing", url: "/ux-fixture/drawing" },
  { screen: "whiteboard", url: "/ux-fixture/whiteboard" },
  { screen: "discussion", url: "/ux-fixture/discussion" },
  { screen: "teacher", url: "/ux-fixture/roster" },
  { screen: "marble-setup", url: "/ux-fixture/game?game=marble" },
  { screen: "marble-board", url: "/ux-fixture/game?game=marble", key: "board" },
  { screen: "marble-dice-move", url: "/ux-fixture/game?game=marble", key: "dice" },
  { screen: "marble-event-result", url: "/ux-fixture/game?game=marble", key: "event" },
  { screen: "marble-fallback", url: "/ux-fixture/game?game=marble", key: "fallback" },
  { screen: "featured-globe", url: "/ux-fixture/game?game=globe" },
  { screen: "featured-yut", url: "/ux-fixture/game?game=yut" },
  { screen: "featured-halligalli", url: "/ux-fixture/game?game=halligalli" },
  { screen: "featured-puzzle", url: "/ux-fixture/game?game=puzzle" },
  { screen: "advanced-menu", url: "/ux-fixture/globe?mode=menu" },
  { screen: "live-globe-explore", url: "/ux-fixture/globe?mode=explore" },
  { screen: "advanced-globe-quiz", url: "/ux-fixture/globe?mode=quiz" },
  { screen: "advanced-world-map-quiz", url: "/ux-fixture/globe?mode=quiz", key: "worldmap" },
  { screen: "advanced-globe-results", url: "/ux-fixture/globe?mode=quiz", key: "results" },
  { screen: "featured-globe-prepare", url: "/ux-fixture/game?game=globe", key: "prepare" },
  { screen: "featured-globe-result", url: "/ux-fixture/game?game=globe", key: "result" },
  { screen: "featured-yut-prepare", url: "/ux-fixture/game?game=yut", key: "prepare" },
  { screen: "featured-yut-result", url: "/ux-fixture/game?game=yut", key: "result" },
  { screen: "featured-halligalli-prepare", url: "/ux-fixture/game?game=halligalli", key: "prepare" },
  { screen: "featured-halligalli-result", url: "/ux-fixture/game?game=halligalli", key: "result" },
  { screen: "featured-puzzle-prepare", url: "/ux-fixture/game?game=puzzle", key: "prepare" },
  { screen: "featured-puzzle-result", url: "/ux-fixture/game?game=puzzle", key: "result" },
];

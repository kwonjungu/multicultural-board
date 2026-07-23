import type { TutorialScenario } from "../types";

/**
 * 메인 허브 첫 방문 튜토리얼. 꿀벌 선생님이 각 섹션 카드를 소개하고,
 * 소통창·게임·칭찬·단어 섹션에는 **직접 들어가서** 핵심 기능을 짚어준다
 * (설계서 항목 11 — navigate 스텝).
 *
 * 필요한 data-tutorial-id 앵커:
 *   HomeHub    : hub-header, hub-section-board / -games / -dashboard / -vocab
 *   PadletBoard: board-header, board-fab, board-emotion-fab(학생 전용)
 *   GameRoom   : games-header
 *   PraiseHive : praise-header
 *   VocabHub   : vocab-header
 *   (실시간 통역은 허브 타일에서 빠지고 앱 전역 좌하단 플로팅 아이콘으로 이동함)
 */

const sharedReward = { emoji: "🏅", label: "꿀벌 탐험가 배지 획득!" };

// ─── 학생용 ─────────────────────────────────────────────────────────
export const mainHubStudentScenario: TutorialScenario = {
  id: "main",
  title: "메인 허브 둘러보기",
  estimatedMinutes: 4,
  mandatory: true,
  steps: [
    {
      kind: "speak",
      expression: "welcome",
      anchor: { corner: "center" },
      lines: [
        { text: "앗, 누가 왔네~ 안녕! 🌼" },
        { text: "나는 너를 안내할 꿀벌 선생님이야!", expression: "cheer" },
        { text: "여긴 꿀처럼 달콤한 우리 반 공간이야. 같이 둘러볼래?", expression: "welcome" },
      ],
      particles: "sparkle",
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-header"]',
      side: "bottom",
      expression: "think",
      lines: [
        { text: "여기 위에 네 이름이랑 방 번호가 있어. 🚪" },
        { text: "친구들도 같은 방 번호로 들어오면 같이 이야기할 수 있어~", expression: "cheer" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-board"]',
      side: "right",
      expression: "cheer",
      lines: [
        { text: "첫 번째는 소통창! 🧡" },
        { text: "네가 한국어로 글을 쓰면, 다른 나라 친구들 화면엔 자기 나라말로 짠 하고 바뀌어.", expression: "celebrate" },
        { text: "말로만 하면 심심하지? 직접 들어가서 보여줄게! 따라와~", expression: "welcome" },
      ],
    },
    // ── 소통창 직접 진입 ──
    { kind: "navigate", to: "board", waitSelector: '[data-tutorial-id="board-header"]' },
    {
      kind: "highlight",
      target: '[data-tutorial-id="board-header"]',
      side: "bottom",
      expression: "celebrate",
      lines: [
        { text: "짠! 여기가 진짜 소통창 안이야 🏠" },
        { text: "친구들 글이 주제별 컬럼에 모여 있어. 전부 네 언어로 자동 번역돼!", expression: "cheer" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="board-fab"]',
      side: "left",
      expression: "cheer",
      lines: [
        { text: "이 ✏️ 버튼을 누르면 글을 쓸 수 있어!" },
        { text: "글·사진·그림·유튜브까지 다 올릴 수 있지~", expression: "celebrate" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="board-emotion-fab"]',
      side: "left",
      expression: "welcome",
      lines: [
        { text: "그리고 이 💗 버튼! 오늘 기분을 카드로 보낼 수 있어." },
        { text: "기분을 보내면 호기심 스티커도 받아~ 다음 곳으로 가볼까?", expression: "cheer" },
      ],
    },
    // ── 게임 직접 진입 ──
    { kind: "navigate", to: "games", waitSelector: '[data-tutorial-id="games-header"]' },
    {
      kind: "highlight",
      target: '[data-tutorial-id="games-header"]',
      side: "bottom",
      expression: "celebrate",
      lines: [
        { text: "소통의 게임! 🎮 내가 제일 좋아하는 곳이야~" },
        { text: "이 나라는 어디?, 꿀벌 월드 마블, 그림 맞히기… 친구랑 같이 하는 놀이가 21가지나 있어!", expression: "cheer" },
        { text: "게임 카드를 누르면 바로 시작돼. 이제 칭찬 꿀벌집으로 가자!", expression: "welcome" },
      ],
    },
    // ── 칭찬 꿀벌집 직접 진입 ──
    { kind: "navigate", to: "dashboard", waitSelector: '[data-tutorial-id="praise-header"]' },
    {
      kind: "highlight",
      target: '[data-tutorial-id="praise-header"]',
      side: "bottom",
      expression: "welcome",
      lines: [
        { text: "칭찬 꿀벌집 🍯 네 벌 캐릭터가 사는 곳이야." },
        { text: "칭찬을 받으면 알→애벌레→번데기→벌→여왕벌로 자라나!", expression: "celebrate" },
        { text: "개인전 탭의 전시장에서 친구들 벌에 ❤️ 좋아요와 응원도 남길 수 있어~", expression: "cheer" },
      ],
    },
    // ── 단어 카드 직접 진입 ──
    { kind: "navigate", to: "vocab", waitSelector: '[data-tutorial-id="vocab-header"]' },
    {
      kind: "highlight",
      target: '[data-tutorial-id="vocab-header"]',
      side: "bottom",
      expression: "think",
      lines: [
        { text: "마지막은 단어 카드 📚" },
        { text: "그림이랑 소리로 새로운 낱말을 배워봐. 따라 말하고 써보기도 있어!", expression: "cheer" },
      ],
    },
    // ── 허브 복귀 후 마무리 ──
    { kind: "navigate", to: "hub", waitSelector: '[data-tutorial-id="hub-header"]' },
    {
      kind: "celebrate",
      lines: [
        { text: "자, 이게 우리 반 전체 지도야! 🗺️", expression: "celebrate" },
        { text: "아, 그림책 공부에서는 언제든 그림책을 읽을 수 있어~ 선생님이 수업을 시작하면 자동으로 열리기도 해!", expression: "cheer" },
        { text: "즐거운 하루 보내! 🐝", expression: "welcome" },
      ],
      reward: sharedReward,
    },
  ],
};

// ─── 교사용 ─────────────────────────────────────────────────────────
export const mainHubTeacherScenario: TutorialScenario = {
  id: "main",
  title: "메인 허브 둘러보기 (선생님)",
  estimatedMinutes: 4,
  mandatory: true,
  steps: [
    {
      kind: "speak",
      expression: "teacher",
      anchor: { corner: "center" },
      lines: [
        { text: "안녕하세요, 선생님! 반갑습니다 🌸" },
        { text: "저는 교실 안내를 맡은 꿀벌 선생님이에요.", expression: "welcome" },
        { text: "우리 반 다문화 공간을 어떻게 쓰는지 함께 살펴볼까요?", expression: "cheer" },
      ],
      particles: "sparkle",
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-header"]',
      side: "bottom",
      expression: "think",
      lines: [
        { text: "이 **방 번호**는 학생들이 들어올 때 입력하는 번호예요. 🚪" },
        { text: "칠판에 적어주시면 됩니다. 학생들이 같은 방에 모여야 서로 소통할 수 있어요.", expression: "cheer" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-board"]',
      side: "right",
      expression: "cheer",
      lines: [
        { text: "첫 번째는 **소통창**입니다. 🧡" },
        { text: "학생이 글을 올리면 **반 언어 전체로 자동 번역**되어 표시돼요.", expression: "welcome" },
        { text: "직접 들어가서 핵심 기능을 보여드릴게요!", expression: "celebrate" },
      ],
    },
    // ── 소통창 직접 진입 ──
    { kind: "navigate", to: "board", waitSelector: '[data-tutorial-id="board-header"]' },
    {
      kind: "highlight",
      target: '[data-tutorial-id="board-header"]',
      side: "bottom",
      expression: "celebrate",
      lines: [
        { text: "소통창 내부입니다. 상단 도구 모음에 **승인·QR 입장·의견 나누기·PPTX 번역·모두 부르기**가 모여 있어요." },
        { text: "컬럼(주제)은 소통판 안에서 바로 추가·수정·삭제할 수 있습니다.", expression: "cheer" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="board-fab"]',
      side: "left",
      expression: "cheer",
      lines: [
        { text: "✏️ 글쓰기 버튼 — 학생과 같은 방식으로 선생님도 게시할 수 있어요." },
        { text: "학생 카드의 **칭찬 버튼**으로 스티커를 바로 보낼 수 있습니다. 게임방으로 이동할게요!", expression: "welcome" },
      ],
    },
    // ── 게임 직접 진입 ──
    { kind: "navigate", to: "games", waitSelector: '[data-tutorial-id="games-header"]' },
    {
      kind: "highlight",
      target: '[data-tutorial-id="games-header"]',
      side: "bottom",
      expression: "celebrate",
      lines: [
        { text: "**소통의 게임** 🎮 아이스브레이킹부터 어휘 복습, 모둠 활동까지 준비돼 있어요." },
        { text: "수업 흐름에 맞게 골라 태블릿 하나로 두 학생이 함께 즐길 수 있습니다.", expression: "cheer" },
      ],
    },
    // ── 칭찬 꿀벌집 직접 진입 ──
    { kind: "navigate", to: "dashboard", waitSelector: '[data-tutorial-id="praise-header"]' },
    {
      kind: "highlight",
      target: '[data-tutorial-id="praise-header"]',
      side: "bottom",
      expression: "welcome",
      lines: [
        { text: "**칭찬 꿀벌집** 🍯 — 학생 관리 대시보드예요." },
        { text: "관리 탭에서 학생별 스티커 지급, 시즌 목표 설정을 할 수 있어요.", expression: "cheer" },
        { text: "개인전 탭의 **우리 반 전시장**에는 학생들이 꾸민 벌이 모두 전시됩니다.", expression: "celebrate" },
      ],
    },
    // ── 단어 카드 직접 진입 ──
    { kind: "navigate", to: "vocab", waitSelector: '[data-tutorial-id="vocab-header"]' },
    {
      kind: "highlight",
      target: '[data-tutorial-id="vocab-header"]',
      side: "bottom",
      expression: "think",
      lines: [
        { text: "**단어 카드** 📚 어휘 100개가 준비돼 있어요." },
        { text: "'반 전체 보기'로 학생별 진도를 확인하고, **받아쓰기 학습지**도 인쇄하실 수 있어요.", expression: "cheer" },
      ],
    },
    // ── 허브 복귀 후 마무리 ──
    { kind: "navigate", to: "hub", waitSelector: '[data-tutorial-id="hub-header"]' },
    {
      kind: "celebrate",
      lines: [
        { text: "이게 우리 반 전체 구조예요. 🗺️", expression: "celebrate" },
        { text: "참, **그림책 공부**에서는 AI로 그림책을 만들 수 있고, 수업 세션을 시작하시면 학생 화면이 자동 이동됩니다!", expression: "cheer" },
        { text: "즐거운 수업 되세요, 선생님 🐝", expression: "teacher" },
      ],
      reward: { emoji: "🎓", label: "꿀벌 교실 안내 완료!" },
    },
  ],
};

/** Convenience accessor — pick the right scenario for the user role. */
export function getMainHubScenario(isTeacher: boolean): TutorialScenario {
  return isTeacher ? mainHubTeacherScenario : mainHubStudentScenario;
}

// Back-compat export (external imports still expect this name)
export const mainHubScenario = mainHubStudentScenario;

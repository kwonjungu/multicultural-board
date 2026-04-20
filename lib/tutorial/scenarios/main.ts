import type { TutorialScenario } from "../types";

/**
 * 메인 허브 첫 방문 튜토리얼. 꿀벌 선생님이 각 섹션 카드를 한 번씩
 * 가리키며 소개. 학생용/교사용이 별도 시나리오로 나뉨 — 어투와 지칭,
 * 강조 포인트가 다름.
 *
 * 필요한 data-tutorial-id 앵커 (HomeHub.tsx 에):
 *   - hub-header
 *   - hub-section-board / -interpreter / -games / -dashboard / -vocab
 */

const sharedReward = { emoji: "🏅", label: "꿀벌 탐험가 배지 획득!" };

// ─── 학생용 ─────────────────────────────────────────────────────────
export const mainHubStudentScenario: TutorialScenario = {
  id: "main",
  title: "메인 허브 둘러보기",
  estimatedMinutes: 3,
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
        { text: "친구 글에 좋아요도 눌러주고, 칭찬 스티커도 받아봐~", expression: "welcome" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-interpreter"]',
      side: "right",
      expression: "think",
      lines: [
        { text: "여긴 실시간 통역이야. 🎙️" },
        { text: "선생님 말이 어려울 때 마이크 누르고 말하면 네 언어로 바꿔줘!", expression: "cheer" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-games"]',
      side: "left",
      expression: "celebrate",
      lines: [
        { text: "소통의 게임! 🎮 내가 제일 좋아하는 곳이야~" },
        { text: "국가 맞추기, 단어 기억하기, 그림 그려 맞추기… 친구들이랑 같이 하는 놀이가 잔뜩 있어!", expression: "cheer" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-dashboard"]',
      side: "left",
      expression: "welcome",
      lines: [
        { text: "칭찬 꿀벌집 🍯" },
        { text: "친구들 꿀벌이 여기 다 있어. 칭찬을 받으면 네 벌집에 예쁜 스티커가 붙어!", expression: "cheer" },
        { text: "꾸미기 버튼으로 네 벌한테 모자도 씌워줄 수 있어~", expression: "celebrate" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-vocab"]',
      side: "left",
      expression: "think",
      lines: [
        { text: "단어 카드 📚" },
        { text: "그림이랑 소리로 새로운 낱말을 배워봐. 따라 말하고 써보기도 있어!", expression: "cheer" },
      ],
    },
    {
      kind: "celebrate",
      lines: [
        { text: "자, 이게 우리 반 전체 지도야! 🗺️", expression: "celebrate" },
        { text: "아, 가끔 선생님이 시작하면 다 같이 만드는 그림책도 열릴 거야~ 기대해!", expression: "cheer" },
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
  estimatedMinutes: 3,
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
        { text: "카드의 칭찬 버튼으로 학생에게 **스티커**를 보낼 수 있고, 주제 컬럼도 추가하실 수 있어요.", expression: "celebrate" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-interpreter"]',
      side: "right",
      expression: "think",
      lines: [
        { text: "**실시간 통역** 도우미예요. 🎙️" },
        { text: "수업 중 학생과 일대일 대화가 필요할 때 열어주세요. 양방향 실시간 번역이 됩니다.", expression: "cheer" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-games"]',
      side: "left",
      expression: "celebrate",
      lines: [
        { text: "**소통의 게임** 🎮 17종이 준비돼 있어요." },
        { text: "아이스브레이킹, 어휘 복습, 모둠 활동까지 수업 흐름에 맞게 고르실 수 있어요.", expression: "cheer" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-dashboard"]',
      side: "left",
      expression: "welcome",
      lines: [
        { text: "**칭찬 꿀벌집** 🍯 — 학생 관리 대시보드예요." },
        { text: "반 학생 모두의 칭찬 현황을 한눈에 보실 수 있어요.", expression: "cheer" },
        { text: "학생 꿀벌을 누르면 바로 **스티커 선물** 창이 열립니다.", expression: "celebrate" },
      ],
    },
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-vocab"]',
      side: "left",
      expression: "think",
      lines: [
        { text: "**단어 카드** 📚 어휘 400개가 준비돼 있어요." },
        { text: "학생별 진도가 개별 추적되고, **받아쓰기 시험**도 내실 수 있어요.", expression: "cheer" },
      ],
    },
    {
      kind: "celebrate",
      lines: [
        { text: "이게 우리 반 전체 구조예요. 🗺️", expression: "celebrate" },
        { text: "참, **모둠 그림책**은 선생님이 세션을 시작하시면 학생 화면으로 자동 이동됩니다!", expression: "cheer" },
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

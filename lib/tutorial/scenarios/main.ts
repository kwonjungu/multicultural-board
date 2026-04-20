import type { TutorialScenario } from "../types";

/**
 * 메인 허브 첫 방문 튜토리얼. 꿀벌 선생님이 각 섹션 카드를 한 번씩
 * 가리키며 소개. 약 3분 분량.
 *
 * 필요한 data-tutorial-id 앵커는 HomeHub.tsx에서:
 *   - hub-header
 *   - hub-section-board / -interpreter / -games / -dashboard / -vocab
 */
export const mainHubScenario: TutorialScenario = {
  id: "main",
  title: "메인 허브 둘러보기",
  estimatedMinutes: 3,
  steps: [
    // 1. 등장 + 자기소개
    {
      kind: "speak",
      expression: "welcome",
      anchor: { corner: "center" },
      lines: [
        { text: "앗, 누가 왔네~ 안녕! 🌼" },
        { text: "나는 너의 교실을 안내할 꿀벌 선생님이야!", expression: "cheer" },
        { text: "여긴 꿀처럼 달콤한 우리 반 공간이야. 같이 둘러볼래?", expression: "welcome" },
      ],
      particles: "sparkle",
    },

    // 2. 헤더 — 방 정보
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-header"]',
      side: "bottom",
      expression: "think",
      lines: [
        { text: "여기 위에 너의 이름이랑 방 번호가 있어. 🚪" },
        { text: "친구들도 이 방 번호로 들어오면 같이 이야기할 수 있어~", expression: "cheer" },
      ],
    },

    // 3. 소통창 카드
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-board"]',
      side: "right",
      expression: "cheer",
      lines: [
        { text: "첫 번째는 **소통창**! 🧡" },
        { text: "친구들이 쓴 글이 여기 모여. 한국어로 써도..." },
        { text: "다른 나라 친구들 화면엔 **자기 나라말로 짠** 하고 바뀌어!", expression: "celebrate" },
      ],
    },

    // 4. 실시간 통역
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-interpreter"]',
      side: "right",
      expression: "think",
      lines: [
        { text: "두 번째는 **실시간 통역**이야. 🎙️" },
        { text: "말을 하면 바로 번역돼. 수업 중에 너무 편해~", expression: "cheer" },
      ],
    },

    // 5. 소통의 게임
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-games"]',
      side: "left",
      expression: "celebrate",
      lines: [
        { text: "여긴 **소통의 게임** 🎮 내가 제일 좋아하는 곳!" },
        { text: "친구들이랑 같이 하는 게임이 잔뜩 있어. 내가 심판 볼게~" },
      ],
      // No waitFor — auto-advances when dialogue ends
    },

    // 6. 칭찬 꿀벌집
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-dashboard"]',
      side: "left",
      expression: "welcome",
      lines: [
        { text: "**칭찬 꿀벌집** 🍯 — 친구의 좋은 점을 알려주는 곳이야." },
        { text: "칭찬을 받으면 벌집에 예쁜 스티커가 붙어. 달콤하지?", expression: "cheer" },
      ],
    },

    // 7. 단어 카드
    {
      kind: "highlight",
      target: '[data-tutorial-id="hub-section-vocab"]',
      side: "left",
      expression: "think",
      lines: [
        { text: "마지막은 **단어 카드** 📚" },
        { text: "새로운 낱말을 그림이랑 소리로 배울 수 있어!", expression: "cheer" },
      ],
    },

    // 8. 마무리 + 보상
    {
      kind: "celebrate",
      lines: [
        { text: "여기까지가 우리 교실 전체 지도야! 🗺️", expression: "celebrate" },
        { text: "이제 원하는 곳을 눌러서 들어가 봐. 각 방에서 또 내가 기다리고 있을게~", expression: "cheer" },
        { text: "즐거운 하루 보내! 🐝✨", expression: "welcome" },
      ],
      reward: { emoji: "🏅", label: "꿀벌 탐험가 배지 획득!" },
    },
  ],
};

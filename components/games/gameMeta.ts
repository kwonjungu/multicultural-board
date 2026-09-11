/**
 * 게임 목록에 붙일 안내 메타데이터 — 작업 F(F-04).
 *
 * README §9: "각 게임에 인원·예상 시간·한 문장 규칙·연습 1문제를 제공한다."
 * 게임 수는 어디에도 하드코딩하지 않는다. 진실의 원본은 `GameRoom.tsx` 의
 * `GAMES` 이고 이 파일은 그 id 집합에 **붙는** 설명일 뿐이다. 새 게임이
 * 등록되면 `scripts/test-games-inventory.mjs` 가 빠진 항목을 fail 로 잡는다.
 *
 * 문구는 한국어 원문만 둔다. 화면에서는 게임 이름/부제와 똑같이
 * `GameText`(ko 원문 → 번역 캐시)로 아이 언어에 맞춰 표시한다.
 */

export type GameKind = "listen" | "speak" | "think";

export interface GamePractice {
  /** 연습 1문제의 질문. 점수·퀘스트와 무관하다. */
  question: string;
  choices: string[];
  answerIndex: number;
  /** 맞았을 때 보여줄 한 줄. 틀려도 다그치지 않는다. */
  afterword: string;
}

export interface GameGuide {
  id: string;
  /** 목록 필터 — 듣고 찾기 / 함께 말하기 / 생각하며 놀기. */
  kind: GameKind;
  /** 필요한 사람 수. solo 는 min 1. */
  players: { min: number; max: number };
  /** 한 판 예상 시간(분). 아이에게 "몇 분이면 끝나요"로 보여준다. */
  minutes: number;
  /** 한 문장 규칙. 두 문장으로 늘리지 말 것. */
  rule: string;
  practice: GamePractice;
}

export const GAME_GUIDES: Record<string, GameGuide> = {
  globe: {
    id: "globe", kind: "think", players: { min: 1, max: 4 }, minutes: 8,
    rule: "지구본을 돌려서 문제에 나온 나라를 찾아 누르면 돼요.",
    practice: { question: "김치는 어느 나라 음식일까요?", choices: ["한국", "브라질"], answerIndex: 0,
      afterword: "지구본에서 그 나라를 눌러 보면 돼요." },
  },
  marble: {
    id: "marble", kind: "think", players: { min: 2, max: 4 }, minutes: 15,
    rule: "주사위를 굴려 세계 도시를 돌며 꿀을 가장 많이 모으면 이겨요.",
    practice: { question: "주사위에서 3이 나오면 몇 칸 갈까요?", choices: ["3칸", "1칸"], answerIndex: 0,
      afterword: "나온 수만큼 앞으로 가요." },
  },
  yut: {
    id: "yut", kind: "think", players: { min: 2, max: 4 }, minutes: 15,
    rule: "윷을 던져 나온 만큼 말을 옮겨 먼저 다 들어오면 이겨요.",
    practice: { question: "윷 네 개가 모두 엎어지면 무엇일까요?", choices: ["윷", "개"], answerIndex: 0,
      afterword: "윷이 나오면 한 번 더 던져요." },
  },
  halligalli: {
    id: "halligalli", kind: "listen", players: { min: 2, max: 4 }, minutes: 6,
    rule: "같은 과일이 다섯 개가 되면 종을 먼저 누르면 돼요.",
    practice: { question: "딸기가 다섯 개 보이면 어떻게 할까요?", choices: ["종을 눌러요", "가만히 있어요"], answerIndex: 0,
      afterword: "다섯 개일 때만 눌러요." },
  },
  puzzle: {
    id: "puzzle", kind: "think", players: { min: 1, max: 2 }, minutes: 7,
    rule: "흩어진 조각을 끌어다 원래 그림으로 맞추면 돼요.",
    practice: { question: "조각이 맞는 자리에 가면 어떻게 될까요?", choices: ["딱 붙어요", "사라져요"], answerIndex: 0,
      afterword: "끌기가 어려우면 조각을 눌러서도 고를 수 있어요." },
  },
  country: {
    id: "country", kind: "think", players: { min: 1, max: 2 }, minutes: 5,
    rule: "국기를 보고 어느 나라인지 골라요.",
    practice: { question: "태극기는 어느 나라 국기일까요?", choices: ["한국", "일본"], answerIndex: 0,
      afterword: "잘 모르면 힌트를 한 번 더 봐요." },
  },
  emotion: {
    id: "emotion", kind: "think", players: { min: 1, max: 2 }, minutes: 5,
    rule: "얼굴과 이야기를 보고 어떤 마음인지 골라요.",
    practice: { question: "친구가 웃고 있어요. 어떤 마음일까요?", choices: ["기뻐요", "화나요"], answerIndex: 0,
      afterword: "마음은 하나로 정해지지 않을 때도 있어요." },
  },
  memory: {
    id: "memory", kind: "listen", players: { min: 1, max: 2 }, minutes: 6,
    rule: "카드를 두 장 뒤집어 같은 뜻의 두 낱말을 찾으면 돼요.",
    practice: { question: "'사과'와 같은 뜻인 카드는 무엇일까요?", choices: ["apple", "school"], answerIndex: 0,
      afterword: "카드를 누르면 소리로도 들려줘요." },
  },
  greeting: {
    id: "greeting", kind: "listen", players: { min: 1, max: 2 }, minutes: 5,
    rule: "들려주는 인사말을 듣고 같은 인사를 골라요.",
    practice: { question: "'안녕하세요'는 어떤 인사일까요?", choices: ["만났을 때", "헤어질 때"], answerIndex: 0,
      afterword: "한 번 더 들어볼 수 있어요." },
  },
  market: {
    id: "market", kind: "speak", players: { min: 2, max: 2 }, minutes: 8,
    rule: "가게 주인과 손님이 되어 물건을 사고파는 말을 주고받아요.",
    practice: { question: "물건을 살 때 먼저 할 말은 무엇일까요?", choices: ["얼마예요?", "잘 가요"], answerIndex: 0,
      afterword: "천천히 말해도 괜찮아요." },
  },
  draw: {
    id: "draw", kind: "speak", players: { min: 2, max: 4 }, minutes: 8,
    rule: "한 사람이 그림을 그리고 친구가 무엇인지 맞혀요.",
    practice: { question: "그림을 그리는 사람이 해도 되는 것은?", choices: ["그림만 그리기", "정답 말하기"], answerIndex: 0,
      afterword: "글자를 쓰지 않고 그림으로만 알려줘요." },
  },
  spot: {
    id: "spot", kind: "think", players: { min: 1, max: 2 }, minutes: 6,
    rule: "비슷한 두 그림에서 다른 곳을 찾아 누르면 돼요.",
    practice: { question: "다른 곳을 찾으면 어떻게 할까요?", choices: ["그 자리를 눌러요", "화면을 흔들어요"], answerIndex: 0,
      afterword: "작은 곳은 크게 키워서 봐도 돼요." },
  },
  number: {
    id: "number", kind: "listen", players: { min: 2, max: 2 }, minutes: 5,
    rule: "들려주는 숫자를 둘 중 먼저 누른 사람이 1점을 받아요.",
    practice: { question: "'셋'이 들리면 어떤 숫자를 누를까요?", choices: ["3", "7"], answerIndex: 0,
      afterword: "소리가 안 나오면 다시 듣기를 누르면 돼요." },
  },
  tower: {
    id: "tower", kind: "think", players: { min: 1, max: 2 }, minutes: 6,
    rule: "낱말의 뜻을 맞힐 때마다 탑이 한 층씩 올라가요.",
    practice: { question: "'물'은 영어로 무엇일까요?", choices: ["water", "fire"], answerIndex: 0,
      afterword: "틀려도 탑은 무너지지 않아요." },
  },
  twentyq: {
    id: "twentyq", kind: "speak", players: { min: 2, max: 4 }, minutes: 10,
    rule: "예·아니오로만 물어보며 친구가 생각한 것을 맞혀요.",
    practice: { question: "물어봐도 되는 말은 무엇일까요?", choices: ["동물인가요?", "정답이 뭐예요?"], answerIndex: 0,
      afterword: "예·아니오로 답할 수 있는 질문만 해요." },
  },
  taboo: {
    id: "taboo", kind: "speak", players: { min: 2, max: 4 }, minutes: 5,
    rule: "빨간 금칙어를 빼고 설명해서 친구가 답을 맞히게 해요.",
    practice: { question: "'선생님'을 설명할 때 쓰면 안 되는 말은?", choices: ["학교", "친절해요"], answerIndex: 0,
      afterword: "시간은 세 가지 중에서 고를 수 있어요." },
  },
  wyr: {
    id: "wyr", kind: "speak", players: { min: 2, max: 6 }, minutes: 6,
    rule: "둘 중 하나를 고르고 왜 골랐는지 이야기해요.",
    practice: { question: "정답이 있는 놀이일까요?", choices: ["아니요, 생각을 말해요", "네, 하나만 맞아요"], answerIndex: 0,
      afterword: "친구 생각이 달라도 괜찮아요." },
  },
  spotit: {
    id: "spotit", kind: "listen", players: { min: 2, max: 4 }, minutes: 6,
    rule: "두 카드에서 똑같은 그림을 먼저 찾아 누르면 돼요.",
    practice: { question: "두 카드에 같은 그림은 몇 개일까요?", choices: ["하나", "셋"], answerIndex: 0,
      afterword: "찾으면 그 그림을 눌러요." },
  },
  story: {
    id: "story", kind: "speak", players: { min: 2, max: 6 }, minutes: 10,
    rule: "주사위 그림을 보고 한 문장씩 이어서 이야기를 만들어요.",
    practice: { question: "내 차례에 몇 문장을 말할까요?", choices: ["한 문장", "다섯 문장"], answerIndex: 0,
      afterword: "짧아도 좋아요. 이어지기만 하면 돼요." },
  },
  treasure: {
    id: "treasure", kind: "think", players: { min: 1, max: 4 }, minutes: 8,
    rule: "힌트를 읽고 보물이 숨은 곳을 찾아내요.",
    practice: { question: "힌트가 어려우면 어떻게 할까요?", choices: ["다시 읽어봐요", "그만둬요"], answerIndex: 0,
      afterword: "힌트는 여러 번 볼 수 있어요." },
  },
  cafe: {
    id: "cafe", kind: "speak", players: { min: 2, max: 4 }, minutes: 10,
    rule: "손님의 주문을 듣고 순서대로 재료를 넣어 요리를 완성해요.",
    practice: { question: "주문을 받으면 먼저 할 일은?", choices: ["재료를 확인해요", "바로 내줘요"], answerIndex: 0,
      afterword: "순서가 틀리면 다시 만들 수 있어요." },
  },
};

export const GAME_KIND_LABEL: Record<GameKind, string> = {
  listen: "듣고 찾기",
  speak: "함께 말하기",
  think: "생각하며 놀기",
};

/** 인원 표기. "2명" / "2~4명" — 게임 수를 세는 데 쓰지 말 것. */
export function playersLabel(guide: GameGuide): string {
  const { min, max } = guide.players;
  return min === max ? `${min}명` : `${min}~${max}명`;
}

/** 등록된 게임 id 를 받아 안내가 빠진 id 를 돌려준다. 목록의 길이를 가정하지 않는다. */
export function missingGuides(registeredIds: readonly string[]): string[] {
  return registeredIds.filter((id) => !(id in GAME_GUIDES));
}

/** 안내만 있고 실제로 등록되지 않은 id (게임을 지웠는데 안내가 남은 경우). */
export function orphanGuides(registeredIds: readonly string[]): string[] {
  const set = new Set(registeredIds);
  return Object.keys(GAME_GUIDES).filter((id) => !set.has(id));
}

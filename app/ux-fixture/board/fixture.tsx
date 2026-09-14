"use client";

import { useEffect, useState } from "react";
import PadletBoard, { type BoardFixture } from "@/components/PadletBoard";
import type { CardData } from "@/lib/types";

/**
 * 고정 입력 (HARNESS §2): 시각 2026-09-11T00:00:00Z, seed=17, 주제 3개,
 * 카드 0/1/50개, 본문 2,000자, 번역 실패 카드, 이미지 404 카드, 긴 이름.
 * 실명·운영 방 데이터는 쓰지 않는다. 전부 만들어낸 값이다.
 */
const FIXED_NOW = Date.parse("2026-09-11T00:00:00Z");
const ROOM_LANGS = ["ko", "vi", "en"];

/** seed=17 선형 합동 생성기 — 실행마다 같은 카드가 나온다. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const KO_SENTENCES = [
  "오늘 급식에 나온 김치볶음밥이 정말 맛있었어요.",
  "쉬는 시간에 친구랑 같이 그림을 그렸어요.",
  "체육 시간에 달리기를 했는데 조금 힘들었어요.",
  "집에 가는 길에 고양이를 봤어요. 아주 작았어요.",
  "어제 비가 와서 우산을 쓰고 학교에 왔어요.",
];

const VI_SENTENCES = [
  "Hôm nay cơm chiên kim chi ở trường rất ngon.",
  "Giờ ra chơi em vẽ tranh cùng bạn.",
  "Giờ thể dục em chạy bộ, hơi mệt một chút.",
  "Trên đường về nhà em thấy một con mèo rất nhỏ.",
  "Hôm qua trời mưa nên em che ô đi học.",
];

const LONG_KO = "오늘 있었던 일을 하나도 빼놓지 않고 다 이야기하고 싶어요. ".repeat(40).slice(0, 2000);
const LONG_VI = "Em muốn kể lại tất cả những gì đã xảy ra hôm nay mà không bỏ sót điều gì. ".repeat(30).slice(0, 2000);

function textCard(over: Partial<CardData> & { id: string; colId: string }): CardData {
  return {
    cardType: "text",
    authorLang: "ko",
    authorName: "학생 01",
    isTeacher: false,
    originalText: KO_SENTENCES[0],
    /* 세 번째 언어를 하나 둔다 — 보는 사람 언어도 원문 언어도 아닌 번역이
       있어야 카드에 '번역' 버튼이 나온다. 이게 없으면 그 버튼이 fixture 에서
       아예 렌더되지 않아 검수에서 빠진다. */
    translations: { ko: KO_SENTENCES[0], vi: VI_SENTENCES[0], en: "Today the rice was really tasty." },
    paletteIdx: 0,
    timestamp: FIXED_NOW - 3600_000,
    flagged: false,
    ...over,
  } as CardData;
}

function buildCards(): CardData[] {
  const rng = makeRng(17);
  const cards: CardData[] = [];

  // 주제 1: 카드 1개 (짧은 글 하나)
  cards.push(textCard({
    id: "fx-a1", colId: "fx-col-1", authorName: "학생 07",
    timestamp: FIXED_NOW - 1800_000,
    // U05 — 프로필로 이어지는 글(현재 선택된 동물이 보인다)
    authorLearnerId: "L-07",
  }));

  // 주제 2: 카드 50개 — 가장자리 입력을 앞쪽에 둔다.
  const edge: CardData[] = [
    textCard({
      id: "fx-b-long",
      colId: "fx-col-2",
      authorName: "응우옌티민카이응우옌티민카이응우옌티민카이",
      originalText: LONG_KO,
      translations: { ko: LONG_KO, vi: LONG_VI },
      timestamp: FIXED_NOW - 600_000,
    }),
    textCard({
      id: "fx-b-failed",
      colId: "fx-col-2",
      authorName: "학생 12",
      originalText: "번역 서버가 멈췄을 때도 원문은 읽을 수 있어야 해요.",
      translations: { ko: "번역 서버가 멈췄을 때도 원문은 읽을 수 있어야 해요." },
      translateError: true,
      timestamp: FIXED_NOW - 900_000,
    }),
    textCard({
      id: "fx-b-loading",
      colId: "fx-col-2",
      authorName: "학생 23",
      originalText: "방금 올린 글이라 아직 번역이 오는 중이에요.",
      translations: { ko: "방금 올린 글이라 아직 번역이 오는 중이에요." },
      loading: true,
      timestamp: FIXED_NOW - 120_000,
    }),
    textCard({
      id: "fx-b-img404",
      colId: "fx-col-2",
      cardType: "image",
      authorName: "학생 31",
      originalText: "",
      translations: {},
      imageUrl: "/ux-fixture/this-image-does-not-exist.png",
      timestamp: FIXED_NOW - 1200_000,
    }),
    textCard({
      id: "fx-b-teacher",
      colId: "fx-col-2",
      authorName: "테스트 교사",
      isTeacher: true,
      originalText: "친구 이야기를 끝까지 들어 준 모습이 참 좋았어요.",
      translations: {
        ko: "친구 이야기를 끝까지 들어 준 모습이 참 좋았어요.",
        vi: "Cô rất thích cách các em lắng nghe bạn đến cuối.",
      },
      timestamp: FIXED_NOW - 1500_000,
    }),
  ];
  cards.push(...edge);

  for (let i = edge.length; i < 50; i++) {
    const k = Math.floor(rng() * KO_SENTENCES.length);
    const ko = KO_SENTENCES[k];
    const vi = VI_SENTENCES[k];
    cards.push(textCard({
      id: `fx-b-${i}`,
      colId: "fx-col-2",
      authorName: `학생 ${String(i).padStart(2, "0")}`,
      originalText: ko,
      translations: { ko, vi },
      timestamp: FIXED_NOW - 2000_000 - i * 60_000,
    }));
  }

  /* 주제 4: 사용자가 '새 주제 추가' 로 만든 칸. 제목에 이모지가 없어
     columnIconFor 가 null 을 돌려주고 .bd-col-art 가 렌더되지 않는다 —
     아이콘 있는 칸과 머리 높이가 어긋나는지 여기서 잡는다. 카드가 하나는
     있어야 머리 아래 줄들의 y 도 비교할 수 있다. */
  cards.push(textCard({
    id: "fx-d1", colId: "fx-col-4", authorName: "학생 44",
    originalText: KO_SENTENCES[3],
    translations: { ko: KO_SENTENCES[3], vi: VI_SENTENCES[3] },
    timestamp: FIXED_NOW - 300_000,
  }));

  // 주제 3: 카드 0개 (빈 주제 안내를 본다)
  return cards;
}

/** U05 검수용 학습자 프로필. 권위 저장소는 RoomConfig.learners 다. */
const LEARNERS = {
  "L-07": {
    learnerId: "L-07", displayName: "학생 07", rosterStatus: "active" as const,
    createdAt: FIXED_NOW, updatedAt: FIXED_NOW, version: 1, avatarAnimalId: "fox",
  },
  "L-vn": {
    learnerId: "L-vn", displayName: "응우옌티민카이", rosterStatus: "active" as const,
    createdAt: FIXED_NOW, updatedAt: FIXED_NOW, version: 1, avatarAnimalId: "penguin",
  },
};

const FIXTURE: BoardFixture = {
  /**
   * 기본 3열 + **사용자가 추가한 열** 3개.
   *
   * 왜 늘렸나: 기본 열 제목은 전부 이모지로 시작해 lib/assets.ts 의
   * columnIconFor 가 아이콘을 돌려준다. 반면 PadletBoard 의 addColumnQuick 은
   * createColumn("새 칸", …) 이라 이모지가 없어 아이콘이 null 이고
   * .bd-col-art 가 아예 렌더되지 않는다. 기본 3열만 두면 그 상태가 검수에서
   * 통째로 빠진다 — 사용자가 본 어긋남이 정확히 거기서 났다.
   *
   * 네 가지 경우를 한 화면에 깐다:
   *  - fx-col-4: 이모지 없는 짧은 제목 (실제 '새 칸' 그대로)
   *  - fx-col-5: 이모지 없는 아주 긴 제목 → 두 줄 이상으로 감긴다
   *  - fx-col-6: 이모지 있는 긴 제목 → 아이콘 + 여러 줄
   */
  columns: [
    { id: "fx-col-1", title: "🙋 자기소개 / Introduce", color: "#F59E0B", order: 0 },
    { id: "fx-col-2", title: "💬 오늘의 이야기 / Today", color: "#FF6584", order: 1 },
    { id: "fx-col-3", title: "🌟 칭찬해요 / Praise", color: "#43C59E", order: 2 },
    { id: "fx-col-4", title: "새 칸", color: "#7C6CF5", order: 3 },
    {
      id: "fx-col-5",
      title: "우리 반 친구들이 방학 동안 겪은 아주 특별한 이야기를 하나씩 모아 봐요",
      color: "#0EA5E9", order: 4,
    },
    {
      id: "fx-col-6",
      title: "🎨 함께 그리고 만드는 우리 반 미술 이야기 / Art time together",
      color: "#F97316", order: 5,
    },
  ],
  cards: buildCards(),
  /**
   * U06 검수용 반응 조합. 실제 노드와 같은 모양 `{ clientId: 값 }` 이고
   * 내 clientId 는 아래 컴포넌트가 넘기는 "fx-client-17" 이다.
   *
   * 02 §3.B 가 요구한 경계를 한 화면에서 다 보이게 깔았다:
   *  - fx-a1     : 옛 `true` 만 3개. '좋아요' 로 집계돼야 하고 사라지면 안 된다.
   *  - fx-b-long : 옛 `true` 와 신·구 반응 문자열이 섞임 + 내 선택이 옛 `true`.
   *                (내 것이 like 로 선택 표시돼야 하고, 바꾸면 합계가 유지돼야 한다)
   *  - fx-b-0    : 신규 like/cheer 만. 새 종류가 제대로 집계되는지.
   *  - fx-b-1    : 내가 nice 를 고른 상태. 재선택 취소·교체를 눌러 볼 수 있다.
   *  - 나머지    : 반응 0개 — 개수 칩이 아예 안 나오는 상태.
   */
  reactions: {
    "fx-a1": { "fx-c-a": true, "fx-c-b": true, "fx-c-c": true },
    "fx-b-long": {
      "fx-client-17": true,
      "fx-c-a": "thanks", "fx-c-b": "same", "fx-c-c": "nice",
      "fx-c-d": "like", "fx-c-e": "cheer", "fx-c-f": true,
    },
    "fx-b-0": { "fx-c-a": "like", "fx-c-b": "like", "fx-c-c": "cheer" },
    "fx-b-1": { "fx-client-17": "nice", "fx-c-a": "thanks" },
  },
};

export default function BoardFixtureScreen() {
  /** ?role=teacher 로 교사 보기. SSR/CSR 불일치를 피하려고 마운트 뒤에 정한다. */
  const [role, setRole] = useState<"student" | "teacher" | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setRole(q.get("role") === "teacher" ? "teacher" : "student");
  }, []);
  if (!role) return null;

  const isTeacher = role === "teacher";
  return (
    <PadletBoard
      user={{
        myLang: "vi",
        myName: isTeacher ? "테스트 교사" : "학생 07",
        isTeacher,
        teacherLangs: isTeacher ? ROOM_LANGS : [],
        ...(isTeacher ? {} : { learnerId: "L-07", animalId: "fox" }),
      }}
      roomCode="9999"
      roomLangs={ROOM_LANGS}
      roomConfig={{
        languages: ROOM_LANGS, rosterMode: true, roster: ["학생 07"],
        /* U05 — 카드의 authorLearnerId 가 여기로 이어져 작성자 아바타에 그
           아이의 동물이 나온다. 프로필이 없는 옛 글은 결정적 폴백 동물로
           떨어지므로 둘을 한 화면에서 비교할 수 있다. */
        learners: LEARNERS,
      }}
      myClientId="fx-client-17"
      onLogout={() => console.log("[fixture] onLogout")}
      onPraiseStudent={(id, name) => console.log("[fixture] praise", id, name)}
      fixture={FIXTURE}
    />
  );
}

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
    translations: { ko: KO_SENTENCES[0], vi: VI_SENTENCES[0] },
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
  cards.push(textCard({ id: "fx-a1", colId: "fx-col-1", authorName: "학생 07", timestamp: FIXED_NOW - 1800_000 }));

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

  // 주제 3: 카드 0개 (빈 주제 안내를 본다)
  return cards;
}

const FIXTURE: BoardFixture = {
  columns: [
    { id: "fx-col-1", title: "🙋 자기소개 / Introduce", color: "#F59E0B", order: 0 },
    { id: "fx-col-2", title: "💬 오늘의 이야기 / Today", color: "#FF6584", order: 1 },
    { id: "fx-col-3", title: "🌟 칭찬해요 / Praise", color: "#43C59E", order: 2 },
  ],
  cards: buildCards(),
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
      }}
      roomCode="9999"
      roomLangs={ROOM_LANGS}
      roomConfig={{ languages: ROOM_LANGS, rosterMode: true, roster: ["학생 07"] }}
      myClientId="fx-client-17"
      onLogout={() => console.log("[fixture] onLogout")}
      onPraiseStudent={(id, name) => console.log("[fixture] praise", id, name)}
      fixture={FIXTURE}
    />
  );
}

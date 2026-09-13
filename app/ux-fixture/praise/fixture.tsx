"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PraiseHive, { type PraiseFixture } from "@/components/PraiseHive";
import CosmeticPicker, { type CosmeticFixture } from "@/components/CosmeticPicker";
import { dailyQuestsFor, unclaimedCount, type DailyQuestState } from "@/lib/quests";
import type {
  UserConfig,
  IndividualSticker,
  TeamSticker,
  StickerGoal,
  StudentCosmetics,
} from "@/lib/types";
import type { GalleryData } from "@/lib/gallery";
import type { VillageData } from "@/lib/village";

/**
 * 칭찬 꿀벌집 + 꿀벌 마을 + 꾸미기 시각 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): PraiseHive·BeeVillage·CosmeticPicker 모두 `fixture`
 * prop 이 주어지면 Firebase 를 구독하지도 쓰지도 않는다. 여기의 이름·방
 * 번호·스티커·꿀은 전부 지어낸 값이며 운영 방(1111)의 데이터를 복제하지
 * 않았다. 고정 시각 2026-09-11T00:00:00Z 기준으로 timestamp 를 만든다.
 */

const T0 = Date.parse("2026-09-11T00:00:00Z");
const DAY = 86400_000;
const ROOM_CODE = "9999";
const DAY_KEY = "2026-09-11";

const STUDENT_A = "학생 A"; // 나 (뷰어)
const STUDENT_B = "학생 B";
const STUDENT_C = "학생 C";
const TEACHER_NAME = "테스트 교사";

export type PraiseView = "reasons" | "collection" | "friend" | "decorate" | "village";

const MY_COSMETICS: StudentCosmetics = {
  skin: "sky",
  hat: "cap",
  pet: "rabbit",
  trophy: "gold",
  petPos: "right",
  backdrop: "flower",
  aura: "sparkle",
  held: "book",
  acc: "glasses",
};

const FRIEND_B_COSMETICS: StudentCosmetics = {
  skin: "pink",
  // crown-honey 는 여왕벌(stage-5) 전용이라 stage-4 벌에는 에셋이 없다
  // (public/stickers/stage-hats 에 stage-5-queen-crown-honey.png 만 있음).
  // 씌우면 404 두 건이 나므로 stage-4 에 실제로 있는 crown 을 쓴다.
  hat: "crown",
  pet: "fox",
  trophy: "diamond",
  petPos: "left",
  backdrop: "throne",
  aura: "royal",
  held: "flag",
  acc: "cape",
};

const FRIEND_C_COSMETICS: StudentCosmetics = {
  skin: "classic",
  hat: null,
  pet: null,
  trophy: null,
  petPos: "right",
  backdrop: null,
  aura: null,
  held: null,
  acc: null,
};

function myStickers(): IndividualSticker[] {
  const memos: Array<string | undefined> = [
    "친구를 도와줘서 고마워요",
    "발표를 용감하게 했어요",
    undefined,
    "그림을 창의적으로 그렸어요",
    undefined,
    "끝까지 포기하지 않았어요",
  ];
  const types: IndividualSticker["type"][] = [
    "helpful", "brave", "cooperative", "creative", "curious", "persistent",
  ];
  return types.map((type, i) => ({
    id: `sk-${i}`,
    type,
    fromTeacherName: TEACHER_NAME,
    fromTeacherId: TEACHER_NAME,
    timestamp: T0 - (types.length - i) * DAY,
    ...(memos[i] ? { memo: memos[i] as string } : {}),
    source: "teacher",
  }));
}

function counts(): Record<string, number> {
  return { [STUDENT_A]: 6, [STUDENT_B]: 9, [STUDENT_C]: 2 };
}

function allCosmetics(): Record<string, StudentCosmetics> {
  return {
    [STUDENT_A]: MY_COSMETICS,
    [STUDENT_B]: FRIEND_B_COSMETICS,
    [STUDENT_C]: FRIEND_C_COSMETICS,
  };
}

function gallery(): GalleryData {
  return {
    [STUDENT_A]: {
      likes: { [STUDENT_B]: { last: "2026-09-10", count: 3 } },
      comments: {
        c1: {
          id: "c1", fromClientId: STUDENT_B, fromName: STUDENT_B, fromLang: "ko",
          text: "오늘도 멋져요!", timestamp: T0 - DAY,
        },
      },
    },
    [STUDENT_B]: {
      likes: {
        [STUDENT_A]: { last: "2026-09-10", count: 5 },
        [STUDENT_C]: { last: "2026-09-09", count: 2 },
      },
      comments: {
        c2: {
          id: "c2", fromClientId: STUDENT_C, fromName: STUDENT_C, fromLang: "vi",
          text: "Bạn giỏi quá!", timestamp: T0 - 2 * DAY,
        },
      },
    },
    [STUDENT_C]: {},
  };
}

function team(): TeamSticker[] {
  const types: TeamSticker["type"][] = ["helpful", "brave", "creative", "cooperative"];
  const contributors = [STUDENT_A, STUDENT_B, STUDENT_C];
  return types.map((type, i) => ({
    id: `tm-${i}`,
    type,
    fromTeacherName: TEACHER_NAME,
    fromTeacherId: TEACHER_NAME,
    contributorClientId: contributors[i % contributors.length],
    timestamp: T0 - i * DAY,
    source: "teacher",
  }));
}

function goal(): StickerGoal {
  return { target: 100, seasonStart: T0 - 10 * DAY };
}

function village(): VillageData {
  return {
    [STUDENT_A]: {
      // 실제 오늘(리뷰 시점)과 절대 같을 수 없는 고정 과거 날짜 — 항상 "오늘 아직 안 주움" 으로 보인다.
      honey: 65,
      lastDew: "2026-09-05",
      lastExchangedCount: 6,
      owned: { "house-mushroom": true, "plate-honey": true, "fence-wood": true },
      house: { style: "house-mushroom", plate: "plate-honey", fence: "fence-wood", yard: ["yard-flowerbed-tulip", "", ""] },
      gardenLevel: 2,
      gardenWater: 3,
      watered: { "2026-09-10": { [STUDENT_B]: true } },
    },
    [STUDENT_B]: {
      honey: 120,
      lastDew: "2026-09-05",
      lastExchangedCount: 9,
      owned: { "house-castle": true, "plate-flower": true },
      house: { style: "house-castle", plate: "plate-flower", fence: null, yard: ["", "", ""] },
      gardenLevel: 4,
      gardenWater: 1,
    },
    [STUDENT_C]: {
      honey: 10,
      lastExchangedCount: 2,
      owned: {},
      house: { style: "house-hive", plate: "plate-wood", fence: null, yard: ["", "", ""] },
      gardenLevel: 0,
      gardenWater: 0,
    },
  };
}

function questState(): { quests: ReturnType<typeof dailyQuestsFor>; state: DailyQuestState } {
  const quests = dailyQuestsFor(DAY_KEY, STUDENT_A);
  const state: DailyQuestState = {
    events: { [quests[0].event]: 1, [quests[1].event]: 1 },
    claimed: { [quests[0].id]: true },
  };
  return { quests, state };
}

function buildFixture(view: PraiseView): PraiseFixture {
  const { quests, state } = questState();
  return {
    myStickers: myStickers(),
    myCosmetics: MY_COSMETICS,
    counts: counts(),
    allCosmetics: allCosmetics(),
    gallery: gallery(),
    galleryFocus: view === "friend" ? STUDENT_B : undefined,
    team: team(),
    goal: goal(),
    questUnclaimed: unclaimedCount(quests, state),
    village: {
      counts: counts(),
      allCosmetics: allCosmetics(),
      village: village(),
      quest: { quests, state },
    },
  };
}

const VIEW_TAB: Record<PraiseView, "mine" | "village" | "race" | "team" | "manage"> = {
  reasons: "mine",
  collection: "race",
  friend: "race",
  decorate: "mine",
  village: "village",
};

export default function PraiseFixtureScreen({
  view,
  teacher = false,
  lang = "ko",
}: {
  view: PraiseView;
  teacher?: boolean;
  lang?: string;
}) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const blockedRef = useRef<string[]>([]);

  // 네트워크 차단: fixture 는 어떤 원격 호출도 하지 않는다. /api/* 는 canned
  // 응답으로 막고, 새는 경로가 있으면 화면에 드러낸다.
  useEffect(() => {
    const real = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      if (path.startsWith("/_next") || path.startsWith("/__next")) return real(input as RequestInfo, init);
      if (path.startsWith("/api/")) {
        blockedRef.current = Array.from(new Set([...blockedRef.current, path]));
        setBlocked(blockedRef.current);
        return new Response(JSON.stringify({ error: "fixture" }), {
          status: 503, headers: { "content-type": "application/json" },
        });
      }
      return real(input as RequestInfo, init);
    }) as typeof window.fetch;
    return () => { window.fetch = real; };
  }, []);

  const user: UserConfig = useMemo(
    () => ({
      myLang: lang,
      myName: teacher ? TEACHER_NAME : STUDENT_A,
      isTeacher: teacher,
      teacherLangs: ["ko", "vi", "en"],
    }),
    [lang, teacher],
  );

  const fixture = useMemo(() => buildFixture(view), [view]);
  const cosmeticFixture: CosmeticFixture = useMemo(() => ({ current: MY_COSMETICS }), []);
  const decorateOpen = view === "decorate";

  return (
    <>
      <PraiseHive
        key={`${view}-${teacher}-${lang}`}
        user={user}
        roomCode={ROOM_CODE}
        roomConfig={{ languages: ["ko", "vi", "en"], roster: [STUDENT_A, STUDENT_B, STUDENT_C] }}
        myClientId={teacher ? TEACHER_NAME : STUDENT_A}
        onBack={() => { /* fixture: 돌아갈 상위 화면이 없다 */ }}
        onOpenGive={() => { /* fixture: 스티커 지급 모달은 여기서 열지 않는다 */ }}
        onOpenCosmetics={() => { /* fixture: 꾸미기는 ?view=decorate 로 직접 연다 */ }}
        fixture={fixture}
        initialTab={VIEW_TAB[view]}
      />
      {/* CosmeticPicker 는 실제 앱에서도 PraiseHive 밖(page.tsx)에 나란히 떠 있는
          형제 컴포넌트다 — 여기서도 같은 자리를 재현한다. */}
      <CosmeticPicker
        open={decorateOpen}
        roomCode={ROOM_CODE}
        myClientId={STUDENT_A}
        stickerCount={counts()[STUDENT_A]}
        lang={lang}
        onClose={() => { /* fixture: 정적 화면 — 실제 라우팅 없음 */ }}
        fixture={cosmeticFixture}
      />
      {/* 개발용 뷰 전환 스위치 — 검수 스크립트가 제품 UI로 세지 않도록 표식을 단다. */}
      <div
        data-fixture-chrome
        style={{
          position: "fixed", top: 8, left: 8, zIndex: 9999,
          display: "flex", gap: 6, flexWrap: "wrap", maxWidth: "70vw",
          font: "11px/1.4 monospace",
        }}
      >
        {(["reasons", "collection", "friend", "decorate", "village"] as PraiseView[]).map((v) => (
          <a
            key={v}
            href={`?view=${v}&role=${teacher ? "teacher" : "student"}&lang=${lang}`}
            style={{
              padding: "3px 8px", borderRadius: 6,
              background: v === view ? "#B45309" : "#fff",
              color: v === view ? "#fff" : "#B45309",
              border: "1px solid #B45309", textDecoration: "none",
            }}
          >{v}</a>
        ))}
      </div>
      {blocked.length > 0 && (
        <pre
          data-fixture-leak
          data-fixture-chrome
          style={{
            position: "fixed", left: 8, bottom: 8, zIndex: 9999, margin: 0,
            padding: "6px 10px", borderRadius: 8, background: "#B3261E", color: "#fff",
            font: "12px/1.4 monospace", maxWidth: "60vw",
          }}
        >
          fixture 가 가로챈 원격 호출: {blocked.join(", ")}
        </pre>
      )}
    </>
  );
}

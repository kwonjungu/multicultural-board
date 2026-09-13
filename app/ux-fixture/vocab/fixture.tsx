"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VocabHub, { type VocabFixture } from "@/components/VocabHub";
import { emptyState, MAX_HEARTS, type LearnerState } from "@/lib/lms";
import type { ProgressMap } from "@/lib/vocabProgress";
import type { ExpressionEntry } from "@/lib/expressionLog";
import type { UserConfig } from "@/lib/types";

/**
 * 단어 배우기(U07) 시각 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): VocabHub 는 `fixture` prop 이 주어지면 Firebase 를
 * 구독하지도 쓰지도 않고 localStorage 진도도 건드리지 않는다. 여기의 이름·진도·
 * 표현 기록은 전부 지어낸 값이며 운영 방(1111)의 학생 데이터를 복제하지 않았다.
 *
 * 고정 입력(HARNESS §2): 시각 2026-09-11T00:00:00Z, 이름 '학생 A', 방 9999.
 */

/** 고정 시계 — 진도 timestamp 가 캡처마다 흔들리지 않게 한다. */
const T0 = Date.parse("2026-09-11T00:00:00Z");
const DAY = 86400_000;

export type VocabState = "new" | "progress" | "rich";

function progressFor(state: VocabState): ProgressMap {
  if (state === "new") return {};
  // 감정 단원 앞쪽 단어만 손댄 상태 — '이어하기' 가 진짜 근거를 갖는지 본다.
  const base: ProgressMap = {
    happy: { doneSentences: [0, 1, 2], listenCount: 6, lastStudied: T0 - 2 * DAY, testPassed: 2, testFailed: 0, lastTested: T0 - 2 * DAY },
    sad: { doneSentences: [0, 1], listenCount: 3, lastStudied: T0 - DAY },
    angry: { doneSentences: [0], listenCount: 1, lastStudied: T0 - 3600_000 },
  };
  if (state === "progress") return base;
  return {
    ...base,
    scared: { doneSentences: [0, 1, 2], listenCount: 4, lastStudied: T0 - 5 * DAY, testPassed: 1, testFailed: 1, lastTested: T0 - 4 * DAY },
    fun: { doneSentences: [0], listenCount: 2, lastStudied: T0 - 6 * DAY },
  };
}

function learnerFor(state: VocabState): LearnerState | null {
  if (state === "new") return { ...emptyState(), dailyGoal: 20 };
  return {
    ...emptyState(),
    xp: state === "rich" ? 1240 : 180,
    hearts: state === "rich" ? 3 : MAX_HEARTS,
    heartsLastLost: state === "rich" ? T0 - 600_000 : 0,
    streak: state === "rich" ? 7 : 2,
    streakLastDate: "2026-09-10",
    dailyXp: state === "rich" ? 30 : 10,
    dailyXpDate: "2026-09-11",
    dailyGoal: 20,
  };
}

function expressionsFor(state: VocabState): ExpressionEntry[] {
  if (state !== "rich") return [];
  return [
    {
      id: "e1", text: "같이 놀자", lang: "ko", translation: "Cùng chơi nhé",
      translationLang: "vi", source: "card-1", ts: T0 - 3 * DAY,
      box: 2, nextDueAt: T0 - 3600_000, reviewCount: 3, correctCount: 2,
    },
    {
      id: "e2", text: "도와주세요", lang: "ko", translation: "Xin hãy giúp tôi",
      translationLang: "vi", source: "card-2", ts: T0 - 5 * DAY,
      box: 1, nextDueAt: T0 - 7200_000, reviewCount: 1, correctCount: 0,
    },
    {
      id: "e3", text: "잘 모르겠어요", lang: "ko", translation: "Tôi không biết rõ",
      translationLang: "vi", source: "manual", ts: T0 - DAY,
      box: 3, nextDueAt: T0 + 2 * DAY, reviewCount: 5, correctCount: 5,
    },
  ];
}

/** 소통창에서 긁어온 것처럼 보이는 가짜 문장 — 실제 게시글이 아니다. */
function cardTextsFor(state: VocabState): string[] {
  if (state === "new") return [];
  return [
    "오늘 급식이 정말 맛있어서 기뻤어요.",
    "친구가 도와줘서 고마웠습니다.",
    "체육 시간에 달리기를 했는데 조금 무서웠어요.",
    "우리 같이 놀자!",
  ];
}

export default function VocabFixture({
  state = "progress",
  lang = "ko",
  teacher = false,
}: {
  state?: VocabState;
  lang?: string;
  teacher?: boolean;
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
        if (path === "/api/vocab-translate") {
          return new Response(JSON.stringify({ translation: "(fixture 번역)" }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
        if (path === "/api/stt") {
          return new Response(JSON.stringify({ text: "가짜 음성 결과" }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "fixture" }), {
          status: 503, headers: { "content-type": "application/json" },
        });
      }
      return real(input as RequestInfo, init);
    }) as typeof window.fetch;
    return () => { window.fetch = real; };
  }, []);

  const user: UserConfig = useMemo(
    () => ({ myLang: lang, myName: "학생 A", isTeacher: teacher, teacherLangs: [] }),
    [lang, teacher]
  );

  const fixture: VocabFixture = useMemo(
    () => ({
      progress: progressFor(state),
      learner: learnerFor(state),
      expressions: expressionsFor(state),
      cardTexts: cardTextsFor(state),
      stickersEarned: state === "rich" ? 4 : state === "progress" ? 1 : 0,
    }),
    [state]
  );

  return (
    <>
      <VocabHub
        key={`${state}-${lang}-${teacher}`}
        user={user}
        roomCode="9999"
        onBack={() => { /* fixture: 돌아갈 상위 화면이 없다 */ }}
        fixture={fixture}
      />
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

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

/** mulberry32 — 32bit 시드 하나로 재현되는 난수열(마블 fixture 와 같은 방식). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  openView,
  openWordId,
  seed = 1,
}: {
  state?: VocabState;
  lang?: string;
  teacher?: boolean;
  openView?: "detail" | "notebook" | "write" | "quiz" | "review";
  openWordId?: string;
  seed?: number;
}) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const blockedRef = useRef<string[]>([]);

  /**
   * 시험(VocabTest)만 난수를 고정하고 마운트 뒤에 그린다.
   *
   * 왜 필요한가: VocabHub 는 openView="quiz" 일 때 첫 렌더의 useState 초기값으로
   * buildDailyChallenge() 를 부른다. 그 안의 shuffle() 이 Math.random 을 쓰므로
   * (lib/quizFormats.ts:75-82, 340) 서버 렌더와 클라이언트 렌더가 서로 다른 보기
   * 순서를 만들어 하이드레이션이 어긋났다 — 실제로 콘솔에
   * `Text content did not match. Server: "놀라다" Client: "슬프다"` 가 떴다.
   * 같은 이유로 문제 10개가 새로 고칠 때마다 달라져 "같은 입력 = 같은 화면" 이
   * 성립하지 않았다.
   *
   * 그래서 마블 fixture(app/ux-fixture/marble/fixture.tsx)와 같은 방법을 쓴다:
   * 서버 HTML 에는 VocabHub 를 아예 넣지 않고, 클라이언트에서 Math.random 을
   * 시드로 바꾼 뒤에 그린다. 서버 HTML 이 없으니 어긋날 것도 없다.
   * 다른 화면(detail/write/notebook/review/홈)은 이 경로를 타지 않으므로
   * 종전과 똑같이 서버에서 렌더된다.
   */
  const needsSeed = openView === "quiz";
  const [mounted, setMounted] = useState(!needsSeed);

  // 네트워크 차단: fixture 는 어떤 원격 호출도 하지 않는다. /api/* 는 canned
  // 응답으로 막고, 새는 경로가 있으면 화면에 드러낸다.
  useEffect(() => {
    const realRandom = Math.random;
    if (needsSeed) {
      const next = mulberry32(seed || 1);
      Math.random = next;
    }

    // 듣고 찾기 문항은 들어오자마자 speakKorean() 으로 문장을 읽는다
    // (VocabTest.tsx:712-717). speakKorean 은 ko 목소리가 없으면
    // `new Audio('/api/tts?...')` 로 서버 TTS 를 부르는데(VocabTest.tsx:36-42)
    // 그 경로는 window.fetch 를 타지 않아 아래 차단망을 그대로 빠져나간다 —
    // 실측에서 fixture 가 GET /api/tts 로 나가는 것을 확인했다.
    // 실제 태블릿/크롬북에는 한국어 목소리가 있으므로, 여기서는 그 상태를
    // 만들어 준다: 목소리 목록만 채워 제품이 제 경로(브라우저 TTS)를 타게 한다.
    const synth = window.speechSynthesis;
    const realGetVoices = synth?.getVoices?.bind(synth);
    if (synth && realGetVoices) {
      const koVoice = { name: "fixture ko", lang: "ko-KR", default: true, localService: true, voiceURI: "fixture-ko" };
      synth.getVoices = () => {
        const live = realGetVoices();
        return live.some((v) => v.lang?.startsWith("ko"))
          ? live
          : ([...live, koVoice] as SpeechSynthesisVoice[]);
      };
    }

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

    setMounted(true);
    return () => {
      window.fetch = real;
      Math.random = realRandom;
      if (synth && realGetVoices) synth.getVoices = realGetVoices;
    };
  }, [needsSeed, seed]);

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
      ...(openView ? { openView } : {}),
      ...(openWordId ? { openWordId } : {}),
    }),
    [state, openView, openWordId]
  );

  return (
    <>
      {mounted && (
        <VocabHub
          key={`${state}-${lang}-${teacher}-${openView ?? ""}-${openWordId ?? ""}-${needsSeed ? seed : ""}`}
          user={user}
          roomCode="9999"
          onBack={() => { /* fixture: 돌아갈 상위 화면이 없다 */ }}
          fixture={fixture}
        />
      )}
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

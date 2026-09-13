"use client";

import { useEffect, useRef, useState } from "react";
import DiscussionSession, { type DiscussionFixture } from "@/components/DiscussionSession";
import type { SessionMeta, SessionResponse, PresenceEntry } from "@/lib/types";

/**
 * 의견 나누기 시각 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): DiscussionSession 은 `fixture` prop 이 주어지면 Firebase
 * 구독(meta/responses/presence)과 쓰기(제출·반응·답글·종료·삭제)를 모두 끈다.
 * 여기 이름·응답은 전부 지어낸 값이며 운영 방(1111) 세션을 복제하지 않았다.
 *
 * 고정 입력(HARNESS §2): 시각 2026-09-11T00:00:00Z, 방 9999,
 * 학생 "학생 A/B/C", 교사 "테스트 교사".
 */

const T0 = Date.parse("2026-09-11T00:00:00Z");
const MIN = 60_000;

export type DiscussionState = "setup" | "running" | "result";

// 학생 C 가 그림으로 제출했다고 가정한 지어낸 그림 (실제 캔버스 캡처가 아님).
const FAKE_DRAWING =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='460' height='300'>
  <rect width='460' height='300' fill='#FFF7ED'/>
  <circle cx='230' cy='150' r='80' fill='#FDE68A' stroke='#F59E0B' stroke-width='6'/>
  <circle cx='200' cy='130' r='10' fill='#1F2937'/>
  <circle cx='260' cy='130' r='10' fill='#1F2937'/>
  <path d='M190 180 Q230 210 270 180' stroke='#1F2937' stroke-width='6' fill='none' stroke-linecap='round'/>
</svg>`.trim());

function metaFor(state: DiscussionState): SessionMeta {
  return {
    id: "fx-session-1",
    title: "우리 반 친구에게 하고 싶은 말은?",
    bodyText: "자유롭게 생각을 나눠보세요. 그림으로 표현해도 좋아요.",
    startedAt: T0 - 12 * MIN,
    status: state === "result" ? "closed" : "active",
    ...(state === "result" ? { closedAt: T0 } : {}),
    teacherClientId: "teacher-1",
    teacherLang: "ko",
    teacherName: "테스트 교사",
    targetLangs: ["ko", "vi"],
    // setup 에서는 아직 실시간 공개를 켜지 않은 상태로 둔다.
    liveReveal: state !== "setup",
  };
}

function responsesFor(state: DiscussionState): SessionResponse[] {
  if (state === "setup") return [];
  const b: SessionResponse = {
    id: "r-student-b", authorName: "학생 B", authorLang: "vi", authorClientId: "student-b",
    text: "Con muốn nói lời cảm ơn tới các bạn.",
    translations: { ko: "친구들에게 고맙다고 말하고 싶어요.", vi: "Con muốn nói lời cảm ơn tới các bạn." },
    timestamp: T0 - 5 * MIN,
  };
  const c: SessionResponse = {
    id: "r-student-c", authorName: "학생 C", authorLang: "ko", authorClientId: "student-c",
    text: "", kind: "drawing", imageUrl: FAKE_DRAWING, timestamp: T0 - 3 * MIN,
  };
  const a: SessionResponse = {
    id: "r-student-a", authorName: "학생 A", authorLang: "ko", authorClientId: "student-a",
    text: "오늘 같이 놀아줘서 고마워.",
    translations: { ko: "오늘 같이 놀아줘서 고마워.", vi: "Cảm ơn vì đã chơi cùng mình hôm nay." },
    timestamp: T0 - 1 * MIN,
    reactions: { "teacher-1": "👍" },
  };
  return [b, c, a];
}

function presenceFor(state: DiscussionState): Record<string, PresenceEntry> {
  const submitted = state !== "setup";
  return {
    "student-a": { name: "학생 A", lang: "ko", lastSeen: T0, submitted },
    "student-b": { name: "학생 B", lang: "vi", lastSeen: T0, submitted },
    "student-c": { name: "학생 C", lang: "ko", lastSeen: T0, submitted },
  };
}

export default function DiscussionFixturePage({
  state = "running",
  teacher = false,
}: {
  state?: DiscussionState;
  teacher?: boolean;
}) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const blockedRef = useRef<string[]>([]);

  // 네트워크 차단: fixture 는 어떤 원격 호출도 하지 않는다. /api/* 는 canned
  // 응답으로 막고, 새는 경로가 있으면 화면 하단에 드러낸다.
  useEffect(() => {
    const real = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      if (path.startsWith("/_next") || path.startsWith("/__next")) return real(input as RequestInfo, init);
      if (path.startsWith("/api/")) {
        blockedRef.current = Array.from(new Set([...blockedRef.current, path]));
        setBlocked(blockedRef.current);
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

  const fixture: DiscussionFixture = {
    meta: metaFor(state),
    responses: responsesFor(state),
    presence: presenceFor(state),
  };

  return (
    <>
      <DiscussionSession
        key={`${state}-${teacher}`}
        roomCode="9999"
        sessionId="fx-session-1"
        isTeacher={teacher}
        myClientId={teacher ? "teacher-1" : "student-a"}
        myName={teacher ? "테스트 교사" : "학생 A"}
        myLang="ko"
        onExit={() => { /* fixture: 돌아갈 상위 화면이 없다 */ }}
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

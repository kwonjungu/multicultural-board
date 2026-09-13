"use client";

import { useEffect, useRef, useState } from "react";
import WhiteboardRoom, { type WhiteboardFixture } from "@/components/WhiteboardRoom";
import type { UserConfig } from "@/lib/types";

/**
 * 실시간 화이트보드 시각 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): WhiteboardRoom 은 `fixture` prop 이 주어지면 Firebase 를
 * 구독하지도 쓰지도 않는다. 여기 이름·그림은 전부 지어낸 값이며 운영 방(1111)
 * 학생 그림을 복제하지 않았다.
 *
 * 고정 입력(HARNESS §2): 시각 2026-09-11T00:00:00Z, 방 9999,
 * 학생 "학생 A/B/C", 교사 "테스트 교사".
 */

const T0 = Date.parse("2026-09-11T00:00:00Z");

function fakeDrawing(bg: string, fg: string, seed: number): string {
  const cx = 200 + (seed * 53) % 320;
  const cy = 150 + (seed * 37) % 180;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='720' height='480'>
  <rect width='720' height='480' fill='${bg}'/>
  <circle cx='${cx}' cy='${cy}' r='70' fill='${fg}' stroke='#1a1a1a' stroke-width='6'/>
  <path d='M120 400 Q360 320 600 400' stroke='${fg}' stroke-width='10' fill='none' stroke-linecap='round'/>
</svg>`.trim())
  );
}

export default function WhiteboardFixturePage({ teacher = false }: { teacher?: boolean }) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const blockedRef = useRef<string[]>([]);

  // 네트워크 차단: /api/* 는 canned 응답으로 막고, 새는 경로는 화면에 드러낸다.
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

  const user: UserConfig = {
    myLang: "ko",
    myName: teacher ? "테스트 교사" : "학생 A",
    isTeacher: teacher,
    teacherLangs: [],
  };

  const fixture: WhiteboardFixture = teacher
    ? {
        meta: { prompt: "우리 가족을 그려보세요", active: true, updatedAt: T0 },
        boards: [
          { clientId: "student-a", name: "학생 A", dataUrl: fakeDrawing("#FFF7ED", "#F59E0B", 1), updatedAt: T0 - 60_000 },
          { clientId: "student-b", name: "학생 B", dataUrl: fakeDrawing("#ECFDF5", "#10B981", 2), updatedAt: T0 - 30_000 },
          { clientId: "student-c", name: "학생 C", dataUrl: fakeDrawing("#EFF6FF", "#3B82F6", 3), updatedAt: T0 },
        ],
      }
    : {
        meta: { prompt: "우리 가족을 그려보세요", active: true, updatedAt: T0 },
        myBoardImageDataUrl: fakeDrawing("#ffffff", "#F59E0B", 1),
      };

  return (
    <>
      <WhiteboardRoom
        key={teacher ? "teacher" : "student"}
        user={user}
        roomCode="9999"
        myClientId={teacher ? "teacher-1" : "student-a"}
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

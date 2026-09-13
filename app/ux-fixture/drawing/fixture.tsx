"use client";

import { useEffect, useRef, useState } from "react";
import DrawBoard from "@/components/DrawBoard";

/**
 * 그림판(DrawBoard) 시각 검수용 fixture — 개발·테스트 전용.
 *
 * DrawBoard 자체는 Firebase/네트워크가 없는 순수 캔버스 엔진이다. 여기 fixture
 * 는 "빈 캔버스로 시작하지 않게" 초기 그림(데이터 URL)만 심는다 — 지어낸
 * SVG 이며 운영 방(1111) 학생 그림이 아니다.
 */

// 학생: 그리다 만 집 스케치 (선만 있고 채색 일부만)
const STUDENT_SKETCH =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='720' height='480'>
  <rect width='720' height='480' fill='#ffffff'/>
  <polygon points='200,220 360,120 520,220' fill='none' stroke='#1a1a1a' stroke-width='8' stroke-linejoin='round'/>
  <rect x='220' y='220' width='280' height='180' fill='none' stroke='#1a1a1a' stroke-width='8'/>
  <rect x='330' y='300' width='60' height='100' fill='#f39c12'/>
  <circle cx='120' cy='90' r='36' fill='#f39c12'/>
</svg>`.trim());

// 교사 검토용: 다 그린 완성작 (집 + 나무 + 해, 채색 완료)
const TEACHER_SAMPLE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='720' height='480'>
  <rect width='720' height='480' fill='#eaf6ff'/>
  <rect y='380' width='720' height='100' fill='#8bc34a'/>
  <circle cx='120' cy='90' r='40' fill='#f7c93e'/>
  <polygon points='200,220 360,110 520,220' fill='#e74c3c' stroke='#7f1d1d' stroke-width='6' stroke-linejoin='round'/>
  <rect x='220' y='220' width='280' height='170' fill='#fdf6e3' stroke='#7f1d1d' stroke-width='6'/>
  <rect x='330' y='300' width='60' height='90' fill='#3498db'/>
  <rect x='250' y='250' width='60' height='60' fill='#9b59b6' stroke='#5b2c6f' stroke-width='4'/>
  <g transform='translate(560,300)'>
    <rect x='-8' y='0' width='16' height='80' fill='#78350F'/>
    <circle cx='0' cy='-20' r='55' fill='#2ecc71'/>
  </g>
</svg>`.trim());

export default function DrawingFixture({ teacher = false }: { teacher?: boolean }) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const blockedRef = useRef<string[]>([]);

  // 네트워크 차단: DrawBoard 는 원래 fetch 를 쓰지 않지만, 다른 fixture 와
  // 같은 방어선을 둔다 — 새는 호출이 있으면 화면에 드러낸다.
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

  return (
    <div style={{ minHeight: "100vh", background: "#FFFBEB", padding: 16 }}>
      <div
        data-testid="fixture-nav"
        data-fixture-chrome
        style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 10 }}
      >
        role={teacher ? "teacher" : "student"} — {teacher ? "완성작(검토용)" : "그리다 만 상태(진행 중)"}
      </div>
      <DrawBoard
        key={teacher ? "teacher" : "student"}
        width={720}
        height={480}
        fixture={{ initialImageDataUrl: teacher ? TEACHER_SAMPLE : STUDENT_SKETCH }}
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
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import GameRoom, { type GameRoomFixture } from "@/components/GameRoom";

/**
 * 게임 로비 시각 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): GameRoom 은 `fixture` prop 이 주어지면 퀘스트 계측
 * (Firebase 쓰기)과 게임명 번역 프리페치(fetch)를 모두 끈다. 여기 이름·방
 * 번호는 전부 지어낸 값이며 운영 방(1111)에 연결하지 않는다.
 *
 * 고정 입력(HARNESS §2): 시각 2026-09-11T00:00:00Z, 방 9999,
 * 학생 "학생 A", 교사 "테스트 교사".
 */

export type LobbyState = "lobby" | "langpick";

export default function GameLobbyFixture({
  state = "lobby",
  lang = "ko",
  teacher = false,
}: {
  state?: LobbyState;
  lang?: string;
  teacher?: boolean;
}) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const blockedRef = useRef<string[]>([]);

  // 네트워크 차단: fixture 는 어떤 원격 호출도 하지 않는다. /api/* 는 canned
  // 응답으로 막고, 새는 경로가 있으면 화면에 드러낸다. (GameRoom 자체는
  // fixture 주입 시 번역 프리페치를 이미 끄지만, 게임 카드를 눌러 실제
  // 게임으로 들어갔을 때를 대비한 방어선.)
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

  const fixture: GameRoomFixture =
    state === "langpick"
      ? { initialView: "langpick", langPickTarget: "me" }
      : { initialView: "lobby" };

  // roomLangs 는 로비 언어 카드(친구 언어) 후보. role 은 GameRoom 자체의
  // 시각을 바꾸지 않는다(교사/학생 구분 UI 없음) — 퀘스트 계측 대상 유무만 다르다.
  return (
    <>
      <GameRoom
        key={`${state}-${lang}-${teacher}`}
        myLang={lang}
        roomLangs={["ko", "vi", "en"]}
        roomCode="9999"
        questClientId={teacher ? undefined : "학생 A"}
        onClose={() => { /* fixture: 돌아갈 상위 화면이 없다 */ }}
        onChangeMyLang={() => { /* fixture: 언어 변경은 화면 내 상태로만 반영됨 */ }}
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

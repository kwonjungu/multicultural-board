"use client";

import { useEffect, useRef, useState } from "react";
import InterpreterDrawer, { type InterpreterFixture } from "@/components/InterpreterDrawer";

/**
 * 통역 도우미 시각 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): `fixture` prop 이 주어지면 마이크를 켜지 않고 /api/* 도
 * 부르지 않는다. 여기 문장은 전부 지어낸 것이며 실제 학생 음성이 아니다.
 *
 * 이 fixture 가 없으면 '듣는 중·번역 중·완료·오류' 를 화면으로 볼 방법이 없다 —
 * 마이크 권한과 STT 응답이 있어야 그 상태에 도달하기 때문이다.
 */
export type InterpState = "idle" | "listening" | "translating" | "done" | "error";

function build(state: InterpState): InterpreterFixture {
  switch (state) {
    case "listening":
      return { meState: "listening", otherState: "idle" };
    case "translating":
      return { meState: "translating", otherState: "idle" };
    case "done":
      return {
        meState: "done", otherState: "done",
        meValue: {
          original: "우리 같이 축구할래?",
          translation: "Bạn có muốn chơi bóng đá cùng mình không?",
        },
        otherValue: {
          original: "Mình chơi được, nhưng đợi mình một chút nhé.",
          translation: "나 할 수 있어. 그런데 조금만 기다려 줘.",
        },
      };
    case "error":
      return {
        meState: "error", otherState: "idle",
        errMsg: "소리를 잘 못 들었어요. 다시 한 번 말해 볼까요?",
      };
    default:
      return { meState: "idle", otherState: "idle" };
  }
}

export default function InterpreterFixture({ state = "done" }: { state?: InterpState }) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const ref = useRef<string[]>([]);

  // 네트워크 차단 — 새는 호출이 있으면 화면에 드러낸다.
  useEffect(() => {
    const real = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      if (path.startsWith("/_next") || path.startsWith("/__next")) return real(input as RequestInfo, init);
      if (path.startsWith("/api/")) {
        ref.current = Array.from(new Set([...ref.current, path]));
        setBlocked(ref.current);
        return new Response(JSON.stringify({ error: "fixture" }), {
          status: 503, headers: { "content-type": "application/json" },
        });
      }
      return real(input as RequestInfo, init);
    }) as typeof window.fetch;
    return () => { window.fetch = real; };
  }, []);

  return (
    <>
      <InterpreterDrawer
        key={state}
        open
        onClose={() => { /* fixture: 닫을 상위 화면이 없다 */ }}
        viewerLang="ko"
        availableLangs={["ko", "vi", "zh", "en", "ja"]}
        fixture={build(state)}
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
        >fixture 가 가로챈 원격 호출: {blocked.join(", ")}</pre>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import BeeWorldMarble from "@/components/games/BeeWorldMarble";
import { GameShellProvider } from "@/components/ui/game/GameShellContext";

/**
 * 결정적 시드 마블 fixture — components/** 를 고치지 않고 무작위만 고정한다.
 *
 * 왜 마운트 뒤에야 게임을 그리는가:
 *   Math.random 을 클라이언트에서만 바꾸면 서버 렌더와 값이 달라져 하이드레이션이
 *   어긋난다(지구본 퀴즈에서 실제로 났던 D-02 와 같은 종류의 사고). 그래서
 *   게임은 마운트 뒤 클라이언트에서만 그린다 — 서버 HTML 에는 아예 없다.
 */

/** mulberry32 — 32bit 시드 하나로 재현되는 난수열. */
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

export default function MarbleFixture({ seed }: { seed: number }) {
  const [mounted, setMounted] = useState(false);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [exited, setExited] = useState(0);
  const draws = useRef(0);

  // 1) 난수 고정 + 2) 원격 호출 차단. 게임을 그리기 전에 둘 다 걸어야 한다.
  useEffect(() => {
    const realRandom = Math.random;
    const next = mulberry32(seed || 1);
    Math.random = () => { draws.current += 1; return next(); };

    const realFetch = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const p = url.startsWith("http") ? new URL(url).pathname : url;
      if (p.startsWith("/_next") || p.startsWith("/__next")) return realFetch(input as RequestInfo, init);
      if (p.startsWith("/api/") || /firebaseio|firestore|identitytoolkit|firebaseapp\.com/i.test(url)) {
        setBlocked((prev) => (prev.includes(p) ? prev : [...prev, p]));
        return new Response(JSON.stringify({ error: "fixture" }), {
          status: 503, headers: { "content-type": "application/json" },
        });
      }
      return realFetch(input as RequestInfo, init);
    }) as typeof window.fetch;

    setMounted(true);
    return () => { Math.random = realRandom; window.fetch = realFetch; };
  }, [seed]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--ux-bg)" }}>
      {/* data-fixture-chrome: 아이가 보는 화면이 아니라 검수 도구용 껍데기.
          측정 스크립트는 이 안의 것을 제품 조작으로 세지 않는다. */}
      <div
        data-testid="fixture-nav"
        data-fixture-chrome
        style={{
          position: "fixed", top: 0, right: 0, zIndex: 10000,
          padding: "4px 8px", background: "#111", color: "#9CA3AF",
          font: "11px/1.3 monospace", borderBottomLeftRadius: 8,
        }}
      >
        marble seed={seed}
      </div>
      {mounted && (
        <GameShellProvider onExit={() => setExited((n) => n + 1)}>
          <BeeWorldMarble langA="ko" langB="vi" />
        </GameShellProvider>
      )}
      {exited > 0 && (
        <p data-fixture-chrome style={{ margin: 0, padding: 6, background: "#111", color: "#9CA3AF", font: "11px monospace" }}>
          fixture: 나가기 {exited}회
        </p>
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
    </div>
  );
}

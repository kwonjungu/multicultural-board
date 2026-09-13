"use client";

import { useEffect, useState } from "react";
import GlobeQuest from "@/components/games/GlobeQuest";

/**
 * 다문화 지구본(U11) 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * GameRoom.tsx 는 만질 수 없는 다른 작업자 영역이라 여기서는 그 "게임 진행 중"
 * 셸(고정 헤더 + flex:1/minHeight:0/overflow:auto 스테이지)의 치수만 재현한다.
 * 실제 로비 헤더·언어 카드는 포함하지 않는다 — U11 은 GlobeQuest 내부 stage 문제이고,
 * 이 fixture 의 목적은 그 스테이지가 진짜 게임룸과 같은 부모 제약 아래서 얼마나
 * 커지는지를 재는 것이다.
 */

const WORLD_BG =
  "linear-gradient(rgba(255,251,235,0.84), rgba(255,247,224,0.84)), url('/backgrounds/world-landmarks.jpg') center top / cover no-repeat";

type Mode = "menu" | "explore" | "quiz";

export default function GlobeFixture({
  mode: initialModeProp,
  chrome,
}: {
  mode: Mode;
  chrome: "game" | "bare";
}) {
  const [mode, setMode] = useState<Mode>(initialModeProp);
  const [blocked, setBlocked] = useState<string[]>([]);

  // 네트워크 차단: fixture 는 어떤 원격 호출도 하지 않는다. GlobeQuest 자체는
  // 지금 /api/* 를 부르지 않지만, 새는 호출이 생기면 화면에 드러낸다.
  useEffect(() => {
    const real = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      if (path.startsWith("/_next") || path.startsWith("/__next")) return real(input as RequestInfo, init);
      if (path.startsWith("/api/")) {
        setBlocked((prev) => (prev.includes(path) ? prev : [...prev, path]));
        return new Response(JSON.stringify({ error: "fixture" }), {
          status: 503, headers: { "content-type": "application/json" },
        });
      }
      return real(input as RequestInfo, init);
    }) as typeof window.fetch;
    return () => { window.fetch = real; };
  }, []);

  const globe = (
    <GlobeQuest key={mode} langA="ko" langB="vi" initialMode={mode === "menu" ? undefined : mode} />
  );

  return (
    <>
      {/* data-fixture-chrome: 검수 도구가 제품 UI 로 세면 안 되는 fixture 껍데기.
          이 스위치는 측정 스크립트가 모드를 바꾸기 위한 것이지 아이가 보는 화면이 아니다. */}
      <div
        data-testid="fixture-nav"
        data-fixture-chrome
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000,
          display: "flex", gap: 6, padding: 6, flexWrap: "wrap",
          background: "#111", fontFamily: "monospace", fontSize: 12,
        }}
      >
        {(["menu", "explore", "quiz"] as Mode[]).map((m) => (
          <button
            key={m}
            data-testid={`fixture-mode-${m}`}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            style={{
              padding: "4px 10px", borderRadius: 8,
              border: mode === m ? "2px solid #FCD34D" : "1px solid #666",
              background: mode === m ? "#3730A3" : "#222", color: "#fff", cursor: "pointer",
            }}
          >{m}</button>
        ))}
        <span style={{ color: "#9CA3AF", marginLeft: 8 }}>chrome={chrome}</span>
      </div>

      {chrome === "bare" ? (
        <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
          {globe}
        </div>
      ) : (
        // GameRoom.tsx 의 "게임 진행 중" 셸 치수를 그대로 옮긴 것 —
        // 헤더 padding "16px 14px 12px" + 44px 버튼, flex:1/minHeight:0/overflow:auto 스테이지.
        <div style={{
          position: "fixed", inset: 0, zIndex: 460,
          display: "flex", flexDirection: "column", overflow: "hidden",
          background: "linear-gradient(rgba(255,251,235,0.80), rgba(252,239,176,0.80))",
          fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
        }}>
          <div style={{
            padding: "16px 14px 12px",
            display: "flex", alignItems: "center", gap: 10,
            flexShrink: 0, borderBottom: "2px solid #3730A122",
            background: "rgba(255,255,255,0.85)",
          }}>
            <div aria-hidden style={{
              width: 44, height: 44, borderRadius: 12, border: "2px solid #3730A144",
              background: "#fff", flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 900, color: "#1F2937" }}>
              🌍 다문화 지구본 (fixture)
            </div>
            <div aria-hidden style={{
              width: 44, height: 44, borderRadius: 12, border: "2px solid #FDE68A",
              background: "#FFFBEB", flexShrink: 0,
            }} />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: WORLD_BG }}>
            {globe}
          </div>
        </div>
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

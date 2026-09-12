"use client";

// 꿀벌 윷놀이 v2 — 전통 룰 (멈춘 칸이 지름길을 결정).
// 2팀 로컬 대전. 던지기 → (윷/모면 또 던지기) → 말 고르기 → 자동 이동.

import React, { useEffect, useReducer, useRef, useState } from "react";
import { makeInitialState, reducer } from "@/lib/yutLogic";
import { GLOBE_COUNTRIES, type GlobeCountry } from "@/lib/globeData";
import { pickN } from "@/lib/gameData";
import type { PieceId, Throw } from "@/lib/yutTypes";
import BeeMascot from "../../BeeMascot";
import ScopedStyle from "../../ui/child/ScopedStyle";
import YutBoard, { TEAM_COLOR } from "./YutBoard";
import YutSticks from "./YutSticks";
import CultureCard from "./CultureCard";
import { sfx } from "./yutSfx";

const THROW_LABEL: Record<string, string> = {
  "-1": "백도", "1": "도", "2": "개", "3": "걸", "4": "윷", "5": "모",
};

export default function HoneyYut({ langA }: { langA: string; langB: string }) {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [cultureCountry, setCultureCountry] = useState<GlobeCountry | null>(null);
  const prevHomeCount = useRef<number>(8);

  // 큐가 줄거나 phase 가 바뀌면 선택 인덱스를 안전하게 보정
  useEffect(() => {
    if (selectedIdx >= state.queue.length) setSelectedIdx(0);
  }, [state.queue.length, selectedIdx]);

  // 문화카드 칸 도착 → 무작위 나라 선택
  useEffect(() => {
    if (state.cultureNode !== null) {
      setCultureCountry(pickN(GLOBE_COUNTRIES, 1)[0] ?? null);
    } else {
      setCultureCountry(null);
    }
  }, [state.cultureNode]);

  // 잡기 효과음 — home 으로 돌아간 말 수 증가 감지
  useEffect(() => {
    const homeNow = Object.values(state.pieces).filter((p) => p.pos.kind === "home").length;
    if (homeNow > prevHomeCount.current && state.phase !== "win") sfx.capture();
    prevHomeCount.current = homeNow;
  }, [state.pieces, state.phase]);

  // 승리 효과음
  const winPlayed = useRef(false);
  useEffect(() => {
    if (state.phase === "win" && !winPlayed.current) {
      winPlayed.current = true;
      sfx.win();
    }
    if (state.phase !== "win") winPlayed.current = false;
  }, [state.phase]);

  const accent = TEAM_COLOR[state.turn];
  const selectedValue: Throw | null =
    state.phase === "move" ? (state.queue[selectedIdx] ?? state.queue[0] ?? null) : null;

  function handlePick(id: PieceId) {
    if (selectedValue === null) return;
    const qIdx = state.queue[selectedIdx] !== undefined ? selectedIdx : 0;
    sfx.pickPiece();
    dispatch({ type: "move", pieceId: id, queueIndex: qIdx });
    sfx.landing();
    setSelectedIdx(0);
  }

  const lastLog = state.log[state.log.length - 1] ?? "";

  return (
    <div data-ux-root className="hy-root">
      <ScopedStyle css={HY_CSS} />

      <div className="hy-play">
        {/* 보드 — 넓은 화면에서는 더 크게 */}
        <div className="hy-boardcol">
          <YutBoard state={state} selectedValue={selectedValue} onPickPiece={handlePick} />
        </div>

        <div className="hy-sidecol">
          {/* 턴 표시 */}
          <div className="hy-turnbar" style={{ borderColor: accent }}>
            <span className="hy-dot" style={{ background: accent }} aria-hidden />
            <span data-ux-role="body-emphasis" className="hy-turnteam">{state.turn}팀 차례</span>
            <span data-ux-role="secondary">
              {state.phase === "needThrow" ? "윷을 던져요" : state.phase === "move" ? "말을 고르세요" : ""}
            </span>
          </div>

          {/* 로그 한 줄 */}
          <p data-ux-role="body" className="hy-log" role="status">{lastLog}</p>

          {/* 하단 패널 */}
          {state.phase === "needThrow" && (
            <YutSticks
              enabled
              accent={accent}
              onResult={(v) => dispatch({ type: "throwResult", value: v })}
            />
          )}

          {state.phase === "move" && (
            <div className="hy-movepanel">
              {state.queue.length > 1 && (
                <p data-ux-role="body">사용할 윷을 고르고 말을 누르세요</p>
              )}
              <div className="hy-queue">
                {state.queue.map((v, i) => {
                  const active = i === selectedIdx;
                  return (
                    <button
                      key={`${i}-${v}`}
                      data-ux-role="control"
                      className="hy-throw"
                      data-active={active ? "" : undefined}
                      aria-pressed={active}
                      onClick={() => setSelectedIdx(i)}
                      style={active ? { borderColor: accent } : undefined}
                    >
                      <span data-ux-role="label">{THROW_LABEL[String(v)]}</span>
                      <span data-ux-role="secondary">{v === -1 ? "←1" : `→${v}`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 승리 오버레이 */}
      {state.phase === "win" && state.winner && (
        <div className="hy-winlayer">
          <div className="hy-wincard" style={{ borderColor: TEAM_COLOR[state.winner] }}>
            <BeeMascot size={120} mood="cheer" />
            <h1 data-ux-role="title">🏆 {state.winner}팀 승리!</h1>
            <p data-ux-role="body">네 마리 꿀벌이 모두 집에 돌아왔어요</p>
            <button
              data-ux-role="action"
              className="hy-primary"
              onClick={() => dispatch({ type: "restart" })}
            >🔁 다시 하기</button>
          </div>
        </div>
      )}

      {/* 문화카드 */}
      {state.cultureNode !== null && cultureCountry && (
        <CultureCard
          country={cultureCountry}
          viewerLang={langA}
          onClose={() => dispatch({ type: "closeCulture" })}
        />
      )}
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const HY_CSS = `
.hy-root{
  color: var(--ux-ink);
  width: 100%; max-width: 1200px; margin: 0 auto; box-sizing: border-box;
  padding: var(--ux-space-3) var(--ux-space-3) var(--ux-space-8);
}
/* 넓은 화면에서는 판을 크게 두고 조작을 옆에 붙인다 — 세로로 늘린 휴대폰 금지. */
.hy-play{ display: grid; gap: var(--ux-space-4); justify-items: center; }
@media (min-width: 980px){
  .hy-play{ grid-template-columns: minmax(0, 1.35fr) minmax(280px, 1fr); align-items: start; justify-items: stretch; }
}
.hy-boardcol{ min-width: 0; display: flex; justify-content: center; }
.hy-sidecol{ display: grid; gap: var(--ux-space-3); justify-items: center; align-content: start; width: 100%; }

.hy-turnbar{
  display: flex; align-items: center; gap: var(--ux-space-3); flex-wrap: wrap;
  background: var(--ux-surface); border: 3px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-pill); padding: var(--ux-space-2) var(--ux-space-6);
}
.hy-dot{ width: 14px; height: 14px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.hy-turnteam{ font-weight: 900; }
.hy-log{ margin: 0; min-height: var(--ux-space-6); text-align: center; color: var(--ux-ink-soft); }

.hy-movepanel{ display: grid; gap: var(--ux-space-2); justify-items: center; width: 100%; }
.hy-movepanel p{ margin: 0; text-align: center; }
.hy-queue{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; justify-content: center; }
.hy-throw[data-ux-role="control"]{
  display: grid; gap: var(--ux-space-1); justify-items: center;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 3px solid var(--ux-ink-soft); font-family: inherit; font-weight: 900;
  min-width: 88px;
}
.hy-throw[data-active]{ background: var(--ux-primary-fill); color: var(--ux-primary-ink); }

.hy-winlayer{
  position: fixed; inset: 0; z-index: 510;
  background: rgba(41,37,31,.6); backdrop-filter: blur(5px);
  display: flex; align-items: center; justify-content: center; padding: var(--ux-space-6);
}
.hy-wincard{
  background: var(--ux-surface); border-radius: var(--ux-radius-panel);
  border: 4px solid var(--ux-primary-border);
  padding: var(--ux-space-8); text-align: center;
  display: grid; justify-items: center; gap: var(--ux-space-3);
  box-shadow: 0 24px 60px rgba(41,37,31,.5);
  max-width: 100%;
}
.hy-wincard p{ margin: 0; }
.hy-primary[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
}
`;

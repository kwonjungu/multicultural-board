"use client";

// 꿀벌 윷놀이 v2 — 전통 룰 (멈춘 칸이 지름길을 결정).
// 2팀 로컬 대전. 던지기 → (윷/모면 또 던지기) → 말 고르기 → 자동 이동.

import React, { useEffect, useReducer, useRef, useState } from "react";
import { makeInitialState, reducer } from "@/lib/yutLogic";
import { GLOBE_COUNTRIES, type GlobeCountry } from "@/lib/globeData";
import { pickN } from "@/lib/gameData";
import type { PieceId, Throw } from "@/lib/yutTypes";
import BeeMascot from "../../BeeMascot";
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
    <div style={{
      maxWidth: 620, margin: "0 auto", padding: "12px 10px 36px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
    }}>
      {/* 턴 표시 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "#fff", borderRadius: 999,
        border: `3px solid ${accent}`,
        padding: "8px 22px",
        boxShadow: `0 6px 16px ${accent}33`,
      }}>
        <span style={{
          width: 14, height: 14, borderRadius: "50%", background: accent,
          display: "inline-block",
        }} />
        <span style={{ fontSize: 16, fontWeight: 900, color: "#1F2937" }}>
          {state.turn}팀 차례
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#92400E" }}>
          {state.phase === "needThrow" ? "윷을 던져요" : state.phase === "move" ? "말을 고르세요" : ""}
        </span>
      </div>

      {/* 보드 */}
      <YutBoard state={state} selectedValue={selectedValue} onPickPiece={handlePick} />

      {/* 로그 한 줄 */}
      <div style={{
        minHeight: 24, fontSize: 13, fontWeight: 800, color: "#78350F",
        textAlign: "center",
      }}>
        {lastLog}
      </div>

      {/* 하단 패널 */}
      {state.phase === "needThrow" && (
        <YutSticks
          enabled
          accent={accent}
          onResult={(v) => dispatch({ type: "throwResult", value: v })}
        />
      )}

      {state.phase === "move" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {state.queue.length > 1 && (
            <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7280" }}>
              사용할 윷을 고르고 말을 누르세요
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {state.queue.map((v, i) => {
              const active = i === selectedIdx;
              return (
                <button
                  key={`${i}-${v}`}
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    minWidth: 64, padding: "10px 16px", borderRadius: 14,
                    border: `3px solid ${active ? accent : "#E5E7EB"}`,
                    background: active ? `${accent}22` : "#fff",
                    color: active ? "#1F2937" : "#6B7280",
                    fontSize: 16, fontWeight: 900, cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {THROW_LABEL[String(v)]}
                  <span style={{ fontSize: 11, marginLeft: 4, color: "#92400E" }}>
                    {v === -1 ? "←1" : `→${v}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 승리 오버레이 */}
      {state.phase === "win" && state.winner && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 510,
          background: "rgba(15,10,40,0.65)", backdropFilter: "blur(5px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            background: "#fff", borderRadius: 26,
            border: `4px solid ${TEAM_COLOR[state.winner]}`,
            padding: "30px 34px", textAlign: "center",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          }}>
            <BeeMascot size={120} mood="cheer" />
            <div style={{ fontSize: 28, fontWeight: 900, color: TEAM_COLOR[state.winner], margin: "12px 0 4px" }}>
              🏆 {state.winner}팀 승리!
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 18 }}>
              네 마리 꿀벌이 모두 집에 돌아왔어요
            </div>
            <button
              onClick={() => dispatch({ type: "restart" })}
              style={{
                background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
                color: "#fff", border: "none", borderRadius: 99,
                padding: "13px 32px", fontSize: 16, fontWeight: 900, cursor: "pointer",
                boxShadow: "0 8px 20px rgba(245,158,11,0.45)",
              }}
            >
              🔁 다시 하기
            </button>
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

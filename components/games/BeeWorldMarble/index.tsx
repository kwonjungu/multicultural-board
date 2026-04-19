"use client";

import { CSSProperties, useEffect, useReducer } from "react";
import {
  initialState,
  reducer,
  type SetupPlayer,
} from "@/lib/marbleReducer";
import { ActionPanel } from "./ActionPanel";
import { Board } from "./Board";
import { CharacterSetup } from "./CharacterSetup";
import { LogTicker } from "./LogTicker";
import { PlayerHud } from "./PlayerHud";

export default function BeeWorldMarble({
  langA,
  langB,
}: {
  langA: string;
  langB: string;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Movement animation: tick every 200ms while moving.
  useEffect(() => {
    if (state.phase.kind !== "moving") return;
    const id = setInterval(() => {
      dispatch({ type: "advance" });
    }, 200);
    return () => clearInterval(id);
  }, [state.phase.kind]);

  // Quiz→wrong fallbacks: if the reducer lands us on "landed" after a quiz,
  // the ActionPanel already shows a continue button — no auto-step required.

  const handleStart = (players: SetupPlayer[]) => {
    dispatch({ type: "start", players });
  };

  const handleRoll = () => {
    if (state.phase.kind !== "rolling") return;
    const a = 1 + Math.floor(Math.random() * 6);
    const b = 1 + Math.floor(Math.random() * 6);
    // Briefly set a "rolling visually" pause by dispatching rollDice first
    // would require extra phase; we just dispatch the result directly.
    dispatch({ type: "rollResult", a, b });
  };

  // Intro screen
  if (state.phase.kind === "intro") {
    return (
      <div style={rootIntro}>
        <CharacterSetup langA={langA} langB={langB} onDone={handleStart} />
      </div>
    );
  }

  return (
    <div style={root}>
      {/* Top HUD */}
      <div style={topBar}>
        <PlayerHud
          players={state.players}
          playerIds={state.playerIds}
          turn={state.turn}
          viewerLang={langA}
        />
      </div>

      {/* Board + overlay panel */}
      <div style={boardWrap}>
        <Board
          state={state}
          viewerLang={langA}
          friendLang={langB}
        />
        <ActionPanel
          state={state}
          langA={langA}
          langB={langB}
          dispatch={dispatch}
          onRoll={handleRoll}
        />
      </div>

      {/* Log + restart */}
      <div style={footerBar}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <LogTicker log={state.log} />
        </div>
        <button
          type="button"
          aria-label="게임 다시 시작"
          onClick={() => dispatch({ type: "restart" })}
          style={restartBtn}
        >
          🔁
        </button>
      </div>
    </div>
  );
}

const root: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  margin: "0 auto",
  padding: "10px 10px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  boxSizing: "border-box",
};

const rootIntro: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  boxSizing: "border-box",
};

const topBar: CSSProperties = {
  width: "100%",
};

const boardWrap: CSSProperties = {
  position: "relative",
  width: "100%",
};

const footerBar: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "stretch",
};

const restartBtn: CSSProperties = {
  background: "#fff",
  color: "#92400E",
  border: "2px solid #FDE68A",
  borderRadius: 12,
  padding: "6px 10px",
  fontSize: 18,
  fontWeight: 900,
  cursor: "pointer",
  flexShrink: 0,
};

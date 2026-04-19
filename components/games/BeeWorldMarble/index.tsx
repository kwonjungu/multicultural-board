"use client";

import { CSSProperties, useEffect, useReducer, useState } from "react";
import {
  initialState,
  reducer,
  type SetupPlayer,
} from "@/lib/marbleReducer";
import { renderActionPanels } from "./ActionPanel";
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

  // Track viewport width to switch between stacked (mobile/tablet) and
  // sidebar (desktop/landscape) layouts. 900px was chosen so the board
  // at `min(96vw, 720px)` always has room plus a 240-260px HUD column.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const handleStart = (players: SetupPlayer[]) => {
    dispatch({ type: "start", players });
  };

  const handleRoll = () => {
    if (state.phase.kind !== "rolling") return;
    const a = 1 + Math.floor(Math.random() * 6);
    const b = 1 + Math.floor(Math.random() * 6);
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

  const { center: centerNode, overlay: overlayNode } = renderActionPanels({
    state,
    langA,
    langB,
    dispatch,
    onRoll: handleRoll,
  });

  const boardNode = (
    <Board
      state={state}
      viewerLang={langA}
      friendLang={langB}
      center={centerNode}
      overlay={overlayNode}
    />
  );

  const hudNode = (
    <PlayerHud
      players={state.players}
      playerIds={state.playerIds}
      turn={state.turn}
      viewerLang={langA}
      stacked={wide}
    />
  );

  const footerNode = (
    <div style={footerBar}>
      <LogTicker log={state.log} variant="footer" />
      <button
        type="button"
        aria-label="게임 다시 시작"
        onClick={() => dispatch({ type: "restart" })}
        style={restartBtn}
      >
        🔁
      </button>
    </div>
  );

  if (wide) {
    // Landscape / desktop: board on the left, HUD + log stacked on the right.
    return (
      <div style={rootWide}>
        <div style={boardCol}>{boardNode}</div>
        <aside style={sideCol} aria-label="플레이어 정보">
          {hudNode}
          {footerNode}
        </aside>
      </div>
    );
  }

  // Mobile / tablet portrait: HUD top, board mid, log bottom.
  return (
    <div style={root}>
      <div style={topBar}>{hudNode}</div>
      <div style={boardWrap}>{boardNode}</div>
      <div style={{ width: "100%" }}>{footerNode}</div>
    </div>
  );
}

const root: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  padding: "10px 8px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  boxSizing: "border-box",
};

const rootWide: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto",
  padding: "14px 16px 18px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 260px",
  gap: 16,
  alignItems: "start",
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

const boardCol: CSSProperties = {
  minWidth: 0,
};

const sideCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 0,
};

const footerBar: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "stretch",
  width: "100%",
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

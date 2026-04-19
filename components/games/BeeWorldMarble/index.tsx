"use client";

import { CSSProperties, useEffect, useReducer, useRef, useState } from "react";
import {
  initialState,
  reducer,
  type SetupPlayer,
} from "@/lib/marbleReducer";
import { JAIL_INDEX } from "@/lib/marbleData";
import { renderActionPanels } from "./ActionPanel";
import { Board } from "./Board";
import { CharacterSetup } from "./CharacterSetup";
import { LogTicker } from "./LogTicker";
import { PlayerHud } from "./PlayerHud";
import { sfx } from "./marbleSfx";

export default function BeeWorldMarble({
  langA,
  langB,
}: {
  langA: string;
  langB: string;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Movement animation: tick every 200ms while moving. Each tick plays a
  // short "move" tone so a multi-tile move is audible.
  useEffect(() => {
    if (state.phase.kind !== "moving") return;
    const id = setInterval(() => {
      sfx.move();
      dispatch({ type: "advance" });
    }, 200);
    return () => clearInterval(id);
  }, [state.phase.kind]);

  // Fire phase-entry sfx (buy / toll / quiz / festival / jail / win). These
  // run reactively after a dispatch settles, which is always downstream of a
  // user gesture so mobile audio unlock has already happened.
  const prevPhaseKind = useRef<typeof state.phase.kind | null>(null);
  useEffect(() => {
    const prev = prevPhaseKind.current;
    const curr = state.phase.kind;
    if (prev !== curr) {
      if (curr === "tollPaid") sfx.toll();
      else if (curr === "festival") sfx.festival();
      else if (curr === "gameover") sfx.win();
      // Jail: entering a "landed" on the jail tile (either via 3-double jail
      // or chance card toJail) or entering rolling while inJail > 0.
      else if (
        curr === "landed" &&
        state.phase.kind === "landed" &&
        state.phase.tile === JAIL_INDEX
      ) {
        // Only play when actually imprisoned, not when just visiting.
        const who = state.phase.who;
        if (state.players[who]?.inJail > 0) sfx.jail();
      }
    }
    // "buyPrompt" entering → we don't sound on prompt; buy() plays on buyYes.
    // "quiz" entering → the card itself drives the ding on answer.
    prevPhaseKind.current = curr;
    // We intentionally depend on phase object so cash-only changes don't
    // retrigger; phase.kind covers transitions we care about here.
  }, [state.phase, state.players]);

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
    sfx.diceRoll();
    const a = 1 + Math.floor(Math.random() * 6);
    const b = 1 + Math.floor(Math.random() * 6);
    dispatch({ type: "rollResult", a, b });
  };

  // Intercept specific Actions to play sfx in direct response to the user
  // gesture (mobile audio unlock requires this). The reducer is otherwise
  // pure and phase-entry sfx (toll / festival / jail / win) are handled by
  // the effect above.
  type Dispatch = typeof dispatch;
  const dispatchWithSfx: Dispatch = (action) => {
    if (action.type === "buyYes") sfx.buy();
    else if (action.type === "answerQuiz") {
      if (action.correct) sfx.quizCorrect();
      else sfx.quizWrong();
    }
    dispatch(action);
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
    dispatch: dispatchWithSfx,
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

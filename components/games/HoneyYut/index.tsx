"use client";

import { CSSProperties, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createInitialState, reducer, throwSticks, movablePieces } from "@/lib/yutLogic";
import type { PieceId, Throw, TeamId } from "@/lib/yutTypes";
import { throwLabel } from "@/lib/yutData";
import { YutBoard } from "./YutBoard";
import { YutSticks } from "./YutSticks";
import { CultureCard } from "./CultureCard";
import { sfx } from "./yutSfx";

interface Props {
  langA: string;
  langB: string;
}

export default function HoneyYut({ langA, langB }: Props): JSX.Element {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [pendingThrow, setPendingThrow] = useState<Throw | null>(null);
  // Which throw is currently selected as "in play" (if multiple throws queued).
  const [activeThrow, setActiveThrow] = useState<Throw | null>(null);

  // Sync activeThrow to the newest queued throw whenever throws change.
  useEffect(() => {
    if (state.throws.length === 0) {
      setActiveThrow(null);
      return;
    }
    // Default to the largest positive throw (most rewarding first).
    const sorted = [...state.throws].sort((a, b) => (b as number) - (a as number));
    setActiveThrow(sorted[0]);
  }, [state.throws]);

  // Sfx on significant phase transitions.
  const prevPhase = useRef(state.phase.kind);
  useEffect(() => {
    const prev = prevPhase.current;
    const curr = state.phase.kind;
    if (prev !== curr) {
      if (curr === "win") sfx.win();
      else if (curr === "culture") sfx.landing();
      else if (curr === "choosePiece" && prev === "throwing") sfx.landing();
    }
    prevPhase.current = curr;
  }, [state.phase]);

  const handleThrow = (): void => {
    if (state.phase.kind !== "idle" || state.winner) return;
    sfx.throwSticks();
    const v = throwSticks();
    // Animation takes ~600ms; the YutSticks component dispatches "throwResult"
    // on snap via the onResult callback we pass.
    setPendingThrow(v);
  };

  const onAnimationDone = (): void => {
    setPendingThrow(null);
  };

  const onSticksResult = (value: Throw): void => {
    dispatch({ type: "throwResult", value });
  };

  // Piece click in choosePiece.
  const onPieceClick = (id: PieceId): void => {
    if (state.phase.kind !== "choosePiece") return;
    if (activeThrow === null) return;
    const piece = state.pieces[id];
    if (!piece || piece.team !== state.turn) return;
    sfx.pickPiece();
    dispatch({ type: "selectPiece", pieceId: id, throwValue: activeThrow });
  };

  // Branch option click.
  const onNodeClick = (node: number): void => {
    if (state.phase.kind !== "chooseBranch") return;
    if (!state.pendingBranch?.options.includes(node)) return;
    sfx.pickPiece();
    dispatch({ type: "selectBranch", nextNode: node });
  };

  const movable = useMemo(() => {
    if (state.phase.kind !== "choosePiece" || activeThrow === null) return [] as PieceId[];
    return movablePieces(state, activeThrow).map(p => p.id);
  }, [state, activeThrow]);

  const highlightOptions = state.phase.kind === "chooseBranch" && state.pendingBranch
    ? state.pendingBranch.options
    : null;

  const viewerLang = state.turn === "A" ? langA : langB;

  const goalCount = (team: TeamId): number =>
    Object.values(state.pieces).filter(p => p.team === team && p.node === "goal").length;

  return (
    <div style={root}>
      <header style={header}>
        <TeamBadge team="A" active={state.turn === "A"} goals={goalCount("A")} lang={langA} />
        <div style={title}>🐝 꿀벌 윷놀이</div>
        <TeamBadge team="B" active={state.turn === "B"} goals={goalCount("B")} lang={langB} />
      </header>

      <div style={boardWrap}>
        <YutBoard
          state={state}
          highlightOptions={highlightOptions}
          onNodeClick={state.phase.kind === "chooseBranch" ? onNodeClick : null}
          movableIds={movable}
          onPieceClick={state.phase.kind === "choosePiece" ? onPieceClick : null}
        />
        {state.phase.kind === "culture" && state.cultureCard && (
          <CultureCard
            data={state.cultureCard}
            viewerLang={viewerLang}
            onClose={() => dispatch({ type: "closeCulture" })}
          />
        )}
      </div>

      <section style={controls}>
        <YutSticks
          onResult={onSticksResult}
          disabled={state.phase.kind !== "idle" || !!state.winner || pendingThrow !== null}
          pendingValue={pendingThrow}
          onAnimationDone={onAnimationDone}
        />
        <div style={controlsRight}>
          {state.throws.length > 0 && (
            <div style={throwChips}>
              {state.throws.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveThrow(t)}
                  style={{
                    ...chip,
                    background: activeThrow === t ? "#F59E0B" : "#FEF3C7",
                    color: activeThrow === t ? "#FFFBEB" : "#92400E",
                  }}
                >
                  {throwLabel(t)}
                </button>
              ))}
            </div>
          )}
          {state.phase.kind === "idle" && !state.winner && (
            <button type="button" onClick={handleThrow} style={throwBtn}>
              🎋 윷 던지기
            </button>
          )}
          {state.phase.kind === "choosePiece" && (
            <div style={help}>말을 탭해 이동하세요 ({throwLabel(activeThrow ?? 2)})</div>
          )}
          {state.phase.kind === "chooseBranch" && (
            <div style={help}>지름길로 갈 타일을 선택하세요</div>
          )}
          {state.winner && (
            <button
              type="button"
              onClick={() => dispatch({ type: "restart" })}
              style={restartBtn}
            >
              🔁 다시 시작
            </button>
          )}
        </div>
      </section>

      <footer style={logBox} aria-label="게임 로그">
        {state.log.slice(-4).map((l, i) => (
          <div key={i} style={logLine}>
            {l}
          </div>
        ))}
      </footer>
    </div>
  );
}

function TeamBadge({
  team,
  active,
  goals,
  lang,
}: {
  team: TeamId;
  active: boolean;
  goals: number;
  lang: string;
}): JSX.Element {
  const color = team === "A" ? "#F59E0B" : "#2563EB";
  return (
    <div
      style={{
        ...badge,
        borderColor: color,
        background: active ? color : "#FFFBEB",
        color: active ? "#FFFBEB" : color,
      }}
      aria-label={`${team}팀 ${lang}`}
    >
      <div style={badgeTop}>
        {team === "A" ? "🟡 A팀" : "🔵 B팀"}
      </div>
      <div style={badgeSub}>도착 {goals}/4 · {lang}</div>
    </div>
  );
}

const root: CSSProperties = {
  width: "100%",
  maxWidth: 640,
  margin: "0 auto",
  padding: "10px 8px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, 'Noto Sans KR', sans-serif",
};

const header: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 8,
};

const title: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#7C2D12",
  textAlign: "center",
};

const badge: CSSProperties = {
  border: "2px solid",
  borderRadius: 14,
  padding: "6px 10px",
  textAlign: "center",
  fontWeight: 800,
  fontSize: 13,
  minWidth: 0,
};

const badgeTop: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
};

const badgeSub: CSSProperties = {
  fontSize: 11,
  opacity: 0.85,
};

const boardWrap: CSSProperties = {
  position: "relative",
  width: "100%",
};

const controls: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: 12,
  alignItems: "center",
  padding: "8px 6px",
  background: "#FFFBEB",
  border: "2px solid #FDE68A",
  borderRadius: 14,
};

const controlsRight: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  alignItems: "stretch",
};

const throwBtn: CSSProperties = {
  padding: "10px 14px",
  background: "#B45309",
  color: "#FFFBEB",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const restartBtn: CSSProperties = {
  padding: "10px 14px",
  background: "#16A34A",
  color: "#FFFBEB",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const throwChips: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const chip: CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  border: "2px solid #F59E0B",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const help: CSSProperties = {
  fontSize: 12,
  color: "#92400E",
  fontWeight: 700,
};

const logBox: CSSProperties = {
  background: "#FFFBEB",
  border: "2px solid #FDE68A",
  borderRadius: 12,
  padding: "8px 10px",
  maxHeight: 90,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const logLine: CSSProperties = {
  fontSize: 12,
  color: "#7C2D12",
  lineHeight: 1.3,
};

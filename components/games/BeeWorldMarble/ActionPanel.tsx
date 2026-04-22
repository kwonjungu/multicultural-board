"use client";

import { CSSProperties, Dispatch, ReactNode } from "react";
import { tr } from "@/lib/gameData";
import { CHANCES, TILES } from "@/lib/marbleData";
import type { Action, GameState } from "@/lib/marbleReducer";
import { ChanceCard } from "./ChanceCard";
import { DicePanel } from "./DicePanel";
import { LogTicker } from "./LogTicker";
import { QuizCard } from "./QuizCard";
import { PLAYER_COLOR } from "./Tile";

export interface ActionPanelProps {
  state: GameState;
  langA: string;
  langB: string;
  dispatch: Dispatch<Action>;
  onRoll: () => void;
  /**
   * "center":  compact card for the middle of the board ring (default).
   * "overlay": full-board modal card (chance / quiz), rendered above the ring.
   *
   * `renderActionPanels(...)` returns the correct node for each slot.
   */
  slot?: "center" | "overlay";
}

/**
 * Returns `{ center, overlay }` nodes for a given game phase. Used by the
 * parent layout to place the center card inside the ring and the heavy
 * modals (chance / quiz) above the whole board.
 */
export function renderActionPanels(
  props: Omit<ActionPanelProps, "slot">,
): { center: ReactNode; overlay: ReactNode } {
  return {
    center: <ActionPanel {...props} slot="center" />,
    overlay: <ActionPanel {...props} slot="overlay" />,
  };
}

export function ActionPanel({
  state,
  langA,
  langB,
  dispatch,
  onRoll,
  slot = "center",
}: ActionPanelProps) {
  const phase = state.phase;
  const isOverlayPhase = phase.kind === "chance" || phase.kind === "quiz";

  // The two slots care about disjoint phase sets.
  if (slot === "overlay") {
    if (!isOverlayPhase) return null;
    if (phase.kind === "chance") {
      const card = CHANCES.find((c) => c.id === phase.cardId);
      if (!card) return null;
      return (
        <ChanceCard
          card={card}
          langA={langA}
          langB={langB}
          onDone={() => dispatch({ type: "resolveChance" })}
        />
      );
    }
    // quiz
    return (
      <QuizCard
        tileIdx={phase.tile}
        langA={langA}
        langB={langB}
        onAnswer={(correct) => dispatch({ type: "answerQuiz", correct })}
      />
    );
  }

  // slot === "center"
  if (isOverlayPhase) return null; // the overlay handles it

  if (phase.kind === "gameover") {
    return (
      <CenterCard>
        <div style={iconRow}>🏆</div>
        <div style={titleStyle}>
          {phase.winner
            ? `${state.players[phase.winner].name || phase.winner} 승리!`
            : "무승부!"}
        </div>
        <button
          type="button"
          aria-label="다시 시작"
          onClick={() => dispatch({ type: "restart" })}
          style={primaryBtn}
        >
          🔁 다시 시작
        </button>
      </CenterCard>
    );
  }

  if (phase.kind === "buyPrompt") {
    const tile = TILES[phase.tile];
    const p = state.players[phase.who];
    const price = tile.price ?? 0;
    const canAfford = p.cash >= price;
    return (
      <CenterCard>
        <div style={iconRow}>🏘️</div>
        <div style={titleStyle}>
          {tile.landmark ? tr(tile.landmark, langA) : "도시"}
        </div>
        {langA !== langB && tile.landmark && (
          <div style={subtitleStyle}>{tr(tile.landmark, langB)}</div>
        )}
        <div style={priceStyle}>💰 {price}</div>
        <div style={buttonRow}>
          <button
            type="button"
            aria-label="구매하지 않음"
            onClick={() => {
              dispatch({ type: "buyNo" });
              dispatch({ type: "endTurn" });
            }}
            style={secondaryBtn}
          >
            ❌
          </button>
          <button
            type="button"
            aria-label={canAfford ? "구매" : "잔액 부족"}
            onClick={() => {
              if (canAfford) dispatch({ type: "buyYes" });
              else dispatch({ type: "buyNo" });
              dispatch({ type: "endTurn" });
            }}
            disabled={!canAfford}
            style={{
              ...primaryBtn,
              background: canAfford
                ? "linear-gradient(135deg,#FBBF24,#F59E0B)"
                : "#E5E7EB",
              color: canAfford ? "#fff" : "#9CA3AF",
              cursor: canAfford ? "pointer" : "not-allowed",
              boxShadow: canAfford ? "0 6px 16px rgba(245,158,11,0.4)" : "none",
            }}
          >
            ✅ {canAfford ? "구매" : "잔액 부족"}
          </button>
        </div>
      </CenterCard>
    );
  }

  if (phase.kind === "tollPaid") {
    const tile = TILES[phase.tile];
    return (
      <CenterCard>
        <div style={iconRow}>💸</div>
        <div style={titleStyle}>통행료 {phase.amount}</div>
        <div style={subtitleStyle}>
          {tile.landmark ? tr(tile.landmark, langA) : ""}
        </div>
        <button
          type="button"
          aria-label="계속"
          onClick={() => dispatch({ type: "endTurn" })}
          style={primaryBtn}
        >
          ➡️ 계속
        </button>
      </CenterCard>
    );
  }

  if (phase.kind === "festival") {
    return (
      <CenterCard>
        <div style={iconRow}>🎉</div>
        <div style={titleStyle}>축제 당첨!</div>
        <div style={{ ...priceStyle, color: "#B45309" }}>💰 +{phase.amount}</div>
        <button
          type="button"
          aria-label="계속"
          onClick={() => dispatch({ type: "endTurn" })}
          style={primaryBtn}
        >
          ➡️ 계속
        </button>
      </CenterCard>
    );
  }

  if (phase.kind === "landed") {
    return (
      <CenterCard>
        <div style={{ ...subtitleStyle, fontWeight: 700 }}>칸 #{phase.tile}</div>
        <button
          type="button"
          aria-label="턴 종료"
          onClick={() => dispatch({ type: "endTurn" })}
          style={primaryBtn}
        >
          ➡️ 턴 종료
        </button>
      </CenterCard>
    );
  }

  // Default: rolling / moving → dice + turn label + mini log.
  const rolling = phase.kind === "moving";
  const canRoll = phase.kind === "rolling";
  const whoId = "who" in phase ? phase.who : state.turn;
  const who = state.players[whoId];
  const color = PLAYER_COLOR[whoId];

  return (
    <CenterCard>
      <div
        style={{
          fontSize: "clamp(12px, 2vw, 16px)",
          fontWeight: 900,
          color,
          textAlign: "center",
          lineHeight: 1.15,
        }}
      >
        {who.name || whoId}의 차례
      </div>
      <DicePanel
        a={state.diceA}
        b={state.diceB}
        rolling={rolling}
        canRoll={canRoll}
        onRoll={onRoll}
        compact
      />
      <LogTicker log={state.log} variant="mini" />
    </CenterCard>
  );
}

// ─── small layout helpers ───

function CenterCard({ children }: { children: React.ReactNode }) {
  const card: CSSProperties = {
    background: "rgba(255,255,255,0.96)",
    border: "2.5px solid #F59E0B",
    borderRadius: 16,
    padding: "clamp(6px, 1.4vw, 12px)",
    textAlign: "center",
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(4px, 0.8vw, 8px)",
    boxShadow: "0 12px 24px rgba(245,158,11,0.25)",
    overflow: "hidden",
    boxSizing: "border-box",
  };
  return <div style={card}>{children}</div>;
}

// ─── shared styles ───

const iconRow: CSSProperties = {
  fontSize: "clamp(28px, 5vw, 44px)",
  lineHeight: 1,
};

const titleStyle: CSSProperties = {
  fontSize: "clamp(13px, 1.9vw, 16px)",
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.15,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

const subtitleStyle: CSSProperties = {
  fontSize: "clamp(11px, 1.5vw, 13px)",
  color: "#6B7280",
  fontWeight: 700,
  lineHeight: 1.15,
};

const priceStyle: CSSProperties = {
  fontSize: "clamp(12px, 1.8vw, 15px)",
  fontWeight: 900,
  color: "#374151",
};

const buttonRow: CSSProperties = {
  display: "flex",
  gap: "clamp(6px, 1vw, 10px)",
  justifyContent: "center",
  flexWrap: "wrap",
};

const primaryBtn: CSSProperties = {
  background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
  color: "#fff",
  border: "none",
  padding: "clamp(6px, 1.2vw, 10px) clamp(12px, 2vw, 20px)",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: "clamp(11px, 1.6vw, 14px)",
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(245,158,11,0.45)",
};

const secondaryBtn: CSSProperties = {
  background: "#fff",
  color: "#92400E",
  border: "2px solid #FDE68A",
  padding: "clamp(6px, 1.2vw, 10px) clamp(12px, 2vw, 20px)",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: "clamp(11px, 1.6vw, 14px)",
  cursor: "pointer",
};

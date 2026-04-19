"use client";

import { CSSProperties, Dispatch } from "react";
import { tr } from "@/lib/gameData";
import {
  CHANCES,
  TILES,
} from "@/lib/marbleData";
import type { Action, GameState } from "@/lib/marbleReducer";
import { ChanceCard } from "./ChanceCard";
import { DicePanel } from "./DicePanel";
import { QuizCard } from "./QuizCard";

export interface ActionPanelProps {
  state: GameState;
  langA: string;
  langB: string;
  dispatch: Dispatch<Action>;
  onRoll: () => void;
}

export function ActionPanel({
  state,
  langA,
  langB,
  dispatch,
  onRoll,
}: ActionPanelProps) {
  const phase = state.phase;

  const overlay: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    padding: 10,
  };

  const box: CSSProperties = {
    pointerEvents: "auto",
  };

  // Rolling / gameover handled by the main bar below;
  // these overlays only show when the phase demands a decision or notice.
  if (phase.kind === "chance") {
    const card = CHANCES.find((c) => c.id === phase.cardId);
    if (!card) return null;
    return (
      <div style={overlay}>
        <div style={box}>
          <ChanceCard
            card={card}
            langA={langA}
            langB={langB}
            onDone={() => dispatch({ type: "resolveChance" })}
          />
        </div>
      </div>
    );
  }

  if (phase.kind === "quiz") {
    return (
      <div style={overlay}>
        <div style={box}>
          <QuizCard
            tileIdx={phase.tile}
            langA={langA}
            langB={langB}
            onAnswer={(correct) => dispatch({ type: "answerQuiz", correct })}
          />
        </div>
      </div>
    );
  }

  if (phase.kind === "buyPrompt") {
    const tile = TILES[phase.tile];
    const p = state.players[phase.who];
    const price = tile.price ?? 0;
    const canAfford = p.cash >= price;
    return (
      <div style={overlay}>
        <div style={{ ...box, ...modalCard }}>
          <div style={{ fontSize: 52 }} aria-hidden="true">🏘️</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#111827", marginBottom: 4 }}>
            {tile.landmark ? tr(tile.landmark, langA) : "도시"}
          </div>
          {langA !== langB && tile.landmark && (
            <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 700, marginBottom: 8 }}>
              {tr(tile.landmark, langB)}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: "8px 0" }}>
            💰 구매 가격: {price}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
            <button
              type="button"
              aria-label="구매하지 않음"
              onClick={() => {
                dispatch({ type: "buyNo" });
                dispatch({ type: "endTurn" });
              }}
              style={secondaryBtn}
            >
              ❌ 사지 않음
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
        </div>
      </div>
    );
  }

  if (phase.kind === "tollPaid") {
    const tile = TILES[phase.tile];
    return (
      <div style={overlay}>
        <div style={{ ...box, ...modalCard }}>
          <div style={{ fontSize: 40 }} aria-hidden="true">💸</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937" }}>
            통행료 지불 · {phase.amount}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
            {tile.landmark ? tr(tile.landmark, langA) : ""}
          </div>
          <button
            type="button"
            aria-label="계속"
            onClick={() => dispatch({ type: "endTurn" })}
            style={{ ...primaryBtn, marginTop: 10 }}
          >
            ➡️ 계속
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "festival") {
    return (
      <div style={overlay}>
        <div style={{ ...box, ...modalCard }}>
          <div style={{ fontSize: 50 }} aria-hidden="true">🎉</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#B45309" }}>
            축제 당첨!
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginTop: 4 }}>
            💰 +{phase.amount}
          </div>
          <button
            type="button"
            aria-label="계속"
            onClick={() => dispatch({ type: "endTurn" })}
            style={{ ...primaryBtn, marginTop: 10 }}
          >
            ➡️ 계속
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "landed") {
    // Auto-close landed phase via endTurn button.
    return (
      <div style={overlay}>
        <div style={{ ...box, ...modalCard }}>
          <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 700 }}>
            칸 #{phase.tile}
          </div>
          <button
            type="button"
            aria-label="턴 종료"
            onClick={() => dispatch({ type: "endTurn" })}
            style={{ ...primaryBtn, marginTop: 8 }}
          >
            ➡️ 턴 종료
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "gameover") {
    return (
      <div style={overlay}>
        <div style={{ ...box, ...modalCard }}>
          <div style={{ fontSize: 60 }} aria-hidden="true">🏆</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#1F2937" }}>
            {phase.winner ? `${state.players[phase.winner].name || phase.winner} 승리!` : "무승부!"}
          </div>
          <button
            type="button"
            aria-label="다시 시작"
            onClick={() => dispatch({ type: "restart" })}
            style={{ ...primaryBtn, marginTop: 10 }}
          >
            🔁 다시 시작
          </button>
        </div>
      </div>
    );
  }

  // rolling / moving → show dice
  const rolling = phase.kind === "moving";
  const canRoll = phase.kind === "rolling";
  return (
    <div style={overlay}>
      <div style={{ ...box, ...dicePanelCard }}>
        <DicePanel
          a={state.diceA}
          b={state.diceB}
          rolling={rolling}
          canRoll={canRoll}
          onRoll={onRoll}
        />
      </div>
    </div>
  );
}

const modalCard: CSSProperties = {
  background: "#FFFFFF",
  border: "3px solid #F59E0B",
  borderRadius: 18,
  padding: 14,
  textAlign: "center",
  minWidth: 220,
  boxShadow: "0 16px 32px rgba(245,158,11,0.3)",
};

const dicePanelCard: CSSProperties = {
  background: "rgba(255,255,255,0.9)",
  border: "2px solid #FBBF24",
  borderRadius: 18,
  padding: 12,
  boxShadow: "0 8px 20px rgba(245,158,11,0.25)",
};

const primaryBtn: CSSProperties = {
  background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
  color: "#fff",
  border: "none",
  padding: "10px 22px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(245,158,11,0.45)",
};

const secondaryBtn: CSSProperties = {
  background: "#fff",
  color: "#92400E",
  border: "2px solid #FDE68A",
  padding: "10px 22px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
};

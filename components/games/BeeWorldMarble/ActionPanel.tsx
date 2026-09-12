"use client";

import { Dispatch, ReactNode } from "react";
import { tr } from "@/lib/gameData";
import { CHANCES, TILES } from "@/lib/marbleData";
import { MAX_ROUNDS, totalAssets, type Action, type GameState } from "@/lib/marbleReducer";
import ScopedStyle from "../../ui/child/ScopedStyle";
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
  // overlay 슬롯은 chance/quiz 일 때만 내용이 있다. 그 외 phase 에서는 null 을
  // 돌려줘야 Board 가 전체를 덮는 빈 모달(반투명 + pointer-events)을 렌더하지 않는다.
  // (이전엔 항상 <ActionPanel slot="overlay"/> 라는 truthy 엘리먼트를 반환해,
  //  rolling/landed 등에서도 보드 전체를 가리는 투명 오버레이가 깔려 주사위·버튼
  //  클릭이 모두 막혔다 → '시작 후 게임이 안 된다'의 원인.)
  const ph = props.state.phase;
  const isOverlayPhase = ph.kind === "chance" || ph.kind === "quiz";
  return {
    center: <ActionPanel {...props} slot="center" />,
    overlay: isOverlayPhase ? <ActionPanel {...props} slot="overlay" /> : null,
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
    // 라운드 캡 종료(총자산 승부)면 순위표를 함께 보여준다.
    const ranking = phase.byAssets
      ? state.playerIds
          .filter((id) => !state.players[id].bankrupt)
          .map((id) => ({ p: state.players[id], total: totalAssets(state.players[id]) }))
          .sort((a, b) => b.total - a.total)
      : null;
    return (
      <CenterCard>
        <div className="mb-acticon" aria-hidden>🏆</div>
        <p data-ux-role="label" className="mb-acttitle">
          {phase.winner
            ? `${state.players[phase.winner].name || phase.winner} 승리!`
            : "무승부!"}
        </p>
        {ranking && (
          <div className="mb-actrank">
            <span data-ux-role="secondary" className="mb-actrankhead">
              ⏰ {MAX_ROUNDS}라운드 종료 · 총자산 순위
            </span>
            {ranking.map(({ p, total }, i) => (
              <span
                key={p.id}
                data-ux-role="secondary"
                className="mb-actrankrow"
                style={{ color: PLAYER_COLOR[p.id] ?? "var(--ux-ink)" }}
              >
                <span>{i + 1}위 {p.name || p.id}</span>
                <span>💰 {total}</span>
              </span>
            ))}
          </div>
        )}
        <button
          data-ux-role="control"
          className="mb-actprimary"
          aria-label="다시 시작"
          onClick={() => dispatch({ type: "restart" })}
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
        <div className="mb-acticon" aria-hidden>🏘️</div>
        <p data-ux-role="label" className="mb-acttitle">
          {tile.landmark ? tr(tile.landmark, langA) : "도시"}
        </p>
        {langA !== langB && tile.landmark && (
          <p data-ux-role="secondary">{tr(tile.landmark, langB)}</p>
        )}
        <p data-ux-role="label" className="mb-actprice">💰 {price}</p>
        <div className="mb-actrow">
          {/* 아이콘만 있는 버튼은 만들지 않는다 — 짧은 글자 라벨을 함께 둔다. */}
          <button
            data-ux-role="control"
            className="mb-actsecondary"
            aria-label="구매하지 않음"
            onClick={() => {
              dispatch({ type: "buyNo" });
              dispatch({ type: "endTurn" });
            }}
          >
            안 살래요
          </button>
          <button
            data-ux-role="control"
            className="mb-actprimary"
            aria-label={canAfford ? "구매" : "잔액 부족"}
            aria-disabled={!canAfford}
            onClick={() => {
              if (canAfford) dispatch({ type: "buyYes" });
              else dispatch({ type: "buyNo" });
              dispatch({ type: "endTurn" });
            }}
          >
            ✅ {canAfford ? "살래요" : "돈이 모자라요"}
          </button>
        </div>
      </CenterCard>
    );
  }

  if (phase.kind === "tollPaid") {
    const tile = TILES[phase.tile];
    return (
      <CenterCard>
        <div className="mb-acticon" aria-hidden>💸</div>
        <p data-ux-role="label" className="mb-acttitle">통행료 {phase.amount}</p>
        <p data-ux-role="secondary">
          {tile.landmark ? tr(tile.landmark, langA) : ""}
        </p>
        <button
          data-ux-role="control"
          className="mb-actprimary"
          aria-label="계속"
          onClick={() => dispatch({ type: "endTurn" })}
        >
          ➡️ 계속
        </button>
      </CenterCard>
    );
  }

  if (phase.kind === "festival") {
    return (
      <CenterCard>
        <div className="mb-acticon" aria-hidden>🎉</div>
        <p data-ux-role="label" className="mb-acttitle">축제 당첨!</p>
        <p data-ux-role="label" className="mb-actprice">💰 +{phase.amount}</p>
        <button
          data-ux-role="control"
          className="mb-actprimary"
          aria-label="계속"
          onClick={() => dispatch({ type: "endTurn" })}
        >
          ➡️ 계속
        </button>
      </CenterCard>
    );
  }

  if (phase.kind === "landed") {
    return (
      <CenterCard>
        <p data-ux-role="secondary">칸 #{phase.tile}</p>
        <button
          data-ux-role="control"
          className="mb-actprimary"
          aria-label="턴 종료"
          onClick={() => dispatch({ type: "endTurn" })}
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
      <p data-ux-role="label" className="mb-actturn" style={{ color }}>
        {who.name || whoId}의 차례
      </p>
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
  return (
    <div className="mb-actcard">
      <ScopedStyle css={ACTION_CSS} />
      {children}
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const ACTION_CSS = `
.mb-actcard{
  background: rgba(255,255,255,.96);
  border: 3px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2);
  text-align: center; width: 100%; height: 100%; max-width: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--ux-space-1);
  box-shadow: 0 12px 24px rgba(137,83,0,.25);
  overflow: hidden; box-sizing: border-box;
}
.mb-actcard p{ margin: 0; }
.mb-acticon{ font-size: clamp(1.75rem, 5vw, 2.75rem); line-height: 1; }
.mb-acttitle{ font-weight: 900; overflow-wrap: anywhere; }
.mb-actprice{ font-weight: 900; color: var(--ux-primary-ink); }
.mb-actturn{ font-weight: 900; line-height: var(--ux-lh-tight); }
.mb-actrank{ display: grid; gap: var(--ux-space-1); width: 100%; }
.mb-actrankhead{ font-weight: 800; color: var(--ux-primary-ink); }
.mb-actrankrow{ display: flex; justify-content: space-between; gap: var(--ux-space-3); font-weight: 800; }
.mb-actrow{ display: flex; gap: var(--ux-space-2); justify-content: center; flex-wrap: wrap; width: 100%; }
.mb-actprimary[data-ux-role="control"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 900; padding: var(--ux-space-2) var(--ux-space-4);
}
.mb-actprimary[aria-disabled="true"]{ opacity: .6; }
.mb-actsecondary[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 900; padding: var(--ux-space-2) var(--ux-space-4);
}
`;

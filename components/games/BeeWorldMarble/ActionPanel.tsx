"use client";

import { Dispatch, ReactNode, useState } from "react";
import { tr } from "@/lib/gameData";
import { CHANCES, TILES } from "@/lib/marbleData";
import { MAX_ROUNDS, totalAssets, type Action, type GameState, type PlayerId } from "@/lib/marbleReducer";
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
   * 지금 주사위가 굴러가는 중인가. 예전에는 이 값을 `phase === "moving"` 에서
   * 스스로 만들어, 말이 움직이는 내내 주사위가 돌고 확정 숫자는 이동이 끝나야
   * 보였다(06 §5 와 반대). 굴림 구간은 위에서 관리하고 여기서는 받아 쓴다.
   */
  rolling?: boolean;
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
  rolling = false,
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
    /**
     * 결과 화면 (06 §8 G03 "결과까지 확장").
     *
     * 예전에는 이 자리가 **거의 빈 흰 상자**였다. 판 안쪽을 꽉 채우는 카드
     * (.mb-actcard 는 width/height 100%) 안에 이모지 트로피 한 개, 한 줄짜리
     * 이름, 글자 두 줄짜리 순위가 떠 있어 위아래가 텅 비었다. 15라운드를 끝낸
     * 아이가 받는 화면이 이것뿐이었다.
     *
     * 바꾼 것:
     *  - 이긴 꿀벌을 **자기 얼굴로** 크게 보여 준다(말에 쓰는 그 스킨 그대로).
     *  - 순위는 메달·얼굴·꿀 막대로 — 숫자만 늘어놓으면 누가 얼마나 앞섰는지
     *    읽으려면 뺄셈을 해야 한다. 막대는 길이가 곧 답이다.
     *  - 순위표를 파산 종료에서도 보여 준다. 예전에는 라운드 캡으로 끝났을
     *    때만 나와서, 파산으로 끝나면 화면이 더 비었다.
     */
    const ranking = state.playerIds
      .map((id) => ({
        p: state.players[id],
        total: totalAssets(state.players[id]),
        out: state.players[id].bankrupt,
      }))
      .sort((a, b) => (a.out === b.out ? b.total - a.total : a.out ? 1 : -1));
    const top = Math.max(1, ...ranking.map((r) => r.total));
    const winner = phase.winner ? state.players[phase.winner] : null;
    const MEDAL = ["🥇", "🥈", "🥉"];

    return (
      <CenterCard>
        <div className="mb-win">
          <div className="mb-winhero">
            <span className="mb-wintrophy" aria-hidden>🏆</span>
            {winner && <PlayerFace player={winner} size={72} />}
          </div>
          <p data-ux-role="body-emphasis" className="mb-acttitle">
            {winner ? `${winner.name || winner.id} 승리!` : "무승부!"}
          </p>
          <span data-ux-role="secondary" className="mb-actrankhead">
            {phase.byAssets ? `⏰ ${MAX_ROUNDS}라운드 종료 · 총자산 순위` : "🏁 게임 끝 · 총자산 순위"}
          </span>

          <div className="mb-actrank">
            {ranking.map(({ p, total, out }, i) => (
              <div key={p.id} className="mb-rankrow" data-out={out ? "" : undefined}>
                <span className="mb-rankmedal" aria-hidden>{MEDAL[i] ?? `${i + 1}`}</span>
                <PlayerFace player={p} size={30} />
                <span data-ux-role="secondary" className="mb-rankname">
                  {p.name || p.id}{out ? " (파산)" : ""}
                </span>
                <span className="mb-rankbar" aria-hidden>
                  <span
                    className="mb-rankfill"
                    style={{
                      width: `${Math.round((total / top) * 100)}%`,
                      background: PLAYER_COLOR[p.id] ?? "var(--ux-primary-fill)",
                    }}
                  />
                </span>
                <span data-ux-role="secondary" className="mb-rankval">💰 {total}</span>
              </div>
            ))}
          </div>

          <button
            data-ux-role="control"
            className="mb-actprimary"
            aria-label="다시 시작"
            onClick={() => dispatch({ type: "restart" })}
          >
            🔁 다시 시작
          </button>
        </div>
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
    /**
     * 도착 요약 — 06 §2 "결과: 이동/획득의 의미가 이해되는 요약".
     * 예전에는 "칸 #6" 과 턴 종료 버튼뿐이라 판 가운데가 통째로 비었고,
     * 아이가 자기가 굴린 수와 지금 선 자리를 이을 근거가 화면에 없었다.
     * 누가 · 몇을 굴려 · 어디에 왔는지를 한 카드에 모은다.
     */
    const landedWho = state.players[phase.who];
    const landedTile = TILES[phase.tile];
    const sum = state.diceA + state.diceB;
    return (
      <CenterCard>
        <p data-ux-role="label" className="mb-actturn" style={{ color: PLAYER_COLOR[phase.who] }}>
          {landedWho?.name || phase.who}
        </p>
        <p data-ux-role="body-emphasis" className="mb-landspot">
          🎲 {state.diceA} + {state.diceB} = {sum} 칸
        </p>
        <p data-ux-role="body" className="mb-landname">
          📍 {landedTile?.landmark ? tr(landedTile.landmark, langA) : `칸 ${phase.tile}`}
        </p>
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
  // 이동 중에는 **확정된 숫자를 그대로 보여준다** — 그래야 아이가 자기 말이
  // 왜 그만큼 가는지 눈으로 잇는다.
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

/**
 * 결과 화면에 쓰는 플레이어 얼굴 — 판 위의 말과 **같은 스킨**을 쓴다.
 * 아이가 게임 내내 따라다닌 그 얼굴이 그대로 순위표에 서야 자기 것으로 읽힌다.
 * 스킨 그림이 없거나 깨지면 말과 똑같이 팀 색 원으로 떨어진다(PieceLayer 와 같은 규칙).
 */
function PlayerFace({ player, size }: { player: { id: PlayerId; skin?: string }; size: number }) {
  const [failed, setFailed] = useState(false);
  const color = PLAYER_COLOR[player.id] ?? "var(--ux-primary-fill)";
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: "50%",
        border: `${Math.max(2, size / 16)}px solid ${color}`,
        background: player.skin && !failed ? "#fff" : color,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", flex: "0 0 auto",
        boxShadow: "0 2px 4px rgba(0,0,0,.22)",
      }}
    >
      {player.skin && !failed ? (
        <img
          src={`/stickers/skin-${player.skin}.png`}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: "86%", height: "86%", objectFit: "contain" }}
        />
      ) : null}
    </span>
  );
}

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
.mb-landspot{ margin: 0; color: var(--ux-ink); }
.mb-landname{ margin: 0; color: var(--ux-ink-soft); word-break: keep-all; }
.mb-actturn{ font-weight: 900; line-height: var(--ux-lh-tight); }
.mb-actrank{ display: grid; gap: var(--ux-space-1); width: 100%; }
.mb-actrankhead{ font-weight: 800; color: var(--ux-primary-ink); }

/* ── 결과 화면 ── */
.mb-win{
  display: grid; gap: var(--ux-space-2); justify-items: center;
  width: 100%; max-width: 420px; margin: auto;
}
.mb-winhero{ display: flex; align-items: center; justify-content: center; gap: var(--ux-space-2); }
.mb-wintrophy{ font-size: clamp(2.25rem, 7vw, 3.5rem); line-height: 1; }
.mb-rankrow{
  display: flex; align-items: center; gap: var(--ux-space-2);
  width: 100%;
  padding: var(--ux-space-1) var(--ux-space-2);
  background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-pill);
}
.mb-rankrow[data-out]{ opacity: .6; }
.mb-rankmedal{ font-size: var(--ux-font-body); line-height: 1; flex: 0 0 auto; }
/* 이름은 줄지 않고 막대가 남은 폭을 가진다 — 이름이 잘리면 누구인지 사라진다. */
.mb-rankname{ font-weight: 800; white-space: nowrap; flex: 0 0 auto; }
.mb-rankbar{
  flex: 1 1 auto; min-width: 24px; height: 10px;
  background: rgba(41,37,31,.12); border-radius: var(--ux-radius-pill); overflow: hidden;
}
/* 막대 길이가 곧 '얼마나 앞섰나' 다. 숫자를 빼서 비교하지 않아도 된다. */
.mb-rankfill{ display: block; height: 100%; border-radius: var(--ux-radius-pill); }
.mb-rankval{ font-weight: 900; white-space: nowrap; flex: 0 0 auto; }
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

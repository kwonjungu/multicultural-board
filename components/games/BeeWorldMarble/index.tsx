"use client";

import { CSSProperties, useEffect, useReducer, useRef, useState } from "react";
import {
  initialState,
  MAX_ROUNDS,
  reducer,
  type SetupPlayer,
} from "@/lib/marbleReducer";
import { CHANCES, JAIL_INDEX, TILES } from "@/lib/marbleData";
import { prefetchGameTexts } from "@/lib/gameI18n";
import ScopedStyle from "../../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../../ui/game/GameHeader";
import { renderActionPanels } from "./ActionPanel";
import { Board } from "./Board";
import { CharacterSetup } from "./CharacterSetup";
import { LogTicker } from "./LogTicker";
import { PlayerHud } from "./PlayerHud";
import { sfx } from "./marbleSfx";

/** 한 판의 칸 수. 이동 총 시간을 남은 칸으로 나눌 때 쓴다. */
const TILE_COUNT = 30;
/** 06 §5 — 굴림 0.6~1초. 아이가 "굴렸다" 를 느끼는 최소 길이. */
const ROLL_MS = 700;
/** 06 §5 — 긴 이동도 총 연출 2초 이내. 여유를 두고 1.5초를 예산으로 쓴다. */
const MOVE_BUDGET_MS = 1500;

/**
 * 움직임 줄이기 설정. 기기 설정이 바뀌면 그 자리에서 따른다.
 * 06 §5: "흔들림·점프·카메라 이동을 생략하고 결과/도착 상태를 바로 보여준다".
 */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduce;
}

export default function BeeWorldMarble({
  langA,
  langB,
}: {
  langA: string;
  langB: string;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 설계서 항목 12: 방 언어 세트에 필요한 게임 텍스트 번역을 시작 시 1회
  // 배치 프리페치 — 라운드 중 번역 지연 제거. 실패해도 useGameText 가
  /** 움직임 줄이기 — 굴림·이동 연출을 건너뛸지 정한다(06 §5). */
  const reduceMotion = useReduceMotion();

  // 개별 재시도하므로 fire-and-forget.
  useEffect(() => {
    const maps = [
      ...TILES.map((tl) => tl.landmark),
      ...CHANCES.flatMap((c) => [c.title, c.body]),
    ];
    prefetchGameTexts(maps, langA).catch(() => {});
    if (langB !== langA) prefetchGameTexts(maps, langB).catch(() => {});
  }, [langA, langB]);

  /**
   * 칸별 이동. 예전에는 칸당 200ms 고정이라 12칸 이동이 2.4초로 예산(총 2초)
   * 을 넘겼다. 남은 칸 수로 나눠 총 시간을 묶고, 한 칸이 너무 빨라 눈으로
   * 쫓을 수 없게 되지 않도록 아래로도 막는다.
   *
   * 움직임 줄이기를 켠 아이에게는 칸을 하나씩 밟는 연출 대신 도착 상태로
   * 바로 간다(06 §5).
   */
  useEffect(() => {
    const ph = state.phase;
    if (ph.kind !== "moving") return;
    const total = ((ph.to - ph.from + TILE_COUNT) % TILE_COUNT) || TILE_COUNT;
    const left = Math.max(1, total - ph.step);
    const per = reduceMotion
      ? 0
      : Math.max(90, Math.min(200, Math.round(MOVE_BUDGET_MS / left)));
    const id = setInterval(() => {
      sfx.move();
      dispatch({ type: "advance" });
    }, per);
    return () => clearInterval(id);
    // step 이 바뀔 때마다 남은 칸으로 간격을 다시 잡는다.
  }, [state.phase, reduceMotion]);

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

  /**
   * 주사위 굴림 — 06 §5 의 타임라인.
   *
   * 값은 **누르는 순간** 정해 ref 에 담는다. 연출이 끝날 때 그 값을 그대로
   * reducer 에 넘기므로, 굴러가는 그림이 결과를 다시 뽑는 일은 없다
   * ("시각 물리가 재추첨하지 않음").
   */
  const [rollAnim, setRollAnim] = useState(false);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (rollTimer.current) clearTimeout(rollTimer.current); }, []);

  const handleRoll = () => {
    if (state.phase.kind !== "rolling" || rollAnim) return;
    sfx.diceRoll();
    const a = 1 + Math.floor(Math.random() * 6);
    const b = 1 + Math.floor(Math.random() * 6);
    if (reduceMotion) { dispatch({ type: "rollResult", a, b }); return; }
    setRollAnim(true);
    rollTimer.current = setTimeout(() => {
      rollTimer.current = null;
      setRollAnim(false);
      dispatch({ type: "rollResult", a, b });
    }, ROLL_MS);
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
      <div data-ux-root style={rootIntro}>
        <ScopedStyle css={ROOT_CSS} />
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
    rolling: rollAnim,
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

  // U01 공용 헤더 — 이 게임에는 머리 부분이 없었다. 라운드는 화면 맨 아래 띠
  // (.mb-round)에, 차례는 HUD 카드 안에 있어서 다른 게임과 보는 곳이 달랐다.
  // 뒤로는 캐릭터 설정(이 게임의 준비 화면)으로 돌아간다.
  const turnPlayer = state.players[state.turn];
  const headerNode = (
    <GameHeader
      gameId="marble"
      title="꿀벌 월드 마블"
      icon="🎲"
      onBack={() => dispatch({ type: "restart" })}
      backLabel="준비"
      progress={{ value: Math.min(state.round, MAX_ROUNDS) - 1, max: MAX_ROUNDS }}
      status={
        <>
          <GameStat icon="⏰" label="라운드" value={`${Math.min(state.round, MAX_ROUNDS)} / ${MAX_ROUNDS}`} />
          <GameStat icon="🙋" label="차례" value={turnPlayer?.name ?? "-"} tone="key" />
          <GameStat icon="🍯" label="꿀" value={turnPlayer?.cash ?? 0} />
        </>
      }
    />
  );

  const footerNode = (
    <div style={footerBar}>
      {/* U01: 라운드(.mb-round)는 헤더의 상태 칩으로 올렸다 — 화면 맨 아래와
          맨 위에 같은 값을 두 번 두지 않는다. 로그와 다시 시작만 남긴다. */}
      <LogTicker log={state.log} variant="footer" />
      {/* 아이콘만 있는 버튼은 만들지 않는다 — 짧은 글자 라벨을 함께 둔다. */}
      <button
        data-ux-role="control"
        className="mb-restart"
        aria-label="게임 다시 시작"
        onClick={() => dispatch({ type: "restart" })}
      >
        🔁 처음부터
      </button>
    </div>
  );

  if (wide) {
    // Landscape / desktop: board on the left, HUD + log stacked on the right.
    return (
      <div data-ux-root style={rootWide}>
        <ScopedStyle css={ROOT_CSS} />
        {/* 2열 그리드라 헤더는 두 열을 가로지른다 — 헤더 위치가 판 폭에 따라
            흔들리면 '항상 같은 자리' 라는 계약이 깨진다. */}
        <div style={headerSpan}>{headerNode}</div>
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
    <div data-ux-root style={root}>
      <ScopedStyle css={ROOT_CSS} />
      {headerNode}
      <div style={topBar}>{hudNode}</div>
      <div style={boardWrap}>{boardNode}</div>
      <div style={{ width: "100%" }}>{footerNode}</div>
    </div>
  );
}

// 세계 명소 배경 — 크림색 오버레이로 타일/글자 가독성 유지.
const WORLD_BG =
  "linear-gradient(rgba(255,251,235,0.80), rgba(255,247,224,0.80)), url('/backgrounds/world-landmarks.jpg') center top / cover no-repeat";

const root: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  padding: "10px 8px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  boxSizing: "border-box",
  background: WORLD_BG,
  backgroundAttachment: "fixed",
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
  background: WORLD_BG,
  backgroundAttachment: "fixed",
};

const rootIntro: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  boxSizing: "border-box",
  // #3 하단 여백 — 3~4인 설정으로 길어져도 '▶ 시작!' 버튼이 화면 끝/기기 UI에
  // 가려지지 않고 충분히 스크롤되어 탭 가능하도록 한다.
  paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))",
  background: WORLD_BG,
  backgroundAttachment: "fixed",
};

const topBar: CSSProperties = {
  width: "100%",
};

/** 넓은 화면(2열 그리드)에서 공용 헤더가 두 열을 모두 차지하게 한다. */
const headerSpan: CSSProperties = {
  gridColumn: "1 / -1",
  minWidth: 0,
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

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const ROOT_CSS = `
.mb-round{
  font-weight: 900; color: var(--ux-primary-ink);
  background: var(--ux-primary-fill); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-pill); padding: 0 var(--ux-space-3);
  white-space: nowrap; flex-shrink: 0;
  display: flex; align-items: center;
}
.mb-restart[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 900;
  white-space: nowrap; flex-shrink: 0;
}
`;

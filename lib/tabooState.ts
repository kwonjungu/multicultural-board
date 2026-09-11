/**
 * 꿀벌 금칙어(HoneyTaboo) 순수 상태 — 작업 F(F-02).
 *
 * 종전 구현은 `setInterval` 이 몇 번 돌았는지로 남은 시간을 셌고, "맞혔어요 /
 * 패스" 이벤트에 카드·라운드 식별자가 없었다. 그래서 (a) 탭이 백그라운드로
 * 가면 브라우저가 타이머를 늦춰 조용히 시간이 늘어났고, (b) 종료 직전 연타가
 * 만료 뒤에도 점수로 들어갈 수 있었으며, (c) 다시 시작한 라운드에 이전
 * 라운드의 늦은 이벤트가 섞일 수 있었다.
 *
 * 여기서는 판정 기준을 전부 **wall clock 만료 시각(deadlineAt) + roundId +
 * cardId** 로 옮긴다. 이 모듈은 React·DOM·Date.now 를 쓰지 않는다. 시간은
 * 항상 액션이 들고 온다 — 그래야 테스트가 시계를 고정할 수 있다.
 *
 * 시간 정책은 "조용한 추가 시간"을 만들지 않는 세 가지뿐이고, 어떤 정책인지는
 * 화면에 그대로 표시한다(HARNESS TABOO-02).
 */

export type TabooMode = "free" | "paced" | "race";

export interface TabooModeSpec {
  id: TabooMode;
  /** null 이면 제한시간 없음(연습). */
  limitMs: number | null;
  /** true 면 탭이 숨겨진 동안 시계가 멈춘다. false 면 wall clock 이 계속 흐른다. */
  pauseWhenHidden: boolean;
}

export const TABOO_MODES: Record<TabooMode, TabooModeSpec> = {
  // 연습: 시간 제한 없음. 덱을 다 쓰면 끝난다.
  free: { id: "free", limitMs: null, pauseWhenHidden: true },
  // 교육 연습: 90초지만 탭을 떠나면 멈춘다.
  paced: { id: "paced", limitMs: 90_000, pauseWhenHidden: true },
  // 시간 대결: wall clock. 돌아왔을 때 이미 지났으면 그대로 끝난다.
  race: { id: "race", limitMs: 90_000, pauseWhenHidden: false },
};

export const TABOO_MODE_ORDER: TabooMode[] = ["free", "paced", "race"];

export type TabooResult = "correct" | "pass";
export type TabooOutcomeKind = TabooResult | "missed";
export interface TabooOutcome {
  cardId: string;
  result: TabooOutcomeKind;
}

export type TabooPhase = "setup" | "play" | "result";
export type TabooEnd = "deck" | "time" | "quit";

export interface TabooState {
  phase: TabooPhase;
  mode: TabooMode;
  /** 라운드마다 증가. 이전 라운드의 늦은 이벤트를 버리는 유일한 근거. */
  roundId: number;
  deck: readonly string[];
  idx: number;
  score: number;
  passesLeft: number;
  outcomes: readonly TabooOutcome[];
  /** wall clock 만료 시각. null = 제한 없음이거나 일시정지 중. */
  deadlineAt: number | null;
  /** 일시정지 중 남은 시간(ms). null = 제한 없음. */
  remainingMs: number | null;
  paused: boolean;
  endedBy: TabooEnd | null;
}

export type TabooAction =
  | { type: "start"; roundId: number; deck: readonly string[]; mode: TabooMode; passes: number; now: number }
  | { type: "answer"; roundId: number; cardId: string; result: TabooResult; now: number }
  | { type: "tick"; now: number }
  | { type: "visibility"; hidden: boolean; now: number }
  | { type: "quit" }
  | { type: "reset"; mode?: TabooMode };

export function initialTabooState(mode: TabooMode = "free"): TabooState {
  return {
    phase: "setup",
    mode,
    roundId: 0,
    deck: [],
    idx: 0,
    score: 0,
    passesLeft: 0,
    outcomes: [],
    deadlineAt: null,
    remainingMs: null,
    paused: false,
    endedBy: null,
  };
}

/** 지금 이 순간 만료되었는가. 일시정지 중이거나 제한이 없으면 절대 만료되지 않는다. */
export function isExpired(state: TabooState, now: number): boolean {
  return state.phase === "play" && !state.paused && state.deadlineAt !== null && now >= state.deadlineAt;
}

/** 화면에 표시할 남은 시간. null 이면 '시간 제한 없음'. */
export function remainingMs(state: TabooState, now: number): number | null {
  if (state.paused) return state.remainingMs;
  if (state.deadlineAt === null) return null;
  return Math.max(0, state.deadlineAt - now);
}

/** 아직 답하지 않은 카드. 이 값과 다른 cardId 의 이벤트는 전부 버린다. */
export function currentCardId(state: TabooState): string | null {
  return state.phase === "play" ? (state.deck[state.idx] ?? null) : null;
}

function finish(state: TabooState, endedBy: TabooEnd): TabooState {
  const missed: TabooOutcome[] = state.deck.slice(state.idx).map((cardId) => ({ cardId, result: "missed" }));
  return {
    ...state,
    phase: "result",
    outcomes: missed.length > 0 ? [...state.outcomes, ...missed] : state.outcomes,
    idx: state.deck.length,
    paused: false,
    deadlineAt: null,
    endedBy,
  };
}

export function tabooReducer(state: TabooState, action: TabooAction): TabooState {
  switch (action.type) {
    case "reset":
      return { ...initialTabooState(action.mode ?? state.mode), roundId: state.roundId };

    case "start": {
      const spec = TABOO_MODES[action.mode];
      if (!spec || action.deck.length === 0) return state;
      return {
        phase: "play",
        mode: action.mode,
        roundId: action.roundId,
        deck: [...action.deck],
        idx: 0,
        score: 0,
        passesLeft: Math.max(0, action.passes),
        outcomes: [],
        deadlineAt: spec.limitMs === null ? null : action.now + spec.limitMs,
        remainingMs: spec.limitMs,
        paused: false,
        endedBy: null,
      };
    }

    case "tick":
      return isExpired(state, action.now) ? finish(state, "time") : state;

    case "quit":
      return state.phase === "play" ? finish(state, "quit") : state;

    case "visibility": {
      if (state.phase !== "play") return state;
      const spec = TABOO_MODES[state.mode];
      if (!spec.pauseWhenHidden) {
        // 시간 대결: 숨겨져 있는 동안에도 시계는 흐른다. 돌아온 순간 판정만 한다.
        if (action.hidden) return state;
        return isExpired(state, action.now) ? finish(state, "time") : state;
      }
      if (action.hidden) {
        if (state.paused) return state;
        return {
          ...state,
          paused: true,
          // 남은 시간을 얼려 둔다. 다시 돌아올 때 '딱 그만큼'만 준다.
          remainingMs: state.deadlineAt === null ? null : Math.max(0, state.deadlineAt - action.now),
          deadlineAt: null,
        };
      }
      if (!state.paused) return state;
      return {
        ...state,
        paused: false,
        deadlineAt: state.remainingMs === null ? null : action.now + state.remainingMs,
      };
    }

    case "answer": {
      if (state.phase !== "play") return state;
      // 라운드 경계를 넘어온 이벤트는 점수·카드 어느 쪽에도 반영하지 않는다.
      if (action.roundId !== state.roundId) return state;
      // 만료된 뒤 도착한 정답/패스는 결과를 바꾸지 못한다. 종료만 확정한다.
      if (isExpired(state, action.now)) return finish(state, "time");
      const current = currentCardId(state);
      // 연타·지연 클릭: 지금 보여주고 있는 카드가 아니면 전부 버린다.
      if (current === null || current !== action.cardId) return state;
      if (state.outcomes.some((o) => o.cardId === action.cardId)) return state;
      if (action.result === "pass" && state.passesLeft <= 0) return state;

      const next: TabooState = {
        ...state,
        idx: state.idx + 1,
        score: state.score + (action.result === "correct" ? 1 : 0),
        passesLeft: state.passesLeft - (action.result === "pass" ? 1 : 0),
        outcomes: [...state.outcomes, { cardId: action.cardId, result: action.result }],
      };
      return next.idx >= next.deck.length ? finish(next, "deck") : next;
    }

    default:
      return state;
  }
}

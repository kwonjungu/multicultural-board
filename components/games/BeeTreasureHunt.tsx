"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { LangMap, TREASURE_SCENES, TreasureScene, tr } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../ui/game/GameHeader";

// ============================================================
// Types & reducer
// ============================================================

type Phase = "setup" | "hide" | "seek" | "result";
type Role = "hider" | "seeker";
type SceneKey = TreasureScene["key"];
interface RoundResult { round: 1 | 2; foundCount: number; timeUsed: number; score: number }

interface GameState {
  phase: Phase;
  round: 1 | 2;
  scene: SceneKey;
  roles: { A: Role; B: Role };
  hidden: Set<number>;
  found: Set<number>;
  selected: Set<number>;
  timer: number;
  shakeAt: number | null;
  results: RoundResult[];
}

type Action =
  | { type: "PICK_SCENE"; scene: SceneKey }
  | { type: "SET_ROLES"; hider: "A" | "B" }
  | { type: "START_HIDE" }
  | { type: "TOGGLE_CELL"; idx: number }
  | { type: "COMMIT_HIDDEN" }
  | { type: "TAP_SEEK"; idx: number }
  | { type: "TICK" }
  | { type: "NEXT_ROUND" }
  | { type: "SWAP_ROLES_NEXT" }
  | { type: "RESET" };

const GRID = 6;
const CELLS = GRID * GRID;
const HIDE_COUNT = 5;
const SETUP_SECONDS = 30;
const SEEK_SECONDS = 60;
/** 빗나갔을 때 차분한 안내를 띄워 두는 시간. 흔들림·경고음은 쓰지 않는다. */
const MISS_NOTE_MS = 1200;

const L = {
  title:      { ko: "보물 찾기", en: "Treasure Hunt", vi: "Tìm kho báu", zh: "寻宝", ja: "宝探し" },
  pickScene:  { ko: "배경을 고르세요", en: "Pick a scene", vi: "Chọn bối cảnh", zh: "选择场景", ja: "背景を選ぶ" },
  roles:      { ko: "역할 정하기", en: "Set roles", vi: "Chọn vai trò", zh: "设置角色", ja: "役割を決める" },
  aHides:     { ko: "A가 먼저 숨기기", en: "A hides first", vi: "A giấu trước", zh: "A先躲藏", ja: "Aが先にかくす" },
  bHides:     { ko: "B가 먼저 숨기기", en: "B hides first", vi: "B giấu trước", zh: "B先躲藏", ja: "Bが先にかくす" },
  start:      { ko: "시작", en: "Start", vi: "Bắt đầu", zh: "开始", ja: "スタート" },
  hidePhase:  { ko: "보물을 숨기세요", en: "Hide treasures", vi: "Giấu kho báu", zh: "藏起宝物", ja: "たからを かくそう" },
  seekPhase:  { ko: "보물을 찾으세요", en: "Find treasures", vi: "Tìm kho báu", zh: "寻找宝物", ja: "たからを さがそう" },
  ready:      { ko: "준비 완료", en: "Ready", vi: "Sẵn sàng", zh: "准备好了", ja: "じゅんび OK" },
  hiderView:  { ko: "숨긴 사람 보기", en: "Hider view", vi: "Người giấu", zh: "藏者参考", ja: "かくした人" },
  time:       { ko: "시간", en: "Time", vi: "Thời gian", zh: "时间", ja: "時間" },
  found:      { ko: "찾음", en: "Found", vi: "Đã tìm", zh: "已找到", ja: "見つけた" },
  round:      { ko: "라운드", en: "Round", vi: "Vòng", zh: "回合", ja: "ラウンド" },
  score:      { ko: "점수", en: "Score", vi: "Điểm", zh: "得分", ja: "スコア" },
  restart:    { ko: "다시", en: "Restart", vi: "Chơi lại", zh: "重玩", ja: "もう一度" },
  swapNext:   { ko: "역할 바꿔 다음 라운드", en: "Swap & next", vi: "Đổi vai & vòng sau", zh: "交换角色 下回合", ja: "役割チェンジ 次へ" },
  finalScore: { ko: "최종 점수", en: "Final score", vi: "Tổng điểm", zh: "最终分数", ja: "最終スコア" },
  hidden05:   { ko: "숨긴 칸", en: "Hidden", vi: "Đã giấu", zh: "已藏", ja: "かくした数" },
  // 빗나감 — 아이를 나무라지 않고 다음 행동만 말한다.
  missHere:   { ko: "여기엔 없어요. 다시 한 번 해볼까요?", en: "Not here. Shall we try once more?",
                vi: "Không có ở đây. Thử lại nhé?", zh: "这里没有,我们再试一次吧?", ja: "ここには ないよ。もういちど やってみようか?" },
  // 준비 완료 버튼이 아직 동작하지 않는 이유.
  needMore:   { ko: "칸 5개를 모두 고르면 누를 수 있어요", en: "Pick all 5 cells to continue",
                vi: "Hãy chọn đủ 5 ô rồi tiếp tục", zh: "选满5格才能继续", ja: "5つ ぜんぶ えらぶと おせるよ" },
} satisfies Record<string, LangMap>;

function lab(map: LangMap, a: string, b: string): string {
  const x = tr(map, a); const y = tr(map, b);
  return x === y ? x : `${x} / ${y}`;
}

function initial(): GameState {
  return {
    phase: "setup", round: 1, scene: "park",
    roles: { A: "hider", B: "seeker" },
    hidden: new Set(), found: new Set(), selected: new Set(),
    timer: SETUP_SECONDS, shakeAt: null, results: [],
  };
}

function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case "PICK_SCENE":
      return s.phase === "setup" ? { ...s, scene: a.scene } : s;
    case "SET_ROLES":
      if (s.phase !== "setup") return s;
      return {
        ...s,
        roles: a.hider === "A" ? { A: "hider", B: "seeker" } : { A: "seeker", B: "hider" },
      };
    case "START_HIDE":
      if (s.phase !== "setup") return s;
      return { ...s, phase: "hide", selected: new Set(), timer: SETUP_SECONDS };
    case "TOGGLE_CELL": {
      if (s.phase !== "hide") return s;
      const next = new Set(s.selected);
      if (next.has(a.idx)) next.delete(a.idx);
      else if (next.size < HIDE_COUNT) next.add(a.idx);
      return { ...s, selected: next };
    }
    case "COMMIT_HIDDEN": {
      if (s.phase !== "hide" || s.selected.size !== HIDE_COUNT) return s;
      return { ...s, phase: "seek", hidden: new Set(s.selected), found: new Set(), timer: SEEK_SECONDS, shakeAt: null };
    }
    case "TAP_SEEK": {
      if (s.phase !== "seek" || s.found.has(a.idx)) return s;
      if (s.hidden.has(a.idx)) {
        const nf = new Set(s.found); nf.add(a.idx);
        if (nf.size >= HIDE_COUNT) {
          const timeUsed = SEEK_SECONDS - s.timer;
          const score = nf.size * 10 + Math.max(0, s.timer);
          return { ...s, found: nf, phase: "result",
            results: [...s.results, { round: s.round, foundCount: nf.size, timeUsed, score }] };
        }
        return { ...s, found: nf };
      }
      return { ...s, shakeAt: Date.now() };
    }
    case "TICK": {
      if (s.phase === "hide") {
        if (s.timer <= 1) {
          const sel = new Set(s.selected);
          if (sel.size < HIDE_COUNT) {
            const pool: number[] = [];
            for (let i = 0; i < CELLS; i++) if (!sel.has(i)) pool.push(i);
            while (sel.size < HIDE_COUNT && pool.length > 0) {
              const j = Math.floor(Math.random() * pool.length);
              sel.add(pool[j]); pool.splice(j, 1);
            }
          }
          return { ...s, phase: "seek", hidden: new Set(sel), selected: sel, found: new Set(), timer: SEEK_SECONDS };
        }
        return { ...s, timer: s.timer - 1 };
      }
      if (s.phase === "seek") {
        if (s.timer <= 1) {
          const foundCount = s.found.size;
          const score = foundCount * 10;
          return { ...s, timer: 0, phase: "result",
            results: [...s.results, { round: s.round, foundCount, timeUsed: SEEK_SECONDS, score }] };
        }
        return { ...s, timer: s.timer - 1 };
      }
      return s;
    }
    case "NEXT_ROUND":
      if (s.phase !== "result" || s.round !== 1) return s;
      return { ...s, phase: "hide", round: 2, selected: new Set(), hidden: new Set(), found: new Set(), timer: SETUP_SECONDS, shakeAt: null };
    case "SWAP_ROLES_NEXT":
      if (s.phase !== "result" || s.round !== 1) return s;
      return { ...s, phase: "hide", round: 2, roles: { A: s.roles.B, B: s.roles.A },
        selected: new Set(), hidden: new Set(), found: new Set(), timer: SETUP_SECONDS, shakeAt: null };
    case "RESET":
      return initial();
    default:
      return s;
  }
}

// ============================================================
// Component
// ============================================================

export default function BeeTreasureHunt({ langA, langB }: { langA: string; langB: string }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);

  useEffect(() => {
    if (state.phase !== "hide" && state.phase !== "seek") return;
    const id = window.setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  const scene = useMemo(
    () => TREASURE_SCENES.find((s) => s.key === state.scene) ?? TREASURE_SCENES[0],
    [state.scene]
  );
  const hider: "A" | "B" = state.roles.A === "hider" ? "A" : "B";
  const seeker: "A" | "B" = state.roles.A === "seeker" ? "A" : "B";

  return (
    <div data-ux-root className="bth-root">
      <ScopedStyle css={BTH_CSS} />

      {/* U01 공용 헤더 — 예전에는 이름·라운드가 가운데 정렬 두 줄이라 다른
          게임과 눈 가는 곳이 달랐다. 뒤로는 이 게임의 준비 화면으로. */}
      <GameHeader
        gameId="treasure"
        title={lab(L.title, langA, langB)}
        icon="🗺️"
        onBack={state.phase === "setup" ? undefined : () => dispatch({ type: "RESET" })}
        backLabel="준비"
        progress={{ value: state.round - 1, max: 2 }}
        status={
          <GameStat icon="📍" label={lab(L.round, langA, langB)} value={`${state.round} / 2`} tone="key" />
        }
      />

      {state.phase === "setup" && (
        <SetupView langA={langA} langB={langB} state={state}
          onPickScene={(k) => dispatch({ type: "PICK_SCENE", scene: k })}
          onSetRoles={(h) => dispatch({ type: "SET_ROLES", hider: h })}
          onStart={() => dispatch({ type: "START_HIDE" })} />
      )}
      {state.phase === "hide" && (
        <HideView langA={langA} langB={langB} state={state} scene={scene} hider={hider}
          onToggle={(i) => dispatch({ type: "TOGGLE_CELL", idx: i })}
          onCommit={() => dispatch({ type: "COMMIT_HIDDEN" })} />
      )}
      {state.phase === "seek" && (
        <SeekView langA={langA} langB={langB} state={state} scene={scene} seeker={seeker}
          onTap={(i) => dispatch({ type: "TAP_SEEK", idx: i })} />
      )}
      {state.phase === "result" && (
        <ResultView langA={langA} langB={langB} state={state}
          onRestart={() => dispatch({ type: "RESET" })}
          onSwapNext={() => dispatch({ type: "SWAP_ROLES_NEXT" })} />
      )}
    </div>
  );
}

// ============================================================
// Setup / Hide / Seek / Result views
// ============================================================

// 장면 선택 썸네일 — PNG 우선, 로드 실패 시 이모지 폴백
function SceneThumb({ scene }: { scene: TreasureScene }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="bth-thumbfallback" aria-hidden>{scene.emoji}</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={scene.image}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      draggable={false}
      className="bth-thumb"
    />
  );
}

function SetupView(p: {
  langA: string; langB: string; state: GameState;
  onPickScene: (k: SceneKey) => void;
  onSetRoles: (h: "A" | "B") => void;
  onStart: () => void;
}) {
  const { langA, langB, state, onPickScene, onSetRoles, onStart } = p;
  const firstHider: "A" | "B" = state.roles.A === "hider" ? "A" : "B";
  return (
    <div className="bth-setup">
      <section className="bth-panel">
        <h2 data-ux-role="body-emphasis" className="bth-section">{lab(L.pickScene, langA, langB)}</h2>
        <div className="bth-scenes">
          {TREASURE_SCENES.map((s) => (
            <button key={s.key} type="button"
              data-ux-role="control"
              className="bth-card"
              data-picked={state.scene === s.key ? "" : undefined}
              onClick={() => onPickScene(s.key)}
              aria-label={`${tr(s.name, langA)} / ${tr(s.name, langB)}`}
              aria-pressed={state.scene === s.key}>
              <SceneThumb scene={s} />
              <span data-ux-role="label" className="bth-cardname"><GameText map={s.name} lang={langA} /></span>
              <span data-ux-role="secondary" className="bth-cardname2"><GameText map={s.name} lang={langB} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="bth-panel">
        <h2 data-ux-role="body-emphasis" className="bth-section">{lab(L.roles, langA, langB)}</h2>
        <div className="bth-roles">
          {(["A", "B"] as const).map((who) => (
            <button key={who} type="button"
              data-ux-role="control"
              className="bth-card bth-rolecard"
              data-picked={firstHider === who ? "" : undefined}
              onClick={() => onSetRoles(who)}
              aria-label={who === "A" ? lab(L.aHides, langA, langB) : lab(L.bHides, langA, langB)}
              aria-pressed={firstHider === who}>
              <span className="bth-roleicon" aria-hidden>{who === "A" ? "👤➡️🐝" : "🐝⬅️👤"}</span>
              <span data-ux-role="label" className="bth-cardname">
                {who === "A" ? lab(L.aHides, langA, langB) : lab(L.bHides, langA, langB)}
              </span>
            </button>
          ))}
        </div>

        <button type="button" data-ux-role="action" className="bth-start"
          onClick={onStart} aria-label={lab(L.start, langA, langB)}>
          ▶ {lab(L.start, langA, langB)}
        </button>

        <div className="bth-mascot">
          <BeeMascot mood="welcome" size={72} />
        </div>
      </section>
    </div>
  );
}

function HideView(p: {
  langA: string; langB: string; state: GameState; scene: TreasureScene; hider: "A" | "B";
  onToggle: (i: number) => void;
  onCommit: () => void;
}) {
  const { langA, langB, state, scene, hider, onToggle, onCommit } = p;
  const canCommit = state.selected.size === HIDE_COUNT;
  return (
    <div className="bth-play">
      <div className="bth-mapcol">
        <Grid scene={scene}
          renderCell={(i) => (state.selected.has(i) ? "🐝" : "")}
          onTap={onToggle}
          ariaLabel={(i) => state.selected.has(i) ? `hidden cell ${i + 1}, selected` : `cell ${i + 1}`}
        />
      </div>
      <div className="bth-sidecol">
        <InfoBar
          left={`🔒 ${hider} — ${lab(L.hidePhase, langA, langB)}`}
          mid={`${lab(L.hidden05, langA, langB)}: ${state.selected.size}/${HIDE_COUNT}`}
          right={`⏱ ${state.timer}s`}
        />
        <button type="button" data-ux-role="action"
          className="bth-start bth-ok"
          aria-disabled={!canCommit}
          aria-describedby={!canCommit ? "bth-needmore" : undefined}
          onClick={() => { if (canCommit) onCommit(); }}
          aria-label={lab(L.ready, langA, langB)}>
          ✓ {lab(L.ready, langA, langB)} ({state.selected.size}/{HIDE_COUNT})
        </button>
        {!canCommit && (
          <p id="bth-needmore" data-ux-role="secondary" className="bth-note">
            🐝 {lab(L.needMore, langA, langB)}
          </p>
        )}
      </div>
    </div>
  );
}

function SeekView(p: {
  langA: string; langB: string; state: GameState; scene: TreasureScene; seeker: "A" | "B";
  onTap: (i: number) => void;
}) {
  const { langA, langB, state, scene, seeker, onTap } = p;
  const [missNote, setMissNote] = useState(false);

  /** 예약된 타이머 전부. unmount 때 한 곳에서 정리한다. */
  const timersRef = useRef<number[]>([]);
  const aliveRef = useRef(true);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      if (aliveRef.current) fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  // 빗나가면 흔들지 않는다 — 차분한 안내를 잠깐 띄웠다가 스스로 사라진다.
  useEffect(() => {
    if (state.shakeAt === null) return;
    clearTimers();
    setMissNote(true);
    later(() => setMissNote(false), MISS_NOTE_MS);
  }, [state.shakeAt, clearTimers, later]);

  return (
    <div className="bth-play">
      <div className="bth-mapcol">
        <Grid scene={scene}
          renderCell={(i) => (state.found.has(i) ? "✨" : "")}
          onTap={onTap}
          ariaLabel={(i) => `seek cell ${i + 1}`} />
      </div>

      <div className="bth-sidecol">
        <InfoBar
          left={`🔎 ${seeker} — ${lab(L.seekPhase, langA, langB)}`}
          mid={`${lab(L.found, langA, langB)}: ${state.found.size}/${HIDE_COUNT}`}
          right={`⏱ ${state.timer}s`}
        />

        <p data-ux-role="secondary" className="bth-note" role="status" aria-live="polite">
          {missNote ? `🐝 ${lab(L.missHere, langA, langB)}` : `🔎 ${lab(L.seekPhase, langA, langB)}`}
        </p>

        <div className="bth-ref">
          <p data-ux-role="secondary" className="bth-reflabel">👀 {lab(L.hiderView, langA, langB)}</p>
          <div className="bth-refmap">
            <Grid scene={scene}
              renderCell={(i) => (state.hidden.has(i) ? (state.found.has(i) ? "✨" : "🐝") : "")}
              onTap={() => { /* ref only */ }}
              ariaLabel={(i) => `reference cell ${i + 1}`}
              interactive={false} compact />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultView(p: {
  langA: string; langB: string; state: GameState;
  onRestart: () => void;
  onSwapNext: () => void;
}) {
  const { langA, langB, state, onRestart, onSwapNext } = p;
  const latest = state.results[state.results.length - 1];
  const isFinal = state.round === 2;
  const total = state.results.reduce((acc, r) => acc + r.score, 0);

  return (
    <div className="bth-result">
      <div className="bth-mascot"><BeeMascot mood="celebrate" size={96} /></div>
      <p data-ux-role="body-emphasis" className="bth-resulthead">
        {lab(L.round, langA, langB)} {latest?.round ?? state.round}
      </p>

      <div className="bth-scorebox">
        <Row label={lab(L.found, langA, langB)} value={`${latest?.foundCount ?? 0}/${HIDE_COUNT}`} />
        <Row label={lab(L.time, langA, langB)} value={`${latest?.timeUsed ?? 0}s`} />
        <Row label={lab(L.score, langA, langB)} value={String(latest?.score ?? 0)} />
      </div>

      {isFinal && (
        <div className="bth-finalbox">
          <p data-ux-role="label" className="bth-finallabel">🏆 {lab(L.finalScore, langA, langB)}</p>
          <p data-ux-role="title" className="bth-finalvalue">{total}</p>
        </div>
      )}

      <div className="bth-resultbtns">
        <button type="button" data-ux-role="control" className="bth-ghost"
          onClick={onRestart} aria-label={lab(L.restart, langA, langB)}>
          🔄 {lab(L.restart, langA, langB)}
        </button>
        {state.round === 1 ? (
          <button type="button" data-ux-role="action" className="bth-start"
            onClick={onSwapNext} aria-label={lab(L.swapNext, langA, langB)}>
            🔁 {lab(L.swapNext, langA, langB)}
          </button>
        ) : (
          <button type="button" data-ux-role="action" className="bth-start"
            onClick={onRestart} aria-label={lab(L.restart, langA, langB)}>
            ▶ {lab(L.restart, langA, langB)}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="bth-row">
      <span data-ux-role="label" className="bth-rowlabel">{label}</span>
      <span data-ux-role="label" className="bth-rowvalue">{value}</span>
    </div>
  );
}

// ============================================================
// Grid + InfoBar + styles
// ============================================================

function Grid(p: {
  scene: TreasureScene;
  renderCell: (i: number) => string;
  onTap: (i: number) => void;
  ariaLabel: (i: number) => string;
  interactive?: boolean;
  compact?: boolean;
}) {
  const { scene, renderCell, onTap, ariaLabel, interactive = true, compact = false } = p;
  const [imgOk, setImgOk] = useState<boolean>(true);
  const cells = useMemo(() => Array.from({ length: CELLS }, (_, i) => i), []);

  return (
    <div className="bth-map" style={{ background: scene.fallbackBg }}>
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={scene.image} alt="" aria-hidden onError={() => setImgOk(false)} className="bth-mapimg" />
      )}
      <div className="bth-cells">
        {cells.map((i) => (
          interactive ? (
            <button key={i} type="button"
              className="bth-cell"
              data-compact={compact ? "" : undefined}
              onClick={() => onTap(i)}
              aria-label={ariaLabel(i)}>
              <span aria-hidden>{renderCell(i)}</span>
            </button>
          ) : (
            // 참고용 지도는 누를 수 없다 — disabled 버튼 대신 아예 버튼이 아니게 둔다.
            <div key={i} className="bth-cell" data-compact={compact ? "" : undefined} aria-hidden>
              <span>{renderCell(i)}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function InfoBar({ left, mid, right }: { left: string; mid: string; right: string }) {
  return (
    <div className="bth-infobar">
      <span data-ux-role="label">{left}</span>
      <span data-ux-role="label">{mid}</span>
      <span data-ux-role="label">{right}</span>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const BTH_CSS = `
.bth-root{
  color: var(--ux-ink);
  max-width: 1280px; margin: 0 auto;
  padding: var(--ux-space-3) var(--ux-space-2) var(--ux-space-12);
}
.bth-root p, .bth-root h2{ margin: 0; }
/* U01: .bth-head(이름+라운드 두 줄)은 공용 GameHeader 로 대체됐다. */

.bth-setup{ display: grid; gap: var(--ux-space-6); align-items: start; }
.bth-panel{ display: grid; gap: var(--ux-space-3); min-width: 0; }
.bth-section{ font-weight: 800; }
.bth-scenes{
  display: grid; gap: var(--ux-space-2);
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
.bth-roles{
  display: grid; gap: var(--ux-space-2);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.bth-card[data-ux-role="control"]{
  display: grid; gap: var(--ux-space-1); justify-items: center; align-content: start;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2);
  font-family: inherit; text-align: center;
  word-break: keep-all; overflow-wrap: anywhere;
}
.bth-card[data-picked]{
  border-color: var(--ux-selected-border);
  background: color-mix(in srgb, var(--ux-primary-fill) 18%, var(--ux-surface));
}
.bth-rolecard[data-ux-role="control"]{ padding: var(--ux-space-3) var(--ux-space-2); }
.bth-cardname{ font-weight: 800; }
.bth-cardname2{ color: var(--ux-ink-soft); }
.bth-roleicon{ font-size: calc(var(--ux-font-title) * 1.1); line-height: 1; }
.bth-thumb{ width: 100%; height: 54px; object-fit: cover; border-radius: var(--ux-radius-surface); display: block; }
.bth-thumbfallback{ font-size: calc(var(--ux-font-title) * 1.4); line-height: 1; }
.bth-start{
  width: 100%;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 900;
  word-break: keep-all; overflow-wrap: anywhere;
}
.bth-ok{ background: var(--ux-success); color: var(--ux-surface); border-color: var(--ux-success); }
.bth-start[aria-disabled="true"]{ opacity: .62; }
.bth-ghost[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800;
  word-break: keep-all; overflow-wrap: anywhere;
}
.bth-mascot{ display: flex; justify-content: center; }
.bth-note{
  margin: 0; text-align: center;
  padding: var(--ux-space-2) var(--ux-space-3);
  background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-surface);
  word-break: keep-all; overflow-wrap: anywhere;
}

.bth-play{ display: grid; gap: var(--ux-space-4); align-items: start; }
.bth-mapcol{ min-width: 0; }
.bth-sidecol{ display: grid; gap: var(--ux-space-3); min-width: 0; align-content: start; }
.bth-infobar{
  display: flex; justify-content: space-between; align-items: center;
  gap: var(--ux-space-2); flex-wrap: wrap;
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2) var(--ux-space-3);
  word-break: keep-all; overflow-wrap: anywhere;
}
.bth-infobar [data-ux-role="label"]{ font-weight: 800; }
.bth-ref{ display: grid; gap: var(--ux-space-1); justify-items: center; }
.bth-reflabel{ text-align: center; }
.bth-refmap{ width: 100%; max-width: 220px; }

.bth-map{
  position: relative; width: 100%; aspect-ratio: 1 / 1;
  border-radius: var(--ux-radius-panel); overflow: hidden;
  border: 2px solid var(--ux-primary-border);
  margin-inline: auto;
}
.bth-mapimg{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .85; }
.bth-cells{
  position: absolute; inset: 0; display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr));
  gap: 2px; padding: 2px;
}
.bth-cell{
  border: 1px solid var(--ux-primary-border);
  background: color-mix(in srgb, var(--ux-surface) 42%, transparent);
  display: flex; align-items: center; justify-content: center;
  padding: 0; min-width: 0; min-height: 0;
  border-radius: 4px; user-select: none; cursor: pointer;
  font-size: calc(var(--ux-font-title) * 1.05); line-height: 1;
  transition: background var(--ux-motion-state) var(--ux-motion-ease);
}
.bth-cell[data-compact]{ font-size: calc(var(--ux-font-secondary) * 0.8); cursor: default; }
div.bth-cell{ cursor: default; }

.bth-result{ display: grid; gap: var(--ux-space-3); justify-items: center; text-align: center; }
.bth-resulthead{ font-weight: 800; }
.bth-scorebox{
  width: 100%; max-width: 560px;
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel); padding: var(--ux-space-4);
}
.bth-row{ display: flex; justify-content: space-between; gap: var(--ux-space-3); padding: var(--ux-space-1) 0; }
.bth-rowlabel{ color: var(--ux-ink-soft); font-weight: 700; }
.bth-rowvalue{ font-weight: 900; }
.bth-finalbox{
  width: 100%; max-width: 560px;
  background: color-mix(in srgb, var(--ux-success) 14%, var(--ux-surface));
  border: 2px solid var(--ux-success);
  border-radius: var(--ux-radius-panel); padding: var(--ux-space-4);
  display: grid; gap: var(--ux-space-1);
}
.bth-finallabel{ font-weight: 800; }
.bth-finalvalue{ font-weight: 900; color: var(--ux-success); }
.bth-resultbtns{
  width: 100%; display: grid; gap: var(--ux-space-2);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

@media (min-width: 768px){
  .bth-root{ padding-left: var(--ux-space-6); padding-right: var(--ux-space-6); }
  .bth-play{ grid-template-columns: minmax(0, 1.5fr) minmax(260px, 1fr); }
  .bth-setup{ grid-template-columns: minmax(0, 1.4fr) minmax(260px, 1fr); }
}
@media (min-width: 1024px){
  .bth-play{ grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); gap: var(--ux-space-8); }
  .bth-setup{ grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr); gap: var(--ux-space-8); }
  .bth-map{ max-width: min(100%, 760px); }
  .bth-refmap{ max-width: 300px; }
  .bth-scenes{ grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
}
`;

"use client";

import { CSSProperties, useEffect, useMemo, useReducer, useState } from "react";
import { LangMap, TREASURE_SCENES, TreasureScene, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

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
    <div style={{ padding: "14px 10px 40px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#B45309" }}>
          🗺️ {lab(L.title, langA, langB)}
        </div>
        <div style={{ fontSize: 12, color: "#92400E", fontWeight: 700, marginTop: 2 }}>
          {lab(L.round, langA, langB)} {state.round} / 2
        </div>
      </div>

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

function SetupView(p: {
  langA: string; langB: string; state: GameState;
  onPickScene: (k: SceneKey) => void;
  onSetRoles: (h: "A" | "B") => void;
  onStart: () => void;
}) {
  const { langA, langB, state, onPickScene, onSetRoles, onStart } = p;
  const firstHider: "A" | "B" = state.roles.A === "hider" ? "A" : "B";
  return (
    <div>
      <div style={sectionLabel}>{lab(L.pickScene, langA, langB)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {TREASURE_SCENES.map((s) => (
          <button key={s.key} type="button"
            onClick={() => onPickScene(s.key)}
            aria-label={`${tr(s.name, langA)} / ${tr(s.name, langB)}`}
            aria-pressed={state.scene === s.key}
            style={{
              ...cardBtn,
              border: state.scene === s.key ? "3px solid #F59E0B" : "2px solid #E5E7EB",
              background: state.scene === s.key ? "#FFFBEB" : "#FFFFFF",
            }}>
            <div style={{ fontSize: 30 }}>{s.emoji}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginTop: 4 }}>{tr(s.name, langA)}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{tr(s.name, langB)}</div>
          </button>
        ))}
      </div>

      <div style={sectionLabel}>{lab(L.roles, langA, langB)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {(["A", "B"] as const).map((who) => (
          <button key={who} type="button"
            onClick={() => onSetRoles(who)}
            aria-label={who === "A" ? lab(L.aHides, langA, langB) : lab(L.bHides, langA, langB)}
            aria-pressed={firstHider === who}
            style={{
              ...cardBtn,
              border: firstHider === who ? "3px solid #10B981" : "2px solid #E5E7EB",
              background: firstHider === who ? "#ECFDF5" : "#FFFFFF",
              padding: "12px 8px",
            }}>
            <div style={{ fontSize: 22 }}>{who === "A" ? "👤➡️🐝" : "🐝⬅️👤"}</div>
            <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4 }}>
              {who === "A" ? lab(L.aHides, langA, langB) : lab(L.bHides, langA, langB)}
            </div>
          </button>
        ))}
      </div>

      <button type="button" onClick={onStart} aria-label={lab(L.start, langA, langB)} style={startBtn}>
        ▶ {lab(L.start, langA, langB)}
      </button>

      <div style={{ marginTop: 16, textAlign: "center" }}>
        <BeeMascot mood="welcome" size={72} />
      </div>
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
    <div>
      <InfoBar
        left={`🔒 ${hider} — ${lab(L.hidePhase, langA, langB)}`}
        mid={`${lab(L.hidden05, langA, langB)}: ${state.selected.size}/${HIDE_COUNT}`}
        right={`⏱ ${state.timer}s`}
      />
      <Grid scene={scene}
        renderCell={(i) => (state.selected.has(i) ? "🐝" : "")}
        onTap={onToggle}
        ariaLabel={(i) => state.selected.has(i) ? `hidden cell ${i + 1}, selected` : `cell ${i + 1}`}
      />
      <button type="button" disabled={!canCommit} onClick={onCommit}
        aria-label={lab(L.ready, langA, langB)}
        style={{
          ...startBtn, marginTop: 14,
          background: canCommit ? "#10B981" : "#D1D5DB",
          cursor: canCommit ? "pointer" : "not-allowed",
        }}>
        ✓ {lab(L.ready, langA, langB)} ({state.selected.size}/{HIDE_COUNT})
      </button>
    </div>
  );
}

function SeekView(p: {
  langA: string; langB: string; state: GameState; scene: TreasureScene; seeker: "A" | "B";
  onTap: (i: number) => void;
}) {
  const { langA, langB, state, scene, seeker, onTap } = p;
  const [isShaking, setIsShaking] = useState(false);
  useEffect(() => {
    if (state.shakeAt === null) return;
    setIsShaking(true);
    const t = window.setTimeout(() => setIsShaking(false), 400);
    return () => window.clearTimeout(t);
  }, [state.shakeAt]);

  return (
    <div>
      <InfoBar
        left={`🔎 ${seeker} — ${lab(L.seekPhase, langA, langB)}`}
        mid={`${lab(L.found, langA, langB)}: ${state.found.size}/${HIDE_COUNT}`}
        right={`⏱ ${state.timer}s`}
      />

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 700, marginBottom: 4 }}>
          👀 {lab(L.hiderView, langA, langB)}
        </div>
        <div style={{ maxWidth: 180, margin: "0 auto" }}>
          <Grid scene={scene}
            renderCell={(i) => (state.hidden.has(i) ? (state.found.has(i) ? "✨" : "🐝") : "")}
            onTap={() => { /* ref only */ }}
            ariaLabel={(i) => `reference cell ${i + 1}`}
            interactive={false} compact />
        </div>
      </div>

      <div style={{ animation: isShaking ? "bth-shake 0.4s" : undefined }}>
        <Grid scene={scene}
          renderCell={(i) => (state.found.has(i) ? "✨" : "")}
          onTap={onTap}
          ariaLabel={(i) => `seek cell ${i + 1}`} />
      </div>
      <style jsx>{`
        @keyframes bth-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
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
    <div style={{ textAlign: "center" }}>
      <div style={{ margin: "6px 0 14px" }}><BeeMascot mood="celebrate" size={96} /></div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#374151", marginBottom: 10 }}>
        {lab(L.round, langA, langB)} {latest?.round ?? state.round}
      </div>
      <div style={{ background: "#FFFBEB", border: "2px solid #FDE68A", borderRadius: 14, padding: 14, marginBottom: 14 }}>
        <Row label={lab(L.found, langA, langB)} value={`${latest?.foundCount ?? 0}/${HIDE_COUNT}`} />
        <Row label={lab(L.time, langA, langB)} value={`${latest?.timeUsed ?? 0}s`} />
        <Row label={lab(L.score, langA, langB)} value={String(latest?.score ?? 0)} />
      </div>

      {isFinal && (
        <div style={{ background: "#ECFDF5", border: "2px solid #A7F3D0", borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#065F46" }}>🏆 {lab(L.finalScore, langA, langB)}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#10B981", marginTop: 4 }}>{total}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" onClick={onRestart} aria-label={lab(L.restart, langA, langB)}
          style={{ ...startBtn, background: "#6B7280" }}>
          🔄 {lab(L.restart, langA, langB)}
        </button>
        {state.round === 1 ? (
          <button type="button" onClick={onSwapNext} aria-label={lab(L.swapNext, langA, langB)}
            style={{ ...startBtn, background: "#F59E0B" }}>
            🔁 {lab(L.swapNext, langA, langB)}
          </button>
        ) : (
          <button type="button" onClick={onRestart} aria-label={lab(L.restart, langA, langB)}
            style={{ ...startBtn, background: "#F59E0B" }}>
            ▶ {lab(L.restart, langA, langB)}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14 }}>
      <span style={{ color: "#6B7280", fontWeight: 700 }}>{label}</span>
      <span style={{ color: "#111827", fontWeight: 900 }}>{value}</span>
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
    <div style={{
      position: "relative", width: "100%", aspectRatio: "1 / 1",
      borderRadius: 12, overflow: "hidden",
      border: "2px solid #F59E0B", background: scene.fallbackBg,
    }}>
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={scene.image} alt="" aria-hidden onError={() => setImgOk(false)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
      )}
      <div style={{
        position: "absolute", inset: 0, display: "grid",
        gridTemplateColumns: `repeat(${GRID}, 1fr)`,
        gridTemplateRows: `repeat(${GRID}, 1fr)`,
        gap: 2, padding: 2,
      }}>
        {cells.map((i) => (
          <button key={i} type="button"
            onClick={() => interactive && onTap(i)}
            disabled={!interactive}
            aria-label={ariaLabel(i)}
            style={{
              border: "1px solid rgba(180,83,9,0.4)",
              background: "rgba(255,255,255,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: compact ? 10 : 20, padding: 0,
              cursor: interactive ? "pointer" : "default",
              borderRadius: 4, userSelect: "none",
            }}>
            <span aria-hidden>{renderCell(i)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoBar({ left, mid, right }: { left: string; mid: string; right: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 10, background: "#FFFBEB", border: "1px solid #FDE68A",
      borderRadius: 10, padding: "6px 10px",
      fontSize: 12, fontWeight: 800, color: "#92400E", gap: 6, flexWrap: "wrap",
    }}>
      <span>{left}</span><span>{mid}</span><span>{right}</span>
    </div>
  );
}

const sectionLabel: CSSProperties = { fontSize: 14, fontWeight: 800, color: "#374151", marginBottom: 8 };
const cardBtn: CSSProperties = { padding: "10px 6px", borderRadius: 12, cursor: "pointer", textAlign: "center", minHeight: 80 };
const startBtn: CSSProperties = {
  width: "100%", padding: "12px 16px", fontSize: 15, fontWeight: 900,
  color: "#FFFFFF", background: "#F59E0B", border: "none", borderRadius: 12, cursor: "pointer",
};

"use client";

import { CSSProperties, useReducer, useRef, useState } from "react";
import { LangMap, STORY_SYMBOLS, StorySymbol, pickN, tr } from "@/lib/gameData";
import { LANGUAGES } from "@/lib/constants";
import BeeMascot from "../BeeMascot";

// ============================================================
// Types & state
// ============================================================

type StoryMode = "free" | "theme";
type Player = "A" | "B";
type Phase = "INTRO" | "SELECT" | "COMPOSE" | "GALLERY";

interface PickedEntry {
  order: number; by: Player; symbolId: number;
  sentence: string; sentenceLang: string;
  translation?: string; translationLang?: string;
  createdAt: number;
}

interface GameState {
  mode: StoryMode; theme?: LangMap;
  tiles: StorySymbol[]; available: number[]; entries: PickedEntry[];
  turn: Player; selectedTileIndex: number | null;
  draftSentence: string; draftTranslation: string;
  skipsLeft: Record<Player, number>; rerollsLeft: Record<Player, number>;
  phase: Phase;
}

type Action =
  | { type: "START"; mode: StoryMode; theme?: LangMap }
  | { type: "SELECT_TILE"; tileIndex: number }
  | { type: "CANCEL_SELECT" }
  | { type: "EDIT_SENTENCE"; value: string }
  | { type: "EDIT_TRANSLATION"; value: string }
  | { type: "COMMIT"; langA: string; langB: string }
  | { type: "SKIP" }
  | { type: "REROLL" }
  | { type: "RESTART" };

const THEMES: Array<{ key: string; label: LangMap }> = [
  { key: "adventure",  label: { ko: "모험 이야기",    en: "Adventure",  vi: "Cuộc phiêu lưu", zh: "冒险故事", ja: "冒険物語" } },
  { key: "friendship", label: { ko: "우정 이야기",    en: "Friendship", vi: "Tình bạn",       zh: "友情故事", ja: "友情物語" } },
  { key: "dream",      label: { ko: "꿈 이야기",       en: "A Dream",    vi: "Giấc mơ",        zh: "梦的故事", ja: "夢の物語" } },
  { key: "home",       label: { ko: "우리 집 이야기", en: "Home",       vi: "Ngôi nhà",       zh: "家的故事", ja: "家の物語" } },
];

function initialState(): GameState {
  return {
    mode: "free", theme: undefined, tiles: [], available: [], entries: [],
    turn: "A", selectedTileIndex: null, draftSentence: "", draftTranslation: "",
    skipsLeft: { A: 1, B: 1 }, rerollsLeft: { A: 1, B: 1 }, phase: "INTRO",
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START": {
      const tiles = pickN(STORY_SYMBOLS, 9);
      return { ...initialState(), mode: action.mode, theme: action.theme, tiles, available: tiles.map((_, i) => i), phase: "SELECT" };
    }
    case "SELECT_TILE": {
      if (state.phase !== "SELECT" || !state.available.includes(action.tileIndex)) return state;
      return { ...state, selectedTileIndex: action.tileIndex, draftSentence: "", draftTranslation: "", phase: "COMPOSE" };
    }
    case "CANCEL_SELECT": {
      if (state.phase !== "COMPOSE") return state;
      return { ...state, selectedTileIndex: null, draftSentence: "", draftTranslation: "", phase: "SELECT" };
    }
    case "EDIT_SENTENCE":
      return state.phase === "COMPOSE" ? { ...state, draftSentence: action.value.slice(0, 120) } : state;
    case "EDIT_TRANSLATION":
      return state.phase === "COMPOSE" ? { ...state, draftTranslation: action.value.slice(0, 120) } : state;
    case "COMMIT": {
      if (state.phase !== "COMPOSE" || state.selectedTileIndex === null || !state.draftSentence.trim()) return state;
      const tile = state.tiles[state.selectedTileIndex];
      const sentenceLang = state.turn === "A" ? action.langA : action.langB;
      const translationLang = state.turn === "A" ? action.langB : action.langA;
      const tTrim = state.draftTranslation.trim();
      const entry: PickedEntry = {
        order: state.entries.length + 1, by: state.turn, symbolId: tile.id,
        sentence: state.draftSentence.trim(), sentenceLang,
        translation: tTrim || undefined, translationLang: tTrim ? translationLang : undefined,
        createdAt: Date.now(),
      };
      const nextAvail = state.available.filter((i) => i !== state.selectedTileIndex);
      return {
        ...state, entries: [...state.entries, entry], available: nextAvail,
        turn: state.turn === "A" ? "B" : "A", selectedTileIndex: null,
        draftSentence: "", draftTranslation: "",
        phase: nextAvail.length === 0 ? "GALLERY" : "SELECT",
      };
    }
    case "SKIP": {
      if ((state.phase !== "SELECT" && state.phase !== "COMPOSE") || state.skipsLeft[state.turn] <= 0) return state;
      return {
        ...state, skipsLeft: { ...state.skipsLeft, [state.turn]: state.skipsLeft[state.turn] - 1 },
        turn: state.turn === "A" ? "B" : "A", selectedTileIndex: null,
        draftSentence: "", draftTranslation: "", phase: "SELECT",
      };
    }
    case "REROLL": {
      if (state.phase !== "SELECT" || state.rerollsLeft[state.turn] <= 0) return state;
      const usedIds = new Set(state.tiles.filter((_, i) => !state.available.includes(i)).map((s) => s.id));
      const pool = STORY_SYMBOLS.filter((s) => !usedIds.has(s.id));
      const fresh = pickN(pool, state.available.length);
      const newTiles = state.tiles.slice();
      state.available.forEach((tileIdx, j) => { if (fresh[j]) newTiles[tileIdx] = fresh[j]; });
      return { ...state, tiles: newTiles, rerollsLeft: { ...state.rerollsLeft, [state.turn]: state.rerollsLeft[state.turn] - 1 } };
    }
    case "RESTART":
      return initialState();
    default:
      return state;
  }
}

// ============================================================
// Small subcomponents
// ============================================================

function TileImage({ sym, size }: { sym: StorySymbol; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed || !sym.image) return <span style={{ fontSize: size * 0.7, lineHeight: 1 }} aria-hidden="true">{sym.emoji}</span>;
  return <img src={sym.image} alt="" aria-hidden="true" onError={() => setFailed(true)} draggable={false} style={{ width: size, height: size, objectFit: "contain" }} />;
}

function PlayerBadge({ player, turn }: { player: Player; turn: Player }) {
  const color = player === "A" ? "#3B82F6" : "#EC4899";
  const bg = player === "A" ? "#DBEAFE" : "#FCE7F3";
  const active = turn === player;
  return (
    <div aria-label={player === "A" ? "플레이어 A" : "플레이어 B"} style={{
      padding: "6px 12px", borderRadius: 999,
      background: active ? color : bg, color: active ? "#fff" : color,
      fontWeight: 900, fontSize: 13, border: `2px solid ${color}`,
      opacity: active ? 1 : 0.55, letterSpacing: 0.5, transition: "all 0.2s",
    }}>{player} {active ? "●" : ""}</div>
  );
}

function modeBtnStyle(active: boolean, color: string): CSSProperties {
  return {
    flex: 1, padding: "12px 8px", borderRadius: 14,
    background: active ? "#FFFFFF" : "#F9FAFB",
    border: `2px solid ${active ? color : "#E5E7EB"}`,
    boxShadow: active ? `0 4px 12px ${color}33` : "none",
    cursor: "pointer", textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
  };
}

// ============================================================
// Main
// ============================================================

export default function StoryCubes({ langA, langB }: { langA: string; langB: string }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const composingRef = useRef(false);
  const ttsRef = useRef<HTMLAudioElement | null>(null);

  const currentLang = state.turn === "A" ? langA : langB;
  const otherLang = state.turn === "A" ? langB : langA;

  function playTTS(text: string, lang: string) {
    if (!text.trim()) return;
    try { ttsRef.current?.pause(); } catch {}
    const a = new Audio(`/api/tts?text=${encodeURIComponent(text.slice(0, 200))}&lang=${lang}`);
    ttsRef.current = a;
    a.play().catch(() => {});
  }

  function handleCommit() {
    if (!state.draftSentence.trim()) return;
    playTTS(state.draftSentence.trim(), currentLang);
    dispatch({ type: "COMMIT", langA, langB });
  }

  if (state.phase === "INTRO") {
    return <IntroScreen langA={langA} langB={langB} onStart={(mode, theme) => dispatch({ type: "START", mode, theme })} />;
  }
  if (state.phase === "GALLERY") {
    return <GalleryScreen state={state} langA={langA} langB={langB} onRestart={() => dispatch({ type: "RESTART" })} />;
  }

  const total = 9;
  const selectedTile = state.selectedTileIndex !== null ? state.tiles[state.selectedTileIndex] : null;
  const skipOk = state.skipsLeft[state.turn] > 0;
  const rerollOk = state.rerollsLeft[state.turn] > 0 && state.phase === "SELECT";

  return (
    <div style={{ padding: "14px 14px 30px", maxWidth: 640, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, background: "#fff", borderRadius: 16, padding: "10px 12px", border: "2px solid #EDE9FE", boxShadow: "0 4px 12px rgba(167,139,250,0.15)" }}>
        <PlayerBadge player="A" turn={state.turn} />
        <PlayerBadge player="B" turn={state.turn} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>{state.entries.length} / {total}</div>
          <div style={{ height: 6, background: "#F3F4F6", borderRadius: 999, overflow: "hidden", marginTop: 3 }}>
            <div style={{ width: `${(state.entries.length / total) * 100}%`, height: "100%", background: "linear-gradient(90deg,#A78BFA,#EC4899)", transition: "width 0.3s" }} />
          </div>
        </div>
        <button type="button" onClick={() => dispatch({ type: "SKIP" })} disabled={!skipOk}
          aria-label={`${state.turn} 턴 건너뛰기 (남은 ${state.skipsLeft[state.turn]}회)`}
          style={{ padding: "6px 10px", borderRadius: 10, background: skipOk ? "#FEF3C7" : "#F3F4F6", color: skipOk ? "#92400E" : "#9CA3AF", border: `2px solid ${skipOk ? "#FBBF24" : "#E5E7EB"}`, fontWeight: 900, fontSize: 11, cursor: skipOk ? "pointer" : "not-allowed" }}
        >⏭ {state.skipsLeft[state.turn]}</button>
        <button type="button" onClick={() => dispatch({ type: "REROLL" })} disabled={!rerollOk}
          aria-label={`타일 다시 뽑기 (남은 ${state.rerollsLeft[state.turn]}회)`}
          style={{ padding: "6px 10px", borderRadius: 10, background: rerollOk ? "#E0E7FF" : "#F3F4F6", color: rerollOk ? "#3730A3" : "#9CA3AF", border: `2px solid ${rerollOk ? "#818CF8" : "#E5E7EB"}`, fontWeight: 900, fontSize: 11, cursor: rerollOk ? "pointer" : "not-allowed" }}
        >🎲 {state.rerollsLeft[state.turn]}</button>
      </div>

      {state.theme && (
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6D28D9", marginBottom: 8, textAlign: "center" }}>
          📌 {tr(state.theme, currentLang)}
        </div>
      )}

      {/* 3x3 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {state.tiles.map((sym, idx) => {
          const used = !state.available.includes(idx);
          const selected = state.selectedTileIndex === idx;
          const entry = state.entries.find((e) => e.symbolId === sym.id);
          const clickable = !used && state.phase === "SELECT";
          const tileStyle: CSSProperties = {
            aspectRatio: "1 / 1", borderRadius: 18, background: used ? "#F3F4F6" : "#FFFDF7",
            border: selected ? "3px solid #10B981" : used ? "2px solid #E5E7EB" : "2px solid #FDE68A",
            opacity: used ? 0.45 : 1, display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", cursor: clickable ? "pointer" : "default", padding: 4,
            boxShadow: selected ? "0 0 0 4px rgba(16,185,129,0.2)" : "0 2px 8px rgba(0,0,0,0.06)", transition: "all 0.15s",
          };
          return (
            <button key={idx} type="button" disabled={!clickable}
              onClick={() => clickable && dispatch({ type: "SELECT_TILE", tileIndex: idx })}
              aria-label={used ? `사용됨: ${tr(sym.label, currentLang)}` : `타일 고르기: ${tr(sym.label, currentLang)}`}
              style={tileStyle}
            >
              <TileImage sym={sym} size={60} />
              {entry && (
                <div style={{ position: "absolute", top: 4, left: 4, background: entry.by === "A" ? "#3B82F6" : "#EC4899", color: "#fff", borderRadius: 999, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>{entry.order}</div>
              )}
              <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, textAlign: "center", fontSize: 10, fontWeight: 800, color: used ? "#9CA3AF" : "#78350F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr(sym.label, currentLang)}</div>
            </button>
          );
        })}
      </div>

      {/* Compose */}
      {state.phase === "COMPOSE" && selectedTile && (
        <div style={{ background: "#fff", borderRadius: 20, padding: 14, border: "2px solid #A78BFA", boxShadow: "0 8px 24px rgba(167,139,250,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 54, height: 54, background: "#F5F3FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TileImage sym={selectedTile} size={44} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>
                {state.turn === "A" ? "플레이어 A" : "플레이어 B"} · {LANGUAGES[currentLang]?.label ?? currentLang}
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937" }}>{tr(selectedTile.label, currentLang)}</div>
            </div>
          </div>

          <label style={{ display: "block", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#6D28D9", marginBottom: 4 }}>
              ✏️ {LANGUAGES[currentLang]?.flag} {LANGUAGES[currentLang]?.label} 한 문장
            </div>
            <textarea
              value={state.draftSentence}
              onChange={(e) => dispatch({ type: "EDIT_SENTENCE", value: e.target.value })}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              onKeyDown={(e) => { if (composingRef.current) return; if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleCommit(); } }}
              maxLength={120} rows={2}
              aria-label={`${LANGUAGES[currentLang]?.label ?? currentLang} 문장 입력`}
              placeholder="한 문장으로 이야기를 이어가 보세요..."
              style={{ width: "100%", borderRadius: 12, border: "2px solid #E5E7EB", padding: "8px 10px", fontSize: 14, lineHeight: 1.5, resize: "none", outline: "none" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", marginBottom: 4 }}>
              🌐 {LANGUAGES[otherLang]?.flag} {LANGUAGES[otherLang]?.label} 번역 (선택)
            </div>
            <textarea
              value={state.draftTranslation}
              onChange={(e) => dispatch({ type: "EDIT_TRANSLATION", value: e.target.value })}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              maxLength={120} rows={2}
              aria-label={`${LANGUAGES[otherLang]?.label ?? otherLang} 번역 입력 (선택)`}
              placeholder="친구에게 뜻을 알려주세요 (없어도 OK)"
              style={{ width: "100%", borderRadius: 12, border: "2px solid #F3F4F6", padding: "8px 10px", fontSize: 13, lineHeight: 1.5, resize: "none", outline: "none", background: "#FAFAFA" }}
            />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => dispatch({ type: "CANCEL_SELECT" })} aria-label="타일 선택 취소"
              style={{ flex: 1, padding: "10px", borderRadius: 12, background: "#F3F4F6", border: "2px solid #E5E7EB", fontWeight: 900, color: "#4B5563", cursor: "pointer" }}
            >← 다른 타일</button>
            <button type="button" onClick={handleCommit} disabled={!state.draftSentence.trim()} aria-label="문장 확정"
              style={{ flex: 2, padding: "10px", borderRadius: 12, background: state.draftSentence.trim() ? "linear-gradient(90deg,#A78BFA,#EC4899)" : "#E5E7EB", border: "none", color: "#fff", fontWeight: 900, fontSize: 14, cursor: state.draftSentence.trim() ? "pointer" : "not-allowed" }}
            >✨ 이야기에 더하기</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Intro
// ============================================================

function IntroScreen({ langA, langB, onStart }: { langA: string; langB: string; onStart: (mode: StoryMode, theme?: LangMap) => void }) {
  const [mode, setMode] = useState<StoryMode>("free");
  const [themeIdx, setThemeIdx] = useState(0);

  return (
    <div style={{ padding: "22px 18px 40px", maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center" }}><BeeMascot size={90} mood="welcome" /></div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", marginTop: 10 }}>📖 이야기 주사위</div>
      <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 18 }}>
        둘이 한 문장씩 번갈아가며 그림 이야기를 만들어요
      </div>

      <div style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "2px solid #EDE9FE", textAlign: "left" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#6D28D9", letterSpacing: 1, marginBottom: 8 }}>1️⃣ 모드 선택</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setMode("free")} aria-label="자유 모드 선택" style={modeBtnStyle(mode === "free", "#A78BFA")}>
            <div style={{ fontSize: 24 }}>✨</div>
            <div style={{ fontWeight: 900, fontSize: 13 }}>자유 모드</div>
            <div style={{ fontSize: 10, color: "#6B7280" }}>주제 없이 상상력 맘껏</div>
          </button>
          <button type="button" onClick={() => setMode("theme")} aria-label="테마 모드 선택" style={modeBtnStyle(mode === "theme", "#EC4899")}>
            <div style={{ fontSize: 24 }}>🎯</div>
            <div style={{ fontWeight: 900, fontSize: 13 }}>테마 모드</div>
            <div style={{ fontSize: 10, color: "#6B7280" }}>주제 하나를 정해요</div>
          </button>
        </div>

        {mode === "theme" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", marginBottom: 6 }}>주제 고르기</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {THEMES.map((t, i) => (
                <button key={t.key} type="button" onClick={() => setThemeIdx(i)} aria-label={`주제: ${tr(t.label, langA)}`}
                  style={{ padding: "8px 6px", borderRadius: 10, background: themeIdx === i ? "#FCE7F3" : "#F9FAFB", border: themeIdx === i ? "2px solid #EC4899" : "2px solid #E5E7EB", fontSize: 12, fontWeight: 800, color: "#1F2937", cursor: "pointer", textAlign: "center" }}
                >{tr(t.label, langA)}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "#FFFBEB", borderRadius: 14, padding: "10px 14px", fontSize: 12, color: "#78350F", lineHeight: 1.6, marginBottom: 14, textAlign: "left" }}>
        <b>🐝 플레이 방법</b><br />
        • 9개 타일 중 하나를 고르고 내 언어로 한 문장 쓰기<br />
        • 친구(다른 언어) 차례로 바꿔가며 9번 채우기<br />
        • 건너뛰기 🎲 다시뽑기 각각 1회 가능<br />
        • 언어: {LANGUAGES[langA]?.flag} {LANGUAGES[langA]?.label} ↔ {LANGUAGES[langB]?.flag} {LANGUAGES[langB]?.label}
      </div>

      <button type="button" aria-label="게임 시작"
        onClick={() => onStart(mode, mode === "theme" ? THEMES[themeIdx].label : undefined)}
        style={{ width: "100%", padding: "14px", borderRadius: 14, background: "linear-gradient(90deg,#A78BFA,#EC4899)", border: "none", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 20px rgba(167,139,250,0.4)" }}
      >🚀 이야기 시작하기</button>
    </div>
  );
}

// ============================================================
// Gallery
// ============================================================

function GalleryScreen({ state, langA, langB, onRestart }: { state: GameState; langA: string; langB: string; onRestart: () => void }) {
  function speak(text: string, lang: string) {
    if (!text.trim()) return;
    new Audio(`/api/tts?text=${encodeURIComponent(text.slice(0, 200))}&lang=${lang}`).play().catch(() => {});
  }

  return (
    <div style={{ padding: "18px 14px 40px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <BeeMascot size={90} mood="cheer" />
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", marginTop: 8 }}>🎉 우리의 이야기</div>
        {state.theme && <div style={{ fontSize: 13, fontWeight: 800, color: "#6D28D9", marginTop: 4 }}>📌 {tr(state.theme, langA)}</div>}
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{state.entries.length}개의 문장이 모였어요</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {state.entries.map((e) => {
          const sym = STORY_SYMBOLS.find((s) => s.id === e.symbolId);
          if (!sym) return null;
          const playerColor = e.by === "A" ? "#3B82F6" : "#EC4899";
          const readLang = e.by === "A" ? langA : langB;
          return (
            <div key={e.order} style={{ background: "#fff", borderRadius: 16, padding: 4, backgroundImage: "repeating-linear-gradient(45deg, #FEF3C7 0 6px, #FBBF24 6px 10px, #FEF3C7 10px 16px)", boxShadow: "0 6px 16px rgba(0,0,0,0.08)" }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 10, borderLeft: `5px solid ${playerColor}` }}>
                <div style={{ width: 60, height: 60, flexShrink: 0, background: "#F9FAFB", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TileImage sym={sym} size={48} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ background: playerColor, color: "#fff", borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 900 }}>{e.order}. {e.by}</span>
                    <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 700 }}>{LANGUAGES[e.sentenceLang]?.flag} {LANGUAGES[e.sentenceLang]?.label ?? e.sentenceLang}</span>
                    <button type="button" onClick={() => speak(e.sentence, readLang)} aria-label={`${e.order}번 문장 읽어주기`}
                      style={{ marginLeft: "auto", border: "1px solid #E5E7EB", background: "#F9FAFB", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 800, color: "#4B5563", cursor: "pointer" }}
                    >🔊</button>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", lineHeight: 1.5 }}>{e.sentence}</div>
                  {e.translation && e.translationLang && (
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4, lineHeight: 1.5, borderTop: "1px dashed #E5E7EB", paddingTop: 4 }}>
                      {LANGUAGES[e.translationLang]?.flag} {e.translation}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button type="button" onClick={() => alert("이야기가 저장되었어요! (데모)")} aria-label="이야기 저장"
          style={{ flex: 1, padding: "12px", borderRadius: 14, background: "#FEF3C7", border: "2px solid #FBBF24", color: "#92400E", fontWeight: 900, fontSize: 14, cursor: "pointer" }}
        >💾 저장</button>
        <button type="button" onClick={onRestart} aria-label="새 이야기 시작"
          style={{ flex: 2, padding: "12px", borderRadius: 14, background: "linear-gradient(90deg,#A78BFA,#EC4899)", border: "none", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(167,139,250,0.35)" }}
        >🔄 새 이야기</button>
      </div>
    </div>
  );
}

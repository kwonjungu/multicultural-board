"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { LangMap, SPOT_DIFF_SCENES, SpotDiffScene, pickN, tr } from "@/lib/gameData";
import BeeMascot from "../BeeMascot";

// ============================================================
// Spot the Difference (틀린 그림 찾기)
// ─────────────────────────────────────────────────────────────
// Uses real A/B images under /public/spot-diff and a
// 3-item checklist — students tap whichever difference they
// spot between the A and B images. All 3 found → next scene.
// 6 randomly selected scenes out of 10 per game.
// ============================================================

const L = {
  title:       { ko: "틀린 그림 찾기", en: "Spot the Difference", vi: "Tìm điểm khác nhau", zh: "找不同", ja: "まちがい探し" },
  intro:       { ko: "두 그림에서 다른 점 3가지를 찾아요", en: "Find 3 differences between the two pictures", vi: "Tìm 3 điểm khác nhau giữa hai bức tranh", zh: "找出两幅图之间的3处不同", ja: "2枚の絵の違い3つを見つけよう" },
  rounds:      { ko: "6개 장면을 순서대로 풀어요", en: "Play through 6 scenes", vi: "Chơi 6 cảnh liên tiếp", zh: "依次挑战6个场景", ja: "6つの場面を順にプレイ" },
  start:       { ko: "시작", en: "Start", vi: "Bắt đầu", zh: "开始", ja: "スタート" },
  sceneLabel:  { ko: "장면", en: "Scene", vi: "Cảnh", zh: "场景", ja: "場面" },
  left:        { ko: "왼쪽 (A)", en: "Left (A)", vi: "Trái (A)", zh: "左图 (A)", ja: "左 (A)" },
  right:       { ko: "오른쪽 (B)", en: "Right (B)", vi: "Phải (B)", zh: "右图 (B)", ja: "右 (B)" },
  checklist:   { ko: "찾은 것을 체크하세요", en: "Check what you found", vi: "Đánh dấu điều bạn tìm thấy", zh: "勾选你找到的不同", ja: "見つけたらチェック" },
  progress:    { ko: "찾음", en: "Found", vi: "Đã tìm", zh: "已找到", ja: "発見" },
  next:        { ko: "다음 장면", en: "Next scene", vi: "Cảnh tiếp", zh: "下一个", ja: "次へ" },
  complete:    { ko: "장면 완료!", en: "Scene complete!", vi: "Hoàn thành!", zh: "场景完成！", ja: "クリア!" },
  finish:      { ko: "모든 장면 완료!", en: "All scenes complete!", vi: "Hoàn thành tất cả!", zh: "全部完成！", ja: "ぜんぶクリア!" },
  totalTime:   { ko: "총 시간", en: "Total time", vi: "Tổng thời gian", zh: "总时间", ja: "合計時間" },
  replay:      { ko: "다시하기", en: "Play again", vi: "Chơi lại", zh: "再玩一次", ja: "もう一度" },
} satisfies Record<string, LangMap>;

function lab(map: LangMap, a: string, b: string): string {
  const x = tr(map, a);
  const y = tr(map, b);
  return x === y ? x : `${x} / ${y}`;
}

// ============================================================
// Tiny Web Audio sfx — pattern from BeeWorldMarble/HalliGalli.
// ============================================================

interface WindowWithAudio {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function playTone(
  freq: number,
  durationMs: number,
  type: OscillatorType = "sine",
  volume = 0.18,
): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as WindowWithAudio;
  const AC = w.AudioContext ?? w.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + durationMs / 1000);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000);
}

const sfx = {
  tick: (): void => playTone(880, 90, "triangle", 0.16),
  sceneDone: (): void => {
    playTone(523, 140, "sine", 0.18);
    window.setTimeout(() => playTone(659, 140, "sine", 0.18), 130);
    window.setTimeout(() => playTone(784, 260, "sine", 0.2), 260);
  },
  win: (): void => {
    playTone(392, 150, "triangle", 0.2);
    window.setTimeout(() => playTone(523, 150, "triangle", 0.2), 140);
    window.setTimeout(() => playTone(659, 150, "triangle", 0.2), 280);
    window.setTimeout(() => playTone(784, 380, "triangle", 0.22), 420);
  },
};

// ============================================================
// Phases
// ============================================================

type Phase = "intro" | "play" | "result";

const SCENES_PER_GAME = 6;

interface Props {
  langA: string;
  langB: string;
}

export default function SpotDifference({ langA, langB }: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [order, setOrder] = useState<SpotDiffScene[]>(() => pickN(SPOT_DIFF_SCENES, SCENES_PER_GAME));
  const [sceneIdx, setSceneIdx] = useState(0);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [tick, setTick] = useState(0);

  // Running timer while in play phase.
  useEffect(() => {
    if (phase !== "play" || startedAt == null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase, startedAt]);

  const elapsedSec = useMemo(() => {
    if (phase === "result") return Math.round(elapsedMs / 1000);
    if (phase !== "play" || startedAt == null) return 0;
    void tick; // keep re-render
    return Math.round((Date.now() - startedAt) / 1000);
  }, [phase, startedAt, tick, elapsedMs]);

  const scene = order[sceneIdx];
  const sceneDone = scene ? found.size >= scene.differences.length : false;

  function handleStart(): void {
    setOrder(pickN(SPOT_DIFF_SCENES, SCENES_PER_GAME));
    setSceneIdx(0);
    setFound(new Set());
    setStartedAt(Date.now());
    setElapsedMs(0);
    setPhase("play");
  }

  function handleTick(diffIdx: number): void {
    if (!scene) return;
    if (found.has(diffIdx)) return;
    const next = new Set(found);
    next.add(diffIdx);
    setFound(next);
    if (next.size >= scene.differences.length) {
      sfx.sceneDone();
    } else {
      sfx.tick();
    }
  }

  function handleNext(): void {
    if (sceneIdx + 1 >= order.length) {
      // finished
      const end = startedAt == null ? 0 : Date.now() - startedAt;
      setElapsedMs(end);
      sfx.win();
      setPhase("result");
      return;
    }
    setSceneIdx((i) => i + 1);
    setFound(new Set());
  }

  function handleReplay(): void {
    setPhase("intro");
    setFound(new Set());
    setStartedAt(null);
    setElapsedMs(0);
    setSceneIdx(0);
  }

  // ============================================================
  // RENDER
  // ============================================================

  if (phase === "intro") {
    return (
      <div style={wrap}>
        <div style={{ textAlign: "center", paddingTop: 20 }}>
          <BeeMascot size={120} mood="welcome" />
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: "10px 0 6px", color: "#111827" }}>
            {lab(L.title, langA, langB)}
          </h2>
          <p style={{ fontSize: 14, color: "#4B5563", margin: "0 0 2px" }}>
            {lab(L.intro, langA, langB)}
          </p>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 22px" }}>
            {lab(L.rounds, langA, langB)}
          </p>
          <button onClick={handleStart} style={startBtn}>
            {lab(L.start, langA, langB)}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const mm = Math.floor(elapsedSec / 60);
    const ss = elapsedSec % 60;
    const timeStr = `${mm}:${ss.toString().padStart(2, "0")}`;
    return (
      <div style={wrap}>
        <div style={{ textAlign: "center", paddingTop: 30 }}>
          <BeeMascot size={140} mood="celebrate" />
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: "12px 0 6px", color: "#111827" }}>
            {lab(L.finish, langA, langB)}
          </h2>
          <div style={{
            display: "inline-block", marginTop: 10, padding: "12px 24px",
            background: "#FEF3C7", borderRadius: 16, fontSize: 16, fontWeight: 800,
            color: "#92400E",
          }}>
            {lab(L.totalTime, langA, langB)}: {timeStr}
          </div>
          <div style={{ marginTop: 22 }}>
            <button onClick={handleReplay} style={startBtn}>
              {lab(L.replay, langA, langB)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === "play"
  if (!scene) return null;
  return (
    <div style={wrap}>
      {/* Header */}
      <div style={headerRow}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6366F1" }}>
          {lab(L.sceneLabel, langA, langB)} {sceneIdx + 1} / {order.length}
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>
          {lab(scene.name, langA, langB)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>
          ⏱ {Math.floor(elapsedSec / 60)}:{(elapsedSec % 60).toString().padStart(2, "0")}
        </div>
      </div>

      {/* A/B images */}
      <div style={imagesGrid}>
        <SceneImage src={scene.imageA} badge="A" label={lab(L.left, langA, langB)} />
        <SceneImage src={scene.imageB} badge="B" label={lab(L.right, langA, langB)} />
      </div>

      {/* Checklist */}
      <div style={{ marginTop: 18 }}>
        <div style={checklistHeader}>
          <span>{lab(L.checklist, langA, langB)}</span>
          <span style={{ fontWeight: 900, color: "#16A34A" }}>
            {found.size} / {scene.differences.length}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {scene.differences.map((d, i) => {
            const ok = found.has(i);
            return (
              <button
                key={i}
                onClick={() => handleTick(i)}
                disabled={ok}
                style={{
                  ...checkRow,
                  background: ok ? "#DCFCE7" : "#fff",
                  borderColor: ok ? "#16A34A" : "#E5E7EB",
                  cursor: ok ? "default" : "pointer",
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: ok ? "#16A34A" : "#F3F4F6",
                  color: "#fff", fontSize: 16, fontWeight: 900,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {ok ? "✓" : "□"}
                </span>
                <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 800, color: ok ? "#15803D" : "#111827",
                    textDecoration: ok ? "line-through" : "none",
                  }}>
                    {lab(d.label, langA, langB)}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: ok ? "#16A34A" : "#9CA3AF",
                    marginTop: 2,
                  }}>
                    📍 {lab(d.where, langA, langB)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Next scene CTA */}
      {sceneDone && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#16A34A", marginBottom: 10 }}>
            ✨ {lab(L.complete, langA, langB)}
          </div>
          <button onClick={handleNext} style={startBtn}>
            {sceneIdx + 1 >= order.length
              ? lab(L.finish, langA, langB)
              : lab(L.next, langA, langB)}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SceneImage({ src, badge, label }: { src: string; badge: "A" | "B"; label: string }) {
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  return (
    <figure style={figStyle}>
      <figcaption style={figCap}>
        <span style={badgeStyle}>{badge}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#4B5563" }}>{label}</span>
      </figcaption>
      <div style={imgBox}>
        {errored ? (
          <div style={fallbackBox}>
            <div style={{ fontSize: 64 }}>🖼️</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
              {badge}
            </div>
          </div>
        ) : (
          <img
            ref={imgRef}
            src={src}
            alt={`Scene ${badge}`}
            onError={() => setErrored(true)}
            style={imgStyle}
            draggable={false}
          />
        )}
      </div>
    </figure>
  );
}

// ============================================================
// Styles
// ============================================================

const wrap: CSSProperties = {
  padding: "16px 12px 40px",
  maxWidth: 960,
  margin: "0 auto",
};

const startBtn: CSSProperties = {
  background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
  color: "#fff",
  border: "none",
  padding: "14px 32px",
  fontSize: 16,
  fontWeight: 900,
  borderRadius: 99,
  cursor: "pointer",
  boxShadow: "0 6px 16px rgba(99,102,241,0.3)",
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 12,
  padding: "0 4px",
};

const imagesGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const figStyle: CSSProperties = {
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const figCap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  borderRadius: 99,
  background: "#6366F1",
  color: "#fff",
  fontSize: 13,
  fontWeight: 900,
};

const imgBox: CSSProperties = {
  position: "relative",
  aspectRatio: "4 / 3",
  background: "#F3F4F6",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
};

const imgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const fallbackBox: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #E0E7FF, #F3E8FF)",
};

const checklistHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
  fontWeight: 800,
  color: "#111827",
  marginBottom: 8,
  padding: "0 4px",
};

const checkRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  border: "2px solid #E5E7EB",
  borderRadius: 12,
  background: "#fff",
  width: "100%",
  textAlign: "left",
  transition: "background 0.15s, border-color 0.15s",
};

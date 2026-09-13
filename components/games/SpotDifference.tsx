"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LangMap, SPOT_DIFF_SCENES, SpotDiffScene, pickN, tr } from "@/lib/gameData";
import { playTone } from "@/lib/gameSfx";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../ui/game/GameHeader";

// ============================================================
// Spot the Difference (틀린 그림 찾기)
// ─────────────────────────────────────────────────────────────
// Uses real A/B images under /public/spot-diff and a
// 3-item checklist — students tap whichever difference they
// spot between the A and B images. All 3 found → next scene.
// 6 randomly selected scenes out of 10 per game.
//
// 좌표 탭이 아니라 "체크리스트 탭" 게임이다. 그림 위의 픽셀을 찍지 않으므로
// 캔버스·DPR·정규화 좌표가 필요 없다 (판정은 differences 배열의 index 로만 한다).
// 그 대신 두 그림이 **같은 크기로 나란히** 보이는 것이 정확도의 핵심이라
// aspect-ratio 를 고정하고 768px 이상에서 좌우 2단으로 크게 배치한다.
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
  // 이미 체크한 줄을 다시 눌렀을 때 — 실패가 아니라 "이미 찾았어요" 안내.
  already:     { ko: "이미 찾았어요", en: "Already found", vi: "Đã tìm rồi", zh: "已经找到了", ja: "もう見つけたよ" },
  // 그림이 안 열릴 때 아이에게 지금 할 일만 말한다.
  imgFail:     { ko: "그림을 못 불러왔어요. 친구와 이야기하며 찾아봐요.", en: "The picture did not load. Talk with your friend and keep looking.", vi: "Không tải được hình. Hãy cùng bạn tìm tiếp nhé.", zh: "图片没有加载。和朋友一起继续找吧。", ja: "えが ひらきませんでした。ともだちと さがしてみよう。" },
} satisfies Record<string, LangMap>;

function lab(map: LangMap, a: string, b: string): string {
  const x = tr(map, a);
  const y = tr(map, b);
  return x === y ? x : `${x} / ${y}`;
}

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

  // 예약된 효과음 타이머 전부. unmount·재시작 때 한 곳에서 정리한다 (NumberTap 패턴).
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

  // 화면을 나가도 예약된 축하음이 남지 않는다.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  // 효과음 — 음정·길이는 그대로, 예약만 관리형 타이머로 옮겼다.
  const sfxTick = useCallback(() => {
    playTone(880, 90, "triangle", 0.16);
  }, []);
  const sfxSceneDone = useCallback(() => {
    playTone(523, 140, "sine", 0.18);
    later(() => playTone(659, 140, "sine", 0.18), 130);
    later(() => playTone(784, 260, "sine", 0.2), 260);
  }, [later]);
  const sfxWin = useCallback(() => {
    playTone(392, 150, "triangle", 0.2);
    later(() => playTone(523, 150, "triangle", 0.2), 140);
    later(() => playTone(659, 150, "triangle", 0.2), 280);
    later(() => playTone(784, 380, "triangle", 0.22), 420);
  }, [later]);

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
    clearTimers();
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
      sfxSceneDone();
    } else {
      sfxTick();
    }
  }

  function handleNext(): void {
    if (sceneIdx + 1 >= order.length) {
      // finished
      const end = startedAt == null ? 0 : Date.now() - startedAt;
      setElapsedMs(end);
      sfxWin();
      setPhase("result");
      return;
    }
    setSceneIdx((i) => i + 1);
    setFound(new Set());
  }

  function handleReplay(): void {
    clearTimers();
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
      <div data-ux-root className="sd-root sd-center">
        <ScopedStyle css={SD_CSS} />
        <BeeMascot size={120} mood="welcome" />
        <h2 data-ux-role="title" className="sd-h">{lab(L.title, langA, langB)}</h2>
        <p data-ux-role="body" className="sd-p">{lab(L.intro, langA, langB)}</p>
        <p data-ux-role="secondary" className="sd-p">{lab(L.rounds, langA, langB)}</p>
        <button type="button" data-ux-role="action" className="sd-primary" onClick={handleStart}>
          ▶ {lab(L.start, langA, langB)}
        </button>
      </div>
    );
  }

  if (phase === "result") {
    const mm = Math.floor(elapsedSec / 60);
    const ss = elapsedSec % 60;
    const timeStr = `${mm}:${ss.toString().padStart(2, "0")}`;
    return (
      <div data-ux-root className="sd-root sd-center">
        <ScopedStyle css={SD_CSS} />
        <BeeMascot size={140} mood="celebrate" />
        <h2 data-ux-role="title" className="sd-h">🎉 {lab(L.finish, langA, langB)}</h2>
        <p data-ux-role="body-emphasis" className="sd-time">
          ⏱ {lab(L.totalTime, langA, langB)}: {timeStr}
        </p>
        <button type="button" data-ux-role="action" className="sd-primary" onClick={handleReplay}>
          🔁 {lab(L.replay, langA, langB)}
        </button>
      </div>
    );
  }

  // phase === "play"
  if (!scene) return null;
  return (
    <div data-ux-root className="sd-root sd-play">
      <ScopedStyle css={SD_CSS} />

      {/* U01 공용 헤더 — 뒤로는 이 게임의 시작 화면으로 돌아간다.
          예전에는 장면 이름이 가운데에 있어 게임마다 가운데 글자가 달라졌다.
          가운데는 이제 어느 게임에서나 게임 이름이고, 장면 이름은 판 위로 내렸다. */}
      <GameHeader
        gameId="spot"
        title="틀린 그림 찾기"
        icon="🔍"
        onBack={handleReplay}
        backLabel="처음"
        progress={{ value: sceneIdx, max: order.length }}
        status={
          <>
            <GameStat
              icon="🖼"
              label={lab(L.sceneLabel, langA, langB)}
              value={`${sceneIdx + 1} / ${order.length}`}
            />
            <GameStat
              icon="✅"
              label={lab(L.progress, langA, langB)}
              value={`${found.size} / ${scene.differences.length}`}
              tone="key"
            />
            <GameStat
              icon="⏱"
              label={lab(L.totalTime, langA, langB)}
              value={`${Math.floor(elapsedSec / 60)}:${(elapsedSec % 60).toString().padStart(2, "0")}`}
            />
          </>
        }
      />
      <p data-ux-role="body-emphasis" className="sd-scenename">
        {lab(scene.name, langA, langB)}
      </p>

      {/* A/B images — 좁은 화면 위아래, 768 이상 좌우 2단 */}
      <div className="sd-images">
        {/* key 로 장면마다 리마운트 — errored(onError) 상태가 다음 장면으로 새어가지 않게 */}
        <SceneImage
          key={scene.imageA}
          src={scene.imageA}
          badge="A"
          label={lab(L.left, langA, langB)}
          failText={lab(L.imgFail, langA, langB)}
        />
        <SceneImage
          key={scene.imageB}
          src={scene.imageB}
          badge="B"
          label={lab(L.right, langA, langB)}
          failText={lab(L.imgFail, langA, langB)}
        />
      </div>

      {/* Checklist */}
      <div className="sd-checkwrap">
        <div className="sd-checkhead">
          <span data-ux-role="label">{lab(L.checklist, langA, langB)}</span>
          <span data-ux-role="label" className="sd-count">
            {lab(L.progress, langA, langB)} {found.size} / {scene.differences.length}
          </span>
        </div>
        <div className="sd-checklist">
          {scene.differences.map((d, i) => {
            const ok = found.has(i);
            return (
              <button
                key={i}
                type="button"
                data-ux-role="control"
                className="sd-check"
                data-found={ok ? "" : undefined}
                aria-disabled={ok || undefined}
                aria-pressed={ok}
                onClick={() => handleTick(i)}
              >
                <span aria-hidden="true" className="sd-box">{ok ? "✓" : "□"}</span>
                <span className="sd-checktext">
                  <span className="sd-checklabel">{lab(d.label, langA, langB)}</span>
                  <span data-ux-role="secondary" className="sd-where">
                    📍 {lab(d.where, langA, langB)}
                    {ok ? ` · ${lab(L.already, langA, langB)}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Next scene CTA */}
      {sceneDone && (
        <div className="sd-cta" role="status">
          <p data-ux-role="body-emphasis" className="sd-done">
            ✨ {lab(L.complete, langA, langB)}
          </p>
          <button type="button" data-ux-role="action" className="sd-primary" onClick={handleNext}>
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

function SceneImage({
  src, badge, label, failText,
}: { src: string; badge: "A" | "B"; label: string; failText: string }) {
  const [errored, setErrored] = useState(false);

  return (
    <figure className="sd-fig">
      <figcaption className="sd-figcap">
        <span aria-hidden="true" className="sd-badge">{badge}</span>
        <span data-ux-role="label">{label}</span>
      </figcaption>
      <div className="sd-imgbox">
        {errored ? (
          <div className="sd-fallback">
            <span aria-hidden="true" className="sd-fallicon">🖼️</span>
            <span data-ux-role="secondary" className="sd-falltext">{failText}</span>
          </div>
        ) : (
          <img
            src={src}
            alt={`${label}`}
            onError={() => setErrored(true)}
            className="sd-img"
            draggable={false}
          />
        )}
      </div>
    </figure>
  );
}

// ============================================================
// Styles — 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것.
// ============================================================

const SD_CSS = `
.sd-root{
  color: var(--ux-ink);
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--ux-space-4) var(--ux-space-3) var(--ux-space-12);
  word-break: keep-all;
  overflow-wrap: anywhere;
}
.sd-center{
  display: grid; justify-items: center; gap: var(--ux-space-3);
  text-align: center;
  padding-top: var(--ux-space-8);
}
.sd-center .sd-h, .sd-center .sd-p{ margin: 0; max-width: 42ch; }
.sd-time{
  margin: 0;
  background: var(--ux-hint-apricot);
  border-radius: var(--ux-radius-pill);
  padding: var(--ux-space-3) var(--ux-space-6);
  font-weight: 800;
}
.sd-primary{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800;
  margin-top: var(--ux-space-2);
}

.sd-play{ display: flex; flex-direction: column; gap: var(--ux-space-4); }

/* U01: 장면 번호·시계는 공용 GameHeader 의 상태로 옮겼다(.sd-header 삭제).
   남은 장면 이름은 판 바로 위의 한 줄. */
.sd-scenename{ margin: 0; font-weight: 900; min-width: 0; text-align: center; }

.sd-images{
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ux-space-3);
}
@media (min-width: 768px){
  .sd-images{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.sd-fig{ margin: 0; display: flex; flex-direction: column; gap: var(--ux-space-2); min-width: 0; }
.sd-figcap{ display: flex; align-items: center; gap: var(--ux-space-2); }
.sd-badge{
  display: inline-flex; align-items: center; justify-content: center;
  width: 2em; height: 2em; border-radius: var(--ux-radius-pill);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  font-weight: 900; flex-shrink: 0;
}
.sd-imgbox{
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-panel);
  overflow: hidden;
  border: 2px solid var(--ux-primary-border);
}
.sd-img{
  width: 100%; height: 100%;
  object-fit: contain;      /* cover 는 가장자리를 잘라 A/B 가 서로 다르게 보인다 */
  display: block;
  background: var(--ux-surface);
  user-select: none; -webkit-user-drag: none;
}
.sd-fallback{
  width: 100%; height: 100%;
  display: flex; flex-direction: column; gap: var(--ux-space-2);
  align-items: center; justify-content: center;
  padding: var(--ux-space-4);
  text-align: center;
  background: var(--ux-hint-lavender);
}
.sd-fallicon{ font-size: calc(var(--ux-font-title) * 2); line-height: 1; }
.sd-falltext{ max-width: 30ch; }

.sd-checkwrap{ display: grid; gap: var(--ux-space-2); }
.sd-checkhead{
  display: flex; justify-content: space-between; align-items: center;
  gap: var(--ux-space-2); flex-wrap: wrap;
  padding: 0 var(--ux-space-1);
  font-weight: 800;
}
.sd-count{ color: var(--ux-success); font-weight: 900; }
.sd-checklist{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--ux-space-3);
}
.sd-check[data-ux-role="control"]{
  display: flex; align-items: center; gap: var(--ux-space-3);
  text-align: left;
  width: 100%;
  background: var(--ux-surface);
  border: 2px solid var(--ux-primary-border);
  color: var(--ux-ink);
  font-family: inherit;
  transition: background var(--ux-motion-state) var(--ux-motion-ease),
              border-color var(--ux-motion-state) var(--ux-motion-ease);
}
.sd-check[data-found]{
  background: color-mix(in srgb, var(--ux-success) 14%, var(--ux-surface));
  border-color: var(--ux-success);
  cursor: default;
}
.sd-box{
  display: flex; align-items: center; justify-content: center;
  width: 2em; height: 2em; flex-shrink: 0;
  border-radius: var(--ux-radius-surface);
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  font-weight: 900;
}
.sd-check[data-found] .sd-box{ background: var(--ux-success); color: var(--ux-primary-ink); }
.sd-checktext{ display: grid; gap: var(--ux-space-1); min-width: 0; flex: 1; }
.sd-checklabel{ font-size: var(--ux-font-body); line-height: var(--ux-lh-reading); font-weight: 800; }
.sd-check[data-found] .sd-checklabel{ color: var(--ux-success); text-decoration: line-through; }

.sd-cta{
  display: grid; justify-items: center; gap: var(--ux-space-3);
  text-align: center;
  padding: var(--ux-space-4);
  background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-panel);
}
.sd-done{ margin: 0; color: var(--ux-success); font-weight: 900; }
`;

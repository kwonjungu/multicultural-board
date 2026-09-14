"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONTINENT_KO, MAP_ASPECT, countryName, hintView, hitTest, planQuiz,
  type MapBundle, type MapCountry,
} from "@/lib/worldMapQuiz";
import { COUNTRIES } from "@/lib/gameData";
import ScopedStyle from "../ui/child/ScopedStyle";

/**
 * 평면 세계지도 나라 찾기 (U12 / 08 "advanced-world-map-quiz").
 *
 * 나라 **이름**을 주고 아이가 지도에서 그 나라를 **눌러** 찾는다. 지구본 퀴즈와
 * 짝이 되는 평면 모드다.
 *
 * ── 좌표를 SVG 에 맡긴 이유 ───────────────────────────────────
 * viewBox 를 `0 0 360 180` 으로 두면 SVG 안의 좌표가 **곧 경위도**다
 * (x = 경도+180, y = 90-위도). 클릭 지점은 `getScreenCTM().inverse()` 로
 * 되돌린다. 그래서
 *  - 지도가 몇 px 이든, 화면이 어떻게 늘어나든 클릭 좌표가 어긋나지 않는다.
 *  - 08 §4 "글자 크기 변경으로 지도 크기/클릭 좌표가 깨지지 않아야 한다" 가
 *    저절로 지켜진다. 글자 크기는 SVG 바깥 이야기라 좌표계를 건드리지 못한다.
 * 직접 px↔도 변환을 들고 다니면 이 둘이 전부 손으로 맞춰야 할 것이 된다.
 *
 * ── 다시 그리지 않는 것 ────────────────────────────────────
 * 08 §4 "60개 이상의 지도 라벨·국기를 매 프레임 React DOM 으로 재생성하지
 * 않는다". 나라 path 문자열은 번들이 오면 **한 번** 만들고(useMemo) 그 뒤로는
 * 색만 바뀐다. 확대·이동은 viewBox 숫자만 바꾸므로 path 는 손대지 않는다.
 */

const BUNDLE_URL = "/maps/world-quiz.v1.json";
const QUESTION_COUNT = 8;

/** 이름 사전: alpha-2 → 언어별 이름. COUNTRIES 에서 한 번 만든다. */
const NAME_SOURCE = {
  byIso2: Object.fromEntries(COUNTRIES.map((c) => [c.code, c.names])) as Record<
    string,
    Record<string, string>
  >,
};

type Phase = "loading" | "error" | "playing" | "done";
/** 한 문제의 결과. 힌트를 쓴 문제는 08 "독립 해결과 별도 기록" 대로 따로 센다. */
interface Mark {
  countryId: string;
  correct: boolean;
  hintsUsed: number;
  skipped: boolean;
}

export interface WorldMapQuizProps {
  /**
   * 게임룸이 넘기는 규약은 `{ langA, langB }` 다. 나라 이름은 **한 언어로만**
   * 낸다 — 두 언어를 나란히 적으면 그 중 하나가 아이가 아는 말이라 위치를
   * 몰라도 다른 쪽 표기로 답을 짐작할 여지가 생긴다. 그래서 langA 만 쓴다.
   */
  langA: string;
  langB: string;
  /** 문제를 고정하고 싶을 때(검수·fixture). 없으면 들어올 때 한 번 정한다. */
  seed?: number;
}

export default function WorldMapQuiz({ langA, seed }: WorldMapQuizProps) {
  const uiLang = langA || "ko";
  const [phase, setPhase] = useState<Phase>("loading");
  const [bundle, setBundle] = useState<MapBundle | null>(null);
  const [errText, setErrText] = useState("");

  /**
   * 시드는 **한 번** 정하고 다시 뽑지 않는다. 08 §2 가 "화면 resize 가 문제를
   * 다시 뽑지 않게" 하라고 요구한다 — 시드를 state 로 붙들어 두면 폭이 바뀌든
   * 글자 크기가 바뀌든 문제는 그대로다.
   */
  const [runSeed] = useState(() => seed ?? Math.floor(Math.random() * 2 ** 31));

  const [qIndex, setQIndex] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [hint, setHint] = useState(0);
  const [notice, setNotice] = useState<string>("");
  /** 확정 후 결과를 잠깐 보여 주는 상태. null 이면 아직 확정 전이다. */
  const [judged, setJudged] = useState<null | { correct: boolean; answer: string }>(null);

  useEffect(() => {
    let alive = true;
    fetch(BUNDLE_URL)
      .then((r) => { if (!r.ok) throw new Error(`지도 데이터를 못 받았어요 (${r.status})`); return r.json(); })
      .then((j: MapBundle) => { if (!alive) return; setBundle(j); setPhase("playing"); })
      .catch((e) => { if (!alive) return; setErrText(String(e.message || e)); setPhase("error"); });
    return () => { alive = false; };
  }, []);

  const plan = useMemo(
    () => (bundle ? planQuiz(bundle.countries, { seed: runSeed, count: QUESTION_COUNT }) : null),
    [bundle, runSeed],
  );

  const byId = useMemo(() => {
    const m = new Map<string, MapCountry>();
    for (const c of bundle?.countries ?? []) m.set(c.countryId, c);
    return m;
  }, [bundle]);

  const answerId = plan?.questions[qIndex] ?? null;
  const answer = answerId ? byId.get(answerId) ?? null : null;
  const hints = hintView(hint, answer?.continent ?? "");

  const nameOf = useCallback(
    (id: string) => countryName(id, uiLang, NAME_SOURCE),
    [uiLang],
  );

  /* ── 클릭 ───────────────────────────────────────────── */
  const handlePick = useCallback(
    (lng: number, lat: number) => {
      if (!bundle || judged) return;
      const r = hitTest(lng, lat, bundle.countries);
      if (r.status === "ocean") {
        // 08 §3: 해상 클릭은 오답이 아니다. 고른 것을 지우지도 않는다.
        setNotice("바다예요. 나라 안을 골라 주세요.");
        return;
      }
      if (r.status === "ambiguous") {
        // 임의로 하나 고르지 않는다 — 후보를 말해 주고 다시 고르게 한다.
        setNotice(`경계가 겹쳐요. 조금 안쪽을 눌러 주세요 (${r.candidates.map(nameOf).join(" / ")})`);
        return;
      }
      setNotice("");
      setPicked(r.countryId);
    },
    [bundle, judged, nameOf],
  );

  function confirm() {
    if (!picked || !answerId || judged) return;
    const correct = picked === answerId; // 08 §3: 코드로 비교한다. 이름이 아니다.
    setJudged({ correct, answer: answerId });
    setMarks((m) => [...m, { countryId: answerId, correct, hintsUsed: hint, skipped: false }]);
  }

  function skip() {
    if (!answerId || judged) return;
    setJudged({ correct: false, answer: answerId });
    setMarks((m) => [...m, { countryId: answerId, correct: false, hintsUsed: hint, skipped: true }]);
  }

  function nextQuestion() {
    const last = (plan?.questions.length ?? 0) - 1;
    setJudged(null); setPicked(null); setHint(0); setNotice("");
    if (qIndex >= last) setPhase("done");
    else setQIndex((i) => i + 1);
  }

  function restart() {
    setQIndex(0); setMarks([]); setPicked(null); setHint(0); setNotice(""); setJudged(null);
    setPhase("playing");
  }

  /* ── 화면 ───────────────────────────────────────────── */

  if (phase === "loading") {
    return (
      <div className="wmq-root">
        <ScopedStyle css={CSS} />
        <p data-ux-role="body-emphasis" className="wmq-msg">🗺️ 지도를 가져오는 중…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="wmq-root">
        <ScopedStyle css={CSS} />
        <p data-ux-role="body-emphasis" className="wmq-msg">🗺️ 지도를 열지 못했어요.</p>
        <p data-ux-role="secondary" className="wmq-msg">{errText}</p>
      </div>
    );
  }

  if (phase === "done" || !answer || !plan) {
    const solved = marks.filter((m) => m.correct);
    const alone = solved.filter((m) => m.hintsUsed === 0);
    return (
      <div className="wmq-root">
        <ScopedStyle css={CSS} />
        <div className="wmq-result">
          <div className="wmq-resulticon" aria-hidden>🗺️</div>
          <p data-ux-role="body-emphasis" className="wmq-resulttitle">
            {solved.length} / {marks.length} 나라를 찾았어요
          </p>
          {/* 08: 힌트를 쓴 문제는 독립 해결과 별도로 기록한다. 한 점수로 합치지 않는다. */}
          <p data-ux-role="secondary">
            혼자 찾은 나라 {alone.length}개 · 힌트를 쓴 나라 {solved.length - alone.length}개
          </p>
          <ul className="wmq-resultlist">
            {marks.map((m, i) => (
              <li key={`${m.countryId}-${i}`} className="wmq-resultrow" data-ok={m.correct ? "" : undefined}>
                <span aria-hidden>{m.correct ? "🟢" : m.skipped ? "⏭️" : "🔴"}</span>
                <span data-ux-role="secondary">{nameOf(m.countryId)}</span>
                <span data-ux-role="secondary" className="wmq-resulthint">
                  {m.hintsUsed > 0 ? `힌트 ${m.hintsUsed}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <button data-ux-role="action" className="wmq-primary" onClick={restart}>
            🔁 다시 연습하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wmq-root">
      <ScopedStyle css={CSS} />

      <div className="wmq-layout">
        <WorldMap
          countries={bundle!.countries}
          picked={picked}
          answerId={answerId}
          // 시험 중에는 정답을 지도에 표시하지 않는다. 확정했거나 힌트 3단계일 때만.
          reveal={!!judged || hints.revealAnswer}
          highlightContinent={hints.highlightContinent ? answer.continent : null}
          onPick={handlePick}
          // 08 §2: 확정 전에는 국가명 tooltip 을 숨긴다. 보이면 위치 퀴즈가
          // 이름 찾기 놀이가 된다. 확정 뒤에는 마음껏 보게 둔다.
          showNames={!!judged}
          nameOf={nameOf}
        />

        <div className="wmq-panel">
          <div className="wmq-progress">
            <span data-ux-role="label">
              {qIndex + 1} / {plan.questions.length}
            </span>
            {plan.shortOf && (
              <span data-ux-role="secondary">
                (고른 범위에 {plan.questions.length}개만 있어 그만큼만 내요)
              </span>
            )}
          </div>

          <p data-ux-role="label" className="wmq-ask">이 나라는 어디일까요?</p>
          <p data-ux-role="body-emphasis" className="wmq-target">{nameOf(answerId!)}</p>

          <div className="wmq-picked" aria-live="polite">
            {judged ? (
              <span data-ux-role="body-emphasis" data-ok={judged.correct ? "" : undefined}>
                {judged.correct ? "🟢 맞았어요!" : `🔴 여기예요 — ${nameOf(judged.answer)}`}
              </span>
            ) : picked ? (
              <span data-ux-role="secondary">고른 곳: {nameOf(picked)}</span>
            ) : (
              <span data-ux-role="secondary">지도에서 나라를 눌러 보세요</span>
            )}
          </div>

          {notice && (
            <p data-ux-role="secondary" className="wmq-notice" role="status">{notice}</p>
          )}

          {hints.continent && (
            <p data-ux-role="secondary" className="wmq-hint">
              💡 {CONTINENT_KO[hints.continent] ?? hints.continent}에 있어요
            </p>
          )}

          <div className="wmq-actions">
            {!judged ? (
              <>
                <button
                  data-ux-role="control"
                  className="wmq-primary"
                  aria-disabled={!picked}
                  onClick={confirm}
                >
                  ✅ 여기예요
                </button>
                <button
                  data-ux-role="control"
                  className="wmq-secondary"
                  aria-disabled={hint >= 3}
                  onClick={() => setHint((h) => Math.min(3, h + 1))}
                >
                  💡 힌트 ({hint}/3)
                </button>
                <button data-ux-role="control" className="wmq-secondary" onClick={skip}>
                  ⏭️ 건너뛰기
                </button>
              </>
            ) : (
              <button data-ux-role="control" className="wmq-primary" onClick={nextQuestion}>
                ▶ 다음
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 지도 ─────────────────────────────────────────────── */

function ringToPath(ring: readonly (readonly [number, number])[]): string {
  let d = "";
  for (let i = 0; i < ring.length; i++) {
    const x = ring[i][0] + 180;
    const y = 90 - ring[i][1];
    d += `${i === 0 ? "M" : "L"}${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  return d + "Z";
}

interface WorldMapProps {
  countries: readonly MapCountry[];
  picked: string | null;
  answerId: string | null;
  reveal: boolean;
  highlightContinent: string | null;
  onPick: (lng: number, lat: number) => void;
  showNames: boolean;
  nameOf: (id: string) => string;
}

function WorldMap({
  countries, picked, answerId, reveal, highlightContinent, onPick, showNames, nameOf,
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  /**
   * 나라별 path 문자열. 번들이 바뀔 때만 만든다 — 확대·이동·정답 공개는
   * viewBox 와 색만 건드리므로 여기 오지 않는다(08 §4).
   */
  const paths = useMemo(
    () => countries.map((c) => ({
      id: c.countryId,
      continent: c.continent,
      d: c.polygons.map((poly) => poly.map(ringToPath).join(" ")).join(" "),
    })),
    [countries],
  );

  /* 확대·이동. viewBox 는 경위도 그대로다. */
  const [view, setView] = useState({ x: 0, y: 0, w: 360, h: 180 });
  const drag = useRef<null | { px: number; py: number; vx: number; vy: number; moved: boolean }>(null);

  const clampView = (v: { x: number; y: number; w: number; h: number }) => ({
    w: v.w, h: v.h,
    x: Math.max(0, Math.min(360 - v.w, v.x)),
    y: Math.max(0, Math.min(180 - v.h, v.y)),
  });

  function zoomBy(factor: number) {
    setView((v) => {
      const w = Math.max(30, Math.min(360, v.w * factor));
      const h = w / MAP_ASPECT;
      // 화면 가운데를 붙들고 확대한다 — 보고 있던 곳이 튀지 않는다.
      return clampView({ w, h, x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2 });
    });
  }

  /** 화면 좌표 → 경위도. SVG 의 좌표 변환을 그대로 되돌린다. */
  function toLngLat(clientX: number, clientY: number): { lng: number; lat: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { lng: p.x - 180, lat: 90 - p.y };
  }

  /* 끌기와 고르기를 가른다. 08 §5 "드래그와 선택 구분". */
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moved: false };
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 8) return; // 손떨림은 끌기가 아니다
    d.moved = true;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    setView((v) => clampView({
      ...v,
      x: d.vx - (dx / rect.width) * v.w,
      y: d.vy - (dy / rect.height) * v.h,
    }));
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return; // 끌었으면 고른 것이 아니다
    const ll = toLngLat(e.clientX, e.clientY);
    if (ll) onPick(ll.lng, ll.lat);
  }

  const zoom = 360 / view.w;

  return (
    <div className="wmq-mapwrap">
      <svg
        ref={svgRef}
        className="wmq-map"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="세계 지도"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
      >
        <rect x={0} y={0} width={360} height={180} className="wmq-sea" />
        {paths.map((p) => {
          const isPicked = p.id === picked;
          const isAnswer = reveal && p.id === answerId;
          const inRegion = highlightContinent != null && p.continent === highlightContinent;
          return (
            <path
              key={p.id}
              d={p.d}
              className="wmq-land"
              data-picked={isPicked ? "" : undefined}
              data-answer={isAnswer ? "" : undefined}
              data-region={inRegion ? "" : undefined}
              /* 선 굵기는 확대해도 화면에서 같은 굵기로 보여야 한다.
                 viewBox 가 줄면 1 단위가 커지므로 확대 배율로 나눈다. */
              strokeWidth={0.35 / zoom}
            />
          );
        })}
        {/* 이름은 확정 뒤에만. 시험 중에 라벨이 보이면 위치 퀴즈가 이름 찾기가 된다. */}
        {showNames && answerId && (() => {
          const c = countries.find((x) => x.countryId === answerId);
          if (!c?.centroid) return null;
          return (
            <text
              x={c.centroid[0] + 180}
              y={90 - c.centroid[1]}
              className="wmq-label"
              textAnchor="middle"
              fontSize={5 / zoom}
            >
              {nameOf(answerId)}
            </text>
          );
        })()}
      </svg>

      {/*
        이 지도에는 **배우는 66개국만** 그려져 있다. 나머지 땅은 바다처럼 비어
        있는데, 아무 말 없이 두면 아이가 "여기는 아무 나라도 없구나" 로 읽는다.
        그래서 숨기지 않고 적는다. 온 세상 육지를 채우려면 Natural Earth 의
        land polygon 을 따로 받아야 하고, 그 데이터의 출처·라이선스를 공식
        출처에서 확인하는 일이 먼저다(08 §3) — 아직 하지 않았다.
      */}
      <p data-ux-role="secondary" className="wmq-coverage">
        🗺️ 이 지도에는 우리가 배우는 나라만 그려져 있어요.
      </p>

      <div className="wmq-zoom">
        {/* 08 §3 "고배율에서 작은 국가의 선택 보조는 필수" — 확대가 그 보조다. */}
        <button data-ux-role="control" className="wmq-zoombtn" aria-label="지도 확대"
          onClick={() => zoomBy(1 / 1.6)}>➕</button>
        <button data-ux-role="control" className="wmq-zoombtn" aria-label="지도 축소"
          onClick={() => zoomBy(1.6)}>➖</button>
        <button data-ux-role="control" className="wmq-zoombtn" aria-label="지도 처음 크기로"
          onClick={() => setView({ x: 0, y: 0, w: 360, h: 180 })}>🌍</button>
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const CSS = `
.wmq-root{ display: grid; gap: var(--ux-space-3); width: 100%; }
.wmq-msg{ margin: 0; text-align: center; }

/* 08 §4: 태블릿 세로는 큰 지도 → 문제/확정(세로 쌓기), 가로·크롬북은
   지도 주 영역 + 간결한 문제 패널(가로 나누기). */
.wmq-layout{ display: grid; gap: var(--ux-space-3); grid-template-columns: 1fr; }
@media (min-width: 900px){
  .wmq-layout{ grid-template-columns: minmax(0, 1fr) minmax(280px, 340px); align-items: start; }
}

.wmq-mapwrap{ position: relative; width: 100%; }
.wmq-map{
  display: block; width: 100%; height: auto; aspect-ratio: 2 / 1;
  background: var(--ux-surface-sunk);
  border: 3px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  touch-action: none; /* 지도를 끄는 동안 화면이 같이 스크롤되지 않게 */
  cursor: crosshair;
}
.wmq-sea{ fill: #CFE8F3; }
.wmq-land{
  fill: #F2E4C9; stroke: #8B5E34; stroke-linejoin: round;
  transition: fill .12s linear;
}
.wmq-land[data-region]{ fill: #FFE9A8; }
.wmq-land[data-picked]{ fill: var(--ux-primary-fill); }
.wmq-land[data-answer]{ fill: #7BC47F; }
.wmq-label{ fill: var(--ux-ink); font-weight: 900; paint-order: stroke; stroke: #fff; stroke-width: .6; }

.wmq-coverage{ margin: var(--ux-space-1) 0 0; color: var(--ux-ink-soft); text-align: center; }
.wmq-zoom{
  position: absolute; right: var(--ux-space-2); top: var(--ux-space-2);
  display: grid; gap: var(--ux-space-1);
}
.wmq-zoombtn[data-ux-role="control"]{
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-pill); font-family: inherit; font-weight: 900;
  box-shadow: 0 2px 6px rgba(41,37,31,.2);
}

.wmq-panel{
  display: grid; gap: var(--ux-space-2); align-content: start;
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-3);
}
.wmq-progress{ display: flex; gap: var(--ux-space-2); align-items: baseline; flex-wrap: wrap; }
.wmq-ask{ margin: 0; color: var(--ux-ink-soft); }
.wmq-target{ margin: 0; color: var(--ux-primary-ink); }
.wmq-picked{ min-height: var(--ux-space-6); display: flex; align-items: center; }
.wmq-picked [data-ok]{ color: var(--ux-success); }
.wmq-notice{ margin: 0; color: var(--ux-primary-ink); }
.wmq-hint{ margin: 0; }
.wmq-actions{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; }
.wmq-primary[data-ux-role="control"], .wmq-primary[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 900;
}
.wmq-secondary[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 900;
}
.wmq-primary[aria-disabled="true"], .wmq-secondary[aria-disabled="true"]{ opacity: .55; cursor: default; }

.wmq-result{ display: grid; gap: var(--ux-space-2); justify-items: center; text-align: center; }
.wmq-resulticon{ font-size: clamp(2rem, 6vw, 3rem); line-height: 1; }
.wmq-resulttitle{ margin: 0; color: var(--ux-primary-ink); }
.wmq-resultlist{ list-style: none; margin: 0; padding: 0; display: grid; gap: var(--ux-space-1); width: min(420px, 100%); }
.wmq-resultrow{
  display: grid; grid-template-columns: auto 1fr auto; gap: var(--ux-space-2);
  align-items: center; text-align: left;
  padding: var(--ux-space-1) var(--ux-space-2);
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-pill);
}
.wmq-resulthint{ color: var(--ux-ink-soft); }
@media (prefers-reduced-motion: reduce){ .wmq-land{ transition: none; } }
`;

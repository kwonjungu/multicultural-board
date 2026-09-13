"use client";

import { useState, type ReactNode, useEffect } from "react";
import ScopedStyle from "../child/ScopedStyle";
import { useGameExit } from "./GameShellContext";
import { GAME_GUIDES, playersLabel } from "../../games/gameMeta";

/**
 * 모든 게임 플레이 화면이 함께 쓰는 헤더 (U01).
 *
 * 왜 하나로 묶는가: 게임을 고른 뒤 나오는 화면의 머리 부분이 게임마다 달랐다.
 * 어떤 게임은 제목이 `title` 크기, 어떤 게임은 `label` 크기였고, 점수는 왼쪽·
 * 가운데·오른쪽·화면 한복판(NumberTap 의 `.nt-bar`)에 제각각 있었으며, 뒤로
 * 가는 길은 지구본에만 있었다. 아이가 게임을 바꿀 때마다 "어디를 봐야 점수가
 * 있고 어디를 눌러야 돌아가는지" 를 다시 배우게 만드는 구조다.
 *
 * 계약 (04 §2 '공통 부분' — 앱 전역에서 위치·형태·문구·복귀 방식 일치):
 *   왼쪽  = 뒤로 (aria-label="back", 최소 44px, 항상 같은 자리)
 *   가운데 = 게임 이름 (data-ux-role="title" — 화면에 하나뿐인 제목)
 *   오른쪽 = **그 게임의** 상태. 점수·남은 문제·시간처럼 게임마다 다른 값이
 *            들어오지만 자리와 생김새(칩)는 같다.
 *   아래  = 선택적 진행 막대 (progress)
 *
 * 규칙:
 *  - 색·간격·글자 크기는 전부 `var(--ux-*)` 토큰. 여기에 hex 나 px 글자 크기를
 *    다시 쓰지 말 것.
 *  - 조작은 전부 `data-ux-role="control"` — 최소 높이/폭을 토큰이 보장한다.
 *  - 상태 칩은 조작이 아니다. 누를 수 있는 것만 control 을 단다.
 */

export interface GameHeaderProps {
  /** 게임 이름. 가운데. 화면의 유일한 title 이므로 게임 안에 또 다른 title 을 두지 않는다. */
  title: string;
  /** 이름 앞 이모지(장식). 스크린리더에서는 감춘다. */
  icon?: string;
  /** 오른쪽 상태 영역. `<GameStat>` 을 나열하는 것을 기본으로 한다. */
  status?: ReactNode;
  /**
   * 뒤로 눌렀을 때. 그 게임 안에 이전 단계(준비·모드 선택)가 있으면 그걸 넘긴다.
   * 넘기지 않으면 게임 목록으로 나간다(useGameExit).
   */
  onBack?: () => void;
  /** 뒤로 버튼에 함께 보이는 짧은 글자. 아이콘만 있는 버튼은 만들지 않는다. */
  backLabel?: string;
  /** 헤더 아래 얇은 진행 막대. 라운드가 있는 게임만. */
  progress?: { value: number; max: number };
  /**
   * `GameRoom` 의 게임 id (`gameMeta.ts` 의 `GAME_GUIDES` 키). 넘기면 헤더에
   * '놀이 방법' 버튼이 생기고, 그 게임의 인원·예상 시간·한 문장 규칙·연습
   * 1문제를 헤더 아래 접이식 칸으로 보여준다.
   *
   * 왜 여기인가: 09 §1 이 요구하는 '한 판의 흐름'에는 20초 안팎의 규칙 안내와
   * 직접 해보는 연습 1문제가 들어 있고, 그 데이터(`GAME_GUIDES`)는 이미
   * 갖춰져 있었는데 **어느 화면에서도 그려지지 않았다**(검사 스크립트만 읽고
   * 있었다). 게임마다 따로 붙이면 또 게임마다 위치가 달라지므로, 21개 게임이
   * 이미 공유하는 이 헤더에 한 번만 둔다.
   */
  gameId?: string;
  /**
   * 준비/설명 화면이 아예 없어 바로 플레이로 들어가는 게임은 이 안내를 처음부터
   * 펼쳐 둔다(09: "아이가 읽기 전에 자동으로 화면을 넘기지 않는다"). 모달이
   * 아니라 헤더 아래 정상 흐름이라 판을 가리지 않고, 접으면 사라진다.
   */
  introOpen?: boolean;
}

/**
 * 어떤 게임의 안내를 이미 본 적 있는가. 기기 안에만 남는 값이라 아이가 다른
 * 기기에서 하면 다시 한 번 본다 — 그게 맞다(그 기기에서는 처음이다).
 * 저장이 막힌 환경(사파리 프라이빗 등)에서는 조용히 실패하고, 안내는 매번
 * 펼쳐진다. 못 적는 것이 화면을 멈출 이유는 아니다.
 */
const GUIDE_SEEN_KEY = "honey.game.guideSeen.v1";

function guideSeen(id?: string): boolean {
  if (!id || typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(GUIDE_SEEN_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(id);
  } catch { return false; }
}

function markGuideSeen(id?: string): void {
  if (!id || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(GUIDE_SEEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? list : [];
    if (next.includes(id)) return;
    next.push(id);
    window.localStorage.setItem(GUIDE_SEEN_KEY, JSON.stringify(next));
  } catch { /* 저장이 막힌 환경 — 화면은 그대로 동작한다 */ }
}

export default function GameHeader({
  title, icon, status, onBack, backLabel = "뒤로", progress, gameId, introOpen = false,
}: GameHeaderProps) {
  const exit = useGameExit();
  const handler = onBack ?? exit;
  const guide = gameId ? GAME_GUIDES[gameId] : undefined;

  /**
   * 안내는 **처음 들어온 아이에게만** 펼친다.
   *
   * introOpen 만 보고 펼치면 그 게임을 다섯 번 하는 아이가 다섯 번 다 같은
   * 설명을 만난다 — 폰에서 이 안내가 화면의 절반(844px 중 434px)을 차지해
   * 판이 아래로 밀린다. 한 번 본 게임은 기억해 두고 접힌 채로 시작한다.
   *
   * 처음 렌더는 항상 접힘으로 둔다. 서버에는 localStorage 가 없어 열린 채로
   * 그리면 하이드레이션이 어긋나고, 다시 온 아이(대부분)에게 펼쳤다 접히는
   * 흔들림이 생긴다. 처음인 아이만 마운트 뒤 한 번 펼친다.
   */
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    if (introOpen && guide && !guideSeen(gameId)) setHelpOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introOpen, gameId]);

  /** 접거나 "알겠어요" 를 누르면 본 것으로 친다. */
  const closeGuide = () => { setHelpOpen(false); markGuideSeen(gameId); };
  const pct = progress && progress.max > 0
    ? Math.max(0, Math.min(100, (progress.value / progress.max) * 100))
    : null;

  return (
    <header className="ugh" data-ux-surface="panel">
      <ScopedStyle css={GAME_HEADER_CSS} />
      <div className="ugh-row">
        {/* 왼쪽 묶음: 뒤로 + (있으면) 놀이 방법. 안내 버튼을 따로 한 줄에 두면
            헤더가 55px 더 높아져 지구본 캔버스가 623→536px 로 줄었다(실측).
            같은 줄에 붙여 판이 먹는 세로를 되돌린다. */}
        <div className="ugh-left">
          <button
            type="button"
            data-ux-role="control"
            className="ugh-back"
            aria-label="back"
            aria-disabled={handler ? undefined : true}
            onClick={() => handler?.()}
          >
            <span aria-hidden="true">←</span>
            <span className="ugh-backtext">{backLabel}</span>
          </button>
          {guide && (
            <button
              type="button"
              data-ux-role="control"
              className="ugh-help"
              aria-expanded={helpOpen}
              aria-controls="ugh-guide"
              onClick={() => { if (helpOpen) closeGuide(); else setHelpOpen(true); }}
            >
              <span aria-hidden="true">{helpOpen ? "▴" : "❓"}</span>
              <span className="ugh-helptext">{helpOpen ? "접기" : "놀이 방법"}</span>
            </button>
          )}
        </div>

        <h1 data-ux-role="title" className="ugh-title">
          {icon && <span aria-hidden="true" className="ugh-icon">{icon}</span>}
          <span className="ugh-titletext">{title}</span>
        </h1>

        <div className="ugh-status" role="status">{status}</div>
      </div>

      {pct !== null && (
        <div className="ugh-track" aria-hidden="true">
          <div className="ugh-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {guide && helpOpen && (
        <GameGuidePanel guide={guide} onClose={closeGuide} />
      )}
    </header>
  );
}

/**
 * 인원 · 예상 시간 · 한 문장 규칙 · 연습 1문제.
 * 연습은 **점수·진도와 무관하다** — 틀려도 다그치지 않고 한 줄만 덧붙인다
 * (09 §1: "20초는 분량의 목표이지 강제 타이머가 아니다").
 */
function GameGuidePanel({ guide, onClose }: {
  guide: (typeof GAME_GUIDES)[string];
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked !== null && picked === guide.practice.answerIndex;

  return (
    <section id="ugh-guide" className="ugh-guide" data-ux-surface>
      <p data-ux-role="body-emphasis" className="ugh-guide-rule">{guide.rule}</p>
      <div className="ugh-guide-meta">
        <span data-ux-role="secondary">🙋 {playersLabel(guide)}</span>
        <span data-ux-role="secondary">⏱ 약 {guide.minutes}분</span>
        <span data-ux-role="secondary">✏️ 연습은 점수에 들어가지 않아요</span>
      </div>

      <p data-ux-role="body" className="ugh-guide-q">{guide.practice.question}</p>
      <div className="ugh-guide-choices">
        {guide.practice.choices.map((c, i) => (
          <button
            key={i}
            type="button"
            data-ux-role="control"
            className="ugh-guide-choice"
            data-state={picked === null ? undefined : i === guide.practice.answerIndex ? "right" : picked === i ? "other" : undefined}
            aria-pressed={picked === i}
            onClick={() => setPicked(i)}
          >{c}</button>
        ))}
      </div>
      {picked !== null && (
        <p data-ux-role="body" className="ugh-guide-after" role="status">
          {correct ? "🎉 " : "🌱 "}{guide.practice.afterword}
        </p>
      )}

      <button type="button" data-ux-role="action" className="ugh-guide-start" onClick={onClose}>
        ▶ 알겠어요, 시작할래요
      </button>
    </section>
  );
}

/**
 * 헤더 오른쪽에 놓는 상태 한 칸. 게임마다 뜻이 달라도(점수·남은 카드·시간)
 * 생김새는 같아야 아이가 다시 배우지 않는다.
 */
export function GameStat({
  icon, label, value, tone = "plain",
}: {
  /** 이모지. 장식이므로 라벨을 대신하지 않는다. */
  icon?: string;
  /** 무엇의 값인지. 화면이 좁으면 감추고 aria-label 로만 남는다. */
  label: string;
  value: ReactNode;
  /** warn = 시간이 얼마 안 남은 것처럼 눈에 띄어야 하는 값. */
  tone?: "plain" | "key" | "warn";
}) {
  return (
    <span className="ugh-stat" data-tone={tone} aria-label={label}>
      {icon && <span aria-hidden="true">{icon}</span>}
      <span data-ux-role="secondary" className="ugh-statlabel" aria-hidden="true">{label}</span>
      <span data-ux-role="label" className="ugh-statvalue">{value}</span>
    </span>
  );
}

/* 글자 크기·색·간격은 전부 토큰. 여기에 hex 나 px 글자 크기를 쓰지 말 것. */
const GAME_HEADER_CSS = `
/* 게임마다 루트 padding 이 달라서 '화면 전체 폭 바' 로 만들면 게임별로 다르게
   보인다. 그래서 어느 루트에 들어가도 같아 보이는 둥근 패널 한 장으로 둔다. */
.ugh{
  display: grid; gap: var(--ux-space-2);
  padding: var(--ux-space-2) var(--ux-space-3);
  margin-bottom: var(--ux-space-3);
  background: var(--ux-surface);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel);
  /* 접힘 판단의 기준은 뷰포트가 아니라 **이 헤더가 실제로 받은 폭**이다.
     실측에서 드러난 문제: 게임마다 루트 max-width 가 달라(기억 카드 520px,
     금칙어 560px …) 1366px 화면에서도 헤더가 480px 밖에 안 되는 게임이 있었고,
     뷰포트 기준 미디어 쿼리는 그걸 '넓다'고 판단해 3칸을 유지했다. 그 결과
     가운데 제목 칸이 짜부라져 "숫자 빨리 누르기" 가 한 글자씩 세로로 쌓이고
     헤더 높이가 303px 까지 늘어났다. 컨테이너 쿼리로 바꾼다. */
  container-type: inline-size;
}
/* 3칸: 뒤로 | 이름 | 상태. 가운데 칸만 늘어나므로 이름은 언제나 같은 자리에 온다.
   좁아지면 상태가 아래 줄로 내려가고(뒤로/이름은 그대로), 그래도 제목 위치는
   흔들리지 않는다 — 게임을 바꿔도 같은 곳을 보게 하는 것이 이 헤더의 목적이다. */
.ugh-row{
  display: grid; align-items: center; gap: var(--ux-space-2);
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas: "back title status";
}
@container (max-width: 639px){
  .ugh-row{
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: "back title" "status status";
  }
  .ugh-status{ justify-content: flex-start; }
}

.ugh-left{
  grid-area: back; min-width: 0;
  display: flex; align-items: center; gap: var(--ux-space-2); flex-wrap: wrap;
}
.ugh-back[data-ux-role="control"]{
  display: inline-flex; align-items: center; justify-content: center; gap: var(--ux-space-1);
  background: var(--ux-surface); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800; white-space: nowrap;
  padding-left: var(--ux-space-3); padding-right: var(--ux-space-3);
}
.ugh-back[aria-disabled="true"]{ opacity: .45; cursor: default; }
/* 아이콘만 남기는 대신 글자를 유지한다 — 다만 아주 좁으면 글자만 감춘다.
   aria-label="back" 이 남으므로 보조기술에는 영향이 없다. */
@container (max-width: 399px){
  .ugh-backtext{ display: none; }
}

.ugh-title{
  grid-area: title; margin: 0; min-width: 0;
  display: flex; align-items: center; justify-content: center; gap: var(--ux-space-2);
  color: var(--ux-ink); font-weight: 900; text-align: center;
}
.ugh-icon{ line-height: 1; flex-shrink: 0; }
.ugh-titletext{ min-width: 0; overflow-wrap: break-word; word-break: keep-all; }

.ugh-status{
  grid-area: status; min-width: 0;
  display: flex; align-items: center; justify-content: flex-end;
  gap: var(--ux-space-2); flex-wrap: wrap;
}
.ugh-stat{
  display: inline-flex; align-items: center; gap: var(--ux-space-1);
  padding: var(--ux-space-1) var(--ux-space-3);
  border-radius: var(--ux-radius-pill);
  background: var(--ux-surface-sunk); color: var(--ux-ink);
  white-space: nowrap;
}
.ugh-stat[data-tone="key"]{ background: var(--ux-primary-fill); color: var(--ux-primary-ink); }
.ugh-stat[data-tone="warn"]{ background: var(--ux-hint-apricot); color: var(--ux-ink); }
.ugh-statlabel{ color: inherit; opacity: .75; }
.ugh-statvalue{ font-weight: 900; }
/* 좁으면 값만 남긴다 — 라벨은 aria-label 로 계속 전달된다. */
@container (max-width: 519px){
  .ugh-statlabel{ display: none; }
}

.ugh-help[data-ux-role="control"]{
  display: inline-flex; align-items: center; justify-content: center; gap: var(--ux-space-1);
  background: var(--ux-surface-sunk); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800; white-space: nowrap;
  padding-left: var(--ux-space-3); padding-right: var(--ux-space-3);
}
/* 아주 좁으면 '❓' 만 남긴다. 버튼 자체 크기는 토큰이 44px 이상으로 지킨다. */
@container (max-width: 399px){
  .ugh-helptext{ display: none; }
}
.ugh-guide{
  display: grid; gap: var(--ux-space-2);
  padding: var(--ux-space-3);
  background: var(--ux-surface-sunk);
  border: 2px dashed var(--ux-primary-border);
}
.ugh-guide p{ margin: 0; }
.ugh-guide-rule{ font-weight: 800; }
.ugh-guide-meta{ display: flex; flex-wrap: wrap; gap: var(--ux-space-3); }
.ugh-guide-q{ margin-top: var(--ux-space-1); }
.ugh-guide-choices{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); }
.ugh-guide-choice[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800;
}
.ugh-guide-choice[data-state="right"]{ background: var(--ux-hint-mint); border-color: var(--ux-success); }
/* 틀린 쪽은 빨갛게 물들이지 않는다 — 조용히 구분만 한다 (09 §5 오답 처리). */
.ugh-guide-choice[data-state="other"]{ background: var(--ux-surface-sunk); border-style: dashed; }
.ugh-guide-after{ color: var(--ux-ink); }
.ugh-guide-start[data-ux-role="action"]{
  justify-self: start;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 900;
}

.ugh-track{
  height: 10px; border-radius: var(--ux-radius-pill);
  background: var(--ux-surface-sunk); overflow: hidden;
}
.ugh-fill{
  height: 100%; background: var(--ux-primary-fill);
  border-right: 2px solid var(--ux-primary-border);
  transition: width var(--ux-motion-celebrate) var(--ux-motion-ease);
}
`;

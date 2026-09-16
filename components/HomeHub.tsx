"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { UserConfig } from "@/lib/types";
import { LANGUAGES } from "@/lib/constants";
import { t, tFmt } from "@/lib/i18n";
import { subscribeSession } from "@/lib/storybook";
import { subscribeWhiteboardMeta } from "@/lib/whiteboard";
import BeeBanner from "./BeeBanner";
import RoomManagePanel from "./RoomManagePanel";
import FontSizeButton from "./FontSizeButton";
import FlyingBees from "./ui/FlyingBees";
import ScopedStyle from "./ui/child/ScopedStyle";

/** 라우팅 계약 — 이 문자열은 app/[roomCode]/page.tsx 의 hubView 와 1:1 이다. 바꾸지 말 것. */
export type HubView = "board" | "whiteboard" | "games" | "dashboard" | "vocab" | "storybook";

/** 교사가 지금 열어 둔 수업. storybook 이 whiteboard 보다 우선(page.tsx 와 같은 순서). */
export type HubLiveActivity = { kind: "storybook" | "whiteboard" } | null;

interface ActivityMeta {
  /** onSelect 로 나가는 값 = hubView 문자열. 절대 변경 금지. */
  id: HubView;
  /** 아이가 할 일로 읽히는 이름 (README 5.2) */
  titleKey: string;
  /** 한 문장 설명 */
  descKey: string;
  mascot: string;
  tint: string;
  /**
   * 한때 '나의 꿀벌'(칭찬) 타일만 육각형으로 그렸다. 다섯 타일 중 하나만
   * 모양이 달라 그 타일만 튀어 보인다는 지적을 받아 원으로 되돌렸다
   * (사용자, 2026-09-13). 벌집 육각형은 브랜드 장식(.hub-hex)에만 남긴다.
   * 필드는 남겨 두되 아무도 쓰지 않는다 — 다시 켜려면 여기부터 보면 된다.
   */
  hex?: boolean;
}

/**
 * 5개 활동. 순서는 아이의 하루 흐름(말하기 → 읽기 → 배우기 → 내 것 보기 → 놀기)이고
 * 라우팅(id)은 종전 그대로다.
 */
const ACTIVITIES: ActivityMeta[] = [
  { id: "board", titleKey: "hubActBoard", descKey: "hubSectionBoardDesc", mascot: "/mascot/bee-cheer.png", tint: "var(--ux-hint-apricot)" },
  { id: "storybook", titleKey: "hubActStorybook", descKey: "hubSectionStorybookDesc", mascot: "/mascot/bee-welcome.png", tint: "var(--ux-hint-lavender)" },
  { id: "vocab", titleKey: "hubActVocab", descKey: "hubSectionVocabDesc", mascot: "/mascot/bee-book.png", tint: "var(--ux-hint-mint)" },
  { id: "dashboard", titleKey: "hubActBee", descKey: "hubSectionStickersDesc", mascot: "/mascot/bee-student.png", tint: "var(--ux-primary-fill)" },
  { id: "games", titleKey: "hubActGames", descKey: "hubSectionGamesDesc", mascot: "/mascot/bee-celebrate.png", tint: "var(--ux-surface-sunk)" },
];

/**
 * ⭐ 소통의 별 — 처음부터 이 교실의 얼굴이었던 구조다. 다섯 활동이 별 꼭짓점에
 * 하나씩 붙고 가운데에 '소통하는 우리' 가 있다. 카드 격자로 바꿨더니 읽기는
 * 편해졌지만 교실의 정체성이 사라졌다 — 그래서 구조는 되살리고, 라벨 크기와
 * 터치 영역만 토큰 계약에 맞춘다.
 *
 * 12시(-90°)부터 시계방향 72° 간격. ACTIVITIES 순서와 1:1 로 대응하므로
 * 활동을 더하거나 빼면 이 배열과 polygon 도 함께 바꿔야 한다.
 */
const STAR_ANGLES = [-90, -18, 54, 126, 198];
const STAR_CX = 50;
const STAR_CY = 52;
const STAR_R_OUTER = 38;
const STAR_R_INNER = STAR_R_OUTER * 0.382; // 정통 오각성 내경비

/** 오각성 실루엣 points (viewBox 100 기준) */
function starPolygonPoints(): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? STAR_R_OUTER : STAR_R_INNER;
    const ang = ((-90 + i * 36) * Math.PI) / 180;
    pts.push(`${(STAR_CX + r * Math.cos(ang)).toFixed(2)},${(STAR_CY + r * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** 꼭짓점 좌표(%) — 버튼 중심이 놓일 자리 */
const STAR_POINTS = STAR_ANGLES.map((deg) => {
  const ang = (deg * Math.PI) / 180;
  return {
    x: STAR_CX + STAR_R_OUTER * Math.cos(ang),
    y: STAR_CY + STAR_R_OUTER * Math.sin(ang),
  };
});

interface Props {
  user: UserConfig;
  roomCode: string;
  onSelect: (view: HubView) => void;
  onLogout: () => void;
  onChangeLang: (lang: string) => void;
  availableLangs: string[];
  /**
   * 테스트·fixture 전용 주입구. 넘기지 않으면 방 노드를 직접 구독해서 알아낸다.
   * fixture 는 반드시 값을 넘겨 Firebase 접속을 막는다(HARNESS 2).
   */
  liveActivity?: HubLiveActivity;
}

/**
 * 지금 열려 있는 수업을 읽는다. **읽기 전용** — 여기서 세션 경로에 쓰지 않는다.
 * bookId 없는 세션은 유령(정리 코드가 wipe 뒤 남긴 잔여 노드)이므로 활성으로 치지
 * 않는다. 이 판정은 app/[roomCode]/page.tsx 와 글자 그대로 같아야 한다 —
 * 한쪽만 느슨해지면 2026-07-13 방 1111 처럼 학생이 대기 화면에 갇힌다.
 */
function useLiveActivity(roomCode: string, enabled: boolean): HubLiveActivity {
  const [storybook, setStorybook] = useState(false);
  const [whiteboard, setWhiteboard] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const unsubs: Array<() => void> = [];
    try {
      unsubs.push(subscribeSession(roomCode, (session) => {
        setStorybook(!!session && !!session.bookId && session.phase !== "done");
      }));
      unsubs.push(subscribeWhiteboardMeta(roomCode, (meta) => setWhiteboard(!!meta.active)));
    } catch {
      /* 연결 설정이 없으면 '지금 함께할 활동' 칸만 비운다. 허브 자체는 계속 쓸 수 있어야 한다. */
    }
    return () => { for (const u of unsubs) { try { u(); } catch { /* 이미 해제됨 */ } } };
  }, [roomCode, enabled]);

  if (storybook) return { kind: "storybook" };
  if (whiteboard) return { kind: "whiteboard" };
  return null;
}

export default function HomeHub({
  user, roomCode, onSelect, onLogout, onChangeLang, availableLangs, liveActivity,
}: Props) {
  const lang = user.myLang;
  // 관리 패널은 기본 접힘 — 교사가 필요할 때 직접 펼친다 (자동 펼치기 안 함).
  const [manageOpen, setManageOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const qrCloseRef = useRef<HTMLButtonElement>(null);

  const injected = liveActivity !== undefined;
  const detected = useLiveActivity(roomCode, !injected);
  const live = injected ? liveActivity : detected;

  const joinUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${roomCode}`;
  const langs = availableLangs.length ? availableLangs : Object.keys(LANGUAGES);

  // 모달은 열리면 초점을 안으로 옮기고 Escape 로 닫힌다.
  useEffect(() => {
    if (!showQR) return;
    qrCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowQR(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showQR]);

  return (
    <div data-ux-root className="hub-root">
      <ScopedStyle css={HUB_CSS} />
      <div aria-hidden="true" className="hub-backdrop" />
      <FlyingBees />

      <div className="hub-shell">
        <BeeBanner />

        {/* 상단 설정 영역: 계정 · 언어 · 글자 크기를 한 곳에 모은다 */}
        <header data-tutorial-id="hub-header" className="hub-head" data-ux-surface="panel">
          <div className="hub-who">
            <img src="/mascot/bee-welcome.png" alt="" aria-hidden="true" className="hub-who-bee" />
            <div className="hub-who-text">
              <p data-ux-role="body-emphasis" className="hub-hello">
                {tFmt("hubGreeting", lang, { name: user.myName })}
              </p>
              <p className="hub-who-meta">
                <span data-ux-role="secondary" className="hub-chip">
                  <span aria-hidden>🚪</span> {t("roomBadge", lang)} {roomCode}
                </span>
                <span data-ux-role="secondary" className="hub-chip">
                  <span aria-hidden>{user.isTeacher ? "👩‍🏫" : "🎒"}</span>{" "}
                  {user.isTeacher ? t("roleTeacher", lang) : t("roleStudent", lang)}
                </span>
              </p>
            </div>
          </div>

          <div className="hub-settings" role="group" aria-label={t("hubSettingsLabel", lang)}>
            <span data-ux-role="secondary" className="hub-settings-label">{t("hubSettingsLabel", lang)}</span>
            <div className="hub-settings-row">
              {/* 아이콘만 있는 버튼을 두지 않는다 — 전부 글자 라벨이 붙는다. */}
              <button
                type="button"
                data-ux-role="control"
                className="hub-setting-btn"
                aria-expanded={langOpen}
                aria-controls="hub-lang-panel"
                onClick={() => setLangOpen((v) => !v)}
              >
                <span aria-hidden className="hub-setting-icon">{LANGUAGES[lang]?.flag || "🌐"}</span>
                <span className="hub-setting-text">{t("hubLangSetting", lang)}</span>
              </button>

              {/* 글자 크기·움직임 — 구현은 공용 TextSizeMenu 한 곳에만 있다. */}
              <FontSizeButton />

              {user.isTeacher && (
                <button
                  type="button"
                  data-ux-role="control"
                  className="hub-setting-btn"
                  onClick={() => setShowQR(true)}
                >
                  <span aria-hidden className="hub-setting-icon">📱</span>
                  <span className="hub-setting-text">{t("hubQrLabel", lang)}</span>
                </button>
              )}

              {/* 로그아웃은 실수하기 쉬운 아이콘 단독이 아니라 라벨 있는 항목이다. */}
              <button
                type="button"
                data-ux-role="control"
                className="hub-setting-btn"
                onClick={onLogout}
              >
                <span aria-hidden className="hub-setting-icon">⏻</span>
                <span className="hub-setting-text">{t("logoutLabel", lang)}</span>
              </button>
            </div>
          </div>

          {langOpen && (
            <div id="hub-lang-panel" className="hub-lang-panel" role="group" aria-label={t("hubLangSetting", lang)}>
              {langs.map((code) => {
                const info = LANGUAGES[code];
                if (!info) return null;
                const active = code === lang;
                return (
                  <button
                    key={code}
                    type="button"
                    data-ux-role="control"
                    className={active ? "hub-lang-choice on" : "hub-lang-choice"}
                    aria-pressed={active}
                    onClick={() => { onChangeLang(code); setLangOpen(false); }}
                  >
                    <span aria-hidden className="hub-setting-icon">{info.flag}</span>
                    {/* 언어는 자국어 이름으로 고른다. 국기는 보조 장식이다. */}
                    <span data-ux-role="label" lang={code} className="hub-lang-name">{info.label}</span>
                    <span aria-hidden className="hub-check">{active ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* 지금 함께할 활동 — 교사가 연 수업이 있을 때만 한 장 강조한다 */}
        {live && (
          <section className="hub-live" aria-label={t("hubNowTogether", lang)}>
            <p data-ux-role="secondary" className="hub-live-tag">
              <span aria-hidden>🔔</span> {t("hubNowTogether", lang)}
            </p>
            <button
              type="button"
              data-ux-role="action"
              className="hub-live-btn"
              onClick={() => onSelect(live.kind === "storybook" ? "storybook" : "whiteboard")}
            >
              <img
                src={live.kind === "storybook" ? "/mascot/bee-book.png" : "/mascot/bee-cheer.png"}
                alt="" aria-hidden="true" className="hub-live-bee"
              />
              <span className="hub-live-text">
                <span data-ux-role="body-emphasis" className="hub-live-title">
                  {t(live.kind === "storybook" ? "hubLiveStorybook" : "hubLiveWhiteboard", lang)}
                </span>
                <span data-ux-role="body" className="hub-live-sub">{t("hubJoinNow", lang)}</span>
              </span>
            </button>
          </section>
        )}

        {/* 오늘 무엇을 할까 */}
        <div className="hub-lead">
          {/* 벌집 육각형은 브랜드 장식으로만 남는다 — 탐색은 아래 큰 카드가 맡는다. */}
          <span aria-hidden="true" className="hub-comb">
            <span className="hub-hex" /><span className="hub-hex mid" /><span className="hub-hex" />
          </span>
          <h1 data-ux-role="title" className="hub-title">{t("hubToday", lang)}</h1>
          <p data-ux-role="body" className="hub-lead-sub">{t("hubPrompt", lang)}</p>
        </div>

        <nav className="hub-star" aria-label={t("hubToday", lang)}>
          <svg className="hub-star-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="hubStarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ux-surface)" />
                <stop offset="100%" stopColor="var(--ux-primary-fill)" />
              </linearGradient>
            </defs>
            <polygon
              points={starPolygonPoints()}
              fill="url(#hubStarGrad)"
              stroke="var(--ux-primary-border)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>

          <span className="hub-star-center" aria-hidden="true">소통하는<br />우리</span>

          {ACTIVITIES.map((a, i) => (
            <button
              key={a.id}
              type="button"
              data-tutorial-id={`hub-section-${a.id}`}
              data-ux-role="control"
              className="hub-point"
              style={{ left: `${STAR_POINTS[i].x}%`, top: `${STAR_POINTS[i].y}%` }}
              onClick={() => onSelect(a.id)}
            >
              <span className={a.hex ? "hub-point-icon hex" : "hub-point-icon"} style={{ background: a.tint }}>
                <img src={a.mascot} alt="" aria-hidden="true" className="hub-point-bee" />
              </span>
              {/* 아이콘만으로 안내하지 않는다 — 글자 라벨은 언제나 붙어 있다. */}
              <span data-ux-role="label" className="hub-point-label">{t(a.titleKey, lang)}</span>
            </button>
          ))}
        </nav>

        {/* 교사 도구는 아이의 일상 행동과 시각적으로 분리한다 */}
        {user.isTeacher && (
          <section className="hub-teacher" data-ux-surface="panel" aria-label={t("roleTeacher", lang)}>
            <p data-ux-role="secondary" className="hub-teacher-tag">
              <span aria-hidden>👩‍🏫</span> {t("roleTeacher", lang)}
            </p>

            <button
              type="button"
              data-ux-role="control"
              className="hub-teacher-btn"
              onClick={() => onSelect("whiteboard")}
            >
              <span aria-hidden className="hub-setting-icon">🖊</span>
              <span className="hub-teacher-btn-text">
                <span data-ux-role="label">{t("hubSectionWhiteboard", lang)}</span>
                <span data-ux-role="secondary">{t("hubWhiteboardHint", lang)}</span>
              </span>
            </button>

            <button
              type="button"
              data-ux-role="control"
              className="hub-teacher-btn"
              aria-expanded={manageOpen}
              aria-controls="hub-manage-panel"
              onClick={() => setManageOpen((v) => !v)}
            >
              <span aria-hidden className="hub-setting-icon">🛠</span>
              <span className="hub-teacher-btn-text">
                <span data-ux-role="label">{t("manage", lang)}</span>
                <span data-ux-role="secondary">{t("hubManageHint", lang)}</span>
              </span>
              <span aria-hidden className="hub-check">{manageOpen ? "▲" : "▼"}</span>
            </button>
            {manageOpen && (
              <div id="hub-manage-panel" className="hub-manage" data-ux-legacy>
                <RoomManagePanel roomCode={roomCode} lang={lang} />
              </div>
            )}
          </section>
        )}
      </div>

      {showQR && (
        <div className="hub-modal-veil" onClick={() => setShowQR(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hub-qr-title"
            className="hub-modal"
            data-ux-surface="panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="hub-qr-title" data-ux-role="body-emphasis" className="hub-modal-title">
              {t("hubQrTitle", lang)}
            </h2>
            <p data-ux-role="body" className="hub-modal-sub">{t("hubQrSub", lang)}</p>
            <span className="hub-qr-frame">
              <QRCodeSVG value={joinUrl} size={200} />
            </span>
            <p data-ux-role="secondary" className="hub-qr-url">{joinUrl}</p>
            <p data-ux-role="body-emphasis" className="hub-qr-code">
              <span aria-hidden>🚪</span> {roomCode}
            </p>
            <button
              ref={qrCloseRef}
              type="button"
              data-ux-role="action"
              className="hub-modal-close"
              onClick={() => setShowQR(false)}
            >{t("closeBtn", lang)}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* 허브 전용 규칙 ─────────────────────────────────────────────────
   크기는 전부 토큰이 정한다. 여기서 px 글자 크기를 새로 만들지 않는다.
   문서를 100vh 로 잠그지 않는다 — 큰 글씨/긴 번역에서 카드가 세로로 늘어나야 하고,
   그만큼 문서가 스크롤돼야 한다(README 5.2). */
const HUB_CSS = `
.hub-root{
  position: relative;
  min-height: 100svh;
  /* 튜토리얼 대화상자용 아래 여백은 body 에서 전역으로 준다(app/layout.tsx).
     여기서 또 주면 두 번 잡혀 빈 공간만 늘어난다. */
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-12);
  background: var(--ux-bg);
  display: flex; justify-content: center;
}
.hub-backdrop{
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: url('/landing/landing-bees.webp') center / cover no-repeat;
  opacity: .3;
}
.hub-shell{
  position: relative; z-index: 1; width: 100%; max-width: 1080px;
  display: grid; gap: var(--ux-space-6); align-content: start;
}

/* 상단 설정 영역 */
.hub-head{
  background: var(--ux-surface);
  border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-4);
  box-shadow: 0 8px 24px rgba(137,83,0,.12);
  display: grid; gap: var(--ux-space-4);
}
/* 넓은 화면에서는 인사와 설정을 한 줄에 좌·우로 놓는다.
   예전에는 카드가 1080px 인데 내용이 전부 왼쪽 280px 에 몰려 있고 오른쪽
   800px 이 빈 흰 여백이었다. 바로 아래 제목·활동 별은 가운데 정렬이라
   헤더만 왼쪽에 붙어 보였다. 세로도 200px 을 먹어 첫 화면을 눌렀다.
   좁은 화면은 기존처럼 위아래로 쌓는다. */
@media (min-width: 860px){
  .hub-head{
    grid-template-columns: auto minmax(0, max-content);
    justify-content: space-between;
    align-items: center;
    gap: var(--ux-space-6);
  }
  /* 가로 배치에서는 위쪽 점선 구분이 어색하다 — 세로 구분으로 바꾼다. */
  .hub-head .hub-settings{
    border-top: none; padding-top: 0;
    border-left: 2px dashed var(--ux-surface-sunk);
    padding-left: var(--ux-space-6);
    justify-items: end;
  }
  .hub-head .hub-settings-row{ justify-content: flex-end; }
}
.hub-who{ display: flex; align-items: center; gap: var(--ux-space-3); min-width: 0; }
.hub-who-bee{ width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; }
.hub-who-text{ min-width: 0; display: grid; gap: var(--ux-space-1); }
.hub-hello{ margin: 0; font-weight: 800; color: var(--ux-ink); word-break: keep-all; overflow-wrap: anywhere; }
.hub-who-meta{ margin: 0; display: flex; flex-wrap: wrap; gap: var(--ux-space-2); }
.hub-chip{
  display: inline-flex; align-items: center; gap: var(--ux-space-1);
  background: var(--ux-surface-sunk); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-pill); padding: var(--ux-space-1) var(--ux-space-3);
  color: var(--ux-ink); font-weight: 800;
}
.hub-settings{
  display: grid; gap: var(--ux-space-2);
  border-top: 2px dashed var(--ux-surface-sunk); padding-top: var(--ux-space-3);
}
.hub-settings-label{ font-weight: 800; }
.hub-settings-row{ display: flex; flex-wrap: wrap; gap: var(--ux-control-gap); }
.hub-setting-btn{
  display: inline-flex; align-items: center; gap: var(--ux-space-2);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 700;
}
.hub-setting-icon{ line-height: 1; flex-shrink: 0; }
.hub-setting-text{ white-space: normal; word-break: keep-all; }

.hub-lang-panel{ display: grid; grid-template-columns: 1fr; gap: var(--ux-space-2); }
@media (min-width: 600px){ .hub-lang-panel{ grid-template-columns: 1fr 1fr; } }
@media (min-width: 1024px){ .hub-lang-panel{ grid-template-columns: 1fr 1fr 1fr; } }
.hub-lang-choice{
  display: flex; align-items: center; gap: var(--ux-space-3); width: 100%;
  background: var(--ux-surface); color: var(--ux-ink); text-align: left;
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 700;
}
/* 선택은 색만으로 알리지 않는다 — aria-pressed + 체크 + 테두리를 함께 쓴다. */
.hub-lang-choice.on{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }
.hub-lang-name{ flex: 1; min-width: 0; font-weight: 800; word-break: keep-all; overflow-wrap: anywhere; }
.hub-check{ font-weight: 900; color: var(--ux-selected-border); flex-shrink: 0; }

/* 지금 함께할 활동 */
.hub-live{ display: grid; gap: var(--ux-space-2); }
.hub-live-tag{ margin: 0; font-weight: 800; color: var(--ux-ink); }
.hub-live-btn{
  width: 100%; display: flex; align-items: center; gap: var(--ux-space-4);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 3px solid var(--ux-primary-border); text-align: left;
  font-family: inherit; font-weight: 800;
}
/* 전역 [data-ux-role] 규칙이 layout 의 <style> 에서 더 뒤에 오기 때문에, 같은
   특정도(클래스 하나)로는 min-height 가 되돌려진다 — 속성까지 함께 걸어 이긴다.
   실측에서 카드가 105px 로 눌려 있던 원인이다. */
.hub-live-btn[data-ux-role="action"]{ min-height: 112px; }
.hub-live-bee{
  width: 56px; height: 56px; object-fit: contain; flex-shrink: 0;
  /* 노랑 위에 올리면 마스코트의 밝은 선이 사라진다 — 밝은 판을 한 겹 깔아 준다. */
  background: var(--ux-surface); border-radius: var(--ux-radius-surface); padding: var(--ux-space-1);
}
.hub-live-text{ display: grid; gap: var(--ux-space-1); min-width: 0; }
.hub-live-title{ font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }
.hub-live-sub{ color: var(--ux-primary-ink); word-break: keep-all; }

/* 제목 */
.hub-lead{ text-align: center; display: grid; gap: var(--ux-space-2); justify-items: center; }
.hub-comb{ display: flex; gap: 4px; align-items: flex-end; }
.hub-hex{
  width: 22px; height: 25.4px; display: block;
  background: var(--ux-primary-fill);
  /* clip-path 는 fractional px 를 그대로 받는다 — 반올림하면 변이 어긋난다. */
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}
.hub-hex.mid{ background: var(--ux-hint-apricot); }
.hub-title{ color: var(--ux-ink); font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }
.hub-lead-sub{ margin: 0; color: var(--ux-ink-soft); word-break: keep-all; }

/* 활동 카드: 360px 1열 / 600~1023px 2열 / 그 이상 3열 */
/* ── ⭐ 소통의 별 ────────────────────────────────────────────────────
   정사각 무대 위에 별 실루엣을 깔고, 다섯 활동을 꼭짓점에 하나씩 앉힌다.
   버튼은 '동그란 아이콘 + 글자 라벨' 한 덩어리이고 그 덩어리의 중심이
   꼭짓점이다. 아이콘만 두고 라벨을 빼지 말 것 — 아이는 그림만으로
   어디로 가는지 알 수 없다. */
.hub-star{
  position: relative;
  width: min(94vw, 620px);
  aspect-ratio: 1;
  margin: 0 auto;
}
.hub-star-art{ position: absolute; inset: 0; width: 100%; height: 100%; }
.hub-star-center{
  position: absolute; left: 50%; top: 52%;
  transform: translate(-50%, -50%);
  width: 34%; text-align: center; pointer-events: none;
  font-family: 'Jua', 'Noto Sans KR', sans-serif;
  font-size: var(--ux-font-title);
  line-height: var(--ux-lh-tight);
  color: var(--ux-primary-ink);
  word-break: keep-all;
}
.hub-point{
  position: absolute;
  transform: translate(-50%, -50%);
  width: 30%;
  display: flex; flex-direction: column; align-items: center;
  gap: var(--ux-space-1);
  background: transparent; border: 2px solid transparent;
  padding: var(--ux-space-1); cursor: pointer; font-family: inherit;
  z-index: 2;
}
/* 전역 [data-ux-role="control"] 이 뒤에 주입되므로 속성까지 걸어야 덮인다. */
.hub-point[data-ux-role="control"]{ min-height: 0; border-radius: var(--ux-radius-panel); }
.hub-point:hover .hub-point-icon,
.hub-point:focus-visible .hub-point-icon{ border-color: var(--ux-selected-border); }
.hub-point-icon{
  width: 100%; aspect-ratio: 1; border-radius: 50%;
  border: 3px solid var(--ux-primary-border);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 16px rgba(137,83,0,.18);
}
/* 벌집 육각형은 브랜드 장식과 칭찬 표시로만 남긴다. */
.hub-point-icon.hex{
  border-radius: 0;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  border: none;
  outline: 3px solid var(--ux-primary-border);
  outline-offset: -3px;
}
.hub-point-bee{ width: 62%; height: 62%; object-fit: contain; }
.hub-point-label{
  font-weight: 900; color: var(--ux-ink); text-align: center;
  line-height: var(--ux-lh-tight); word-break: keep-all; overflow-wrap: anywhere;
  text-shadow: 0 1px 0 var(--ux-surface), 0 0 6px var(--ux-surface);
}

.hub-grid{ display: grid; grid-template-columns: 1fr; gap: var(--ux-control-gap); }
@media (min-width: 600px){ .hub-grid{ grid-template-columns: 1fr 1fr; } }
@media (min-width: 1024px){ .hub-grid{ grid-template-columns: 1fr 1fr 1fr; } }
.hub-card{
  display: flex; align-items: center; gap: var(--ux-space-4); width: 100%;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  box-shadow: 0 4px 14px rgba(137,83,0,.10);
  text-align: left; font-family: inherit;
  transition: border-color var(--ux-motion-state) var(--ux-motion-ease);
}
/* 최소 높이만 정하고 실제 높이는 내용이 정한다 — 큰 글씨·긴 번역에서 자동으로 늘어난다. */
.hub-card[data-ux-role="control"]{ min-height: 112px; }
.hub-card:hover{ border-color: var(--ux-selected-border); }
.hub-card-icon{
  width: 56px; height: 56px; flex-shrink: 0;
  border-radius: var(--ux-radius-surface);
  display: inline-flex; align-items: center; justify-content: center;
}
/* 육각형은 칭찬(나의 꿀벌) 한 곳에만 — 벌집을 탐색 수단으로 되돌리지 않는다. */
.hub-card-icon.hex{
  border-radius: 0;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}
.hub-card-bee{ width: 44px; height: 44px; object-fit: contain; }
.hub-card-text{ display: grid; gap: var(--ux-space-1); min-width: 0; }
.hub-card-title{ font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }
.hub-card-desc{ color: var(--ux-ink-soft); word-break: keep-all; overflow-wrap: anywhere; }

/* 교사 도구 */
.hub-teacher{
  background: var(--ux-surface); border: 2px dashed var(--ux-ink-soft);
  border-radius: var(--ux-radius-panel); padding: var(--ux-space-4);
  display: grid; gap: var(--ux-space-3);
}
.hub-teacher-tag{ margin: 0; font-weight: 800; }
.hub-teacher-btn{
  display: flex; align-items: center; gap: var(--ux-space-3); width: 100%;
  background: var(--ux-surface); color: var(--ux-ink); text-align: left;
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 700;
}
.hub-teacher-btn-text{ display: grid; gap: 2px; min-width: 0; flex: 1; word-break: keep-all; }
.hub-manage{ border-top: 2px solid var(--ux-surface-sunk); padding-top: var(--ux-space-3); }

/* QR 모달 */
.hub-modal-veil{
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(41,37,31,.62);
  display: flex; align-items: center; justify-content: center;
  padding: var(--ux-space-4); overflow-y: auto;
}
.hub-modal{
  background: var(--ux-surface); border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-6); max-width: 420px; width: 100%; text-align: center;
  display: grid; gap: var(--ux-space-3); justify-items: center;
}
.hub-modal-title{ margin: 0; font-weight: 900; color: var(--ux-ink); }
.hub-modal-sub{ margin: 0; color: var(--ux-ink-soft); word-break: keep-all; }
.hub-qr-frame{
  display: inline-flex; padding: var(--ux-space-3);
  border-radius: var(--ux-radius-surface); background: var(--ux-surface);
  border: 3px solid var(--ux-primary-border);
}
.hub-qr-url{ margin: 0; word-break: break-all; }
.hub-qr-code{ margin: 0; font-weight: 900; letter-spacing: .12em; color: var(--ux-ink); }
.hub-modal-close{
  width: 100%; font-family: inherit; font-weight: 900;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
}
`;

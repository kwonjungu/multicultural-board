/**
 * 아동 친화 개편 공통 디자인 토큰 — 작업 A.
 *
 * 값의 단일 소스는 `tokens.json` 이다. 이 파일은 그 값을 (1) 타입 있는 상수와
 * (2) 루트에 한 번 주입할 CSS 문자열로 바꾸기만 한다. 검증 스크립트
 * `scripts/test-child-ux-tokens.mjs` 도 같은 JSON 을 읽으므로 여기서 값을
 * 재선언하면 드리프트가 생긴다 — 절대 하지 말 것.
 *
 * 설계 근거: docs/child-ux-20260911/README.md §4.
 */
import raw from "./tokens.json";

export type TextSize = "basic" | "large";
/** 적용된 모션 상태. 사용자 설정 자체는 settings.ts 의 MotionPref("system" 포함). */
export type AppliedMotion = "full" | "reduced";
/** playful = 1~3학년 기본, calm = 4~6학년 '차분하게'. 학년/국적으로 자동 추론하지 않는다. */
export type ToneMode = "playful" | "calm";

type ScaledEntry = { basic: string; large: string; role?: string };

const tokens = raw as unknown as {
  meta: { spec: string; version: number; note: string };
  palette: Record<string, string>;
  typography: Record<string, ScaledEntry>;
  lineHeight: Record<string, ScaledEntry>;
  controls: Record<string, ScaledEntry>;
  spacing: Record<string, string>;
  radius: Record<string, string>;
  motion: Record<string, string>;
  textSizes: TextSize[];
  legacyZoom: Record<TextSize, number>;
  contrastPairs: { id: string; fg: string; bg: string; min: number; note?: string }[];
};

export const CHILD_UX = tokens;
export const TEXT_SIZES = tokens.textSizes;

/** CSS 변수 이름. 문자열을 컴포넌트마다 다시 쓰지 말고 이 헬퍼를 통한다. */
export const ux = {
  color: (k: keyof typeof tokens.palette & string) => `var(--ux-${k})`,
  font: (k: string) => `var(--ux-font-${k})`,
  lh: (k: string) => `var(--ux-lh-${k})`,
  control: (k: string) => `var(--ux-${k})`,
  space: (k: keyof typeof tokens.spacing & string) => `var(--ux-space-${k})`,
  radius: (k: keyof typeof tokens.radius & string) => `var(--ux-radius-${k})`,
  motion: (k: keyof typeof tokens.motion & string) => `var(--ux-motion-${k})`,
} as const;

function block(size: TextSize): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(tokens.typography)) lines.push(`--ux-font-${k}:${v[size]};`);
  for (const [k, v] of Object.entries(tokens.lineHeight)) lines.push(`--ux-lh-${k}:${v[size]};`);
  for (const [k, v] of Object.entries(tokens.controls)) lines.push(`--ux-${k}:${v[size]};`);
  lines.push(`--ux-legacy-zoom:${tokens.legacyZoom[size]};`);
  return lines.join("");
}

/**
 * 루트 토큰 + 전역 규칙. layout.tsx 에서 한 번만 주입한다.
 *
 * 글자 크기는 루트 글꼴을 건드리거나 문서 전체 zoom / transform:scale 로 키우지
 * 않는다. `data-ux-text="large"` 가 토큰 값 자체를 갈아끼우는 단일 경로다.
 * 아직 토큰으로 옮기지 않은 화면(교사 도구·단어장·그림책 등)만
 * `data-ux-legacy` 를 달아 기존 zoom 동작을 유지하며, 두 경로는 겹치지 않는다.
 */
export function childUxCss(): string {
  const palette = Object.entries(tokens.palette).map(([k, v]) => `--ux-${k}:${v};`).join("");
  const spacing = Object.entries(tokens.spacing).map(([k, v]) => `--ux-space-${k}:${v};`).join("");
  const radius = Object.entries(tokens.radius).map(([k, v]) => `--ux-radius-${k}:${v};`).join("");
  const motion = Object.entries(tokens.motion).map(([k, v]) => `--ux-motion-${k}:${v};`).join("");

  return `
:root{${palette}${spacing}${radius}${motion}${block("basic")}}
:root[data-ux-text="large"]{${block("large")}}

/* ── 과도기 폴백 ─────────────────────────────────────────────────
   아직 인라인 px 로 그려진 화면(단어장·그림책·화이트보드·교사 도구)에서도
   '크게' 가 종전처럼 동작해야 한다. 그래서 큰 글씨일 때만 body 에 zoom 을
   건다. 토큰으로 옮긴 화면은 최상위 요소에 data-ux-root 를 달아 이 배율을
   정확히 되돌리고(1.25 x 0.8 = 1), 커진 토큰 값만 적용받는다 — 이게 이중
   배율을 막는 유일한 경로다. 모든 화면 이행이 끝나면 이 블록을 지운다.
   중첩 data-ux-root 는 배율을 두 번 되돌리므로 화면당 하나만 둔다. */
:root[data-ux-text="large"] body{ zoom: var(--ux-legacy-zoom); }
:root[data-ux-text="large"] [data-ux-root]:not([data-ux-root] *){ zoom: calc(1 / var(--ux-legacy-zoom)); }
[data-ux-legacy]{ zoom: var(--ux-legacy-zoom, 1); }

/* ── 넓은 화면 밀도 ───────────────────────────────────────────────────
   20~24px 본문과 56px 조작 영역은 손가락으로 휴대폰을 쓰는 아이 기준이다.
   마우스를 쓰는 데스크톱에서 그대로 두면 화면이 '세로로 늘린 휴대폰' 이
   되어 한 번에 보이는 내용이 너무 적다. 1024px 이상에서는 한 단계 줄인다.
   '큰 글씨' 를 고른 사용자에게는 적용하지 않는다 — 크게 보려고 고른 설정을
   화면 폭이 되돌리면 안 된다. */
@media (min-width: 1024px){
  :root:not([data-ux-text="large"]){
    --ux-font-body: 1.0625rem;
    --ux-font-body-emphasis: 1.25rem;
    --ux-font-label: 1rem;
    --ux-font-secondary: .9375rem;
    --ux-control-min: 44px;
    --ux-action-min: 52px;
  }
}

/* 아이 조작 영역: 글이 길면 가로가 아니라 세로로 늘어난다. */
[data-ux-role="control"]{
  min-height: var(--ux-control-min);
  min-width: var(--ux-control-min);
  font-size: var(--ux-font-label);
  line-height: var(--ux-lh-tight);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3) var(--ux-space-4);
  cursor: pointer;
}
[data-ux-role="action"]{
  min-height: var(--ux-action-min);
  font-size: var(--ux-font-body-emphasis);
  line-height: var(--ux-lh-tight);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3) var(--ux-space-6);
  cursor: pointer;
}
[data-ux-role="body"]{ font-size: var(--ux-font-body); line-height: var(--ux-lh-reading); }
[data-ux-role="body-emphasis"]{ font-size: var(--ux-font-body-emphasis); line-height: var(--ux-lh-reading); }
[data-ux-role="label"]{ font-size: var(--ux-font-label); line-height: var(--ux-lh-tight); }
[data-ux-role="secondary"]{ font-size: var(--ux-font-secondary); line-height: var(--ux-lh-tight); color: var(--ux-ink-soft); }
[data-ux-role="title"]{ font-size: var(--ux-font-title); line-height: var(--ux-lh-tight); }

[data-ux-surface]{ background: var(--ux-surface); border-radius: var(--ux-radius-surface); }
[data-ux-surface="panel"]{ border-radius: var(--ux-radius-panel); }

/* 읽기 영역은 42ch 를 넘기지 않는다 (README §6.2). */
[data-ux-reading]{ max-width: 42ch; }

:where([data-ux-root]) *:focus-visible{
  outline: 3px solid var(--ux-focus);
  outline-offset: 2px;
  border-radius: 6px;
}

[data-ux-motion="reduced"], [data-ux-motion="reduced"] *{
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 1ms !important;
  scroll-behavior: auto !important;
}
@media (prefers-reduced-motion: reduce){
  :root:not([data-ux-motion="full"]) *{
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}

/* ── 집중 모드 (X19) ──────────────────────────────────────────────────
   '움직임 줄이기' 는 모든 모션을 1ms 로 눌러 전환까지 끊는다. 집중 모드는
   목적이 다르다 — **기능은 그대로 두고 장식만 잠재운다**. 배경 벌의 비행,
   오라, 보상 반짝임처럼 계속 도는 장식이 대상이고, 누르면 반응하는 전환이나
   '인식 중' 같은 진행 표시는 건드리지 않는다.

   선택 기준은 '보조기술에 감춰진 것' = 순수 장식이다. 화면 전체에 걸어
   회전 스피너까지 멈추면 아이가 기다려야 하는지 알 수 없게 된다 — 그래서
   진행 표시에는 [data-ux-keep-motion] 으로 빠져나갈 길을 둔다.
   장식 레이어를 직접 표시하려면 [data-ux-decor] 를 단다. */
:root[data-ux-focus="on"] [aria-hidden="true"]:not([data-ux-keep-motion]),
:root[data-ux-focus="on"] [aria-hidden="true"]:not([data-ux-keep-motion]) *,
:root[data-ux-focus="on"] [data-ux-decor]:not([data-ux-keep-motion]),
:root[data-ux-focus="on"] [data-ux-decor]:not([data-ux-keep-motion]) *{
  animation: none !important;
}
/* 배경 장식은 남기되 뒤로 물린다 — 지우면 화면 구조가 바뀐다. */
:root[data-ux-focus="on"] [data-ux-decor="background"]{ opacity: .18 !important; }
/* 먼저 말을 거는 팝업(튜터 인사·보상 축하 자동 표시)만 막는다.
   아이가 직접 누르면 열리는 경로는 그대로다 — 기능을 없애지 않는다. */
:root[data-ux-focus="on"] [data-ux-autopopup]{ display: none !important; }`;
}

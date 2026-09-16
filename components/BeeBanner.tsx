"use client";

import { useEffect, useRef } from "react";
import ScopedStyle from "./ui/child/ScopedStyle";

const BANNER_TEXT = "AI 꿀비와 함께하는 즐거운 소통 공간";

/**
 * "🐝 AI 꿀비와 함께하는 즐거운 소통 공간" — 앱의 이름표.
 *
 * **화면 맨 위에 상시로 떠 있는다(always-on-top).** 예전에는 입장·설정·허브
 * 세 화면에만 흘러가는 요소로 붙어 있어서, 아이가 소통창·게임·단어·그림책
 * 같은 세부 공간으로 들어가는 순간 사라졌다. 이제 방 안에서는 어떤 활동을
 * 하고 있든 이 띠가 화면 위에 남는다 — 라우트마다 한 번만 올린다
 * (app/page.tsx · app/[roomCode]/page.tsx).
 *
 * 가려서 못 누르는 일이 없도록 두 가지를 지킨다:
 *  1. 띠 전체가 `pointer-events: none` 이라 탭·클릭을 절대 삼키지 않는다.
 *  2. 자기 높이를 문서 루트의 `--bee-banner-h` 로 알려서, html 이 그만큼
 *     위쪽 여백을 확보한다(app/layout.tsx). 흐름 안의 내용은 안 가려진다.
 *
 * 크기는 토큰이 정한다. 화면 폭으로만 크기를 정하면 '큰 글씨' 설정을 켜도
 * 배너만 그대로였다(본문은 커지는데 제목은 안 커지는 역전). title 토큰에
 * 배수를 곱해 두 축(큰 글씨·화면 폭)을 한 번에 따라가게 한다.
 */
export default function BeeBanner() {
  const barRef = useRef<HTMLDivElement>(null);

  /**
   * position:fixed 라 흐름에서 빠져 있다. 그대로 두면 아래 깔린 화면의 첫 줄
   * (뒤로가기 버튼·제목)을 덮는다. 떠 있는 동안 문서 루트에 --bee-banner-h 를
   * 심어 html 이 위쪽 여백을 확보하게 한다 — 튜토리얼 대화상자가 아래쪽에서
   * 쓰는 --tutorial-dialogue-h 와 같은 방식이다.
   */
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const h = barRef.current?.getBoundingClientRect().height ?? 0;
      if (h > 0) root.style.setProperty("--bee-banner-h", `${Math.round(h)}px`);
    };
    apply();
    const el = barRef.current;
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(apply) : null;
    if (ro && el) ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--bee-banner-h");
    };
  }, []);

  return (
    // data-ux-root: '큰 글씨' 의 body zoom 을 여기서 되돌린다. 커지는 경로는
    // 토큰 하나뿐이어야 배수가 두 번 걸리지 않는다(lib/childUx/tokens.ts 주석).
    <div data-ux-root ref={barRef} className="bee-banner">
      <ScopedStyle css={BANNER_CSS} />
      <p className="bee-banner-pill">
        <span className="bee-banner-sr">{`🐝 ${BANNER_TEXT}`}</span>
        <span aria-hidden="true" className="bee-banner-emoji">🐝</span>
        <span aria-hidden="true" className="bee-banner-text">
          {/* 글자마다 색을 돌린다 — '알록달록'. 여섯 색 모두 크림 배경 위에서
              4.5:1 을 넘는 진한 색이라 색이 늘어도 대비는 지켜진다.
              (예전의 그라디언트 클리핑은 글자 가운데가 흐려져 읽기 어려웠다.) */}
          {Array.from(BANNER_TEXT).map((ch, i) =>
            ch === " " ? (
              <span key={i}>&nbsp;</span>
            ) : (
              <span key={i} className={`bee-banner-ch c${i % 6}`}>{ch}</span>
            ),
          )}
        </span>
      </p>
    </div>
  );
}

const BANNER_CSS = `
.bee-banner{
  position: fixed;
  inset-block-start: 0;
  inset-inline: 0;
  display: flex;
  justify-content: center;
  /* 노치·둥근 모서리 기기에서 잘리지 않게 */
  padding: max(var(--ux-space-2), env(safe-area-inset-top)) var(--ux-space-3) var(--ux-space-2);
  /* 앱 안의 어떤 레이어(모달 10002, 튜토리얼 9999)보다 위 — 활동 중에도 보인다 */
  z-index: 100000;
  /* 절대 탭을 삼키지 않는다. 아래 버튼은 그대로 눌린다. */
  pointer-events: none;
}
.bee-banner-pill{
  margin: 0;
  max-width: min(100%, 60rem);
  padding: var(--ux-space-2) var(--ux-space-6);
  text-align: center;
  border-radius: var(--ux-radius-pill, 999px);
  border: 3px solid #F6C453;
  background: linear-gradient(180deg, #FFFDF7 0%, #FFF3D6 100%);
  box-shadow: 0 8px 22px rgba(180, 83, 9, .22), inset 0 1px 0 #FFF;
  font-family: 'Jua', 'Noto Sans KR', sans-serif;
  /* Jua 는 단일 굵기 디스플레이 폰트 — 굵기를 올려도 가짜 볼드가 될 뿐이다. */
  font-weight: 400;
  line-height: var(--ux-lh-tight);
  /* 제목 토큰의 1.3배. '큰 글씨'·화면 폭을 토큰이 이미 반영하므로
     여기서 vw 를 다시 쓰지 않는다. */
  font-size: calc(var(--ux-font-title) * 1.3);
  /* 어절 단위로만 끊는다. anywhere 로 두면 '소통' 이 '소/통' 으로 쪼개진다
     — 실제로 360px 에서 그랬다(tokens.ts 의 같은 주석 참고). */
  word-break: keep-all;
  overflow-wrap: break-word;
}
.bee-banner-emoji{ margin-inline-end: var(--ux-space-2); }
.bee-banner-ch.c0{ color:#C2410C; }
.bee-banner-ch.c1{ color:#BE185D; }
.bee-banner-ch.c2{ color:#6D28D9; }
.bee-banner-ch.c3{ color:#1D4ED8; }
.bee-banner-ch.c4{ color:#15803D; }
.bee-banner-ch.c5{ color:#B45309; }

[data-theme="dark"] .bee-banner-pill{
  border-color:#4C3A7A;
  background: linear-gradient(180deg, #2A2148 0%, #1D1735 100%);
  box-shadow: 0 8px 22px rgba(0,0,0,.45);
}
[data-theme="dark"] .bee-banner-ch.c0{ color:#FDBA74; }
[data-theme="dark"] .bee-banner-ch.c1{ color:#F9A8D4; }
[data-theme="dark"] .bee-banner-ch.c2{ color:#C4B5FD; }
[data-theme="dark"] .bee-banner-ch.c3{ color:#93C5FD; }
[data-theme="dark"] .bee-banner-ch.c4{ color:#86EFAC; }
[data-theme="dark"] .bee-banner-ch.c5{ color:#FCD34D; }

/* 휴대폰 세로에서는 두 줄이 화면을 먹는다 — 배수를 낮춰 한 줄에 가깝게 */
@media (max-width: 480px){
  .bee-banner-pill{
    font-size: calc(var(--ux-font-title) * 0.95);
    padding: var(--ux-space-1) var(--ux-space-4);
    border-width: 2px;
  }
}

/* 꿀비만 살짝 흔들린다. aria-hidden 이라 '집중 모드' 가 자동으로 멈춘다. */
.bee-banner-emoji{ display: inline-block; animation: beeBannerWiggle 3.6s var(--ux-motion-ease, ease-in-out) infinite; }
@keyframes beeBannerWiggle{
  0%, 100% { transform: rotate(-6deg); }
  50%      { transform: rotate(8deg) translateY(-2px); }
}

.bee-banner-sr{
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
`;

"use client";

import ScopedStyle from "./ui/child/ScopedStyle";

/**
 * "🐝 AI 꿀비와 함께하는 즐거운 소통 공간" — 브랜드 배너.
 * 메인 입장(app/page.tsx) · 방별 입장(SetupScreen) · 허브(HomeHub) 맨 위에 붙는다.
 *
 * 크기는 토큰이 정한다. 예전에는 `clamp(22px, 5vw, 34px)` 처럼 화면 폭으로만
 * 크기를 정해서, '큰 글씨' 설정을 켜도 배너만 그대로였다(본문은 커지는데 제목은
 * 안 커지는 역전). 이제 compact 는 body-emphasis, 전체판은 title 토큰을 쓴다.
 */
export default function BeeBanner({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "bee-banner compact" : "bee-banner"}>
      <ScopedStyle css={BANNER_CSS} />
      <p className="bee-banner-line" data-ux-role={compact ? "body-emphasis" : "title"}>
        {/* 이모지는 그라데이션 클리핑 밖에 둬야 색이 유지된다 */}
        <span aria-hidden="true" className="bee-banner-emoji">🐝</span>
        <span className="bee-banner-text">AI 꿀비와 함께하는 즐거운 소통 공간</span>
      </p>
    </div>
  );
}

const BANNER_CSS = `
.bee-banner{
  text-align: center;
  padding: var(--ux-space-1) var(--ux-space-2) var(--ux-space-4);
  position: relative;
  z-index: 1;
  width: 100%;
}
.bee-banner.compact{ padding-bottom: var(--ux-space-3); }
.bee-banner-line{
  margin: 0;
  font-family: 'Jua', 'Noto Sans KR', sans-serif;
  /* Jua 는 단일 굵기 디스플레이 폰트 — 굵기를 올려도 가짜 볼드가 될 뿐이다. */
  font-weight: 400;
  line-height: var(--ux-lh-tight);
  /* 어절은 지키되, 좁은 화면에서 한 어절이 넘치면 그 안에서라도 접는다. */
  word-break: keep-all;
  overflow-wrap: anywhere;
}
.bee-banner-emoji{ margin-inline-end: var(--ux-space-2); }
.bee-banner-text{
  background: linear-gradient(90deg, #F59E0B 0%, #FB7185 22%, #A78BFA 45%, #60A5FA 65%, #34D399 85%, #F59E0B 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  /* background-clip 미지원 브라우저 폴백 — 크림 배경 위 4.5:1 을 만족하는 갈색 */
  color: #8A4B00;
}
`;

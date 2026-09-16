"use client";

import ScopedStyle from "./ui/child/ScopedStyle";

/**
 * "🐝 AI 꿀비와 함께하는 즐거운 소통 공간" — 앱의 이름표.
 *
 * 화면 맨 위에 흐름대로 놓인다. **고정(position:fixed)하지 않는다** — 스크롤을
 * 내리면 같이 올라가 사라져야 한다. 한동안 상시 고정으로 띄워 봤지만, 첫 화면
 * 이름표가 활동 중에도 계속 따라다니면 정작 아이가 볼 내용을 가린다.
 * 메인 입장(app/page.tsx) · 방별 입장(SetupScreen) · 허브(HomeHub) 맨 위에 붙는다.
 *
 * 크기는 토큰이 정한다. 화면 폭으로만 크기를 정하면 '큰 글씨' 설정을 켜도
 * 배너만 그대로였다(본문은 커지는데 제목은 안 커지는 역전). title 토큰에
 * 배수를 곱해 두 축(큰 글씨·화면 폭)을 한 번에 따라가게 한다.
 */
export default function BeeBanner() {
  return (
    <div className="bee-banner">
      <ScopedStyle css={BANNER_CSS} />
      <p data-ux-role="title" className="bee-banner-line">
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
.bee-banner-line{
  margin: 0;
  font-family: 'Jua', 'Noto Sans KR', sans-serif;
  /* Jua 는 단일 굵기 디스플레이 폰트 — 굵기를 올려도 가짜 볼드가 될 뿐이다. */
  font-weight: 400;
  line-height: var(--ux-lh-tight);
  /* 어절 단위로만 끊는다. anywhere 로 두면 '소통' 이 '소/통' 으로 쪼개진다
     — 실제로 360px 에서 그랬다(tokens.ts 의 같은 주석 참고). */
  word-break: keep-all;
  overflow-wrap: break-word;
}
/* 제목 토큰의 1.3배. '큰 글씨'·화면 폭을 토큰이 이미 반영하므로 여기서 vw 를
   다시 쓰지 않는다. 선택자를 두 겹으로 쓰는 이유: [data-ux-role="title"] 의
   font-size 규칙은 layout.tsx 가 body 끝에 주입하므로, 같은 명시도(0,1,0)면
   그쪽이 이긴다. 클래스 두 개(0,2,0)로 올려야 이 배수가 실제로 먹는다. */
.bee-banner .bee-banner-line{ font-size: calc(var(--ux-font-title) * 1.3); }
.bee-banner-emoji{ margin-inline-end: var(--ux-space-2); }
/* 앱의 꿀색 팔레트 안에서만 도는 그라데이션. 예전 여섯 색 무지개는 글자마다
   색이 튀어 읽기 어려웠고 앱 톤과도 따로 놀았다 — 주황·호박·갈색 사이를
   오가게 해서 '알록달록' 은 남기고 톤은 지킨다. 다섯 정지점 모두 크림 배경
   위에서 4.5:1 을 넘는 진한 색이라 어디를 잘라 읽어도 대비가 유지된다. */
.bee-banner-text{
  background-image: linear-gradient(100deg,
    #C2410C 0%, #B45309 26%, #92400E 50%, #A16207 74%, #C2410C 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
/* 어두운 테마에서는 같은 순서의 밝은 꿀색으로 뒤집는다. */
[data-theme="dark"] .bee-banner-text{
  background-image: linear-gradient(100deg,
    #FDBA74 0%, #FCD34D 26%, #FDE68A 50%, #FBBF24 74%, #FDBA74 100%);
}
/* 휴대폰 세로에서는 두 줄이 화면을 먹는다 — 배수를 낮춰 한 줄에 가깝게 */
@media (max-width: 480px){
  .bee-banner .bee-banner-line{ font-size: calc(var(--ux-font-title) * 0.95); }
}
`;

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "🐝 꿀벌 소통창",
  description: "꿀벌 소통창 — 전 세계 친구들과 자동 번역으로 실시간 소통해요",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&family=Jua&display=swap"
          rel="stylesheet"
        />
        {/* 1~2학년 친화: 둥근 고딕 본문 (Pretendard, OFL). Noto 는 폴백 유지 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendard-variable.css"
        />
      </head>
      <body style={{
        margin: 0, padding: 0,
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
        lineHeight: 1.6,
        letterSpacing: "0.02em",
        color: "var(--ink)",
        background: "var(--bg)",
        WebkitFontSmoothing: "antialiased" as const,
      }}>
        {children}
        <style>{`
          /* ── 1~2학년 친화판 디자인 토큰 (단일 소스) ── */
          :root{
            --bg:#FFFBEB; --surface:#FFFFFF; --ink:#2B2A33; --ink-soft:#5B5566;
            --honey-fill:#F59E0B; --honey-text:#B45309;
            --accent-fill:#FB6E3A; --accent-text:#C2410C;
            --c-board:#F59E0B; --c-interp:#3B82F6; --c-games:#FB7185;
            --c-hive:#22C55E; --c-vocab:#8B5CF6; --c-story:#FB923C;
            --ok-text:#15803D; --ok-fill:#22C55E; --error-text:#B91C1C;
            --tap-min:56px; --tap-cta:72px; --gap:24px; --pad:16px;
            --radius:24px; --radius-pill:999px; --lh:1.6;
            --shadow:0 6px 18px rgba(180,83,9,.16);
            --ease:cubic-bezier(.22,.61,.36,1); --dur:240ms;
            --z-nav:100; --z-sheet:300; --z-toast:500;
          }
          [data-theme="dark"]{ --bg:#141026; --surface:#221A3D; --ink:#F4ECFF; --ink-soft:#C9B8E8; }

          *, *::before, *::after { box-sizing: border-box; }
          body { color: var(--ink); }
          button, input, textarea, select { font-family: inherit; }
          *:focus-visible { outline: 3px solid var(--accent-text); outline-offset: 2px; border-radius: 4px; }

          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-6px); }
            40%, 80% { transform: translateX(6px); }
          }

          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes slideUp {
            from { transform: translateY(60px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
          @keyframes fadeSlideIn {
            from { transform: translateY(16px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.5; }
          }
          @keyframes heroBeeFloat {
            0%, 100% { transform: translateY(0) rotate(-2deg); }
            50%      { transform: translateY(-8px) rotate(3deg); }
          }
          @keyframes likeBump {
            0%, 100% { transform: scale(1); }
            30%      { transform: scale(1.18); }
            60%      { transform: scale(0.96); }
          }

          /* Tutorial / BeeGuide */
          @keyframes beeGuideIdle {
            0%, 100% { transform: translateY(0) rotate(-2deg); }
            50%      { transform: translateY(-10px) rotate(3deg); }
          }
          @keyframes beeGuidePop {
            0%   { transform: scale(0.7); }
            40%  { transform: scale(1.18); }
            70%  { transform: scale(0.95); }
            100% { transform: scale(1); }
          }
          @keyframes beeGuideHintPop {
            0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
            70%  { transform: scale(1.25) rotate(6deg); opacity: 1; }
            100% { transform: scale(1) rotate(0); opacity: 1; }
          }
          @keyframes beeGuideParticle {
            0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
            20%  { opacity: 1; }
            100% { transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, 0px))) scale(1); opacity: 0; }
          }
          @keyframes tutorialTargetPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.75), 0 0 0 4px rgba(251, 191, 36, 0.95); }
            50%      { box-shadow: 0 0 0 18px rgba(251, 191, 36, 0), 0 0 0 4px rgba(251, 191, 36, 0.95); }
          }
          @keyframes tutorialDialogueIn {
            from { transform: translate(-50%, 100%); opacity: 0; }
            to   { transform: translate(-50%, 0);    opacity: 1; }
          }
          @keyframes tutorialBackdropIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes tutorialCaret {
            0%, 50%   { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
          @keyframes captionSlideIn {
            0%   { transform: translateX(calc(100% + 40px)) scale(0.9); opacity: 0; }
            70%  { transform: translateX(-6px) scale(1.02);              opacity: 1; }
            100% { transform: translateX(0) scale(1);                    opacity: 1; }
          }
          @keyframes captionProgress {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
          }

          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-thumb { background: #FDE68A; border-radius: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::selection { background: #F59E0B33; }
        `}</style>
      </body>
    </html>
  );
}

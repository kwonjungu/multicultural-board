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
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Noto Sans KR', sans-serif", WebkitFontSmoothing: "antialiased" as const }}>
        {children}
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body { color: #111827; }
          button, input, textarea, select { font-family: inherit; }
          *:focus-visible { outline: 2px solid #F59E0B; outline-offset: 2px; border-radius: 4px; }

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

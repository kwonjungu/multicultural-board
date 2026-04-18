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
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap"
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

          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-thumb { background: #FDE68A; border-radius: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::selection { background: #F59E0B33; }
        `}</style>
      </body>
    </html>
  );
}

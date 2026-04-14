import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "다문화 교실 소통판",
  description: "Multicultural Classroom Board - 자동 번역 실시간 소통 플랫폼",
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
          *:focus-visible { outline: 2px solid #6C63FF; outline-offset: 2px; border-radius: 4px; }

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

          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-thumb { background: #D1D5E0; border-radius: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::selection { background: #5B57F522; }
        `}</style>
      </body>
    </html>
  );
}

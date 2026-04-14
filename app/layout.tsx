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
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Noto Sans KR', sans-serif" }}>
        {children}
        <style>{`
          * { box-sizing: border-box; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes slideUp {
            from { transform: translateY(48px); opacity: 0; }
            to { transform: none; opacity: 1; }
          }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-thumb { background: #C5CAE9; border-radius: 3px; }
          ::-webkit-scrollbar-track { background: transparent; }
        `}</style>
      </body>
    </html>
  );
}

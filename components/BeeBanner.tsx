"use client";

// "🐝 AI 꿀비와 함께하는 즐거운 소통 공간" — 입장 화면 상단 배너 (설계서 항목 10)
// 구글 주아체(Jua — app/layout.tsx 에서 로드됨) + 무지개 그라데이션 텍스트.
// 메인 입장(app/page.tsx) · 방별 입장(SetupScreen) · 허브(HomeHub) 맨 위에 배치.
export default function BeeBanner({ compact }: { compact?: boolean }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: compact ? "2px 8px 14px" : "6px 10px 18px",
        position: "relative",
        zIndex: 1,
        width: "100%",
      }}
    >
      <div
        style={{
          fontFamily: "'Jua', 'Noto Sans KR', sans-serif",
          fontWeight: 400, // Jua 는 단일 굵기 디스플레이 폰트
          fontSize: compact ? "clamp(22px, 5vw, 34px)" : "clamp(26px, 6vw, 44px)",
          lineHeight: 1.25,
          letterSpacing: -0.5,
          wordBreak: "keep-all",
        }}
      >
        {/* 이모지는 그라데이션 클리핑 밖에 둬야 색이 유지된다 */}
        <span aria-hidden="true" style={{ marginRight: 8 }}>🐝</span>
        <span
          style={{
            background:
              "linear-gradient(90deg, #F59E0B 0%, #FB7185 22%, #A78BFA 45%, #60A5FA 65%, #34D399 85%, #F59E0B 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "#B45309", // background-clip 미지원 브라우저 폴백
            filter: "drop-shadow(0 2px 4px rgba(180,83,9,0.2))",
          }}
        >
          AI 꿀비와 함께하는 즐거운 소통 공간
        </span>
      </div>
    </div>
  );
}

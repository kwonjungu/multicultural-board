"use client";

interface Props {
  onBack: () => void;
  roomCode: string;
}

export default function ClassDashboard({ onBack, roomCode }: Props) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #F0FDF4 0%, #D1FAE5 60%, #A7F3D0 100%)",
      fontFamily: "'Noto Sans KR', sans-serif",
      display: "flex", flexDirection: "column",
      padding: "18px 16px 24px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <button
          onClick={onBack}
          aria-label="뒤로"
          style={{
            width: 44, height: 44, borderRadius: 14,
            background: "#fff", border: "2px solid #A7F3D0",
            fontSize: 18, fontWeight: 900, color: "#065F46", cursor: "pointer",
          }}
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
            📊 우리반 현황판
          </div>
          <div style={{ fontSize: 12, color: "#065F46", fontWeight: 700, marginTop: 2 }}>
            방 {roomCode}
          </div>
        </div>
        <img
          src="/mascot/bee-welcome.png"
          alt=""
          aria-hidden="true"
          style={{ width: 48, height: 48, flexShrink: 0, filter: "drop-shadow(0 4px 10px rgba(16,185,129,0.35))" }}
        />
      </div>

      {/* Empty state card */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          background: "#fff", borderRadius: 32, padding: "32px 28px",
          maxWidth: 480, width: "100%", textAlign: "center",
          boxShadow: "0 20px 48px rgba(16,185,129,0.18)",
          border: "3px dashed #A7F3D0",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <img
              src="/mascot/bee-loading.png"
              alt=""
              aria-hidden="true"
              style={{ width: 128, height: 128, filter: "drop-shadow(0 8px 20px rgba(16,185,129,0.35))" }}
            />
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#065F46", letterSpacing: -0.4 }}>
            꿀벌이 열심히 만들고 있어요
          </h2>
          <p style={{ margin: "10px 0 20px", fontSize: 16, color: "#047857", fontWeight: 600, lineHeight: 1.6 }}>
            우리반 학생들의 활동을 한눈에 볼 수 있는
            <br/>현황판이 곧 찾아올 거예요.
          </p>

          {/* Placeholder sections */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
            marginTop: 10, marginBottom: 18,
          }}>
            {[
              { icon: "👥", label: "참여 학생" },
              { icon: "💬", label: "오늘의 글" },
              { icon: "❤️", label: "좋아요 수" },
              { icon: "🌍", label: "언어별 통계" },
            ].map((p) => (
              <div key={p.label} style={{
                padding: "14px 10px", borderRadius: 18,
                background: "#F0FDF4", border: "2px dashed #A7F3D0",
                fontSize: 13, fontWeight: 800, color: "#065F46",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <div style={{ fontSize: 28, opacity: 0.6 }}>{p.icon}</div>
                <div>{p.label}</div>
                <div style={{ fontSize: 10, color: "#10B981", fontWeight: 700 }}>준비 중</div>
              </div>
            ))}
          </div>

          <div style={{
            padding: "10px 14px", borderRadius: 12,
            background: "#ECFDF5", border: "1px solid #A7F3D0",
            fontSize: 12, color: "#047857", fontWeight: 700,
          }}>
            💡 구성 의견이 있으면 선생님께 알려주세요
          </div>
        </div>
      </div>
    </div>
  );
}

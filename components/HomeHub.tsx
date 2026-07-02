"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { UserConfig } from "@/lib/types";
import { t, tFmt } from "@/lib/i18n";
import BeeBanner from "./BeeBanner";
import RoomManagePanel from "./RoomManagePanel";
import FontSizeButton from "./FontSizeButton";
import LangSwitchButton from "./LangSwitchButton";
import FlyingBees from "./ui/FlyingBees";

export type HubView = "board" | "whiteboard" | "games" | "dashboard" | "vocab" | "storybook";

interface SectionMeta {
  id: HubView;
  titleKey: string;
  sub: string;
  descKey: string;
  mascot: string;
  color: string;
  bg: string;
  accent: string;
  badge?: string;
}

// ⭐ 소통의 별 — 화이트보드는 소통창/그림책으로 편입되어 타일에서 제외.
// 배열 순서 = 별 꼭짓점 배치(12시부터 시계방향 72°씩):
// 소통창(12시) → 그림책(2시) → 단어(5시) → 칭찬(7시) → 게임(10시)
const SECTIONS: SectionMeta[] = [
  {
    id: "board",
    titleKey: "hubSectionBoard",
    sub: "Padlet",
    descKey: "hubSectionBoardDesc",
    mascot: "/mascot/bee-cheer.png",
    color: "#F59E0B",
    bg: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
    accent: "#B45309",
  },
  {
    id: "storybook",
    titleKey: "hubSectionStorybook",
    sub: "Storybook",
    descKey: "hubSectionStorybookDesc",
    mascot: "/mascot/bee-welcome.png",
    color: "#F97316",
    bg: "linear-gradient(135deg, #FFF7ED, #FED7AA)",
    accent: "#C2410C",
  },
  {
    id: "vocab",
    titleKey: "hubSectionVocab",
    sub: "Word Cards",
    descKey: "hubSectionVocabDesc",
    mascot: "/mascot/bee-book.png",
    color: "#8B5CF6",
    bg: "linear-gradient(135deg, #F5F3FF, #DDD6FE)",
    accent: "#6D28D9",
  },
  {
    id: "dashboard",
    titleKey: "hubSectionStickers",
    sub: "Praise Hive",
    descKey: "hubSectionStickersDesc",
    mascot: "/mascot/bee-student.png",
    color: "#10B981",
    bg: "linear-gradient(135deg, #D1FAE5, #A7F3D0)",
    accent: "#065F46",
  },
  {
    id: "games",
    titleKey: "hubSectionGames",
    sub: "Games",
    descKey: "hubSectionGamesDesc",
    mascot: "/mascot/bee-celebrate.png",
    color: "#FB7185",
    bg: "linear-gradient(135deg, #FFE4E6, #FECDD3)",
    accent: "#BE123C",
  },
];

// 별 꼭짓점 각도(도) — 12시(-90°)부터 시계방향 72° 간격
const STAR_ANGLES = [-90, -18, 54, 126, 198];
// 컨테이너(정사각, viewBox 100) 기준 기하
const STAR_CX = 50;
const STAR_CY = 52;          // 상단 원 라벨 여유를 위해 살짝 아래
const STAR_R_OUTER = 38;     // 별 꼭짓점 반경 = 원 버튼 중심
const STAR_R_INNER = STAR_R_OUTER * 0.382; // 정통 오각성 내경비

/** 오각성(★) 실루엣 폴리곤 points (viewBox 100 기준) */
function starPolygonPoints(): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? STAR_R_OUTER : STAR_R_INNER;
    const ang = ((-90 + i * 36) * Math.PI) / 180;
    pts.push(`${(STAR_CX + r * Math.cos(ang)).toFixed(2)},${(STAR_CY + r * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(" ");
}

interface Props {
  user: UserConfig;
  roomCode: string;
  onSelect: (view: HubView) => void;
  onLogout: () => void;
  onChangeLang: (lang: string) => void;
  availableLangs: string[];
}

export default function HomeHub({ user, roomCode, onSelect, onLogout, onChangeLang, availableLangs }: Props) {
  const lang = user.myLang;
  // 관리 패널은 기본 접힘 — 교사가 필요할 때 직접 펼친다 (자동 펼치기 안 함).
  const [manageOpen, setManageOpen] = useState(false);
  // 교사용 QR 모달 (학생 입장 주소 공유)
  const [showQR, setShowQR] = useState(false);
  const joinUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${roomCode}`;
  return (
    <div style={{
      minHeight: "100vh",
      background: "#FCEFB0",
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
      position: "relative", overflow: "hidden",
      padding: "24px 16px 40px",
    }}>
      {/* 🐝 입장 화면 꿀벌 일러스트 배경 (전체 화면 고정) */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0,
        backgroundImage: "url('/landing/landing-bees.webp')",
        backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
        pointerEvents: "none", zIndex: 0,
      }} />
      <FlyingBees />

      <div style={{
        maxWidth: 760, margin: "0 auto",
        position: "relative", zIndex: 1,
      }}>
        {/* 🐝 상단 배너 — 주아체 무지개 (설계서 항목 10) */}
        <BeeBanner compact />

        {/* Header */}
        <div data-tutorial-id="hub-header" style={{
          display: "flex", alignItems: "center", gap: 14, marginBottom: 24,
          background: "#fff", borderRadius: 24, padding: "14px 18px",
          border: "2px solid #FDE68A",
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        }}>
          <img
            src="/mascot/bee-welcome.png"
            alt=""
            aria-hidden="true"
            style={{ width: 72, height: 72, flexShrink: 0, filter: "drop-shadow(0 4px 10px rgba(245,158,11,0.35))" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
              {tFmt("hubGreeting", lang, { name: user.myName })}
            </div>
            <div style={{ fontSize: 12, color: "#92400E", fontWeight: 700, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ background: "#FEF3C7", padding: "2px 8px", borderRadius: 999, fontWeight: 900, color: "#B45309" }}>
                🚪 {roomCode}
              </span>
              {user.isTeacher ? (
                <span style={{ background: "#ECFDF5", color: "#065F46", padding: "2px 8px", borderRadius: 999, fontWeight: 900 }}>
                  👩‍🏫 {t("roleTeacher", lang)}
                </span>
              ) : (
                <span>🎒 {t("roleStudent", lang)}</span>
              )}
            </div>
          </div>
          {/* QR 코드 — 교사만. 학생 입장 주소를 바로 띄워 공유 */}
          {user.isTeacher && (
            <button
              onClick={() => setShowQR(true)}
              aria-label="입장 QR 코드"
              style={{
                width: 40, height: 40, borderRadius: 12, border: "2px solid #A7F3D0",
                background: "#ECFDF5", fontSize: 14, fontWeight: 900, letterSpacing: 0.5,
                color: "#047857", cursor: "pointer",
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >QR</button>
          )}

          {/* 언어 설정 — 교사·학생 공통, 입장 후에도 변경 가능 */}
          <LangSwitchButton
            currentLang={user.myLang}
            availableLangs={availableLangs}
            onChange={onChangeLang}
          />

          {/* 글자 크기 설정 — 교사·학생 공통 */}
          <FontSizeButton />

          {/* 전원(로그아웃) — 학생에게는 아래에 "로그아웃" 글자 표시 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
            <button
              onClick={onLogout}
              aria-label="로그아웃"
              style={{
                width: 40, height: 40, borderRadius: 12, border: "2px solid #FDE68A",
                background: "#fff", fontSize: 14, fontWeight: 900, color: "#92400E", cursor: "pointer",
              }}
            >⏻</button>
            {!user.isTeacher && (
              <span style={{ fontSize: 10, fontWeight: 800, color: "#92400E", lineHeight: 1 }}>로그아웃</span>
            )}
          </div>
        </div>

        {/* 교사 전용 관리 패널 — 로그인 직후 시작화면에서 바로 보임 */}
        {user.isTeacher && (
          <div style={{
            background: "#fff", borderRadius: 24, marginBottom: 22,
            border: "2px solid #FDE68A",
            boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
            overflow: "hidden",
          }}>
            <button
              onClick={() => setManageOpen((v) => !v)}
              aria-expanded={manageOpen}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "16px 20px", background: "transparent", border: "none",
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 22 }}>🛠</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 17, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
                  {t("manage", lang)}
                </span>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#92400E", marginTop: 2 }}>
                  방 설정 · 컬럼 · 언어 · 명렬표
                </span>
              </span>
              <span style={{
                fontSize: 14, fontWeight: 900, color: "#B45309",
                transform: manageOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s",
              }}>▾</span>
            </button>
            {manageOpen && (
              <div style={{ padding: "4px 20px 22px", borderTop: "1px solid #FEF3C7" }}>
                <RoomManagePanel roomCode={roomCode} lang={lang} />
              </div>
            )}
          </div>
        )}

        {/* Greeting */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#1F2937", letterSpacing: -0.4 }}>
            {t("hubToday", lang)}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#92400E", fontWeight: 700 }}>
            {t("hubPrompt", lang)}
          </p>
          {/* 태그라인은 소통의 별 중앙("소통하는 우리" 아래)으로 이동 */}
        </div>

        {/* ⭐ 소통의 별 — 5개 섹션이 별 꼭짓점의 원, 중앙에 "소통하는 우리" */}
        <div style={{
          position: "relative",
          width: "min(94vw, 620px)",
          aspectRatio: "1",
          margin: "0 auto",
        }}>
          {/* 별 실루엣 */}
          <svg
            viewBox="0 0 100 100"
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <defs>
              <linearGradient id="starGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.95" />
                <stop offset="55%" stopColor="#FDE68A" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <polygon
              points={starPolygonPoints()}
              fill="url(#starGrad)"
              stroke="#F59E0B"
              strokeWidth="1.4"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 4px 6px rgba(180,83,9,0.25))" }}
            />
          </svg>

          {/* 중앙 — 소통하는 우리 */}
          <div style={{
            position: "absolute",
            left: `${STAR_CX}%`, top: `${STAR_CY}%`,
            transform: "translate(-50%, -50%)",
            textAlign: "center", pointerEvents: "none",
            width: "36%",
          }}>
            <div style={{
              fontFamily: "'Jua', 'Noto Sans KR', sans-serif",
              fontSize: "clamp(22px, 5vw, 38px)",
              color: "#92400E", lineHeight: 1.2,
              textShadow: "0 1px 0 rgba(255,255,255,0.8), 0 3px 8px rgba(180,83,9,0.25)",
              wordBreak: "keep-all",
            }}>
              소통하는<br />우리
            </div>
          </div>

          {/* 꼭짓점 원형 버튼 5개 */}
          {SECTIONS.map((s, i) => {
            const ang = (STAR_ANGLES[i] * Math.PI) / 180;
            const x = STAR_CX + STAR_R_OUTER * Math.cos(ang);
            const y = STAR_CY + STAR_R_OUTER * Math.sin(ang);
            return (
              <button
                key={s.id}
                data-tutorial-id={`hub-section-${s.id}`}
                onClick={() => onSelect(s.id)}
                aria-label={`${t(s.titleKey, lang)} 열기`}
                title={t(s.descKey, lang)}
                style={{
                  position: "absolute",
                  left: `${x}%`, top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                  width: "27%", aspectRatio: "1",
                  borderRadius: "50%",
                  background: s.bg,
                  border: `3px solid ${s.color}`,
                  boxShadow: `0 10px 24px ${s.color}44, inset 0 -4px 0 ${s.color}22`,
                  cursor: "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 2, padding: "4%",
                  fontFamily: "inherit",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  zIndex: 2,
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "translate(-50%, -50%) scale(0.94)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)")}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 14px 30px ${s.color}66, inset 0 -4px 0 ${s.color}22`)}
              >
                <img
                  src={s.mascot}
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: "58%", height: "58%", objectFit: "contain",
                    filter: `drop-shadow(0 4px 8px ${s.color}55)`,
                    animation: "heroBeeFloat 3s ease-in-out infinite",
                  }}
                />
                <div style={{
                  fontSize: "clamp(11px, 2.3vw, 16px)",
                  fontWeight: 900, color: "#1F2937",
                  letterSpacing: -0.3, lineHeight: 1.15,
                  textAlign: "center", wordBreak: "keep-all",
                }}>
                  {t(s.titleKey, lang)}
                </div>
              </button>
            );
          })}
        </div>

        {/* 교사 전용 — 화이트보드(타일에서 편입 제외, 기능은 유지) */}
        {user.isTeacher && (
          <div style={{ textAlign: "center", marginTop: 6 }}>
            <button
              onClick={() => onSelect("whiteboard")}
              style={{
                padding: "8px 18px", borderRadius: 999,
                background: "rgba(255,255,255,0.85)", border: "2px solid #BFDBFE",
                color: "#1D4ED8", fontSize: 13, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 12px rgba(59,130,246,0.15)",
              }}
            >🖊 화이트보드 열기 <span style={{ fontSize: 10, opacity: 0.7 }}>(켜면 학생 화면이 자동으로 따라와요)</span></button>
          </div>
        )}
      </div>

      {/* 입장 QR 모달 — 교사용 */}
      {showQR && (
        <div
          onClick={() => setShowQR(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15,12,40,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 24, padding: "26px 28px",
              maxWidth: 360, width: "100%", textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "#1F2937", marginBottom: 4 }}>
              📱 우리 반 입장하기
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 18 }}>
              학생이 휴대폰 카메라로 찍으면 바로 입장해요
            </div>
            <div style={{
              display: "inline-flex", padding: 14, borderRadius: 16,
              background: "#fff", border: "3px solid #FDE68A",
            }}>
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
            <div style={{ marginTop: 14, fontSize: 13, fontWeight: 800, color: "#374151", wordBreak: "break-all" }}>
              {joinUrl}
            </div>
            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 900, color: "#B45309", letterSpacing: 2 }}>
              🚪 {roomCode}
            </div>
            <button
              onClick={() => setShowQR(false)}
              style={{
                marginTop: 18, width: "100%", padding: "12px",
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#fff", border: "none", borderRadius: 14,
                fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit",
              }}
            >닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

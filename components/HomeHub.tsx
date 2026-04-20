"use client";

import { UserConfig } from "@/lib/types";
import { t, tFmt } from "@/lib/i18n";

export type HubView = "board" | "interpreter" | "games" | "dashboard" | "vocab" | "storybook";

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
    id: "interpreter",
    titleKey: "hubSectionInterp",
    sub: "Interpreter",
    descKey: "hubSectionInterpDesc",
    mascot: "/mascot/bee-think.png",
    color: "#3B82F6",
    bg: "linear-gradient(135deg, #DBEAFE, #BFDBFE)",
    accent: "#1E40AF",
    badge: "BETA",
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
  {
    id: "dashboard",
    titleKey: "hubSectionStickers",
    sub: "Praise Hive",
    descKey: "hubSectionStickersDesc",
    mascot: "/mascot/bee-celebrate.png",
    color: "#10B981",
    bg: "linear-gradient(135deg, #D1FAE5, #A7F3D0)",
    accent: "#065F46",
  },
  {
    id: "vocab",
    titleKey: "hubSectionVocab",
    sub: "Word Cards",
    descKey: "hubSectionVocabDesc",
    mascot: "/mascot/bee-think.png",
    color: "#8B5CF6",
    bg: "linear-gradient(135deg, #F5F3FF, #DDD6FE)",
    accent: "#6D28D9",
  },
  {
    id: "storybook",
    titleKey: "hubSectionStorybook",
    sub: "Storybook",
    descKey: "hubSectionStorybookDesc",
    mascot: "/mascot/bee-welcome.png",
    color: "#F59E0B",
    bg: "linear-gradient(135deg, #FFF7ED, #FED7AA)",
    accent: "#C2410C",
    badge: "NEW",
  },
];

interface Props {
  user: UserConfig;
  roomCode: string;
  onSelect: (view: HubView) => void;
  onLogout: () => void;
}

export default function HomeHub({ user, roomCode, onSelect, onLogout }: Props) {
  const lang = user.myLang;
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 50%, #FDE68A 100%)",
      fontFamily: "'Noto Sans KR', sans-serif",
      position: "relative", overflow: "hidden",
      padding: "24px 16px 40px",
    }}>
      {/* Honeycomb texture */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0,
        backgroundImage: "url('/patterns/honeycomb.png')",
        backgroundSize: "300px auto", backgroundRepeat: "repeat",
        opacity: 0.22, pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{
        maxWidth: 760, margin: "0 auto",
        position: "relative", zIndex: 1,
      }}>
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
            style={{ width: 56, height: 56, flexShrink: 0, filter: "drop-shadow(0 4px 10px rgba(245,158,11,0.35))" }}
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
          <button
            onClick={onLogout}
            aria-label="나가기"
            style={{
              width: 40, height: 40, borderRadius: 12, border: "2px solid #FDE68A",
              background: "#fff", fontSize: 14, fontWeight: 900, color: "#92400E", cursor: "pointer",
              flexShrink: 0,
            }}
          >⏻</button>
        </div>

        {/* Greeting */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#1F2937", letterSpacing: -0.4 }}>
            {t("hubToday", lang)}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#92400E", fontWeight: 700 }}>
            {t("hubPrompt", lang)}
          </p>
        </div>

        {/* 4 sections grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14,
        }}>
          {SECTIONS.map((s) => {
            const locked = false;
            return (
              <button
                key={s.id}
                data-tutorial-id={`hub-section-${s.id}`}
                onClick={() => !locked && onSelect(s.id)}
                disabled={locked}
                aria-label={`${t(s.titleKey, lang)} 열기`}
                style={{
                  position: "relative",
                  background: s.bg,
                  border: `3px solid ${s.color}55`,
                  borderRadius: 26,
                  padding: "20px 20px 22px",
                  textAlign: "left",
                  cursor: locked ? "default" : "pointer",
                  opacity: locked ? 0.78 : 1,
                  boxShadow: locked
                    ? "0 4px 10px rgba(0,0,0,0.04)"
                    : `0 12px 28px ${s.color}33`,
                  transition: "transform 0.15s, box-shadow 0.15s",
                  minHeight: 180,
                  display: "flex", flexDirection: "column", gap: 8,
                  fontFamily: "inherit",
                }}
                onMouseDown={(e) => !locked && (e.currentTarget.style.transform = "scale(0.97)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                {/* Top: mascot */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
                  <img
                    src={s.mascot}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: 88, height: 88, display: "block",
                      filter: `drop-shadow(0 6px 14px ${s.color}55)`,
                      animation: locked ? undefined : "heroBeeFloat 3s ease-in-out infinite",
                    }}
                  />
                </div>

                {/* Title + sub */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
                    {t(s.titleKey, lang)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: s.accent, letterSpacing: 1, marginTop: 2 }}>
                    {s.sub}
                  </div>
                </div>

                {/* Description */}
                <div style={{
                  textAlign: "center", fontSize: 13, color: s.accent, fontWeight: 700,
                  marginTop: "auto", lineHeight: 1.5,
                }}>
                  {t(s.descKey, lang)}
                </div>

                {/* Badge */}
                {s.badge && (
                  <div style={{
                    position: "absolute", top: 14, right: 14,
                    fontSize: 10, fontWeight: 900, color: "#fff",
                    background: locked ? "#9CA3AF" : s.color,
                    padding: "3px 8px", borderRadius: 999, letterSpacing: 0.5,
                    boxShadow: locked ? "none" : `0 2px 6px ${s.color}66`,
                  }}>{s.badge}</div>
                )}

                {locked && (
                  <div style={{
                    position: "absolute", bottom: 14, right: 14,
                    fontSize: 10, fontWeight: 900, color: "#6B7280",
                    background: "#F3F4F6", padding: "3px 8px", borderRadius: 999,
                    letterSpacing: 0.5,
                  }}>{t("hubSoon", lang)}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

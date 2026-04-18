"use client";

import { useEffect, useState } from "react";
import { t, tFmt } from "@/lib/i18n";
import { giveIndividualSticker, giveTeamSticker } from "@/lib/stickers";
import type { StickerType } from "@/lib/types";

interface Props {
  roomCode: string;
  teacherName: string;
  teacherClientId: string;
  targetStudent: { clientId: string; name: string } | null;
  lang: string;
  onClose: () => void;
}

type TargetMode = "individual" | "team";

interface StickerTypeCard {
  type: StickerType;
  bg: string;
  border: string;
  accent: string;
  labelKey: string;
}

const STICKER_CARDS: StickerTypeCard[] = [
  { type: "helpful",     bg: "#FFE4EC", border: "#F9A8D4", accent: "#DB2777", labelKey: "stickerType_helpful" },
  { type: "brave",       bg: "#FFEDD5", border: "#FDBA74", accent: "#EA580C", labelKey: "stickerType_brave" },
  { type: "creative",    bg: "#FCE7F3", border: "#F472B6", accent: "#BE185D", labelKey: "stickerType_creative" },
  { type: "cooperative", bg: "#E0E7FF", border: "#A5B4FC", accent: "#4F46E5", labelKey: "stickerType_cooperative" },
  { type: "persistent",  bg: "#D1FAE5", border: "#6EE7B7", accent: "#059669", labelKey: "stickerType_persistent" },
  { type: "curious",     bg: "#CFFAFE", border: "#67E8F9", accent: "#0891B2", labelKey: "stickerType_curious" },
];

export default function StickerGiveModal({
  roomCode,
  teacherName,
  teacherClientId,
  targetStudent,
  lang,
  onClose,
}: Props) {
  const [targetMode, setTargetMode] = useState<TargetMode>("individual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  // Reset state when opened with a new target
  useEffect(() => {
    if (targetStudent) {
      setTargetMode("individual");
      setBusy(false);
      setError(null);
      setCelebrating(false);
    }
  }, [targetStudent]);

  // Escape key to close
  useEffect(() => {
    if (!targetStudent) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy && !celebrating) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [targetStudent, busy, celebrating, onClose]);

  if (!targetStudent) return null;

  async function handleGive(type: StickerType) {
    if (busy || celebrating || !targetStudent) return;
    setBusy(true);
    setError(null);
    try {
      if (targetMode === "individual") {
        await giveIndividualSticker(roomCode, targetStudent.clientId, type, teacherName, teacherClientId);
      } else {
        await giveTeamSticker(roomCode, targetStudent.clientId, type, teacherName, teacherClientId);
      }
      setCelebrating(true);
      // Auto-close after 1.2s celebration
      setTimeout(() => {
        setCelebrating(false);
        onClose();
      }, 1200);
    } catch (e) {
      console.error("sticker give error:", e);
      setError((e as Error).message || "전달 실패");
    }
    setBusy(false);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(9,7,30,0.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 210, backdropFilter: "blur(6px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sticker-give-title"
      onClick={(e) => { if (e.target === e.currentTarget && !busy && !celebrating) onClose(); }}
    >
      <div
        style={{
          background: "#FFFBEB",
          borderRadius: "28px 28px 0 0",
          width: "100%",
          maxWidth: "min(560px, 94vw)",
          padding: "18px clamp(18px, 4vw, 26px) 32px",
          boxShadow: "0 -16px 60px rgba(180,83,9,0.3)",
          animation: "stickerSlideUp 0.24s ease",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Handle bar */}
        <div style={{
          width: 44, height: 5, borderRadius: 999, background: "#FDE68A",
          margin: "-4px auto 16px",
        }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <img
            src="/mascot/bee-cheer.png"
            alt=""
            aria-hidden="true"
            style={{
              width: 60, height: 60, display: "block", flexShrink: 0,
              filter: "drop-shadow(0 6px 14px rgba(245,158,11,0.3))",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              id="sticker-give-title"
              style={{
                fontWeight: 900, fontSize: 19, color: "#1F2937",
                letterSpacing: -0.3, lineHeight: 1.25,
              }}
            >
              {tFmt("stickerGiveTitle", lang, { name: targetStudent.name })}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy || celebrating}
            aria-label="close"
            style={{
              background: "#fff", border: "2px solid #FDE68A", borderRadius: 14,
              width: 44, height: 44, fontSize: 16, cursor: (busy || celebrating) ? "not-allowed" : "pointer",
              color: "#92400E", fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: (busy || celebrating) ? 0.5 : 1,
            }}
          >✕</button>
        </div>

        {/* Celebration overlay (inline) */}
        {celebrating ? (
          <div
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
              padding: "36px 12px",
              background: "linear-gradient(160deg, #FEF3C7 0%, #FDE68A 100%)",
              borderRadius: 24, border: "3px solid #F59E0B",
              animation: "stickerPop 0.3s ease",
            }}
            role="status"
            aria-live="polite"
          >
            <img
              src="/mascot/bee-celebrate.png"
              alt=""
              aria-hidden="true"
              style={{
                width: 120, height: 120,
                filter: "drop-shadow(0 8px 18px rgba(245,158,11,0.4))",
                animation: "stickerBeeBob 0.9s ease-in-out infinite alternate",
              }}
            />
            <div style={{
              fontSize: 20, fontWeight: 900, color: "#B45309", textAlign: "center",
              letterSpacing: -0.2,
            }}>
              {t("stickerGiving", lang)}
            </div>
            <div style={{
              fontSize: 15, fontWeight: 800, color: "#92400E",
            }}>
              {t("stickerGiven", lang)}
            </div>
          </div>
        ) : (
          <>
            {/* Error banner */}
            {error && (
              <div style={{
                background: "#FEF2F2", borderRadius: 12, padding: "10px 14px",
                marginBottom: 12, display: "flex", alignItems: "center", gap: 10,
                border: "1.5px solid #FECACA",
              }}>
                <span style={{ fontSize: 13, color: "#991B1B", flex: 1, fontWeight: 700 }}>
                  ❌ {error}
                </span>
              </div>
            )}

            {/* Target toggle (segmented) */}
            <div
              role="tablist"
              aria-label="target"
              style={{
                display: "flex", gap: 4, marginBottom: 18,
                background: "#FEF3C7", borderRadius: 14, padding: 5,
              }}
            >
              {(["individual", "team"] as const).map((mode) => {
                const selected = targetMode === mode;
                return (
                  <button
                    key={mode}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTargetMode(mode)}
                    disabled={busy}
                    style={{
                      flex: 1, padding: "12px 6px",
                      borderRadius: 11, border: "none",
                      cursor: busy ? "not-allowed" : "pointer",
                      background: selected ? "#fff" : "transparent",
                      boxShadow: selected ? "0 2px 6px rgba(245,158,11,0.25)" : "none",
                      fontWeight: selected ? 900 : 700,
                      fontSize: 14,
                      color: selected ? "#B45309" : "#92400E99",
                      transition: "all 0.15s",
                      minHeight: 44,
                    }}
                  >
                    {mode === "individual"
                      ? t("stickerTargetIndividual", lang)
                      : t("stickerTargetTeam", lang)}
                  </button>
                );
              })}
            </div>

            {/* 6 sticker cards 2×3 grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
              }}
            >
              {STICKER_CARDS.map((card) => {
                const label = t(card.labelKey, lang);
                return (
                  <button
                    key={card.type}
                    onClick={() => handleGive(card.type)}
                    disabled={busy}
                    aria-label={label}
                    style={{
                      minHeight: 144,
                      borderRadius: 20,
                      background: card.bg,
                      border: `3px solid ${card.border}`,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 8, padding: "12px 8px",
                      cursor: busy ? "wait" : "pointer",
                      transition: "transform 0.15s, box-shadow 0.15s",
                      boxShadow: `0 4px 14px ${card.border}55`,
                      opacity: busy ? 0.6 : 1,
                    }}
                    onMouseDown={(e) => !busy && ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)")}
                    onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
                  >
                    <img
                      src={`/stickers/sticker-${card.type}.png`}
                      alt=""
                      aria-hidden="true"
                      style={{
                        width: 80, height: 80, objectFit: "contain",
                        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))",
                      }}
                    />
                    <div style={{
                      fontSize: 14, fontWeight: 900,
                      color: card.accent, textAlign: "center",
                      letterSpacing: -0.2, lineHeight: 1.25,
                    }}>
                      {label}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes stickerSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes stickerPop {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes stickerBeeBob {
          from { transform: translateY(0)    rotate(-3deg); }
          to   { transform: translateY(-10px) rotate(3deg); }
        }
      `}</style>
    </div>
  );
}

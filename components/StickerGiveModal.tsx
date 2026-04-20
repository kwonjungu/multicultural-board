"use client";

import { useEffect, useMemo, useState } from "react";
import { t, tFmt } from "@/lib/i18n";
import { giveStickersBatch } from "@/lib/stickers";
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
  guideKey: string;
}

const STICKER_CARDS: StickerTypeCard[] = [
  { type: "helpful",     bg: "#FFE4EC", border: "#F9A8D4", accent: "#DB2777", labelKey: "stickerType_helpful",     guideKey: "stickerGuide_helpful" },
  { type: "brave",       bg: "#FFEDD5", border: "#FDBA74", accent: "#EA580C", labelKey: "stickerType_brave",       guideKey: "stickerGuide_brave" },
  { type: "creative",    bg: "#FCE7F3", border: "#F472B6", accent: "#BE185D", labelKey: "stickerType_creative",    guideKey: "stickerGuide_creative" },
  { type: "cooperative", bg: "#E0E7FF", border: "#A5B4FC", accent: "#4F46E5", labelKey: "stickerType_cooperative", guideKey: "stickerGuide_cooperative" },
  { type: "persistent",  bg: "#D1FAE5", border: "#6EE7B7", accent: "#059669", labelKey: "stickerType_persistent",  guideKey: "stickerGuide_persistent" },
  { type: "curious",     bg: "#CFFAFE", border: "#67E8F9", accent: "#0891B2", labelKey: "stickerType_curious",     guideKey: "stickerGuide_curious" },
];

const EMPTY_COUNTS: Record<StickerType, number> = {
  helpful: 0, brave: 0, creative: 0, cooperative: 0, persistent: 0, curious: 0,
};

export default function StickerGiveModal({
  roomCode,
  teacherName,
  teacherClientId,
  targetStudent,
  lang,
  onClose,
}: Props) {
  const [targetMode, setTargetMode] = useState<TargetMode>("individual");
  const [counts, setCounts] = useState<Record<StickerType, number>>({ ...EMPTY_COUNTS });
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  // Reset state when opened with a new target
  useEffect(() => {
    if (targetStudent) {
      setTargetMode("individual");
      setCounts({ ...EMPTY_COUNTS });
      setMemo("");
      setBusy(false);
      setError(null);
      setCelebrating(false);
    }
  }, [targetStudent]);

  const total = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );

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

  function bumpCount(type: StickerType, delta: number) {
    setCounts((prev) => ({
      ...prev,
      [type]: Math.max(0, (prev[type] ?? 0) + delta),
    }));
  }

  async function handleGiveAll() {
    if (busy || celebrating || !targetStudent || total === 0) return;
    setBusy(true);
    setError(null);
    try {
      const target =
        targetMode === "individual"
          ? ({ mode: "individual", studentClientId: targetStudent.clientId } as const)
          : ({ mode: "team", contributorClientId: targetStudent.clientId } as const);
      await giveStickersBatch(
        roomCode,
        target,
        counts,
        teacherName,
        teacherClientId,
        { memo: memo.trim() || undefined, source: "teacher" },
      );
      setCelebrating(true);
      setTimeout(() => {
        setCelebrating(false);
        onClose();
      }, 1400);
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
          maxWidth: "min(580px, 96vw)",
          padding: "18px clamp(14px, 4vw, 24px) 28px",
          boxShadow: "0 -16px 60px rgba(180,83,9,0.3)",
          animation: "stickerSlideUp 0.24s ease",
          maxHeight: "94vh",
          overflowY: "auto",
        }}
      >
        {/* Handle bar */}
        <div style={{
          width: 44, height: 5, borderRadius: 999, background: "#FDE68A",
          margin: "-4px auto 14px",
        }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <img
            src="/mascot/bee-cheer.png"
            alt=""
            aria-hidden="true"
            style={{
              width: 54, height: 54, display: "block", flexShrink: 0,
              filter: "drop-shadow(0 6px 14px rgba(245,158,11,0.3))",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              id="sticker-give-title"
              style={{
                fontWeight: 900, fontSize: 18, color: "#1F2937",
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
              width: 40, height: 40, fontSize: 16, cursor: (busy || celebrating) ? "not-allowed" : "pointer",
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
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              padding: "32px 12px",
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
                width: 110, height: 110,
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
              fontSize: 22, fontWeight: 900, color: "#92400E",
            }}>
              +{total} 🎉
            </div>
            <div style={{
              fontSize: 14, fontWeight: 800, color: "#92400E",
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
                display: "flex", gap: 4, marginBottom: 14,
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
                      flex: 1, padding: "11px 6px",
                      borderRadius: 11, border: "none",
                      cursor: busy ? "not-allowed" : "pointer",
                      background: selected ? "#fff" : "transparent",
                      boxShadow: selected ? "0 2px 6px rgba(245,158,11,0.25)" : "none",
                      fontWeight: selected ? 900 : 700,
                      fontSize: 14,
                      color: selected ? "#B45309" : "#92400E99",
                      transition: "all 0.15s",
                      minHeight: 40,
                    }}
                  >
                    {mode === "individual"
                      ? t("stickerTargetIndividual", lang)
                      : t("stickerTargetTeam", lang)}
                  </button>
                );
              })}
            </div>

            {/* 6 sticker cards — 2×3 grid, each with counter */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
              }}
            >
              {STICKER_CARDS.map((card) => {
                const label = t(card.labelKey, lang);
                const guide = t(card.guideKey, lang);
                const n = counts[card.type] ?? 0;
                const active = n > 0;
                return (
                  <div
                    key={card.type}
                    style={{
                      minHeight: 170,
                      borderRadius: 18,
                      background: active ? card.bg : "#fff",
                      border: `3px solid ${active ? card.accent : card.border}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 4,
                      padding: "10px 8px 8px",
                      transition: "all 0.15s",
                      boxShadow: active
                        ? `0 6px 18px ${card.accent}55`
                        : `0 2px 6px ${card.border}33`,
                      position: "relative",
                    }}
                  >
                    {/* Count badge (top right) */}
                    {active && (
                      <div
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 8,
                          minWidth: 26,
                          height: 26,
                          padding: "0 8px",
                          borderRadius: 999,
                          background: card.accent,
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 900,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                        }}
                      >
                        ×{n}
                      </div>
                    )}

                    {/* Tap area = +1 */}
                    <button
                      onClick={() => bumpCount(card.type, +1)}
                      disabled={busy}
                      aria-label={`add ${label}`}
                      style={{
                        flex: 1,
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        cursor: busy ? "wait" : "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        padding: "4px 2px",
                      }}
                    >
                      <img
                        src={`/stickers/sticker-${card.type}.png`}
                        alt=""
                        aria-hidden="true"
                        style={{
                          width: 62, height: 62, objectFit: "contain",
                          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))",
                        }}
                      />
                      <div style={{
                        fontSize: 13, fontWeight: 900,
                        color: card.accent, textAlign: "center",
                        letterSpacing: -0.2, lineHeight: 1.2,
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontSize: 10.5, fontWeight: 700,
                        color: "#4B5563", textAlign: "center",
                        letterSpacing: -0.1, lineHeight: 1.25,
                        minHeight: 26,
                        padding: "0 2px",
                      }}>
                        {guide}
                      </div>
                    </button>

                    {/* Stepper */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        width: "100%",
                      }}
                    >
                      <button
                        onClick={() => bumpCount(card.type, -1)}
                        disabled={busy || n === 0}
                        aria-label="decrement"
                        style={{
                          width: 32, height: 32,
                          borderRadius: 10,
                          background: "#fff",
                          border: `2px solid ${n === 0 ? "#E5E7EB" : card.accent}`,
                          color: n === 0 ? "#9CA3AF" : card.accent,
                          fontSize: 16, fontWeight: 900,
                          cursor: n === 0 || busy ? "not-allowed" : "pointer",
                          opacity: n === 0 ? 0.5 : 1,
                        }}
                      >−</button>
                      <div style={{
                        minWidth: 28, textAlign: "center",
                        fontSize: 15, fontWeight: 900, color: "#1F2937",
                      }}>{n}</div>
                      <button
                        onClick={() => bumpCount(card.type, +1)}
                        disabled={busy}
                        aria-label="increment"
                        style={{
                          width: 32, height: 32,
                          borderRadius: 10,
                          background: card.accent,
                          border: "none",
                          color: "#fff",
                          fontSize: 16, fontWeight: 900,
                          cursor: busy ? "wait" : "pointer",
                        }}
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Memo (optional) */}
            <div style={{ marginTop: 14 }}>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={60}
                placeholder={t("phMemoPlaceholder", lang)}
                disabled={busy}
                style={{
                  width: "100%",
                  minHeight: 46,
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "2px solid #FDE68A",
                  background: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1F2937",
                  fontFamily: "inherit",
                  outline: "none",
                  letterSpacing: -0.1,
                }}
              />
            </div>

            {/* Give button */}
            <button
              onClick={handleGiveAll}
              disabled={busy || total === 0}
              style={{
                marginTop: 14,
                width: "100%",
                minHeight: 54,
                padding: "14px 22px",
                background: total === 0
                  ? "#E5E7EB"
                  : "linear-gradient(135deg, #F59E0B, #D97706)",
                color: total === 0 ? "#9CA3AF" : "#fff",
                border: "none",
                borderRadius: 16,
                fontSize: 17,
                fontWeight: 900,
                cursor: total === 0 || busy ? "not-allowed" : "pointer",
                boxShadow: total === 0 ? "none" : "0 8px 20px rgba(245,158,11,0.4)",
                letterSpacing: -0.2,
                transition: "all 0.15s",
              }}
            >
              {total === 0
                ? t("phGiveSelectFirst", lang)
                : tFmt("phGiveCountBtn", lang, { n: total })}
            </button>
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

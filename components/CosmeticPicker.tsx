"use client";

import { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { subscribeCosmetics, setCosmetics } from "@/lib/stickers";
import {
  stageOf,
  stageImage,
  unlockedSkins,
  unlockedHats,
  unlockedPets,
  unlockedTrophies,
} from "@/lib/stage";
import type { StudentCosmetics, SkinId, HatId, PetId, TrophyId } from "@/lib/types";

interface Props {
  open: boolean;
  roomCode: string;
  myClientId: string;
  stickerCount: number;
  lang: string;
  onClose: () => void;
}

const ALL_SKINS: SkinId[] = ["classic", "orange", "green", "sky", "pink", "purple"];
const ALL_HATS: NonNullable<HatId>[] = ["top", "cap", "ribbon", "crown"];
const ALL_PETS: NonNullable<PetId>[] = ["dog", "cat", "rabbit", "butterfly"];
const ALL_TROPHIES: NonNullable<TrophyId>[] = ["gold", "star"];

const DEFAULT_COSMETICS: StudentCosmetics = {
  skin: "classic",
  hat: null,
  pet: null,
  trophy: null,
};

type ItemKind = "skin" | "hat" | "pet" | "trophy";

function assetPath(kind: ItemKind, id: string): string {
  return `/stickers/${kind}-${id}.png`;
}

export default function CosmeticPicker({
  open,
  roomCode,
  myClientId,
  stickerCount,
  lang,
  onClose,
}: Props) {
  const [current, setCurrent] = useState<StudentCosmetics>(DEFAULT_COSMETICS);
  const [draft, setDraft] = useState<StudentCosmetics>(DEFAULT_COSMETICS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stage = useMemo(() => stageOf(stickerCount), [stickerCount]);
  const uSkins = useMemo(() => new Set<SkinId>(unlockedSkins(stage)), [stage]);
  const uHats = useMemo(() => new Set<NonNullable<HatId>>(unlockedHats(stage)), [stage]);
  const uPets = useMemo(() => new Set<NonNullable<PetId>>(unlockedPets(stage)), [stage]);
  const uTrophies = useMemo(() => new Set<NonNullable<TrophyId>>(unlockedTrophies(stage)), [stage]);

  // Subscribe to cosmetics while open
  useEffect(() => {
    if (!open || !myClientId) return;
    const unsub = subscribeCosmetics(roomCode, myClientId, (c) => {
      setCurrent(c);
      setDraft(c);
    });
    return () => { unsub(); };
  }, [open, roomCode, myClientId]);

  // Reset error on open / close
  useEffect(() => {
    if (!open) {
      setError(null);
      setSaving(false);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) handleCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saving, current]);

  function handleCancel() {
    setDraft(current);
    setError(null);
    onClose();
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await setCosmetics(roomCode, myClientId, draft);
      onClose();
    } catch (e) {
      console.error("cosmetic save error:", e);
      setError((e as Error).message || "저장 실패");
    }
    setSaving(false);
  }

  // === Preview composition ===
  const stageSrc = stageImage(stage);

  return (
    <>
      {/* Dim overlay */}
      <div
        onClick={() => { if (!saving) handleCancel(); }}
        style={{
          position: "fixed", inset: 0, background: "rgba(31,41,55,0.55)",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s", zIndex: 210,
        }}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("cosmeticPickerTitle", lang)}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(520px, 96vw)",
          background: "#FFFBEB",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 211,
          display: "flex", flexDirection: "column",
          boxShadow: "-10px 0 40px rgba(120,53,15,0.25)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 16px 12px", display: "flex", alignItems: "center", gap: 12,
          flexShrink: 0, borderBottom: "1.5px solid #FDE68A",
          background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
        }}>
          <img
            src="/mascot/bee-welcome.png"
            alt=""
            aria-hidden="true"
            style={{
              width: 60, height: 60, display: "block", flexShrink: 0,
              filter: "drop-shadow(0 6px 14px rgba(245,158,11,0.3))",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
              {t("cosmeticPickerTitle", lang)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginTop: 2 }}>
              {stage.toUpperCase()} · {stickerCount} 🐝
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={saving}
            aria-label="close"
            style={{
              background: "#fff", border: "2px solid #FDE68A", borderRadius: 14,
              width: 44, height: 44, fontSize: 16,
              cursor: saving ? "not-allowed" : "pointer",
              color: "#92400E", fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: saving ? 0.5 : 1,
            }}
          >✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {/* Preview */}
          <div
            style={{
              background: "linear-gradient(160deg, #FEF3C7 0%, #FDE68A 100%)",
              borderRadius: 22,
              border: "3px solid #F59E0B",
              padding: "14px 12px 10px",
              marginBottom: 18,
              display: "flex", flexDirection: "column", alignItems: "center",
              boxShadow: "0 6px 16px rgba(245,158,11,0.2) inset",
            }}
          >
            <div style={{
              fontSize: 12, fontWeight: 900, color: "#92400E",
              letterSpacing: 0.5, marginBottom: 6,
            }}>
              ✨ {t("cosmeticPreview", lang)}
            </div>
            <div
              style={{
                position: "relative",
                width: 180, height: 180,
                background: "#fff",
                borderRadius: 20,
                border: "2px solid #FCD34D",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(245,158,11,0.18)",
              }}
            >
              {/* Stage base */}
              <img
                src={stageSrc}
                alt=""
                aria-hidden="true"
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "contain",
                }}
              />
              {/* Skin overlay */}
              {draft.skin && draft.skin !== "classic" && (
                <img
                  src={assetPath("skin", draft.skin)}
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "contain",
                    mixBlendMode: "multiply",
                  }}
                />
              )}
              {/* Pet (bottom-left) */}
              {draft.pet && (
                <img
                  src={assetPath("pet", draft.pet)}
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: "absolute", left: 6, bottom: 6,
                    width: 54, height: 54, objectFit: "contain",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
                  }}
                />
              )}
              {/* Hat (top-center) */}
              {draft.hat && (
                <img
                  src={assetPath("hat", draft.hat)}
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
                    width: 80, height: 64, objectFit: "contain",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.18))",
                  }}
                />
              )}
              {/* Trophy (bottom-right) */}
              {draft.trophy && (
                <img
                  src={assetPath("trophy", draft.trophy)}
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: "absolute", right: 6, bottom: 6,
                    width: 54, height: 54, objectFit: "contain",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
                  }}
                />
              )}
            </div>
          </div>

          {/* Skins section (no "none" — always has default "classic") */}
          <Section title={t("cosmeticSkins", lang)}>
            <Row>
              {ALL_SKINS.map((id) => {
                const unlocked = uSkins.has(id);
                const active = draft.skin === id;
                return (
                  <Tile
                    key={`skin-${id}`}
                    active={active}
                    unlocked={unlocked}
                    onClick={() => unlocked && setDraft((d) => ({ ...d, skin: id }))}
                    lockedHint={t("cosmeticLocked", lang)}
                    imageSrc={assetPath("skin", id)}
                  />
                );
              })}
            </Row>
          </Section>

          {/* Hats section */}
          <Section title={t("cosmeticHats", lang)}>
            <Row>
              <NoneTile
                active={draft.hat === null}
                onClick={() => setDraft((d) => ({ ...d, hat: null }))}
                label={t("cosmeticNone", lang)}
              />
              {ALL_HATS.map((id) => {
                const unlocked = uHats.has(id);
                const active = draft.hat === id;
                return (
                  <Tile
                    key={`hat-${id}`}
                    active={active}
                    unlocked={unlocked}
                    onClick={() => unlocked && setDraft((d) => ({ ...d, hat: id }))}
                    lockedHint={t("cosmeticLocked", lang)}
                    imageSrc={assetPath("hat", id)}
                  />
                );
              })}
            </Row>
          </Section>

          {/* Pets section */}
          <Section title={t("cosmeticPets", lang)}>
            <Row>
              <NoneTile
                active={draft.pet === null}
                onClick={() => setDraft((d) => ({ ...d, pet: null }))}
                label={t("cosmeticNone", lang)}
              />
              {ALL_PETS.map((id) => {
                const unlocked = uPets.has(id);
                const active = draft.pet === id;
                return (
                  <Tile
                    key={`pet-${id}`}
                    active={active}
                    unlocked={unlocked}
                    onClick={() => unlocked && setDraft((d) => ({ ...d, pet: id }))}
                    lockedHint={t("cosmeticLocked", lang)}
                    imageSrc={assetPath("pet", id)}
                  />
                );
              })}
            </Row>
          </Section>

          {/* Trophies section */}
          <Section title={t("cosmeticTrophies", lang)}>
            <Row>
              <NoneTile
                active={draft.trophy === null}
                onClick={() => setDraft((d) => ({ ...d, trophy: null }))}
                label={t("cosmeticNone", lang)}
              />
              {ALL_TROPHIES.map((id) => {
                const unlocked = uTrophies.has(id);
                const active = draft.trophy === id;
                return (
                  <Tile
                    key={`trophy-${id}`}
                    active={active}
                    unlocked={unlocked}
                    onClick={() => unlocked && setDraft((d) => ({ ...d, trophy: id }))}
                    lockedHint={t("cosmeticLocked", lang)}
                    imageSrc={assetPath("trophy", id)}
                  />
                );
              })}
            </Row>
          </Section>

          {error && (
            <div style={{
              background: "#FEF2F2", borderRadius: 12, padding: "10px 14px",
              marginTop: 10, border: "1.5px solid #FECACA",
              fontSize: 13, color: "#991B1B", fontWeight: 700,
            }}>
              ❌ {error}
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div style={{
          flexShrink: 0, padding: "12px 14px 16px",
          borderTop: "1.5px solid #FDE68A",
          background: "#FFFBEB",
          display: "flex", gap: 10, alignItems: "center",
        }}>
          <button
            onClick={handleCancel}
            disabled={saving}
            style={{
              flex: 1, minHeight: 54, borderRadius: 18,
              background: "#fff", border: "2px solid #FDE68A",
              color: "#92400E", fontWeight: 900, fontSize: 15,
              cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.12s",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {t("cosmeticCancel", lang)}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, minHeight: 54, borderRadius: 18,
              background: saving
                ? "#F3F4F6"
                : "linear-gradient(135deg, #F59E0B, #D97706)",
              color: saving ? "#CBD5E1" : "#fff",
              fontWeight: 900, fontSize: 17, border: "none",
              cursor: saving ? "wait" : "pointer",
              boxShadow: saving ? "none" : "0 10px 24px rgba(245,158,11,0.4), inset 0 -3px 0 rgba(0,0,0,0.15)",
              transition: "all 0.15s", letterSpacing: -0.2,
            }}
          >
            {saving ? "⟳" : t("cosmeticSave", lang)}
          </button>
        </div>
      </div>
    </>
  );
}

// === Sub-components ===

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 14, fontWeight: 900, color: "#B45309",
        marginBottom: 8, letterSpacing: -0.2,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex", gap: 10,
        overflowX: "auto", paddingBottom: 6,
        scrollbarWidth: "thin",
      }}
    >
      {children}
    </div>
  );
}

interface TileProps {
  active: boolean;
  unlocked: boolean;
  onClick: () => void;
  lockedHint: string;
  imageSrc: string;
}

function Tile({ active, unlocked, onClick, lockedHint, imageSrc }: TileProps) {
  return (
    <button
      onClick={onClick}
      disabled={!unlocked}
      title={unlocked ? undefined : lockedHint}
      aria-label={unlocked ? undefined : lockedHint}
      style={{
        position: "relative",
        width: 96, height: 96, flexShrink: 0,
        borderRadius: 18,
        background: unlocked ? "#fff" : "#F3F4F6",
        border: active
          ? "3px solid #F59E0B"
          : unlocked ? "2px solid #FDE68A" : "2px dashed #E5E7EB",
        cursor: unlocked ? "pointer" : "not-allowed",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 6,
        transition: "all 0.12s",
        boxShadow: active ? "0 4px 14px rgba(245,158,11,0.35)" : "none",
      }}
      onMouseDown={(e) => unlocked && ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.94)")}
      onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
    >
      <img
        src={imageSrc}
        alt=""
        aria-hidden="true"
        style={{
          width: 80, height: 80, objectFit: "contain",
          filter: unlocked ? "none" : "grayscale(1) opacity(0.45)",
        }}
      />
      {active && (
        <div style={{
          position: "absolute", top: -8, right: -8,
          width: 26, height: 26, borderRadius: "50%",
          background: "#F59E0B", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 900,
          border: "2px solid #fff",
          boxShadow: "0 2px 6px rgba(245,158,11,0.4)",
        }}>✓</div>
      )}
      {!unlocked && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, color: "#9CA3AF",
          pointerEvents: "none",
        }}>🔒</div>
      )}
    </button>
  );
}

function NoneTile({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 96, height: 96, flexShrink: 0,
        borderRadius: 18,
        background: active ? "#FEF3C7" : "#fff",
        border: active ? "3px solid #F59E0B" : "2px dashed #FDE68A",
        cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 4, padding: 4,
        color: "#92400E", fontWeight: 900, fontSize: 12,
        transition: "all 0.12s",
        position: "relative",
      }}
      onMouseDown={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.94)")}
      onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
    >
      <div style={{ fontSize: 28 }}>🚫</div>
      <div style={{ fontSize: 11, lineHeight: 1.2, textAlign: "center" }}>{label}</div>
      {active && (
        <div style={{
          position: "absolute", top: -8, right: -8,
          width: 26, height: 26, borderRadius: "50%",
          background: "#F59E0B", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 900,
          border: "2px solid #fff",
          boxShadow: "0 2px 6px rgba(245,158,11,0.4)",
        }}>✓</div>
      )}
    </button>
  );
}

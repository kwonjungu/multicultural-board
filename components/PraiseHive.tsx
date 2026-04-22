"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  UserConfig,
  RoomConfig,
  IndividualSticker,
  TeamSticker,
  StickerType,
  StickerGoal,
  StudentCosmetics,
  Stage,
  SkinId,
  HatId,
} from "@/lib/types";
import {
  stageOf,
  stageImage,
  stageImageWithSkin,
  stageImageWithHat,
  stageImageWithSkinAndHat,
  nextThreshold,
  progressInStage,
} from "@/lib/stage";
import {
  subscribeStudentStickers,
  subscribeTeamStickers,
  subscribeAllStudentCounts,
  subscribeGoal,
  subscribeCosmetics,
  resetSeason,
  setGoalTarget,
} from "@/lib/stickers";
import { HONEY } from "@/lib/constants";
import { t, tFmt } from "@/lib/i18n";
import anchorsData from "@/public/stickers/anchors.json";

// ============================================================
// Praise Hive (칭찬 꿀벌집) — 4-tab student/teacher dashboard.
// IMPORTANT: Since we don't have a roster→clientId mapping, the
// "give sticker" flow uses the student's NAME as the pseudo
// clientId — i.e. the parent will call setSticker(name) so that
// all stickers for that named slot land in one bucket. The
// `Individual Race` tab uses counts keyed by real clientIds
// (from subscribeAllStudentCounts) and only resolves the
// current user's display name (others show as `학생 #xxxxxx`).
// ============================================================

interface Props {
  user: UserConfig;
  roomCode: string;
  roomConfig: RoomConfig;
  myClientId: string;
  onBack: () => void;
  /**
   * Teacher opens the give-sticker modal for a student.
   * NOTE: studentClientId here is actually the student's NAME
   * (pseudo clientId) because roster→clientId mapping is not
   * yet available. The sticker subsystem will store them under
   * that name key, which is fine as long as the same convention
   * is used everywhere in the teacher flow.
   */
  onOpenGive: (studentClientId: string, studentName: string) => void;
  onOpenCosmetics: () => void;
}

type Tab = "mine" | "race" | "team" | "manage";

const STICKER_TYPES: StickerType[] = [
  "helpful",
  "brave",
  "creative",
  "cooperative",
  "persistent",
  "curious",
];

const TYPE_LABEL_KEY: Record<StickerType, string> = {
  helpful: "stickerType_helpful",
  brave: "stickerType_brave",
  creative: "stickerType_creative",
  cooperative: "stickerType_cooperative",
  persistent: "stickerType_persistent",
  curious: "stickerType_curious",
};

const TYPE_GUIDE_KEY: Record<StickerType, string> = {
  helpful: "stickerGuide_helpful",
  brave: "stickerGuide_brave",
  creative: "stickerGuide_creative",
  cooperative: "stickerGuide_cooperative",
  persistent: "stickerGuide_persistent",
  curious: "stickerGuide_curious",
};

const TYPE_COLOR: Record<StickerType, string> = {
  helpful: "#F59E0B",
  brave: "#F97316",
  creative: "#EC4899",
  cooperative: "#10B981",
  persistent: "#22C55E",
  curious: "#3B82F6",
};

const STAGE_LABEL_KEY: Record<Stage, string> = {
  egg: "phStageEgg",
  larva: "phStageLarva",
  pupa: "phStagePupa",
  bee: "phStageBee",
  queen: "phStageQueen",
};

// Head anchors loaded from /public/stickers/anchors.json.
// Key: "stage-{id}" (egg/larva/pupa/bee/queen) or "skin-{id}".
interface CharAnchor {
  headXPct: number;
  headTopYPct: number;
  hatScalePct: number;
}
const ANCHORS = anchorsData as unknown as Record<string, CharAnchor>;
const FALLBACK_ANCHOR: CharAnchor = { headXPct: 50, headTopYPct: 18, hatScalePct: 38 };

const STAGE_ANCHOR_KEY: Record<Stage, string> = {
  egg: "stage-1-egg",
  larva: "stage-2-larva",
  pupa: "stage-3-pupa",
  bee: "stage-4-bee",
  queen: "stage-5-queen",
};

// ---- helpers ----

function shortId(id: string): string {
  if (!id) return "??????";
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  return (clean || id).slice(0, 6);
}

function timeAgo(ts: number, lang: string): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return t("phAgoSec", lang);
  const m = Math.floor(s / 60);
  if (m < 60) return tFmt("phAgoMin", lang, { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return tFmt("phAgoHour", lang, { n: h });
  const d = Math.floor(h / 24);
  return tFmt("phAgoDay", lang, { n: d });
}

function daysSince(ts: number): number {
  return Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24)));
}

/** Character image with multi-step fallback chain:
 *  skin+hat composite → skin-only → classic+hat composite → plain stage.
 *  각 404 시 onError 로 다음 후보 시도. 최종 폴백까지 실패하면 emoji 숨김.
 */
function CharacterImage({
  stage,
  skin,
  hat,
}: {
  stage: Stage;
  skin: SkinId;
  hat: HatId;
}) {
  // 후보 URL 배열 (순서대로 시도). classic & !hat 은 [stageImage] 하나만.
  const candidates: string[] = [];
  if (hat) {
    candidates.push(stageImageWithSkinAndHat(stage, skin, hat));
    if (skin !== "classic") candidates.push(stageImageWithHat(stage, hat));
  }
  if (skin !== "classic") candidates.push(stageImageWithSkin(stage, skin));
  candidates.push(stageImage(stage));
  const [idx, setIdx] = useState(0);
  const src = candidates[Math.min(idx, candidates.length - 1)];
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setIdx((i) => i + 1)}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        animation: "heroBeeFloat 3s ease-in-out infinite",
        filter: "drop-shadow(0 8px 18px rgba(245,158,11,0.4))",
        zIndex: 1,
      }}
    />
  );
}

// ============================================================
// Top-level component
// ============================================================

export default function PraiseHive({
  user,
  roomCode,
  roomConfig,
  myClientId,
  onBack,
  onOpenGive,
  onOpenCosmetics,
}: Props) {
  const lang = user.myLang;
  const [tab, setTab] = useState<Tab>("mine");

  const tabs: { id: Tab; labelKey: string }[] = useMemo(() => {
    const base: { id: Tab; labelKey: string }[] = [
      { id: "mine", labelKey: "phTabMine" },
      { id: "race", labelKey: "phTabIndividual" },
      { id: "team", labelKey: "phTabTeam" },
    ];
    if (user.isTeacher) base.push({ id: "manage", labelKey: "phTabManage" });
    return base;
  }, [user.isTeacher]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${HONEY.h50} 0%, ${HONEY.h100} 60%, ${HONEY.h200} 100%)`,
        fontFamily: "'Noto Sans KR', sans-serif",
        padding: "18px 14px 32px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Honeycomb bg */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "url('/patterns/honeycomb.png')",
          backgroundSize: "300px auto",
          backgroundRepeat: "repeat",
          opacity: 0.18,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ maxWidth: 760, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            background: "#fff",
            borderRadius: 22,
            padding: "12px 14px",
            border: `2px solid ${HONEY.h200}`,
            boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
          }}
        >
          <button
            onClick={onBack}
            aria-label="back"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "#fff",
              border: `2px solid ${HONEY.h200}`,
              fontSize: 18,
              fontWeight: 900,
              color: HONEY.h800,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ←
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: "#1F2937",
                letterSpacing: -0.3,
              }}
            >
              {t("praiseHiveTitle", lang)}
            </div>
            <div style={{ fontSize: 12, color: HONEY.h800, fontWeight: 700, marginTop: 2 }}>
              🚪 {roomCode}
            </div>
          </div>
          <img
            src="/mascot/bee-welcome.png"
            alt=""
            aria-hidden="true"
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              filter: "drop-shadow(0 4px 10px rgba(245,158,11,0.35))",
            }}
          />
        </div>

        {/* Hex-shaped tabs */}
        <div
          role="tablist"
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 18,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tb.id)}
                style={{
                  minWidth: 110,
                  minHeight: 48,
                  padding: "10px 16px",
                  background: active ? HONEY.h400 : "#fff",
                  color: active ? "#fff" : HONEY.h800,
                  border: `2px solid ${active ? HONEY.h500 : HONEY.h200}`,
                  // Hex-ish shape via clip-path
                  clipPath:
                    "polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%)",
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: "pointer",
                  letterSpacing: -0.3,
                  boxShadow: active
                    ? "0 6px 16px rgba(245,158,11,0.35)"
                    : "0 2px 6px rgba(180,83,9,0.08)",
                  transition: "transform 0.15s",
                }}
              >
                {t(tb.labelKey, lang)}
              </button>
            );
          })}
        </div>

        {tab === "mine" && (
          <MyHiveTab
            lang={lang}
            roomCode={roomCode}
            myClientId={myClientId}
            onOpenCosmetics={onOpenCosmetics}
          />
        )}
        {tab === "race" && (
          <RaceTab lang={lang} roomCode={roomCode} user={user} myClientId={myClientId} />
        )}
        {tab === "team" && <TeamTab lang={lang} roomCode={roomCode} />}
        {tab === "manage" && user.isTeacher && (
          <ManageTab
            lang={lang}
            roomCode={roomCode}
            roomConfig={roomConfig}
            onOpenGive={onOpenGive}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB 1 — My Hive
// ============================================================

function MyHiveTab({
  lang,
  roomCode,
  myClientId,
  onOpenCosmetics,
}: {
  lang: string;
  roomCode: string;
  myClientId: string;
  onOpenCosmetics: () => void;
}) {
  const [list, setList] = useState<IndividualSticker[]>([]);
  const [cosmetics, setCosmetics] = useState<StudentCosmetics>({
    skin: "classic",
    hat: null,
    pet: null,
    trophy: null,
  });
  const [selectedSticker, setSelectedSticker] = useState<IndividualSticker | null>(null);

  useEffect(() => {
    const unsub = subscribeStudentStickers(roomCode, myClientId, setList);
    return () => unsub();
  }, [roomCode, myClientId]);

  useEffect(() => {
    const unsub = subscribeCosmetics(roomCode, myClientId, setCosmetics);
    return () => unsub();
  }, [roomCode, myClientId]);

  const count = list.length;
  const stage = stageOf(count);
  const progress = progressInStage(count);
  const next = nextThreshold(count);
  const remainingToNext = next === null ? null : next - count;
  const nextStage: Stage | null =
    next === null
      ? null
      : count < 2
      ? "larva"
      : count < 4
      ? "pupa"
      : count < 8
      ? "bee"
      : "queen";

  // 이미지 합성 우선순위:
  //  1) skin+hat 조합: /stickers/skin-hats/ (100장, classic 포함 full coverage via stage-hats fallback)
  //  2) skin 만: stage+skin 재채색본
  //  3) 모자만: classic+hat 합성본
  //  4) 기본: stage 원본
  // useCompositeHat: 합성본 이미지 (skin+hat 또는 classic+hat) 사용 가능 여부
  const useCompositeHat = cosmetics.hat !== null;
  const charImg = useCompositeHat && cosmetics.hat
    ? stageImageWithSkinAndHat(stage, cosmetics.skin, cosmetics.hat)
    : stageImageWithSkin(stage, cosmetics.skin);
  const anchorKey = STAGE_ANCHOR_KEY[stage];
  const anchor = ANCHORS[anchorKey] ?? FALLBACK_ANCHOR;

  // Character box size (px). Keep square.
  const CHAR_BOX = 240;

  // Hat placement (px, relative to CHAR_BOX).
  // Hat bottom sinks 15% into the head so it visually rests on top.
  const hatW = (anchor.hatScalePct / 100) * CHAR_BOX;
  const hatH = hatW;
  const hatCenterX = (anchor.headXPct / 100) * CHAR_BOX;
  const hatBottomY = (anchor.headTopYPct / 100) * CHAR_BOX + hatH * 0.15;
  const hatLeft = hatCenterX - hatW / 2;
  const hatTop = hatBottomY - hatH;

  // My sticker type counts (for per-type stats)
  const myTypeCounts: Record<StickerType, number> = {
    helpful: 0, brave: 0, creative: 0,
    cooperative: 0, persistent: 0, curious: 0,
  };
  for (const s of list) myTypeCounts[s.type] = (myTypeCounts[s.type] ?? 0) + 1;
  const myMaxType = Math.max(1, ...Object.values(myTypeCounts));

  // Stickers in chronological order — each fills one hex cell.
  const received = [...list].sort((a, b) => a.timestamp - b.timestamp);

  // Honeycomb — pointy-top hex tiling with exact √3/2 ratio (no rounding).
  // Adjacent rows overlap vertically by exactly H/4 and odd rows shift by W/2.
  const HEX_ROWS = 7;
  const HEX_COLS = 7;
  const HEX_COUNT = HEX_ROWS * HEX_COLS; // 49
  const HEX_W = 44;
  const HEX_H = HEX_W * 2 / Math.sqrt(3); // ≈ 50.81 — fractional for pixel-perfect tiling
  const HEX_ROW_STEP = HEX_H * 0.75;       // row-to-row vertical distance
  const HEX_ROW_OVERLAP = HEX_H - HEX_ROW_STEP; // ≈ 12.70
  const filled = Math.min(count, HEX_COUNT);
  const extra = count > HEX_COUNT ? count - HEX_COUNT : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Hero character card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "22px 18px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
          textAlign: "center",
        }}
      >
        {/* Character wrapper — character exactly centered; hat positioned via measured anchor */}
        <div
          style={{
            position: "relative",
            width: CHAR_BOX,
            height: CHAR_BOX,
            margin: "0 auto",
          }}
        >
          {/* Trophy (bottom-left, slightly outside box) */}
          {cosmetics.trophy && (
            <img
              src={`/stickers/trophy-${cosmetics.trophy}.png`}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                left: -26,
                bottom: -8,
                width: 78,
                height: 78,
                zIndex: 2,
                filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.15))",
              }}
            />
          )}
          {/* Main character fills the wrapper — 다단계 폴백:
              skin+hat 합성 → skin 단독 → stage 기본 */}
          <CharacterImage
            stage={stage}
            skin={cosmetics.skin}
            hat={cosmetics.hat}
          />
          {/* Hat overlay: 사용 안 함 — CharacterImage 가 합성본/폴백 전부 처리. */}
          {false && cosmetics.hat && !useCompositeHat && (
            <img
              src={`/stickers/hat-${cosmetics.hat}.png`}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                left: hatLeft,
                top: hatTop,
                width: hatW,
                height: hatH,
                zIndex: 3,
                animation: "heroBeeFloat 3s ease-in-out infinite",
                filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.2))",
              }}
            />
          )}
          {/* Pet (bottom-right, slightly outside box) */}
          {cosmetics.pet && (
            <img
              src={`/stickers/pet-${cosmetics.pet}.png`}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                right: -30,
                bottom: -12,
                width: 96,
                height: 96,
                zIndex: 2,
                filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.15))",
              }}
            />
          )}
        </div>

        {/* Stage label */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: HONEY.h800,
            marginTop: 6,
            letterSpacing: -0.3,
          }}
        >
          {t(STAGE_LABEL_KEY[stage], lang)}
        </div>
        <div style={{ fontSize: 14, color: HONEY.h700, fontWeight: 700, marginTop: 2 }}>
          {tFmt("phCountLabel", lang, { n: count })}
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: 14,
            height: 14,
            background: HONEY.h100,
            borderRadius: 999,
            overflow: "hidden",
            border: `1px solid ${HONEY.h200}`,
          }}
        >
          <div
            style={{
              width: `${progress.percent}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${HONEY.h400}, ${HONEY.h500})`,
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: HONEY.h700, fontWeight: 700, marginTop: 6 }}>
          {next === null || nextStage === null || remainingToNext === null
            ? t("phMaxStage", lang)
            : tFmt("phNextHint", lang, {
                label: t(STAGE_LABEL_KEY[nextStage], lang),
                n: remainingToNext,
              })}
        </div>

        {/* Customize button */}
        <button
          onClick={onOpenCosmetics}
          style={{
            marginTop: 14,
            minHeight: 44,
            padding: "10px 22px",
            background: `linear-gradient(135deg, ${HONEY.h400}, ${HONEY.h500})`,
            color: "#fff",
            border: "none",
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 6px 16px rgba(245,158,11,0.3)",
            letterSpacing: -0.2,
          }}
        >
          {t("phCustomize", lang)}
        </button>
      </div>

      {/* Recent praise feed — latest 3 received stickers, big cards */}
      {count > 0 && <RecentPraiseFeed lang={lang} list={list} />}

      {/* Praise guide accordion */}
      <PraiseGuide lang={lang} />

      {/* Real honeycomb — absolute-positioned pointy-top hex tiling (pixel-perfect, no flex overlap) */}
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "18px 14px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: HEX_W * HEX_COLS + HEX_W / 2, // + odd-row shift
            height: (HEX_ROWS - 1) * HEX_ROW_STEP + HEX_H,
            margin: "0 auto",
          }}
        >
          {Array.from({ length: HEX_COUNT }).map((_, i) => {
            const r = Math.floor(i / HEX_COLS);
            const c = i % HEX_COLS;
            const x = c * HEX_W + (r % 2 === 1 ? HEX_W / 2 : 0);
            const y = r * HEX_ROW_STEP;
            const isFilled = i < filled;
            const sticker = isFilled ? received[i] : null;
            return (
              <div
                key={i}
                onClick={() => { if (sticker) setSelectedSticker(sticker); }}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: HEX_W,
                  height: HEX_H,
                  clipPath:
                    "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                  background: isFilled
                    ? `radial-gradient(circle at 50% 40%, ${HONEY.h300} 0%, ${HONEY.h400} 60%, ${HONEY.h500} 100%)`
                    : HONEY.h50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.3s, transform 0.15s",
                  cursor: isFilled ? "pointer" : "default",
                }}
                title={sticker ? t(TYPE_LABEL_KEY[sticker.type], lang) : undefined}
              >
                {sticker ? (
                  <img
                    src={`/stickers/sticker-${sticker.type}.png`}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: "82%",
                      height: "82%",
                      objectFit: "contain",
                      // Radial fade masks any leftover PNG-baked edges.
                      WebkitMaskImage:
                        "radial-gradient(circle at center, #000 58%, transparent 88%)",
                      maskImage:
                        "radial-gradient(circle at center, #000 58%, transparent 88%)",
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        {extra > 0 && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <span
              style={{
                display: "inline-block",
                background: HONEY.h100,
                color: HONEY.h800,
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {tFmt("phMoreCells", lang, { n: extra })}
            </span>
          </div>
        )}
      </div>

      {/* My sticker type stats */}
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "14px 16px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: HONEY.h800,
            marginBottom: 10,
          }}
        >
          {t("phMyTypeStats", lang)}
        </div>
        {count === 0 ? (
          <div style={{ fontSize: 13, color: HONEY.h700, fontWeight: 600 }}>
            {t("phNoStickersYet", lang)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {STICKER_TYPES.map((tp) => {
              const c = myTypeCounts[tp];
              const pct = Math.round((c / myMaxType) * 100);
              return (
                <div
                  key={tp}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "36px 1fr auto",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <img
                    src={`/stickers/sticker-${tp}.png`}
                    alt=""
                    aria-hidden="true"
                    style={{ width: 32, height: 32 }}
                  />
                  <div
                    style={{
                      position: "relative",
                      background: HONEY.h50,
                      borderRadius: 10,
                      height: 26,
                      overflow: "hidden",
                      border: `1px solid ${HONEY.h100}`,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${pct}%`,
                        background: TYPE_COLOR[tp],
                        opacity: 0.6,
                        transition: "width 0.5s",
                      }}
                    />
                    <div
                      style={{
                        position: "relative",
                        padding: "3px 10px",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#1F2937",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {t(TYPE_LABEL_KEY[tp], lang)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: HONEY.h800,
                      minWidth: 28,
                      textAlign: "right",
                    }}
                  >
                    {c}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticker detail popover (tap a hex cell) */}
      {selectedSticker && (
        <StickerDetailPopover
          sticker={selectedSticker}
          lang={lang}
          onClose={() => setSelectedSticker(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// TAB 2 — Individual Race
// ============================================================

function RaceTab({
  lang,
  roomCode,
  user,
  myClientId,
}: {
  lang: string;
  roomCode: string;
  user: UserConfig;
  myClientId: string;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = subscribeAllStudentCounts(roomCode, setCounts);
    return () => unsub();
  }, [roomCode]);

  const entries = useMemo(() => {
    const arr = Object.entries(counts).map(([id, c]) => ({
      id,
      count: c,
      name: id === myClientId ? user.myName : `${t("phStudentPrefix", lang)} #${shortId(id)}`,
    }));
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }, [counts, myClientId, user.myName, lang]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const maxCount = entries[0]?.count ?? 1;

  const podiumMeta = [
    { key: "phPodium1", color: "#FCD34D", accent: "#B45309", crown: "/stickers/hive-crown.png" },
    { key: "phPodium2", color: "#E5E7EB", accent: "#4B5563", crown: null },
    { key: "phPodium3", color: "#FDBA74", accent: "#9A3412", crown: null },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "16px 14px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, color: HONEY.h800, marginBottom: 12 }}>
          {t("phIndividualTitle", lang)}
        </div>

        {entries.length === 0 ? (
          <div style={{ fontSize: 13, color: HONEY.h700, fontWeight: 600, textAlign: "center", padding: 20 }}>
            {t("phNoStickersYet", lang)}
          </div>
        ) : (
          <>
            {/* Podium */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginBottom: 18,
              }}
            >
              {top3.map((e, idx) => {
                const meta = podiumMeta[idx];
                const st = stageOf(e.count);
                return (
                  <div
                    key={e.id}
                    style={{
                      background: `linear-gradient(160deg, ${meta.color}, #fff 120%)`,
                      border: `2px solid ${meta.color}`,
                      borderRadius: 18,
                      padding: "14px 8px",
                      textAlign: "center",
                      position: "relative",
                    }}
                  >
                    {meta.crown && (
                      <img
                        src={meta.crown}
                        alt=""
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          top: -18,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 36,
                          height: 36,
                        }}
                      />
                    )}
                    <div style={{ fontSize: 12, fontWeight: 900, color: meta.accent }}>
                      {t(meta.key, lang)}
                    </div>
                    <img
                      src={stageImage(st)}
                      alt=""
                      aria-hidden="true"
                      style={{
                        width: 64,
                        height: 64,
                        margin: "6px auto 4px",
                        display: "block",
                      }}
                    />
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#1F2937",
                        wordBreak: "break-word",
                        minHeight: 18,
                      }}
                    >
                      {e.name}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: meta.accent,
                        marginTop: 2,
                      }}
                    >
                      {e.count}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rest as horizontal bars */}
            {rest.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rest.map((e, idx) => {
                  const pct = maxCount === 0 ? 0 : Math.round((e.count / maxCount) * 100);
                  return (
                    <div
                      key={e.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr auto",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: HONEY.h700,
                          textAlign: "right",
                        }}
                      >
                        {idx + 4}
                      </div>
                      <div
                        style={{
                          position: "relative",
                          background: HONEY.h50,
                          borderRadius: 10,
                          height: 28,
                          overflow: "hidden",
                          border: `1px solid ${HONEY.h100}`,
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${HONEY.h300}, ${HONEY.h500})`,
                            transition: "width 0.5s",
                          }}
                        />
                        <div
                          style={{
                            position: "relative",
                            padding: "4px 10px",
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#1F2937",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {e.name}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 900,
                          color: HONEY.h800,
                          minWidth: 28,
                          textAlign: "right",
                        }}
                      >
                        {e.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB 3 — Team Quest
// ============================================================

function TeamTab({ lang, roomCode }: { lang: string; roomCode: string }) {
  const [team, setTeam] = useState<TeamSticker[]>([]);
  const [goal, setGoal] = useState<StickerGoal | null>(null);

  useEffect(() => {
    const unsub = subscribeTeamStickers(roomCode, setTeam);
    return () => unsub();
  }, [roomCode]);

  useEffect(() => {
    const unsub = subscribeGoal(roomCode, setGoal);
    return () => unsub();
  }, [roomCode]);

  const total = team.length;
  const target = goal?.target || 100;
  const pct = Math.max(0, Math.min(100, Math.round((total / target) * 100)));
  const achieved = total >= target;

  const recent = [...team].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  // SVG ring
  const size = 220;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Banner */}
      <div
        style={{
          background: achieved
            ? `linear-gradient(135deg, #FEF3C7, #FBBF24)`
            : "#fff",
          borderRadius: 22,
          padding: "18px 16px",
          border: `2px solid ${achieved ? HONEY.h500 : HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: HONEY.h800,
            marginBottom: 4,
          }}
        >
          {t("phTeamTitle", lang)}
        </div>
        <div style={{ fontSize: 14, color: HONEY.h700, fontWeight: 700 }}>
          {tFmt("phTeamGoalBanner", lang, { total, target })}
        </div>
      </div>

      {/* Ring */}
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "20px 16px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
          textAlign: "center",
          position: "relative",
        }}
      >
        {achieved && (
          <img
            src="/stickers/confetti-honey.png"
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.35,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}
        <div style={{ position: "relative", zIndex: 1, display: "inline-block" }}>
          <svg width={size} height={size}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={HONEY.h100}
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={achieved ? HONEY.h500 : HONEY.h400}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
            <text
              x="50%"
              y="46%"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="36"
              fontWeight="900"
              fill={HONEY.h800}
            >
              {total}
            </text>
            <text
              x="50%"
              y="62%"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="16"
              fontWeight="700"
              fill={HONEY.h700}
            >
              / {target}
            </text>
          </svg>
        </div>
        {achieved && (
          <div
            style={{
              position: "relative",
              zIndex: 1,
              marginTop: 8,
              fontSize: 18,
              fontWeight: 900,
              color: HONEY.h800,
              letterSpacing: -0.3,
            }}
          >
            {t("phCelebrate", lang)}
          </div>
        )}
      </div>

      {/* Recent contributions */}
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "14px 16px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: HONEY.h800,
            marginBottom: 10,
          }}
        >
          {t("phRecentContribs", lang)}
        </div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 13, color: HONEY.h700, fontWeight: 600 }}>
            {t("phNoStickersYet", lang)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recent.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 10px",
                  background: HONEY.h50,
                  borderRadius: 12,
                  border: `1px solid ${HONEY.h100}`,
                }}
              >
                <img
                  src={`/stickers/sticker-${s.type}.png`}
                  alt=""
                  aria-hidden="true"
                  style={{ width: 28, height: 28, flexShrink: 0 }}
                />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#1F2937" }}>
                  {t(TYPE_LABEL_KEY[s.type], lang)}
                </div>
                <div style={{ fontSize: 11, color: HONEY.h700, fontWeight: 700 }}>
                  #{shortId(s.contributorClientId)}
                </div>
                <div style={{ fontSize: 11, color: HONEY.h700, fontWeight: 700 }}>
                  {timeAgo(s.timestamp, lang)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB 4 — Manage (Teacher only)
// ============================================================

function ManageTab({
  lang,
  roomCode,
  roomConfig,
  onOpenGive,
}: {
  lang: string;
  roomCode: string;
  roomConfig: RoomConfig;
  onOpenGive: (studentClientId: string, studentName: string) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [goal, setGoal] = useState<StickerGoal | null>(null);
  const [team, setTeam] = useState<TeamSticker[]>([]);

  useEffect(() => {
    const unsub = subscribeAllStudentCounts(roomCode, setCounts);
    return () => unsub();
  }, [roomCode]);

  useEffect(() => {
    const unsub = subscribeGoal(roomCode, setGoal);
    return () => unsub();
  }, [roomCode]);

  useEffect(() => {
    const unsub = subscribeTeamStickers(roomCode, setTeam);
    return () => unsub();
  }, [roomCode]);

  // Also need per-student sticker details for the 30-day bar chart,
  // but we don't want 30 individual subscriptions. We use the team
  // stickers as representative of daily activity (team stickers are
  // timestamped). Type stats are limited to team list alone.
  const totalIndividual = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );
  const totalTeam = team.length;

  // --- Reset ---
  const [pendingReset, setPendingReset] = useState(false);
  useEffect(() => {
    if (!pendingReset) return;
    const id = setTimeout(() => setPendingReset(false), 3000);
    return () => clearTimeout(id);
  }, [pendingReset]);

  const handleReset = async () => {
    if (!pendingReset) {
      setPendingReset(true);
      return;
    }
    setPendingReset(false);
    try {
      await resetSeason(roomCode);
    } catch (err) {
      console.error("resetSeason failed", err);
    }
  };

  // --- Goal edit ---
  const [goalDraft, setGoalDraft] = useState<string>("");
  useEffect(() => {
    setGoalDraft(String(goal?.target ?? 100));
  }, [goal?.target]);

  const handleSaveGoal = async () => {
    const n = Math.max(1, Math.min(9999, Math.floor(Number(goalDraft) || 0)));
    try {
      await setGoalTarget(roomCode, n);
    } catch (err) {
      console.error("setGoalTarget failed", err);
    }
  };

  const seasonStart = goal?.seasonStart ?? Date.now();
  const days = daysSince(seasonStart) + 1;

  // --- Type stats (from team stickers only; individuals need per-id fetch)
  const typeCounts: Record<StickerType, number> = {
    helpful: 0,
    brave: 0,
    creative: 0,
    cooperative: 0,
    persistent: 0,
    curious: 0,
  };
  for (const s of team) typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1;
  const maxType = Math.max(1, ...Object.values(typeCounts));

  // --- 30-day daily bars (based on team stickers)
  const daily: number[] = useMemo(() => {
    const bins = new Array(30).fill(0) as number[];
    const now = Date.now();
    for (const s of team) {
      const dayAgo = Math.floor((now - s.timestamp) / (1000 * 60 * 60 * 24));
      if (dayAgo >= 0 && dayAgo < 30) bins[29 - dayAgo] += 1;
    }
    return bins;
  }, [team]);
  const maxDaily = Math.max(1, ...daily);

  const roster = roomConfig.roster ?? [];

  // Student → sticker count: we don't have real mapping, so show the
  // name itself as a pseudo-clientId. If teacher gives stickers using
  // name as the key, `counts[name]` will populate.
  const rosterWithCounts = roster.map((name) => ({
    name,
    count: counts[name] ?? 0,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Season info */}
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "14px 16px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: HONEY.h800,
            marginBottom: 10,
          }}
        >
          {t("phSeasonInfo", lang)}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatChip label={t("phSeasonInfo", lang)} value={tFmt("phSeasonDays", lang, { n: days })} />
          <StatChip label={t("phTotalStickers", lang)} value={`${totalIndividual + totalTeam}`} />
          <StatChip label={t("phTabIndividual", lang)} value={`${totalIndividual}`} />
          <StatChip label={t("phTabTeam", lang)} value={`${totalTeam}`} />
        </div>

        <button
          onClick={handleReset}
          style={{
            marginTop: 14,
            minHeight: 44,
            padding: "10px 18px",
            background: pendingReset ? "#DC2626" : "#fff",
            color: pendingReset ? "#fff" : "#B91C1C",
            border: `2px solid ${pendingReset ? "#B91C1C" : "#FCA5A5"}`,
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 900,
            cursor: "pointer",
            letterSpacing: -0.2,
          }}
        >
          {pendingReset ? t("phResetConfirm", lang) : t("phSeasonReset", lang)}
        </button>
      </div>

      {/* Goal edit */}
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "14px 16px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: HONEY.h800,
            marginBottom: 10,
          }}
        >
          {t("phEditGoal", lang)}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            min={1}
            max={9999}
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            style={{
              flex: 1,
              minHeight: 44,
              padding: "10px 14px",
              border: `2px solid ${HONEY.h200}`,
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 800,
              color: HONEY.h800,
              background: HONEY.h50,
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleSaveGoal}
            style={{
              minHeight: 44,
              padding: "10px 22px",
              background: `linear-gradient(135deg, ${HONEY.h400}, ${HONEY.h500})`,
              color: "#fff",
              border: "none",
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 6px 16px rgba(245,158,11,0.3)",
            }}
          >
            {t("phSave", lang)}
          </button>
        </div>
      </div>

      {/* Student list */}
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "14px 16px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: HONEY.h800,
            marginBottom: 10,
          }}
        >
          {t("phStudentList", lang)}
        </div>
        {rosterWithCounts.length === 0 ? (
          <div style={{ fontSize: 13, color: HONEY.h700, fontWeight: 600 }}>
            {t("phNoStudents", lang)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rosterWithCounts.map((r) => (
              <div
                key={r.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  background: HONEY.h50,
                  borderRadius: 12,
                  border: `1px solid ${HONEY.h100}`,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#1F2937",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.name}
                </div>
                <div
                  style={{
                    background: HONEY.h200,
                    color: HONEY.h800,
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 900,
                    minWidth: 36,
                    textAlign: "center",
                  }}
                >
                  {r.count}
                </div>
                <button
                  onClick={() => onOpenGive(r.name, r.name)}
                  style={{
                    minHeight: 36,
                    padding: "6px 12px",
                    background: `linear-gradient(135deg, ${HONEY.h400}, ${HONEY.h500})`,
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("phGiveSticker", lang)}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Type stats */}
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "14px 16px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: HONEY.h800,
            marginBottom: 10,
          }}
        >
          {t("phTypeStats", lang)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STICKER_TYPES.map((tp) => {
            const c = typeCounts[tp];
            const pct = Math.round((c / maxType) * 100);
            return (
              <div
                key={tp}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr auto",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <img
                  src={`/stickers/sticker-${tp}.png`}
                  alt=""
                  aria-hidden="true"
                  style={{ width: 28, height: 28 }}
                />
                <div
                  style={{
                    position: "relative",
                    background: HONEY.h50,
                    borderRadius: 10,
                    height: 24,
                    overflow: "hidden",
                    border: `1px solid ${HONEY.h100}`,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${pct}%`,
                      background: TYPE_COLOR[tp],
                      opacity: 0.55,
                      transition: "width 0.5s",
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      padding: "2px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#1F2937",
                    }}
                  >
                    {t(TYPE_LABEL_KEY[tp], lang)}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: HONEY.h800,
                    minWidth: 28,
                    textAlign: "right",
                  }}
                >
                  {c}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily 30-day bar chart */}
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "14px 16px",
          border: `2px solid ${HONEY.h200}`,
          boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: HONEY.h800,
            marginBottom: 10,
          }}
        >
          {t("phDaily30", lang)}
        </div>
        <svg
          viewBox="0 0 300 80"
          preserveAspectRatio="none"
          style={{ width: "100%", height: 80, display: "block" }}
        >
          {daily.map((v, i) => {
            const barW = 300 / 30;
            const barX = i * barW;
            const h = (v / maxDaily) * 72;
            const barY = 78 - h;
            return (
              <rect
                key={i}
                x={barX + 1}
                y={barY}
                width={barW - 2}
                height={h}
                fill={HONEY.h400}
                rx={2}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ============================================================
// Small pieces
// ============================================================

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: HONEY.h50,
        border: `1px solid ${HONEY.h200}`,
        borderRadius: 14,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 84,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, color: HONEY.h700, letterSpacing: 0.2 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: HONEY.h800 }}>{value}</div>
    </div>
  );
}

// ============================================================
// Recent Praise Feed — top 3 most recent stickers, big cards
// ============================================================

function RecentPraiseFeed({
  lang,
  list,
}: {
  lang: string;
  list: IndividualSticker[];
}) {
  const recent = useMemo(
    () => [...list].sort((a, b) => b.timestamp - a.timestamp).slice(0, 3),
    [list],
  );
  if (recent.length === 0) return null;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "14px 16px 16px",
        border: `2px solid ${HONEY.h200}`,
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 900,
          color: HONEY.h800,
          marginBottom: 10,
        }}
      >
        {t("phRecentPraise", lang)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recent.map((s) => {
          const fromLabel =
            s.source === "mission"
              ? t("phFromMission", lang)
              : s.fromTeacherName || t("phFromTeacher", lang);
          return (
            <div
              key={s.id}
              style={{
                display: "grid",
                gridTemplateColumns: "54px 1fr auto",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                background: `linear-gradient(135deg, ${HONEY.h50}, #fff)`,
                borderRadius: 14,
                border: `1.5px solid ${HONEY.h200}`,
              }}
            >
              <img
                src={`/stickers/sticker-${s.type}.png`}
                alt=""
                aria-hidden="true"
                style={{
                  width: 54,
                  height: 54,
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: "#1F2937",
                    letterSpacing: -0.2,
                    lineHeight: 1.2,
                  }}
                >
                  {t(TYPE_LABEL_KEY[s.type], lang)}
                </div>
                {s.memo && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: HONEY.h800,
                      marginTop: 3,
                      lineHeight: 1.3,
                      wordBreak: "break-word",
                    }}
                  >
                    "{s.memo}"
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: HONEY.h700,
                    marginTop: 3,
                  }}
                >
                  {fromLabel} · {timeAgo(s.timestamp, lang)}
                </div>
              </div>
              <div style={{ fontSize: 20 }}>✨</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Praise Guide — collapsible guide listing 6 sticker types
// ============================================================

function PraiseGuide({ lang }: { lang: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "12px 16px",
        border: `2px solid ${HONEY.h200}`,
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "6px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 15,
          fontWeight: 900,
          color: HONEY.h800,
          letterSpacing: -0.2,
          textAlign: "left",
        }}
      >
        <span>{t("phGuideTitle", lang)}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: HONEY.h700,
            background: HONEY.h50,
            border: `1px solid ${HONEY.h200}`,
            borderRadius: 999,
            padding: "4px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {open ? t("phGuideCollapse", lang) : t("phGuideExpand", lang)}
          <span style={{ marginLeft: 4 }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {STICKER_TYPES.map((tp) => (
            <div
              key={tp}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: HONEY.h50,
                borderRadius: 12,
                border: `1px solid ${HONEY.h100}`,
              }}
            >
              <img
                src={`/stickers/sticker-${tp}.png`}
                alt=""
                aria-hidden="true"
                style={{ width: 40, height: 40, objectFit: "contain" }}
              />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#1F2937",
                    letterSpacing: -0.2,
                  }}
                >
                  {t(TYPE_LABEL_KEY[tp], lang)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: HONEY.h800,
                    marginTop: 2,
                    lineHeight: 1.3,
                  }}
                >
                  {t(TYPE_GUIDE_KEY[tp], lang)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sticker Detail Popover — tap a hex cell to see details
// ============================================================

function StickerDetailPopover({
  sticker,
  lang,
  onClose,
}: {
  sticker: IndividualSticker;
  lang: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fromLabel =
    sticker.source === "mission"
      ? t("phFromMission", lang)
      : sticker.fromTeacherName || t("phFromTeacher", lang);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(9,7,30,0.68)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 220,
        padding: 20,
        backdropFilter: "blur(4px)",
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "22px 22px 18px",
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          border: `3px solid ${HONEY.h300}`,
          animation: "phPopoverIn 0.2s ease",
          textAlign: "center",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 34,
            height: 34,
            borderRadius: 10,
            background: HONEY.h50,
            border: `1.5px solid ${HONEY.h200}`,
            fontSize: 14,
            fontWeight: 900,
            color: HONEY.h800,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
        <img
          src={`/stickers/sticker-${sticker.type}.png`}
          alt=""
          aria-hidden="true"
          style={{
            width: 110,
            height: 110,
            objectFit: "contain",
            filter: "drop-shadow(0 6px 14px rgba(245,158,11,0.35))",
            marginTop: 4,
          }}
        />
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: HONEY.h800,
            marginTop: 8,
            letterSpacing: -0.3,
          }}
        >
          {t(TYPE_LABEL_KEY[sticker.type], lang)}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: HONEY.h700,
            marginTop: 4,
          }}
        >
          {t(TYPE_GUIDE_KEY[sticker.type], lang)}
        </div>
        {sticker.memo && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              background: HONEY.h50,
              border: `1px solid ${HONEY.h200}`,
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 700,
              color: "#1F2937",
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}
          >
            "{sticker.memo}"
          </div>
        )}
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            fontWeight: 800,
            color: HONEY.h700,
            letterSpacing: -0.1,
          }}
        >
          {fromLabel} · {timeAgo(sticker.timestamp, lang)}
        </div>
      </div>
      <style jsx global>{`
        @keyframes phPopoverIn {
          from { transform: scale(0.9); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

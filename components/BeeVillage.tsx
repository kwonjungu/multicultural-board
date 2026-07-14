"use client";

// 🏡 꿀벌 마을 (V2) — PraiseHive 의 별도 탭 게임.
// docs/꿀벌마을-마스터플랜.md §5. 스티커 꾸미기와 독립인 자체 게임 루프:
//   ① 꿀 이슬 줍기(일 1회 +10) ② 스티커→꿀 환전(증가분 ×5)
//   ③ 내 집 가꾸기(데코 구매·장착) ④ 친구 집 물주기(하루 1회/친구, 5회=정원 Lv+1)
//   ⑤ 마을 공동 시설(학급 스티커 합계 해금)
// 렌더는 CharacterComposite(CharacterImage+AccessoryLayer+CosmeticFrame) 재사용.
// UI 문구는 한국어 하드코딩 (가드레일 — 신규 i18n 키 대량 추가 금지).

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { UserConfig, RoomConfig, StudentCosmetics } from "@/lib/types";
import {
  stageOf,
  stageImage,
  stageImageWithSkin,
  stageImageWithHat,
  stageImageWithSkinAndHat,
} from "@/lib/stage";
import { subscribeAllStudentCounts, subscribeAllCosmetics } from "@/lib/stickers";
import {
  subscribeVillage,
  collectDailyDew,
  exchangeStickerHoney,
  buyOrEquipDeco,
  equipDeco,
  waterFriendGarden,
  decoById,
  decoV2ById,
  effectiveHouseV2,
  ownedDecoIdsV2,
  todayStr,
  VILLAGE_DECOS,
  VILLAGE_DECOS_V2,
  VILLAGE_FACILITIES,
  WATER_PER_LEVEL,
  DEW_AMOUNT,
  type VillageData,
  type VillageState,
  type VillageDeco,
  type VillageDecoV2,
  type VillageSlot,
} from "@/lib/village";
import { CharacterImage, CosmeticFrame, AccessoryLayer } from "./CharacterComposite";
import type { VillagePlot3D } from "./VillageMap3D";
import QuestBoard from "./QuestBoard";
import { type QuestEventType } from "@/lib/quests";
import Toast from "./Toast";
import { HONEY } from "@/lib/constants";
import { t } from "@/lib/i18n";

// 🗺 3D 마을 맵 — three.js(~600KB)가 들어 있어 반드시 dynamic + ssr:false.
// 로드 전/WebGL 실패 시엔 아래 2D hex 맵이 그대로 폴백으로 남는다.
const VillageMap3D = dynamic(() => import("./VillageMap3D"), { ssr: false });

// ── Design tokens ──────────────────────────────────────────────
const R = { card: 22, tile: 14, pill: 999 };
const SH = {
  card: "0 8px 24px rgba(180,83,9,0.12)",
  popover: "0 20px 50px rgba(0,0,0,0.4)",
  sheet: "0 -12px 40px rgba(0,0,0,0.25)",
  cta: "0 6px 16px rgba(245,158,11,0.3)",
};
// HONEY.h400 = #FBBF24, HONEY.h500 = #F59E0B, HONEY.h100 = #FEF3C7
const GR = {
  cta: "linear-gradient(135deg, #FBBF24, #F59E0B)",
  surface: "linear-gradient(160deg, #FEF3C7, #fff)",
};
const OVERLAY = { background: "rgba(9,7,30,0.6)", backdropFilter: "blur(4px)" };
const CLOSE_BTN: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: R.tile,
  position: "absolute",
  top: 6,
  right: 6,
};
// ───────────────────────────────────────────────────────────────

const DEFAULT_COSMETICS: StudentCosmetics = { skin: "classic", hat: null, pet: null, trophy: null };
const DEFAULT_PLATE_COLOR = "#FDE68A"; // 기본 꿀색 문패

const SLOT_LABEL: Record<VillageSlot, string> = {
  roof: "지붕",
  garden: "정원",
  plate: "문패",
};

function shortId(id: string): string {
  if (!id) return "??????";
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  return (clean || id).slice(0, 6);
}

interface Props {
  lang: string;
  roomCode: string;
  user: UserConfig;
  myClientId: string;
  roomConfig: RoomConfig;
  /** 심부름 클릭 이동 — village_water 는 여기서 지도 스크롤로 처리, 나머지는 위로 전달 */
  onQuestNavigate?: (event: QuestEventType) => void;
}

interface HouseEntry {
  id: string;
  name: string;
  count: number;
  cosmetics: StudentCosmetics;
  village: VillageState;
}

// ── Shared ItemTile — used by shop panel and DecorateSheet ─────
interface ItemTileProps {
  emoji: string;
  label: string;
  price: number;
  equipped: boolean;
  has: boolean;
  affordable: boolean;
  removable?: boolean;
  busy: boolean;
  onClick: () => void;
}
function ItemTile({ emoji, label, price, equipped, has, affordable, removable = false, busy, onClick }: ItemTileProps) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        minHeight: 92,
        padding: "10px 6px 8px",
        borderRadius: R.tile,
        border: `2px solid ${equipped ? HONEY.h500 : has ? HONEY.h300 : HONEY.h100}`,
        background: equipped ? GR.surface : "#FFFDF6",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "center",
        opacity: affordable ? 1 : 0.55,
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1.1 }}>{emoji}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: HONEY.h700, marginTop: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: HONEY.h700, marginTop: 2 }}>
        {equipped
          ? removable ? "✅ 장착 중 (눌러서 해제)" : "✅ 장착 중"
          : has
          ? "보유 — 장착하기"
          : `${price}🍯`}
      </div>
    </button>
  );
}
// ───────────────────────────────────────────────────────────────

export default function BeeVillage({ lang, roomCode, user, myClientId, roomConfig, onQuestNavigate }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsReady, setCountsReady] = useState(false);
  const [allCosmetics, setAllCosmetics] = useState<Record<string, StudentCosmetics>>({});
  const [village, setVillage] = useState<VillageData>({});
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  // 3D 맵 상태 — loading(청크·씬 준비 전: 2D 표시) / on(3D) / off(WebGL 실패: 2D 폴백)
  const [map3d, setMap3d] = useState<"loading" | "on" | "off">("loading");
  // 내 집 꾸미기 바텀시트 (카탈로그 v2)
  const [decorateOpen, setDecorateOpen] = useState(false);
  // 심부름 "물주기" 클릭 시 지도 카드로 스크롤하기 위한 ref
  const mapCardRef = useRef<HTMLDivElement>(null);

  // ── 데스크톱 2열 레이아웃 (≥900px) ────────────────────────────
  // SSR 프리렌더에서 window 접근 금지 — 초기 false, 마운트 후 판정 (BeeWorldMarble 패턴)
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const unsub = subscribeAllStudentCounts(roomCode, (c) => {
      setCounts(c);
      setCountsReady(true);
    });
    return () => unsub();
  }, [roomCode]);

  useEffect(() => {
    const unsub = subscribeAllCosmetics(roomCode, setAllCosmetics);
    return () => unsub();
  }, [roomCode]);

  useEffect(() => {
    const unsub = subscribeVillage(roomCode, setVillage);
    return () => unsub();
  }, [roomCode]);

  // ── 입장 보상: 꿀 이슬(일 1회) + 스티커 환전(증가분) ──────────────
  // 마운트당 1회 (useRef 가드 — StrictMode double-invoke 대비. 트랜잭션
  // 자체도 날짜/기준점 가드로 멱등이라 중복 지급은 없다.)
  const rewardsRanRef = useRef(false);
  useEffect(() => {
    if (user.isTeacher || !countsReady || rewardsRanRef.current) return;
    rewardsRanRef.current = true;
    const myCount = counts[myClientId] ?? 0;
    (async () => {
      try {
        const dew = await collectDailyDew(roomCode, myClientId);
        const ex = await exchangeStickerHoney(roomCode, myClientId, myCount);
        const parts: string[] = [];
        if (dew.collected) parts.push(`🌅 꿀 이슬 +${DEW_AMOUNT}`);
        if (ex.gained > 0) parts.push(`🐝 칭찬 보너스 +${ex.gained}`);
        if (parts.length > 0) setToast({ msg: `${parts.join(" · ")} 🍯`, tone: "success" });
      } catch (err) {
        console.error("village entry rewards failed", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsReady, user.isTeacher, roomCode, myClientId]);

  // ── 마을 주민 (전시장 RaceTab 과 동일한 roster 필터 규칙) ─────────
  const entries: HouseEntry[] = useMemo(() => {
    const roster = roomConfig.roster ?? [];
    const rosterSet = new Set(roster);
    let ids = Array.from(
      new Set([...Object.keys(counts), ...Object.keys(allCosmetics), ...Object.keys(village)]),
    );
    if (roster.length > 0) ids = ids.filter((id) => rosterSet.has(id));
    const arr = ids.map((id) => ({
      id,
      count: counts[id] ?? 0,
      name:
        id === myClientId
          ? user.myName
          : rosterSet.has(id)
          ? id
          : `${t("phStudentPrefix", lang)} #${shortId(id)}`,
      cosmetics: allCosmetics[id] ?? DEFAULT_COSMETICS,
      village: village[id] ?? {},
    }));
    // 이름순 고정 배치 — 순위가 아니라 "마을 지도"이므로 자리가 흔들리지 않게.
    arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return arr;
  }, [counts, allCosmetics, village, myClientId, user.myName, lang, roomConfig.roster]);

  const classTotal = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );
  const unlockedFacilities = VILLAGE_FACILITIES.filter((f) => classTotal >= f.at);
  const nextFacility = VILLAGE_FACILITIES.find((f) => classTotal < f.at) ?? null;

  const myVillage: VillageState = village[myClientId] ?? {};
  const myHoney = myVillage.honey ?? 0;
  const today = todayStr();
  const focusEntry = focus ? entries.find((e) => e.id === focus) ?? null : null;

  // ── 3D 씬 입력 데이터 (구독 갱신 → memo 갱신 → 씬 재빌드 에코) ─────
  const plots3d: VillagePlot3D[] = useMemo(
    () =>
      entries.map((e) => {
        const st = stageOf(e.count);
        const { skin, hat } = e.cosmetics;
        // 벌 빌보드 텍스처 후보 — CharacterImage 의 폴백 체인과 동일 순서:
        // skin+hat 합성본 → classic+hat 합성본 → skin 단품 → 기본 stage
        const bee: string[] = [];
        if (hat) {
          bee.push(stageImageWithSkinAndHat(st, skin, hat));
          if (skin !== "classic") bee.push(stageImageWithHat(st, hat));
        }
        if (skin !== "classic") bee.push(stageImageWithSkin(st, skin));
        bee.push(stageImage(st));
        const h = effectiveHouseV2(e.village); // v1 장착값 무료 매핑 포함
        return {
          id: e.id,
          name: e.name,
          isSelf: e.id === myClientId && !user.isTeacher,
          bee,
          style: h.style,
          plate: h.plate,
          fence: h.fence,
          yard: h.yard,
        };
      }),
    [entries, myClientId, user.isTeacher],
  );

  // ── 상점 구매/장착 ──────────────────────────────────────────
  const [shopBusy, setShopBusy] = useState(false);
  async function handleDecoTap(deco: VillageDeco) {
    if (shopBusy) return;
    const equipped = myVillage.house?.[deco.slot] === deco.id;
    const owned = myVillage.owned?.[deco.id] === true;
    if (equipped) {
      // 해제 — 재화 무관, 낙관적 쓰기 (가드레일: await 로 UI 붙잡지 않기)
      equipDeco(roomCode, myClientId, deco.slot, null).catch((err) => {
        console.error("equipDeco failed", err);
        setToast({ msg: "문제가 생겼어요. 다시 시도해 주세요.", tone: "error" });
      });
      return;
    }
    if (owned) {
      equipDeco(roomCode, myClientId, deco.slot, deco.id).catch((err) => {
        console.error("equipDeco failed", err);
        setToast({ msg: "문제가 생겼어요. 다시 시도해 주세요.", tone: "error" });
      });
      setToast({ msg: `${deco.emoji} ${deco.label} 장착!`, tone: "success" });
      return;
    }
    // 구매 — 잔액 검증은 트랜잭션 안에서 (동시 탭 안전)
    setShopBusy(true);
    try {
      const res = await buyOrEquipDeco(roomCode, myClientId, deco);
      if (res.status === "poor") {
        setToast({ msg: `꿀이 부족해요 (${deco.price}🍯 필요)`, tone: "error" });
      } else {
        setToast({ msg: `${deco.emoji} ${deco.label} 구매 완료! (-${deco.price}🍯)`, tone: "success" });
      }
    } catch (err) {
      console.error("buyOrEquipDeco failed", err);
      setToast({ msg: "문제가 생겼어요. 다시 시도해 주세요.", tone: "error" });
    }
    setShopBusy(false);
  }

  // ── 꾸미기 바텀시트 (카탈로그 v2) 구매/장착/해제 ─────────────────
  async function handleDecoV2Tap(deco: VillageDecoV2, yardIndex = 0) {
    if (shopBusy) return;
    const houseV2 = effectiveHouseV2(myVillage);
    const equipped =
      deco.slot === "yard"
        ? houseV2.yard[yardIndex] === deco.id
        : deco.slot === "style"
        ? houseV2.style === deco.id
        : deco.slot === "plate"
        ? houseV2.plate === deco.id
        : houseV2.fence === deco.id;
    if (equipped) {
      // 집/문패는 항상 하나 장착 (해제 개념 없음). 울타리/마당만 비울 수 있다.
      if (deco.slot === "style" || deco.slot === "plate") return;
      equipDeco(roomCode, myClientId, deco.slot, null, yardIndex).catch((err) => {
        console.error("equipDeco(v2) failed", err);
        setToast({ msg: "문제가 생겼어요. 다시 시도해 주세요.", tone: "error" });
      });
      setToast({ msg: `${deco.emoji} ${deco.label} 해제`, tone: "success" });
      return;
    }
    if (ownedDecoIdsV2(myVillage)[deco.id]) {
      // 보유(기본템·v1 무료 매핑 포함) — 재화 무관, 낙관적 쓰기
      equipDeco(roomCode, myClientId, deco.slot, deco.id, yardIndex).catch((err) => {
        console.error("equipDeco(v2) failed", err);
        setToast({ msg: "문제가 생겼어요. 다시 시도해 주세요.", tone: "error" });
      });
      setToast({ msg: `${deco.emoji} ${deco.label} 장착!`, tone: "success" });
      return;
    }
    // 구매 — 잔액 검증은 트랜잭션 안에서 (동시 탭 안전)
    setShopBusy(true);
    try {
      const res = await buyOrEquipDeco(roomCode, myClientId, deco, yardIndex);
      if (res.status === "poor") {
        setToast({ msg: `꿀이 부족해요 (${deco.price}🍯 필요)`, tone: "error" });
      } else {
        setToast({ msg: `${deco.emoji} ${deco.label} 구매 완료! (-${deco.price}🍯)`, tone: "success" });
      }
    } catch (err) {
      console.error("buyOrEquipDeco(v2) failed", err);
      setToast({ msg: "문제가 생겼어요. 다시 시도해 주세요.", tone: "error" });
    }
    setShopBusy(false);
  }

  // ── 물주기 ──────────────────────────────────────────────────
  const [waterBusy, setWaterBusy] = useState(false);
  async function handleWater(friend: HouseEntry) {
    if (waterBusy || user.isTeacher || friend.id === myClientId) return;
    setWaterBusy(true);
    try {
      const res = await waterFriendGarden(roomCode, myClientId, friend.id);
      if (res.status === "already") {
        setToast({ msg: "오늘은 이미 물을 줬어요 — 내일 또 와요!", tone: "error" });
      } else if (res.leveledUp) {
        setToast({ msg: `🌷 ${friend.name}의 정원이 자랐어요! (Lv.${res.gardenLevel})`, tone: "success" });
      } else {
        setToast({ msg: `💧 ${friend.name}의 정원에 물을 줬어요! (${res.gardenWater}/${WATER_PER_LEVEL})`, tone: "success" });
      }
    } catch (err) {
      console.error("waterFriendGarden failed", err);
      setToast({ msg: "문제가 생겼어요. 다시 시도해 주세요.", tone: "error" });
    }
    setWaterBusy(false);
  }

  // ── 육각 플롯 그리드 기하 (가드레일: 반올림 금지, 겹침 H/4, 홀수행 W/2) ──
  const HEX_W = 172;
  const HEX_H = HEX_W * 2 / Math.sqrt(3);       // fractional 유지
  const HEX_ROW_STEP = HEX_H * 0.75;            // 행 간 수직 거리 (겹침 = H/4)
  const HEX_COLS = 3;
  const plots: Array<{ kind: "plaza" } | { kind: "house"; e: HouseEntry }> = [
    { kind: "plaza" },
    ...entries.map((e) => ({ kind: "house" as const, e })),
  ];
  const rows = Math.ceil(plots.length / HEX_COLS);
  const gridW = HEX_W * HEX_COLS + HEX_W / 2;   // 홀수행 시프트 포함
  const gridH = (rows - 1) * HEX_ROW_STEP + HEX_H;

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: R.card,
    padding: "16px 14px",
    border: `2px solid ${HONEY.h200}`,
    boxShadow: SH.card,
  };

  // ── 마을 맵 카드 ────────────────────────────────────────────
  const mapCard = (
    <div ref={mapCardRef} style={{ ...cardStyle, padding: "16px 10px" /* hex grid: reduce horizontal padding to fit 5-col hex layout */ }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: HONEY.h900, margin: "0 6px 4px" }}>
        🗺 마을 지도
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: HONEY.h700, margin: "0 6px 10px" }}>
        {map3d === "on"
          ? `한 손가락으로 돌리고, 두 손가락으로 이동·확대해요 · 집을 눌러 방문 — 물 ${WATER_PER_LEVEL}번이면 정원이 자라요`
          : `친구 집을 눌러 하루 한 번 💧 물을 줘요 — 물 ${WATER_PER_LEVEL}번이면 정원이 자라요`}
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: HONEY.h700, fontWeight: 600, textAlign: "center", padding: 20 }}>
          아직 마을에 집이 없어요 — 칭찬 스티커를 받으면 집이 생겨요!
        </div>
      ) : (
        <>
        {/* 3D 맵 (기본) — 씬 준비 전엔 height 0 으로 감춰두고 2D 를 보여준다.
            onFail(WebGL 불가·컨텍스트 유실) 시 완전히 내려가고 2D hex 맵 폴백. */}
        {map3d !== "off" && (
          <div style={{ height: map3d === "on" ? undefined : 0, overflow: "hidden" }}>
            <VillageMap3D
              plots={plots3d}
              facilities={unlockedFacilities.map((f) => f.id)}
              onSelect={(id) => setFocus(id)}
              onReady={() => setMap3d("on")}
              onFail={() => setMap3d("off")}
            />
          </div>
        )}
        {map3d !== "on" && (
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ position: "relative", width: gridW, height: gridH, margin: "0 auto" }}>
            {plots.map((plot, i) => {
              const r = Math.floor(i / HEX_COLS);
              const c = i % HEX_COLS;
              const x = c * HEX_W + (r % 2 === 1 ? HEX_W / 2 : 0);
              const y = r * HEX_ROW_STEP;
              const hexStyle: React.CSSProperties = {
                position: "absolute",
                left: x,
                top: y,
                width: HEX_W,
                height: HEX_H,
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                padding: 0,
              };
              if (plot.kind === "plaza") {
                return (
                  <div
                    key="plaza"
                    style={{
                      ...hexStyle,
                      background: "radial-gradient(circle at 50% 35%, #E0F2FE 0%, #BAE6FD 70%, #7DD3FC 100%)",
                    }}
                  >
                    <div style={{ fontSize: 26, lineHeight: 1.2 }}>
                      {unlockedFacilities.length > 0
                        ? unlockedFacilities.map((f) => f.emoji).join(" ")
                        : "🚧"}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#075985", marginTop: 4 }}>
                      마을 광장
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0369A1", marginTop: 2 }}>
                      🐝 {classTotal}
                    </div>
                  </div>
                );
              }
              const e = plot.e;
              const isSelf = e.id === myClientId && !user.isTeacher;
              const st = stageOf(e.count);
              const roofDeco = decoById(e.village.house?.roof);
              const gardenDeco = decoById(e.village.house?.garden);
              const plateColor = decoById(e.village.house?.plate)?.color ?? DEFAULT_PLATE_COLOR;
              const gardenLevel = e.village.gardenLevel ?? 0;
              const flowerCount = Math.min(1 + gardenLevel, 5);
              return (
                <button
                  key={e.id}
                  onClick={() => setFocus(e.id)}
                  aria-label={`${e.name}의 집`}
                  style={{
                    ...hexStyle,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: isSelf
                      ? `radial-gradient(circle at 50% 30%, #FEF3C7 0%, #FDE68A 60%, ${HONEY.h300} 100%)`
                      : "radial-gradient(circle at 50% 30%, #FEF9C3 0%, #D9F99D 55%, #86EFAC 100%)",
                  }}
                >
                  {/* 지붕 */}
                  <div style={{ fontSize: 24, lineHeight: 1 }}>{roofDeco?.emoji ?? "🏠"}</div>
                  {/* 벌 — 68px hex 셀: held/acc 생략 (작은 크기에서 안 보임) */}
                  <div style={{ position: "relative", width: 68, height: 68, marginTop: 2 }}>
                    <CosmeticFrame backdrop={e.cosmetics.backdrop} aura={e.cosmetics.aura} />
                    <CharacterImage stage={st} skin={e.cosmetics.skin} hat={e.cosmetics.hat} float={false} />
                    <AccessoryLayer stage={st} float={false} />
                  </div>
                  {/* 정원 — 레벨만큼 꽃이 늘어난다 */}
                  <div style={{ fontSize: 13, lineHeight: 1, letterSpacing: 2, marginTop: 3 }}>
                    {(gardenDeco?.emoji ?? "🌱").repeat(flowerCount)}
                  </div>
                  {/* 문패 */}
                  <div
                    style={{
                      marginTop: 4,
                      maxWidth: "72%",
                      padding: "2px 10px",
                      borderRadius: R.pill,
                      background: plateColor,
                      border: "1px solid rgba(0,0,0,0.08)",
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#1F2937",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {e.name}{isSelf ? " ⭐" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )}
        </>
      )}
    </div>
  );

  // ── 마을 공동 시설 배너 ─────────────────────────────────────
  const facilitiesBanner = (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: HONEY.h900 }}>
            🏛 마을 공동 시설
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: HONEY.h700, marginTop: 2 }}>
            {nextFacility
              ? `${nextFacility.emoji} ${nextFacility.label}까지 ${nextFacility.at - classTotal}개 남았어요! · 우리 반 칭찬 ${classTotal}🐝`
              : "🎉 모든 시설이 완성됐어요! 마을 축제가 열렸어요!"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {VILLAGE_FACILITIES.map((f) => {
            const on = classTotal >= f.at;
            return (
              <div
                key={f.at}
                title={`${f.label} (학급 ${f.at}개)`}
                style={{
                  width: 52,
                  minHeight: 56,
                  borderRadius: R.tile,
                  border: `2px solid ${on ? HONEY.h400 : HONEY.h100}`,
                  background: on ? GR.surface : "#F9FAFB",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  filter: on ? "none" : "grayscale(1)",
                  opacity: on ? 1 : 0.55,
                }}
              >
                <div style={{ fontSize: 22 }}>{f.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: HONEY.h700 }}>{f.at}</div>
              </div>
            );
          })}
        </div>
      </div>
      {/* 다음 시설 진행바 */}
      {nextFacility && (
        <div
          style={{
            marginTop: 10,
            height: 12,
            background: HONEY.h50,
            borderRadius: R.pill,
            overflow: "hidden",
            border: `1px solid ${HONEY.h200}`,
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(100, (classTotal / nextFacility.at) * 100))}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${HONEY.h300}, ${HONEY.h500})`,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      )}
    </div>
  );

  // ── 꿀 지갑 + 상점 패널 ────────────────────────────────────
  const walletPanel = !user.isTeacher ? (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: HONEY.h800 }}>내 꿀 주머니</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: HONEY.h800, letterSpacing: -0.3 }}>
            🍯 {myHoney}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginTop: 2 }}>
            {myVillage.lastDew === today
              ? "🌅 오늘의 꿀 이슬을 주웠어요"
              : "🌅 마을에 오면 매일 꿀 이슬을 주워요"}
            {" · 칭찬 스티커 1개 = 🍯5"}
          </div>
        </div>
        <button
          onClick={() => setShopOpen((v) => !v)}
          style={{
            minHeight: 52,
            padding: "10px 20px",
            background: shopOpen ? "#fff" : GR.cta,
            color: shopOpen ? HONEY.h800 : "#fff",
            border: `2px solid ${shopOpen ? HONEY.h300 : HONEY.h500}`,
            borderRadius: R.tile,
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: shopOpen ? "none" : SH.cta,
            fontFamily: "inherit",
            letterSpacing: -0.2,
          }}
        >
          {shopOpen ? "상점 닫기 ✕" : "🛍 내 집 가꾸기"}
        </button>
      </div>

      {/* 상점 패널 */}
      {shopOpen && (
        <div style={{ marginTop: 14 }}>
          {(["roof", "garden", "plate"] as VillageSlot[]).map((slot) => (
            <div key={slot} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: HONEY.h800, marginBottom: 6 }}>
                {slot === "roof" ? "🏠" : slot === "garden" ? "🌱" : "🪧"} {SLOT_LABEL[slot]}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
                  gap: 8,
                }}
              >
                {VILLAGE_DECOS.filter((d) => d.slot === slot).map((deco) => {
                  const equipped = myVillage.house?.[deco.slot] === deco.id;
                  const owned = myVillage.owned?.[deco.id] === true;
                  const affordable = owned || myHoney >= deco.price;
                  return (
                    <ItemTile
                      key={deco.id}
                      emoji={deco.emoji}
                      label={deco.label}
                      price={deco.price}
                      equipped={equipped}
                      has={owned}
                      affordable={affordable}
                      removable={true}
                      busy={shopBusy}
                      onClick={() => handleDecoTap(deco)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, fontWeight: 700, color: HONEY.h700 }}>
            한 번 산 데코는 계속 보유해요. 같은 칸의 다른 데코로 언제든 바꿀 수 있어요.
          </div>
        </div>
      )}
    </div>
  ) : null;

  // ── 퀘스트 보드 ────────────────────────────────────────────
  // 심부름 클릭 → 활동 화면 이동. 물주기는 이 탭 안이므로 지도로 스크롤만,
  // 나머지는 PraiseHive(탭 전환·허브 이동)로 위임.
  const handleQuestGo = (event: QuestEventType) => {
    if (event === "village_water") {
      mapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setToast({ msg: "💧 친구 집을 눌러 물을 줄 수 있어요!", tone: "success" });
      return;
    }
    onQuestNavigate?.(event);
  };
  const questBoard = !user.isTeacher ? (
    <QuestBoard
      roomCode={roomCode}
      myClientId={myClientId}
      onToast={(msg, tone) => setToast({ msg, tone })}
      onGoTo={handleQuestGo}
    />
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 로컬 애니메이션 keyframes */}
      <style>{`
        @keyframes bv-popover-in {
          from { opacity: 0; transform: translateY(26px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bv-sheet-in {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Toast
        message={toast?.msg ?? null}
        tone={toast?.tone ?? "success"}
        onDismiss={() => setToast(null)}
      />

      {/* ── 데스크톱: 2열 그리드 / 모바일: 세로 스택 ── */}
      {isDesktop ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16, alignItems: "start" }}>
          {/* 좌 메인 — 시설 배너 + 마을 맵 (핵심 기능) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {facilitiesBanner}
            {mapCard}
          </div>
          {/* 우 사이드바 — 퀘스트 + 꿀 지갑/상점 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {questBoard}
            {walletPanel}
          </div>
        </div>
      ) : (
        /* 모바일: 퀘스트 → 지갑 → 시설 → 맵 */
        <>
          {questBoard}
          {walletPanel}
          {facilitiesBanner}
          {mapCard}
        </>
      )}

      {/* ── 집 상세 팝오버 (친구 집 방문 + 물주기 / 내 집이면 🛋 꾸미기) ── */}
      {focusEntry && (
        <HousePopover
          lang={lang}
          entry={focusEntry}
          isSelf={focusEntry.id === myClientId && !user.isTeacher}
          isTeacher={user.isTeacher}
          wateredToday={myVillage.watered?.[today]?.[focusEntry.id] === true}
          busy={waterBusy}
          onWater={() => handleWater(focusEntry)}
          onDecorate={() => {
            setFocus(null);
            setDecorateOpen(true);
          }}
          onClose={() => setFocus(null)}
        />
      )}

      {/* ── 🛋 내 집 꾸미기 바텀시트 (카탈로그 v2 — 3D 슬롯) ── */}
      {decorateOpen && !user.isTeacher && (
        <DecorateSheet
          village={myVillage}
          honey={myHoney}
          busy={shopBusy}
          onTap={handleDecoV2Tap}
          onClose={() => setDecorateOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// 집 상세 팝오버 — 이름 + 벌 + 정원 게이지 + 💧 물주기 (하루 1회/친구)
// ============================================================

function HousePopover({
  lang,
  entry,
  isSelf,
  isTeacher,
  wateredToday,
  busy,
  onWater,
  onDecorate,
  onClose,
}: {
  lang: string;
  entry: HouseEntry;
  isSelf: boolean;
  isTeacher: boolean;
  wateredToday: boolean;
  busy: boolean;
  onWater: () => void;
  /** 내 집일 때만 — 🛋 꾸미기 바텀시트 열기 */
  onDecorate: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const st = stageOf(entry.count);
  const v = entry.village;
  const gardenLevel = v.gardenLevel ?? 0;
  const gardenWater = v.gardenWater ?? 0;
  const roofDeco = decoById(v.house?.roof);
  const gardenDeco = decoById(v.house?.garden);
  // v2 집 스타일 (v1 지붕 매핑 포함) — 팝오버 상단 아이콘
  const styleDeco = decoV2ById(effectiveHouseV2(v).style);
  const canWater = !isSelf && !isTeacher && !wateredToday;
  void lang;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        ...OVERLAY,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 220,
        padding: 20,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: "#fff",
          borderRadius: R.card,
          padding: "22px 20px 18px",
          maxWidth: 380,
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: SH.popover,
          border: `3px solid ${HONEY.h300}`,
          animation: "bv-popover-in 0.3s ease-out",
          textAlign: "center",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            ...CLOSE_BTN,
            background: HONEY.h50,
            border: `1.5px solid ${HONEY.h200}`,
            fontSize: 14,
            fontWeight: 900,
            color: HONEY.h800,
            cursor: "pointer",
          }}
        >✕</button>

        <div style={{ fontSize: 26 }}>{styleDeco?.emoji ?? roofDeco?.emoji ?? "🏠"}</div>

        {/* 벌 — 150px+ 팝오버: 코스메틱 풀 렌더 (held/acc 포함) */}
        <div style={{ position: "relative", width: 150, height: 150, margin: "2px auto 0" }}>
          <CosmeticFrame backdrop={entry.cosmetics.backdrop} aura={entry.cosmetics.aura} />
          <CharacterImage stage={st} skin={entry.cosmetics.skin} hat={entry.cosmetics.hat} />
          <AccessoryLayer stage={st} held={entry.cosmetics.held} acc={entry.cosmetics.acc} />
          {entry.cosmetics.pet && (
            <img
              src={`/stickers/pet-${entry.cosmetics.pet}.png`}
              alt="" aria-hidden="true"
              style={{
                position: "absolute", bottom: -6, width: 54, height: 54, zIndex: 2,
                ...(entry.cosmetics.petPos === "left"
                  ? { left: -16, transform: "scaleX(-1)" }
                  : { right: -16 }),
              }}
            />
          )}
        </div>

        <div style={{ fontSize: 16, fontWeight: 900, color: HONEY.h900, marginTop: 8 }}>
          {entry.name}{isSelf ? " (나)" : ""}의 집
        </div>

        {/* 정원 게이지 */}
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            background: "linear-gradient(160deg, #F0FDF4, #fff)",
            border: "2px solid #BBF7D0",
            borderRadius: R.tile,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>
            {gardenDeco ? `${gardenDeco.emoji} ${gardenDeco.label}` : "🌱 정원"} · Lv.{gardenLevel}
          </div>
          <div style={{ fontSize: 20, letterSpacing: 4, marginTop: 6 }}>
            {Array.from({ length: WATER_PER_LEVEL }).map((_, i) => (
              <span key={i} style={{ opacity: i < gardenWater ? 1 : 0.22 }}>💧</span>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", marginTop: 4 }}>
            물 {gardenWater}/{WATER_PER_LEVEL} — {WATER_PER_LEVEL}번 받으면 정원이 한 단계 자라요
          </div>
        </div>

        {/* 물주기 버튼 / 내 집이면 꾸미기 */}
        {isSelf ? (
          <>
            <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: HONEY.h700 }}>
              친구들이 물을 주면 내 정원이 자라요 🌷
            </div>
            <button
              onClick={onDecorate}
              style={{
                marginTop: 12,
                minHeight: 52,
                width: "100%",
                padding: "10px 24px",
                background: GR.cta,
                color: "#fff",
                border: "none",
                borderRadius: R.tile,
                fontSize: 13,
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: SH.cta,
                fontFamily: "inherit",
              }}
            >
              🛋 꾸미기 — 집·문패·울타리·마당
            </button>
          </>
        ) : isTeacher ? null : (
          <button
            onClick={onWater}
            disabled={!canWater || busy}
            style={{
              marginTop: 14,
              minHeight: 52,
              width: "100%",
              padding: "10px 24px",
              background: canWater && !busy
                ? "linear-gradient(135deg, #38BDF8, #0284C7)"
                : "#F3F4F6",
              color: canWater && !busy ? "#fff" : "#9CA3AF",
              border: "none",
              borderRadius: R.tile,
              fontSize: 13,
              fontWeight: 900,
              cursor: canWater && !busy ? "pointer" : "default",
              boxShadow: canWater && !busy ? "0 6px 16px rgba(2,132,199,0.3)" : "none",
              fontFamily: "inherit",
            }}
          >
            {wateredToday ? "오늘은 이미 물을 줬어요 ✅" : "💧 물주기 (하루 1번)"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 🛋 내 집 꾸미기 바텀시트 — 카탈로그 v2 (3D 슬롯: 집/문패/울타리/마당×3)
// 구매·장착 로직은 buyOrEquipDeco/equipDeco 확장판 (부모의 handleDecoV2Tap).
// ============================================================

function DecorateSheet({
  village,
  honey,
  busy,
  onTap,
  onClose,
}: {
  village: VillageState;
  honey: number;
  busy: boolean;
  onTap: (deco: VillageDecoV2, yardIndex?: number) => void;
  onClose: () => void;
}) {
  const [yardIndex, setYardIndex] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 구독 에코로 village 가 갱신되면 여기도 즉시 최신 장착 상태를 반영한다
  const house = effectiveHouseV2(village);
  const owned = ownedDecoIdsV2(village);

  function isEquipped(deco: VillageDecoV2): boolean {
    switch (deco.slot) {
      case "style": return house.style === deco.id;
      case "plate": return house.plate === deco.id;
      case "fence": return house.fence === deco.id;
      case "yard":  return house.yard[yardIndex] === deco.id;
    }
  }

  function section(title: string, slot: VillageDecoV2["slot"]) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: HONEY.h800, marginBottom: 6 }}>
          {title}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
            gap: 8,
          }}
        >
          {VILLAGE_DECOS_V2.filter((d) => d.slot === slot).map((deco) => {
            const equipped = isEquipped(deco);
            const has = owned[deco.id] === true;
            const affordable = has || honey >= deco.price;
            const removable = deco.slot === "fence" || deco.slot === "yard";
            return (
              <ItemTile
                key={deco.id}
                emoji={deco.emoji}
                label={deco.label}
                price={deco.price}
                equipped={equipped}
                has={has}
                affordable={affordable}
                removable={removable}
                busy={busy}
                onClick={() => onTap(deco, yardIndex)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        ...OVERLAY,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 230,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          background: "#fff",
          borderRadius: `${R.card}px ${R.card}px 0 0`,
          padding: "16px 16px 22px",
          width: "100%",
          maxWidth: 560,
          maxHeight: "78vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          boxShadow: SH.sheet,
          borderTop: `3px solid ${HONEY.h300}`,
          animation: "bv-sheet-in 0.3s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: HONEY.h900 }}>🛋 내 집 꾸미기</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: HONEY.h700, marginTop: 2 }}>
              내 꿀 🍯 {honey} · 한 번 산 아이템은 계속 보유해요
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              ...CLOSE_BTN,
              background: HONEY.h50,
              border: `1.5px solid ${HONEY.h200}`,
              fontSize: 14,
              fontWeight: 900,
              color: HONEY.h800,
              cursor: "pointer",
            }}
          >✕</button>
        </div>

        {section("🏠 집 스타일", "style")}
        {section("🪧 문패", "plate")}
        {section("🚧 울타리", "fence")}

        {/* 마당 — 슬롯 3칸 (좌/우/앞) 선택 후 아이템 장착 */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: HONEY.h800, marginBottom: 6 }}>
            🌳 마당 (3칸)
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {(["왼쪽", "오른쪽", "앞"] as const).map((label, i) => {
              const cur = decoV2ById(house.yard[i]);
              const active = yardIndex === i;
              return (
                <button
                  key={i}
                  onClick={() => setYardIndex(i)}
                  style={{
                    flex: 1,
                    minHeight: 62,
                    borderRadius: R.tile,
                    border: `2px solid ${active ? HONEY.h500 : HONEY.h200}`,
                    background: active ? GR.surface : "#FFFDF6",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontSize: 20 }}>{cur?.emoji ?? "➕"}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: HONEY.h700 }}>
                    {label} {cur ? `· ${cur.label}` : "· 비어 있음"}
                  </div>
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
              gap: 8,
            }}
          >
            {VILLAGE_DECOS_V2.filter((d) => d.slot === "yard").map((deco) => {
              const equipped = isEquipped(deco);
              const has = owned[deco.id] === true;
              const affordable = has || honey >= deco.price;
              return (
                <ItemTile
                  key={deco.id}
                  emoji={deco.emoji}
                  label={deco.label}
                  price={deco.price}
                  equipped={equipped}
                  has={has}
                  affordable={affordable}
                  removable={true}
                  busy={busy}
                  onClick={() => onTap(deco, yardIndex)}
                />
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: HONEY.h700, marginTop: 10 }}>
          예전에 산 지붕·정원 아이템은 새 마을에서도 그대로 쓸 수 있어요 (무료 전환).
        </div>
      </div>
    </div>
  );
}

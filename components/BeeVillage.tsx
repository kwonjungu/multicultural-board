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
import QuestBoard, { type QuestBoardFixture } from "./QuestBoard";
import { type QuestEventType } from "@/lib/quests";
import Toast from "./Toast";
import { HONEY } from "@/lib/constants";
import { t } from "@/lib/i18n";
import ScopedStyle from "./ui/child/ScopedStyle";

// 🗺 3D 마을 맵 — three.js(~600KB)가 들어 있어 반드시 dynamic + ssr:false.
// 로드 전/WebGL 실패 시엔 아래 2D hex 맵이 그대로 폴백으로 남는다.
const VillageMap3D = dynamic(() => import("./VillageMap3D"), { ssr: false });

// ── Design tokens ──────────────────────────────────────────────
// 카드·글자·버튼은 공통 토큰(--ux-*, data-ux-role)만 쓴다 — QuestBoard 와
// 같은 화면 안에 나란히 있으므로 두 컴포넌트가 다른 디자인 시스템처럼
// 보이면 안 된다(가드레일: 화면마다 다른 그라디언트·그림자 반복 금지).
// R/HONEY 는 지도 육각 타일처럼 순수 그래픽(게임판)에만 남긴다 — 읽는
// 글자·버튼·카드 틀에는 쓰지 않는다.
const R = { pill: 999 };
const OVERLAY = { background: "rgba(9,7,30,0.6)", backdropFilter: "blur(4px)" };

const VILLAGE_CSS = `
.bv-root{ display:flex; flex-direction:column; gap:var(--ux-space-4); }
/* 넓은 화면: 지도/시설을 왼쪽에, 심부름/지갑을 오른쪽에 — 하지만 폭이
   커질수록 왼쪽만 무한히 넓어지지 않게 전체를 1280px 로 잡고, 오른쪽
   칸도 함께 넓혀 심부름 카드가 2열로 늘어날 여유를 준다(04 §1 Q5:
   여백만 커지지 않게, 폭이 생기면 열을 늘린다). DOM 순서는 모바일 읽기
   순서(심부름→지갑→시설→지도)를 유지하고, 데스크톱에서만 grid-area 로
   재배치한다 — 같은 마크업 두 벌을 만들지 않는다.
   ※ CSS 특이도가 같으면 나중 규칙이 이긴다 — 이 블록 뒤에 같은
     선택자를 다시 쓰지 않는다(실제로 겪은 함정). */
.bv-layout{ display:flex; flex-direction:column; gap:var(--ux-space-4); }
@media (min-width: 900px){
  .bv-layout{
    display:grid; align-items:start; max-width:1280px; margin:0 auto; width:100%;
    grid-template-columns: minmax(0,1fr) minmax(20rem, 34rem);
    grid-template-areas: "facilities quest" "map quest" "map wallet";
    gap: var(--ux-space-4);
  }
  .bv-area-facilities{ grid-area:facilities; }
  .bv-area-map{ grid-area:map; }
  .bv-area-quest{ grid-area:quest; }
  .bv-area-wallet{ grid-area:wallet; }
}
/* 카드 틀 — QuestBoard 의 .qb-card-panel 과 완전히 같은 값. */
.bv-panel{
  background:var(--ux-surface); border-radius:var(--ux-radius-panel);
  border:2px solid var(--ux-primary-border); padding:var(--ux-space-4);
  box-shadow:0 4px 14px rgba(137,83,0,.10);
}
.bv-panel-head{ display:flex; align-items:center; gap:var(--ux-space-2); flex-wrap:wrap; }
.bv-panel-title{ font-weight:900; }

.bv-hex-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }

/* 마을 공동 시설 배너 */
.bv-fac-row{ display:flex; align-items:center; gap:var(--ux-space-3); flex-wrap:wrap; }
.bv-fac-icons{ display:flex; gap:var(--ux-space-2); margin-left:auto; }
.bv-fac-tile{
  width:52px; min-height:56px; border-radius:var(--ux-radius-surface);
  border:2px solid var(--ux-primary-border); background:var(--ux-surface);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
}
.bv-fac-tile[data-on="no"]{ filter:grayscale(1); opacity:.55; border-color:var(--ux-surface-sunk); }
.bv-progress-track{
  margin-top:var(--ux-space-3); height:12px; background:var(--ux-surface-sunk);
  border-radius:var(--ux-radius-pill); overflow:hidden; border:1px solid var(--ux-primary-border);
}
.bv-progress-fill{ height:100%; background:var(--ux-primary-fill); transition:width .5s ease; }

/* 꿀 지갑 — 조작 줄은 좌우로 나눈다: 정보는 왼쪽, 상점 열기는 오른쪽. */
.bv-wallet-row{ display:flex; align-items:center; gap:var(--ux-space-3); flex-wrap:wrap; justify-content:space-between; }
.bv-honey-num{ font-weight:900; }

/* 상점/꾸미기 아이템 타일 — 상태는 색이 아니라 토큰의 두 가지 테두리로만
   구분한다(선택 = selected-border, 그 외 = primary-border). */
.bv-item-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(6.5rem,1fr)); gap:var(--ux-space-2); }
.bv-item-tile[data-ux-role="control"]{
  min-height:92px; flex-direction:column; justify-content:center; text-align:center;
  border:2px solid var(--ux-primary-border); background:var(--ux-surface);
}
.bv-item-tile[data-equipped="yes"]{ border-color:var(--ux-selected-border); background:var(--ux-surface-sunk); }
.bv-item-tile[data-afford="no"]{ opacity:.55; }
.bv-item-emoji{ font-size:28px; line-height:1.1; }

/* 조작 한 줄 — 왼쪽 낮은 강조(정보/보조) · 오른쪽 평소 강조(주 동작). */
.bv-actions{ display:flex; gap:var(--ux-space-2); flex-wrap:wrap; align-items:center; justify-content:space-between; }

/* 집 팝오버 / 꾸미기 시트 — 팝업 하나는 화면 안에 하나뿐이라 강한 그림자를
   써도 "화면마다 다른 그림자" 반복이 아니다(모달 표준 elevation). */
.bv-popover-overlay{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:220; padding:var(--ux-space-4); }
.bv-popover{
  background:var(--ux-surface); border-radius:var(--ux-radius-panel);
  padding:var(--ux-space-6) var(--ux-space-4) var(--ux-space-4);
  max-width:380px; width:100%; max-height:88vh; overflow-y:auto;
  border:3px solid var(--ux-primary-border); animation:bv-popover-in .3s ease-out;
  text-align:center; position:relative;
}
.bv-close[data-ux-role="control"]{
  position:absolute; top:var(--ux-space-1); right:var(--ux-space-1); padding:0;
  background:var(--ux-surface-sunk); border:1.5px solid var(--ux-primary-border);
}
.bv-garden-box{
  margin-top:var(--ux-space-3); padding:var(--ux-space-3);
  background:var(--ux-hint-mint); border:2px solid var(--ux-success);
  border-radius:var(--ux-radius-surface);
}
.bv-water-dots{ font-size:20px; letter-spacing:4px; margin-top:var(--ux-space-2); }
.bv-sheet-overlay{ position:fixed; inset:0; display:flex; align-items:flex-end; justify-content:center; z-index:230; }
.bv-sheet{
  background:var(--ux-surface); border-radius:var(--ux-radius-panel) var(--ux-radius-panel) 0 0;
  padding:var(--ux-space-4) var(--ux-space-4) var(--ux-space-6); width:100%; max-width:560px;
  max-height:78vh; overflow-y:auto; -webkit-overflow-scrolling:touch;
  border-top:3px solid var(--ux-primary-border); animation:bv-sheet-in .3s ease-out;
}
.bv-yard-slots{ display:flex; gap:var(--ux-space-2); margin-bottom:var(--ux-space-2); }
.bv-yard-slot[data-ux-role="control"]{
  flex:1; flex-direction:column; border:2px solid var(--ux-primary-border); background:var(--ux-surface);
}
.bv-yard-slot[data-active="yes"]{ border-color:var(--ux-selected-border); background:var(--ux-surface-sunk); }
`;
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

/**
 * 개발용 fixture 주입구 (HARNESS §2 G0). 값이 있으면 이 화면은 Firebase 를
 * 구독하지도, 쓰지도 않는다 — 꿀 이슬·환전·구매·물주기 등 재화가 걸린 경로는
 * 전부 offline 가드로 막힌다. `quest` 를 생략해도 village 가 offline 이면
 * QuestBoard 에는 항상 빈 fixture 를 내려 보내 새는 구독을 만들지 않는다.
 */
export interface VillageFixture {
  counts?: Record<string, number>;
  allCosmetics?: Record<string, StudentCosmetics>;
  village?: VillageData;
  quest?: QuestBoardFixture;
}

interface Props {
  lang: string;
  roomCode: string;
  user: UserConfig;
  myClientId: string;
  roomConfig: RoomConfig;
  /** 심부름 클릭 이동 — village_water 는 여기서 지도 스크롤로 처리, 나머지는 위로 전달 */
  onQuestNavigate?: (event: QuestEventType) => void;
  fixture?: VillageFixture;
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
      type="button"
      data-ux-role="control"
      className="bv-item-tile"
      data-equipped={equipped ? "yes" : "no"}
      data-afford={affordable ? "yes" : "no"}
      onClick={onClick}
      aria-disabled={busy || undefined}
    >
      <div className="bv-item-emoji" aria-hidden>{emoji}</div>
      <div data-ux-role="label">{label}</div>
      <div data-ux-role="secondary">
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

export default function BeeVillage({ lang, roomCode, user, myClientId, roomConfig, onQuestNavigate, fixture }: Props) {
  /** fixture 가 주입되면 네트워크 경계를 통째로 끈다. */
  const offline = !!fixture;
  const [counts, setCounts] = useState<Record<string, number>>(fixture?.counts ?? {});
  const [countsReady, setCountsReady] = useState(offline);
  const [allCosmetics, setAllCosmetics] = useState<Record<string, StudentCosmetics>>(fixture?.allCosmetics ?? {});
  const [village, setVillage] = useState<VillageData>(fixture?.village ?? {});
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  // 3D 맵 상태 — loading(청크·씬 준비 전: 2D 표시) / on(3D) / off(WebGL 실패: 2D 폴백)
  const [map3d, setMap3d] = useState<"loading" | "on" | "off">("loading");
  // 내 집 꾸미기 바텀시트 (카탈로그 v2)
  const [decorateOpen, setDecorateOpen] = useState(false);
  // 심부름 "물주기" 클릭 시 지도 카드로 스크롤하기 위한 ref
  const mapCardRef = useRef<HTMLDivElement>(null);

  // 데스크톱 2열 재배치는 순수 CSS(.bv-layout, ≥900px)로 한다 — JS matchMedia
  // 분기 + 블록 두 벌을 유지하지 않는다(DOM 순서는 항상 모바일 순서 그대로).

  useEffect(() => {
    if (offline) return;
    const unsub = subscribeAllStudentCounts(roomCode, (c) => {
      setCounts(c);
      setCountsReady(true);
    });
    return () => unsub();
  }, [roomCode, offline]);

  useEffect(() => {
    if (offline) return;
    const unsub = subscribeAllCosmetics(roomCode, setAllCosmetics);
    return () => unsub();
  }, [roomCode, offline]);

  useEffect(() => {
    if (offline) return;
    const unsub = subscribeVillage(roomCode, setVillage);
    return () => unsub();
  }, [roomCode, offline]);

  // ── 입장 보상: 꿀 이슬(일 1회) + 스티커 환전(증가분) ──────────────
  // 마운트당 1회 (useRef 가드 — StrictMode double-invoke 대비. 트랜잭션
  // 자체도 날짜/기준점 가드로 멱등이라 중복 지급은 없다.)
  // fixture 에서는 절대 실행하지 않는다 — 재화 지급 경로.
  const rewardsRanRef = useRef(false);
  useEffect(() => {
    if (offline || user.isTeacher || !countsReady || rewardsRanRef.current) return;
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
  }, [countsReady, user.isTeacher, roomCode, myClientId, offline]);

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
          gardenLevel: e.village.gardenLevel ?? 0,
          gardenWater: e.village.gardenWater ?? 0,
        };
      }),
    [entries, myClientId, user.isTeacher],
  );

  // ── 상점 구매/장착 ──────────────────────────────────────────
  const [shopBusy, setShopBusy] = useState(false);
  async function handleDecoTap(deco: VillageDeco) {
    if (offline) return; // fixture: 구매·장착 쓰기 금지
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
    if (offline) return; // fixture: 구매·장착 쓰기 금지
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
    if (offline) return; // fixture: 물주기 쓰기 금지
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

  // ── 마을 맵 카드 ────────────────────────────────────────────
  const mapCard = (
    <div ref={mapCardRef} className="bv-panel" style={{ padding: "var(--ux-space-4) var(--ux-space-2)" /* hex grid: reduce horizontal padding to fit 5-col hex layout */ }}>
      <h2 data-ux-role="body-emphasis" className="bv-panel-title" style={{ margin: "0 var(--ux-space-2) var(--ux-space-1)" }}>
        🗺 마을 지도
      </h2>
      <p data-ux-role="secondary" style={{ margin: "0 var(--ux-space-2) var(--ux-space-3)" }}>
        {map3d === "on"
          ? `길을 따라 친구 집에 놀러 가요 · 물 ${WATER_PER_LEVEL}번을 받으면 집 앞 정원이 자라요`
          : `친구 집을 눌러 하루 한 번 💧 물을 줘요 — 물 ${WATER_PER_LEVEL}번이면 정원이 자라요`}
      </p>
      {map3d === "off" && (
        <p data-ux-role="secondary" role="status" style={{ margin: "0 8px 12px" }}>
          지금은 간단한 지도로 보여주고 있어요. 집 방문과 물주기는 그대로 할 수 있어요.
        </p>
      )}
      {entries.length === 0 ? (
        <p data-ux-role="body" style={{ textAlign: "center", padding: "var(--ux-space-6) 0" }}>
          아직 마을에 집이 없어요 — 칭찬 스티커를 받으면 집이 생겨요!
        </p>
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
        <div className="bv-hex-wrap">
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
                  type="button"
                  data-ux-role="control"
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
    <div className="bv-panel">
      <div className="bv-fac-row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <h2 data-ux-role="body-emphasis" className="bv-panel-title" style={{ margin: 0 }}>
            🏛 마을 공동 시설
          </h2>
          <p data-ux-role="secondary" style={{ margin: "var(--ux-space-1) 0 0" }}>
            {nextFacility
              ? `${nextFacility.emoji} ${nextFacility.label}까지 ${nextFacility.at - classTotal}개 남았어요! · 우리 반 칭찬 ${classTotal}🐝`
              : "🎉 모든 시설이 완성됐어요! 마을 축제가 열렸어요!"}
          </p>
        </div>
        <div className="bv-fac-icons">
          {VILLAGE_FACILITIES.map((f) => {
            const on = classTotal >= f.at;
            return (
              <div key={f.at} className="bv-fac-tile" data-on={on ? "yes" : "no"} title={`${f.label} (학급 ${f.at}개)`}>
                <div className="bv-item-emoji" style={{ fontSize: 22 }} aria-hidden>{f.emoji}</div>
                <div data-ux-role="secondary">{f.at}</div>
              </div>
            );
          })}
        </div>
      </div>
      {/* 다음 시설 진행바 */}
      {nextFacility && (
        <div className="bv-progress-track" role="progressbar" aria-valuenow={classTotal} aria-valuemin={0} aria-valuemax={nextFacility.at}>
          <div
            className="bv-progress-fill"
            style={{ width: `${Math.max(0, Math.min(100, (classTotal / nextFacility.at) * 100))}%` }}
          />
        </div>
      )}
    </div>
  );

  // ── 꿀 지갑 + 상점 패널 ────────────────────────────────────
  const walletPanel = !user.isTeacher ? (
    <div className="bv-panel">
      <div className="bv-wallet-row">
        <div style={{ flex: 1, minWidth: 150 }}>
          <p data-ux-role="secondary" style={{ margin: 0 }}>내 꿀 주머니</p>
          <p data-ux-role="body-emphasis" className="bv-honey-num" style={{ margin: 0 }}>
            🍯 {myHoney}
          </p>
          <p data-ux-role="secondary" style={{ margin: "var(--ux-space-1) 0 0" }}>
            {myVillage.lastDew === today
              ? "🌅 오늘의 꿀 이슬을 주웠어요"
              : "🌅 마을에 오면 매일 꿀 이슬을 주워요"}
            {" · 칭찬 스티커 1개 = 🍯5"}
          </p>
        </div>
        <button
          type="button"
          data-ux-role="action"
          onClick={() => setShopOpen((v) => !v)}
          style={{
            background: shopOpen ? "transparent" : "var(--ux-primary-fill)",
            color: shopOpen ? "var(--ux-ink)" : "var(--ux-primary-ink)",
            border: shopOpen ? "2px solid transparent" : "2px solid var(--ux-primary-border)",
          }}
        >
          {shopOpen ? "상점 닫기 ✕" : "🛍 내 집 가꾸기"}
        </button>
      </div>

      {/* 상점 패널 */}
      {shopOpen && (
        <div style={{ marginTop: "var(--ux-space-4)" }}>
          {(["roof", "garden", "plate"] as VillageSlot[]).map((slot) => (
            <div key={slot} style={{ marginBottom: "var(--ux-space-3)" }}>
              <p data-ux-role="label" style={{ margin: "0 0 var(--ux-space-2)" }}>
                {slot === "roof" ? "🏠" : slot === "garden" ? "🌱" : "🪧"} {SLOT_LABEL[slot]}
              </p>
              <div className="bv-item-grid">
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
          <p data-ux-role="secondary" style={{ margin: 0 }}>
            한 번 산 데코는 계속 보유해요. 같은 칸의 다른 데코로 언제든 바꿀 수 있어요.
          </p>
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
  // offline 인데 quest fixture 를 안 받았어도 QuestBoard 는 항상 offline 으로
  // 만든다 — 부모가 깜빡해도 새는 Firebase 구독이 생기지 않게 하는 안전망.
  const questFixture: QuestBoardFixture | undefined = offline
    ? (fixture?.quest ?? { quests: [], state: {} })
    : undefined;
  const questBoard = !user.isTeacher ? (
    <QuestBoard
      roomCode={roomCode}
      myClientId={myClientId}
      onToast={(msg, tone) => setToast({ msg, tone })}
      onGoTo={handleQuestGo}
      fixture={questFixture}
    />
  ) : null;

  return (
    <div className="bv-root">
      <ScopedStyle css={VILLAGE_CSS} />
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

      {/* 모바일: 퀘스트 → 지갑 → 시설 → 맵 순서로 쌓인다. ≥900px 에서는
          같은 마크업을 .bv-layout 의 grid-template-areas 가 좌(시설·맵)
          우(퀘스트·지갑) 2단으로 재배치한다 — 블록을 두 벌 만들지 않는다. */}
      <div className="bv-layout">
        {questBoard && <div className="bv-area-quest">{questBoard}</div>}
        {walletPanel && <div className="bv-area-wallet">{walletPanel}</div>}
        <div className="bv-area-facilities">{facilitiesBanner}</div>
        <div className="bv-area-map">{mapCard}</div>
      </div>

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
      className="bv-popover-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={OVERLAY}
      role="dialog"
      aria-modal="true"
    >
      <div className="bv-popover">
        <button type="button" data-ux-role="control" className="bv-close" onClick={onClose} aria-label="close">✕</button>

        <div className="bv-item-emoji" style={{ fontSize: 26 }} aria-hidden>{styleDeco?.emoji ?? roofDeco?.emoji ?? "🏠"}</div>

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

        <p data-ux-role="body-emphasis" style={{ fontWeight: 900, marginTop: "var(--ux-space-2)" }}>
          {entry.name}{isSelf ? " (나)" : ""}의 집
        </p>

        {/* 정원 게이지 — 새싹 단계(레벨 0)는 "Lv.0" 대신 말로 알린다
            (0 으로 채운 배지를 그대로 보여주지 않는다). */}
        <div className="bv-garden-box">
          <p data-ux-role="label" style={{ margin: 0 }}>
            {gardenDeco ? `${gardenDeco.emoji} ${gardenDeco.label}` : "🌱 정원"}
            {gardenLevel > 0 ? ` · Lv.${gardenLevel}` : " · 새싹"}
          </p>
          <div className="bv-water-dots" aria-hidden>
            {Array.from({ length: WATER_PER_LEVEL }).map((_, i) => (
              <span key={i} style={{ opacity: i < gardenWater ? 1 : 0.22 }}>💧</span>
            ))}
          </div>
          <p data-ux-role="secondary" style={{ margin: "var(--ux-space-1) 0 0" }}>
            물 {gardenWater}/{WATER_PER_LEVEL} — {WATER_PER_LEVEL}번 받으면 정원이 한 단계 자라요
          </p>
        </div>

        {/* 물주기 버튼 / 내 집이면 꾸미기 */}
        {isSelf ? (
          <>
            <p data-ux-role="secondary" style={{ marginTop: "var(--ux-space-3)" }}>
              친구들이 물을 주면 내 정원이 자라요 🌷
            </p>
            <button
              type="button"
              data-ux-role="action"
              onClick={onDecorate}
              style={{ marginTop: "var(--ux-space-3)", width: "100%" }}
            >
              🛋 꾸미기 — 집·문패·울타리·마당
            </button>
          </>
        ) : isTeacher ? null : (
          <button
            type="button"
            data-ux-role="action"
            onClick={() => canWater && !busy && onWater()}
            aria-disabled={!canWater || busy || undefined}
            aria-describedby={wateredToday ? "bv-water-hint" : undefined}
            style={{
              marginTop: "var(--ux-space-4)",
              width: "100%",
              background: canWater && !busy ? "var(--ux-primary-fill)" : "var(--ux-surface-sunk)",
              color: canWater && !busy ? "var(--ux-primary-ink)" : "var(--ux-ink-soft)",
              border: `2px solid ${canWater && !busy ? "var(--ux-primary-border)" : "transparent"}`,
            }}
          >
            {wateredToday ? "오늘은 이미 물을 줬어요 ✅" : "💧 물주기 (하루 1번)"}
          </button>
        )}
        {!isSelf && !isTeacher && wateredToday && (
          <span id="bv-water-hint" data-ux-role="secondary" style={{ display: "block", marginTop: "var(--ux-space-1)" }}>
            내일 다시 와서 물을 줄 수 있어요
          </span>
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
      <div style={{ marginBottom: "var(--ux-space-3)" }}>
        <p data-ux-role="label" style={{ margin: "0 0 var(--ux-space-2)" }}>
          {title}
        </p>
        <div className="bv-item-grid">
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
      className="bv-sheet-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={OVERLAY}
      role="dialog"
      aria-modal="true"
    >
      <div className="bv-sheet">
        <div className="bv-actions" style={{ marginBottom: "var(--ux-space-3)" }}>
          <div style={{ flex: 1 }}>
            <p data-ux-role="body-emphasis" style={{ fontWeight: 900, margin: 0 }}>🛋 내 집 꾸미기</p>
            <p data-ux-role="secondary" style={{ margin: "var(--ux-space-1) 0 0" }}>
              내 꿀 🍯 {honey} · 한 번 산 아이템은 계속 보유해요
            </p>
          </div>
          <button type="button" data-ux-role="control" className="bv-close" style={{ position: "static" }} onClick={onClose} aria-label="close">✕</button>
        </div>

        {section("🏠 집 스타일", "style")}
        {section("🪧 문패", "plate")}
        {section("🚧 울타리", "fence")}

        {/* 마당 — 슬롯 3칸 (좌/우/앞) 선택 후 아이템 장착 */}
        <div style={{ marginBottom: "var(--ux-space-1)" }}>
          <p data-ux-role="label" style={{ margin: "0 0 var(--ux-space-2)" }}>
            🌳 마당 (3칸)
          </p>
          <div className="bv-yard-slots">
            {(["왼쪽", "오른쪽", "앞"] as const).map((label, i) => {
              const cur = decoV2ById(house.yard[i]);
              const active = yardIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  data-ux-role="control"
                  className="bv-yard-slot"
                  data-active={active ? "yes" : "no"}
                  aria-pressed={active}
                  onClick={() => setYardIndex(i)}
                >
                  <div className="bv-item-emoji" style={{ fontSize: 20 }} aria-hidden>{cur?.emoji ?? "➕"}</div>
                  <span data-ux-role="secondary">
                    {label} {cur ? `· ${cur.label}` : "· 비어 있음"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="bv-item-grid">
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

        <p data-ux-role="secondary" style={{ marginTop: "var(--ux-space-3)" }}>
          예전에 산 지붕·정원 아이템은 새 마을에서도 그대로 쓸 수 있어요 (무료 전환).
        </p>
      </div>
    </div>
  );
}

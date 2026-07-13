// 🏡 꿀벌 마을 (V2) — 칭찬판 별도 탭 게임의 데이터 계층.
// docs/꿀벌마을-마스터플랜.md §5. 스티커 꾸미기 축과 독립인 "노력 재화" 🍯 꿀 축.
//
// rooms/{roomCode}/village/{clientId} =
//   { honey: number,
//     lastDew: "YYYY-MM-DD",            — 꿀 이슬 일일 보상 가드
//     lastExchangedCount: number,        — 스티커→꿀 환전 기준점
//     owned: { [itemId]: true },         — 구매한 데코 (재구매 방지)
//     house: { roof, garden, plate },    — 장착 중 데코
//     gardenLevel: number, gardenWater: number,
//     watered: { "YYYY-MM-DD": { [friendClientId]: true } } }
//
// clientId = 학생 이름 (pseudo-clientId) — 기존 stickers/cosmetics 와 동일 키.
// 일일 1회 보상·재화 증감은 전부 runTransaction (CLAUDE.md 가드레일 —
// get+set 분리 금지, 결과는 result.snapshot.val() 로 재독).

import { ref, onValue, off, update, runTransaction } from "firebase/database";
import { getClientDb } from "./firebase-client";
import { reportQuestEvent } from "./quests";

export const DEW_AMOUNT = 10;          // 꿀 이슬 줍기: 일 1회 +10
export const HONEY_PER_STICKER = 5;    // 스티커 1개 = 꿀 5 환전
export const WATER_PER_LEVEL = 5;      // 물 5회 = 정원 레벨 +1

export type VillageSlot = "roof" | "garden" | "plate";
/** V3 슬롯 — style(집 통짜)/plate(문패 디자인)/fence(울타리)/yard(마당 3칸) */
export type VillageSlotV2 = "style" | "plate" | "fence" | "yard";

export interface VillageHouse {
  // v1 필드 — 2D hex 맵(폴백)용. 마이그레이션 후에도 유지 (박탈 금지, ADR-4).
  roof?: string | null;
  garden?: string | null;
  /** v1 은 색 문패(plate-sky/pink), v2 는 디자인 문패(plate-wood/honey/flower).
   *  같은 필드를 공유 — decoById 가 두 카탈로그를 모두 찾으므로 2D 폴백에서도
   *  v2 문패가 색으로 렌더된다. */
  plate?: string | null;
  // v2 필드 (docs/꿀벌마을-3D-설계.md §1 ADR-4)
  style?: string | null;              // house-hive | house-mushroom | house-tent | house-castle
  fence?: string | null;              // fence-wood | fence-flower | null
  /** 마당 슬롯 3. Firebase 는 배열의 null 원소를 제거하므로 빈 칸은 "" 로
   *  저장한다 (normalizeYard 가 읽기 시 null 로 복원). */
  yard?: Array<string | null>;
}

export interface VillageState {
  honey?: number;
  lastDew?: string;
  lastExchangedCount?: number;
  owned?: Record<string, true>;
  house?: VillageHouse;
  gardenLevel?: number;
  gardenWater?: number;
  watered?: Record<string, Record<string, true>>;
}

export type VillageData = Record<string, VillageState>;

// ── 마을 데코 카탈로그 (1차 무에셋 — 이모지+CSS) ─────────────────
export interface VillageDeco {
  id: string;
  slot: VillageSlot;
  emoji: string;        // plate 는 스와치 대용 이모지
  label: string;        // 한국어 하드코딩 허용 (가드레일 — 신규 i18n 키 대량 추가 금지)
  price: number;        // 🍯
  /** plate 전용 — 문패 배경색 */
  color?: string;
}

export const VILLAGE_DECOS: VillageDeco[] = [
  // 지붕
  { id: "roof-mushroom", slot: "roof", emoji: "🍄", label: "버섯 지붕", price: 30 },
  { id: "roof-tent",     slot: "roof", emoji: "⛺", label: "텐트 지붕", price: 50 },
  { id: "roof-castle",   slot: "roof", emoji: "🏰", label: "성 지붕",   price: 100 },
  // 정원 (꽃 종류 — 정원 레벨만큼 꽃이 늘어난다)
  { id: "garden-tulip",     slot: "garden", emoji: "🌷", label: "튤립 정원",   price: 10 },
  { id: "garden-sunflower", slot: "garden", emoji: "🌻", label: "해바라기 정원", price: 20 },
  { id: "garden-rose",      slot: "garden", emoji: "🌹", label: "장미 정원",   price: 40 },
  { id: "garden-lavender",  slot: "garden", emoji: "🪻", label: "라벤더 정원", price: 60 },
  // 문패 색
  { id: "plate-sky",  slot: "plate", emoji: "🟦", label: "하늘 문패", price: 15, color: "#BAE6FD" },
  { id: "plate-pink", slot: "plate", emoji: "🟪", label: "분홍 문패", price: 15, color: "#FBCFE8" },
];

// ── 카탈로그 v2 (3D 맵 — 설계서 §4 가격표. id = /village/<id>.png 파일명) ──
export interface VillageDecoV2 {
  id: string;
  slot: VillageSlotV2;
  emoji: string;        // 에셋 로드 전/부재 시 상점 타일 표시용
  label: string;        // 한국어 하드코딩 허용
  price: number;        // 🍯 (0 = 기본 무료)
  /** 3D 색 박스 폴백·문패 캔버스 폴백 색 */
  color?: string;
}

export const VILLAGE_DECOS_V2: VillageDecoV2[] = [
  // 집 style
  { id: "house-hive",     slot: "style", emoji: "🛖", label: "벌집 오두막", price: 0,   color: "#F0B429" },
  { id: "house-mushroom", slot: "style", emoji: "🍄", label: "버섯집",     price: 120, color: "#EF6461" },
  { id: "house-tent",     slot: "style", emoji: "⛺", label: "텐트집",     price: 180, color: "#5FA8E8" },
  { id: "house-castle",   slot: "style", emoji: "🏰", label: "꼬마 성",    price: 300, color: "#A78BFA" },
  // 문패 plate (빈 판 — 이름은 런타임 캔버스 합성)
  { id: "plate-wood",   slot: "plate", emoji: "🪵", label: "나무 문패", price: 0,  color: "#D9A05B" },
  { id: "plate-honey",  slot: "plate", emoji: "🍯", label: "꿀 문패",   price: 40, color: "#FDE68A" },
  { id: "plate-flower", slot: "plate", emoji: "🌸", label: "꽃 문패",   price: 40, color: "#FBCFE8" },
  // 울타리 fence
  { id: "fence-wood",   slot: "fence", emoji: "🪵", label: "나무 울타리", price: 60, color: "#B07C4F" },
  { id: "fence-flower", slot: "fence", emoji: "💐", label: "꽃 울타리",   price: 90, color: "#F48FB1" },
  // 마당 yard
  { id: "yard-flowerbed-tulip", slot: "yard", emoji: "🌷", label: "튤립 꽃밭",       price: 20,  color: "#F472B6" },
  { id: "yard-flowerbed-rose",  slot: "yard", emoji: "🌹", label: "장미 꽃밭",       price: 35,  color: "#E44F5A" },
  { id: "yard-bench",           slot: "yard", emoji: "🪑", label: "나무 벤치",       price: 50,  color: "#C08A52" },
  { id: "yard-mailbox",         slot: "yard", emoji: "📮", label: "우체통",          price: 50,  color: "#F87171" },
  { id: "yard-lamp",            slot: "yard", emoji: "🏮", label: "꿀 램프",         price: 60,  color: "#FBBF24" },
  { id: "yard-pond",            slot: "yard", emoji: "💧", label: "미니 연못",       price: 80,  color: "#7DD3FC" },
  { id: "yard-tree-cherry",     slot: "yard", emoji: "🌸", label: "벚나무",          price: 100, color: "#F9A8D4" },
  { id: "yard-tree-honey",      slot: "yard", emoji: "🍯", label: "꿀단지 나무",     price: 120, color: "#84CC16" },
];

/** 기본(무료) 장착값 — 모든 학생이 소유한 것으로 취급 (price 0) */
export const DEFAULT_STYLE = "house-hive";
export const DEFAULT_PLATE_V2 = "plate-wood";

export function decoV2ById(id: string | null | undefined): VillageDecoV2 | null {
  if (!id) return null;
  return VILLAGE_DECOS_V2.find((d) => d.id === id) ?? null;
}

export function decoById(id: string | null | undefined): VillageDeco | null {
  if (!id) return null;
  // v2 문패가 house.plate 필드를 공유하므로, 2D 폴백의 색 조회가 깨지지 않게
  // v1 카탈로그 → v2 카탈로그 순으로 찾는다 (VillageDecoV2 는 상위 호환 형태).
  return (
    VILLAGE_DECOS.find((d) => d.id === id) ??
    (decoV2ById(id) as unknown as VillageDeco | null)
  );
}

// ── v1 → v2 무료 매핑 (ADR-4 박탈 금지 — v1 구매 이력은 그대로 유효) ──
// roof-* 보유 → 대응 style 소유. garden-* → 대응 yard 꽃밭.
// v1 색 문패는 v2 에 1:1 대응이 없어 가장 근접한 디자인 문패를 무료 부여.
export const V1_TO_V2_MAP: Record<string, string> = {
  "roof-mushroom": "house-mushroom",
  "roof-tent": "house-tent",
  "roof-castle": "house-castle",
  "garden-tulip": "yard-flowerbed-tulip",
  "garden-rose": "yard-flowerbed-rose",
  "garden-sunflower": "yard-flowerbed-tulip",
  "garden-lavender": "yard-flowerbed-rose",
  "plate-sky": "plate-honey",
  "plate-pink": "plate-flower",
};

/** yard 필드 정규화 — Firebase 는 배열 null 원소를 지우므로 "" ↔ null 변환 +
 *  항상 길이 3 보장. (희소 객체로 돌아오는 경우도 방어) */
export function normalizeYard(
  yard: Array<string | null> | Record<number, string> | null | undefined,
): Array<string | null> {
  const out: Array<string | null> = [null, null, null];
  if (yard) {
    for (let i = 0; i < 3; i++) {
      const v = Array.isArray(yard) ? yard[i] : yard[i];
      out[i] = v ? v : null;
    }
  }
  return out;
}

/** v2 소유 집합 — 명시 owned + v1 보유분의 무료 매핑 + 기본템(price 0).
 *  쓰기 없는 읽기 시점 파생이라 마이그레이션 실패/중복 지급이 없다. */
export function ownedDecoIdsV2(state: VillageState | null | undefined): Record<string, true> {
  const out: Record<string, true> = {};
  for (const d of VILLAGE_DECOS_V2) if (d.price === 0) out[d.id] = true;
  for (const id of Object.keys(state?.owned ?? {})) {
    out[id] = true;
    const mapped = V1_TO_V2_MAP[id];
    if (mapped) out[mapped] = true;
  }
  return out;
}

export interface HouseV2 {
  style: string;
  plate: string;
  fence: string | null;
  yard: Array<string | null>;
}

/** house 의 v2 유효값 — v2 필드가 없으면 v1 장착값을 매핑해 파생 (읽기 전용
 *  마이그레이션). 3D 씬과 꾸미기 시트가 이 값만 본다. */
export function effectiveHouseV2(state: VillageState | null | undefined): HouseV2 {
  const h = state?.house ?? {};
  const style =
    h.style && decoV2ById(h.style)?.slot === "style"
      ? h.style
      : V1_TO_V2_MAP[h.roof ?? ""] ?? DEFAULT_STYLE;
  const plate =
    h.plate && decoV2ById(h.plate)?.slot === "plate"
      ? h.plate
      : V1_TO_V2_MAP[h.plate ?? ""] ?? DEFAULT_PLATE_V2;
  const fence = h.fence && decoV2ById(h.fence)?.slot === "fence" ? h.fence : null;
  let yard = normalizeYard(h.yard);
  if (!h.yard && h.garden) {
    // v2 마당을 아직 만진 적 없으면 v1 정원 꽃을 마당 1칸에 매핑해 보여준다
    yard = [V1_TO_V2_MAP[h.garden] ?? null, null, null];
  }
  return { style, plate, fence, yard };
}

// ── 마을 공동 시설 (학급 스티커 합계로 해금) ─────────────────────
export interface VillageFacility {
  at: number;      // 필요 학급 스티커 합계
  emoji: string;
  label: string;
  /** 3D 에셋 id — /village/<id>.png (에셋 매니페스트 §2 파일명 고정) */
  id: string;
}

export const VILLAGE_FACILITIES: VillageFacility[] = [
  { at: 50,  emoji: "⛲", label: "분수대",   id: "facility-fountain" },
  { at: 150, emoji: "🌸", label: "꽃시계",   id: "facility-clock" },
  { at: 300, emoji: "🎉", label: "마을 축제", id: "facility-festival" },
];

// ── 내부 유틸 ────────────────────────────────────────────────
function villagePath(roomCode: string): string {
  return `rooms/${roomCode}/village`;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── 구독 ────────────────────────────────────────────────────
/** 마을 전체 구독 — 학급 규모라 단일 노드 구독으로 충분 (gallery 와 동일 패턴). */
export function subscribeVillage(
  roomCode: string,
  cb: (data: VillageData) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, villagePath(roomCode));
  const unsub = onValue(r, (snap) => {
    const val = snap.val() as VillageData | null;
    cb(val ?? {});
  });
  return () => { off(r); void unsub; };
}

// ── 게임 루프 ────────────────────────────────────────────────

/**
 * 꿀 이슬 줍기 — 마을 첫 방문 시 일 1회 +10 꿀. runTransaction 원자화.
 * @returns collected=true 면 오늘 처음 (지급됨). honey 는 트랜잭션 후 잔액.
 */
export async function collectDailyDew(
  roomCode: string,
  clientId: string,
): Promise<{ collected: boolean; honey: number }> {
  const db = getClientDb();
  const r = ref(db, `${villagePath(roomCode)}/${clientId}`);
  const today = todayStr();
  const result = await runTransaction(r, (cur: VillageState | null) => {
    if (cur && cur.lastDew === today) return; // abort — 오늘 이미 주움
    return {
      ...(cur ?? {}),
      honey: (cur?.honey ?? 0) + DEW_AMOUNT,
      lastDew: today,
    };
  });
  const after = (result.snapshot.val() as VillageState | null) ?? {};
  return { collected: result.committed, honey: after.honey ?? 0 };
}

/**
 * 스티커 → 꿀 환전 — "내 스티커 수 × 5" 기준으로 아직 환전 안 된 증가분만
 * 적립. lastExchangedCount 로 기준점을 기록 (트랜잭션 원자화).
 * @returns gained = 이번에 적립된 꿀 (0 이면 증가분 없음).
 */
export async function exchangeStickerHoney(
  roomCode: string,
  clientId: string,
  currentStickerCount: number,
): Promise<{ gained: number; honey: number }> {
  const count = Math.max(0, Math.floor(currentStickerCount));
  const db = getClientDb();
  const r = ref(db, `${villagePath(roomCode)}/${clientId}`);
  // 트랜잭션 콜백은 재시도로 여러 번 실행될 수 있다 — 캡처값(lastDelta)은
  // "커밋된 마지막 실행"의 값이므로 committed 일 때만 신뢰해 사용한다.
  // (잔액 honey 는 가드레일대로 스냅샷 재독)
  let lastDelta = 0;
  const result = await runTransaction(r, (cur: VillageState | null) => {
    const base = cur?.lastExchangedCount ?? 0;
    const delta = count - base;
    if (delta <= 0) return; // abort — 새로 환전할 증가분 없음 (시즌 리셋 후 감소 포함)
    lastDelta = delta;
    return {
      ...(cur ?? {}),
      honey: (cur?.honey ?? 0) + delta * HONEY_PER_STICKER,
      lastExchangedCount: count,
    };
  });
  const after = (result.snapshot.val() as VillageState | null) ?? {};
  if (!result.committed) return { gained: 0, honey: after.honey ?? 0 };
  return { gained: lastDelta * HONEY_PER_STICKER, honey: after.honey ?? 0 };
}

/**
 * 데코 구매+장착 — 트랜잭션 원자화. v1(VillageDeco)·v2(VillageDecoV2) 겸용.
 * 이미 보유(owned — v2 는 v1 무료 매핑·기본템 포함)면 꿀 차감 없이 장착만.
 * 잔액 부족이면 abort. yard 슬롯은 yardIndex(0~2) 칸에 장착.
 * @returns status: "bought"(구매+장착) | "equipped"(보유품 장착) | "poor"(잔액 부족)
 */
export async function buyOrEquipDeco(
  roomCode: string,
  clientId: string,
  deco: VillageDeco | VillageDecoV2,
  yardIndex = 0,
): Promise<{ status: "bought" | "equipped" | "poor"; honey: number }> {
  const db = getClientDb();
  const r = ref(db, `${villagePath(roomCode)}/${clientId}`);
  // 캡처값(lastOwned)은 커밋된 마지막 실행의 값 — committed 일 때만 사용.
  let lastOwned = false;
  const result = await runTransaction(r, (cur: VillageState | null) => {
    const owned = cur?.owned ?? {};
    const honey = cur?.honey ?? 0;
    const alreadyOwned = ownedDecoIdsV2(cur)[deco.id] === true || owned[deco.id] === true;
    if (!alreadyOwned && honey < deco.price) return; // abort — 잔액 부족
    lastOwned = alreadyOwned;
    const house: VillageHouse = { ...(cur?.house ?? {}) };
    if (deco.slot === "yard") {
      const yard = normalizeYard(house.yard);
      yard[Math.max(0, Math.min(2, yardIndex))] = deco.id;
      // Firebase 는 배열 null 원소를 지워 인덱스가 밀린다 — 빈 칸은 "" 저장
      house.yard = yard.map((v) => v ?? "");
    } else {
      house[deco.slot] = deco.id;
    }
    return {
      ...(cur ?? {}),
      honey: alreadyOwned ? honey : honey - deco.price,
      owned: { ...owned, [deco.id]: true as const },
      house,
    };
  });
  const after = (result.snapshot.val() as VillageState | null) ?? {};
  if (!result.committed) return { status: "poor", honey: after.honey ?? 0 };
  return { status: lastOwned ? "equipped" : "bought", honey: after.honey ?? 0 };
}

/** 장착 해제 / 보유품 교체 장착 — 재화 변동 없음 (구매 검증은 호출부의
 *  구독 상태 + buyOrEquipDeco 트랜잭션이 담당). 낙관적 쓰기.
 *  v2 슬롯(style/fence/yard) 포함 — yard 는 yardIndex 칸만 갱신. */
export async function equipDeco(
  roomCode: string,
  clientId: string,
  slot: VillageSlot | VillageSlotV2,
  itemId: string | null,
  yardIndex = 0,
): Promise<void> {
  const db = getClientDb();
  if (slot === "yard") {
    // 배열 부분 갱신은 read-modify 가 필요 — 칸 단위 경합 방지로 트랜잭션.
    const i = Math.max(0, Math.min(2, yardIndex));
    await runTransaction(
      ref(db, `${villagePath(roomCode)}/${clientId}/house/yard`),
      (cur: Array<string | null> | null) => {
        const yard = normalizeYard(cur);
        yard[i] = itemId;
        return yard.map((v) => v ?? "");
      },
    );
    return;
  }
  await update(ref(db, `${villagePath(roomCode)}/${clientId}/house`), { [slot]: itemId });
}

export type WaterResult =
  | { status: "already" }                       // 오늘 이 친구에게 이미 물 줌
  | { status: "done"; leveledUp: boolean; gardenLevel: number; gardenWater: number };

/**
 * 친구 집 물주기 — 하루 1회/친구. 물 5회 받으면 정원 레벨 +1.
 * 1단계: 내 watered/{today}/{friend} 가드를 트랜잭션으로 선점 (commentOncePerDay 패턴).
 * 2단계: 친구 노드의 gardenWater/gardenLevel 트랜잭션 증가.
 */
export async function waterFriendGarden(
  roomCode: string,
  myClientId: string,
  friendClientId: string,
): Promise<WaterResult> {
  const db = getClientDb();
  const today = todayStr();
  const guardRef = ref(
    db,
    `${villagePath(roomCode)}/${myClientId}/watered/${today}/${friendClientId}`,
  );
  const guard = await runTransaction(guardRef, (cur: true | null) => {
    if (cur === true) return; // abort — 오늘 이미
    return true;
  });
  if (!guard.committed) return { status: "already" };

  const friendRef = ref(db, `${villagePath(roomCode)}/${friendClientId}`);
  const result = await runTransaction(friendRef, (cur: VillageState | null) => {
    const water = (cur?.gardenWater ?? 0) + 1;
    const levelUp = water >= WATER_PER_LEVEL;
    return {
      ...(cur ?? {}),
      gardenWater: levelUp ? 0 : water,
      gardenLevel: (cur?.gardenLevel ?? 0) + (levelUp ? 1 : 0),
    };
  });
  // 결과는 스냅샷 재독 (StrictMode double-invoke 가드레일) —
  // 물이 0 으로 리셋됐다면 방금 레벨업한 것.
  const after = (result.snapshot.val() as VillageState | null) ?? {};
  const gardenWater = after.gardenWater ?? 0;
  const gardenLevel = after.gardenLevel ?? 0;
  // 📋 일일 퀘스트 — 물주기 성공 시, 물 준 학생(my) 기준.
  reportQuestEvent(roomCode, myClientId, "village_water");
  return { status: "done", leveledUp: result.committed && gardenWater === 0, gardenLevel, gardenWater };
}

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

export interface VillageHouse {
  roof?: string | null;
  garden?: string | null;
  plate?: string | null;
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

export function decoById(id: string | null | undefined): VillageDeco | null {
  if (!id) return null;
  return VILLAGE_DECOS.find((d) => d.id === id) ?? null;
}

// ── 마을 공동 시설 (학급 스티커 합계로 해금) ─────────────────────
export interface VillageFacility {
  at: number;      // 필요 학급 스티커 합계
  emoji: string;
  label: string;
}

export const VILLAGE_FACILITIES: VillageFacility[] = [
  { at: 50,  emoji: "⛲", label: "분수대" },
  { at: 150, emoji: "🌸", label: "꽃시계" },
  { at: 300, emoji: "🎉", label: "마을 축제" },
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
 * 데코 구매+장착 — 트랜잭션 원자화.
 * 이미 보유(owned)면 꿀 차감 없이 장착만. 잔액 부족이면 abort.
 * @returns status: "bought"(구매+장착) | "equipped"(보유품 장착) | "poor"(잔액 부족)
 */
export async function buyOrEquipDeco(
  roomCode: string,
  clientId: string,
  deco: VillageDeco,
): Promise<{ status: "bought" | "equipped" | "poor"; honey: number }> {
  const db = getClientDb();
  const r = ref(db, `${villagePath(roomCode)}/${clientId}`);
  // 캡처값(lastOwned)은 커밋된 마지막 실행의 값 — committed 일 때만 사용.
  let lastOwned = false;
  const result = await runTransaction(r, (cur: VillageState | null) => {
    const owned = cur?.owned ?? {};
    const honey = cur?.honey ?? 0;
    const alreadyOwned = owned[deco.id] === true;
    if (!alreadyOwned && honey < deco.price) return; // abort — 잔액 부족
    lastOwned = alreadyOwned;
    return {
      ...(cur ?? {}),
      honey: alreadyOwned ? honey : honey - deco.price,
      owned: { ...owned, [deco.id]: true as const },
      house: { ...(cur?.house ?? {}), [deco.slot]: deco.id },
    };
  });
  const after = (result.snapshot.val() as VillageState | null) ?? {};
  if (!result.committed) return { status: "poor", honey: after.honey ?? 0 };
  return { status: lastOwned ? "equipped" : "bought", honey: after.honey ?? 0 };
}

/** 장착 해제 / 보유품 교체 장착 — 재화 변동 없음 (구매 검증은 호출부의
 *  구독 상태 + buyOrEquipDeco 트랜잭션이 담당). 낙관적 쓰기. */
export async function equipDeco(
  roomCode: string,
  clientId: string,
  slot: VillageSlot,
  itemId: string | null,
): Promise<void> {
  const db = getClientDb();
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

/**
 * 꿀벌 감정 이모티콘 20종 (무드미터) — 소통창·동화책의 공감에 쓴다.
 *
 * 예일 RULER 무드미터를 1~2학년이 쓸 수 있게 줄인 것이다. 두 축으로 나눈다:
 *   - energy       : 마음이 들떠 있나(high) 가라앉아 있나(low)
 *   - pleasantness : 기분이 좋은가(pleasant) 불편한가(unpleasant)
 * 네 칸(quadrant)에 5종씩, 모두 20종. 아이가 "화남/기쁨" 둘 중 하나로만
 * 고르지 않고 자기 상태를 더 정확히 짚게 하려는 것이 무드미터의 목적이다.
 *
 * 기존 공감 5종(lib/cardReactions.ts)은 **남의 글에 보내는 반응**이고,
 * 이쪽은 **내 기분**이다. 둘을 섞지 않는다.
 *
 * 파일은 public/ui-icons/v1/moods/{id}.png. 생성은
 * scripts/gen-bee-moods.mjs, 검수는 scripts/test-bee-mood-assets.mjs.
 */

export type MoodQuadrant = "red" | "yellow" | "blue" | "green";

export interface BeeMood {
  id: string;
  /** 한국어 라벨 — 아이가 읽는 말 그대로. */
  ko: string;
  en: string;
  quadrant: MoodQuadrant;
  energy: "high" | "low";
  pleasantness: "pleasant" | "unpleasant";
  /** 그림이 없을 때 내려갈 이모지. 20종이 서로 겹치지 않는다. */
  emoji: string;
  /** 생성 프롬프트에 넣는 표정·자세 묘사(영어). */
  pose: string;
}

/** 무드미터 네 칸의 뜻과 색. 색은 무드미터 관례를 따른다. */
export const MOOD_QUADRANTS: Record<MoodQuadrant, { ko: string; en: string; hint: string }> = {
  red:    { ko: "속상하고 들떠요", en: "High energy, unpleasant", hint: "마음이 크게 흔들릴 때" },
  yellow: { ko: "즐겁고 신나요",   en: "High energy, pleasant",   hint: "기운이 솟을 때" },
  blue:   { ko: "가라앉았어요",     en: "Low energy, unpleasant",  hint: "기운이 없을 때" },
  green:  { ko: "편안해요",         en: "Low energy, pleasant",    hint: "마음이 놓일 때" },
};

export const BEE_MOODS: BeeMood[] = [
  // ── 빨강: 기운 높음 · 불편함 ──
  { id: "angry",       ko: "화나요",     en: "Angry",       quadrant: "red", energy: "high", pleasantness: "unpleasant", emoji: "😠", pose: "eyebrows angled down hard, mouth a tight downward curve, tiny puff marks near the head, fists up" },
  { id: "frustrated",  ko: "답답해요",   en: "Frustrated",  quadrant: "red", energy: "high", pleasantness: "unpleasant", emoji: "😤", pose: "scrunched eyes, mouth pressed flat to one side, both hands pulling at the head" },
  { id: "nervous",     ko: "긴장돼요",   en: "Nervous",     quadrant: "red", energy: "high", pleasantness: "unpleasant", emoji: "😬", pose: "wide round eyes, wavy nervous mouth, shoulders pulled up, one small sweat drop" },
  { id: "worried",     ko: "걱정돼요",   en: "Worried",     quadrant: "red", energy: "high", pleasantness: "unpleasant", emoji: "😟", pose: "eyebrows tilted up in the middle, small downturned mouth, both hands held together in front" },
  { id: "shy",         ko: "부끄러워요", en: "Shy",         quadrant: "red", energy: "high", pleasantness: "unpleasant", emoji: "😳", pose: "looking down and away, round blush patches on both cheeks, hands covering part of the face" },

  // ── 노랑: 기운 높음 · 즐거움 ──
  { id: "happy",       ko: "기뻐요",     en: "Happy",       quadrant: "yellow", energy: "high", pleasantness: "pleasant", emoji: "😊", pose: "curved happy eyes, big open smile, both arms raised a little" },
  { id: "excited",     ko: "신나요",     en: "Excited",     quadrant: "yellow", energy: "high", pleasantness: "pleasant", emoji: "🤩", pose: "star-bright round eyes, wide open smile, body leaning forward, wings spread mid-flap" },
  { id: "proud",       ko: "뿌듯해요",   en: "Proud",       quadrant: "yellow", energy: "high", pleasantness: "pleasant", emoji: "😌", pose: "chest puffed out, closed confident smile, one hand on the chest, chin slightly up" },
  { id: "curious",     ko: "궁금해요",   en: "Curious",     quadrant: "yellow", energy: "high", pleasantness: "pleasant", emoji: "🤔", pose: "head tilted to one side, one eyebrow raised, small open mouth, one hand near the chin" },
  { id: "surprised",   ko: "놀랐어요",   en: "Surprised",   quadrant: "yellow", energy: "high", pleasantness: "pleasant", emoji: "😮", pose: "very wide round eyes, small round open mouth, both hands up beside the head, wings flared" },

  // ── 파랑: 기운 낮음 · 불편함 ──
  { id: "sad",         ko: "슬퍼요",     en: "Sad",         quadrant: "blue", energy: "low", pleasantness: "unpleasant", emoji: "😢", pose: "droopy eyes with one round tear, downturned mouth, shoulders and wings drooping" },
  { id: "lonely",      ko: "외로워요",   en: "Lonely",      quadrant: "blue", energy: "low", pleasantness: "unpleasant", emoji: "🥺", pose: "sitting small with knees drawn in, arms hugging itself, eyes looking sideways, tiny frown" },
  { id: "tired",       ko: "피곤해요",   en: "Tired",       quadrant: "blue", energy: "low", pleasantness: "unpleasant", emoji: "😴", pose: "half closed heavy eyes, small yawn, wings folded down, body slumped" },
  { id: "bored",       ko: "지루해요",   en: "Bored",       quadrant: "blue", energy: "low", pleasantness: "unpleasant", emoji: "😑", pose: "flat half-lidded eyes, straight flat mouth, cheek resting on one hand" },
  { id: "let-down",    ko: "실망했어요", en: "Let down",    quadrant: "blue", energy: "low", pleasantness: "unpleasant", emoji: "😞", pose: "eyes looking down, small sighing mouth, arms hanging loose at the sides" },

  // ── 초록: 기운 낮음 · 즐거움 ──
  { id: "calm",        ko: "편안해요",   en: "Calm",        quadrant: "green", energy: "low", pleasantness: "pleasant", emoji: "😌", pose: "gently closed curved eyes, soft small smile, relaxed round posture, wings resting" },
  { id: "thankful",    ko: "고마워요",   en: "Thankful",    quadrant: "green", energy: "low", pleasantness: "pleasant", emoji: "🙏", pose: "warm closed-eye smile, both hands pressed together in front of the chest, head bowed a little" },
  { id: "loved",       ko: "사랑받아요", en: "Loved",       quadrant: "green", energy: "low", pleasantness: "pleasant", emoji: "🥰", pose: "curved happy eyes, soft smile, both hands holding a small simple heart shape at the chest" },
  { id: "hopeful",     ko: "기대돼요",   en: "Hopeful",     quadrant: "green", energy: "low", pleasantness: "pleasant", emoji: "✨", pose: "eyes looking gently upward, small hopeful smile, hands clasped near the chest" },
  { id: "peaceful",    ko: "마음이 놓여요", en: "Peaceful", quadrant: "green", energy: "low", pleasantness: "pleasant", emoji: "🍃", pose: "soft half-closed eyes, tiny content smile, floating slowly with wings barely moving, body tilted back a little" },
];

const BY_ID = new Map(BEE_MOODS.map((m) => [m.id, m]));

export function isBeeMoodId(v: unknown): v is string {
  return typeof v === "string" && BY_ID.has(v);
}

export function beeMood(id: string): BeeMood | null {
  return BY_ID.get(id) ?? null;
}

/** 그림 경로. 모르는 id 에서 조용히 넘어가지 않고 던진다(lib/uiIcons 와 같은 계약). */
export function beeMoodAssetPath(id: string, size: 64 | 128 = 128): string {
  if (!isBeeMoodId(id)) throw new Error(`unknown bee mood id: ${String(id)}`);
  return `/ui-icons/v1/moods/${id}-${size}.png`;
}

export function beeMoodEmoji(id: string): string {
  return BY_ID.get(id)?.emoji ?? "🐝";
}

/** 네 칸으로 묶어 돌려준다 — 무드미터 화면이 이 순서로 그린다. */
export function moodsByQuadrant(): Record<MoodQuadrant, BeeMood[]> {
  const out: Record<MoodQuadrant, BeeMood[]> = { red: [], yellow: [], blue: [], green: [] };
  for (const m of BEE_MOODS) out[m.quadrant].push(m);
  return out;
}

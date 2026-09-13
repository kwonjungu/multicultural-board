/**
 * 소통창·동화책 공감의 데이터 계약 — 순수 로직.
 *
 * 시각 레이어(PadletCard)와 분리해 둔다. 옛 데이터 호환은 눈으로 보고
 * 판단할 수 없는 종류의 규칙이라, 실제로 실행해 검사할 수 있어야 한다
 * (`scripts/test-card-reactions.mjs`).
 *
 * ── 2026-09-14 확장 ────────────────────────────────────────────────
 * 공감을 이모지 5종에서 **꿀벌 감정 그림 20종(무드미터)** 으로 넓혔다
 * (사용자 지시: "공감에 쓰는 이모티콘을 꿀벌로 감정을 표현해서 무드미터
 * 수준으로 20종 가까이"). 목록은 lib/beeMoods.ts 가 단일 소스다.
 *
 * **옛 5종은 지우지 않았다.** 저장된 값이 그대로 그 문자열이라 목록에서 빼면
 * 이미 눌린 공감이 화면에서 사라진다. 그래서 옛 5종은 "고를 수는 없지만 읽고
 * 세는" 항목으로 남긴다 — 각자의 뜻(고마워·나도 그래…)을 잃지 않고, 그림만
 * 가장 가까운 꿀벌 것을 빌려 쓴다. 새로 고르는 값은 언제나 꿀벌 감정 id 다.
 */
import { BEE_MOODS, type BeeMood, type MoodQuadrant } from "./beeMoods";

export interface ReactionOption {
  id: string;
  /** i18n 키. 옛 5종만 갖고 있다(꿀벌 감정은 beeMoods 의 ko/en 을 쓴다). */
  key?: string;
  /** 그림이 없을 때 내려갈 이모지. */
  icon: string;
  /** 이 항목을 그릴 꿀벌 감정 그림의 id. */
  art: string;
  /** 무드미터 칸. 옛 5종은 없다. */
  quadrant?: MoodQuadrant;
  /** 고를 수 있는가. 옛 5종은 false — 읽고 세기만 한다. */
  pickable: boolean;
  ko?: string;
  en?: string;
}

/** 고를 수 있는 공감 — 꿀벌 감정 20종. 배열 순서가 화면 순서다. */
export const MOOD_REACTIONS: ReactionOption[] = BEE_MOODS.map((m: BeeMood) => ({
  id: m.id,
  icon: m.emoji,
  art: m.id,
  quadrant: m.quadrant,
  pickable: true,
  ko: m.ko,
  en: m.en,
}));

/**
 * 옛 5종. **id 를 절대 바꾸지 않는다** — 저장된 값이 이 문자열이다.
 * `art` 는 뜻이 가장 가까운 꿀벌 그림을 빌린 것이고, 뜻 자체는 key 가 지킨다.
 */
export const LEGACY_REACTIONS: ReactionOption[] = [
  { id: "like",   key: "reactLike",   icon: "💛", art: "happy",    pickable: false },
  { id: "thanks", key: "reactThanks", icon: "🌷", art: "thankful", pickable: false },
  { id: "nice",   key: "reactNice",   icon: "⭐", art: "excited",  pickable: false },
  { id: "cheer",  key: "reactCheer",  icon: "🚩", art: "hopeful",  pickable: false },
  { id: "same",   key: "reactSame",   icon: "💬", art: "curious",  pickable: false },
];

/** 읽기·집계에 쓰는 전체 목록(25종). 화면에 다 그리지는 않는다. */
export const ALL_REACTIONS: ReactionOption[] = [...MOOD_REACTIONS, ...LEGACY_REACTIONS];

/**
 * 예전 이름. PadletCard 등이 `REACTIONS` 로 가져다 쓰고 있어 그대로 둔다 —
 * 지금은 **고를 수 있는 것들**을 가리킨다.
 */
export const REACTIONS = MOOD_REACTIONS;

export type ReactionKind = string;

const BY_ID = new Map(ALL_REACTIONS.map((r) => [r.id, r]));

export function isReactionId(v: unknown): v is string {
  return typeof v === "string" && BY_ID.has(v);
}

export function reactionOption(id: string): ReactionOption | null {
  return BY_ID.get(id) ?? null;
}

/** 화면에 쓸 이름. 꿀벌 감정은 아직 한국어·영어만 있다(그림이 뜻을 나른다). */
export function reactionLabel(id: string, viewerLang: string): string {
  const r = BY_ID.get(id);
  if (!r) return "";
  if (r.ko || r.en) return viewerLang === "ko" ? (r.ko ?? r.en ?? "") : (r.en ?? r.ko ?? "");
  return "";   // 옛 5종은 부르는 쪽이 t(r.key) 로 뽑는다
}

/** 실제 Firebase 노드 모양: `rooms/{room}/cards/{card}/likes/{clientId}`. */
export type RawReactions = Record<string, string | boolean>;

export interface ReactionSummary {
  counts: Record<string, number>;
  /** 아직 문자열로 바뀌지 않은 옛 `true` 항목 수. counts.like 에 이미 포함돼 있다. */
  legacy: number;
  mine: ReactionKind | null;
  total: number;
}

/**
 * 기존 좋아요 데이터 호환 어댑터.
 *
 * 옛 스키마는 `likes/{clientId} === true` 였다. 반응 스키마 변경은 별도
 * 작업이므로 노드는 그대로 두고 값만 반응 종류 문자열로 쓴다.
 *
 * **옛 `true` 를 어떻게 셀 것인가 (U06 의 명시 요구).** '좋아요'(like)가 실제
 * 반응 종류로 있으므로 옛 `true` 를 like 로 집계한다. 그래야 예전에 눌린
 * 좋아요가 화면에서 사라지지 않는다.
 *
 * 두 번 세지 않는 근거: 이 노드는 clientId 하나당 값 하나다. 어떤 사용자의 값은
 * `true` 이거나 반응 문자열이지 둘 다일 수 없다. 옛 `true` 를 가진 사용자가 새
 * 반응을 고르면 그 자리의 값이 교체되므로 legacy 가 1 줄고 새 반응이 1 는다 —
 * 합계는 유지된다.
 *
 * 알 수 없는 문자열은 세지 않는다. 옛 데이터에 오타나 다른 스키마가 섞여도
 * 개수가 부풀지 않게 한다.
 */
export function readReactions(
  raw: RawReactions | null | undefined,
  myClientId?: string,
): ReactionSummary {
  const counts: Record<string, number> = {};
  for (const r of ALL_REACTIONS) counts[r.id] = 0;
  let legacy = 0;
  let mine: ReactionKind | null = null;

  for (const [clientId, val] of Object.entries(raw || {})) {
    if (!val) continue;
    const kind: string | null =
      typeof val === "string" && BY_ID.has(val)
        ? val
        : val === true
          ? "like"
          : null;
    if (!kind) continue;
    counts[kind] += 1;
    if (val === true) legacy += 1;
    if (myClientId && clientId === myClientId) mine = kind;
  }

  let total = 0;
  for (const r of ALL_REACTIONS) total += counts[r.id];
  return { counts, legacy, mine, total };
}

/**
 * 한 번 누른 결과. 같은 반응을 다시 고르면 취소, 다른 반응이면 교체.
 * 저장 실패 시 되돌릴 수 있도록 이전 값도 함께 돌려준다.
 */
export function nextReaction(
  current: ReactionKind | null,
  picked: ReactionKind,
): ReactionKind | null {
  return current === picked ? null : picked;
}

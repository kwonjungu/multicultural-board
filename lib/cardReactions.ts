/**
 * 소통창 카드 반응(U06)의 데이터 계약 — 순수 로직.
 *
 * 시각 레이어(PadletCard)와 분리해 둔다. 옛 데이터 호환은 눈으로 보고
 * 판단할 수 없는 종류의 규칙이라, 실제로 실행해 검사할 수 있어야 한다
 * (`scripts/test-card-reactions.mjs`).
 */

/**
 * 반응 5종. **기존 id(thanks·same·nice)는 절대 바꾸지 않는다** — 저장된 값이
 * 그대로 이 문자열이라 이름을 고치면 옛 반응이 사라진다. like·cheer 가 U06 에서
 * 추가된 것이다. 배열 순서가 화면에 나오는 순서다.
 */
export const REACTIONS = [
  { id: "like", key: "reactLike", icon: "💛" },
  { id: "thanks", key: "reactThanks", icon: "🌷" },
  { id: "nice", key: "reactNice", icon: "⭐" },
  { id: "cheer", key: "reactCheer", icon: "🚩" },
  { id: "same", key: "reactSame", icon: "💬" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["id"];

const REACTION_IDS: ReadonlySet<string> = new Set(REACTIONS.map((r) => r.id));

/** 실제 Firebase 노드 모양: `rooms/{room}/cards/{card}/likes/{clientId}`. */
export type RawReactions = Record<string, string | boolean>;

export interface ReactionSummary {
  counts: Record<ReactionKind, number>;
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
 * **옛 `true` 를 어떻게 셀 것인가 (U06 의 명시 요구).** 이제 '좋아요'(like)가
 * 실제 반응 종류로 생겼으므로 옛 `true` 를 like 로 집계한다. 그래야 예전에
 * 눌린 좋아요가 화면에서 사라지지 않는다.
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
  const counts = { like: 0, thanks: 0, nice: 0, cheer: 0, same: 0 } as Record<ReactionKind, number>;
  let legacy = 0;
  let mine: ReactionKind | null = null;

  for (const [clientId, val] of Object.entries(raw || {})) {
    if (!val) continue;
    const kind: ReactionKind | null =
      typeof val === "string" && REACTION_IDS.has(val)
        ? (val as ReactionKind)
        : val === true
          ? "like"
          : null;
    if (!kind) continue;
    counts[kind] += 1;
    if (val === true) legacy += 1;
    if (myClientId && clientId === myClientId) mine = kind;
  }

  const total = REACTIONS.reduce((n, r) => n + counts[r.id], 0);
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

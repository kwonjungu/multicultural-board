/**
 * 소통창 곁가지 데이터(공감·답장)의 **저장 위치** 계약.
 *
 * ── 왜 카드 밑에서 꺼냈는가 ───────────────────────────────────────────
 * 소통창은 `rooms/{room}/cards` 하나를 통째로 구독한다(PadletBoard). 그런데
 * 공감과 답장이 `cards/{cardId}/likes`, `cards/{cardId}/comments` 로 그 **안에**
 * 있었다. RTDB 의 onValue 는 하위 어디가 바뀌어도 부모를 다시 쏘기 때문에,
 * 한 아이가 하트를 한 번 누르면 교실의 모든 기기가 카드 전체를 다시 받아
 * 목록을 통째로 다시 그렸다. 25명이 함께 쓰는 수업에서 가장 느린 길이었다.
 *
 * 그래서 공감·답장을 `cards` 의 **형제**로 옮긴다. 이제 하트를 눌러도 `cards`
 * 는 건드려지지 않으므로 보드의 구독이 깨어나지 않는다.
 *
 * ── 옛 방 데이터는 옮기지 않는다 ──────────────────────────────────────
 * 운영 자격증명이 없어 마이그레이션을 돌릴 수 없다. 그래서 **읽기는 둘 다,
 * 쓰기는 새 곳만** 이다. 옛 카드 밑에 쌓인 몇 달치 공감·답장은 보드가 카드를
 * 받을 때 이미 함께 따라오므로, 그것을 바탕(legacy)으로 두고 새 노드를 위에
 * 덮는다 — `mergeById` 가 그 규칙이다. 옛 데이터를 위해 구독을 하나 더 만들지
 * 않는다(그러면 옮긴 이유가 없어진다).
 */

/** 공감: `rooms/{room}/cardLikes/{cardId}/{clientId}`. 값 모양은 옛것과 같다. */
export function cardLikesPath(roomCode: string, cardId: string): string {
  return `rooms/${roomCode}/cardLikes/${cardId}`;
}

export function cardLikePath(roomCode: string, cardId: string, clientId: string): string {
  return `${cardLikesPath(roomCode, cardId)}/${clientId}`;
}

/** 답장: `rooms/{room}/cardComments/{cardId}/{commentId}`. CommentData 모양 그대로. */
export function cardCommentsPath(roomCode: string, cardId: string): string {
  return `${roomCardCommentsPath(roomCode)}/${cardId}`;
}

export function cardCommentPath(roomCode: string, cardId: string, commentId: string): string {
  return `${cardCommentsPath(roomCode, cardId)}/${commentId}`;
}

/**
 * 방 전체의 답장 나무. **교사만** 구독한다 — 승인 대기 목록을 만들려면 방
 * 전체를 봐야 하기 때문이다. 학생에게까지 이걸 주면 `cards` 에서 겪던 문제를
 * 나무만 바꿔 되풀이하게 된다. 답장은 공감보다 훨씬 드물어 교사 한 명이
 * 통째로 보는 정도는 감당할 수 있다.
 */
export function roomCardCommentsPath(roomCode: string): string {
  return `rooms/${roomCode}/cardComments`;
}

/**
 * 옛 답장 한 건의 자리. **지우는 용도로만** 쓴다 — 읽기는 카드 구독에 실려
 * 오고, 승인은 새 자리에 전문을 써서 가린다. 지우기만은 가림으로 대신할 수
 * 없어(없앴다고 해 놓고 데이터가 남는다) 옛 자리를 직접 건드린다.
 */
export function legacyCardCommentPath(roomCode: string, cardId: string, commentId: string): string {
  return `rooms/${roomCode}/cards/${cardId}/comments/${commentId}`;
}

/**
 * 옛 자리 위에 새 자리를 덮는다 — **같은 열쇠는 새 것이 이긴다.**
 *
 * 공감은 열쇠가 clientId 라, 옛 방에서 하트를 눌렀던 아이가 새로 고르면 그
 * 아이의 칸 하나가 갈아끼워질 뿐 개수가 두 번 세어지지 않는다. 답장은 열쇠가
 * push() 가 만든 commentId 라 애초에 겹치지 않지만, 옛 답장을 승인하면 승인된
 * 전문을 같은 id 로 새 자리에 써서 옛 것을 가리는 방식을 쓰므로 이 규칙이
 * 그대로 필요하다.
 *
 * 취소를 어떻게 덮는가: 옛 자리를 지우려면 `cards` 를 건드려야 하고, 그러면
 * 우리가 고치려던 그 길이 다시 깨어난다. 대신 새 자리에 `false` 를 남긴다 —
 * readReactions 가 거짓값을 세지 않으므로 옛 공감이 정확히 가려진다.
 */
export function mergeById<T>(
  legacy: Record<string, T> | null | undefined,
  fresh: Record<string, T> | null | undefined,
): Record<string, T> {
  if (!legacy) return { ...(fresh || {}) };
  if (!fresh) return { ...legacy };
  return { ...legacy, ...fresh };
}

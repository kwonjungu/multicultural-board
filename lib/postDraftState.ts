/**
 * 글 올리기 초안·전송 상태 — 작업 C-03 (README §6.3).
 *
 * 화면에서 분리한 순수 전이다. React·Firebase·fetch 를 모르며,
 * `scripts/test-post-flow.mjs` 가 이 파일만 transpile 해서 단위 테스트한다.
 * **다른 모듈을 import 하지 말 것** — 테스트가 단일 파일 transpile 로 돈다.
 *
 * 이 파일이 지키는 약속 네 가지:
 *  1. 로컬 에코(`localEcho`)와 서버 확정(`serverConfirmed`)은 서로 다른 값이다.
 *     화면에 카드가 먼저 보이는 것은 저장 성공이 아니다 (POST-02).
 *  2. 실패해도 본문은 남는다. 아이가 다시 쓰게 만들지 않는다 (POST-01).
 *  3. 재시도는 같은 `clientRequestId` 를 다시 보낸다. 중복 저장 방지는
 *     서버/DB 저장 경계가 이 id 로 보장한다 — 클라이언트는 id 를 만들고
 *     같은 요청에 같은 id 를 쓰기만 한다.
 *  4. 늦게 도착한 응답(다른 id)과 성공 후의 재전송은 무시한다.
 */

export type PostDraftKind = "text" | "image" | "youtube" | "drawing";

export type PostPhase =
  /** 아이가 쓰는 중 */
  | "compose"
  /** 올리기 전에 스스로 확인 */
  | "preview"
  /** 보냈고 응답 대기 */
  | "sending"
  /** 보냈지만 서버가 받았는지 아직 모른다 — 성공으로 쓰지 않는다 */
  | "sentUnconfirmed"
  /** 실패. 초안은 그대로 남아 있다 */
  | "failed"
  /** 서버 확정 + 교사 승인 대기. 아직 친구에게 보이지 않는다 (POST-03) */
  | "awaitingReview"
  /** 서버 확정 + 공개 */
  | "published";

export type PostErrorCode = "network" | "server" | "rejected" | "tooLarge";

export interface PostDraftContent {
  kind: PostDraftKind;
  text: string;
  writeLang: string;
  /** 사진·그림·영상의 식별자. 텍스트 카드는 null. */
  mediaRef: string | null;
}

export interface PostDraftState {
  phase: PostPhase;
  draft: PostDraftContent;
  /** 같은 글의 모든 재시도가 공유하는 id. 아직 한 번도 보내지 않았으면 null. */
  clientRequestId: string | null;
  /** 재시도를 포함한 전송 시도 횟수. 줄어들지 않는다. */
  attempts: number;
  /** 화면에 미리 보이는 중인가. 저장 완료와 다른 값이다. */
  localEcho: boolean;
  /** 서버가 받았다고 확인한 경우에만 true. */
  serverConfirmed: boolean;
  /** 교사 승인 대기 중인가. true 면 공개된 것이 아니다. */
  awaitingTeacher: boolean;
  error: PostErrorCode | null;
}

export type PostDraftAction =
  | { type: "edit"; patch: Partial<PostDraftContent> }
  | { type: "preview" }
  | { type: "back" }
  | { type: "submit"; requestId: string; approval?: boolean }
  | { type: "serverAccepted"; requestId: string; approval?: boolean }
  | { type: "serverRejected"; requestId: string; error: PostErrorCode }
  /** 부모가 결과를 알려주지 않는 경로. 성공으로 승격하지 않는다. */
  | { type: "serverUnknown"; requestId: string }
  | { type: "reset"; draft?: Partial<PostDraftContent> };

const EMPTY_CONTENT: PostDraftContent = {
  kind: "text",
  text: "",
  writeLang: "ko",
  mediaRef: null,
};

export function initialPostDraft(draft?: Partial<PostDraftContent>): PostDraftState {
  return {
    phase: "compose",
    draft: { ...EMPTY_CONTENT, ...draft },
    clientRequestId: null,
    attempts: 0,
    localEcho: false,
    serverConfirmed: false,
    awaitingTeacher: false,
    error: null,
  };
}

/** 올릴 내용이 실제로 있는가. 빈 글쓰기는 허용하지만 빈 전송은 막는다. */
export function hasContent(draft: PostDraftContent): boolean {
  if (draft.kind === "text") return draft.text.trim().length > 0;
  return !!draft.mediaRef;
}

/** 전송 버튼을 이미 눌러 되돌릴 수 없는 단계인가. */
export function isInFlight(state: PostDraftState): boolean {
  return state.phase === "sending";
}

/** 서버가 확정한 상태인가. 로컬 에코만으로는 절대 true 가 되지 않는다. */
export function isSettled(state: PostDraftState): boolean {
  return state.phase === "published" || state.phase === "awaitingReview";
}

/**
 * 지금 '올리기'를 누를 수 있는가. 누를 수 없으면 왜인지 코드로 알려준다 —
 * 회색 죽은 버튼 대신 aria-disabled + 이유 안내를 쓰기 위한 값이다.
 */
export type SubmitBlock = "empty" | "inFlight" | "settled" | null;

export function submitBlock(state: PostDraftState): SubmitBlock {
  if (isSettled(state)) return "settled";
  if (state.phase === "sending") return "inFlight";
  if (!hasContent(state.draft)) return "empty";
  return null;
}

const EDITABLE: PostPhase[] = ["compose", "preview", "failed", "sentUnconfirmed"];

export function postDraftReducer(
  state: PostDraftState,
  action: PostDraftAction,
): PostDraftState {
  switch (action.type) {
    case "reset":
      return initialPostDraft(action.draft);

    case "edit": {
      // 보내는 중과 확정 이후에는 내용이 바뀌지 않는다. 바뀌면 서버에 간 것과
      // 화면이 어긋난다.
      if (EDITABLE.indexOf(state.phase) < 0) return state;
      const draft = { ...state.draft, ...action.patch };
      if (sameContent(draft, state.draft)) return state;
      // 내용이 달라졌으면 그건 다른 글이다 — 재시도용 id 를 물려주지 않는다.
      const changedAfterSend = state.clientRequestId !== null;
      return {
        ...state,
        phase: "compose",
        draft,
        clientRequestId: changedAfterSend ? null : state.clientRequestId,
        localEcho: false,
        error: null,
      };
    }

    case "preview":
      if (state.phase !== "compose") return state;
      if (!hasContent(state.draft)) return state;
      return { ...state, phase: "preview", error: null };

    case "back":
      // 보내는 중이거나 이미 확정됐으면 되돌아갈 곳이 없다.
      if (state.phase !== "preview" && state.phase !== "failed") return state;
      return { ...state, phase: "compose", error: null };

    case "submit": {
      if (isSettled(state)) return state;      // 성공 후 중복 전송 무시
      if (state.phase === "sending") return state;
      if (state.phase === "compose") return state; // 미리보기를 건너뛰지 않는다
      if (!hasContent(state.draft)) return state;
      // 재시도는 첫 전송의 id 를 그대로 다시 보낸다.
      const clientRequestId = state.clientRequestId ?? action.requestId;
      return {
        ...state,
        phase: "sending",
        clientRequestId,
        attempts: state.attempts + 1,
        localEcho: true,
        serverConfirmed: false,
        awaitingTeacher: !!action.approval,
        error: null,
      };
    }

    case "serverAccepted": {
      if (!acceptsResponse(state, action.requestId)) return state;
      const approval = !!action.approval;
      return {
        ...state,
        phase: approval ? "awaitingReview" : "published",
        localEcho: true,
        serverConfirmed: true,
        awaitingTeacher: approval,
        error: null,
      };
    }

    case "serverRejected": {
      if (!acceptsResponse(state, action.requestId)) return state;
      return {
        ...state,
        phase: "failed",
        // 저장되지 않았으므로 미리 보이던 카드는 내린다.
        localEcho: false,
        serverConfirmed: false,
        error: action.error,
      };
    }

    case "serverUnknown": {
      if (!acceptsResponse(state, action.requestId)) return state;
      return {
        ...state,
        phase: "sentUnconfirmed",
        localEcho: true,
        serverConfirmed: false,
        error: null,
      };
    }

    default:
      return state;
  }
}

/**
 * 이 응답을 받아들일 것인가.
 * - id 가 다르면 취소·교체된 옛 요청의 늦은 응답이다 → 버린다.
 * - 이미 확정된 뒤 도착한 중복 응답도 버린다.
 */
function acceptsResponse(state: PostDraftState, requestId: string): boolean {
  if (state.clientRequestId === null) return false;
  if (state.clientRequestId !== requestId) return false;
  if (state.phase !== "sending" && state.phase !== "sentUnconfirmed") return false;
  return true;
}

function sameContent(a: PostDraftContent, b: PostDraftContent): boolean {
  return a.kind === b.kind && a.text === b.text && a.writeLang === b.writeLang && a.mediaRef === b.mediaRef;
}

/**
 * 재시도가 공유할 id 한 개. 서버/DB 가 이 값으로 중복 저장을 막는다는 전제이며
 * 클라이언트는 만들고 다시 쓰기만 한다.
 */
export function createClientRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === "function") return `post_${c.randomUUID()}`;
  return `post_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

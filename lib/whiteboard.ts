// [#6] 실시간 화이트보드 (클래스툴형)
//   학생이 그린 그림 스냅샷을 교사가 갤러리로 실시간 모니터링하고,
//   교사가 공통 주제(prompt)를 학생 화면에 내려준다. (라이브 미러링 아님)
//
// Firebase 경로:
//   rooms/{roomCode}/whiteboard/meta            = { prompt, updatedAt }
//   rooms/{roomCode}/whiteboard/boards/{clientId} = { name, dataUrl, updatedAt }

import {
  ref, set, update, onValue, remove,
  onChildAdded, onChildChanged, onChildRemoved,
  type DataSnapshot,
} from "firebase/database";
import { getClientDb } from "./firebase-client";

export interface WhiteboardMeta {
  prompt?: string;
  active?: boolean;   // 교사가 활성화하면 학생 화면이 자동으로 화이트보드로 따라온다
  updatedAt?: number;
}

export interface WhiteboardBoard {
  clientId: string;
  name: string;
  dataUrl: string;
  updatedAt: number;
}

function metaPath(roomCode: string): string {
  return `rooms/${roomCode}/whiteboard/meta`;
}
function boardsPath(roomCode: string): string {
  return `rooms/${roomCode}/whiteboard/boards`;
}

// 교사: 공통 주제/프롬프트 설정
export async function setWhiteboardPrompt(roomCode: string, prompt: string): Promise<void> {
  const db = getClientDb();
  await update(ref(db, metaPath(roomCode)), { prompt, updatedAt: Date.now() });
}

// 교사: 화이트보드 활성화 ON/OFF — ON 이면 학생 화면이 자동으로 따라온다
export async function setWhiteboardActive(roomCode: string, active: boolean): Promise<void> {
  const db = getClientDb();
  await update(ref(db, metaPath(roomCode)), { active, updatedAt: Date.now() });
}

export function subscribeWhiteboardMeta(
  roomCode: string,
  cb: (meta: WhiteboardMeta) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, metaPath(roomCode));
  const unsub = onValue(r, (snap) => cb((snap.val() as WhiteboardMeta | null) ?? {}));
  return () => unsub();
}

// 학생: 캔버스 스냅샷 업로드 (호출 측에서 스로틀/디바운스)
export async function pushWhiteboardSnapshot(
  roomCode: string,
  clientId: string,
  name: string,
  dataUrl: string,
): Promise<void> {
  const db = getClientDb();
  await set(ref(db, `${boardsPath(roomCode)}/${clientId}`), {
    name,
    dataUrl,
    updatedAt: Date.now(),
  });
}

// 교사: 전 학생 보드 실시간 구독 (이름순 정렬)
//
// 학생 수가 늘어날수록 부모 경로(boards/) 전체를 onValue 로 구독하면 학생 한
// 명이 스냅샷(20~40KB base64) 하나를 올릴 때마다 "전체" 학생 목록을 다시
// 만들어 매번 새 배열/객체로 콜백에 넘기게 된다 — 결국 25칸 갤러리 전체가
// 리렌더된다. 자식 단위(onChildAdded/Changed/Removed)로 구독을 쪼개고 내부
// Map 에 보드를 들고 있으면, 변경되지 않은 학생의 보드 객체는 Map 안의
// 참조를 그대로 재사용할 수 있다 — 아래에서 실제로 변한 clientId 의 항목만
// 새 객체로 교체하므로, 호출부에서 React.memo 로 감싼 카드가 참조 동일성으로
// 리렌더를 걸러낼 수 있다.
export function subscribeWhiteboardBoards(
  roomCode: string,
  cb: (boards: WhiteboardBoard[]) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, boardsPath(roomCode));
  const boardsById = new Map<string, WhiteboardBoard>();

  function emit(): void {
    const list = Array.from(boardsById.values())
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    cb(list);
  }

  // 추가/변경 모두 같은 처리: dataUrl 이 없는(그리기 전) 스냅샷은 갤러리에서
  // 제외하고, 있으면 해당 clientId 항목만 새 객체로 만들어 Map 에 채워 넣는다
  // — 다른 학생의 기존 객체 참조는 건드리지 않는다.
  function upsert(snap: DataSnapshot): void {
    const clientId = snap.key;
    if (!clientId) return;
    const b = snap.val() as Omit<WhiteboardBoard, "clientId"> | null;
    if (b && b.dataUrl) {
      boardsById.set(clientId, { clientId, ...b });
    } else {
      boardsById.delete(clientId);
    }
    emit();
  }

  const unsubAdded = onChildAdded(r, upsert);
  const unsubChanged = onChildChanged(r, upsert);
  const unsubRemoved = onChildRemoved(r, (snap) => {
    const clientId = snap.key;
    if (!clientId) return;
    if (boardsById.delete(clientId)) emit();
  });

  return () => {
    unsubAdded();
    unsubChanged();
    unsubRemoved();
  };
}

// 교사: 전체 보드 비우기 (새 활동 시작)
export async function clearWhiteboardBoards(roomCode: string): Promise<void> {
  const db = getClientDb();
  await remove(ref(db, boardsPath(roomCode)));
}

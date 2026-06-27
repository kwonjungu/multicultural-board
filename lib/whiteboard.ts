// [#6] 실시간 화이트보드 (클래스툴형)
//   학생이 그린 그림 스냅샷을 교사가 갤러리로 실시간 모니터링하고,
//   교사가 공통 주제(prompt)를 학생 화면에 내려준다. (라이브 미러링 아님)
//
// Firebase 경로:
//   rooms/{roomCode}/whiteboard/meta            = { prompt, updatedAt }
//   rooms/{roomCode}/whiteboard/boards/{clientId} = { name, dataUrl, updatedAt }

import { ref, set, update, onValue, remove } from "firebase/database";
import { getClientDb } from "./firebase-client";

export interface WhiteboardMeta {
  prompt?: string;
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
export function subscribeWhiteboardBoards(
  roomCode: string,
  cb: (boards: WhiteboardBoard[]) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, boardsPath(roomCode));
  const unsub = onValue(r, (snap) => {
    const val = snap.val() as Record<string, Omit<WhiteboardBoard, "clientId">> | null;
    const list: WhiteboardBoard[] = val
      ? Object.entries(val)
          .filter(([, b]) => b && b.dataUrl)
          .map(([clientId, b]) => ({ clientId, ...b }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      : [];
    cb(list);
  });
  return () => unsub();
}

// 교사: 전체 보드 비우기 (새 활동 시작)
export async function clearWhiteboardBoards(roomCode: string): Promise<void> {
  const db = getClientDb();
  await remove(ref(db, boardsPath(roomCode)));
}

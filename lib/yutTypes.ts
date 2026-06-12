// HoneyYut v2 — 전통 룰 기반 전면 재작성.
//
// v1 의 "분기 선택(chooseBranch)" UI 는 중간 분기 복원 버그·더블탭 레이스의
// 온상이었다. v2 는 전통 윷놀이 룰을 그대로 따른다:
//   "모서리(5·10)나 중앙(22)에 *정확히 멈추면* 다음 이동은 지름길로 간다."
// 멈춘 칸이 경로를 결정하므로 플레이어 선택지가 없고 상태도 단순하다.

// 윷가락 결과. 양수 = 전진 칸 수, -1 = 백도.
// 윷(4)·모(5)는 한 번 더 던진다 (리듀서가 처리).
export type Throw = -1 | 1 | 2 | 3 | 4 | 5;

export type TeamId = "A" | "B";

// 말이 갈 수 있는 경로. 멈춘 칸에서 정규화로 결정된다.
//   outer — 바깥 둘레 (0..19 → 골)
//   diagA — 5(첫 모서리)에 멈춰 탄 대각선: 5→20→21→22→23→24→15→…→19→골
//   diagB — 10(둘째 모서리)에 멈춰 탄 대각선: 10→25→26→22→27→28→골
//   cut   — 중앙(22)에 멈춰 탄 최단 출구: 22→27→28→골
export type Route = "outer" | "diagA" | "diagB" | "cut";

export type PieceId = string; // `${team}-${idx}` e.g. "A-0"

export type PiecePos =
  | { kind: "home" }
  | { kind: "board"; node: number; route: Route }
  | { kind: "goal" };

export interface Piece {
  id: PieceId;
  team: TeamId;
  pos: PiecePos;
}

// 같은 팀 말이 같은 칸에 멈추면 자동 업기: pos 가 동일한 말들은 한 묶음으로
// 함께 움직이고 함께 잡힌다. (정규화 덕에 "같은 노드에 멈춤" ⇒ "pos 동일")

export type PhaseKind =
  | "needThrow" // 현재 팀이 윷을 던져야 함 (윷/모/잡기 보너스 포함)
  | "move"      // 큐에 쌓인 던지기 결과를 말에 배정하는 중
  | "win";      // 종료

export interface GameState {
  turn: TeamId;
  pieces: Record<PieceId, Piece>;
  queue: Throw[];        // 아직 사용하지 않은 던지기 결과들
  phase: PhaseKind;
  winner: TeamId | null;
  // 모서리/중앙에 멈춰 발동한 문화카드 (오버레이 전용 — 턴 흐름과 무관)
  cultureNode: number | null;
  log: string[];
}

export type Action =
  | { type: "throwResult"; value: Throw }
  | { type: "move"; pieceId: PieceId; queueIndex: number }
  | { type: "closeCulture" }
  | { type: "restart" };

export const PIECES_PER_TEAM = 4;

// 문화카드가 뜨는 칸: 모서리 3곳 + 중앙 (출발칸 0 제외 — 머무를 수 없음)
export const CULTURE_NODES = [5, 10, 15, 22] as const;

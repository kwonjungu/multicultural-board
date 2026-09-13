"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useOpenLayerCount } from "@/lib/backStack";

/**
 * 게임 플레이 화면이 "게임 목록으로 나가기"를 부를 수 있게 하는 통로 (U01).
 *
 * 배경: 게임 컴포넌트는 `{ langA, langB }` 만 받는다 — 셸(`components/GameRoom.tsx`)
 * 이 onExit 을 내려주지 않고, 그 파일은 지금 다른 작업자 영역이라 손대지 않는다.
 * 그래서 공용 헤더의 '뒤로'는 아래 순서로 동작을 정한다.
 *
 *   1) 게임이 직접 넘긴 onBack (예: 플레이 → 그 게임의 준비 화면)
 *   2) 이 컨텍스트의 onExit (fixture 처럼 명시적으로 제공한 경우)
 *   3) 뒤로 닫기 레이어가 열려 있으면 history.back()
 *      — GameRoom 이 `useBackLayer(gameId !== null, …)` 로 이미 레이어를 쌓아
 *        두므로, history.back() 은 정확히 그 레이어 하나만 닫아 게임 목록으로
 *        돌아간다. lib/backStack 이 인앱 닫기의 이중 back 을 막아 준다.
 *   4) 셋 다 없으면 동작 없음 — 버튼은 aria-disabled 로 표시한다. 없는 기능을
 *      있는 척하지 않는다.
 */
const GameShellContext = createContext<{ onExit?: () => void }>({});

export function GameShellProvider({ onExit, children }: { onExit?: () => void; children: ReactNode }) {
  return <GameShellContext.Provider value={{ onExit }}>{children}</GameShellContext.Provider>;
}

/** 셸 밖으로 나가는 동작. 쓸 수 없으면 null 을 돌려준다(버튼을 비활성으로). */
export function useGameExit(): (() => void) | null {
  const { onExit } = useContext(GameShellContext);
  const layers = useOpenLayerCount();
  const byHistory = useCallback(() => {
    if (typeof window !== "undefined") window.history.back();
  }, []);
  if (onExit) return onExit;
  if (layers > 0) return byHistory;
  return null;
}

"use client";

/**
 * 설정을 읽고 바꾸는 공용 훅 — 작업 A.
 *
 * Provider 로 감싸지 않는다. app/layout.tsx 는 서버 컴포넌트이고 화면 진입점이
 * 여럿이라, 트리마다 Provider 를 다는 방식은 누락된 화면에서 조용히 기본값으로
 * 갈라진다. 모듈 수준 스토어 + useSyncExternalStore 로 어디서 읽어도 같은 값을
 * 보게 한다.
 */
import { useSyncExternalStore } from "react";
import { applyChildUx, readChildUx, writeChildUx, DEFAULT_CHILD_UX, type ChildUxSettings } from "./settings";

let current: ChildUxSettings = DEFAULT_CHILD_UX;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  if (!hydrated) {
    hydrated = true;
    current = readChildUx();
    applyChildUx(current);
  }
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getSnapshot = () => current;
/** SSR 스냅샷은 참조가 고정돼야 한다 — 매번 새 객체를 만들면 무한 렌더가 된다. */
const getServerSnapshot = () => DEFAULT_CHILD_UX;

/** 설정을 바꾼다. 저장·문서 반영·구독자 통지를 한 번에 처리한다. */
export function setChildUx(patch: Partial<ChildUxSettings>): void {
  const next = { ...current, ...patch };
  // 필드를 나열해 비교하면 새 설정(소리·집중)을 추가할 때 조용히 빠져
  // "아무 일도 하지 않는 토글" 이 된다. 키 전체를 돈다.
  const keys = Object.keys(next) as (keyof ChildUxSettings)[];
  if (keys.every((k) => next[k] === current[k])) return;
  current = next;
  applyChildUx(next);
  writeChildUx(next);
  emit();
}

export function useChildUx(): ChildUxSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type { ChildUxSettings };

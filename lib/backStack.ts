"use client";

// 중첩된 "뒤로 닫기" 레이어를 브라우저/기기 히스토리와 동기화한다.
//
// 문제: 화면마다 독립적으로 popstate 를 처리하면 한 번의 뒤로가기에 여러 화면이
// 동시에 닫혀버린다. 이 모듈은 단일 popstate 핸들러 + 레이어 스택으로
// "뒤로가기는 가장 안쪽(top) 레이어 하나만 닫는다"를 보장한다.
//
// 동작:
//  - 레이어가 열리면 history 항목 1개를 쌓는다(pushState).
//  - 기기 뒤로가기(popstate) → top 레이어의 close() 호출 후 스택에서 제거.
//    close() 가 false 를 반환하면 닫지 않고 가드를 다시 쌓는다(머무르기 — 예:
//    학생이 수업에 강제 동기화된 동안).
//  - 인앱 버튼으로 닫히면(레이어 active=false) 쌓아둔 history 항목 1개를 소비
//    (history.back), 그때 발생하는 popstate 는 무시한다.

import { useEffect, useRef } from "react";

type CloseFn = () => boolean | void;
interface Layer { id: number; close: CloseFn }

let counter = 0;
const stack: Layer[] = [];
let bound = false;
let ignorePops = 0; // 인앱 닫기로 유발된 popstate 무시 카운트

function handlePop() {
  if (ignorePops > 0) { ignorePops--; return; }
  const top = stack[stack.length - 1];
  if (!top) return;
  const result = top.close();
  if (result === false) {
    // 닫지 않음 → 가드를 다시 쌓아 그 자리에 머무른다.
    window.history.pushState({ backLayer: top.id }, "");
  } else {
    stack.pop();
  }
}

function ensureBound() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener("popstate", handlePop);
}

function pushLayer(close: CloseFn): number {
  ensureBound();
  const id = ++counter;
  if (typeof window !== "undefined") {
    window.history.pushState({ backLayer: id }, "");
  }
  stack.push({ id, close });
  return id;
}

function removeLayer(id: number) {
  const idx = stack.findIndex((l) => l.id === id);
  if (idx === -1) return; // 이미 popstate 로 제거됨
  stack.splice(idx, 1);
  // 인앱으로 닫힘 → 쌓아둔 history 항목 1개 소비(그 popstate 는 무시).
  if (typeof window !== "undefined") {
    ignorePops++;
    window.history.back();
  }
}

/**
 * active 동안 "뒤로 닫기" 레이어를 등록한다.
 * 기기/브라우저 뒤로가기를 누르면 onClose() 가 호출돼 이 레이어만 닫힌다.
 * onClose 가 false 를 반환하면 닫지 않고 머무른다.
 *
 * 인앱 버튼으로 화면을 닫아 active 가 false 가 되면 자동으로 히스토리 항목을
 * 정리하므로, 그 뒤의 뒤로가기는 한 단계 위 레이어로 이어진다.
 */
export function useBackLayer(active: boolean, onClose: CloseFn): void {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const id = pushLayer(() => ref.current());
    return () => removeLayer(id);
  }, [active]);
}

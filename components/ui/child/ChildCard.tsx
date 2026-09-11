"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * 표면 한 겹. 색 포인트 1개, 그림자 1개가 기본이다(README §4.2) — 카드 안에서
 * 또 다른 그림자를 겹치지 말 것.
 */
export default function ChildCard({
  panel = false,
  children,
  style,
  ...rest
}: {
  /** 큰 패널이면 true — 모서리 28px. */
  panel?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  [key: string]: unknown;
}) {
  return (
    <div
      data-ux-surface={panel ? "panel" : ""}
      style={{
        padding: "var(--ux-space-4)",
        boxShadow: "0 4px 14px rgba(137,83,0,.10)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

"use client";

import type { CSSProperties, ElementType, ReactNode } from "react";

export type TextRole = "title" | "body-emphasis" | "body" | "label" | "secondary";

const DEFAULT_TAG: Record<TextRole, ElementType> = {
  title: "h1",
  "body-emphasis": "p",
  body: "p",
  label: "span",
  secondary: "span",
};

/**
 * 역할이 붙은 글자. 크기는 언제나 토큰이 정하고, 호출부가 px 을 직접 쓰지 않는다.
 * `data-ux-role` 은 접근성 검사기가 본문/라벨/보조를 구분하는 근거이기도 하다.
 * 필수 지시문을 `secondary` 로 쓰지 말 것(README §4.1).
 */
export default function ChildText({
  role = "body",
  as,
  reading = false,
  children,
  style,
  ...rest
}: {
  role?: TextRole;
  as?: ElementType;
  /** 읽기 지문이면 true — 42ch 로 줄 길이를 제한한다. */
  reading?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  [key: string]: unknown;
}) {
  const Tag = (as ?? DEFAULT_TAG[role]) as ElementType;
  return (
    <Tag data-ux-role={role} data-ux-reading={reading ? "" : undefined} style={{ margin: 0, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

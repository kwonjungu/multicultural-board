"use client";

import type { CSSProperties, ReactNode } from "react";

export type ChildButtonVariant = "primary" | "secondary" | "quiet" | "choice";

/**
 * 아이가 누르는 버튼의 유일한 구현.
 *
 * - primary 는 화면당 하나. 노랑 채움만으로는 크림 배경과 1.36:1 밖에 안 나와서
 *   테두리(`--ux-primary-border`)가 형태를 만든다. 테두리를 지우면 비텍스트
 *   대비 3:1 을 잃는다 (tokens.json 의 primary-border-on-bg 참조).
 * - choice 는 선택 상태를 색이 아니라 aria-pressed + 체크 + 테두리로 알린다.
 * - 라벨 없는 아이콘 버튼을 만들지 않는다. icon 은 글자 라벨의 보조다.
 */
export default function ChildButton({
  variant = "secondary",
  selected,
  icon,
  children,
  style,
  type = "button",
  ...rest
}: {
  variant?: ChildButtonVariant;
  /** choice 전용. 지정하면 aria-pressed 가 함께 나간다. */
  selected?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  type?: "button" | "submit";
  [key: string]: unknown;
}) {
  const isAction = variant === "primary";
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--ux-space-2)",
    width: variant === "choice" ? "100%" : undefined,
    fontFamily: "inherit",
    fontWeight: 700,
    textAlign: "center",
    /* 긴 번역문은 가로로 밀지 말고 세로로 늘린다. */
    whiteSpace: "normal",
    wordBreak: "keep-all",
    transition: "background var(--ux-motion-state) var(--ux-motion-ease), border-color var(--ux-motion-state) var(--ux-motion-ease)",
  };

  const skin: Record<ChildButtonVariant, CSSProperties> = {
    primary: {
      background: "var(--ux-primary-fill)",
      color: "var(--ux-primary-ink)",
      border: "2px solid var(--ux-primary-border)",
    },
    secondary: {
      background: "var(--ux-surface)",
      color: "var(--ux-ink)",
      border: "2px solid var(--ux-primary-border)",
    },
    quiet: {
      background: "transparent",
      color: "var(--ux-ink-soft)",
      border: "2px solid transparent",
    },
    choice: {
      background: selected ? "var(--ux-surface)" : "var(--ux-surface)",
      color: "var(--ux-ink)",
      border: selected ? "3px solid var(--ux-selected-border)" : "2px solid var(--ux-ink-soft)",
      justifyContent: "space-between",
      textAlign: "left",
    },
  };

  return (
    <button
      type={type}
      data-ux-role={isAction ? "action" : "control"}
      data-ux-variant={variant}
      aria-pressed={variant === "choice" && selected !== undefined ? selected : undefined}
      style={{ ...base, ...skin[variant], ...style }}
      {...rest}
    >
      {icon != null && <span aria-hidden>{icon}</span>}
      <span>{children}</span>
      {variant === "choice" && selected && <span aria-hidden style={{ fontWeight: 900 }}>✓</span>}
    </button>
  );
}

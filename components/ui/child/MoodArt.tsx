"use client";

import { useState } from "react";
import { LADDERS, optimizedSrc, pickWidth } from "@/lib/imageOpt";
import { beeMoodAssetPath, beeMoodEmoji, isBeeMoodId } from "@/lib/beeMoods";

/**
 * 꿀벌 감정 그림 (공감 20종). AnimalArt·AppIcon 과 같은 패턴이다.
 *
 * - 파일이 못 올라오면 깨진 이미지를 두지 않고 뜻이 맞는 이모지로 내려온다.
 * - 모르는 id 여도 렌더를 멈추지 않는다. beeMoodAssetPath 는 모르는 id 에서
 *   던지므로 여기서 받아 폴백으로 바꾼다.
 * - `decorative` 기본 true: 이 그림은 옆에 글자 라벨과 함께 쓴다. 그림만으로
 *   뜻이 남아야 하는 자리에서만 false 로 두고 대체 텍스트를 준다.
 *
 * 크기는 인라인 style 로 직접 박는다 — 로딩 중 칸이 밀리지 않게 하기 위해서다
 * (그래서 CSS 클래스로는 크기를 못 바꾼다는 점에 주의).
 */
export default function MoodArt({
  id,
  size = 32,
  decorative = true,
  label,
  className,
}: {
  id: string;
  size?: number;
  decorative?: boolean;
  /** decorative=false 일 때 읽어 줄 이름. */
  label?: string;
  className?: string;
}) {
  // 파생본(WebP) -> 원본 PNG -> 이모지. 파일명이 이미 크기를 담고 있어서
  // (예: happy-64.png) 폭은 그 파일 기준으로 고른다.
  const [stage, setStage] = useState<"opt" | "original" | "emoji">("opt");
  const failed = stage === "emoji";
  const valid = isBeeMoodId(id);

  if (failed || !valid) {
    return (
      <span
        className={className}
        style={{ fontSize: Math.round(size * 0.82), lineHeight: 1, display: "inline-block" }}
        {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label ?? "" })}
      >
        {beeMoodEmoji(id)}
      </span>
    );
  }

  return (
    <img
      key={stage}
      src={stage === "opt"
        ? optimizedSrc(beeMoodAssetPath(id, size > 64 ? 128 : 64), pickWidth(size, [...LADDERS.uiIcons]))
        : beeMoodAssetPath(id, size > 64 ? 128 : 64)}
      alt={decorative ? "" : (label ?? "")}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      className={className}
      decoding="async"
      onError={() => setStage((v) => (v === "opt" ? "original" : "emoji"))}
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block" }}
    />
  );
}

"use client";

import { useState } from "react";
import { ANIMALS, animalAssetPath, animalLabel, type AnimalId } from "@/lib/animals";
import { LADDERS, optimizedSrc, pickWidth } from "@/lib/imageOpt";

/**
 * 내 동물 그림 (U05). 화면마다 다시 만들지 않도록 공통 컴포넌트로 둔다.
 *
 * **에셋이 아직 없다.** 03 에셋가이드의 동물 8종 PNG 는 이번 세션에서 생성할
 * 수 없어(이미지 도구 없음) `public/ui-icons/v1/animals/*.png` 가 비어 있다.
 * 그래서 그림 로드에 실패하면 조용히 깨진 이미지를 두지 않고 이모지로 내려온다.
 * PNG 가 들어오면 코드 변경 없이 그림이 뜬다 — 지금 이모지로 보인다고 완료가
 * 아니라는 뜻이다.
 *
 * `decorative` 가 기본인 이유: 대부분의 자리에서 동물 옆에 이름이 함께 나온다.
 * 이름 없이 동물만 두는 자리에서는 `decorative={false}` 로 대체 텍스트를 준다.
 */
export default function AnimalArt({
  id,
  size = 40,
  decorative = true,
  className,
}: {
  id: AnimalId;
  size?: number;
  decorative?: boolean;
  className?: string;
}) {
  // 파생본(WebP) -> 원본 PNG -> 이모지 순으로 내려온다. 파생본이 없는 그림도
  // 있어서(줄일 수 없어 건너뛴 경우) 원본 단계를 반드시 거친다.
  const [stage, setStage] = useState<"opt" | "original" | "emoji">("opt");
  const failed = stage === "emoji";
  const emoji = ANIMALS.find((a) => a.id === id)?.emoji ?? "🐾";
  const label = animalLabel(id);

  if (failed) {
    return (
      <span
        className={className}
        style={{ fontSize: Math.round(size * 0.82), lineHeight: 1, display: "inline-block" }}
        {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
      >
        {emoji}
      </span>
    );
  }

  const original = animalAssetPath(id);
  const src = stage === "opt"
    ? optimizedSrc(original, pickWidth(size, [...LADDERS.animals]))
    : original;

  return (
    <img
      key={src}
      src={src}
      alt={decorative ? "" : label}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      className={className}
      // 배포본이 지워졌거나 파생본이 없으면 원본으로, 원본도 없으면 이모지로.
      onError={() => setStage((v) => (v === "opt" ? "original" : "emoji"))}
      decoding="async"
      // 그림마다 여백이 달라도 찌그러지지 않게 한다 (03 에셋가이드).
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block" }}
    />
  );
}

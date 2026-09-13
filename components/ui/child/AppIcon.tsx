"use client";

import { useState } from "react";
import { isUiIconId, uiIconAssetPath, uiIconEmoji, uiIconLabel, type UiIconId } from "@/lib/uiIcons";

/**
 * 공용 아이콘 (U03). 03 에셋가이드로 생성된 6개 그림 아이콘을 화면 어디서든
 * 같은 방식으로 붙인다 — AnimalArt.tsx 와 정확히 같은 패턴이다.
 *
 * - 파일 로드에 실패하면(404·네트워크 오류) 조용히 깨진 이미지를 두지 않고
 *   의미에 맞는 이모지로 내려온다. 이 폴백은 "아직 파일이 없어서"가 아니라
 *   "런타임에 무슨 일이 있어도 안전하게" 를 위한 것 — 파일은 이미 있다.
 * - `name` 이 allowlist 밖이면(오타·잘못된 문자열) 렌더를 멈추지 않고 같은
 *   폴백으로 내려온다. lib/uiIcons.ts 의 uiIconAssetPath 는 모르는 id 에서
 *   던지므로, 여기서 받아 폴백으로 바꾼다 — 개발 중에는 콘솔에 원인이
 *   남고, 화면은 깨지지 않는다.
 * - `decorative` 가 기본으로 true 인 이유는 AnimalArt 와 같다: 이 아이콘은
 *   대부분 옆에 글자 라벨과 함께 쓰인다(04 문서 — 아이콘만으로 뜻이 모호하면
 *   라벨을 유지한다). 아이콘 하나가 의미의 유일한 전달자인 자리에서만
 *   `decorative={false}` 로 대체 텍스트를 준다.
 */
export default function AppIcon({
  name,
  size = 40,
  decorative = true,
  className,
}: {
  name: UiIconId;
  size?: number;
  decorative?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const valid = isUiIconId(name);
  const label = valid ? uiIconLabel(name) : "";
  const emoji = uiIconEmoji(name);

  if (failed || !valid) {
    if (!valid) {
      // 개발 중 잘못된 id 를 바로 알아채도록 남긴다 — 화면은 폴백으로 계속 동작한다.
      console.error(`AppIcon: unknown icon name "${String(name)}", falling back to emoji`);
    }
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

  return (
    <img
      src={uiIconAssetPath(name, size)}
      alt={decorative ? "" : label}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      // 6개 원본의 여백/시각 질량이 서로 달라도 찌그러지지 않게 한다 (03 에셋가이드).
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block" }}
    />
  );
}

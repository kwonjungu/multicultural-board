"use client";

// 메뉴 일러스트 — /cafe/{menuId}.png. 없으면 기존 이모지로 폴백.

import React, { useState } from "react";

export default function MenuImg({
  menuId, emoji, size,
}: {
  menuId: string;
  emoji: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div style={{ fontSize: size * 0.8, lineHeight: 1 }}>{emoji}</div>;
  }
  return (
    <img
      src={`/cafe/${menuId}.png`}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      style={{
        width: size, height: size, objectFit: "contain",
        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.15))",
      }}
    />
  );
}

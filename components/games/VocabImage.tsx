"use client";

import { useState } from "react";

// PNG 우선 + 이모지 폴백 단어 그림.
// /game-assets/draw/{vocabKey}.png 를 시도하고, 404 등 로드 실패 시
// 이모지로 자연스럽게 폴백한다 (게임이 깨지지 않게).
// 라운드가 바뀌며 다른 단어를 보여줄 때는 key={vocabKey} 로 리마운트해
// failed 상태가 다음 단어로 새어가지 않게 할 것 (HalliGalli FruitGlyph 패턴).
export default function VocabImage({
  vocabKey,
  emoji,
  size,
}: {
  vocabKey: string;
  emoji: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span style={{ fontSize: Math.round(size * 0.72), lineHeight: 1 }} aria-hidden="true">
        {emoji}
      </span>
    );
  }
  return (
    <img
      src={`/game-assets/draw/${vocabKey}.png`}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.10))",
      }}
    />
  );
}

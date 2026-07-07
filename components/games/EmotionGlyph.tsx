"use client";

import { useState } from "react";

// 감정 이모지 → 생성 PNG 매핑 (scripts/gen-batch-assets.mjs 로 생성,
// public/game-assets/emotions/). EmotionQuiz 선택지 + 마블 감정 퀴즈 공용.
export const EMOTION_IMAGES: Record<string, string> = {
  "😊": "/game-assets/emotions/happy.png",
  "😢": "/game-assets/emotions/sad.png",
  "😠": "/game-assets/emotions/angry.png",
  "😨": "/game-assets/emotions/scared.png",
  "😳": "/game-assets/emotions/embarrassed.png",
  "🤗": "/game-assets/emotions/hug.png",
  "😴": "/game-assets/emotions/sleepy.png",
  "😮": "/game-assets/emotions/surprised.png",
  "🤔": "/game-assets/emotions/thinking.png",
  "🥳": "/game-assets/emotions/party.png",
  "🥰": "/game-assets/emotions/love.png",
  "😭": "/game-assets/emotions/crying.png",
  "🏆": "/game-assets/emotions/trophy.png",
  "🤝": "/game-assets/emotions/handshake.png",
  "😟": "/game-assets/emotions/worried.png",
  "💔": "/game-assets/emotions/heartbroken.png",
};

/** PNG 우선 + 이모지 폴백 감정 그림. 404 시 게임이 깨지지 않는다.
 *  호출부에서 key={emoji} 로 리마운트해 onError 상태 누수를 막을 것. */
export default function EmotionGlyph({ emoji, size = 56 }: { emoji: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = EMOTION_IMAGES[emoji];
  if (!src || failed) {
    return <span style={{ fontSize: Math.round(size * 0.78), lineHeight: 1 }} aria-hidden="true">{emoji}</span>;
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: "contain", display: "block", margin: "0 auto" }}
    />
  );
}

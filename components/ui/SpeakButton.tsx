"use client";

import { speak, cancelSpeak } from "@/lib/ttsMulti";

interface Props {
  text: string;
  lang: string;        // AppLang short code, 예: "ko","vi"
  size?: number;       // 기본 56(친화 터치 하한). 밀집 영역은 48까지 허용
  label?: string;      // aria-label override
}

/**
 * 1~2학년 친화: 텍스트 옆 상시 "소리로 듣기" 버튼.
 * 자동 재생하지 않고 탭 시에만 재생한다(서버 TTS 비용·지연 회피).
 * 엔진은 lib/ttsMulti.speak (Web Speech → 실패 시 /api/tts 서버 폴백).
 */
export default function SpeakButton({ text, lang, size = 56, label }: Props) {
  if (!text?.trim()) return null;
  return (
    <button
      type="button"
      aria-label={label ?? "소리로 듣기"}
      onClick={(e) => { e.stopPropagation(); cancelSpeak(); void speak(text, lang); }}
      style={{
        width: size, height: size, minWidth: size, minHeight: size,
        borderRadius: "var(--radius-pill)",
        border: "2px solid var(--honey-fill)",
        background: "var(--surface)",
        color: "var(--honey-text)",
        cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(size * 0.42),
        transition: "transform var(--dur) var(--ease)",
        flexShrink: 0,
      }}
      onMouseDown={(ev) => (ev.currentTarget.style.transform = "scale(0.92)")}
      onMouseUp={(ev) => (ev.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(ev) => (ev.currentTarget.style.transform = "scale(1)")}
    >🔊</button>
  );
}

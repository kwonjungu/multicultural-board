"use client";

import { useEffect, useRef } from "react";
import { tr } from "@/lib/gameData";
import { MENU_BY_ID } from "./cafeData";
import type { MenuId, Role } from "./types";

interface Props {
  langA: string;
  langB: string;
  roleA: Role;
  menuId: MenuId;
  onReady: () => void;
}

// The customer speaks the menu name in the *chef's* language (the planner's
// "상대 언어로 주문"). We auto-play TTS, and offer a replay button + a
// "Chef ready" button to advance.
export default function OrderScene({
  langA,
  langB,
  roleA,
  menuId,
  onReady,
}: Props) {
  const chefLang = roleA === "chef" ? langA : langB;
  const custLang = roleA === "customer" ? langA : langB;
  const menu = MENU_BY_ID[menuId];
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const phrase =
    (chefLang === "ko"
      ? `${tr(menu.name, chefLang)} 하나 주세요`
      : chefLang === "ja"
        ? `${tr(menu.name, chefLang)} を一つお願いします`
        : chefLang === "zh"
          ? `请给我一份 ${tr(menu.name, chefLang)}`
          : chefLang === "vi"
            ? `Cho tôi một ${tr(menu.name, chefLang)}`
            : `One ${tr(menu.name, chefLang)}, please`);

  const speak = () => {
    try {
      audioRef.current?.pause();
    } catch {
      /* swallow */
    }
    const a = new Audio(
      `/api/tts?text=${encodeURIComponent(phrase)}&lang=${chefLang}`,
    );
    audioRef.current = a;
    a.play().catch(() => {
      /* autoplay blocked — user can click replay */
    });
  };

  useEffect(() => {
    speak();
    return () => {
      try {
        audioRef.current?.pause();
      } catch {
        /* swallow */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId]);

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: "28px 18px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 800 }}>
        🎧 Customer ({custLang.toUpperCase()}) → Chef ({chefLang.toUpperCase()})
      </div>

      <div
        style={{
          marginTop: 16,
          padding: "26px 18px",
          borderRadius: 20,
          background: "linear-gradient(180deg,#FEF3C7,#fff)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: 64 }}>{menu.emoji}</div>
        <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>
          "{phrase}"
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
          {tr(menu.name, custLang)} ({custLang.toUpperCase()})
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          marginTop: 18,
        }}
      >
        <button
          onClick={speak}
          aria-label="Replay order audio"
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          🔁 다시 듣기
        </button>
        <button
          onClick={onReady}
          aria-label="Chef ready to cook"
          style={{
            padding: "10px 20px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(180deg,#FBBF24,#F59E0B)",
            color: "#111",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          👨‍🍳 준비 완료
        </button>
      </div>
    </div>
  );
}

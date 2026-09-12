"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import ScopedStyle from "../../ui/child/ScopedStyle";
import { gp } from "../plainText";
import { gt, UI } from "../uiText";
import { MENU_BY_ID } from "./cafeData";
import { CAFE, roleEmoji, roleName } from "./cafeText";
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
  const aliveRef = useRef(true);
  const [audioFailed, setAudioFailed] = useState(false);

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

  /** 이전 음성을 확실히 멈춘다. 새 재생 직전과 unmount 에서 모두 부른다. */
  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      /* 이미 정리된 엘리먼트 */
    }
    audioRef.current = null;
  }, []);

  const speak = useCallback(() => {
    stopAudio(); // 새 음성 전에 이전 음성을 반드시 멈춘다
    setAudioFailed(false);
    const a = new Audio(
      `/api/tts?text=${encodeURIComponent(phrase)}&lang=${chefLang}`,
    );
    audioRef.current = a;
    a.onerror = () => {
      if (aliveRef.current) setAudioFailed(true);
    };
    a.play().catch(() => {
      // 자동재생이 막혔을 수 있다 — 아이 탓이 아니라 지금 할 일만 알린다.
      if (aliveRef.current) setAudioFailed(true);
    });
  }, [chefLang, phrase, stopAudio]);

  useEffect(() => {
    aliveRef.current = true;
    speak();
    return () => {
      aliveRef.current = false;
      stopAudio();
    };
  }, [speak, stopAudio]);

  return (
    <div className="os-wrap">
      <ScopedStyle css={OS_CSS} />

      <section className="os-card" data-ux-surface="panel">
        <p data-ux-role="secondary" className="os-flow">
          🎧 {roleEmoji("customer")} {tr(roleName("customer"), custLang)} ({custLang.toUpperCase()})
          {" → "}
          {roleEmoji("chef")} {tr(roleName("chef"), chefLang)} ({chefLang.toUpperCase()})
        </p>
        <span className="os-emoji" aria-hidden="true">{menu.emoji}</span>
        <p data-ux-role="title" className="os-phrase">“{phrase}”</p>
        <p data-ux-role="body" className="os-alt">
          <GameText map={menu.name} lang={custLang} /> ({custLang.toUpperCase()})
        </p>
      </section>

      <section className="os-side" data-ux-surface="panel">
        <h3 data-ux-role="body-emphasis" className="os-h">
          🛎️ {gt(CAFE.orderTitle, langA)}
        </h3>
        <p data-ux-role="body" className="os-hint">{gt(CAFE.orderHint, langA)}</p>

        {audioFailed && (
          <p data-ux-role="body" className="os-fail" role="status">
            🔇 {gt(CAFE.audioFail, langA)}
          </p>
        )}

        <div className="os-btns">
          <button data-ux-role="control" className="bc-secondary" onClick={speak}>
            🔁 {gp(UI.replay, langA)}
          </button>
          <button data-ux-role="action" className="bc-primary os-ready" onClick={onReady}>
            {roleEmoji("chef")} {gp(CAFE.ready, langA)}
          </button>
        </div>
      </section>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const OS_CSS = `
.os-wrap{ display: grid; gap: var(--ux-space-4); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1024px){
  .os-wrap{ grid-template-columns: minmax(0, 1.4fr) minmax(300px, 1fr); align-items: start; }
}
.os-card{
  display: grid; justify-items: center; gap: var(--ux-space-2);
  padding: var(--ux-space-8) var(--ux-space-4);
  background: var(--ux-surface); text-align: center;
}
.os-emoji{ font-size: calc(var(--ux-font-title) * 2.4); line-height: 1; }
.os-flow, .os-phrase, .os-alt{ margin: 0; word-break: keep-all; overflow-wrap: anywhere; }
.os-phrase{ font-weight: 900; max-width: 24ch; }

.os-side{
  display: grid; gap: var(--ux-space-3); align-content: start;
  padding: var(--ux-space-4); background: var(--ux-surface);
}
.os-h, .os-hint{ margin: 0; word-break: keep-all; overflow-wrap: anywhere; }
.os-fail{
  margin: 0; padding: var(--ux-space-3);
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface);
  word-break: keep-all; overflow-wrap: anywhere;
}
.os-btns{ display: grid; gap: var(--ux-space-2); grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.os-ready{ grid-column: 1 / -1; }
@media (min-width: 1024px){ .os-ready{ grid-column: auto; } }
`;

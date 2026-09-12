"use client";

// 문화카드 — 모서리/중앙 칸에 멈추면 세계 인사말 카드가 뜬다.
// 나라 데이터는 다문화 지구본과 공유 (lib/globeData).
// 닫기는 cultureNode 만 지우며 턴 흐름과 무관 (더블탭 무해).

import React, { useEffect } from "react";
import { flagUrlFor, globeCountryName, type GlobeCountry } from "@/lib/globeData";
import { LANGUAGES } from "@/lib/constants";
import ScopedStyle from "../../ui/child/ScopedStyle";
import { cancelSpeak, speak } from "@/lib/ttsMulti";

/**
 * 음성 정리 — lib/ttsMulti 의 cancelSpeak 을 감싼다(그 파일은 수정하지 않는다).
 * 새 인사말을 읽기 전과 카드가 닫힐 때 이 함수를 반드시 부른다.
 */
function stopSpeak(): void {
  cancelSpeak();
}

/** 이전 음성을 멈춘 뒤 새 인사말을 읽는다. */
function say(text: string, lang: string): void {
  stopSpeak();
  void speak(text, lang);
}

export default function CultureCard({
  country, viewerLang, onClose,
}: {
  country: GlobeCountry;
  viewerLang: string;
  onClose: () => void;
}) {
  // 카드가 닫히거나 화면을 떠나면 읽던 인사말이 남지 않게 한다.
  useEffect(() => {
    return () => { stopSpeak(); };
  }, []);

  return (
    <div className="yc-layer" onClick={onClose}>
      <ScopedStyle css={YC_CSS} />
      <div className="yc-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <span data-ux-role="label" className="yc-kicker">🌍 세계 인사 카드</span>
        <img className="yc-landmark" src={country.landmark} alt="" aria-hidden="true" />
        <div className="yc-nameline">
          <img className="yc-flag" src={flagUrlFor(country.code, "w80")} alt="" aria-hidden="true" />
          <span data-ux-role="body-emphasis" className="yc-name">
            {globeCountryName(country, viewerLang)}
          </span>
        </div>
        <span data-ux-role="secondary">{LANGUAGES[country.lang]?.label}</span>
        <button
          data-ux-role="action"
          className="yc-hello"
          onClick={() => say(country.hello, country.lang)}
        >🔊 {country.hello}</button>
        <button data-ux-role="control" className="yc-close" onClick={onClose}>
          계속 하기 →
        </button>
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const YC_CSS = `
.yc-layer{
  position: fixed; inset: 0; z-index: 500;
  background: rgba(41,37,31,.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: var(--ux-space-6);
}
.yc-card{
  width: min(440px, 100%);
  background: var(--ux-surface); border-radius: var(--ux-radius-panel);
  border: 4px solid var(--ux-primary-border);
  box-shadow: 0 20px 50px rgba(41,37,31,.45);
  padding: var(--ux-space-6) var(--ux-space-4);
  display: grid; justify-items: center; gap: var(--ux-space-2); text-align: center;
  animation: ycUp .3s ease-out;
  box-sizing: border-box;
}
@keyframes ycUp{
  from{ transform: translateY(26px) scale(.95); opacity: 0; }
  to  { transform: translateY(0) scale(1); opacity: 1; }
}
.yc-kicker{ font-weight: 900; color: var(--ux-primary-ink); }
.yc-landmark{ width: 110px; height: 110px; object-fit: contain; }
.yc-nameline{ display: flex; align-items: center; justify-content: center; gap: var(--ux-space-2); flex-wrap: wrap; }
.yc-flag{ width: 34px; height: auto; border-radius: 4px; }
.yc-name{ font-weight: 900; }
.yc-hello[data-ux-role="action"]{
  margin-top: var(--ux-space-2);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
}
.yc-close[data-ux-role="control"]{
  background: var(--ux-surface-sunk); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 800;
}
`;

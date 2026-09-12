"use client";

import { useGameText } from "@/lib/gameI18n";
import ScopedStyle from "../../ui/child/ScopedStyle";
import type { ChanceCard as ChanceCardData } from "@/lib/marbleData";

export interface ChanceCardProps {
  card: ChanceCardData;
  langA: string;
  langB: string;
  onDone: () => void;
}

export function ChanceCard({ card, langA, langB, onDone }: ChanceCardProps) {
  // 설계서 항목 12: 미보유 언어는 ko→번역 캐시 (영어 폴백 제거)
  const titleA = useGameText(card.title, langA);
  const titleB = useGameText(card.title, langB);
  const bodyA = useGameText(card.body, langA);
  const bodyB = useGameText(card.body, langB);

  return (
    <div className="mb-chance" role="dialog" aria-modal="true" aria-label="찬스 카드">
      <ScopedStyle css={CHANCE_CSS} />
      <div className="mb-chanceicon" aria-hidden="true">🃏</div>
      <p data-ux-role="body-emphasis" className="mb-chancetitle">{titleA}</p>
      {langA !== langB && (
        <p data-ux-role="label" className="mb-chancetitle2">{titleB}</p>
      )}
      <div className="mb-chancebody">
        <p data-ux-role="body" data-ux-reading>{bodyA}</p>
        {langA !== langB && (
          <p data-ux-role="secondary" data-ux-reading>{bodyB}</p>
        )}
      </div>
      <button data-ux-role="action" className="mb-chanceok" onClick={onDone}>
        ✅ 확인
      </button>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const CHANCE_CSS = `
.mb-chance{
  background: var(--ux-surface-sunk);
  border: 3px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-4);
  width: min(420px, 100%);
  max-height: 100%; overflow-y: auto;
  text-align: center; box-sizing: border-box;
  display: grid; justify-items: center; gap: var(--ux-space-2);
  box-shadow: 0 20px 40px rgba(41,37,31,.35);
}
.mb-chance p{ margin: 0; }
.mb-chanceicon{ font-size: clamp(2.5rem, 9vw, 3.5rem); line-height: 1; }
.mb-chancetitle{ font-weight: 900; color: var(--ux-primary-ink); }
.mb-chancetitle2{ color: var(--ux-ink-soft); font-weight: 700; }
.mb-chancebody{
  background: var(--ux-surface); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3); width: 100%;
  display: grid; gap: var(--ux-space-1); justify-items: center;
}
.mb-chanceok[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 900;
}
`;

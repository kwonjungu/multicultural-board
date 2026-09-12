"use client";

import { tr } from "@/lib/gameData";
import ScopedStyle from "../../ui/child/ScopedStyle";
import { gp } from "../plainText";
import { gt, UI } from "../uiText";
import { CAFE, DIFFICULTY_LABEL, roleEmoji, roleName } from "./cafeText";
import type { Difficulty, Role } from "./types";

interface Props {
  langA: string;
  langB: string;
  roleA: Role;
  roleB: Role;
  difficulty: Difficulty;
  onSwap: () => void;
  onDifficulty: (d: Difficulty) => void;
  onStart: () => void;
}

const L = (lang: string) => (lang || "").toUpperCase();

export default function RoleSelect({
  langA,
  langB,
  roleA,
  roleB,
  difficulty,
  onSwap,
  onDifficulty,
  onStart,
}: Props) {
  const diffs: Difficulty[] = ["easy", "normal", "hard"];

  return (
    <div className="rs-wrap">
      <ScopedStyle css={RS_CSS} />

      <div className="rs-intro">
        <div className="rs-logo" aria-hidden="true">☕️🐝</div>
        <h2 data-ux-role="title" className="rs-title">BeeCafe</h2>
        <p data-ux-role="body" className="rs-sub">{gt(CAFE.subtitle, langA)}</p>
        <p data-ux-role="secondary" className="rs-sub">{gt(CAFE.howto, langA)}</p>
      </div>

      <div className="rs-cols">
        <section className="rs-panel" data-ux-surface="panel">
          <h3 data-ux-role="body-emphasis" className="rs-h">
            🧑‍💼👨‍🍳 {gt(UI.players, langA)}
          </h3>
          <div className="rs-roles">
            <RoleCard lang={langA} role={roleA} tag="A" />
            <RoleCard lang={langB} role={roleB} tag="B" />
          </div>
          <button data-ux-role="control" className="bc-secondary rs-swap" onClick={onSwap}>
            🔄 {gp(CAFE.swapRole, langA)}
          </button>
        </section>

        <section className="rs-panel" data-ux-surface="panel">
          <h3 data-ux-role="body-emphasis" className="rs-h">
            🎚️ {gt(UI.difficulty, langA)}
          </h3>
          <div className="rs-diffs">
            {diffs.map((d) => (
              <button
                key={d}
                data-ux-role="control"
                className="rs-diff"
                data-on={difficulty === d ? "" : undefined}
                aria-pressed={difficulty === d}
                onClick={() => onDifficulty(d)}
              >
                {difficulty === d ? "✅ " : "⬜ "}
                {gp(DIFFICULTY_LABEL[d], langA)}
              </button>
            ))}
          </div>
          <button data-ux-role="action" className="bc-primary rs-start" onClick={onStart}>
            ▶ {gt(UI.start, langA)}
          </button>
        </section>
      </div>
    </div>
  );
}

function RoleCard({ lang, role, tag }: { lang: string; role: Role; tag: string }) {
  return (
    <div className="rs-card">
      <span data-ux-role="secondary" className="rs-tag">
        Player {tag} · {L(lang)}
      </span>
      <span className="rs-face" aria-hidden="true">{roleEmoji(role)}</span>
      <span data-ux-role="body-emphasis" className="rs-role">
        {tr(roleName(role), lang)}
      </span>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const RS_CSS = `
.rs-wrap{ display: grid; gap: var(--ux-space-4); }
.rs-intro{ display: grid; justify-items: center; gap: var(--ux-space-2); text-align: center; }
.rs-logo{ font-size: calc(var(--ux-font-title) * 2.2); line-height: 1; }
.rs-title{ margin: 0; }
.rs-sub{ margin: 0; max-width: 60ch; word-break: keep-all; overflow-wrap: anywhere; }

.rs-cols{ display: grid; gap: var(--ux-space-4); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1024px){
  .rs-cols{ grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
}
.rs-panel{
  display: grid; gap: var(--ux-space-3);
  padding: var(--ux-space-4); background: var(--ux-surface);
}
.rs-h{ margin: 0; }

.rs-roles{ display: grid; gap: var(--ux-space-3); grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.rs-card{
  display: grid; justify-items: center; gap: var(--ux-space-1);
  padding: var(--ux-space-4) var(--ux-space-3);
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface);
  text-align: center;
}
.rs-face{ font-size: calc(var(--ux-font-title) * 1.8); line-height: 1; }
.rs-tag{ font-weight: 800; }
.rs-role{ font-weight: 900; }
.rs-swap{ justify-self: start; }

.rs-diffs{ display: grid; gap: var(--ux-space-2); grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.rs-diff[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-surface-sunk);
  font-family: inherit; font-weight: 800; text-align: left;
  word-break: keep-all; overflow-wrap: anywhere;
}
.rs-diff[data-on]{ border-color: var(--ux-selected-border); background: var(--ux-hint-apricot); }
.rs-start{ justify-self: stretch; }
`;

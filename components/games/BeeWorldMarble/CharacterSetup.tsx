"use client";

import { useState } from "react";
import { COUNTRIES } from "@/lib/gameData";
import { LANGUAGES } from "@/lib/constants";
import ScopedStyle from "../../ui/child/ScopedStyle";
import type { PlayerId, SetupPlayer } from "@/lib/marbleReducer";
import { PLAYER_COLOR } from "./Tile";

export interface CharacterSetupProps {
  langA: string;
  langB: string;
  onDone: (players: SetupPlayer[]) => void;
}

const ALL_IDS: PlayerId[] = ["A", "B", "C", "D"];
const SKINS = ["classic", "orange", "green", "sky", "pink", "purple"] as const;
const HATS: (string | null)[] = [null, "top", "cap", "party", "crown"];
const PETS: (string | null)[] = [null, "dog", "cat", "rabbit", "butterfly"];
const COUNTRY_PICK = ["KR", "US", "JP", "CN", "VN", "TH", "ID", "PH", "IN", "MN", "RU", "SA", "UZ", "KH", "MM"];

const DEFAULT_NAMES: Record<PlayerId, string> = {
  A: "꿀벌 A",
  B: "꿀벌 B",
  C: "꿀벌 C",
  D: "꿀벌 D",
};

function defaultFor(id: PlayerId, langA: string, langB: string): SetupPlayer {
  return {
    id,
    lang: id === "A" || id === "C" ? langA : langB,
    name: DEFAULT_NAMES[id],
    skin: SKINS[ALL_IDS.indexOf(id) % SKINS.length],
    hat: null,
    pet: null,
    country: "KR",
  };
}

export function CharacterSetup({ langA, langB, onDone }: CharacterSetupProps) {
  const [count, setCount] = useState<2 | 3 | 4>(2);
  const [players, setPlayers] = useState<SetupPlayer[]>(() => [
    defaultFor("A", langA, langB),
    defaultFor("B", langA, langB),
    defaultFor("C", langA, langB),
    defaultFor("D", langA, langB),
  ]);

  const active = players.slice(0, count);

  function updateAt(idx: number, patch: Partial<SetupPlayer>) {
    setPlayers((arr) => {
      const next = [...arr];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  return (
    <div className="ms-root">
      <ScopedStyle css={SETUP_CSS} />
      <h1 data-ux-role="title" className="ms-title">🎲 꿀벌 월드 마블 · 캐릭터 설정</h1>

      <div className="ms-countrow">
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            data-ux-role="control"
            className="ms-count"
            data-active={count === n ? "" : undefined}
            aria-pressed={count === n}
            aria-label={`${n}인 플레이`}
            onClick={() => setCount(n as 2 | 3 | 4)}
          >
            👥 {n}인
          </button>
        ))}
      </div>

      <div className="ms-cards">
        {active.map((sp, idx) => (
          <PlayerSetupCard
            key={sp.id}
            sp={sp}
            onPatch={(patch) => updateAt(idx, patch)}
          />
        ))}
      </div>

      <button
        data-ux-role="action"
        className="ms-start"
        aria-label="게임 시작"
        onClick={() => {
          // Fill blank names with "플레이어 N" so we never submit empty strings.
          // Any other missing field has a hard-coded default already.
          const sanitized = active.map((sp, i) => ({
            ...sp,
            name: sp.name.trim() || `플레이어 ${i + 1}`,
          }));
          onDone(sanitized);
        }}
      >
        ▶ 시작!
      </button>
    </div>
  );
}

function PlayerSetupCard({
  sp,
  onPatch,
}: {
  sp: SetupPlayer;
  onPatch: (patch: Partial<SetupPlayer>) => void;
}) {
  const [skinFail, setSkinFail] = useState(false);
  const color = PLAYER_COLOR[sp.id];

  return (
    <div className="ms-card" style={{ borderColor: color }}>
      <div className="ms-cardhead">
        <span className="ms-avatar" style={{ borderColor: color, background: `${color}22` }} aria-hidden="true">
          {skinFail ? (
            <span className="ms-avatarbee">🐝</span>
          ) : (
            <img
              src={`/stickers/skin-${sp.skin}.png`}
              alt=""
              aria-hidden="true"
              onError={() => setSkinFail(true)}
            />
          )}
        </span>
        <label className="ms-namefield">
          <span data-ux-role="secondary">플레이어 {sp.id}</span>
          <input
            className="ms-nameinput"
            aria-label={`플레이어 ${sp.id} 이름`}
            type="text"
            value={sp.name}
            onChange={(e) => onPatch({ name: e.target.value.slice(0, 20) })}
          />
        </label>
      </div>

      <Row label="스킨">
        {SKINS.map((s) => (
          <PickChip
            key={s}
            active={sp.skin === s}
            onClick={() => onPatch({ skin: s })}
            ariaLabel={`스킨 ${s}`}
            imgSrc={`/stickers/skin-${s}.png`}
          />
        ))}
      </Row>
      <Row label="모자">
        {HATS.map((h) => (
          <PickChip
            key={h ?? "none"}
            active={sp.hat === h}
            onClick={() => onPatch({ hat: h })}
            ariaLabel={h ? `모자 ${h}` : "모자 없음"}
            imgSrc={h ? `/stickers/hat-${h}.png` : undefined}
            fallback={h ? "🎩" : "🚫"}
          />
        ))}
      </Row>
      <Row label="펫">
        {PETS.map((p) => (
          <PickChip
            key={p ?? "none"}
            active={sp.pet === p}
            onClick={() => onPatch({ pet: p })}
            ariaLabel={p ? `펫 ${p}` : "펫 없음"}
            imgSrc={p ? `/stickers/pet-${p}.png` : undefined}
            fallback={p ? "🐾" : "🚫"}
          />
        ))}
      </Row>

      <label className="ms-field">
        <span data-ux-role="label">국가</span>
        <select
          className="ms-select"
          aria-label={`플레이어 ${sp.id} 국가`}
          value={sp.country}
          onChange={(e) => onPatch({ country: e.target.value })}
        >
          {COUNTRY_PICK.map((code) => {
            const c = COUNTRIES.find((x) => x.code === code);
            return (
              <option key={code} value={code}>
                {c ? `${c.flag} ${c.names.ko ?? c.names.en ?? code}` : code}
              </option>
            );
          })}
        </select>
      </label>

      <label className="ms-field">
        <span data-ux-role="label">언어</span>
        <select
          className="ms-select"
          aria-label={`플레이어 ${sp.id} 언어`}
          value={sp.lang}
          onChange={(e) => onPatch({ lang: e.target.value })}
        >
          {Object.entries(LANGUAGES).map(([code, info]) => (
            <option key={code} value={code}>
              {info.flag} {info.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ms-row">
      <span data-ux-role="secondary" className="ms-rowlabel">{label}</span>
      <div className="ms-chips">{children}</div>
    </div>
  );
}

function PickChip({
  active,
  onClick,
  ariaLabel,
  imgSrc,
  fallback,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  imgSrc?: string;
  fallback?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      data-ux-role="control"
      className="ms-chip"
      data-active={active ? "" : undefined}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {imgSrc && !failed ? (
        <img
          src={imgSrc}
          alt=""
          aria-hidden="true"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true" className="ms-chipfallback">{fallback ?? "🐝"}</span>
      )}
    </button>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const SETUP_CSS = `
.ms-root{
  padding: var(--ux-space-4);
  width: 100%; box-sizing: border-box;
  display: flex; flex-direction: column; gap: var(--ux-space-4);
  color: var(--ux-ink);
}
.ms-title{ text-align: center; color: var(--ux-primary-ink); }
.ms-countrow{ display: flex; gap: var(--ux-space-2); justify-content: center; flex-wrap: wrap; }
.ms-count[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 900;
}
.ms-count[data-active]{ background: var(--ux-primary-fill); color: var(--ux-primary-ink); border-width: 3px; border-color: var(--ux-selected-border); }

/* 넓은 화면에서는 설정 카드를 여러 열로 — 세로로 끝없이 늘어나지 않게. */
.ms-cards{ display: grid; gap: var(--ux-space-3); grid-template-columns: 1fr; }
@media (min-width: 640px){ .ms-cards{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px){ .ms-cards{ grid-template-columns: repeat(4, minmax(0, 1fr)); } }

.ms-card{
  background: var(--ux-surface); border: 3px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-3);
  display: flex; flex-direction: column; gap: var(--ux-space-2); min-width: 0;
}
.ms-cardhead{ display: flex; align-items: center; gap: var(--ux-space-3); }
.ms-avatar{
  width: 54px; height: 54px; border-radius: 50%; border: 2px solid currentColor;
  display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;
}
.ms-avatar img{ width: 90%; height: 90%; object-fit: contain; }
.ms-avatarbee{ font-size: var(--ux-font-title); line-height: 1; }
.ms-namefield{ flex: 1; min-width: 0; display: grid; gap: var(--ux-space-1); }
.ms-nameinput{
  width: 100%; box-sizing: border-box;
  border: 2px solid var(--ux-primary-border); border-radius: 10px;
  padding: var(--ux-space-2) var(--ux-space-3);
  font-family: inherit; font-size: var(--ux-font-label); font-weight: 800;
  color: var(--ux-ink); background: var(--ux-surface);
  min-height: var(--ux-control-min);
}
.ms-row{ display: grid; gap: var(--ux-space-1); min-width: 0; }
.ms-rowlabel{ font-weight: 800; color: var(--ux-primary-ink); }
.ms-chips{ display: flex; gap: var(--ux-space-2); overflow-x: auto; padding-bottom: var(--ux-space-1); }
.ms-chip[data-ux-role="control"]{
  width: var(--ux-control-min); height: var(--ux-control-min);
  flex-shrink: 0; padding: var(--ux-space-1);
  border: 2px solid var(--ux-primary-border); border-radius: 12px;
  background: var(--ux-surface); font-family: inherit;
  display: flex; align-items: center; justify-content: center;
}
.ms-chip[data-active]{ border-width: 3px; border-color: var(--ux-selected-border); background: var(--ux-primary-fill); }
.ms-chip img{ width: 100%; height: 100%; object-fit: contain; }
.ms-chipfallback{ font-size: var(--ux-font-body); line-height: 1; }
.ms-field{ display: flex; gap: var(--ux-space-2); align-items: center; min-width: 0; }
.ms-field [data-ux-role="label"]{ min-width: 3em; font-weight: 800; }
.ms-select{
  flex: 1; min-width: 0; box-sizing: border-box;
  border: 2px solid var(--ux-primary-border); border-radius: 10px;
  padding: var(--ux-space-2); font-family: inherit;
  font-size: var(--ux-font-label); font-weight: 700;
  color: var(--ux-ink); background: var(--ux-surface);
  min-height: var(--ux-control-min);
}
.ms-start[data-ux-role="action"]{
  align-self: center; min-width: 200px;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 900;
  position: relative; z-index: 2;
}
`;

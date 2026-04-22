"use client";

import { CSSProperties, useState } from "react";
import { COUNTRIES } from "@/lib/gameData";
import { LANGUAGES } from "@/lib/constants";
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

  const wrap: CSSProperties = {
    padding: 16,
    maxWidth: 720,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  };

  return (
    <div style={wrap}>
      <div
        style={{
          textAlign: "center",
          fontSize: 22,
          fontWeight: 900,
          color: "#78350F",
        }}
      >
        🎲 꿀벌 월드 마블 · 캐릭터 설정
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n}인 플레이`}
            onClick={() => setCount(n as 2 | 3 | 4)}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: count === n ? "3px solid #F59E0B" : "2px solid #FDE68A",
              background: count === n ? "#FEF3C7" : "#fff",
              color: "#92400E",
              fontWeight: 900,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            👥 {n}인
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {active.map((sp, idx) => (
          <PlayerSetupCard
            key={sp.id}
            sp={sp}
            onPatch={(patch) => updateAt(idx, patch)}
          />
        ))}
      </div>

      <button
        type="button"
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
        style={{
          background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
          color: "#fff",
          border: "none",
          padding: "16px 40px",
          borderRadius: 999,
          fontSize: 18,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 8px 20px rgba(245,158,11,0.4)",
          alignSelf: "center",
          minWidth: 180,
          position: "relative",
          zIndex: 2,
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
  const card: CSSProperties = {
    background: "#fff",
    border: `3px solid ${color}`,
    borderRadius: 16,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    boxShadow: `0 4px 10px ${color}22`,
  };

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: "50%",
            background: `${color}22`,
            border: `2px solid ${color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {skinFail ? (
            <span aria-hidden="true" style={{ fontSize: 30 }}>🐝</span>
          ) : (
            <img
              src={`/stickers/skin-${sp.skin}.png`}
              alt=""
              aria-hidden="true"
              onError={() => setSkinFail(true)}
              style={{ width: "90%", height: "90%", objectFit: "contain" }}
            />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 800 }}>
            플레이어 {sp.id}
          </div>
          <input
            aria-label={`플레이어 ${sp.id} 이름`}
            type="text"
            value={sp.name}
            onChange={(e) => onPatch({ name: e.target.value.slice(0, 20) })}
            style={{
              width: "100%",
              border: "2px solid #FDE68A",
              borderRadius: 10,
              padding: "6px 10px",
              fontSize: 14,
              fontWeight: 800,
              color: "#111827",
              marginTop: 2,
              boxSizing: "border-box",
            }}
          />
        </div>
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

      <label
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "#374151",
        }}
      >
        <span style={{ minWidth: 42 }}>국가</span>
        <select
          aria-label={`플레이어 ${sp.id} 국가`}
          value={sp.country}
          onChange={(e) => onPatch({ country: e.target.value })}
          style={{
            flex: 1,
            border: "2px solid #FDE68A",
            borderRadius: 10,
            padding: "6px 8px",
            fontSize: 13,
            fontWeight: 700,
          }}
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

      <label
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "#374151",
        }}
      >
        <span style={{ minWidth: 42 }}>언어</span>
        <select
          aria-label={`플레이어 ${sp.id} 언어`}
          value={sp.lang}
          onChange={(e) => onPatch({ lang: e.target.value })}
          style={{
            flex: 1,
            border: "2px solid #FDE68A",
            borderRadius: 10,
            padding: "6px 8px",
            fontSize: 13,
            fontWeight: 700,
          }}
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
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#92400E", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {children}
      </div>
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
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: 46,
        height: 46,
        flexShrink: 0,
        borderRadius: 12,
        border: active ? "3px solid #F59E0B" : "2px solid #FDE68A",
        background: active ? "#FEF3C7" : "#fff",
        padding: 4,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
      }}
    >
      {imgSrc && !failed ? (
        <img
          src={imgSrc}
          alt=""
          aria-hidden="true"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <span aria-hidden="true">{fallback ?? "🐝"}</span>
      )}
    </button>
  );
}

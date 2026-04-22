"use client";

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

function roleLabel(r: Role, lang: string): string {
  if (r === "customer") {
    if (lang === "ko") return "손님";
    if (lang === "ja") return "お客";
    if (lang === "zh") return "顾客";
    if (lang === "vi") return "Khách";
    return "Customer";
  }
  if (lang === "ko") return "셰프";
  if (lang === "ja") return "シェフ";
  if (lang === "zh") return "厨师";
  if (lang === "vi") return "Đầu bếp";
  return "Chef";
}

function difficultyLabel(d: Difficulty, lang: string): string {
  const map: Record<Difficulty, Record<string, string>> = {
    easy: { ko: "쉬움 (무제한)", en: "Easy (unlimited)", ja: "やさしい", zh: "简单", vi: "Dễ" },
    normal: { ko: "보통 (75초)", en: "Normal (75s)", ja: "普通 (75秒)", zh: "普通", vi: "Thường" },
    hard: { ko: "어려움 (45초)", en: "Hard (45s)", ja: "難しい (45秒)", zh: "困难", vi: "Khó" },
  };
  return map[d][lang] ?? map[d].en ?? "";
}

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
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: "28px 18px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 56 }}>☕️🐝</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: "8px 0 4px" }}>
        BeeCafe
      </h2>
      <p style={{ color: "#6B7280", fontSize: 13, margin: 0 }}>
        {langA === "ko"
          ? "손님과 셰프가 함께 요리해요!"
          : "Customer & Chef cook together!"}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 22,
        }}
      >
        <RoleCard lang={langA} role={roleA} tag="A" />
        <RoleCard lang={langB} role={roleB} tag="B" />
      </div>

      <button
        onClick={onSwap}
        aria-label="Swap roles"
        style={{
          marginTop: 14,
          padding: "10px 18px",
          borderRadius: 14,
          border: "1px solid #F59E0B",
          background: "#FEF3C7",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        🔄 Swap / 역할 바꾸기
      </button>

      <div style={{ marginTop: 28 }}>
        <div
          style={{
            fontSize: 12,
            color: "#6B7280",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          난이도 / Difficulty
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {diffs.map((d) => (
            <button
              key={d}
              onClick={() => onDifficulty(d)}
              aria-label={`Difficulty ${d}`}
              style={{
                padding: "8px 14px",
                borderRadius: 12,
                border:
                  difficulty === d ? "2px solid #F59E0B" : "1px solid #E5E7EB",
                background: difficulty === d ? "#FEF3C7" : "#fff",
                fontWeight: 800,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {difficultyLabel(d, langA)}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onStart}
        aria-label="Start game"
        style={{
          marginTop: 26,
          padding: "14px 28px",
          borderRadius: 16,
          border: "none",
          background: "linear-gradient(180deg,#FBBF24,#F59E0B)",
          color: "#111",
          fontWeight: 900,
          fontSize: 16,
          cursor: "pointer",
          boxShadow: "0 6px 14px rgba(245,158,11,0.35)",
        }}
      >
        ▶ Start / 시작
      </button>
    </div>
  );
}

function RoleCard({ lang, role, tag }: { lang: string; role: Role; tag: string }) {
  return (
    <div
      style={{
        padding: "16px 12px",
        borderRadius: 16,
        border: "1px solid #E5E7EB",
        background: "#fff",
        boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 800 }}>
        Player {tag} · {L(lang)}
      </div>
      <div style={{ fontSize: 40, margin: "4px 0" }}>
        {role === "customer" ? "🧑‍💼" : "👨‍🍳"}
      </div>
      <div style={{ fontWeight: 800 }}>{roleLabel(role, lang)}</div>
    </div>
  );
}

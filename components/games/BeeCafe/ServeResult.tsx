"use client";

import { tr } from "@/lib/gameData";
import { INGR_BY_ID, MENU_BY_ID, STEP_BY_ID } from "./cafeData";
import type {
  IngredientId,
  MenuId,
  Role,
  ScoreResult,
  StepId,
} from "./types";

interface Props {
  langA: string;
  langB: string;
  roleA: Role;
  menuId: MenuId;
  picked: IngredientId[];
  stepOrder: StepId[];
  score: ScoreResult;
  isLast: boolean;
  onNext: () => void;
  onReset: () => void;
}

export default function ServeResult({
  langA,
  langB,
  roleA,
  menuId,
  picked,
  stepOrder,
  score,
  isLast,
  onNext,
  onReset,
}: Props) {
  const chefLang = roleA === "chef" ? langA : langB;
  const custLang = roleA === "customer" ? langA : langB;
  const menu = MENU_BY_ID[menuId];

  const answerIngr = new Set<IngredientId>(menu.ingredients);
  const answerSteps = menu.steps;

  const feedback =
    score.stars === 3
      ? "완벽해요! 🎉 / Perfect!"
      : score.stars === 2
        ? "잘했어요! 👍 / Nice!"
        : "다시 도전! 💪 / Try again!";

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "22px 16px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 64 }}>{menu.emoji}</div>
      <div style={{ fontWeight: 900, fontSize: 20, marginTop: 4 }}>
        {tr(menu.name, chefLang)}
      </div>
      <div style={{ fontSize: 12, color: "#6B7280" }}>
        {tr(menu.name, custLang)}
      </div>

      <div style={{ fontSize: 44, marginTop: 8 }}>
        {"⭐".repeat(score.stars)}
        <span style={{ opacity: 0.2 }}>{"⭐".repeat(3 - score.stars)}</span>
      </div>
      <div style={{ fontWeight: 900, marginTop: 2 }}>{feedback}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
        {score.detail}
      </div>

      {/* Compare ingredients */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 14,
          background: "#F9FAFB",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>
          재료 비교 / Ingredients
        </div>
        <div
          style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}
        >
          {menu.ingredients.map((id) => {
            const got = picked.includes(id);
            const ing = INGR_BY_ID[id];
            return (
              <span
                key={`ans-${id}`}
                style={{
                  padding: "4px 8px",
                  borderRadius: 10,
                  background: got ? "#D1FAE5" : "#FEE2E2",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {ing.emoji} {tr(ing.name, chefLang)} {got ? "✓" : "✗"}
              </span>
            );
          })}
          {picked
            .filter((id) => !answerIngr.has(id))
            .map((id) => {
              const ing = INGR_BY_ID[id];
              return (
                <span
                  key={`extra-${id}`}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 10,
                    background: "#FEF3C7",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {ing.emoji} {tr(ing.name, chefLang)} ⚠
                </span>
              );
            })}
        </div>
      </div>

      {/* Compare steps */}
      <div
        style={{
          marginTop: 10,
          padding: 12,
          borderRadius: 14,
          background: "#F9FAFB",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>
          정답 순서 / Correct order
        </div>
        <div
          style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}
        >
          {answerSteps.map((id, i) => {
            const s = STEP_BY_ID[id];
            return (
              <span
                key={`ans-step-${i}`}
                style={{
                  padding: "4px 8px",
                  borderRadius: 10,
                  background: "#E0F2FE",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {i + 1}. {s.emoji} {tr(s.name, chefLang)}
              </span>
            );
          })}
        </div>
        <div
          style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", marginTop: 8 }}
        >
          내 순서 / Your order
        </div>
        <div
          style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}
        >
          {stepOrder.map((id, i) => {
            const s = STEP_BY_ID[id];
            const correct = answerSteps[i] === id;
            return (
              <span
                key={`mine-${i}`}
                style={{
                  padding: "4px 8px",
                  borderRadius: 10,
                  background: correct ? "#D1FAE5" : "#FEE2E2",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {i + 1}. {s.emoji} {tr(s.name, chefLang)}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
        <button
          onClick={onReset}
          aria-label="Reset game"
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          🏠 처음부터
        </button>
        <button
          onClick={onNext}
          aria-label={isLast ? "Finish game" : "Next round"}
          style={{
            padding: "10px 22px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(180deg,#FBBF24,#F59E0B)",
            color: "#111",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {isLast ? "🏁 결과 보기" : "➡ 다음 메뉴"}
        </button>
      </div>
    </div>
  );
}

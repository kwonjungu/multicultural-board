"use client";

/**
 * README §7.4 의 대표 승인판 6종 × 흰색/크림/어두운 배경 × 96/160/320px.
 *
 * 고정 입력만 쓴다(HARNESS §2). 여기서 보이는 것이 칭찬집·꾸미기 미리보기와
 * 같아야 한다 — 셋 다 같은 render plan 을 쓰기 때문이다(ART-04).
 */
import { useMemo } from "react";
import CharacterComposite, { planNoticeText } from "@/components/CharacterComposite";
import { buildCharacterRenderPlan, bodyCandidates } from "@/lib/characterRenderPlan";
import type { Stage, SkinId, HatId, HeldId, AccId, BackdropId, AuraId } from "@/lib/types";

interface Combo {
  id: string;
  label: string;
  stage: Stage;
  skin: SkinId;
  hat?: HatId;
  held?: HeldId;
  acc?: AccId;
  backdrop?: BackdropId;
  aura?: AuraId;
  forceAssetFailure?: boolean;
}

const COMBOS: Combo[] = [
  { id: "bee-classic-glasses", label: "벌 + 기본색 + 안경", stage: "bee", skin: "classic", acc: "glasses" },
  { id: "bee-sky-cap-book", label: "벌 + 하늘색 + 모자 + 책", stage: "bee", skin: "sky", hat: "cap", held: "book" },
  { id: "queen-pink-crownhoney-necklace", label: "여왕벌 + 분홍 + 꿀왕관 + 목걸이", stage: "queen", skin: "pink", hat: "crown-honey", acc: "necklace" },
  { id: "queen-classic-cape-flag", label: "여왕벌 + 기본색 + 망토 + 깃발", stage: "queen", skin: "classic", acc: "cape", held: "flag" },
  { id: "pupa-scarf", label: "번데기 + 목도리", stage: "pupa", skin: "classic", acc: "scarf" },
  { id: "all-fail", label: "모든 자산 실패", stage: "bee", skin: "pink", hat: "party", acc: "glasses", held: "book", forceAssetFailure: true },
];

const BACKGROUNDS = [
  { id: "white", label: "흰색", css: "#FFFFFF", ink: "#29251F" },
  { id: "cream", label: "크림", css: "#FFF9ED", ink: "#29251F" },
  { id: "dark", label: "어두움", css: "#241B0E", ink: "#FFF3D6" },
];

const SIZES = [96, 160, 320];

export default function CharacterFixture() {
  return (
    <div
      data-ux-root
      style={{
        minHeight: "100vh",
        background: "var(--ux-bg, #FFF9ED)",
        color: "var(--ux-ink, #29251F)",
        padding: "var(--ux-space-5, 24px)",
        fontFamily: "inherit",
      }}
    >
      <h1 data-ux-role="title" style={{ fontSize: "var(--ux-font-title)", margin: "0 0 8px" }}>
        캐릭터 합성 검수판
      </h1>
      <p data-ux-role="body" style={{ fontSize: "var(--ux-font-body)", lineHeight: "var(--ux-lh-reading)", margin: "0 0 24px" }}>
        개발 전용 fixture. 대표 조합 6종을 배경 3종 × 크기 3종으로 나열한다. 숫자는 검사용 표시이고,
        관통·공중에 뜸·피부색 불일치·잘림은 사람이 직접 본다.
      </p>
      {COMBOS.map((combo) => (
        <ComboSection key={combo.id} combo={combo} />
      ))}
    </div>
  );
}

function ComboSection({ combo }: { combo: Combo }) {
  // 표시용 plan — 아래 320px 상자와 같은 입력이다.
  const plan = useMemo(() => {
    const props = {
      stage: combo.stage,
      skin: combo.skin,
      hat: combo.hat ?? null,
      held: combo.held ?? null,
      acc: combo.acc ?? null,
      backdrop: combo.backdrop ?? null,
      aura: combo.aura ?? null,
      size: 320,
      reducedMotion: true,
    };
    if (!combo.forceAssetFailure) return buildCharacterRenderPlan(props);
    const failedAssetIds = new Set<string>(bodyCandidates(props).map((c) => c.assetId));
    if (props.hat) failedAssetIds.add(`hat/${props.hat}`);
    if (props.acc) failedAssetIds.add(`acc/${props.acc}`);
    if (props.held) failedAssetIds.add(`held/${props.held}`);
    return buildCharacterRenderPlan(props, { failedAssetIds });
  }, [combo]);
  const notice = planNoticeText(plan);

  return (
    <section
      data-fixture-combo={combo.id}
      style={{
        marginBottom: 32,
        border: "2px solid var(--ux-primary-border, #895300)",
        borderRadius: "var(--ux-radius-panel, 28px)",
        padding: "var(--ux-space-4, 16px)",
        background: "var(--ux-surface, #fff)",
      }}
    >
      <h2 data-ux-role="body-emphasis" style={{ fontSize: "var(--ux-font-body-emphasis)", margin: "0 0 4px" }}>
        {combo.label}
      </h2>
      <p data-ux-role="secondary" style={{ fontSize: "var(--ux-font-secondary)", margin: "0 0 16px", color: "var(--ux-ink-soft, #63574A)" }}>
        {`status ${plan.status} · ${plan.resolvedAssetId} · hash ${plan.planHash}`}
        {notice ? ` · “${notice}”` : ""}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {BACKGROUNDS.map((bg) => (
          <div
            key={bg.id}
            data-fixture-bg={bg.id}
            style={{
              background: bg.css,
              color: bg.ink,
              borderRadius: 20,
              border: "1px solid rgba(137,83,0,.25)",
              padding: 16,
              display: "flex",
              alignItems: "flex-end",
              gap: 16,
            }}
          >
            {SIZES.map((size) => (
              <div key={size} data-fixture-size={size} style={{ textAlign: "center" }}>
                <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
                  <CharacterComposite
                    stage={combo.stage}
                    skin={combo.skin}
                    hat={combo.hat ?? null}
                    held={combo.held ?? null}
                    acc={combo.acc ?? null}
                    backdrop={combo.backdrop ?? null}
                    aura={combo.aura ?? null}
                    size={size}
                    float={false}
                    forceAssetFailure={combo.forceAssetFailure}
                  />
                </div>
                <span data-ux-role="secondary" style={{ fontSize: "var(--ux-font-secondary)", color: bg.ink }}>
                  {size}px
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

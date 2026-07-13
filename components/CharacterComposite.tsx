"use client";

import { useEffect, useState } from "react";
import type { Stage, SkinId, HatId, BackdropId, AuraId, HeldId, AccId } from "@/lib/types";
import {
  stageImage,
  stageImageWithSkin,
  stageImageWithHat,
  stageImageWithSkinAndHat,
} from "@/lib/stage";
import anchorsData from "@/public/stickers/anchors.json";

// ============================================================
// 캐릭터 합성 렌더 — PraiseHive(히어로·전시장)와 CosmeticPicker(미리보기)가
// 공유한다. 미리보기와 실제 전시 렌더가 어긋나지 않도록 합성 체인·좌표
// 로직은 반드시 이 파일에만 둔다.
// ============================================================

// Head anchors — 합성본이 전부 404 일 때의 최후 폴백 오버레이에만 사용.
// (왕관 포함 모든 모자 조합은 stage-hats/skin-hats 합성본이 1순위)
interface CharAnchor {
  headXPct: number;
  headTopYPct: number;
  hatScalePct: number;
  /** 눈높이 중심 (안경). 트림 이미지 기준 %. */
  faceYPct?: number;
  /** 턱 아래 (목도리/목걸이/망토). */
  neckYPct?: number;
  /** 액세서리 기준 폭 (박스 폭 대비 %). */
  accScalePct?: number;
}
const ANCHORS = anchorsData as unknown as Record<string, CharAnchor>;
const FALLBACK_ANCHOR: CharAnchor = { headXPct: 50, headTopYPct: 18, hatScalePct: 38 };

const STAGE_ANCHOR_KEY: Record<Stage, string> = {
  egg: "stage-1-egg",
  larva: "stage-2-larva",
  pupa: "stage-3-pupa",
  bee: "stage-4-bee",
  queen: "stage-5-queen",
};

/** Character image with multi-step fallback chain:
 *  skin+hat composite → classic+hat composite → skin-only → plain stage.
 *  각 404 시 onError 로 다음 후보 시도.
 *
 *  모자 합성본을 전부 실패하고 본체 후보까지 내려온 경우에만
 *  anchors.json 좌표로 모자 PNG 를 오버레이한다 (모자 증발 방지).
 */
export function CharacterImage({
  stage,
  skin,
  hat,
  float = true,
}: {
  stage: Stage;
  skin: SkinId;
  hat: HatId;
  /** heroBeeFloat 부유 애니메이션 (전역 keyframes, app/layout.tsx) */
  float?: boolean;
}) {
  // 후보 URL 배열 (순서대로 시도).
  const candidates: string[] = [];
  if (hat) {
    candidates.push(stageImageWithSkinAndHat(stage, skin, hat));
    if (skin !== "classic") candidates.push(stageImageWithHat(stage, hat));
  }
  const hatCandidates = candidates.length;
  if (skin !== "classic") candidates.push(stageImageWithSkin(stage, skin));
  candidates.push(stageImage(stage));

  const [idx, setIdx] = useState(0);
  const [hatFail, setHatFail] = useState(false);
  // 코스메틱이 실시간으로 바뀌는 화면(꾸미기 미리보기, 구독 갱신)에서
  // 이전 조합의 폴백 인덱스가 새 조합으로 새지 않도록 조합 변경 시 리셋.
  useEffect(() => {
    setIdx(0);
    setHatFail(false);
  }, [stage, skin, hat]);

  const src = candidates[Math.min(idx, candidates.length - 1)];
  // 모자 합성본 후보를 전부 지나쳐 본체만 그리게 됐을 때만 오버레이 폴백.
  const overlayHat = hat && idx >= hatCandidates ? hat : null;

  const anchor = ANCHORS[STAGE_ANCHOR_KEY[stage]] ?? FALLBACK_ANCHOR;
  const hatW = anchor.hatScalePct; // 박스 폭 대비 %
  const hatLeft = anchor.headXPct - hatW / 2;
  const hatTop = anchor.headTopYPct - hatW * 0.85; // 바닥이 머리에 15% 침투

  const floatAnim = float ? "heroBeeFloat 3s ease-in-out infinite" : undefined;

  return (
    <>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        onError={() => setIdx((i) => i + 1)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          animation: floatAnim,
          filter: "drop-shadow(0 8px 18px rgba(245,158,11,0.4))",
          zIndex: 1,
        }}
      />
      {overlayHat && !hatFail && (
        <img
          src={`/stickers/hat-${overlayHat}.png`}
          alt=""
          aria-hidden="true"
          onError={() => setHatFail(true)}
          style={{
            position: "absolute",
            left: `${hatLeft}%`,
            top: `${hatTop}%`,
            width: `${hatW}%`,
            height: `${hatW}%`,
            objectFit: "contain",
            animation: floatAnim,
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.2))",
            zIndex: 2,
          }}
        />
      )}
    </>
  );
}

/** 배경 + 오라 오버레이 — 캐릭터 박스(정사각, position:relative) 안에서 사용.
 *  backdrop 은 캐릭터 뒤(z0, 라운드 클립), aura 는 캐릭터 앞(z3, 포인터 통과). */
export function CosmeticFrame({ backdrop, aura }: { backdrop?: BackdropId; aura?: AuraId }) {
  return (
    <>
      {backdrop && (
        <img
          src={`/stickers/backdrop-${backdrop}.png`}
          alt=""
          aria-hidden="true"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{
            position: "absolute", inset: "-4%",
            width: "108%", height: "108%",
            objectFit: "cover", borderRadius: "14%",
            zIndex: 0,
          }}
        />
      )}
      {aura && (
        <img
          src={`/stickers/aura-${aura}.png`}
          alt=""
          aria-hidden="true"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{
            position: "absolute", inset: "-8%",
            width: "116%", height: "116%",
            objectFit: "contain",
            zIndex: 3, pointerEvents: "none",
            animation: "heroBeeFloat 4s ease-in-out infinite reverse",
          }}
        />
      )}
    </>
  );
}

/** 소지품(held) + 액세서리(acc) 오버레이 — CharacterImage 와 같은 정사각
 *  박스 안에서, CharacterImage "뒤"(DOM 순서상 앞이면 cape 가 캐릭터를 가림)
 *  가 아니라 **CharacterImage 다음에** 넣는다. cape 만 zIndex 0(캐릭터 뒤,
 *  backdrop 위)으로 깔리고 나머지는 zIndex 2(캐릭터 앞).
 *  좌표는 anchors.json 의 faceYPct/neckYPct/accScalePct (트림 이미지 기준).
 *  캐릭터가 heroBeeFloat 로 부유하므로 착용형 acc 는 같은 애니메이션을 공유해
 *  몸에 붙어 움직이는 것처럼 보이게 한다. */
export function AccessoryLayer({
  stage,
  held,
  acc,
  float = true,
}: {
  stage: Stage;
  held?: HeldId;
  acc?: AccId;
  float?: boolean;
}) {
  const a = ANCHORS[STAGE_ANCHOR_KEY[stage]] ?? FALLBACK_ANCHOR;
  const x = a.headXPct;
  const face = a.faceYPct ?? 34;
  const neck = a.neckYPct ?? 52;
  const scale = a.accScalePct ?? 46;
  const floatAnim = float ? "heroBeeFloat 3s ease-in-out infinite" : undefined;

  const hide = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.currentTarget as HTMLImageElement).style.display = "none";
  };

  // acc 별 배치 파라미터 (박스 % 단위)
  let accEl: React.ReactNode = null;
  if (acc === "glasses") {
    // 0.92: 양쪽 눈을 모두 덮는 폭 (0.74 는 bee/queen 에서 한쪽 눈만 걸침)
    const w = scale * 0.92;
    accEl = (
      <img src="/stickers/acc-glasses.png" alt="" aria-hidden="true" onError={hide}
        style={{
          position: "absolute", left: `${x - w / 2}%`, top: `${face - w * 0.21}%`,
          width: `${w}%`, zIndex: 2, animation: floatAnim,
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))",
        }} />
    );
  } else if (acc === "scarf") {
    const w = scale * 1.02;
    accEl = (
      <img src="/stickers/acc-scarf.png" alt="" aria-hidden="true" onError={hide}
        style={{
          position: "absolute", left: `${x - w / 2}%`, top: `${neck - w * 0.16}%`,
          width: `${w}%`, zIndex: 2, animation: floatAnim,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
        }} />
    );
  } else if (acc === "necklace") {
    const w = scale * 0.92;
    accEl = (
      <img src="/stickers/acc-necklace.png" alt="" aria-hidden="true" onError={hide}
        style={{
          position: "absolute", left: `${x - w / 2}%`, top: `${neck - w * 0.06}%`,
          width: `${w}%`, zIndex: 2, animation: floatAnim,
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.12))",
        }} />
    );
  } else if (acc === "cape") {
    // 망토는 캐릭터 뒤(z0) — backdrop(z0, DOM 앞) 위에 그려진다.
    const w = Math.min(100, scale * 1.9);
    accEl = (
      <img src="/stickers/acc-cape.png" alt="" aria-hidden="true" onError={hide}
        style={{
          position: "absolute", left: `${x - w / 2}%`, top: `${neck - w * 0.14}%`,
          width: `${w}%`, zIndex: 0, animation: floatAnim,
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.18))",
        }} />
    );
  }

  return (
    <>
      {accEl}
      {held && (
        <img
          src={`/stickers/held-${held}.png`}
          alt=""
          aria-hidden="true"
          onError={hide}
          style={{
            position: "absolute", left: "1%", bottom: "2%",
            width: "30%", zIndex: 2, animation: floatAnim,
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.18))",
          }}
        />
      )}
    </>
  );
}

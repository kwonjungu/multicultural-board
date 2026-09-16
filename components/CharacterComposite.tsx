"use client";

/**
 * 캐릭터 합성 렌더 — **plan 을 그리기만 한다**(작업 D, README §7.3).
 *
 * 좌표·폴백 판단은 전부 `lib/characterRenderPlan.ts`(순수 함수)에 있고,
 * 기하 계약은 `lib/childUx/renderPlanContract.ts` 가 동결했다. 이 파일은
 * plan 을 DOM 으로 옮기고 로드 실패만 되돌려준다.
 *
 * 지켜야 하는 것:
 *  - PraiseHive · CosmeticPicker · BeeVillage 가 **같은 plan** 을 본다(ART-04).
 *    미리보기와 실제 화면이 달랐던 원인은 각자 렌더였다.
 *  - 몸 + 착용물은 **부모 그룹 하나에서만** 부유한다. 레이어마다 애니메이션을
 *    걸면 늦게 로드된 레이어의 위상이 어긋난다(ART-04).
 *  - 그림자는 장면 접지용 1개. 레이어마다 다른 방향의 그림자를 더하지 않는다.
 *  - 로드 실패는 자산당 1회만 시도하고, 장식이 바뀌면 실패 상태를 비운다(ART-05).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LADDERS, optimizedSrc, pickWidth } from "@/lib/imageOpt";
import type { CSSProperties } from "react";
import type { Stage, SkinId, HatId, BackdropId, AuraId, HeldId, AccId } from "@/lib/types";
import { useChildUx } from "@/lib/childUx";
import type { CharacterRenderPlan, CharacterRenderProps, RenderLayer } from "@/lib/childUx/renderPlanContract";
import {
  buildCharacterRenderPlan,
  bodyCandidates,
  characterPropsKey,
  skinWasDowngraded,
} from "@/lib/characterRenderPlan";

export interface CharacterCompositeProps {
  stage: Stage;
  skin: SkinId;
  hat?: HatId;
  held?: HeldId;
  acc?: AccId;
  backdrop?: BackdropId;
  aura?: AuraId;
  /** 정사각 컨테이너 한 변(CSS px). 생략하면 부모 크기를 실측한다. */
  size?: number;
  /** 부유 애니메이션. reduced-motion 에서는 값과 무관하게 멈춘다. */
  float?: boolean;
  /** 이 화면에서만 그릴 레이어. 옛 3분할 API(아래) 호환용. */
  only?: "environment" | "body" | "attachments";
  /** fixture/테스트 전용 — 모든 자산 로드 실패를 강제한다. */
  forceAssetFailure?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 화면에서 실제로 적용되는 모션 설정. CSS 쪽 차단과 별개로 plan 에도 반영한다. */
function useReducedMotion(): boolean {
  const { motion } = useChildUx();
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  if (motion === "reduced") return true;
  if (motion === "full") return false;
  return systemReduced;
}

/** SSR 에서 useLayoutEffect 경고를 내지 않기 위한 동형 훅. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** size 를 넘기지 않은 호출부를 위해 컨테이너 한 변을 잰다. */
function useMeasuredSize(enabled: boolean): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useIsoLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const next = Math.min(w, h) || w || h;
      setSize((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled]);
  return [ref, size];
}

const FLOAT_GROUP_KINDS = new Set(["cape-back", "body-back", "body", "front-hand-mask", "hat", "face-accessory"]);
const CLIPPED_KINDS = new Set(["background"]);

export default function CharacterComposite({
  stage,
  skin,
  hat = null,
  held = null,
  acc = null,
  backdrop = null,
  aura = null,
  size,
  float = true,
  only,
  forceAssetFailure = false,
  className,
  style,
}: CharacterCompositeProps) {
  const reducedMotion = useReducedMotion();
  const [boxRef, measured] = useMeasuredSize(size === undefined);
  const boxSize = size ?? measured;

  const props: CharacterRenderProps = useMemo(
    () => ({ stage, skin, hat, held, acc, backdrop, aura, size: boxSize, reducedMotion }),
    [stage, skin, hat, held, acc, backdrop, aura, boxSize, reducedMotion],
  );

  // 실패한 자산은 후보당 1회만 시도한다. 장식이 바뀌면 비운다(ART-05) —
  // 일시적인 네트워크 오류 뒤에 같은 장식을 다시 고르면 정상 복구되어야 한다.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const propsKey = characterPropsKey(props);
  const lastKeyRef = useRef(propsKey);
  if (lastKeyRef.current !== propsKey) {
    lastKeyRef.current = propsKey;
    if (failed.size > 0) setFailed(new Set<string>());
  }

  const forced = useMemo(() => {
    if (!forceAssetFailure) return null;
    const s = new Set<string>(bodyCandidates(props).map((c) => c.assetId));
    if (hat) s.add(`hat/${hat}`);
    if (acc) s.add(`acc/${acc}`);
    if (held) s.add(`held/${held}`);
    if (backdrop) s.add(`backdrop/${backdrop}`);
    if (aura) s.add(`aura/${aura}`);
    return s as ReadonlySet<string>;
  }, [forceAssetFailure, props, hat, acc, held, backdrop, aura]);

  const plan = useMemo(
    () => buildCharacterRenderPlan(props, { failedAssetIds: forced ?? failed }),
    [props, forced, failed],
  );

  // 선택한 스킨이 유지되지 않은 경우는 개발 로그로만 남긴다(README §7.3).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && skinWasDowngraded(props, plan)) {
      console.warn(`[CharacterComposite] 스킨 "${props.skin}" 자산을 못 써서 기본 단계로 내려갔다 (${plan.resolvedAssetId})`);
    }
  }, [props, plan]);

  const onLayerError = useCallback((assetId: string) => {
    setFailed((prev) => {
      if (prev.has(assetId)) return prev;
      const next = new Set(prev);
      next.add(assetId);
      return next;
    });
  }, []);

  const wantEnvironment = only === undefined || only === "environment";
  const wantBody = only === undefined || only === "body";
  const wantAttachments = only === undefined || only === "attachments";

  const visible = plan.layers.filter((l) => {
    if (l.kind === "background" || l.kind === "aura" || l.kind === "environment-shadow") return wantEnvironment;
    if (l.kind === "held-back" || l.kind === "held-front" || l.kind === "face-accessory" || l.kind === "cape-back") return wantAttachments;
    return wantBody;
  });

  const clipped = visible.filter((l) => CLIPPED_KINDS.has(l.kind));
  const floating = visible.filter((l) => FLOAT_GROUP_KINDS.has(l.kind) && !CLIPPED_KINDS.has(l.kind));
  // 바닥 소품·그림자·오라는 몸과 함께 흔들리지 않는다 — 바닥에 붙어 있어야 한다.
  const grounded = visible.filter((l) => !FLOAT_GROUP_KINDS.has(l.kind) && !CLIPPED_KINDS.has(l.kind));

  // size 를 받은 호출부는 자기 박스를 만들고, 안 받은 호출부(옛 API)는 부모를 채운다.
  const wrapperStyle: CSSProperties =
    size !== undefined
      ? { position: "relative", width: size, height: size, pointerEvents: "none", ...style }
      : { position: "absolute", inset: 0, pointerEvents: "none", ...style };

  return (
    <div
      ref={boxRef}
      className={className}
      data-ux-character=""
      data-plan-status={plan.status}
      data-plan-hash={plan.planHash}
      data-plan-asset={plan.resolvedAssetId}
      data-plan-size={boxSize || undefined}
      style={wrapperStyle}
    >
      {clipped.length > 0 && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "14%" }}>
          {clipped.map((l) => (
            <LayerImage key={layerKey(l)} layer={l} onError={onLayerError} />
          ))}
        </div>
      )}
      {grounded.map((l) => (
        <LayerImage key={layerKey(l)} layer={l} onError={onLayerError} />
      ))}
      {floating.length > 0 && (
        <div
          data-ux-character-group=""
          style={{
            position: "absolute",
            inset: 0,
            // 몸과 착용물은 여기 하나에서만 움직인다(ART-04).
            animation: float && !reducedMotion ? "heroBeeFloat 3s ease-in-out infinite" : undefined,
            transformOrigin: "50% 70%",
          }}
        >
          {floating.map((l) => (
            <LayerImage key={layerKey(l)} layer={l} onError={onLayerError} />
          ))}
        </div>
      )}
    </div>
  );
}

function layerKey(l: RenderLayer): string {
  return `${l.kind}:${l.assetId}`;
}

function LayerImage({ layer, onError }: { layer: RenderLayer; onError: (assetId: string) => void }) {
  // 배포용 파생본(WebP) 을 먼저 쓰고, 없으면 원본 PNG, 그래도 실패하면 기존
  // 폴백(plan 의 assetId 실패 처리)으로 넘긴다. 레이어 박스는 그대로라
  // data-plan-box 검증(scripts/shot-character.mjs)에도 영향이 없다.
  const [useOriginal, setUseOriginal] = useState(false);
  const src = useOriginal
    ? layer.src
    : optimizedSrc(layer.src, pickWidth(layer.width, [...LADDERS.stickers]));
  return (
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-layer-kind={layer.kind}
      data-layer-asset={layer.assetId}
      /** 계산값 검증용(scripts/shot-character.mjs) — 렌더 박스와 3px 이내여야 한다. */
      data-plan-box={`${layer.left},${layer.top},${layer.width},${layer.height}`}
      decoding="async"
      onError={() => {
        if (!useOriginal) { setUseOriginal(true); return; }
        onError(layer.assetId);
      }}
      style={{
        position: "absolute",
        left: layer.left,
        top: layer.top,
        width: layer.width,
        height: layer.height,
        // 박스가 이미 자산 비율대로 계산돼 있으므로 fill 이 곧 contain 이다.
        objectFit: "fill",
        opacity: layer.opacity,
        transform: layer.rotateDeg ? `rotate(${layer.rotateDeg}deg)` : undefined,
        transformOrigin:
          layer.rotateDeg && layer.originX !== undefined && layer.originY !== undefined
            ? `${layer.originX - layer.left}px ${layer.originY - layer.top}px`
            : undefined,
        pointerEvents: "none",
      }}
    />
  );
}

/** 화면에 보일 상태 문구. 실패를 빈 화면으로 두지 않기 위한 것(README §7.3). */
export function planNoticeText(plan: CharacterRenderPlan): string | null {
  if (plan.notice === "decorating") return "장식을 준비하고 있어요";
  if (plan.notice === "asset-missing") return "그림을 불러오지 못했어요";
  return null;
}

// ============================================================
// 옛 3분할 API — BeeVillage(작업 E 소유)가 아직 이 모양으로 쓴다.
// 내부는 전부 위의 CharacterComposite/plan 한 경로다.
// ============================================================

/** 배경(뒤) + 오라(앞) 환경 레이어. */
export function CosmeticFrame({ backdrop, aura }: { backdrop?: BackdropId; aura?: AuraId }) {
  return <CharacterComposite stage="bee" skin="classic" backdrop={backdrop ?? null} aura={aura ?? null} only="environment" float={false} />;
}

/** 몸(+모자). 폴백 체인과 좌표는 plan 이 정한다. */
export function CharacterImage({
  stage,
  skin,
  hat,
  float = true,
}: {
  stage: Stage;
  skin: SkinId;
  hat: HatId;
  float?: boolean;
}) {
  return <CharacterComposite stage={stage} skin={skin} hat={hat} only="body" float={float} />;
}

/**
 * 소지품(held) + 액세서리(acc).
 *
 * 액세서리 좌표는 **실제로 그려진 몸 자산**의 앵커에서 나온다. 그래서 skin/hat
 * 을 같이 받아야 한다 — 넘기지 않으면 classic 으로 가정하며, 색 스킨 화면에서는
 * 위치가 맞지 않을 수 있다(ART-01 이 지적한 바로 그 경우). 작업 E 는
 * CharacterComposite 로 옮기거나 skin/hat 을 넘겨줄 것.
 */
export function AccessoryLayer({
  stage,
  held,
  acc,
  skin = "classic",
  hat = null,
  float = true,
}: {
  stage: Stage;
  held?: HeldId;
  acc?: AccId;
  skin?: SkinId;
  hat?: HatId;
  float?: boolean;
}) {
  return (
    <CharacterComposite stage={stage} skin={skin} hat={hat} held={held ?? null} acc={acc ?? null} only="attachments" float={float} />
  );
}

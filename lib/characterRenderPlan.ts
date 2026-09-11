/**
 * 캐릭터 합성 render plan — 작업 D. **순수 함수만 둔다.**
 * 네트워크·DOM·시계·난수 없음. 같은 입력이면 언제나 같은 plan 이다.
 *
 * 기하 계약(타입·containTransform·anchorToContainer·placeByGrip·sortLayers)은
 * `lib/childUx/renderPlanContract.ts` 가 동결했다. 여기서는 그것을 import 만
 * 하고, 자산 해석(manifest 조회 → 폴백 선택 → 레이어 배치)을 담당한다.
 *
 * 소비처는 CharacterComposite 하나뿐이고, PraiseHive·CosmeticPicker·BeeVillage
 * 는 그 컴포넌트를 통해 **같은 plan** 을 본다(ART-04).
 */
import manifest from "@/public/stickers/manifest-v2.json";
import {
  containTransform,
  anchorToContainer,
  placeByGrip,
  sortLayers,
  type AnchorPoint,
  type CharacterRenderPlan,
  type CharacterRenderProps,
  type ContainTransform,
  type LayerKind,
  type ManifestEntry,
  type PlanStatus,
  type RenderLayer,
} from "@/lib/childUx/renderPlanContract";

/** manifest 레코드에 붙는 감사용 부가 필드. 계약 타입에는 없다. */
export interface ManifestRecord extends ManifestEntry {
  anchorSources: Record<string, string>;
  stage?: string;
  skin?: string;
  hat?: string | null;
  /** anchors.json 이 준 액세서리 기준 폭(자산 폭 대비 %). 없으면 null. */
  accScalePct?: number | null;
  /** anchors.json 이 준 모자 기준 폭(자산 폭 대비 %). 없으면 null. */
  hatScalePct?: number | null;
  /** 같은 단계 기본 자산과의 실루엣 IoU. 앵커 이식 근거. */
  silhouetteIoU?: number | null;
  attachTo?: string;
  grip?: string;
  placement?: string;
}

const RAW = manifest as unknown as { meta: Record<string, unknown>; assets: ManifestRecord[] };

const BY_ID: Map<string, ManifestRecord> = new Map(RAW.assets.map((a) => [a.assetId, a]));

export function getManifestAssets(): ManifestRecord[] {
  return RAW.assets;
}
export function getManifestMeta(): Record<string, unknown> {
  return RAW.meta;
}
export function findAsset(assetId: string): ManifestRecord | undefined {
  return BY_ID.get(assetId);
}

/** Stage 이름 ↔ 자산 키. 계약의 props.stage 는 string 이라 둘 다 받는다. */
const STAGE_KEY: Record<string, string> = {
  egg: "stage-1-egg",
  larva: "stage-2-larva",
  pupa: "stage-3-pupa",
  bee: "stage-4-bee",
  queen: "stage-5-queen",
};
const DEFAULT_STAGE_KEY = STAGE_KEY.bee;

export function stageKeyOf(stage: string): string | null {
  if (STAGE_KEY[stage]) return STAGE_KEY[stage];
  return Object.values(STAGE_KEY).includes(stage) ? stage : null;
}

/**
 * 레이아웃 상수 — **측정값이 아니라 설계 상수**다. 자산 좌표(앵커)와 섞지 말 것.
 * 앵커는 manifest 에, 비율 판단은 여기에 둔다.
 */
export const LAYOUT = {
  /** 액세서리 기준 폭에 곱하는 종류별 보정. 기존 화면에서 시각 조정된 값. */
  accWidthFactor: { glasses: 0.92, scarf: 1.02, necklace: 0.92, cape: 1.35 } as Record<string, number>,
  /** 바닥 소품(held) 높이 = 몸 실루엣 높이 × 이 값. 캐릭터 앞을 가리지 않을 만큼만. */
  heldHeightFraction: 0.28,
  /** 소품과 몸 실루엣 사이 간격(컨테이너 한 변 대비). */
  heldGapFraction: 0.02,
  /** 접지 그림자 폭 = 몸 실루엣 폭 × 이 값. 그림자는 장면당 1개다. */
  shadowWidthFactor: 0.82,
  /** 그림자 높이 = 그림자 폭 × 이 값. */
  shadowAspect: 0.22,
  /** 오라는 컨테이너보다 이만큼 크게 그린다. */
  auraInflate: 0.16,
  /** 배경은 컨테이너보다 이만큼 크게 깔아 모서리 빈틈을 막는다. */
  backdropInflate: 0.08,
} as const;

/** 실패해도 더 불러올 것이 없는 최종 대체 그림(data URI — 네트워크 없음). */
export const PLACEHOLDER_ASSET_ID = "placeholder/bee";
export const PLACEHOLDER_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img">' +
      '<circle cx="60" cy="60" r="44" fill="#FDE68A" stroke="#B45309" stroke-width="4"/>' +
      '<path d="M32 46h56M32 62h56M32 78h44" stroke="#B45309" stroke-width="6" stroke-linecap="round" opacity=".45"/>' +
      "</svg>",
  );

/** 접지 그림자(하나뿐). 방향이 다른 그림자를 레이어마다 더하지 않는다. */
export const SHADOW_ASSET_ID = "shadow/ground";
export const SHADOW_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30">' +
      '<defs><radialGradient id="g"><stop offset="0%" stop-color="#7C4A03" stop-opacity=".34"/>' +
      '<stop offset="65%" stop-color="#7C4A03" stop-opacity=".14"/>' +
      '<stop offset="100%" stop-color="#7C4A03" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="50" cy="15" rx="50" ry="15" fill="url(#g)"/>' +
      "</svg>",
  );

export interface PlanOptions {
  /**
   * 이미 로드에 실패한 자산. 후보당 1회만 시도하기 위해 호출부(컴포넌트)가
   * onError 로 모아 넘긴다. props 가 바뀌면 호출부가 이 집합을 비운다(ART-05).
   */
  failedAssetIds?: ReadonlySet<string>;
}

/** props 의 자산 키 — 이 값이 바뀌면 실패 상태를 리셋해야 한다(ART-05). */
export function characterPropsKey(props: CharacterRenderProps): string {
  return [props.stage, props.skin, props.hat ?? "-", props.held ?? "-", props.acc ?? "-", props.backdrop ?? "-", props.aura ?? "-"].join("|");
}

/** 몸 후보를 README §7.3 순서대로 나열한다. 404 탐색이 아니라 manifest 조회다. */
export function bodyCandidates(props: CharacterRenderProps): { assetId: string; status: PlanStatus }[] {
  const key = stageKeyOf(props.stage);
  const out: { assetId: string; status: PlanStatus }[] = [];
  if (key) {
    const skin = props.skin || "classic";
    const plain = skin === "classic" ? `body/${key}` : `body/${key}+${skin}`;
    if (props.hat) {
      const composite = skin === "classic" ? `body/${key}+classic+${props.hat}` : `body/${key}+${skin}+${props.hat}`;
      out.push({ assetId: composite, status: "composite" });
      // 같은 스킨 원본 + 검증된 모자 오버레이. 몸에 headTop 앵커가 있을 때만
      // 뒤에서 실제로 모자가 붙는다. **다른 스킨의 합성본으로 갈아타지 않는다**(ART-02).
      out.push({ assetId: plain, status: "overlay" });
    }
    out.push({ assetId: plain, status: "plain" });
    // 선택한 스킨 자체가 없을 때만 classic 기본으로 내려간다(ART-02).
    if (skin !== "classic") out.push({ assetId: `body/${key}`, status: "stage-default" });
  }
  out.push({ assetId: `body/${DEFAULT_STAGE_KEY}`, status: "stage-default" });
  return out;
}

function usable(assetId: string, failed: ReadonlySet<string>): ManifestRecord | null {
  if (failed.has(assetId)) return null;
  const a = BY_ID.get(assetId);
  return a && a.approved ? a : null;
}

function contentBox(a: ManifestEntry, t: ContainTransform) {
  const b = a.alphaBounds;
  return {
    left: t.offsetX + b.left * t.scale,
    top: t.offsetY + b.top * t.scale,
    width: (b.right - b.left + 1) * t.scale,
    height: (b.bottom - b.top + 1) * t.scale,
  };
}

function imageLayer(kind: LayerKind, a: ManifestEntry, box: { left: number; top: number; scale: number }): RenderLayer {
  return {
    kind,
    assetId: a.assetId,
    src: a.file,
    left: round(box.left),
    top: round(box.top),
    width: round(a.sourceWidth * box.scale),
    height: round(a.sourceHeight * box.scale),
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** 32bit FNV-1a. plan 비교용 — 암호 용도가 아니다. */
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * props → plan. 부수효과 없음.
 *
 * 폴백 순서(README §7.3): 승인 합성본 → 같은 스킨 원본 + 검증된 모자 오버레이
 * → 같은 스킨 원본(장식 준비) → 기본 stage 원본 → 정적 placeholder.
 */
export function buildCharacterRenderPlan(props: CharacterRenderProps, options: PlanOptions = {}): CharacterRenderPlan {
  const failed = options.failedAssetIds ?? EMPTY_SET;
  const size = props.size > 0 ? props.size : 1;
  const layers: RenderLayer[] = [];
  let notice: CharacterRenderPlan["notice"];

  // ── 환경 레이어: 배경(뒤) / 오라(앞). 몸과 함께 부유시키지 않는다. ──
  const backdrop = props.backdrop ? usable(`backdrop/${props.backdrop}`, failed) : null;
  if (backdrop) {
    const inflate = size * LAYOUT.backdropInflate;
    const box = size + inflate * 2;
    // 배경은 cover — 컨테이너를 덮어야 해서 contain 이 아니다.
    const scale = Math.max(box / backdrop.sourceWidth, box / backdrop.sourceHeight);
    layers.push(
      imageLayer("background", backdrop, {
        left: -inflate + (box - backdrop.sourceWidth * scale) / 2,
        top: -inflate + (box - backdrop.sourceHeight * scale) / 2,
        scale,
      }),
    );
  }

  // ── 몸: 폴백 체인 ─────────────────────────────────────────────────
  let body: ManifestRecord | null = null;
  let status: PlanStatus = "placeholder";
  for (const candidate of bodyCandidates(props)) {
    const a = usable(candidate.assetId, failed);
    if (!a) continue;
    if (candidate.status === "overlay") {
      // 오버레이는 몸의 headTop 과 모자 자체 접점이 둘 다 있을 때만 성립한다.
      const hatAsset = props.hat ? usable(`hat/${props.hat}`, failed) : null;
      if (!a.anchors.headTop || !hatAsset?.anchors.ground) continue;
    }
    body = a;
    status = candidate.status;
    break;
  }

  if (!body) {
    layers.push({
      kind: "body",
      assetId: PLACEHOLDER_ASSET_ID,
      src: PLACEHOLDER_SRC,
      left: round(size * 0.15),
      top: round(size * 0.15),
      width: round(size * 0.7),
      height: round(size * 0.7),
    });
    return finish(props, "placeholder", PLACEHOLDER_ASSET_ID, layers, "asset-missing");
  }

  const t = containTransform(size, size, body.sourceWidth, body.sourceHeight);
  const content = contentBox(body, t);
  layers.push(imageLayer("body", body, { left: t.offsetX, top: t.offsetY, scale: t.scale }));

  // ── 접지 그림자 1개. 몸의 ground 앵커 위에만 놓는다. ───────────────
  if (body.anchors.ground) {
    const g = anchorToContainer(body.anchors.ground, t);
    const w = content.width * LAYOUT.shadowWidthFactor;
    const h = w * LAYOUT.shadowAspect;
    layers.push({
      kind: "environment-shadow",
      assetId: SHADOW_ASSET_ID,
      src: SHADOW_SRC,
      left: round(g.x - w / 2),
      top: round(g.y - h * 0.62),
      width: round(w),
      height: round(h),
    });
  }

  // ── 모자 오버레이(합성본이 없을 때만) ─────────────────────────────
  if (status === "overlay" && props.hat) {
    const hat = usable(`hat/${props.hat}`, failed);
    const headTop = body.anchors.headTop;
    if (hat && headTop && hat.anchors.ground) {
      const hatContentW = (hat.alphaBounds.right - hat.alphaBounds.left + 1);
      const targetW = ((body.hatScalePct ?? 40) / 100) * content.width;
      const q = targetW / hatContentW;
      const { left, top } = placeByGrip(anchorToContainer(headTop, t), hat.anchors.ground.x, hat.anchors.ground.y, q);
      layers.push(imageLayer("hat", hat, { left, top, scale: q }));
    }
  } else if (props.hat && status !== "composite") {
    notice = "decorating";
  }

  // ── 액세서리: 몸에 eyes/neck 앵커가 **있을 때만** 붙인다 ───────────
  if (props.acc) {
    const acc = usable(`acc/${props.acc}`, failed);
    const attachTo: "eyes" | "neck" = props.acc === "glasses" ? "eyes" : "neck";
    const target = body.anchors[attachTo];
    const grip = acc?.anchors[attachTo];
    if (acc && target && grip) {
      const accContentW = acc.alphaBounds.right - acc.alphaBounds.left + 1;
      const factor = LAYOUT.accWidthFactor[props.acc] ?? 1;
      const targetW = ((body.accScalePct ?? 44) / 100) * content.width * factor;
      const q = targetW / accContentW;
      const { left, top } = placeByGrip(anchorToContainer(target, t), grip.x, grip.y, q);
      // 망토는 몸 뒤, 안경·목도리·목걸이는 몸 앞.
      layers.push(imageLayer(props.acc === "cape" ? "cape-back" : "face-accessory", acc, { left, top, scale: q }));
    } else {
      // 앵커가 없으면 **추측해서 붙이지 않는다**. 얼굴을 가리거나 몸을 관통한다.
      notice = notice ?? "decorating";
    }
  }

  // ── 소지품: 손 접점이 없으므로 바닥 소품으로 옆에 세운다 ───────────
  if (props.held) {
    const prop = usable(`held/${props.held}`, failed);
    const ground = body.anchors.ground;
    if (prop && prop.anchors.ground && ground) {
      const pContentW = prop.alphaBounds.right - prop.alphaBounds.left + 1;
      const pContentH = prop.alphaBounds.bottom - prop.alphaBounds.top + 1;
      const q = (content.height * LAYOUT.heldHeightFraction) / pContentH;
      const drawContentW = pContentW * q;
      const gap = size * LAYOUT.heldGapFraction;
      // 몸 실루엣 왼쪽에 세운다. 컨테이너를 벗어나면 왼쪽 끝에 맞춘다.
      const rightEdge = Math.max(drawContentW, content.left - gap);
      const targetX = rightEdge - drawContentW / 2;
      const target: AnchorPoint = { x: targetX, y: anchorToContainer(ground, t).y };
      const { left, top } = placeByGrip(target, prop.anchors.ground.x, prop.anchors.ground.y, q);
      layers.push(imageLayer("held-back", prop, { left, top, scale: q }));
    } else {
      notice = notice ?? "decorating";
    }
  }

  // ── 오라(가장 앞, 포인터 통과) ────────────────────────────────────
  const aura = props.aura ? usable(`aura/${props.aura}`, failed) : null;
  if (aura) {
    const inflate = size * LAYOUT.auraInflate;
    const box = size + inflate * 2;
    const at = containTransform(box, box, aura.sourceWidth, aura.sourceHeight);
    layers.push(imageLayer("aura", aura, { left: -inflate + at.offsetX, top: -inflate + at.offsetY, scale: at.scale }));
  }

  return finish(props, status, body.assetId, layers, notice);
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

function finish(
  props: CharacterRenderProps,
  status: PlanStatus,
  resolvedAssetId: string,
  layers: RenderLayer[],
  notice: CharacterRenderPlan["notice"],
): CharacterRenderPlan {
  const ordered = sortLayers(layers);
  const signature = [
    characterPropsKey(props),
    props.size,
    props.reducedMotion ? "rm" : "-",
    status,
    resolvedAssetId,
    ...ordered.map((l) => `${l.kind}:${l.assetId}:${l.left}:${l.top}:${l.width}:${l.height}`),
  ].join(";");
  return { resolvedAssetId, status, layers: ordered, planHash: hashString(signature), notice };
}

/**
 * 개발 로그용 — 선택한 스킨이 유지되지 않았는지 알려준다(README §7.3).
 * 순수 함수 안에서 console 을 쓰지 않기 위해 판정만 돌려준다.
 */
export function skinWasDowngraded(props: CharacterRenderProps, plan: CharacterRenderPlan): boolean {
  const skin = props.skin || "classic";
  if (skin === "classic") return false;
  return plan.status === "stage-default" || plan.status === "placeholder";
}

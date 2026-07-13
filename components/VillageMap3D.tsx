"use client";

// 🗺 꿀벌 마을 3D 맵 (V3) — docs/꿀벌마을-3D-설계.md §3 씬 스펙.
// three.js 바닐라 + 2.5D 아이소 스프라이트. 이 파일은 반드시 BeeVillage 에서
// next/dynamic(ssr:false) 으로만 로드한다 — three(~600KB)가 메인 번들에
// 박히면 안 됨 (ADR-1).
//
// 핵심 원칙 (ADR 요약):
//   · 에셋은 /village/<id>.png — 로드 실패 시 색 박스 폴백 (ADR-5,
//     디자인팀 에셋이 아직 없어도 씬이 완성돼 보인다).
//   · 벌 빌보드는 CharacterImage 와 동일한 합성본 후보 체인 (호출부가
//     stageImageWithSkinAndHat → … → stageImage 순서로 candidates 전달).
//   · 문패는 canvas 2D 로 plate PNG(또는 단색 판) 위에 이름 합성 →
//     CanvasTexture 캐시 (이름+plate 키).
//   · 성능: pixelRatio ≤ 1.5, 그림자 OFF, invalidate-on-demand 렌더
//     (연속 rAF 금지 — 배터리. 카메라 조작·데이터 갱신 때만 draw).
//   · 조작: OrbitControls(three 패키지 내) — 회전 ±30°, 줌 0.7~2.0×, 팬.
//   · 탭 raycast → onSelect(clientId) → BeeVillage 의 기존 DOM 팝오버.
//     3D 안에 UI 를 만들지 않는다 (3D 는 무대, UI 는 DOM).

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { decoV2ById } from "@/lib/village";

export interface VillagePlot3D {
  id: string;
  name: string;
  isSelf: boolean;
  /** 벌 빌보드 텍스처 후보 (CharacterImage 폴백 체인과 동일 순서) */
  bee: string[];
  /** effectiveHouseV2 결과 — house-* / plate-* / fence-* / yard-* id */
  style: string;
  plate: string;
  fence: string | null;
  yard: (string | null)[];
}

interface Props {
  plots: VillagePlot3D[];
  /** 해금된 공동 시설 id 목록 (facility-fountain → clock → festival 순) */
  facilities: string[];
  onSelect: (clientId: string) => void;
  /** 씬 생성 성공 (첫 프레임) — 부모가 2D 폴백을 내리고 3D 를 보여준다 */
  onReady: () => void;
  /** WebGL 컨텍스트 실패/유실 — 부모가 2D hex 맵으로 폴백 */
  onFail: () => void;
  height?: number;
}

// ── 씬 상수 ──────────────────────────────────────────────────
const CAM_DIST = 50;              // 기준 거리 (줌 1.0×)
const CAM_POLAR = (55 * Math.PI) / 180;  // 아이소 앵글 ≈ 35° 내려다봄
const AZIMUTH_LIMIT = Math.PI / 6;       // 회전 ±30°
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.0;
const PAN_LIMIT = 46;
const GROUND_SIZE = 130;
const GROUND_COLOR = 0x9fdd82;    // 연두 단색 폴백 (ground-meadow 부재 시)
const SKY_COLOR = 0xbfe7fb;

// 색 박스 폴백 기본색 (카탈로그 color 가 없을 때)
const FALLBACK_COLOR = 0xd9a441;

/** 나선 배치 — 결정적 (호출부가 이름순으로 정렬해 전달). Vogel 스파이럴:
 *  이웃 간격 ≈ c, 중앙(광장)을 비워두려고 base 반경을 더한다. */
function plotPosition(i: number): { x: number; z: number } {
  const r = 9 + 6 * Math.sqrt(i);
  const th = i * 2.39996322972865; // 황금각
  return { x: r * Math.cos(th), z: r * Math.sin(th) };
}

function colorOf(id: string | null | undefined): number {
  const hex = id ? decoV2ById(id)?.color : null;
  if (!hex) return FALLBACK_COLOR;
  return parseInt(hex.replace("#", ""), 16);
}

// ── 텍스처/이미지 캐시 ────────────────────────────────────────
type TexEntry =
  | { status: "loading"; waiters: Array<(tex: THREE.Texture | null) => void> }
  | { status: "ok"; tex: THREE.Texture }
  | { status: "err" };

type ImgEntry =
  | { status: "loading"; waiters: Array<(img: HTMLImageElement | null) => void> }
  | { status: "ok"; img: HTMLImageElement }
  | { status: "err" };

export default function VillageMap3D({
  plots,
  facilities,
  onSelect,
  onReady,
  onFail,
  height = 440,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  // 콜백은 ref 로 우회 — 씬을 다시 만들지 않는다 (GlobeQuest 패턴)
  const onSelectRef = useRef(onSelect);
  const onReadyRef = useRef(onReady);
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onReadyRef.current = onReady;
    onFailRef.current = onFail;
  });

  // 씬 핸들 (마운트 1회 생성)
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const plotsGroupRef = useRef<THREE.Group | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const texCacheRef = useRef<Map<string, TexEntry>>(new Map());
  const imgCacheRef = useRef<Map<string, ImgEntry>>(new Map());
  const plateTexCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());
  const aliveRef = useRef(false);
  // 재빌드 세대 — 늦게 도착한 텍스처 콜백이 옛 플롯을 만지지 않게
  const genRef = useRef(0);

  // ── 텍스처 로더 (캐시 + 실패 기억) ─────────────────────────
  function getTexture(url: string, cb: (tex: THREE.Texture | null) => void) {
    const cache = texCacheRef.current;
    const hit = cache.get(url);
    if (hit) {
      if (hit.status === "ok") return cb(hit.tex);
      if (hit.status === "err") return cb(null);
      hit.waiters.push(cb);
      return;
    }
    const entry: TexEntry = { status: "loading", waiters: [cb] };
    cache.set(url, entry);
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const waiters = entry.status === "loading" ? entry.waiters : [];
        cache.set(url, { status: "ok", tex });
        waiters.forEach((w) => w(tex));
      },
      undefined,
      () => {
        const waiters = entry.status === "loading" ? entry.waiters : [];
        cache.set(url, { status: "err" });
        waiters.forEach((w) => w(null));
      },
    );
  }

  /** 문패 합성용 원본 이미지 (canvas 에 그려야 해서 Texture 가 아니라 Image) */
  function getImage(url: string, cb: (img: HTMLImageElement | null) => void) {
    const cache = imgCacheRef.current;
    const hit = cache.get(url);
    if (hit) {
      if (hit.status === "ok") return cb(hit.img);
      if (hit.status === "err") return cb(null);
      hit.waiters.push(cb);
      return;
    }
    const entry: ImgEntry = { status: "loading", waiters: [cb] };
    cache.set(url, entry);
    const img = new Image();
    img.onload = () => {
      const waiters = entry.status === "loading" ? entry.waiters : [];
      cache.set(url, { status: "ok", img });
      waiters.forEach((w) => w(img));
    };
    img.onerror = () => {
      const waiters = entry.status === "loading" ? entry.waiters : [];
      cache.set(url, { status: "err" });
      waiters.forEach((w) => w(null));
    };
    img.src = url;
  }

  /** 문패 캔버스 텍스처 — plate PNG(또는 단색 판) 위에 이름 합성. 캐시 키 = 이름+plate. */
  function getPlateTexture(
    name: string,
    plateId: string,
    cb: (tex: THREE.CanvasTexture) => void,
  ) {
    const key = `${plateId}|${name}`;
    const cached = plateTexCacheRef.current.get(key);
    if (cached) return cb(cached);
    getImage(`/village/${plateId}.png`, (img) => {
      // 이미지 해석(성공/실패) 후에 한 번만 그린다 — 키당 텍스처 1개
      const again = plateTexCacheRef.current.get(key);
      if (again) return cb(again);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 100;
      const ctx = canvas.getContext("2d")!;
      if (img) {
        ctx.drawImage(img, 0, 0, 256, 100);
      } else {
        // 폴백 단색 판 (라운드 사각형 + 테두리)
        const hex = decoV2ById(plateId)?.color ?? "#FDE68A";
        ctx.fillStyle = hex;
        ctx.strokeStyle = "rgba(69,43,18,0.45)";
        ctx.lineWidth = 6;
        const r = 22;
        ctx.beginPath();
        ctx.moveTo(r + 4, 4);
        ctx.arcTo(252, 4, 252, 96, r);
        ctx.arcTo(252, 96, 4, 96, r);
        ctx.arcTo(4, 96, 4, 4, r);
        ctx.arcTo(4, 4, 252, 4, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // 이름 텍스트 (한글 시스템 폰트) — 판 폭에 맞춰 축소
      let size = 44;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      do {
        ctx.font = `900 ${size}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
        size -= 2;
      } while (size > 16 && ctx.measureText(name).width > 220);
      ctx.fillStyle = "#452B12";
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 4;
      ctx.strokeText(name, 128, 54);
      ctx.fillText(name, 128, 54);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      plateTexCacheRef.current.set(key, tex);
      cb(tex);
    });
  }

  // ── 스프라이트/박스 헬퍼 ─────────────────────────────────────
  /** 색 박스를 즉시 놓고, 텍스처가 도착하면 스프라이트로 교체 (ADR-5). */
  function spriteWithBoxFallback(opts: {
    parent: THREE.Group;
    url: string;
    w: number;               // 스프라이트 폭(월드)
    h: number;               // 스프라이트 높이
    x: number;
    z: number;
    color: number;
    boxSize: [number, number, number];
    gen: number;
  }) {
    const { parent, url, w, h, x, z, color, boxSize, gen } = opts;
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    parent.add(holder);
    const boxGeo = new THREE.BoxGeometry(boxSize[0], boxSize[1], boxSize[2]);
    const boxMat = new THREE.MeshLambertMaterial({ color });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.y = boxSize[1] / 2;
    holder.add(box);
    getTexture(url, (tex) => {
      if (!aliveRef.current || gen !== genRef.current) return;
      if (!tex) return; // 색 박스 유지
      holder.remove(box);
      boxGeo.dispose();
      boxMat.dispose();
      const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.04 });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(w, h, 1);
      sprite.position.y = h / 2;
      holder.add(sprite);
      requestRenderRef.current();
    });
    return holder;
  }

  // ── 씬 생성 (마운트 1회) ─────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    aliveRef.current = true;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      onFailRef.current(); // WebGL 컨텍스트 생성 실패 → 2D 폴백
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = false; // 그림자 OFF (ADR-2)
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.borderRadius = "16px";
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_COLOR);

    const camera = new THREE.PerspectiveCamera(45, 1, 1, 600);
    camera.position.set(
      0,
      CAM_DIST * Math.cos(CAM_POLAR),
      CAM_DIST * Math.sin(CAM_POLAR),
    );

    // invalidate-on-demand — 연속 rAF 금지. 조작/텍스처 도착/구독 갱신 때만.
    let renderQueued = false;
    let disposed = false;
    const requestRender = () => {
      if (renderQueued || disposed) return;
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        if (disposed) return;
        renderer.render(scene, camera);
      });
    };
    requestRenderRef.current = requestRender;

    // 컨텍스트 유실 → 2D 폴백
    const onContextLost = (e: Event) => {
      e.preventDefault();
      onFailRef.current();
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    // 지면 — ground-meadow 텍스처 (없으면 연두 단색)
    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
    const groundMat = new THREE.MeshLambertMaterial({ color: GROUND_COLOR });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    getTexture("/village/ground-meadow.png", (tex) => {
      if (!aliveRef.current || !tex) return;
      const t = tex.clone(); // 타일링 설정이 다른 사용처에 새지 않게 클론
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(5, 5);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      groundMat.map = t;
      groundMat.color.set(0xffffff);
      groundMat.needsUpdate = true;
      requestRender();
    });

    // 마을 광장 바닥 (중앙 플롯 표시)
    const plazaGeo = new THREE.CircleGeometry(6.5, 40);
    const plazaMat = new THREE.MeshLambertMaterial({ color: 0xf5e2a6 });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    scene.add(plaza);

    // 조명 — ambient + directional 1개씩, 그림자 없음 (§3)
    scene.add(new THREE.AmbientLight(0xffffff, 1.05));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(60, 100, 40);
    scene.add(sun);

    // 플롯 컨테이너 (데이터 갱신 시 통째로 재빌드)
    const plotsGroup = new THREE.Group();
    scene.add(plotsGroup);
    plotsGroupRef.current = plotsGroup;

    // 컨트롤 — 고정 아이소 앵글, 회전 ±30°, 줌 0.7~2.0×, 팬 (터치 우선)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; // damping 은 연속 rAF 필요 — invalidate 렌더와 상충
    controls.target.set(0, 1, 0);
    controls.minPolarAngle = CAM_POLAR;
    controls.maxPolarAngle = CAM_POLAR;
    controls.minAzimuthAngle = -AZIMUTH_LIMIT;
    controls.maxAzimuthAngle = AZIMUTH_LIMIT;
    controls.minDistance = CAM_DIST / ZOOM_MAX;
    controls.maxDistance = CAM_DIST / ZOOM_MIN;
    controls.enablePan = true;
    controls.screenSpacePanning = false; // 지면을 따라 팬
    const onControlsChange = () => {
      // 팬 클램프 — 마을 밖으로 나가지 않게
      const t = controls.target;
      t.x = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, t.x));
      t.z = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, t.z));
      t.y = 1;
      requestRender();
    };
    controls.addEventListener("change", onControlsChange);
    controls.update();

    // 리사이즈 (부모가 로드 전 height:0 으로 숨겨두는 경우 포함)
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w < 2 || h < 2) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    // 탭 → raycast → 학생 팝오버 (8px 이내 이동만 클릭으로 인정)
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 8) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(plotsGroup.children, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          const id = obj.userData?.clientId as string | undefined;
          if (id) {
            onSelectRef.current(id);
            return;
          }
          obj = obj.parent;
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;

    // 첫 프레임 (색 박스만으로도 완성된 씬) → 부모에 준비 완료 통지
    requestRender();
    onReadyRef.current();

    return () => {
      aliveRef.current = false;
      disposed = true;
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.removeEventListener("change", onControlsChange);
      controls.dispose();
      // 씬 전체 dispose (geometry/material) — 텍스처 캐시는 별도 정리
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      texCacheRef.current.forEach((e) => {
        if (e.status === "ok") e.tex.dispose();
      });
      texCacheRef.current.clear();
      plateTexCacheRef.current.forEach((t) => t.dispose());
      plateTexCacheRef.current.clear();
      imgCacheRef.current.clear();
      if (groundMat.map) groundMat.map.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      plotsGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 플롯 빌드 (구독 갱신 때마다 재구성 → requestRender) ─────────
  useEffect(() => {
    const group = plotsGroupRef.current;
    if (!group || !sceneRef.current) return;
    const gen = ++genRef.current;

    // 이전 플롯 정리 — geometry/material 만 (텍스처는 공유 캐시라 유지)
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    }

    // 중앙: 공동 시설 (해금 순서대로 광장에 배치)
    facilities.forEach((fid, i) => {
      const n = facilities.length;
      const fx = (i - (n - 1) / 2) * 4.4;
      spriteWithBoxFallback({
        parent: group,
        url: `/village/${fid}.png`,
        w: 3.6,
        h: 3.6,
        x: fx,
        z: 0,
        color: 0x8ec9e8,
        boxSize: [2.4, 2.6, 2.4],
        gen,
      });
    });

    // 학생 플롯 — 나선 배치 (호출부가 이름순 정렬 = 결정적 순서)
    plots.forEach((plot, i) => {
      const { x, z } = plotPosition(i);
      const plotGroup = new THREE.Group();
      plotGroup.position.set(x, 0, z);
      plotGroup.userData.clientId = plot.id;
      group.add(plotGroup);

      // 내 집 표시 — 금색 바닥 링
      if (plot.isSelf) {
        const ringGeo = new THREE.RingGeometry(3.1, 3.7, 36);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.04;
        plotGroup.add(ring);
      }

      // 집 (style 통짜 스프라이트)
      spriteWithBoxFallback({
        parent: plotGroup,
        url: `/village/${plot.style}.png`,
        w: 3.8,
        h: 3.8,
        x: 0,
        z: 0,
        color: colorOf(plot.style),
        boxSize: [2.6, 2.2, 2.6],
        gen,
      });

      // 벌 빌보드 — 합성본 후보 체인 순서대로 시도, 전부 실패 시 노란 박스
      const tryBee = (idx: number) => {
        if (idx >= plot.bee.length) {
          const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
          const mat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 });
          const cube = new THREE.Mesh(geo, mat);
          cube.position.set(0, 4.6, 0);
          plotGroup.add(cube);
          requestRenderRef.current();
          return;
        }
        getTexture(plot.bee[idx], (tex) => {
          if (!aliveRef.current || gen !== genRef.current) return;
          if (!tex) return tryBee(idx + 1);
          const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.04 });
          const sprite = new THREE.Sprite(mat);
          sprite.scale.set(2.1, 2.1, 1);
          sprite.position.set(0, 4.6, 0);
          plotGroup.add(sprite);
          requestRenderRef.current();
        });
      };
      tryBee(0);

      // 문패 — canvas 이름 합성 텍스처 (집 앞)
      getPlateTexture(plot.name, plot.plate, (tex) => {
        if (!aliveRef.current || gen !== genRef.current) return;
        const mat = new THREE.SpriteMaterial({ map: tex });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2.3, 0.9, 1);
        sprite.position.set(-0.9, 0.6, 2.5);
        plotGroup.add(sprite);
        requestRenderRef.current();
      });

      // 울타리 — 플롯 테두리 (앞 중앙은 대문 자리로 비움)
      if (plot.fence) {
        const F = 3.0;
        const spots: Array<[number, number]> = [
          [-F, -F], [0, -F], [F, -F],   // 뒤
          [-F, 0], [F, 0],              // 좌우
          [-F, F], [F, F],              // 앞 모서리
        ];
        for (const [fx, fz] of spots) {
          spriteWithBoxFallback({
            parent: plotGroup,
            url: `/village/${plot.fence}.png`,
            w: 1.7,
            h: 1.1,
            x: fx,
            z: fz,
            color: colorOf(plot.fence),
            boxSize: [1.5, 0.8, 0.25],
            gen,
          });
        }
      }

      // 마당 슬롯 3 — 집 좌/우/앞 고정 오프셋 (§3)
      const yardSpots: Array<[number, number]> = [
        [-2.3, 1.2],
        [2.3, 1.2],
        [1.5, 2.7],
      ];
      plot.yard.forEach((itemId, yi) => {
        if (!itemId || yi > 2) return;
        const [yx, yz] = yardSpots[yi];
        spriteWithBoxFallback({
          parent: plotGroup,
          url: `/village/${itemId}.png`,
          w: 1.7,
          h: 1.7,
          x: yx,
          z: yz,
          color: colorOf(itemId),
          boxSize: [1.1, 1.1, 1.1],
          gen,
        });
      });
    });

    requestRenderRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plots, facilities]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height, borderRadius: 16, overflow: "hidden" }}
    />
  );
}

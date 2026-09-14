"use client";

// 🌍 다문화 지구본 — 게임룸용.
// 모드 2개:
//   📖 공부하기 — 자유 탐험. 랜드마크 탭 → 국기·나라이름·인사말 카드 + TTS.
//   ⚡ 게임하기 — "빠르게 그 나라 찾기". 제시된 나라를 지구본에서 찾아 탭.
// 지원하는 15개 나라를 방 설정과 무관하게 전부 표시한다.
//
// three.js(~600KB)는 GameRoom 에서 next/dynamic 으로 이 컴포넌트째 지연 로드.

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLOBE_COUNTRIES, globeCountryName, flagUrlFor, type GlobeCountry } from "@/lib/globeData";
import { LANGUAGES } from "@/lib/constants";
import { pickN } from "@/lib/gameData";
import { playSequence, playTone } from "@/lib/gameSfx";
import { cancelSpeak, speak } from "@/lib/ttsMulti";
import ScopedStyle from "../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../ui/game/GameHeader";

const GLOBE_R = 100;
const QUIZ_ROUNDS = 8;

// 효과음은 공유 싱글턴 컨텍스트(lib/gameSfx)만 쓴다 — new AudioContext 금지.
// 연속음도 컴포넌트에서 window.setTimeout 을 직접 잡지 않고 playSequence 에 맡긴다.
const sfx = {
  ok: () => playSequence([
    { freq: 659, durationMs: 130, delayMs: 0,   type: "sine", volume: 0.18 },
    { freq: 880, durationMs: 200, delayMs: 110, type: "sine", volume: 0.2 },
  ]),
  // 오답은 경고음이 아니라 '다시 해보자' 는 부드러운 낮은 음 하나 (README §3-5).
  again: () => playTone(392, 160, "sine", 0.12),
  win: () => playSequence([
    { freq: 523, durationMs: 140, delayMs: 0,   type: "triangle", volume: 0.2 },
    { freq: 659, durationMs: 140, delayMs: 130, type: "triangle", volume: 0.2 },
    { freq: 784, durationMs: 300, delayMs: 260, type: "triangle", volume: 0.22 },
  ]),
};

/**
 * 음성 정리 — lib/ttsMulti 의 cancelSpeak 을 감싼다(그 파일은 수정하지 않는다).
 * 새 인사말을 읽기 전과 화면을 떠날 때 이 함수를 반드시 부른다.
 */
function stopSpeak(): void {
  cancelSpeak();
}

/** 이전 음성을 멈춘 뒤 새 인사말을 읽는다. */
function say(text: string, lang: string): void {
  stopSpeak();
  void speak(text, lang);
}

/** 위도/경도 → three.js 좌표 (SphereGeometry 등장방형 UV 기준 표준 변환) */
function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

// ============================================================
// 3D 캔버스 — 모드와 무관한 공용 지구본 씬
// ============================================================

// U11 — 구체가 stage 짧은 변 대비 차지할 목표 비율. 78~86% 범위의 중간값.
// (07_지구본_크기와반응형_수정.md §렌더와 카메라 계약)
const GLOBE_TARGET_FRACTION = 0.82;
// 마커(핀 스프라이트) 외곽이 화면 밖으로 잘리지 않도록 두는 상한 — 이 값을
// 넘기면서까지 GLOBE_TARGET_FRACTION 을 강제하지 않는다(마커를 잘라 비율만
// 맞추는 것은 불합격 — 07 인수조건).
const MARKER_SAFE_FRACTION = 0.985;
// 핀 스프라이트가 실제로 도달하는 구 중심 기준 최대 반지름 근사치
// (핀 위치 GLOBE_R*1.13 + 스프라이트 절반 대각선 폭 여유).
const MARKER_OUTER_R = GLOBE_R * 1.13 + 9;

/**
 * 목표 비율 f 로 구를 담기 위한 카메라 거리. w/h 중 더 짧은 변 쪽의 half-FOV
 * (가로 FOV 는 aspect 로부터 유도)를 기준으로 삼는다 — "가로/세로 FOV 중
 * 제한되는 쪽으로 fit distance 를 계산" (07 계약). 구 실루엣의 각반지름은
 * asin(R/d) — 평면 근사(atan)가 아니라 실제 구 투영 공식으로 역산한다:
 *   목표 화면비 f = tan(asin(R/d)) / tanHalf  →  d = R·√(1+C²)/C, C = f·tanHalf
 */
function fitDistanceForFraction(R: number, f: number, w: number, h: number, tanHalfVFov: number): number {
  const tanHalf = w >= h ? tanHalfVFov : tanHalfVFov * (w / h);
  const C = f * tanHalf;
  return R * Math.sqrt(1 + C * C) / C;
}

function GlobeCanvas({ onPick, auditPins }: {
  onPick: (c: GlobeCountry) => void;
  /**
   * fixture 전용 — 핀(THREE.Sprite)의 **현재 화면 좌표**를 window 에 노출한다.
   * 값을 주지 않으면(실제 게임룸) 아무것도 달지 않는다.
   *
   * 왜 필요한가: 퀴즈의 유일한 입력이 3D 핀 레이캐스트라, 감사 스크립트가
   * "지금 그 나라를 누르려면 화면 어디를 눌러야 하는가"를 컴포넌트 밖에서
   * 알 방법이 없었다. 좌표를 찍어 맞을 때까지 누르면 오답이 기록되어 점수가
   * 매번 달라진다(= 재현 불가). 여기서 노출하는 것은 **조준점뿐**이고,
   * 정답 판정·점수·시간은 전부 제품 코드가 그대로 정한다 — 누르는 것도
   * 감사 스크립트가 실제 pointerdown/up 으로 누른다.
   */
  auditPins?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // onPick 이 바뀌어도 씬을 다시 만들지 않도록 ref 로 우회
  const onPickRef = useRef(onPick);
  useEffect(() => { onPickRef.current = onPick; });
  // 마운트 시점의 값으로 고정한다(fixture 가 정적으로 넘긴다).
  const auditPinsRef = useRef(auditPins);

  useEffect(() => {
    const mount = mountRef.current;
    // U11: 실측 결과 mount 자신의 `height:100%` 는 부모(.gq-stage)의 높이가
    // flex 로만 결정되는 상황에서 신뢰할 수 없었다(집계: 445px 인 stage 안에서
    // mount.clientHeight 가 canvas 의 브라우저 기본 크기인 150px 로 굳어버림 —
    // canvas 를 붙인 뒤 첫 resize() 가 그 150px 을 그대로 읽어 고착시켰다).
    // 그래서 mount 는 CSS 로 position:absolute+inset:0 를 쓰고(styleGQ_CSS 의
    // .gq-stage{position:relative}), 크기는 항상 부모 .gq-stage 를 직접
    // ResizeObserver 로 재서 구한다 — mount 자신의 computed height 를 믿지 않는다.
    const stageEl = mount?.parentElement ?? null;
    if (!mount || !stageEl) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
    const vFovHalf = (camera.fov * Math.PI) / 180 / 2;
    const tanHalfVFov = Math.tan(vFovHalf);
    // 카메라 시선각(원점에서 살짝 위) — 기존 (0,60,320) 과 동일한 방향을
    // 거리만 새로 계산해 유지한다.
    const viewDir = new THREE.Vector3(0, 60, 320).normalize();
    let fitDistance = 320; // 최초 유효 측정 전 임시값 — 아래에서 즉시 갱신됨

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    let hasValidSize = false;
    let userAdjusted = false; // 사용자가 직접 회전/줌 했으면 resize 로 원위치시키지 않는다

    function computeFitDistance(w: number, h: number): number {
      const dGlobe = fitDistanceForFraction(GLOBE_R, GLOBE_TARGET_FRACTION, w, h, tanHalfVFov);
      const dMarker = fitDistanceForFraction(MARKER_OUTER_R, MARKER_SAFE_FRACTION, w, h, tanHalfVFov);
      // 더 멀리(=더 작게) 떨어뜨리는 쪽이 "제한되는 쪽" — 마커가 잘리는 쪽은
      // 절대 택하지 않는다. 목표 78~86% 를 못 채우게 되면 그 사실은 실측으로 보고한다.
      return Math.max(dGlobe, dMarker);
    }

    function applySize(w: number, h: number) {
      if (!(w > 0) || !(h > 0)) { hasValidSize = false; return; } // 0 크기 가드
      hasValidSize = true;
      camera.aspect = w / h;
      fitDistance = computeFitDistance(w, h);
      controls.minDistance = fitDistance * 0.55;
      controls.maxDistance = fitDistance * 2.4;
      if (!userAdjusted) {
        camera.position.copy(viewDir).multiplyScalar(fitDistance);
      }
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    // 최초 위치 — controls 생성 전에 합리적인 기본값을 잡아둔다.
    camera.position.copy(viewDir).multiplyScalar(fitDistance);

    // 별 배경
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(700 + Math.random() * 300);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0.8 }));
    scene.add(stars);

    // 지구
    const texLoader = new THREE.TextureLoader();
    const earthTex = texLoader.load("/globe/earth.jpg", () => setReady(true));
    earthTex.colorSpace = THREE.SRGBColorSpace;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R, 64, 64),
      new THREE.MeshStandardMaterial({ map: earthTex }),
    );
    scene.add(globe);

    // 대기 글로우
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.045, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.16, side: THREE.BackSide }),
    );
    scene.add(glow);

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(300, 150, 200);
    scene.add(sun);

    // 랜드마크 빌보드 + 핀 — 지원하는 15개 나라 전부
    const pinGroup = new THREE.Group();
    scene.add(pinGroup);
    const disposables: Array<{ dispose: () => void }> = [starGeo, earthTex];

    GLOBE_COUNTRIES.forEach((c) => {
      const pos = latLonToVec3(c.lat, c.lon, GLOBE_R);

      const dotGeo = new THREE.SphereGeometry(1.6, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos.clone().multiplyScalar(1.005));
      pinGroup.add(dot);
      disposables.push(dotGeo, dotMat);

      const tex = texLoader.load(c.landmark);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(pos.clone().multiplyScalar(1.13));
      sprite.scale.set(17, 17, 1);
      sprite.userData.country = c;
      pinGroup.add(sprite);
      disposables.push(tex, mat);
    });

    // 컨트롤 — minDistance/maxDistance 는 기기별 고정값이 아니라 applySize 가
    // 매번 계산한 fitDistance 를 기준으로 갱신한다(초기값은 아래 첫 applySize 호출로 설정됨).
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    const onStart = () => {
      userAdjusted = true; // 사용자가 직접 조작한 뒤로는 resize 때 원위치로 덮어쓰지 않는다
      controls.autoRotate = false;
      if (resumeTimer) clearTimeout(resumeTimer);
    };
    const onEnd = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 4000);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    // 최초 실제 치수로 한 번 맞추고, 이후 stage 실제 크기 변화에 ResizeObserver 로 대응한다.
    // window resize 뿐 아니라 정보 패널 열기·부모 grid 재배치·큰 글씨·화면 분할도
    // .gq-stage 자체의 content-box 변화로 잡힌다.
    const initialRect = stageEl.getBoundingClientRect();
    applySize(initialRect.width, initialRect.height);
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      applySize(box.width, box.height);
    });
    ro.observe(stageEl);

    // 탭 → 레이캐스트 (드래그와 구분: 8px 이내 이동만 클릭)
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY }; };
    const onPointerUp = (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 8) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(ndc, camera);
      const sprites = pinGroup.children.filter((o): o is THREE.Sprite => (o as THREE.Sprite).isSprite);
      const hit = ray.intersectObjects(sprites, false)[0];
      if (hit) onPickRef.current(hit.object.userData.country as GlobeCountry);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // ── fixture 전용 조준점 노출 (auditPins 를 넘긴 fixture 에서만) ──────────
    // 각 핀의 화면 좌표와, **그 점을 실제로 눌렀을 때 레이캐스트가 잡는 나라**를
    // 같이 돌려준다(가려졌거나 지구 뒤로 넘어간 핀은 hit 이 달라진다).
    // 판정 로직은 건드리지 않는다 — 여기서 나가는 것은 좌표뿐이다.
    if (auditPinsRef.current) {
      const probeRay = new THREE.Raycaster();
      const probeNdc = new THREE.Vector2();
      const camRight = new THREE.Vector3();
      const camUp = new THREE.Vector3();
      const tmp = new THREE.Vector3();
      (window as unknown as Record<string, unknown>).__globeAuditPins = (code?: string) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const sprites = pinGroup.children.filter((o): o is THREE.Sprite => (o as THREE.Sprite).isSprite);
        const sx = (v: THREE.Vector3) => rect.left + ((v.x + 1) / 2) * rect.width;
        const sy = (v: THREE.Vector3) => rect.top + ((1 - v.y) / 2) * rect.height;
        /** 화면 한 점을 눌렀을 때 제품 레이캐스트가 잡을 나라 (제품과 같은 식). */
        const hitAt = (px: number, py: number) => {
          probeNdc.set(((px - rect.left) / rect.width) * 2 - 1, -((py - rect.top) / rect.height) * 2 + 1);
          probeRay.setFromCamera(probeNdc, camera);
          const h = probeRay.intersectObjects(sprites, false)[0];
          return h ? (h.object.userData.country as GlobeCountry).code : null;
        };
        if (!code) {
          return sprites.map((s) => {
            const v = s.position.clone().project(camera);
            const x = sx(v), y = sy(v);
            return { code: (s.userData.country as GlobeCountry).code, x, y, hit: hitAt(x, y) };
          });
        }
        // 한 나라의 조준점을 찾는다. 핀 스프라이트는 서로 겹치므로(동아시아가
        // 특히 심하다) 중심이 이웃 핀에 가려질 수 있다. 스프라이트의 화면
        // 넓이 안을 격자로 훑어, **눌렀을 때 그 나라가 잡히는** 점 중에서
        // 상하좌우 이웃까지 같은 나라가 잡히는(= 가장자리가 아닌) 점을 고른다.
        const target = sprites.find((s) => (s.userData.country as GlobeCountry).code === code);
        if (!target) return null;
        camRight.setFromMatrixColumn(camera.matrixWorld, 0);
        camUp.setFromMatrixColumn(camera.matrixWorld, 1);
        const pc = tmp.copy(target.position).project(camera).clone();
        const pr = tmp.copy(target.position).addScaledVector(camRight, target.scale.x / 2).project(camera).clone();
        const pu = tmp.copy(target.position).addScaledVector(camUp, target.scale.y / 2).project(camera).clone();
        const cx = sx(pc), cy = sy(pc);
        const hx = Math.max(4, Math.abs(sx(pr) - cx));
        const hy = Math.max(4, Math.abs(sy(pu) - cy));
        const N = 6;
        let best: { x: number; y: number; score: number; d: number } | null = null;
        for (let i = -N; i <= N; i++) {
          for (let j = -N; j <= N; j++) {
            const x = cx + (i / N) * hx * 0.9;
            const y = cy + (j / N) * hy * 0.9;
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
            if (hitAt(x, y) !== code) continue;
            const el = document.elementFromPoint(x, y);
            if (el !== renderer.domElement) continue;
            const pad = Math.max(6, Math.min(hx, hy) / 4);
            let score = 0;
            for (const [dx, dy] of [[pad, 0], [-pad, 0], [0, pad], [0, -pad]]) {
              if (hitAt(x + dx, y + dy) === code) score++;
            }
            const d = Math.hypot(x - cx, y - cy);
            if (!best || score > best.score || (score === best.score && d < best.d)) best = { x, y, score, d };
          }
        }
        return best ? { code, x: best.x, y: best.y, clearance: best.score } : { code, blocked: true };
      };
    }

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      stars.rotation.y += 0.0003;
      if (hasValidSize) renderer.render(scene, camera); // 0 크기일 때 렌더 생략
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      if (resumeTimer) clearTimeout(resumeTimer);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      if (auditPinsRef.current) {
        delete (window as unknown as Record<string, unknown>).__globeAuditPins;
      }
      controls.dispose();
      globe.geometry.dispose();
      (globe.material as THREE.Material).dispose();
      glow.geometry.dispose();
      (glow.material as THREE.Material).dispose();
      (stars.material as THREE.Material).dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // U11: 부모(.gq-stage)의 height:100% 상속을 믿지 않고 absolute+inset:0 로
  // 채운다 — .gq-stage 는 GQ_CSS 에서 position:relative 로 앵커를 제공한다.
  return (
    <div ref={mountRef} style={{ position: "absolute", inset: 0 }}>
      {!ready && (
        <p data-ux-role="body" className="gq-loading">🌍 지구 불러오는 중…</p>
      )}
    </div>
  );
}

// ============================================================
// 게임 컴포넌트
// ============================================================

type Mode = "menu" | "explore" | "quiz";

export default function GlobeQuest({ langA, langB, initialMode, initialCountryCode, auditPins }: {
  langA: string; langB: string;
  /** fixture 전용 — 메뉴를 거치지 않고 특정 모드로 바로 연다. 실제 게임룸은 넘기지 않는다. */
  initialMode?: Mode;
  /**
   * fixture 전용 — 공부하기 모드를 "나라 하나를 이미 고른" 상태로 연다.
   * 정보 패널이 열린 채의 2열 배치를 브라우저로 실측하려면 3D 스프라이트를
   * 레이캐스트로 정확히 눌러야 하는데, 그건 측정 스크립트가 신뢰할 수 있는
   * 경로가 아니다. 실제 게임룸은 이 prop 을 넘기지 않는다.
   */
  initialCountryCode?: string;
  /** fixture 전용 — 게임하기 모드의 핀 조준점을 노출한다(GlobeCanvas 의 auditPins 참고). */
  auditPins?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialMode ?? "menu");

  // 모드를 벗어나거나 화면을 닫으면 읽던 인사말을 반드시 멈춘다.
  useEffect(() => {
    return () => { stopSpeak(); };
  }, []);

  if (mode === "menu") {
    return (
      <div data-ux-root className="gq-root gq-menu">
        <ScopedStyle css={GQ_CSS} />
        <div className="gq-menuhead">
          <div className="gq-bigicon" aria-hidden>🌍</div>
          <h1 data-ux-role="title">다문화 지구본</h1>
          <p data-ux-role="body">
            {GLOBE_COUNTRIES.length}개 나라가 진짜 지구 위에 떠 있어요
          </p>
        </div>
        <div className="gq-modegrid">
          <ModeCard
            emoji="📖"
            title="공부하기"
            sub="지구를 돌려보고, 나라를 눌러 인사말을 들어요"
            onClick={() => setMode("explore")}
          />
          <ModeCard
            emoji="⚡"
            title="게임하기 — 빠르게 그 나라 찾기"
            sub={`제시된 나라를 지구본에서 찾아 탭! ${QUIZ_ROUNDS}라운드`}
            onClick={() => setMode("quiz")}
          />
        </div>
      </div>
    );
  }

  if (mode === "explore") {
    return (
      <ExploreMode
        viewerLang={langA}
        onBack={() => setMode("menu")}
        initialCountryCode={initialCountryCode}
      />
    );
  }
  return <QuizMode viewerLang={langA} friendLang={langB} onBack={() => setMode("menu")} auditPins={auditPins} />;
}

function ModeCard({ emoji, title, sub, onClick }: {
  emoji: string; title: string; sub: string; onClick: () => void;
}) {
  return (
    <button data-ux-role="control" className="gq-modecard" onClick={onClick}>
      <span className="gq-modeemoji" aria-hidden>{emoji}</span>
      <span className="gq-modetext">
        <span data-ux-role="label">{title}</span>
        <span data-ux-role="secondary">{sub}</span>
      </span>
    </button>
  );
}

// ── 공통 셸: 어두운 우주 배경 + 상단 바 + 캔버스 ──
// U11b(07 배치 계약): 지구본을 고르면 뜨는 정보는 이제 stage 를 항상 덮는
// 절대배치 오버레이가 아니라 `panel` 로 받아 .gq-stagewrap 안에서 stage 와
// 정상 흐름으로 나란히 배치한다 — 넓으면 옆(행), 좁으면 아래(열). 이렇게 하면
// 패널이 열릴 때 .gq-stage 자체의 실제 크기(폭 또는 높이)가 줄어들고, 그 변화는
// GlobeCanvas 의 ResizeObserver(같은 .gq-stage 를 관찰)가 그대로 잡아 카메라를
// 다시 fit 한다 — 별도 배선 없이 기존 관찰 대상만으로 해결된다.
// `overlay` 는 여전히 필요하다 — 게임하기 모드의 정오답 토스트(.gq-flashlayer)처럼
// 화면 위를 스치듯 지나가는 알림은 stage 공간을 뺏지 않는 절대배치가 맞다.
function GlobeShell({ topBar, children, overlay, panel, panelPlaceholder }: {
  topBar: React.ReactNode;
  children: React.ReactNode; // GlobeCanvas
  overlay?: React.ReactNode; // 스쳐 지나가는 토스트 — 여전히 절대배치, stage 크기에 영향 없음
  panel?: React.ReactNode; // 상시 정보 패널 — 폭에 따라 stage 옆/아래로 정상 흐름 배치
  /**
   * 2열(가로 넓은 화면)에서 아직 나라를 고르지 않았을 때 **옆 칸을 미리 비워
   * 두기 위한** 안내 문구. 이게 있으면 패널이 열리기 전에도 같은 폭의 칸이
   * 자리를 잡아, 나라를 누른 순간 지구본이 1366px → 994px 로 튀며 줄어드는
   * 일이 없어진다(실측: 2열에서 27% 축소 → 0%). 1열(좁은/세로)에서는
   * `.gq-panel[data-empty]` 가 display:none 이라 세로 공간을 먹지 않는다.
   * 정보 패널이 없는 모드(게임하기)는 넘기지 않는다 — 지구본이 전폭을 쓴다.
   */
  panelPlaceholder?: React.ReactNode;
}) {
  return (
    <div data-ux-root className="gq-shell">
      <ScopedStyle css={GQ_CSS} />
      <div className="gq-topbar">{topBar}</div>
      <div className="gq-stagewrap">
        <div className="gq-stage">{children}</div>
        {panel ?? (panelPlaceholder ? (
          <div className="gq-panel" data-empty>
            <p data-ux-role="secondary" className="gq-panelhint">{panelPlaceholder}</p>
          </div>
        ) : null)}
      </div>
      {overlay}
    </div>
  );
}

/* U01: BackButton('← 모드 선택')은 공용 GameHeader 의 왼쪽 뒤로 버튼이 대신한다.
   지구본만 뒤로가 있고 다른 게임에는 없던 상태를 없애는 것이 이번 변경의 요지다. */

// ============================================================
// 📖 공부하기 — 자유 탐험
// ============================================================

function ExploreMode({ viewerLang, onBack, initialCountryCode }: {
  viewerLang: string; onBack: () => void;
  /** fixture 전용 (GlobeQuest 의 같은 이름 prop 참고). 소리는 내지 않는다. */
  initialCountryCode?: string;
}) {
  const [selected, setSelected] = useState<GlobeCountry | null>(
    () => GLOBE_COUNTRIES.find((c) => c.code === initialCountryCode) ?? null,
  );

  useEffect(() => {
    return () => { stopSpeak(); };
  }, []);

  return (
    <GlobeShell
      topBar={
        /* U01 공용 헤더 — 예전에는 이 게임만 '← 모드 선택' 버튼 + 두 줄 글이었다.
           이제 왼쪽 뒤로 / 가운데 게임 이름 / 오른쪽 상태로 다른 게임과 맞춘다. */
        <GameHeader
          gameId="globe"
          title="다문화 지구본"
          icon="🌍"
          onBack={onBack}
          backLabel="모드"
          status={
            <>
              <GameStat icon="📖" label="모드" value="공부하기" tone="key" />
              <GameStat
                icon="🚩"
                label="고른 나라"
                value={selected ? globeCountryName(selected, viewerLang) : "아직 없어요"}
              />
            </>
          }
        />
      }
      panelPlaceholder="🌍 지구본을 돌려 나라를 눌러보세요. 여기에 국기와 인사말이 나와요."
      panel={selected && (
        <div className="gq-panel">
          <div className="gq-card">
            <img className="gq-landmark" src={selected.landmark} alt="" aria-hidden="true" />
            <div className="gq-cardbody">
              <div className="gq-nameline">
                <img className="gq-flag" src={flagUrlFor(selected.code, "w80")} alt="" aria-hidden="true" />
                <span data-ux-role="body-emphasis">{globeCountryName(selected, viewerLang)}</span>
              </div>
              {viewerLang !== "ko" && (
                <span data-ux-role="secondary">{globeCountryName(selected, "ko")}</span>
              )}
              <div className="gq-hellorow">
                <button data-ux-role="control" className="gq-hello" onClick={() => say(selected.hello, selected.lang)}>
                  🔊 {selected.hello}
                </button>
                <span data-ux-role="secondary">{LANGUAGES[selected.lang]?.label}</span>
              </div>
            </div>
            <button data-ux-role="control" className="gq-close" onClick={() => setSelected(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
    >
      <GlobeCanvas
        onPick={(c) => {
          setSelected(c);
          say(c.hello, c.lang);
        }}
      />
    </GlobeShell>
  );
}

// ============================================================
// ⚡ 게임하기 — 빠르게 그 나라 찾기
// ============================================================

function QuizMode({ viewerLang, friendLang, onBack, auditPins }: {
  viewerLang: string; friendLang: string; onBack: () => void;
  /** fixture 전용 (GlobeCanvas 의 같은 이름 prop 참고). */
  auditPins?: boolean;
}) {
  /**
   * 첫 렌더는 **비워 둔다.** 여기서 pickN 을 부르면 서버와 클라이언트가 서로
   * 다른 나라를 뽑아 하이드레이션이 어긋나고, React 가 루트 전체를 클라이언트
   * 렌더로 되돌린다(개발 모드에서는 에러 오버레이가 화면을 덮었다).
   * 실제 문제는 마운트 뒤에 뽑는다.
   */
  const [rounds, setRounds] = useState<GlobeCountry[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [missedFirst, setMissedFirst] = useState(false); // 이번 라운드 오답 여부
  const [flash, setFlash] = useState<{ kind: "ok" | "again"; text: string } | null>(null);
  // 시각도 서버와 클라이언트가 다르다 — 0 으로 시작해 마운트 뒤에 채운다.
  const [startedAt, setStartedAt] = useState(0);
  const [, setTick] = useState(0);
  const [done, setDone] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const lockRef = useRef(false);
  const flashTimer = useRef<number | null>(null);

  // 마운트 뒤 한 번: 이번 판의 문제와 시작 시각을 정한다.
  useEffect(() => {
    setRounds(pickN(GLOBE_COUNTRIES, QUIZ_ROUNDS));
    setStartedAt(Date.now());
  }, []);

  // 경과시간 표시용 틱
  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [done]);

  // unmount: 예약된 플래시 타이머와 읽던 인사말을 모두 정리한다.
  useEffect(() => {
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = null;
      stopSpeak();
    };
  }, []);

  const target = rounds[idx];

  function handlePick(c: GlobeCountry) {
    if (done || lockRef.current || !target) return;
    if (c.code === target.code) {
      lockRef.current = true;
      sfx.ok();
      say(c.hello, c.lang);
      if (!missedFirst) setScore((s) => s + 1);
      setFlash({ kind: "ok", text: `🎉 ${globeCountryName(c, viewerLang)} — ${c.hello}` });
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => {
        setFlash(null);
        lockRef.current = false;
        setMissedFirst(false);
        if (idx + 1 >= rounds.length) {
          setElapsedMs(Date.now() - startedAt);
          setDone(true);
          sfx.win();
        } else {
          setIdx((i) => i + 1);
        }
      }, 1100);
    } else {
      // 오답은 흔들거나 경고음을 내지 않는다 — 어디를 눌렀는지 알려주고 다시 찾게 한다.
      sfx.again();
      setMissedFirst(true);
      setFlash({ kind: "again", text: `🌱 거기는 ${globeCountryName(c, viewerLang)}예요. 한 번 더 찾아볼까요?` });
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 1400);
    }
  }

  function restart() {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = null;
    stopSpeak();
    setRounds(pickN(GLOBE_COUNTRIES, QUIZ_ROUNDS));
    setIdx(0);
    setScore(0);
    setMissedFirst(false);
    setFlash(null);
    setDone(false);
    setElapsedMs(0);
    lockRef.current = false;
  }

  if (done) {
    const sec = Math.round(elapsedMs / 1000);
    return (
      <div data-ux-root className="gq-root gq-result">
        <ScopedStyle css={GQ_CSS} />
        <div className="gq-bigicon" aria-hidden>
          {score === rounds.length ? "🏆" : score >= rounds.length * 0.6 ? "🎉" : "💪"}
        </div>
        <h1 data-ux-role="title">{score} / {rounds.length}</h1>
        <p data-ux-role="body-emphasis" className="gq-time">
          ⏱ {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
        </p>
        <div className="gq-endrow">
          <button data-ux-role="action" className="gq-primary" onClick={restart}>🔁 다시 하기</button>
          <button data-ux-role="control" className="gq-secondary" onClick={onBack}>모드 선택</button>
        </div>
      </div>
    );
  }

  return (
    <GlobeShell
      topBar={
        <>
          {/* U01 공용 헤더 — 점수·시간은 다른 게임과 같은 오른쪽 상태 칩으로.
              찾아야 할 나라(그 판의 물음)는 헤더가 아니라 바로 아래 줄에 남긴다. */}
          <GameHeader
            gameId="globe"
            title="다문화 지구본"
            icon="🌍"
            onBack={onBack}
            backLabel="모드"
            progress={{ value: idx, max: rounds.length }}
            status={
              <>
                <GameStat icon="📍" label="문제" value={`${idx + 1} / ${rounds.length}`} />
                <GameStat icon="⭐" label="점수" value={score} tone="key" />
                {/* 렌더 도중 Date.now() 를 부르면 서버/클라이언트 값이 달라진다.
                    이미 틱으로 갱신되는 elapsedMs 를 쓴다. */}
                <GameStat icon="⏱" label="시간" value={`${Math.floor(elapsedMs / 1000)}s`} />
              </>
            }
          />
          <div className="gq-quizbar">
            <div className="gq-quizask">
              <span data-ux-role="secondary">🔍 이 나라를 찾아 탭!</span>
              <span data-ux-role="body-emphasis">
                {target ? globeCountryName(target, viewerLang) : ""}
                {target && viewerLang !== friendLang && (
                  <span data-ux-role="secondary" className="gq-friendname">
                    {globeCountryName(target, friendLang)}
                  </span>
                )}
              </span>
            </div>
          </div>
        </>
      }
      overlay={flash && (
        <div className="gq-flashlayer">
          <p data-ux-role="body-emphasis" className="gq-flash" data-kind={flash.kind} role="status">
            {flash.text}
          </p>
        </div>
      )}
    >
      <GlobeCanvas onPick={handlePick} auditPins={auditPins} />
    </GlobeShell>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const GQ_CSS = `
.gq-root{
  color: var(--ux-ink);
  width: 100%; max-width: 1100px; margin: 0 auto; box-sizing: border-box;
  padding: var(--ux-space-6) var(--ux-space-4) var(--ux-space-8);
}
.gq-menu, .gq-result{ display: grid; gap: var(--ux-space-4); justify-items: center; text-align: center; }
.gq-menuhead{ display: grid; gap: var(--ux-space-2); justify-items: center; }
.gq-menuhead p, .gq-result p{ margin: 0; }
.gq-bigicon{ font-size: clamp(3.5rem, 14vw, 6rem); line-height: 1; }

/* 넓은 화면에서는 모드 두 장을 나란히 — 세로로 늘린 휴대폰이 되지 않게. */
.gq-modegrid{ display: grid; gap: var(--ux-space-3); width: 100%; grid-template-columns: 1fr; }
@media (min-width: 768px){ .gq-modegrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.gq-modecard[data-ux-role="control"]{
  display: flex; align-items: center; gap: var(--ux-space-4); text-align: left;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 3px solid var(--ux-primary-border); font-family: inherit;
  padding: var(--ux-space-4);
}
.gq-modeemoji{ font-size: var(--ux-font-title); line-height: 1; flex-shrink: 0; }
.gq-modetext{ display: grid; gap: var(--ux-space-1); min-width: 0; }
.gq-modetext [data-ux-role="label"]{ font-weight: 900; }

.gq-time{ background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface); padding: var(--ux-space-2) var(--ux-space-6); }
.gq-endrow{ display: flex; gap: var(--ux-space-3); flex-wrap: wrap; justify-content: center; }
.gq-primary[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}
.gq-secondary[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}

/* ── 지구본 셸 ── */
/* U11: height:100% 이 있어야 .gq-shell 이 부모(GameRoom 의 flex:1/minHeight:0/
   overflow:auto 스테이지)의 실제 남는 높이를 그대로 물려받는다. 이게 없으면
   .gq-shell 은 auto(내용 기준) 높이가 되어 .gq-stage 의 flex:1 이 분배할 여유
   공간이 전혀 생기지 않고, .gq-stage 는 min-height 값 그대로만 받는다 —
   지구본이 화면의 주인공이 아니라 남는 틈에 들어가는 문제의 실측 원인 중 하나. */
/* U11b(07 배치 계약 — 가로/크롬북/노트북은 옆 정보 패널): container-type:inline-size
   로 .gq-shell 자신의 실제 폭을 컨테이너 쿼리 기준으로 삼는다. 뷰포트 폭이 아니라
   이 셸이 실제로 받은 폭으로 판단해야 나중에 다른 작업자가 GameRoom 레이아웃을
   바꿔 셸이 뷰포트보다 좁아져도(예: 사이드바 추가) 옳게 반응한다. */
.gq-shell{
  position: relative; display: flex; flex-direction: column;
  width: 100%; height: 100%; min-height: 0; box-sizing: border-box;
  background: radial-gradient(circle at 50% 40%, #1e1b4b 0%, #0d0b26 70%);
  color: #fff;
  container-type: inline-size;
}
.gq-topbar{ padding: var(--ux-space-3); flex-shrink: 0; }
/* U01: .gq-topinner / .gq-toptext / .gq-back 은 공용 GameHeader 로 대체됐다. */
/* 지구본은 넓은 화면에서 더 크게 본다 — 판을 키우는 쪽이 아이에게 유리하다.
   min-height 는 이제 "목표 크기"가 아니라 저높이/큰 글씨에서도 stage 가 0 으로
   짜부라지지 않게 하는 바닥값이다 — 정상 상황의 실제 크기는 위 .gq-shell 의
   height:100% 를 통해 flex:1 이 분배하는 남는 공간이 결정한다.
   position:relative 는 GlobeCanvas 의 absolute+inset:0 mount 앵커. */
/* U11b: .gq-stage 는 이제 .gq-stagewrap 의 자식이다(예전엔 .gq-shell 의 직계
   자식). .gq-stagewrap 이 기본(좁은 화면 = 태블릿 세로/폭 부족)은 세로로 쌓아
   stage 위·패널 아래를 만들고, 폭이 충분하면(아래 @container) 가로로 바꿔
   stage 옆에 패널을 둔다 — 07 "가로는 옆 패널, 세로는 위·아래" 배치 계약.
   패널이 뜨면 이 컨테이너 안에서 stage 의 실제 폭 또는 높이가 줄어들고, 그 변화는
   GlobeCanvas 의 ResizeObserver(.gq-stage 를 그대로 관찰)가 바로 감지해 카메라를
   다시 fit 한다 — 여기서 새 배선을 추가하지 않는다. */
.gq-stagewrap{
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; gap: var(--ux-space-3);
}
/* 지구본은 넓은 화면에서 더 크게 본다 — 판을 키우는 쪽이 아이에게 유리하다.
   min-height 는 이제 "목표 크기"가 아니라 저높이/큰 글씨에서도 stage 가 0 으로
   짜부라지지 않게 하는 바닥값이다 — 정상 상황의 실제 크기는 .gq-shell 의
   height:100% 를 통해 flex:1 이 분배하는 남는 공간이 결정한다.
   position:relative 는 GlobeCanvas 의 absolute+inset:0 mount 앵커. */
.gq-stage{ position: relative; flex: 1; min-height: clamp(320px, 58svh, 680px); }
.gq-loading{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #C7D2FE; font-weight: 800; }

/* 패널이 stage 위에 상시 덮이지 않게 정상 흐름(아래)에 둔다 — 콘텐츠가 stage
   min-height 바닥값과 합쳐 화면보다 커지면, 이 셸은 스스로 자르지 않고
   바깥(GameRoom 스테이지)의 overflow:auto 가 그대로 스크롤을 허용한다. */
.gq-panel{ flex-shrink: 0; display: flex; justify-content: center; container-type: inline-size; }
/* 빈 칸(아직 나라를 고르기 전)은 1열에서는 아예 없는 것과 같다 — 세로로 쌓이는
   배치에서 안내 문구가 지구본 높이를 먹으면 안 된다. 2열에서만 되살린다. */
.gq-panel[data-empty]{ display: none; }
.gq-panelhint{
  margin: 0; color: #C7D2FE; text-align: center;
  border: 2px dashed rgba(255,255,255,.28); border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-4); width: 100%;
}

/* 폭이 충분하고 **가로가 세로보다 긴** 화면(≈크롬북/노트북/가로 태블릿)이면
   stage 옆에 패널 — 07 "가로/크롬북/노트북은 큰 stage + 옆 정보 패널".
   - 폭 문턱 900px: 800px 같은 분할화면은 이 아래라 계속 위·아래 배치를 쓴다.
   - orientation 은 @media(=뷰포트)로 본다. 세로로 긴 창(예: 1000x1200)에서
     옆 패널을 만들면 stage 가 좁고 길어져 구체가 오히려 작아진다.
   - 폭은 @container 로 본다(=이 셸이 실제로 받은 폭). 나중에 바깥 레이아웃이
     셸을 좁히면 뷰포트가 넓어도 옳게 1열로 돌아간다.
   조건부 그룹 규칙 중첩(@media 안의 @container)은 표준이며 Chrome 105+ 지원. */
@media (orientation: landscape){
  @container (min-width: 900px){
    .gq-stagewrap{ flex-direction: row; align-items: stretch; }
    .gq-stage{ min-width: 0; }
    /* 고정 px 대신 clamp — 좁은 크롬북에서는 패널이 양보해 지구본이 커지고,
       넓은 노트북에서도 360px 을 넘어 읽기 폭만 늘어나지 않는다. */
    .gq-panel{
      width: clamp(260px, 28cqi, 360px); min-height: 0;
      overflow-y: auto; align-items: flex-start;
    }
    .gq-panel[data-empty]{ display: flex; align-items: center; }
  }
}

.gq-quizbar{
  flex: 1; min-width: 0;
  background: var(--ux-surface); color: var(--ux-ink);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2) var(--ux-space-4);
  display: flex; align-items: center; gap: var(--ux-space-3); flex-wrap: wrap;
}
.gq-quizask{ display: grid; gap: var(--ux-space-1); min-width: 0; flex: 1; }
.gq-quizask [data-ux-role="body-emphasis"]{ font-weight: 900; }
.gq-friendname{ margin-left: var(--ux-space-2); }
/* U01: .gq-quizstat(점수·시간)은 공용 GameHeader 의 상태 칩으로 옮겼다. */

.gq-card{
  width: min(560px, 100%);
  background: var(--ux-surface); color: var(--ux-ink);
  border-radius: var(--ux-radius-panel); border: 3px solid var(--ux-primary-border);
  box-shadow: 0 18px 44px rgba(0,0,0,.5);
  padding: var(--ux-space-4);
  display: flex; gap: var(--ux-space-4); align-items: flex-start; flex-wrap: wrap;
}
/* .gq-card 는 자신을 담은 .gq-panel(컨테이너 쿼리)의 실제 폭을 본다 — 옆 패널
   모드(≤360px)에서는 이미지+글 가로 배치가 비좁아 세로로 쌓는다. 아래 배치
   모드에서는 .gq-panel 폭이 곧 stage 전체 폭이라 이 문턱에 걸리지 않고 기존
   가로 배치를 유지한다. */
@container (max-width: 400px){
  .gq-card{ flex-direction: column; align-items: center; text-align: center; }
  .gq-nameline, .gq-hellorow{ justify-content: center; }
}
.gq-landmark{ width: 84px; height: 84px; object-fit: contain; flex-shrink: 0; }
.gq-cardbody{ flex: 1; min-width: 0; display: grid; gap: var(--ux-space-2); }
.gq-nameline{ display: flex; align-items: center; gap: var(--ux-space-2); flex-wrap: wrap; }
.gq-nameline [data-ux-role="body-emphasis"]{ font-weight: 900; }
.gq-flag{ width: 34px; height: auto; border-radius: 4px; flex-shrink: 0; }
.gq-hellorow{ display: flex; align-items: center; gap: var(--ux-space-3); flex-wrap: wrap; }
.gq-hello[data-ux-role="control"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
}
.gq-close[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 800;
  flex-shrink: 0;
}

.gq-flashlayer{
  position: absolute; left: 0; right: 0; bottom: var(--ux-space-6);
  display: flex; justify-content: center; pointer-events: none;
  padding: 0 var(--ux-space-4);
}
.gq-flash{
  margin: 0; max-width: 100%;
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3) var(--ux-space-6);
  font-weight: 900; text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,.4);
}
.gq-flash[data-kind="ok"]{ background: var(--ux-hint-mint); color: var(--ux-ink); border: 3px solid var(--ux-success); }
.gq-flash[data-kind="again"]{ background: var(--ux-surface); color: var(--ux-ink); border: 3px solid var(--ux-primary-border); }
`;

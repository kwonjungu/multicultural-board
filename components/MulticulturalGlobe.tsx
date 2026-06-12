"use client";

// 🌍 다문화 지구본 — 미니 구글어스.
// three.js 로 지구를 그리고, 방 친구들의 나라 위치에 3D 랜드마크
// 빌보드(스프라이트)를 띄운다. 드래그로 회전, 휠/핀치로 줌,
// 랜드마크를 탭하면 국기·나라이름·인사말 카드가 뜨고 TTS 로 들려준다.
//
// 성능 메모: three.js(~600KB)는 이 컴포넌트를 next/dynamic(ssr:false)으로
// 감싸 열 때만 로드한다. 언마운트 시 geometry/texture/renderer 모두 dispose.

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLOBE_COUNTRIES, globeCountryName, flagUrlFor, type GlobeCountry } from "@/lib/globeData";
import { LANGUAGES } from "@/lib/constants";
import { speak } from "@/lib/ttsMulti";

const GLOBE_R = 100;

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

export default function MulticulturalGlobe({
  open, onClose, viewerLang, roomLangs,
}: {
  open: boolean;
  onClose: () => void;
  viewerLang: string;
  roomLangs?: string[];
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<GlobeCountry | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) { setSelected(null); return; }
    const mount = mountRef.current;
    if (!mount) return;

    // 방에 설정된 언어의 나라만 표시 (없으면 전체 15개)
    const langs = roomLangs && roomLangs.length > 0 ? roomLangs : null;
    const countries = langs
      ? GLOBE_COUNTRIES.filter((c) => langs.includes(c.lang))
      : GLOBE_COUNTRIES;
    const shown = countries.length > 0 ? countries : GLOBE_COUNTRIES;

    // === 씬 구성 ===
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
    camera.position.set(0, 60, 320);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    function resize() {
      const w = mount!.clientWidth, h = mount!.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    window.addEventListener("resize", resize);

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

    // 대기 글로우 (뒷면 렌더)
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.045, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.16, side: THREE.BackSide }),
    );
    scene.add(glow);

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(300, 150, 200);
    scene.add(sun);

    // 랜드마크 빌보드 + 위치 핀
    const pinGroup = new THREE.Group();
    scene.add(pinGroup);
    const disposables: Array<{ dispose: () => void }> = [starGeo, earthTex];

    shown.forEach((c) => {
      const pos = latLonToVec3(c.lat, c.lon, GLOBE_R);

      // 핀(점)
      const dotGeo = new THREE.SphereGeometry(1.6, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos.clone().multiplyScalar(1.005));
      pinGroup.add(dot);
      disposables.push(dotGeo, dotMat);

      // 랜드마크 스프라이트 (항상 카메라를 보는 3D 오브젝트)
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

    // === 컨트롤 ===
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 150;
    controls.maxDistance = 480;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    // 사용자가 만지면 자동 회전 잠시 중지
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    const onStart = () => {
      controls.autoRotate = false;
      if (resumeTimer) clearTimeout(resumeTimer);
    };
    const onEnd = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 4000);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    // === 클릭(탭) → 레이캐스트 ===
    // 드래그와 구분: pointerdown 위치에서 8px 이내로 뗀 경우만 클릭으로 간주
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
      if (hit) {
        const c = hit.object.userData.country as GlobeCountry;
        setSelected(c);
        // 탭한 나라 말로 인사 들려주기
        speak(c.hello, c.lang);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // === 루프 ===
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      stars.rotation.y += 0.0003;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      if (resumeTimer) clearTimeout(resumeTimer);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
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
      setReady(false);
    };
  }, [open, roomLangs]);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 480,
      background: "radial-gradient(circle at 50% 40%, #1e1b4b 0%, #0d0b26 70%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          aria-label="지구본 닫기"
          style={{
            width: 44, height: 44, borderRadius: 14,
            border: "2px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.1)", color: "#fff",
            fontSize: 18, fontWeight: 900, cursor: "pointer",
          }}
        >←</button>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", letterSpacing: -0.3 }}>
            🌍 다문화 지구본
          </div>
          <div style={{ fontSize: 12, color: "#A5B4FC", fontWeight: 700, marginTop: 2 }}>
            돌려보고, 친구 나라를 눌러보세요!
          </div>
        </div>
      </div>

      {/* 3D 캔버스 */}
      <div ref={mountRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {!ready && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "#A5B4FC", fontSize: 14, fontWeight: 800,
          }}>
            🌍 지구 불러오는 중…
          </div>
        )}
      </div>

      {/* 국가 카드 */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            display: "flex", justifyContent: "center",
            padding: "0 14px 18px", pointerEvents: "none",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              pointerEvents: "auto",
              width: "min(440px, 100%)",
              background: "#fff", borderRadius: 22,
              border: "3px solid #FDE68A",
              boxShadow: "0 18px 44px rgba(0,0,0,0.5)",
              padding: "16px 18px",
              display: "flex", gap: 14, alignItems: "center",
              animation: "globeCardUp 0.25s ease-out",
            }}
          >
            <img
              src={selected.landmark}
              alt=""
              aria-hidden="true"
              style={{ width: 84, height: 84, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.2))" }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img
                  src={flagUrlFor(selected.code, "w80")}
                  alt=""
                  aria-hidden="true"
                  style={{ width: 30, height: "auto", borderRadius: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }}
                />
                <div style={{ fontSize: 17, fontWeight: 900, color: "#1F2937" }}>
                  {globeCountryName(selected, viewerLang)}
                </div>
              </div>
              {viewerLang !== "ko" && (
                <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700, marginTop: 2 }}>
                  {globeCountryName(selected, "ko")}
                </div>
              )}
              <button
                onClick={() => speak(selected.hello, selected.lang)}
                style={{
                  marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  border: "none", color: "#fff", borderRadius: 99,
                  padding: "8px 16px", fontSize: 15, fontWeight: 900, cursor: "pointer",
                }}
              >
                🔊 {selected.hello}
              </button>
              <span style={{ marginLeft: 8, fontSize: 12, color: "#92400E", fontWeight: 800 }}>
                {LANGUAGES[selected.lang]?.label}
              </span>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="카드 닫기"
              style={{
                alignSelf: "flex-start",
                background: "transparent", border: "none",
                fontSize: 18, fontWeight: 900, color: "#9CA3AF", cursor: "pointer", padding: 2,
              }}
            >✕</button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes globeCardUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

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
import { playTone } from "@/lib/gameSfx";
import { speak } from "@/lib/ttsMulti";

const GLOBE_R = 100;
const QUIZ_ROUNDS = 8;

const sfx = {
  ok: () => { playTone(659, 130, "sine", 0.18); window.setTimeout(() => playTone(880, 200, "sine", 0.2), 110); },
  bad: () => playTone(180, 240, "sawtooth", 0.16),
  win: () => {
    playTone(523, 140, "triangle", 0.2);
    window.setTimeout(() => playTone(659, 140, "triangle", 0.2), 130);
    window.setTimeout(() => playTone(784, 300, "triangle", 0.22), 260);
  },
};

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

function GlobeCanvas({ onPick }: { onPick: (c: GlobeCountry) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // onPick 이 바뀌어도 씬을 다시 만들지 않도록 ref 로 우회
  const onPickRef = useRef(onPick);
  useEffect(() => { onPickRef.current = onPick; });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

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

    // 컨트롤
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 150;
    controls.maxDistance = 480;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
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
    };
  }, []);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", position: "relative" }}>
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
  );
}

// ============================================================
// 게임 컴포넌트
// ============================================================

type Mode = "menu" | "explore" | "quiz";

export default function GlobeQuest({ langA, langB }: { langA: string; langB: string }) {
  const [mode, setMode] = useState<Mode>("menu");

  if (mode === "menu") {
    return (
      <div style={{ padding: "28px 16px 40px", maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 8 }}>🌍</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#1F2937", marginBottom: 6 }}>
          다문화 지구본
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 24 }}>
          {GLOBE_COUNTRIES.length}개 나라가 진짜 지구 위에 떠 있어요
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ModeCard
            emoji="📖" color="#3B82F6" bg="#DBEAFE"
            title="공부하기"
            sub="지구를 돌려보고, 나라를 눌러 인사말을 들어요"
            onClick={() => setMode("explore")}
          />
          <ModeCard
            emoji="⚡" color="#F59E0B" bg="#FEF3C7"
            title="게임하기 — 빠르게 그 나라 찾기"
            sub={`제시된 나라를 지구본에서 찾아 탭! ${QUIZ_ROUNDS}라운드`}
            onClick={() => setMode("quiz")}
          />
        </div>
      </div>
    );
  }

  if (mode === "explore") {
    return <ExploreMode viewerLang={langA} onBack={() => setMode("menu")} />;
  }
  return <QuizMode viewerLang={langA} friendLang={langB} onBack={() => setMode("menu")} />;
}

function ModeCard({ emoji, color, bg, title, sub, onClick }: {
  emoji: string; color: string; bg: string; title: string; sub: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "20px 18px", borderRadius: 22,
        border: `3px solid ${color}`, background: "#fff",
        cursor: "pointer", textAlign: "left",
        boxShadow: `0 8px 22px ${color}33`,
        transition: "transform 0.12s",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <div style={{
        width: 60, height: 60, borderRadius: 18, background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 32, flexShrink: 0,
      }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color }}>{title}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 22, color, fontWeight: 900 }}>›</div>
    </button>
  );
}

// ── 공통 셸: 어두운 우주 배경 + 상단 바 + 캔버스 ──
function GlobeShell({ topBar, children, overlay }: {
  topBar: React.ReactNode;
  children: React.ReactNode; // GlobeCanvas
  overlay?: React.ReactNode;
}) {
  return (
    <div style={{
      height: "100%", minHeight: 480,
      display: "flex", flexDirection: "column",
      background: "radial-gradient(circle at 50% 40%, #1e1b4b 0%, #0d0b26 70%)",
      position: "relative",
    }}>
      <div style={{ padding: "10px 12px", flexShrink: 0 }}>{topBar}</div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      {overlay}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 12,
  border: "2px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.1)", color: "#fff",
  fontSize: 16, fontWeight: 900, cursor: "pointer", flexShrink: 0,
};

// ============================================================
// 📖 공부하기 — 자유 탐험
// ============================================================

function ExploreMode({ viewerLang, onBack }: { viewerLang: string; onBack: () => void }) {
  const [selected, setSelected] = useState<GlobeCountry | null>(null);

  return (
    <GlobeShell
      topBar={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} aria-label="모드 선택으로" style={backBtnStyle}>←</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>📖 지구본 공부하기</div>
            <div style={{ fontSize: 11, color: "#A5B4FC", fontWeight: 700 }}>
              돌려보고, 나라를 눌러보세요!
            </div>
          </div>
        </div>
      }
      overlay={selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            display: "flex", justifyContent: "center",
            padding: "0 14px 16px", pointerEvents: "none",
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
    >
      <GlobeCanvas
        onPick={(c) => {
          setSelected(c);
          speak(c.hello, c.lang);
        }}
      />
    </GlobeShell>
  );
}

// ============================================================
// ⚡ 게임하기 — 빠르게 그 나라 찾기
// ============================================================

function QuizMode({ viewerLang, friendLang, onBack }: {
  viewerLang: string; friendLang: string; onBack: () => void;
}) {
  const [rounds, setRounds] = useState<GlobeCountry[]>(() => pickN(GLOBE_COUNTRIES, QUIZ_ROUNDS));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [missedFirst, setMissedFirst] = useState(false); // 이번 라운드 오답 여부
  const [flash, setFlash] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [, setTick] = useState(0);
  const [done, setDone] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const lockRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 경과시간 표시용 틱
  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [done]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const target = rounds[idx];

  function handlePick(c: GlobeCountry) {
    if (done || lockRef.current || !target) return;
    if (c.code === target.code) {
      lockRef.current = true;
      sfx.ok();
      speak(c.hello, c.lang);
      if (!missedFirst) setScore((s) => s + 1);
      setFlash({ kind: "ok", text: `🎉 ${globeCountryName(c, viewerLang)} — ${c.hello}` });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
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
      sfx.bad();
      setMissedFirst(true);
      setFlash({ kind: "bad", text: `❌ 거긴 ${globeCountryName(c, viewerLang)}! 다시 찾아봐요` });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 1000);
    }
  }

  function restart() {
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
      <div style={{ padding: "36px 16px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>{score === rounds.length ? "🏆" : score >= rounds.length * 0.6 ? "🎉" : "💪"}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#1F2937", marginBottom: 6 }}>
          {score} / {rounds.length}
        </div>
        <div style={{
          display: "inline-block", padding: "10px 22px", marginBottom: 22,
          background: "#FEF3C7", borderRadius: 14,
          fontSize: 15, fontWeight: 800, color: "#92400E",
        }}>
          ⏱ {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={restart} style={{
            background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
            color: "#fff", border: "none", borderRadius: 99,
            padding: "13px 26px", fontSize: 15, fontWeight: 900, cursor: "pointer",
            boxShadow: "0 6px 18px rgba(245,158,11,0.4)",
          }}>🔁 다시 하기</button>
          <button onClick={onBack} style={{
            background: "#fff", color: "#92400E",
            border: "2px solid #FDE68A", borderRadius: 99,
            padding: "13px 22px", fontSize: 15, fontWeight: 900, cursor: "pointer",
          }}>모드 선택</button>
        </div>
      </div>
    );
  }

  return (
    <GlobeShell
      topBar={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} aria-label="모드 선택으로" style={backBtnStyle}>←</button>
          <div style={{
            flex: 1, minWidth: 0,
            background: "rgba(255,255,255,0.95)", borderRadius: 14,
            padding: "8px 14px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#92400E" }}>
                🔍 이 나라를 찾아 탭! ({idx + 1}/{rounds.length})
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#1F2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {target ? globeCountryName(target, viewerLang) : ""}
                {target && viewerLang !== friendLang && (
                  <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 700, marginLeft: 8 }}>
                    {globeCountryName(target, friendLang)}
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#F59E0B", whiteSpace: "nowrap" }}>
              ⭐ {score}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7280", whiteSpace: "nowrap" }}>
              ⏱ {Math.floor((Date.now() - startedAt) / 1000)}s
            </div>
          </div>
        </div>
      }
      overlay={flash && (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 24,
          display: "flex", justifyContent: "center", pointerEvents: "none",
        }}>
          <div style={{
            background: flash.kind === "ok" ? "#ECFDF5" : "#FEF2F2",
            border: `3px solid ${flash.kind === "ok" ? "#10B981" : "#EF4444"}`,
            color: flash.kind === "ok" ? "#065F46" : "#B91C1C",
            borderRadius: 16, padding: "12px 22px",
            fontSize: 15, fontWeight: 900,
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            maxWidth: "90%",
          }}>
            {flash.text}
          </div>
        </div>
      )}
    >
      <GlobeCanvas onPick={handlePick} />
    </GlobeShell>
  );
}

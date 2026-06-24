"use client";

// 배경을 가로질러 날아다니는 꿀벌 장식 레이어 (랜딩·허브 공용).
// 키프레임 beeFlyR / beeFlyL / heroBeeFloat 는 app/layout.tsx 전역 <style> 에 정의됨.

const BEES = [
  { src: "/mascot/bee-cheer.png",     top: "10%", size: 58, dur: 18, delay: 0,  dir: "beeFlyR" },
  { src: "/mascot/bee-welcome.png",   top: "26%", size: 44, dur: 24, delay: 5,  dir: "beeFlyL" },
  { src: "/mascot/bee-celebrate.png", top: "60%", size: 64, dur: 21, delay: 2,  dir: "beeFlyR" },
  { src: "/mascot/bee-think.png",     top: "74%", size: 42, dur: 27, delay: 10, dir: "beeFlyL" },
  { src: "/mascot/bee-loading.png",   top: "88%", size: 50, dur: 20, delay: 7,  dir: "beeFlyR" },
] as const;

export default function FlyingBees() {
  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      {BEES.map((b, i) => (
        <span
          key={i}
          style={{
            position: "absolute", top: b.top, left: 0,
            width: b.size, height: b.size,
            animation: `${b.dir} ${b.dur}s linear ${b.delay}s infinite`,
            willChange: "transform",
          }}
        >
          <img
            src={b.src}
            alt=""
            aria-hidden="true"
            style={{
              width: "100%", height: "100%", objectFit: "contain",
              animation: "heroBeeFloat 2.6s ease-in-out infinite",
              filter: "drop-shadow(0 6px 12px rgba(245,158,11,0.35))",
            }}
          />
        </span>
      ))}
    </div>
  );
}

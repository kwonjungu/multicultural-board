"use client";

/**
 * 배경 안내 꿀벌 — 랜딩 · 입장 · 허브 공용.
 *
 * 예전에는 다섯 마리가 화면을 쉬지 않고 가로질렀다. 읽어야 할 글과 눌러야 할
 * 버튼 위로 계속 무언가 지나가면 아이가 주된 행동을 찾기 어렵고, 움직임에
 * 민감한 아이에게는 그 자체가 방해다. 그래서 기본 화면에서는 **정적인 한
 * 마리 안내자**로 줄였다 (README §4.2).
 *
 * 축하·성공처럼 짧게 끝나는 자리에서 움직이는 연출이 필요하면 그 화면에서
 * 따로 만들고, 이 배경 레이어를 다시 늘리지 말 것.
 */
export default function FlyingBees() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, zIndex: 0,
        pointerEvents: "none", overflow: "hidden",
      }}
    >
      <img
        src="/_opt/mascot/bee-welcome-384.webp"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/mascot/bee-welcome.png"; }}
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          /* 본문 읽기 영역(가운데 패널)을 피해 아래 왼쪽 구석에 앉힌다. */
          left: "clamp(8px, 4vw, 56px)",
          bottom: "clamp(8px, 4vh, 48px)",
          width: 64, height: 64, objectFit: "contain",
          opacity: 0.85,
          filter: "drop-shadow(0 6px 12px rgba(137,83,0,.25))",
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import VillageMap3D, { VillagePlot3D } from "@/components/VillageMap3D";
import { VILLAGE_FACILITIES, WATER_PER_LEVEL } from "@/lib/village";
import { stageImage } from "@/lib/stage";

/**
 * 가짜 마을. 실제 구독 대신 결정적인 학생 배열을 만들어 VillageMap3D 만 띄운다.
 * 감사 스크립트가 draw 횟수를 세도록 WebGLRenderer.render 를 이 파일에서만
 * 감싼다 — 제품 코드에는 계측을 넣지 않는다.
 */
const HOUSES = ["house-hive", "house-castle", "house-mushroom", "house-tent"];
const PLATES = ["plate-wood", "plate-honey", "plate-flower"];
const FENCES = [null, "fence-wood", "fence-flower"];
const YARDS = [
  "yard-tree-honey", "yard-flowerbed-rose", "yard-pond",
  "yard-lamp", "yard-bench", "yard-mailbox", "yard-tree-cherry", "yard-flowerbed-tulip",
];
const LONG_NAME = "응우엔티민카이응우엔티민카이";

if (typeof window !== "undefined") {
  const w = window as unknown as { __villageAudit?: { calls: number; draws: number } };
  if (!w.__villageAudit) {
    w.__villageAudit = { calls: 0, draws: 0 };
    // WebGLRenderer.render 는 프로토타입이 아니라 생성자 안에서 인스턴스에
    // 붙는다(three r184, WebGLRenderer.js:1601) — 프로토타입을 감싸면 한 번도
    // 잡히지 않는다. 대신 render() 가 씬마다 정확히 한 번 부르는
    // scene.onBeforeRender (WebGLRenderer.js:1642) 를 세서 프레임 수를 얻고,
    // 실제 GPU 부담은 drawElements/drawArrays 로 따로 센다.
    const scenePrototype = THREE.Scene.prototype as unknown as {
      onBeforeRender: (...a: unknown[]) => void;
    };
    const originalHook = scenePrototype.onBeforeRender;
    scenePrototype.onBeforeRender = function counted(...args: unknown[]) {
      w.__villageAudit!.calls += 1;
      return originalHook.apply(this, args);
    };
    for (const ctor of [
      typeof WebGL2RenderingContext !== "undefined" ? WebGL2RenderingContext : null,
      typeof WebGLRenderingContext !== "undefined" ? WebGLRenderingContext : null,
    ]) {
      if (!ctor) continue;
      for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
        const proto = ctor.prototype as unknown as Record<string, ((...a: unknown[]) => unknown) | undefined>;
        const original = proto[name];
        if (!original) continue;
        proto[name] = function countedDraw(...args: unknown[]) {
          w.__villageAudit!.draws += 1;
          return original.apply(this, args);
        };
      }
    }
  }
}

export default function VillageFixture({
  n, self, longNames, facilities,
}: { n: number; self: boolean; longNames: boolean; facilities: number }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "on" | "off">("loading");
  // 0번 집에 준 물. 실제 앱에서는 Firebase 트랜잭션이 이 값을 올린다 —
  // 여기서는 "값이 바뀌면 3D 정원이 따라 바뀌는가" 만 본다.
  const [water0, setWater0] = useState(0);
  const level0 = Math.floor(water0 / WATER_PER_LEVEL);

  const plots: VillagePlot3D[] = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        id: `s${i}`,
        name: longNames && i % 5 === 0 ? `${LONG_NAME}${i}` : `학생 ${String(i + 1).padStart(2, "0")}`,
        isSelf: self && i === 0,
        bee: [stageImage(["egg", "larva", "pupa", "bee", "queen"][i % 5] as never)],
        style: HOUSES[i % HOUSES.length],
        plate: PLATES[i % PLATES.length],
        fence: FENCES[i % FENCES.length],
        yard: [YARDS[i % YARDS.length], YARDS[(i + 3) % YARDS.length], null, null],
        // 정원 성장 단계와 받은 물을 골고루 — 0단계 0물 부터 4단계 4물 까지
        gardenLevel: i === 0 ? level0 : i % 5,
        gardenWater: i === 0 ? water0 % WATER_PER_LEVEL : i % WATER_PER_LEVEL,
      })),
    [n, self, longNames, water0, level0],
  );

  useEffect(() => {
    const w = window as unknown as { __villageAudit?: { calls: number; draws: number } };
    if (w.__villageAudit) { w.__villageAudit.calls = 0; w.__villageAudit.draws = 0; }
  }, [plots]);

  return (
    <div data-ux-root style={{ padding: 12, background: "var(--ux-bg)", minHeight: "100vh" }}>
      <p data-ux-role="secondary" style={{ margin: "0 0 8px" }}>
        fixture · 학생 {n}명 · 상태 {state} · 마지막 선택 {picked ?? "없음"}
        {n > 0 && ` · 0번 집 정원 ${level0}단계 · 물 ${water0 % WATER_PER_LEVEL}/${WATER_PER_LEVEL}`}
      </p>
      {n > 0 && (
        <button
          type="button" data-ux-role="control" id="fixture-water"
          onClick={() => setWater0((v) => v + 1)}
          style={{ marginBottom: 8, border: "2px solid var(--ux-primary-border)", background: "var(--ux-surface)" }}
        >💧 0번 집에 물 주기(테스트)</button>
      )}
      {state !== "off" && (
        <VillageMap3D
          plots={plots}
          facilities={VILLAGE_FACILITIES.slice(0, facilities).map((f) => f.id)}
          onSelect={(id) => setPicked(id)}
          onReady={() => setState("on")}
          onFail={() => setState("off")}
        />
      )}
      {state === "off" && <p data-ux-role="body">WebGL 실패 — 부모가 2D 지도로 폴백하는 경로</p>}
    </div>
  );
}

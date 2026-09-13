"use client";

import { useEffect, useState } from "react";
import SetupScreen from "@/components/SetupScreen";
import { LANGUAGES } from "@/lib/constants";
import type { LearnerProfile } from "@/lib/learnerId";
import type { UserConfig } from "@/lib/types";

/** 고정 입력: 지원 언어 전체 + 40명 명단 + 긴 이름. 실명 금지. */
const ROSTER = [
  ...Array.from({ length: 37 }, (_, i) => `학생 ${String(i + 1).padStart(2, "0")}`),
  "아주아주긴이름을가진학생사례",
  "Nguyễn Thị Minh Khai",
  "มานีมีตากลมโต",
];

/** 고정 시각 (HARNESS §2) — 프로필 timestamp 가 캡처마다 흔들리지 않게 한다. */
const T0 = Date.parse("2026-09-11T00:00:00Z");

/**
 * U05 검수용 명렬표 프로필. 이름 목록(roster)은 이 프로필들의 파생 projection 이다.
 *
 * 경계를 일부러 깔았다:
 *  - 학생 01 : 이미 동물을 골라 둔 학생 → 재입장 때 동물 단계를 반복하지 않아야 한다.
 *  - 학생 02 : 아직 안 고른 학생 → 3단계가 나오고 폴백 동물이 미리 보여야 한다.
 *  - 학생 03 : **동명이인 두 명**(learnerId 가 다름) → 이름만으로 누구인지 가를 수
 *              없으므로 learnerId 가 정해지지 않고 '이번에만 쓰는 동물' 안내가 떠야 한다.
 *  - 나머지  : 프로필만 있고 선택 없음.
 */
function buildLearners(): Record<string, LearnerProfile> {
  const out: Record<string, LearnerProfile> = {};
  const add = (learnerId: string, displayName: string, avatarAnimalId?: string) => {
    out[learnerId] = {
      learnerId, displayName, rosterStatus: "active",
      createdAt: T0, updatedAt: T0, version: 1,
      ...(avatarAnimalId ? { avatarAnimalId } : {}),
    };
  };
  add("L-01", "학생 01", "fox");
  add("L-02", "학생 02");
  // 동명이인 — 자동 병합 금지 경계
  add("L-03a", "학생 03");
  add("L-03b", "학생 03");
  ROSTER.forEach((name, i) => {
    if (["학생 01", "학생 02", "학생 03"].includes(name)) return;
    add(`L-x${i}`, name);
  });
  return out;
}

const LEARNERS = buildLearners();

export default function EntryFixture() {
  const [done, setDone] = useState<UserConfig | null>(null);
  const [freeInput, setFreeInput] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFreeInput(q.get("roster") === "off");
  }, []);

  return (
    <>
      <SetupScreen
        key={String(freeInput)}
        roomCode="9999"
        availableLangs={Object.keys(LANGUAGES)}
        roomConfig={
          freeInput
            ? { languages: Object.keys(LANGUAGES), rosterMode: false }
            : {
                languages: Object.keys(LANGUAGES),
                rosterMode: true,
                roster: ROSTER,
                learners: LEARNERS,
              }
        }
        onDone={(u) => { setDone(u); console.log("[fixture] onDone", u); }}
      />
      {/* onDone payload 를 눈으로 확인하기 위한 개발용 표시. 제품 UI 가 아니다. */}
      {done && (
        <pre
          data-fixture-chrome
          style={{
            position: "fixed", right: 8, bottom: 8, zIndex: 9999, margin: 0,
            padding: "8px 12px", borderRadius: 8, background: "#146B49", color: "#fff",
            font: "12px/1.5 monospace", maxWidth: "50vw",
          }}
        >{`onDone: ${JSON.stringify(done, null, 1)}`}</pre>
      )}
    </>
  );
}

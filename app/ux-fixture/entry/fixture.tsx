"use client";

import SetupScreen from "@/components/SetupScreen";
import { LANGUAGES } from "@/lib/constants";

/** 고정 입력: 지원 언어 전체 + 40명 명단 + 긴 이름. 실명 금지. */
const ROSTER = [
  ...Array.from({ length: 37 }, (_, i) => `학생 ${String(i + 1).padStart(2, "0")}`),
  "아주아주긴이름을가진학생사례",
  "Nguyễn Thị Minh Khai",
  "มานีมีตากลมโต",
];

export default function EntryFixture() {
  return (
    <SetupScreen
      roomCode="9999"
      availableLangs={Object.keys(LANGUAGES)}
      roomConfig={{ languages: Object.keys(LANGUAGES), rosterMode: true, roster: ROSTER }}
      onDone={(u) => console.log("[fixture] onDone", u)}
    />
  );
}

"use client";

import HomeHub, { HubLiveActivity } from "@/components/HomeHub";
import { LANGUAGES } from "@/lib/constants";

/**
 * 고정 입력만 쓴다. 실명·운영 방(1111)·실제 명렬표는 절대 넣지 않는다(HARNESS §2).
 * 이름은 긴 번역과 줄바꿈을 함께 보기 위해 일부러 길게 잡았다.
 */
const FAKE_NAME = "학생 07";
const FAKE_TEACHER = "테스트 교사";
const FAKE_ROOM = "9999";

export default function HubFixture({
  role,
  live,
  lang,
}: {
  role: "teacher" | "student";
  live: "storybook" | "whiteboard" | "none";
  lang: string;
}) {
  const activity: HubLiveActivity =
    live === "storybook" ? { kind: "storybook" } : live === "whiteboard" ? { kind: "whiteboard" } : null;

  return (
    <HomeHub
      user={{
        myLang: LANGUAGES[lang] ? lang : "ko",
        myName: role === "teacher" ? FAKE_TEACHER : FAKE_NAME,
        isTeacher: role === "teacher",
        teacherLangs: role === "teacher" ? Object.keys(LANGUAGES) : [],
      }}
      roomCode={FAKE_ROOM}
      availableLangs={Object.keys(LANGUAGES)}
      /* 값을 넘기므로 HomeHub 내부 Firebase 구독이 꺼진다. */
      liveActivity={activity}
      onSelect={(v) => console.log("[fixture] onSelect", v)}
      onLogout={() => console.log("[fixture] onLogout")}
      onChangeLang={(l) => console.log("[fixture] onChangeLang", l)}
    />
  );
}

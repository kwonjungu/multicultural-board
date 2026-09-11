import { notFound } from "next/navigation";
import HubFixture from "./fixture";

/**
 * 홈 허브 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 접근되지 않는다. Firebase 에도
 * 붙지 않는다 — HomeHub 의 '지금 함께할 활동'은 `liveActivity` props 로 주입하고,
 * 그 값을 넘기는 순간 내부 구독이 꺼진다. 여기의 이름·방 번호는 전부 가짜다.
 *
 * 쿼리로 조합을 고른다:
 *   ?role=teacher|student  ?live=storybook|whiteboard|none  ?lang=ko|vi|...
 */
export default function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const pick = (k: string) => {
    const v = searchParams?.[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return (
    <HubFixture
      role={pick("role") === "teacher" ? "teacher" : "student"}
      live={pick("live") === "storybook" ? "storybook" : pick("live") === "whiteboard" ? "whiteboard" : "none"}
      lang={pick("lang") || "ko"}
    />
  );
}

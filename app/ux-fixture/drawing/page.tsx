import { notFound } from "next/navigation";
import DrawingFixture from "./fixture";

/**
 * 그림판(DrawBoard) 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * DrawBoard 는 그 자체로 Firebase/네트워크를 쓰지 않는 순수 캔버스 엔진이라
 * G0 격리는 문제되지 않는다. 이 라우트의 목적은 "빈 캔버스"가 아니라 실제로
 * 그려진 상태를 검수할 수 있게 하는 것 — fixture 로 초기 그림을 심는다.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404.
 *
 * 쿼리: ?role=student|teacher
 *   student = 학생이 그리다 만 상태(진행 중 스케치)
 *   teacher = 다 그린 완성작(교사가 검토할 법한 상태)
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
  return <DrawingFixture teacher={pick("role") === "teacher"} />;
}

import { notFound } from "next/navigation";
import WhiteboardFixturePage from "./fixture";

/**
 * 실시간 화이트보드(WhiteboardRoom) 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404. WhiteboardRoom 에 fixture
 * prop 을 넘기면 Firebase 구독(meta·boards)과 쓰기(prompt·active·snapshot)가
 * 모두 꺼진다.
 *
 * 쿼리: ?role=student|teacher
 *   student = 내 캔버스(그리다 만 상태) + 선생님이 낸 오늘의 주제
 *   teacher = 학생 3명(학생 A/B/C) 그림 갤러리 + 주제 편집 패널
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
  return <WhiteboardFixturePage teacher={pick("role") === "teacher"} />;
}

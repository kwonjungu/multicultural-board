import { notFound } from "next/navigation";
import GameFixture from "./fixture";

/**
 * 게임 화면 시각/치수 검수용 fixture — 개발·테스트 전용 (작업 F).
 *
 * G0 격리(HARNESS §2): production 빌드에서는 접근되지 않는다. Firebase 도
 * 쓰지 않는다 — 게임 컴포넌트는 langA/langB props 만으로 그려지므로 실제
 * 방(1111)이나 명렬표에 연결할 필요가 없고, 연결해서도 안 된다.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <GameFixture />;
}

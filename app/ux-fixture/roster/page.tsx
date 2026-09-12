import { notFound } from "next/navigation";
import RosterFixture from "./fixture";

/**
 * 명렬표 보관·복원(X02) 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리: production 빌드에서는 접근되지 않는다. **Firebase 에 연결하지 않는다** —
 * RosterManager 는 loadImpacts/onApply 를 props 로 받으므로 메모리 저장소만으로
 * 같은 화면이 그려진다. 여기의 이름·기록은 전부 가짜이고, 운영 방(1111)과는
 * 어떤 경로로도 이어져 있지 않다.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RosterFixture />;
}

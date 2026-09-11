import { notFound } from "next/navigation";
import EntryFixture from "./fixture";

/**
 * 입장 화면 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 접근되지 않는다. Firebase 도
 * 쓰지 않는다 — SetupScreen 은 props 만으로 그려지므로 실제 방/명렬표에
 * 연결할 필요가 없고, 연결해서도 안 된다. 여기의 이름은 전부 가짜다.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <EntryFixture />;
}

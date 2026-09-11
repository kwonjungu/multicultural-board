import { notFound } from "next/navigation";
import BoardFixtureScreen from "./fixture";

/**
 * 소통창 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 접근되지 않는다. PadletBoard 는
 * `fixture` prop 이 주어지면 Firebase 를 구독하지도 쓰지도 않고, 카드도 외부
 * API 를 호출하지 않는다. 여기의 이름·글은 전부 가짜이며 운영 방(1111)의
 * 명단이나 게시글을 복제하지 않았다.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BoardFixtureScreen />;
}

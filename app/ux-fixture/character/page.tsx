import { notFound } from "next/navigation";
import CharacterFixture from "./fixture";

/**
 * 캐릭터 합성 시각 검수용 fixture — 개발·테스트 전용 (작업 D).
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404 다. Firebase 를 쓰지 않고
 * 운영 방(1111)의 데이터도 읽지 않는다 — 여기의 꾸밈 조합은 전부 고정 입력이다.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CharacterFixture />;
}

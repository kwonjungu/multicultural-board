import { notFound } from "next/navigation";
import PostFixture from "./fixture";

/**
 * 작성 흐름 시각/실패 주입 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404 다. Firebase 도, 실제 방도,
 * 운영 API 도 쓰지 않는다 — 저장은 주입한 가짜 함수가 받고, /api/* 는 fixture 가
 * 가로채 canned 응답을 돌려준다. 여기 이름·본문은 전부 가짜다.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PostFixture />;
}

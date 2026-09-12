import { notFound } from "next/navigation";
import RecorderFixture from "./fixture";

/**
 * 발음 녹음 화면 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리: production 빌드에서는 접근되지 않는다. **마이크도 네트워크도 쓰지
 * 않는다** — 가짜 RecordingEnv 를 주입해 recorder/STT 를 흉내 내므로 실제
 * 권한 요청도, /api/stt 호출도, Firebase 쓰기도 일어나지 않는다.
 * 운영 방(1111)과는 무관하다.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RecorderFixture />;
}

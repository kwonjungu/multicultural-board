import { notFound } from "next/navigation";
import DiscussionFixturePage, { type DiscussionState } from "./fixture";

/**
 * 의견 나누기(DiscussionSession) 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404. DiscussionSession 에 fixture
 * prop 을 넘기면 meta/responses/presence 구독과 제출·반응·답글·종료·삭제 쓰기가
 * 모두 꺼진다.
 *
 * 쿼리: ?role=student|teacher   ?state=setup|running|result
 *   setup   = 세션 시작 직후 — 응답 0개, 학생은 아직 작성 전(글/그림 작성 화면)
 *   running = 진행 중 — 학생 몇 명이 이미 제출, 실시간 공개(liveReveal) 활성
 *   result  = 종료됨 — 열매나무(FruitTree) 공개 화면
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
  const raw = pick("state");
  const state: DiscussionState =
    raw === "setup" || raw === "running" || raw === "result" ? raw : "running";
  return (
    <DiscussionFixturePage
      state={state}
      teacher={pick("role") === "teacher"}
    />
  );
}

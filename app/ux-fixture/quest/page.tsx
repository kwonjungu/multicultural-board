import { notFound } from "next/navigation";
import QuestFixture from "./fixture";

/**
 * 📋 심부름(일일 퀘스트) 보드 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 접근되지 않는다. Firebase 에도
 * 붙지 않는다 — 표시 전용 QuestBoardView 에 고정 상태를 직접 넘긴다. 운영 방
 * (1111)·실명은 들어가지 않는다.
 *
 * 쿼리로 상태를 고른다:
 *   ?case=mixed      진행 중 + 받을 것 + 지급이 끊긴 것(pending) 섞인 기본 화면
 *   ?case=alldone    셋 다 완료 — 황금 이슬 받기
 *   ?case=rollover   자정을 넘겨 '새로운 하루' + 어제 못 받은 보상
 *   ?case=busy       지급 요청이 날아가 있는 중 (aria-disabled 확인)
 */
export default function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const raw = searchParams?.case;
  const picked = Array.isArray(raw) ? raw[0] : raw;
  const known = ["mixed", "alldone", "rollover", "busy"] as const;
  const scenario = (known as readonly string[]).includes(picked || "") ? (picked as string) : "mixed";
  return <QuestFixture scenario={scenario as (typeof known)[number]} />;
}

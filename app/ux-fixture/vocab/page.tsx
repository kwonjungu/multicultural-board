import { notFound } from "next/navigation";
import VocabFixture, { type VocabState } from "./fixture";

/**
 * 단어 배우기(U07) 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404 다. VocabHub 에 fixture prop 을
 * 넘기는 순간 Firebase 구독·localStorage 진도 쓰기·보상 지급이 전부 꺼진다.
 *
 * 쿼리로 조합을 고른다:
 *   ?state=new|progress|rich   ?lang=ko|vi|en   ?role=student|teacher
 *   new      = 첫 학생(진도 0) — 가짜 이어하기·가짜 달성률이 없어야 한다
 *   progress = 감정 단원 일부 진행
 *   rich     = 진도 + 표현 복습 대기 + 소통창 문장까지 있는 상태
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
  const state: VocabState =
    raw === "new" || raw === "progress" || raw === "rich" ? raw : "progress";
  return (
    <VocabFixture
      state={state}
      lang={pick("lang") || "ko"}
      teacher={pick("role") === "teacher"}
    />
  );
}

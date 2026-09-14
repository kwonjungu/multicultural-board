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
 *   ?open=detail|notebook|write|quiz|review   ?word=<단어 id>
 *   open= 은 하위 학습 화면을 바로 열어 검수하기 위한 것이다 — 홈에서 여러 번
 *   눌러야 도달해 캡처가 불안정하기 때문이다.
 *   ?seed=<정수>  open=quiz 의 문제 10개·보기 순서를 고정하는 시드. 기본 1.
 *                 (quiz 는 buildDailyChallenge → shuffle → Math.random 을 타서
 *                  시드를 안 고정하면 새로 고칠 때마다 다른 화면이 된다.)
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
  const rawView = pick("open");
  const openView =
    rawView === "detail" || rawView === "notebook" || rawView === "write"
      || rawView === "quiz" || rawView === "review" ? rawView : undefined;
  const rawSeed = Number.parseInt(pick("seed") ?? "1", 10);
  const seed = Number.isFinite(rawSeed) ? Math.abs(rawSeed) % 2147483647 : 1;
  return (
    <VocabFixture
      state={state}
      lang={pick("lang") || "ko"}
      teacher={pick("role") === "teacher"}
      openView={openView}
      openWordId={pick("word")}
      seed={seed}
    />
  );
}

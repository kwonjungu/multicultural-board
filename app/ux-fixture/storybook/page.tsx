import { notFound } from "next/navigation";
import StorybookFixtureScreen, { type StorybookView, type StorybookRole } from "./fixture";

/**
 * 그림책 교실(StorybookRoom) · 그림책 공부(BookStudy) 시각/치수 검수용
 * fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404 다. 두 컴포넌트 모두
 * `fixture` prop 이 주어지면 Firebase 구독·쓰기와 /api/* 호출을 전부 하지
 * 않는다. 운영 방(1111)의 세션·답변·채팅 기록은 fixture 로 복제하지 않는다 —
 * 여기 값은 전부 지어낸 것이다.
 *
 * 쿼리로 조합을 고른다:
 *   ?view=shelf|read|question|study   ?role=student|teacher   ?lang=ko|vi
 *   shelf    = 진행 중인 수업 없음 — 교사는 책장(TeacherSetup), 학생은
 *              자유 도서관(StudentFreeLibrary)
 *   read     = 수업 중(during phase) · 페이지 읽기 화면
 *   question = 수업 중 · 페이지에 질문이 떠 있는 화면
 *   study    = 그림책 공부(BookStudy) — 별도 컴포넌트, 진행 중인 세션 1개
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
  const rawView = pick("view");
  const view: StorybookView =
    rawView === "read" || rawView === "question" || rawView === "study" ? rawView : "shelf";
  const role: StorybookRole = pick("role") === "teacher" ? "teacher" : "student";
  const rawLang = pick("lang");
  const lang = rawLang === "vi" ? "vi" : "ko";

  return <StorybookFixtureScreen view={view} role={role} lang={lang} />;
}

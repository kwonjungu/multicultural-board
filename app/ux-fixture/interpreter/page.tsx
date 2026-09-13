import { notFound } from "next/navigation";
import InterpreterFixture, { type InterpState } from "./fixture";

/**
 * 통역 도우미 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404 다. fixture prop 을 넘기는
 * 순간 마이크 접근과 /api/* 호출이 꺼진다.
 *
 *   ?state=idle|listening|translating|done|error
 */
export default function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const v = searchParams?.state;
  const raw = Array.isArray(v) ? v[0] : v;
  const state: InterpState =
    raw === "idle" || raw === "listening" || raw === "translating"
      || raw === "done" || raw === "error" ? raw : "done";
  return <InterpreterFixture state={state} />;
}

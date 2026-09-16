import { notFound } from "next/navigation";
import VillageFixture from "./fixture";

/**
 * 3D 꿀벌마을 시각/치수/성능 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404 다. Firebase 에 붙지 않는다 —
 * 학생·정원 상태는 전부 가짜이고, 운영 방에는 어떤 값도 쓰지 않는다.
 *
 * 쿼리로 조합을 고른다:
 *   ?n=30           학생 수 (기본 12)
 *   ?self=none      내 집 없음(교사 시점). 기본은 0번이 내 집
 *   ?long=1         가장 긴 이름을 섞어 명패·목록 줄바꿈을 본다
 *   ?facilities=3   해금된 공동 시설 수 0~3 (기본 1)
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
  const n = Math.max(0, Math.min(60, Number(pick("n") ?? 12) || 0));
  return (
    <VillageFixture
      n={n}
      self={pick("self") !== "none"}
      longNames={pick("long") === "1"}
      facilities={Math.max(0, Math.min(3, Number(pick("facilities") ?? 1) || 0))}
    />
  );
}

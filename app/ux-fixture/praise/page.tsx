import { notFound } from "next/navigation";
import PraiseFixtureScreen, { type PraiseView } from "./fixture";

/**
 * 칭찬 꿀벌집(PraiseHive) + 꿀벌 마을(BeeVillage) + 꾸미기(CosmeticPicker)
 * 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404 다. 세 컴포넌트 모두
 * `fixture` prop 이 주어지면 Firebase 구독·꿀/XP/스티커 지급·좋아요·댓글·
 * 코스메틱 저장이 전부 꺼진다. 이름·방 번호(9999)는 전부 지어낸 값이다.
 *
 * 쿼리로 조합을 고른다:
 *   ?view=reasons|collection|friend|decorate|village
 *     reasons    = 나의 꿀벌집(mine) — 받은 칭찬 이유 · 벌집
 *     collection = 개인전(race) — 전시장 + 순위
 *     friend     = 개인전 + 친구 전시 팝오버(좋아요·응원) 열림
 *     decorate   = 꾸미기(CosmeticPicker) 서랍 열림
 *     village    = 꿀벌 마을(village) — 지도·상점·퀘스트
 *   ?role=student|teacher
 *   ?lang=ko|vi
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
  const view: PraiseView =
    rawView === "collection" || rawView === "friend" || rawView === "decorate" || rawView === "village"
      ? rawView
      : "reasons";
  return (
    <PraiseFixtureScreen
      view={view}
      teacher={pick("role") === "teacher"}
      lang={pick("lang") || "ko"}
    />
  );
}

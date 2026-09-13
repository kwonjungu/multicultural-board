import { notFound } from "next/navigation";
import GlobeFixture from "./fixture";

/**
 * 다문화 지구본(U11) 크기/반응형 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404 다.
 *
 * 쿼리:
 *   ?mode=explore|quiz|menu   기본 explore — GlobeQuest 를 메뉴 없이 바로 연다
 *                             (측정 스크립트가 매번 카드를 눌러 진입하지 않도록).
 *   ?chrome=game|bare         기본 game — GameRoom 의 실제 "게임 진행 중" 셸
 *                             (고정 헤더 + flex:1 overflow:auto 스테이지)을 재현한다.
 *                             bare 는 셸 없이 GlobeQuest 만 100dvh 에 그대로 둔다.
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
  const rawMode = pick("mode");
  const mode = rawMode === "quiz" || rawMode === "menu" ? rawMode : "explore";
  const chrome = pick("chrome") === "bare" ? "bare" : "game";
  return <GlobeFixture mode={mode} chrome={chrome} />;
}

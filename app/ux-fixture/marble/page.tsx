import { notFound } from "next/navigation";
import MarbleFixture from "./fixture";

/**
 * 꿀벌 월드 마블(U10) 검수용 fixture — 개발·테스트 전용.
 *
 * 왜 `/ux-fixture/game?game=marble` 로 부족한가:
 *   그 fixture 는 게임을 "띄우기"만 한다. 주사위(Math.random)가 매번 달라
 *   같은 화면을 기기 5종 × 글자 2종 10칸에서 다시 만들 수 없다 —
 *   marble-board / marble-dice-move / marble-event-result / marble-fallback
 *   네 화면이 감사 불가로 남아 있던 이유다.
 *
 * 여기서 하는 일은 딱 하나: **BeeWorldMarble 을 마운트하기 전에 Math.random 을
 * 결정적 시드(mulberry32)로 바꾼다.** 컴포넌트에는 손대지 않는다 —
 * components/** 는 이 작업자의 소유가 아니다. 주사위 값·찬스 카드 뽑기가
 * 시드에 종속되므로 같은 시드 + 같은 클릭 순서 = 항상 같은 화면이 된다.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404 다. Firebase·/api 로는
 * 나가지 않는다(fetch 를 가로채 화면에 드러낸다).
 *
 * 쿼리:
 *   ?seed=<정수>   주사위/찬스 카드를 고정하는 시드. 기본 1.
 *   ?motion=…      쓰지 않는다. 움직임 줄이기는 브라우저
 *                  prefers-reduced-motion 으로만 정한다(제품과 같은 경로).
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
  const raw = Number.parseInt(pick("seed") ?? "1", 10);
  const seed = Number.isFinite(raw) ? Math.abs(raw) % 2147483647 : 1;
  return <MarbleFixture seed={seed} />;
}

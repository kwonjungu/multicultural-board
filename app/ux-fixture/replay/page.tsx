import { notFound } from "next/navigation";
import ReplayFixture, { type ReplayKey } from "./fixture";

/**
 * 키 목록은 서버 컴포넌트 쪽에 따로 둔다. "use client" 모듈에서 값을 import 하면
 * 서버에서는 클라이언트 참조 프록시가 되어 `"halligalli" in REPLAY_GAMES` 가
 * 거짓이 된다(실제로 ?game=halligalli 가 puzzle 로 떨어지는 사고가 났다).
 */
const KEYS: ReplayKey[] = ["puzzle", "halligalli", "yut"];

/**
 * 결정적 재현 fixture — 무작위가 섞인 게임을 "같은 판" 으로 다시 열기 위한 라우트.
 *
 * 왜 필요한가: 기기 5종 × 글자 2종 10칸을 비교하려면 열 번 모두 같은 화면이어야
 * 한다. 그런데 퍼즐은 주제 그림 순서를(CulturePuzzle.tsx:85), 할리갈리는 덱을
 * (HalliGalli.tsx:63) Math.random 으로 섞는다. 컴포넌트에는 시드 prop 이 없고
 * components/** 는 이 작업자의 소유가 아니라 넣을 수도 없다.
 *
 * 그래서 여기서는 **컴포넌트를 마운트하기 전에 Math.random 을 시드 난수로
 * 바꾼다.** 게임 코드는 한 줄도 고치지 않는다.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404 다. Firebase·/api 로 나가지
 * 않는다(fetch 를 가로채 화면에 드러낸다).
 *
 * 쿼리:  ?game=puzzle|halligalli|yut   ?seed=<정수>
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
  const raw = pick("game") ?? "puzzle";
  const game = (KEYS as string[]).includes(raw) ? (raw as ReplayKey) : "puzzle";
  const n = Number.parseInt(pick("seed") ?? "1", 10);
  const seed = Number.isFinite(n) ? Math.abs(n) % 2147483647 : 1;
  return <ReplayFixture game={game} seed={seed} />;
}

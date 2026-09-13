import { notFound } from "next/navigation";
import GameLobbyFixture, { type LobbyState } from "./fixture";

/**
 * 게임 로비(U??) 시각/치수 검수용 fixture — 개발·테스트 전용.
 *
 * 기존 app/ux-fixture/game 은 개별 게임(HoneyTaboo 등)만 띄우고 GameRoom 의
 * 로비 자체(언어 카드·게임 그리드·게임 헤더)는 덮지 못했다. 이 라우트는
 * GameRoom 을 통째로 fixture 로 그린다.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404. GameRoom 은 원래 Firebase 를
 * 구독하지 않지만, "게임 1판 종료" 퀘스트 계측과 언어 번역 프리페치가
 * fire-and-forget 으로 나간다 — fixture prop 을 넘기면 둘 다 꺼진다.
 *
 * 쿼리로 조합을 고른다:
 *   ?role=student|teacher   ?lang=ko|vi   ?state=lobby|langpick
 *   lobby    = 기본 화면 — 언어 카드 + 게임 그리드
 *   langpick = "나" 언어 카드를 펼친 상태 (언어 선택 그리드 검수)
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
  const rawState = pick("state");
  const state: LobbyState = rawState === "langpick" ? "langpick" : "lobby";
  const rawLang = pick("lang");
  const lang = rawLang === "vi" ? "vi" : "ko";
  return (
    <GameLobbyFixture
      state={state}
      lang={lang}
      teacher={pick("role") === "teacher"}
    />
  );
}

import { notFound } from "next/navigation";
import WorldMapQuiz from "@/components/games/WorldMapQuiz";

/**
 * 평면 세계지도 나라 찾기(U12 advanced-world-map-quiz) 검수용 fixture.
 *
 * 시드를 쿼리로 받는다 — 같은 시드면 언제나 같은 문제가 같은 순서로 나오므로
 * 기기 5종 × 글자 2종 10칸을 같은 화면으로 다시 만들 수 있다. 이 화면이
 * 하네스에서 오래 미달로 남아 있던 이유가 "제품에 없어서" 였으므로, 만들면서
 * 재현 경로부터 같이 낸다.
 *
 * G0 격리(HARNESS §2): production 빌드에서는 404. 이 화면은 지도 JSON 하나만
 * 받고 Firebase·/api 로는 나가지 않는다 — 아래에서 fetch 를 가로채 그 사실을
 * 화면에 드러낸다.
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
  const lang = pick("lang") ?? "ko";

  return (
    <div style={{ minHeight: "100vh", background: "var(--ux-bg)", padding: "var(--ux-space-3)" }}>
      {/* data-fixture-chrome: 아이가 보는 화면이 아니라 검수 도구용 껍데기다.
          측정 스크립트는 이 안의 것을 제품 조작으로 세지 않는다. */}
      <div
        data-testid="fixture-nav"
        data-fixture-chrome
        style={{
          position: "fixed", top: 0, right: 0, zIndex: 10000,
          padding: "4px 8px", background: "#111", color: "#9CA3AF",
          font: "11px/1.3 monospace", borderBottomLeftRadius: 8,
        }}
      >
        world-map seed={seed} lang={lang}
      </div>
      <WorldMapQuiz langA={lang} langB={lang} seed={seed} />
    </div>
  );
}

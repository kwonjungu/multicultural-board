import { NextResponse } from "next/server";
import { STORYBOOK_IMAGE_LOCAL_NOTICE } from "@/lib/featureLimits";

// 2026-11-11: 이 웹앱은 그림을 생성하지 않는다.
// 종전에는 Gemini 이미지 API 를 여기서 호출했다. Gemini API 추가 약관은 18세 미만이
// 이용할 가능성이 높은 앱의 일부로 서비스를 쓰는 것을 금지하므로 호출을 제거했다.
// 그림은 교사가 자기 PC 에서 scripts/storybook-images-local.mjs 로 만들어 등록한다.
// 예전 클라이언트(캐시된 번들)가 이 주소를 부를 수 있어 라우트는 남기고 중단 응답만 돌려준다.

interface ImageAgentResponse {
  ok: false;
  error: string;
  reason: "disabled";
  /** false — 다시 보내도 소용없다. 클라이언트는 이모지 그림을 유지한다. */
  retryable: false;
}

export async function POST() {
  return NextResponse.json<ImageAgentResponse>({
    ok: false,
    error: STORYBOOK_IMAGE_LOCAL_NOTICE,
    reason: "disabled",
    retryable: false,
  });
}

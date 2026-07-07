// 그림책 이미지 생성 API (/api/storybook-agent/image) 공용 클라이언트.
//
// 서버가 반환하는 구조화된 실패 사유(reason/retryable)를 해석해,
// 재시도 가치가 있는 실패(429/timeout/5xx/no_image)만 짧은 백오프 후
// 1회 자동 재시도한다. 그 후에도 실패하면 호출부가 이모지 폴백을 유지한다.

export interface StorybookImageRequest {
  bookId: string;
  pageIdx?: number;       // 0 = cover, 1+ = pages
  characterId?: string;   // set for character portraits
  prompt: string;
  /** true 면 서버 캐시를 무시하고 새로 생성 (미리보기 "다시 그리기") */
  force?: boolean;
}

export interface StorybookImageResult {
  ok: boolean;
  url?: string;
  error?: string;
  reason?: string;
  /** false 면 재요청해도 소용없음 (프롬프트 거부·키 미설정 등) */
  retryable?: boolean;
  cached?: boolean;
}

async function requestOnce(body: StorybookImageRequest): Promise<StorybookImageResult> {
  let res: Response;
  try {
    res = await fetch("/api/storybook-agent/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // 네트워크 단절 등 — 재시도 가치 있음
    return { ok: false, error: (err as Error)?.message || "network error", reason: "network", retryable: true };
  }
  const data = await res.json().catch(() => null) as StorybookImageResult | null;
  if (!data) {
    // 504 등 JSON 본문 없는 실패 — 재시도 가치 있음
    return { ok: false, error: `image gen ${res.status}`, reason: "timeout", retryable: true };
  }
  if (!data.ok || !data.url) {
    return { ok: false, error: data.error || `image gen ${res.status}`, reason: data.reason, retryable: data.retryable !== false };
  }
  return data;
}

/**
 * 이미지 생성 요청 + 자동 재시도.
 * @param retries 실패 시 추가 자동 재시도 횟수 (기본 1). retryable=false 실패는 즉시 반환.
 */
export async function requestStorybookImage(
  body: StorybookImageRequest,
  retries = 1,
): Promise<StorybookImageResult> {
  let last: StorybookImageResult = { ok: false, error: "not attempted", retryable: true };
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await requestOnce(body);
    if (last.ok) return last;
    if (last.retryable === false) return last;
    if (attempt < retries) {
      // 서버가 이미 내부 재시도를 마친 뒤의 실패이므로 간격은 조금 길게 (~1.5s)
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 600));
    }
  }
  return last;
}

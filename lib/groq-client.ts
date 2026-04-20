// Groq 다중 API 키 폴백
//
// 환경변수 (우선순위 순):
//   GROQ_API_KEY            — 기본 키
//   GROQ_API_KEY_BACKUP     — 예비 1 (선택)
//   GROQ_API_KEY_BACKUP2    — 예비 2 (선택)
//
// 필요하면 여기에 BACKUP3 ~ 를 추가하기만 하면 됨.
//
// 정책: 429(rate limit) · 401(auth) · 403(forbidden) · '모든 모델 소진' 메시지 시
//       다음 키로 재시도. 그 외 에러는 그대로 throw.

import OpenAI from "openai";

export function getGroqApiKeys(): string[] {
  return [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_BACKUP,
    process.env.GROQ_API_KEY_BACKUP2,
  ].filter((k): k is string => !!k && k !== "placeholder");
}

export function makeGroqClient(apiKey?: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey || "placeholder",
    baseURL: "https://api.groq.com/openai/v1",
  });
}

export async function withGroqKeyFallback<T>(
  fn: (client: OpenAI, keyIndex: number) => Promise<T>,
): Promise<T> {
  const keys = getGroqApiKeys();
  if (keys.length === 0) {
    // 키가 아예 없으면 placeholder 로 시도 — 에러는 명확히 던져짐
    return fn(makeGroqClient(), 0);
  }
  let lastErr: unknown;
  for (let i = 0; i < keys.length; i++) {
    const client = makeGroqClient(keys[i]);
    try {
      return await fn(client, i);
    } catch (err) {
      if (shouldFallbackToNextKey(err)) {
        if (i < keys.length - 1) {
          console.warn(`[groq] 키 #${i + 1} 실패 (${describeErr(err)}), 예비 키로 재시도…`);
        }
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function shouldFallbackToNextKey(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 401 || status === 403) return true;
  const msg = String((err as Error)?.message ?? "").toLowerCase();
  return msg.includes("모델 소진")
    || msg.includes("한도 초과")
    || msg.includes("rate_limit_exceeded")
    || msg.includes("rate limit")
    || msg.includes("unauthorized")
    || msg.includes("insufficient_quota")
    || msg.includes("invalid_api_key")
    || msg.includes("api key not valid");
}

function describeErr(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status) return `${status}`;
  const msg = String((err as Error)?.message ?? "").slice(0, 80);
  return msg || "unknown";
}

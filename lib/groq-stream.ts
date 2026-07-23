// 챗 응답을 SSE(Server-Sent Events)로 스트리밍하는 공용 헬퍼.
// storybook-chat / tutor-chat 라우트가 함께 사용한다.
// provider:"gemini" 를 주면 Gemini(2.5 flash 계열) 1순위 + Groq 폴백으로 동작한다.
//
// 이벤트 형식 (모두 `data: {json}\n\n` 한 줄):
//   { type: "delta", text: string }                          — 토큰 조각
//   { type: "final", reply, kind, model? }                   — 최종 확정 텍스트
//
// 클라이언트는 delta 를 이어 붙여 실시간 표시하다가, final 의 reply 로
// 교체해 확정한다 (질문형 종결 강제 등 후처리가 final 에만 반영되므로).
//
// 안전장치: 누적 텍스트에 매 청크마다 checkSafety 를 돌려 차단어가 나오면
// 즉시 스트림을 끊고 안전 응답을 final 로 보낸다.

import type OpenAI from "openai";
import { checkSafety, replyForSafety } from "./chatSafety";
import { withGroqKeyFallback } from "./groq-client";
import { geminiClientForKey, getGeminiApiKeys, GEMINI_CHAT_MODELS } from "./gemini";
import { scrubDelta, sanitizeReply, targetScriptRatio } from "./langGuard";
import { LANGUAGES } from "./constants";

// 타깃 언어 비율이 이 값 미만이면 외국어 오염으로 보고 1회 재생성.
const POLLUTION_THRESHOLD = 0.6;

function langDisplayName(lang: string): string {
  const e = LANGUAGES[lang as keyof typeof LANGUAGES] as { name?: string; label?: string } | undefined;
  return e?.name || e?.label || lang;
}

/**
 * #8 외국어 오염 복구 — full 의 타깃 언어 비율이 낮으면 STRICT 메시지를 덧붙여
 * 비스트리밍으로 1회 재생성한다. 더 나은 결과만 채택한다(보수적).
 */
async function ensureTargetLang(
  full: string,
  ctx: { messages: ChatMessage[]; models: string[]; lang: string; allow: string[]; temperature: number; maxTokens: number },
): Promise<string> {
  if (targetScriptRatio(full, ctx.allow) >= POLLUTION_THRESHOLD) return full;
  const name = langDisplayName(ctx.lang);
  const strict: ChatMessage = {
    role: "system",
    content: `STRICT: Reply ONLY in ${name}. Do NOT use Chinese/Japanese/other-language characters unless the reply language is that language. Keep it short.`,
  };
  try {
    const regen = await withGroqKeyFallback(async (client) => {
      let lastErr: unknown = null;
      for (const model of ctx.models) {
        try {
          const c = await client.chat.completions.create({
            model,
            messages: [...ctx.messages, strict],
            temperature: Math.min(ctx.temperature, 0.5),
            // 재생성은 짧은 깨끗한 답이면 충분 → 토큰을 캡해 추가 지연을 줄인다.
            max_tokens: Math.min(ctx.maxTokens, 220),
            stream: false,
          });
          return c.choices?.[0]?.message?.content?.trim() || "";
        } catch (err) {
          lastErr = err;
          const status = (err as { status?: number })?.status ?? 0;
          if (status === 400 || status === 404) continue;
          throw err;
        }
      }
      throw lastErr ?? new Error("regenerate: no model");
    });
    if (regen && targetScriptRatio(regen, ctx.allow) > targetScriptRatio(full, ctx.allow)) {
      return regen;
    }
  } catch (err) {
    console.warn("groq-stream: clean regeneration failed", err);
  }
  return full;
}

export type ChatKind = "normal" | "block" | "distress" | "error";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StreamChatParams {
  messages: ChatMessage[];
  models: string[];          // 순서대로 시도 (400/404 시 다음 모델)
  lang: string;              // 안전 응답 언어
  temperature?: number;
  maxTokens?: number;
  /** 완성된 전체 텍스트에 적용할 후처리 (예: 질문형 종결 강제) */
  finalize?: (full: string) => string;
  /**
   * #8 언어 가드가 허용할 스크립트 언어 목록 (delta 스크럽·오염 판정용).
   * 기본 [lang]. 튜터처럼 타깃 언어 + 한국어 예시를 함께 쓰면 [lang,"ko"] 전달.
   */
  scrubLangs?: string[];
  /**
   * "gemini" 면 Gemini(2.5 flash 계열, 비용 하드캡 준수)를 1순위로 시도하고,
   * 키가 없거나 전부 실패하면 기존 Groq 키/모델 폴백 체인으로 내려간다.
   * 기본은 "groq" (기존 동작 그대로) — 튜터/핫시팅 챗봇만 "gemini" 를 쓴다.
   */
  provider?: "groq" | "gemini";
}

type AcquiredStream = { stream: AsyncIterable<OpenAI.ChatCompletionChunk>; model: string };

/** Groq 스트림 획득 — 기존 키/모델 폴백 체계 (429/401/403 → 다음 키, 400/404 → 다음 모델). */
async function acquireGroqStream(
  messages: ChatMessage[], models: string[], temperature: number, maxTokens: number,
): Promise<AcquiredStream> {
  return withGroqKeyFallback(async (client) => {
    let lastErr: unknown = null;
    for (const model of models) {
      try {
        const stream = await client.chat.completions.create({
          model, messages, temperature, max_tokens: maxTokens, stream: true,
        });
        return { stream, model };
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number })?.status ?? 0;
        if (status === 400 || status === 404) continue; // 모델 미지원 → 다음 모델
        throw err; // 429/401/403 등 → 키 폴백으로
      }
    }
    throw lastErr ?? new Error("groq-stream: no model succeeded");
  });
}

/**
 * Gemini 스트림 획득 — 키 로테이션 × 모델 폴백 (getGeminiApiKeys 순서대로).
 * 429/400/404 → 다음 모델, 그 외(401/403 등) → 다음 키. 전부 실패 시 throw
 * → 호출부가 Groq 체인으로 폴백한다. Gemini 도 OpenAI 호환 엔드포인트라
 * 청크 형식이 Groq 와 동일해 이후 파이프라인을 그대로 태운다.
 */
async function acquireGeminiStream(
  messages: ChatMessage[], temperature: number, maxTokens: number,
): Promise<AcquiredStream> {
  const keys = getGeminiApiKeys();
  if (!keys.length) throw new Error("gemini-stream: GEMINI_API_KEY not set");
  // #7과 동일: 2.5 계열 thinking 이 max_tokens 를 잠식하면 보이는 답이 빈/잘린
  // 상태로 끝나(finish_reason:length) BLOCK_REPLY 로 오인 대체된다 → thinking OFF.
  // 파라미터가 거부(400)되면 없이 1회 재시도 (generateJson 의 폴백과 동일 정책).
  const paramsFor = (model: string, thinkingOff: boolean) => {
    const base = { model, messages, temperature, max_tokens: maxTokens, stream: true as const };
    return thinkingOff
      ? { ...base, ...({ reasoning_effort: "none" } as Record<string, unknown>) }
      : base;
  };
  let lastErr: unknown = null;
  for (const key of keys) {
    const client = geminiClientForKey(key);
    for (const model of GEMINI_CHAT_MODELS) {
      try {
        const stream = await client.chat.completions.create(paramsFor(model, true));
        return { stream, model };
      } catch (err) {
        let finalErr = err;
        if (((err as { status?: number })?.status ?? 0) === 400) {
          try {
            const stream = await client.chat.completions.create(paramsFor(model, false));
            return { stream, model };
          } catch (err2) {
            finalErr = err2;
          }
        }
        lastErr = finalErr;
        const status = (finalErr as { status?: number })?.status ?? 0;
        if (status === 429 || status === 400 || status === 404) continue; // 다음 모델
        break; // 키 문제(401/403 등) → 다음 키
      }
    }
  }
  throw lastErr ?? new Error("gemini-stream: no key/model succeeded");
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

function sseLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/** 단일 final 이벤트만 보내는 SSE 응답 (사전 차단·에러용) */
export function sseSingleFinal(reply: string, kind: ChatKind): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sseLine({ type: "final", reply, kind }));
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

/** Groq 스트리밍 챗 → SSE Response. 키/모델 폴백 + 증분 안전검사 포함. */
export async function streamChatResponse(params: StreamChatParams): Promise<Response> {
  const { messages, models, lang, temperature = 0.7, maxTokens = 180, finalize } = params;
  // #8 허용 언어(스크립트) 목록 — 기본 [lang].
  const allow = params.scrubLangs && params.scrubLangs.length ? params.scrubLangs : [lang];

  // 1) 스트림 획득. provider:"gemini" 면 Gemini 1순위 → 실패 시 Groq 체인.
  //    (오염 재생성 ensureTargetLang 은 의도적으로 Groq 유지 — 짧은 정리용 재생성이라
  //     품질 차이가 작고, Gemini 장애 상황에서도 복구 경로가 살아 있어야 한다)
  let acquired: AcquiredStream;
  try {
    if (params.provider === "gemini") {
      try {
        acquired = await acquireGeminiStream(messages, temperature, maxTokens);
      } catch (err) {
        console.warn("gemini-stream: Groq 로 폴백", err);
        acquired = await acquireGroqStream(messages, models, temperature, maxTokens);
      }
    } else {
      acquired = await acquireGroqStream(messages, models, temperature, maxTokens);
    }
  } catch (err) {
    console.error("groq-stream: all keys+models failed", err);
    return sseSingleFinal(replyForSafety(lang, "block"), "error");
  }

  const { stream: chatStream, model } = acquired;

  // 2) LLM 청크를 SSE 로 변환하면서 증분 안전검사.
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let acc = "";
      try {
        for await (const chunk of chatStream) {
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (!delta) continue;
          acc += delta;

          const safety = checkSafety(acc);
          if (safety.blocked || safety.distress) {
            const kind: ChatKind = safety.distress ? "distress" : "block";
            controller.enqueue(sseLine({
              type: "final", reply: replyForSafety(lang, kind), kind, model,
            }));
            controller.close();
            return;
          }
          // #8 delta 스크럽 — 외국어가 화면에 "뜨는" 것을 차단. acc(원본)는
          // 종료 시 오염 판정·재생성에 쓰므로 그대로 둔다.
          const shown = scrubDelta(delta, allow);
          if (shown) controller.enqueue(sseLine({ type: "delta", text: shown }));
        }

        const full = (acc || "").trim();
        if (!full) {
          controller.enqueue(sseLine({
            type: "final", reply: replyForSafety(lang, "block"), kind: "error", model,
          }));
        } else {
          // #8 오염 시 1회 재생성 → finalize(라우트의 sanitize/질문종결) →
          //    그래도 비면 안전 폴백(타깃 언어). 외국어 덩어리는 절대 노출 안 됨.
          const cleaned = await ensureTargetLang(full, { messages, models, lang, allow, temperature, maxTokens });
          let reply = finalize ? finalize(cleaned) : sanitizeReply(cleaned, allow);
          if (!reply || reply.replace(/\s/g, "").length < 2) reply = replyForSafety(lang, "block");
          controller.enqueue(sseLine({ type: "final", reply, kind: "normal", model }));
        }
        controller.close();
      } catch (err) {
        // 스트림 도중 끊김 — 지금까지 받은 내용이 충분하면 그걸 확정, 아니면 안전 응답
        console.error("groq-stream: mid-stream error", err);
        const full = acc.trim();
        const reply = full.length >= 10
          ? (finalize ? finalize(full) : sanitizeReply(full, allow))
          : replyForSafety(lang, "block");
        const kind: ChatKind = full.length >= 10 ? "normal" : "error";
        try {
          controller.enqueue(sseLine({ type: "final", reply, kind, model }));
          controller.close();
        } catch { /* controller already closed */ }
      }
    },
  });

  return new Response(body, { headers: SSE_HEADERS });
}

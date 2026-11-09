import { NextRequest, NextResponse } from "next/server";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import { streamChatResponse, sseSingleFinal } from "@/lib/groq-stream";
import { sanitizeReply } from "@/lib/langGuard";
import { buildTutorSystemPrompt } from "@/lib/prompts/chatPrompts";

// 앱 전역 "AI 튜터 꿀비" — 스토리북 핫시팅과 달리 캐릭터 연기가 아니라
// 다문화 학생의 한국어/학교생활 학습을 돕는 범용 튜터.
// 안전 레이어(사전 차단 → 스트리밍 중 증분 검사 → 안전 응답)는 동일.

export const dynamic = "force-dynamic";

// 챗봇 Groq 모델 체인. llama-3.3-70b 는 2026-08-16 decommission 예정이라 제외.
// qwen3.6-27b 는 <think> 영어 추론이 응답에 그대로 유출돼 챗에서는 사용 금지.
const GROQ_MODELS = [
  "openai/gpt-oss-120b",            // fallback 1 — Groq 권장 대체 모델
  "openai/gpt-oss-20b",             // fallback 2 — 별도 한도 버킷
  "qwen/qwen3.8-27b",                 // fallback 3 — 다른 계열·별도 버킷
];

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface TutorChatRequest {
  studentLang: string;
  studentName?: string;
  history: IncomingMessage[];
  studentText: string;
}

export async function POST(req: NextRequest) {
  let body: TutorChatRequest;
  try {
    body = await req.json() as TutorChatRequest;
  } catch {
    return NextResponse.json({ reply: "", kind: "error", error: "bad json" }, { status: 400 });
  }

  if (!body?.studentText?.trim()) {
    return NextResponse.json({ reply: "", kind: "error", error: "missing fields" }, { status: 400 });
  }
  const lang = body.studentLang || "ko";

  // Layer 1: 학생 입력 사전 검사
  const safety = checkSafety(body.studentText);
  if (safety.distress) {
    return sseSingleFinal(replyForSafety(lang, "distress"), "distress");
  }
  if (safety.blocked) {
    return sseSingleFinal(replyForSafety(lang, "block"), "block");
  }

  const history = (body.history || []).slice(-12);
  const messages = [
    { role: "system" as const, content: buildTutorSystemPrompt(lang, body.studentName) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: body.studentText.trim() },
  ];

  // #8 튜터는 한국어 예시를 가르치므로 타깃 언어 + 한국어를 허용 스크립트로 둔다.
  // (중국어/일본어 등 그 외 외국어는 차단·정리)
  const allowLangs = lang === "ko" ? ["ko"] : [lang, "ko"];

  // Layer 2~4: 스트리밍 + 증분 안전검사 + delta 스크럽 + final 새니타이즈
  // 학생용 챗봇은 Groq 전용 (Gemini API 약관의 18세 미만 앱 금지 조항 때문).
  return streamChatResponse({
    messages,
    models: GROQ_MODELS,
    lang,
    temperature: 0.6,
    // gpt-oss 는 추론 토큰도 max_tokens 에 포함되므로 짧은 답이라도 여유를 둔다.
    maxTokens: 500,
    scrubLangs: allowLangs,
    finalize: (full) => sanitizeReply(full, allowLangs),
  });
}

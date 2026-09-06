import { NextRequest, NextResponse } from "next/server";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import { streamChatResponse, sseSingleFinal } from "@/lib/groq-stream";
import { sanitizeReply, resolveReplyLang } from "@/lib/langGuard";
import { buildHotseatSystemPrompt } from "@/lib/prompts/chatPrompts";
import type { StorybookCharacter } from "@/lib/types";

// 스트리밍 응답이라 정적 최적화 대상에서 제외
export const dynamic = "force-dynamic";

// Groq inference provider (OpenAI-compatible). Primary key: GROQ_API_KEY.
// Backup key: GROQ_API_KEY_BACKUP (auto-fallback on 429/401/403 via withGroqKeyFallback).
// Gemini 폴백용 Groq 체인. llama-3.3-70b 는 2026-08-16 decommission 예정이라 제외.
// qwen3.6-27b 는 <think> 영어 추론이 응답에 그대로 유출돼 챗에서는 사용 금지.
const GROQ_MODELS = [
  "openai/gpt-oss-120b",            // fallback 1 — Groq 권장 대체 모델
  "openai/gpt-oss-20b",             // fallback 2 — 별도 한도 버킷
  "qwen/qwen3.8-27b",                 // fallback 3 — 다른 계열·별도 버킷
];

// 핫시팅 응답이 질문으로 끝나지 않을 때 붙일 짧은 fallback 후속 질문.
// LLM 이 규칙을 무시한 경우의 마지막 안전망. 학생 언어로.
const FALLBACK_FOLLOWUP: Record<string, string> = {
  ko: "그럼 너는 어떻게 생각해?",
  en: "What do you think?",
  vi: "Bạn nghĩ sao?",
  zh: "那你怎么想?",
  ja: "君はどう思う?",
  th: "แล้วคุณคิดยังไง?",
  fil: "Ano sa tingin mo?",
  km: "តើអ្នកគិតយ៉ាងណា?",
  mn: "Чи юу гэж бодож байна?",
  ru: "А ты как думаешь?",
  uz: "Sen nima deb oʻylaysan?",
  hi: "तुम क्या सोचते हो?",
  id: "Bagaimana menurutmu?",
  ar: "ماذا تظن أنت؟",
  my: "မင်းကရော ဘယ်လိုထင်လဲ?",
};

// 응답 끝이 의문부호로 끝나는지 — 한국어/중국어/풀스톱 변형 포함.
function endsWithQuestion(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  // 마지막 비공백 문자 비교. 한자 ？, 일반 ?, 아랍어 ؟ 까지.
  return /[?？؟]\s*[")'』」]*\s*$/.test(trimmed);
}

function enforceQuestionEnding(reply: string, lang: string): string {
  if (endsWithQuestion(reply)) return reply;
  const followup = FALLBACK_FOLLOWUP[lang] || FALLBACK_FOLLOWUP.en;
  // 종결 부호 정리 후 후속 질문 부착
  const cleaned = reply.replace(/[.。!！]+\s*$/, "").trim();
  return `${cleaned} ${followup}`;
}

// 한국어 답변의 어색한 명사절 의문형("~무엇인지?")을 구어체로 교정한다.
// (외국어 토큰 제거는 langGuard 의 sanitizeReply 가 전 언어 공통으로 담당)
function fixKoreanRegister(reply: string): string {
  let out = reply;
  out = out.replace(/무엇인지\s*\?/g, "뭐야?");
  out = out.replace(/인지\s*\?/g, "이야?");
  out = out.replace(/([가-힣])는지\s*\?/g, "$1?");
  return out.trim();
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  character: StorybookCharacter;
  bookTitle: string;
  studentLang: string;
  history: IncomingMessage[];   // prior turns (assistant+user), most recent last
  studentText: string;
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json() as ChatRequest;
  } catch {
    return NextResponse.json({ reply: "", kind: "error", error: "bad json" }, { status: 400 });
  }

  if (!body?.character || !body?.studentText?.trim()) {
    return NextResponse.json({ reply: "", kind: "error", error: "missing fields" }, { status: 400 });
  }

  // === Layer 1+4: pre-check student text ===
  const safety = checkSafety(body.studentText);
  if (safety.distress) {
    return sseSingleFinal(replyForSafety(body.studentLang, "distress"), "distress");
  }
  if (safety.blocked) {
    return sseSingleFinal(replyForSafety(body.studentLang, "block"), "block");
  }

  // [항목 13] 학생이 실제로 쓴 언어로 답한다 — 프로필 언어 강제가 아니라.
  const replyLang = resolveReplyLang(body.studentText, body.studentLang);

  // === Layer 2: call Groq with hardened system prompt ===
  const systemPrompt = buildHotseatSystemPrompt({
    character: body.character,
    bookTitle: body.bookTitle,
    studentLang: replyLang,
  });

  // Truncate history to last 12 messages to keep prompt small
  const history = (body.history || []).slice(-12);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: body.studentText.trim() },
  ];

  // === Layer 2~4: 스트리밍 + 증분 안전검사 + 정리/질문형 종결 강제(final 에 반영) ===
  // 핫시팅 챗봇은 Gemini(2.5 flash) 1순위 — 캐릭터 연기·다국어 품질, 실패 시 Groq 폴백.
  return streamChatResponse({
    provider: "gemini",
    messages,
    models: GROQ_MODELS,
    lang: replyLang,
    temperature: 0.6,
    // max_tokens 는 thinking+본문 합계다. 3.8 의 thinking 은 lib/gemini.ts 의
    // THINKING_OFF 로 꺼 두었으므로 종전 값 그대로 충분하다(계측: 3문장 답이
    // 한국어 58·미얀마어 49·크메르어 52 토큰). thinking 이 다시 켜지면 답이
    // 잘리므로 scripts/prompt-harness.mjs 의 "잘리지 않음(finish=stop)" 판정으로 감시.
    maxTokens: 180,
    finalize: (full) => {
      // #8 전 언어 외국어 토큰 제거 → (ko) 명사절 의문형 교정 → 질문형 종결 강제
      let cleaned = sanitizeReply(full, replyLang);
      if (replyLang === "ko") cleaned = fixKoreanRegister(cleaned);
      return enforceQuestionEnding(cleaned, replyLang);
    },
  });
}

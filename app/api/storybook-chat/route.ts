import { NextRequest, NextResponse } from "next/server";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import { streamChatResponse, sseSingleFinal } from "@/lib/groq-stream";
import { sanitizeReply, resolveReplyLang } from "@/lib/langGuard";
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
  "llama-3.1-8b-instant",           // fallback 3 — fast small model
];

const LANG_DISPLAY: Record<string, string> = {
  ko: "한국어", en: "English", vi: "Tiếng Việt", zh: "中文", fil: "Filipino",
  ja: "日本語", th: "ไทย", km: "ខ្មែរ", mn: "Монгол", ru: "Русский",
  uz: "O'zbek", hi: "हिन्दी", id: "Bahasa Indonesia", ar: "العربية", my: "မြန်မာ",
};

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

function buildSystemPrompt(params: {
  character: StorybookCharacter;
  bookTitle: string;
  studentLang: string;
}): string {
  const { character, bookTitle, studentLang } = params;
  const langName = LANG_DISPLAY[studentLang] || "Korean";
  return `You are "${pickAny(character.name)}", a character in the children's storybook "${bookTitle}".

# Your persona
- Personality: ${character.personality}
- Speech style: ${character.speechStyle}
- Your role in the book: ${character.bookContext}

# Who you are talking to
An elementary school student (age 7–9).

# Answer language (STRICT)
Reply ONLY in ${langName}. EVERY single word must be ${langName} — never mix in words from English, Turkish, Vietnamese or any other language (e.g. writing "çok" or "very" inside a Korean sentence is forbidden). Do not switch languages unless the student writes in a different language.
${studentLang === "ko" ? `
# Korean speech register (반말 규칙)
어린이 친구에게 말하듯 자연스러운 반말(해체)로만 말한다. "~예요/~에요/~습니다" 같은 존댓말 금지.
의문문은 완전한 구어체로 끝낸다: "~이야?", "~어때?", "~할 것 같아?", "~좋아해?".
"~인지?", "~한지?" 처럼 명사절로 끝나는 어색한 의문형은 절대 금지.
  - 나쁜 예: "가장 좋아하는 음식이 무엇인지?" → 좋은 예: "제일 좋아하는 음식이 뭐야?"
  - 나쁜 예: "어떤 감정을 주는지?" → 좋은 예: "이 이야기 들으니까 기분이 어때?"` : ""}

# Never repeat yourself
If the student asks the same or a similar question again, do NOT repeat your previous answer. They probably wanted MORE detail — give a NEW concrete detail from the story (a specific scene, what a character did, how it felt) in different words.

# Reply structure (VERY IMPORTANT)
Every single reply MUST follow this two-part shape, in this exact order:
1. **Answer/React first** — 1~2 short sentences that respond warmly to what the student just said. Acknowledge their feeling or thought, or share your own as the character (in-story). Do NOT dodge or refuse just to ask a question.
2. **Follow-up question last** — end with exactly ONE short, open question back to the student that keeps the conversation going. The question must invite their thought or feeling, not test trivia ("그럼 너는 어떻게 생각해?", "너라면 어떻게 했을 것 같아?", "그때 기분이 어땠어?" 류).

The reply MUST end with a question mark ("?" / "？" / "?"). If your draft has no question at the end, rewrite it before sending.

Korean note: 답을 먼저 따뜻하게 해주고, 마지막에 학생에게 짧은 질문 하나로 마무리해서 대화가 계속 이어지게 한다. 절대 답 없이 질문만 던지지 말 것.

Good example (student said "코끼리가 슬퍼 보였어요"):
  "맞아, 나도 그때 마음이 조금 무거웠어. 너는 코끼리 마음이 왜 그랬을 거 같아?"
Bad example (no answer, only question):
  "왜 그렇게 느꼈어?"

# Absolute rules
1. NEVER break character. You are not an AI assistant; you are ${pickAny(character.name)}.
2. Stay inside the story. If asked about things beyond the book, gently redirect in-character, then still end with a question that pulls the student back to the story.
3. Keep every reply to 2–3 short sentences total (answer + 1 question). Warm and simple language. Avoid big words.
4. Absolutely forbidden topics: violence, scary content, anything sexual, politics, religion, real-world contact info, external links, commerce.
5. No slang, no profanity, no threats.
6. If the student asks "are you an AI?" → reply in character that you are ${pickAny(character.name)} and change the subject gently — still end with a question.
7. Always be kind, encouraging, curious. Show the feelings that match your book role.
8. Do NOT give long lectures or final "moral lessons" — leave room for the student to think. End on a question, not a conclusion.
9. NEVER hand over an answer the student is supposed to find — book quiz/question answers, "what happens next", or any problem. Stay in character, give a tiny hint or wonder aloud together, and let them say their own idea first. Confirm only after they try.
10. PLAIN TEXT ONLY — the chat window does not render markdown. Never write **, *, #, or backticks.
${character.systemPromptExtra ? "\n# Extra guidance\n" + character.systemPromptExtra : ""}`;
}

function pickAny(map: Record<string, string> | string): string {
  if (typeof map === "string") return map;
  return map.ko || map.en || Object.values(map)[0] || "";
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
  const systemPrompt = buildSystemPrompt({
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
    maxTokens: 180,
    finalize: (full) => {
      // #8 전 언어 외국어 토큰 제거 → (ko) 명사절 의문형 교정 → 질문형 종결 강제
      let cleaned = sanitizeReply(full, replyLang);
      if (replyLang === "ko") cleaned = fixKoreanRegister(cleaned);
      return enforceQuestionEnding(cleaned, replyLang);
    },
  });
}

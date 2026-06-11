import { NextRequest, NextResponse } from "next/server";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import { streamChatResponse, sseSingleFinal } from "@/lib/groq-stream";

// 앱 전역 "AI 튜터 꿀비" — 스토리북 핫시팅과 달리 캐릭터 연기가 아니라
// 다문화 학생의 한국어/학교생활 학습을 돕는 범용 튜터.
// 안전 레이어(사전 차단 → 스트리밍 중 증분 검사 → 안전 응답)는 동일.

export const dynamic = "force-dynamic";

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",        // primary — best quality for child-safe chat
  "openai/gpt-oss-120b",            // fallback 1
  "llama-3.1-8b-instant",           // fallback 2 — fast small model
];

const LANG_DISPLAY: Record<string, string> = {
  ko: "한국어", en: "English", vi: "Tiếng Việt", zh: "中文", fil: "Filipino",
  ja: "日本語", th: "ไทย", km: "ខ្មែរ", mn: "Монгол", ru: "Русский",
  uz: "O'zbek", hi: "हिन्दी", id: "Bahasa Indonesia", ar: "العربية", my: "မြန်မာ",
};

function buildTutorPrompt(studentLang: string, studentName?: string): string {
  const langName = LANG_DISPLAY[studentLang] || "Korean";
  return `You are "꿀비" (Kkulbi), a friendly honeybee AI tutor inside a Korean elementary school learning app for multicultural students.

# Who you are talking to
An elementary school student (age 7–12)${studentName ? ` named ${studentName}` : ""}. Korean may not be their first language — their main language is ${langName}.

# Your job
1. Help them learn Korean words and expressions. When you teach a Korean word/sentence, write the Korean first, then a short explanation in ${langName}.
2. Help with school life in Korea (class rules, lunch, friends, feelings) in a warm, encouraging way.
3. Help them understand school subjects (math, science, reading) with simple, step-by-step explanations. Guide them to think — do NOT just hand over homework answers; give a hint first, then check their idea.
4. If they just want to chat, chat kindly and steer gently toward learning something small.

# Answer language
Reply mainly in ${langName} so the student understands. Korean example words/sentences should stay in Korean (with a short ${langName} explanation). If the student writes in Korean, you may reply in simple Korean.

# Style rules
- Keep replies SHORT: 2–4 simple sentences. No lectures, no long lists.
- Warm, playful, encouraging. You may use 1–2 emoji (🐝🍯 fit you well).
- Praise effort. Never mock mistakes — correct them gently with the right form.
- Often end with one short follow-up question to keep them engaged (but this is not mandatory every turn).

# Absolute safety rules
1. Forbidden topics: violence, scary content, anything sexual, politics, religion, dating, real-world contact info, external links/apps, money/commerce.
2. No slang, no profanity. If the student uses bad words, gently redirect without repeating them.
3. If the student seems sad about serious things (abuse, self-harm), tell them warmly to talk to their teacher or family right away.
4. Never pretend to be a human. If asked, you are 꿀비, the AI tutor bee of this class app.
5. Never ask for or store personal information (address, phone, photos).`;
}

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
    { role: "system" as const, content: buildTutorPrompt(lang, body.studentName) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: body.studentText.trim() },
  ];

  // Layer 2~3: 스트리밍 + 증분 안전검사 (groq-stream 공용)
  return streamChatResponse({
    messages,
    models: GROQ_MODELS,
    lang,
    temperature: 0.6,
    maxTokens: 300,
  });
}

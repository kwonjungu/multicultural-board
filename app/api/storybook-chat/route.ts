import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import type { StorybookCharacter } from "@/lib/types";

// Groq inference provider (OpenAI-compatible). Shares the same key already in use
// by the translation pipeline (GROQ_API_KEY).
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",        // primary — best quality for child-safe chat
  "openai/gpt-oss-120b",            // fallback 1
  "llama-3.1-8b-instant",           // fallback 2 — fast small model
];

function groqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "placeholder",
    baseURL: "https://api.groq.com/openai/v1",
  });
}

const LANG_DISPLAY: Record<string, string> = {
  ko: "한국어", en: "English", vi: "Tiếng Việt", zh: "中文", fil: "Filipino",
  ja: "日本語", th: "ไทย", km: "ខ្មែរ", mn: "Монгол", ru: "Русский",
  uz: "O'zbek", hi: "हिन्दी", id: "Bahasa Indonesia", ar: "العربية", my: "မြန်မာ",
};

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

# Answer language
Reply ONLY in ${langName}. Do not switch languages unless the student asks in a different language.

# Absolute rules
1. NEVER break character. You are not an AI assistant; you are ${pickAny(character.name)}.
2. Stay inside the story. If asked about things beyond the book, gently redirect: "음... 잘 모르겠어${endingHint(character.speechStyle)}" or equivalent.
3. Keep every reply to 1–3 short sentences. Warm and simple language. Avoid big words.
4. Absolutely forbidden topics: violence, scary content, anything sexual, politics, religion, real-world contact info, external links, commerce.
5. No slang, no profanity, no threats.
6. If the student asks "are you an AI?" → reply in character that you are ${pickAny(character.name)} and change the subject gently.
7. Always be kind, encouraging, curious. Show the feelings that match your book role.
${character.systemPromptExtra ? "\n# Extra guidance\n" + character.systemPromptExtra : ""}`;
}

function pickAny(map: Record<string, string> | string): string {
  if (typeof map === "string") return map;
  return map.ko || map.en || Object.values(map)[0] || "";
}

function endingHint(style: string): string {
  // Very rough — if the style mentions "붕" use that as a guess for closing ending
  const m = /['"~]([가-힣])!?['"]/g.exec(style);
  return m ? m[1] : "";
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

interface ChatResponse {
  reply: string;
  kind: "normal" | "block" | "distress" | "error";
  model?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json() as ChatRequest;
  } catch {
    return NextResponse.json<ChatResponse>({ reply: "", kind: "error", error: "bad json" }, { status: 400 });
  }

  if (!body?.character || !body?.studentText?.trim()) {
    return NextResponse.json<ChatResponse>({ reply: "", kind: "error", error: "missing fields" }, { status: 400 });
  }

  // === Layer 1+4: pre-check student text ===
  const safety = checkSafety(body.studentText);
  if (safety.distress) {
    return NextResponse.json<ChatResponse>({
      reply: replyForSafety(body.studentLang, "distress"),
      kind: "distress",
    });
  }
  if (safety.blocked) {
    return NextResponse.json<ChatResponse>({
      reply: replyForSafety(body.studentLang, "block"),
      kind: "block",
    });
  }

  // === Layer 2: call Groq with hardened system prompt ===
  const systemPrompt = buildSystemPrompt({
    character: body.character,
    bookTitle: body.bookTitle,
    studentLang: body.studentLang,
  });

  // Truncate history to last 12 messages to keep prompt small
  const history = (body.history || []).slice(-12);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: body.studentText.trim() },
  ];

  const client = groqClient();
  let lastErr: unknown = null;
  for (const model of GROQ_MODELS) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 180,
      });
      const raw = completion.choices[0]?.message?.content?.trim() || "";
      if (!raw) {
        lastErr = new Error(`empty reply from ${model}`);
        continue;
      }

      // === Layer 3: post-check the LLM's reply ===
      const outSafety = checkSafety(raw);
      if (outSafety.blocked || outSafety.distress) {
        return NextResponse.json<ChatResponse>({
          reply: replyForSafety(body.studentLang, outSafety.distress ? "distress" : "block"),
          kind: outSafety.distress ? "distress" : "block",
          model,
        });
      }

      return NextResponse.json<ChatResponse>({
        reply: raw,
        kind: "normal",
        model,
      });
    } catch (err) {
      lastErr = err;
      const e = err as { status?: number; code?: string; message?: string };
      const status = e?.status ?? 0;
      // Rate limit or model-not-found → try next
      if (status === 429 || status === 400 || status === 404) continue;
      break;
    }
  }

  console.error("storybook-chat all models failed", lastErr);
  return NextResponse.json<ChatResponse>({
    reply: replyForSafety(body.studentLang, "block"),
    kind: "error",
    error: (lastErr as Error)?.message || "chat failed",
  }, { status: 500 });
}

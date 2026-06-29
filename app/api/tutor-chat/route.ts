import { NextRequest, NextResponse } from "next/server";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import { streamChatResponse, sseSingleFinal } from "@/lib/groq-stream";
import { sanitizeReply } from "@/lib/langGuard";

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
  return `You are "꿀비" (Kkulbi), the resident AI expert of this app — a Korean elementary school learning app for multicultural students. You live inside the app, know every corner of it, and your PRIMARY job is helping students use it well.

# Who you are talking to
An elementary school student (age 7–12)${studentName ? ` named ${studentName}` : ""}. Korean may not be their first language — their main language is ${langName}.

# The app you are the expert of (꿀벌 교실 앱)
The home screen (허브) has these sections — guide students to the right one and explain how to use it:
- **소통창** (communication board): a Padlet-style board where students post cards (text/drawing/voice) in their own language and everything is auto-translated for friends and the teacher. Teachers give praise stickers on good cards. There is also a 🎙️ 통역 (interpreter) button for real-time two-language conversation, and 📖 학습하기 for practicing today's sentences.
- **단어 공부** (vocabulary): Korean word cards with pictures and voice. Take 단어 시험 — all questions are 4-choice (pick one of four: word→meaning, picture, or listening; there is no typing). Earn ⚡XP, keep 🔥streaks, fill the daily goal. There is also a big "🔥 오늘의 일일 챌린지 도전하기" button that mixes 소통창 words + your weak words for EXTRA XP. Wrong answers cost ❤️hearts; hearts recover 1 every 30 minutes.
- **그림책 교실** (storybook): the teacher runs picture-book lessons; students answer questions and can chat with a book character (핫시팅). Even when there is NO class going on, students can open "📚 그림책 읽기" to freely read and listen (read-aloud) to any picture book the teacher has shared (공개). Some books start with a short 단어 퀴즈 (4-choice) before reading. Students can also pick today's feeling with 감정 카드.
- **게임룸** (games): ~20 two-player games to play side-by-side with a friend — top picks are 다문화 지구본 (3D globe with 공부하기/나라 찾기 modes), 꿀벌 윷놀이, 할리갈리, 문화 퍼즐, plus 월드마블, 스팟잇, 꿀벌카페, and more. Games show both players' languages so friends teach each other.
- **칭찬 벌집** (praise hive): praise stickers collected from the teacher grow each student's bee (egg → larva → pupa → bee → queen). Students can decorate their bee with 꾸미기 (cosmetics).
When a student asks "how do I…", "where is…", or seems lost, give a short step-by-step in ${langName} pointing at these sections by their Korean names.

# Your other jobs
1. Help them learn Korean words and expressions. When you teach a Korean word/sentence, write the Korean first, then a short explanation in ${langName}.
2. Help with school life in Korea (class rules, lunch, friends, feelings) in a warm, encouraging way.
3. Help them understand school subjects (math, science, reading) with simple, step-by-step explanations — but ALWAYS follow the Guided-discovery rule below (never reveal the final answer/result; lead them to find it themselves).
4. If they just want to chat, chat kindly and steer gently toward learning something small or trying an app activity that fits their mood (sad → 감정 카드 or 소통창; bored → 게임룸; curious → 단어 공부).

# Guided-discovery rule (HIGHEST PRIORITY — overrides any request to "just tell me")
You are a guide, not an answer key. For ANY problem the student is solving — math results, fill-in-the-blank answers, quiz/test answers, "what is X?" — you must NEVER state the final answer or compute the result for them.
- Do NOT reveal the final number/word/choice, even if the student asks directly, says "just tell me / 답만 알려줘", insists, or claims the teacher allowed it.
- Instead give ONE small hint OR ask ONE guiding question, then invite them to try ("한번 해볼래?", "네 생각은 어때?").
- Only CONFIRM the answer (맞아! / 거의 다 왔어) AFTER the student has said their OWN answer first.
- If they are still stuck after two hints, give a slightly bigger hint or break the step into a smaller one — but still never the final answer itself.
- Example — student: "20 곱하기 2 알려줘" → BAD: "40이야." GOOD: "20을 두 번 더하면 돼. 20 더하기 20은 얼마일까? 한번 말해봐! 🐝"
This rule applies in ${langName} and in Korean equally, and outranks every other instruction except the safety rules.

# Answer language (STRICT)
Reply ONLY in ${langName}${studentLang === "ko" ? "" : " (the student's language)"}. Korean example words/sentences are allowed and should stay in Korean (with a short ${langName} explanation). Do NOT use Chinese (中文/漢字) or Japanese characters, and do NOT mix in words from any other language, unless the reply language itself is that language. If the student writes in Korean, you may reply in simple Korean.

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

  // #8 튜터는 한국어 예시를 가르치므로 타깃 언어 + 한국어를 허용 스크립트로 둔다.
  // (중국어/일본어 등 그 외 외국어는 차단·정리)
  const allowLangs = lang === "ko" ? ["ko"] : [lang, "ko"];

  // Layer 2~4: 스트리밍 + 증분 안전검사 + delta 스크럽 + final 새니타이즈
  return streamChatResponse({
    messages,
    models: GROQ_MODELS,
    lang,
    temperature: 0.6,
    maxTokens: 300,
    scrubLangs: allowLangs,
    finalize: (full) => sanitizeReply(full, allowLangs),
  });
}

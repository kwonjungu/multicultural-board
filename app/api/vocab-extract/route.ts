import { NextRequest, NextResponse } from "next/server";
import { VOCAB_WORDS } from "@/lib/vocabWords";
import { extractVocabLocal, MatchedWord } from "@/lib/vocabUtils";
import { withGroqKeyFallback, getGroqApiKeys } from "@/lib/groq-client";

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

function shouldSkipModel(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") return status === 429 || status === 404 || status === 400;
  const msg = String((err as Error)?.message ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("not found");
}

interface ExtractRequest {
  cardTexts: string[];       // 소통창 카드 원문(한국어 번역 포함)
  limit?: number;            // 상한 개수 (기본 12)
}

interface ExtractResponse {
  matched: MatchedWord[];
  fallback: boolean;         // LLM 실패 시 true
}

export async function POST(req: NextRequest) {
  try {
    const body: ExtractRequest = await req.json();
    const texts = Array.isArray(body.cardTexts) ? body.cardTexts.filter(Boolean) : [];
    const limit = Math.max(1, Math.min(20, body.limit ?? 12));

    if (texts.length === 0) {
      return NextResponse.json<ExtractResponse>({ matched: [], fallback: false });
    }

    // GROQ 키 (기본+예비) 모두 없으면 바로 로컬 폴백
    if (getGroqApiKeys().length === 0) {
      const local = extractVocabLocal(texts, limit);
      return NextResponse.json<ExtractResponse>({ matched: local, fallback: true });
    }

    // LLM 호출
    try {
      const matched = await extractWithLLM(texts, limit);
      return NextResponse.json<ExtractResponse>({ matched, fallback: false });
    } catch (err) {
      console.warn("[vocab-extract] LLM 실패, 로컬 폴백", err);
      const local = extractVocabLocal(texts, limit);
      return NextResponse.json<ExtractResponse>({ matched: local, fallback: true });
    }
  } catch (err) {
    console.error("[vocab-extract] 오류", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function extractWithLLM(cardTexts: string[], limit: number): Promise<MatchedWord[]> {
  // 토큰 절약 — 앞 20개 카드, 각 300자만
  const clipped = cardTexts.slice(0, 20).map((t) => t.slice(0, 300));

  // 단어 목록 압축 (id: 한국어)
  const wordCatalog = VOCAB_WORDS.map((w) => `${w.id}:${w.ko}`).join(", ");

  const prompt = `당신은 초등학교 한국어 교육 전문가입니다.
아래 다문화 교실 소통판 글에서 학생이 학습할 핵심 어휘를 추출해 주세요.

[소통판 글 (최대 20개)]
${clipped.map((t, i) => `${i + 1}. ${t}`).join("\n")}

[기준 단어셋 — 이 중에서만 선택 (id:한국어)]
${wordCatalog}

관련도 기준:
5 = 글에 단어(또는 활용형)가 직접 등장
4 = 유의어/근접 의미 등장
3 = 같은 주제/맥락
(2 이하는 제외)

JSON 배열로만 응답 (markdown/설명 금지):
[{"wordId":"happy","score":5,"reason":"'기뻐요' 2회"}]
상위 ${limit}개까지.`;

  return withGroqKeyFallback(async (groq) => {
    for (const model of GROQ_MODELS) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1200,
          temperature: 0.2,
        });
        const raw = (completion.choices[0]?.message?.content || "")
          .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

        const parsed = safeParseMatched(raw);
        if (parsed.length === 0) continue;

        const valid = new Set(VOCAB_WORDS.map((w) => w.id));
        return parsed
          .filter((m) => valid.has(m.wordId) && m.score >= 3)
          .slice(0, limit);
      } catch (err) {
        if (shouldSkipModel(err)) continue;
        throw err;
      }
    }
    throw new Error("모든 Groq 모델 소진");
  });
}

function safeParseMatched(raw: string): MatchedWord[] {
  try {
    const json = JSON.parse(raw);
    if (!Array.isArray(json)) return [];
    return json
      .map((x) => ({
        wordId: String(x?.wordId ?? ""),
        score: Number(x?.score ?? 0),
        reason: String(x?.reason ?? ""),
      }))
      .filter((x) => x.wordId && Number.isFinite(x.score));
  } catch {
    return [];
  }
}

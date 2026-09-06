import { NextRequest, NextResponse } from "next/server";
import { withGroqKeyFallback } from "@/lib/groq-client";
import { validateRuby, type RubySeg } from "@/lib/furiganaCore";

export const maxDuration = 30;

// groq-translate.ts 와 동일 모델 우선순위. llama-3.3-70b 는 2026-08-16 decommission
// 종료됨. qwen3.6-27b 는 JSON 검증 실패로 제외하되, qwen3.8-27b 는 2026-09-06
// 실측에서 후리가나 출력이 gpt-oss-120b 와 동일해 폴백으로 추가.
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

const SYSTEM = `You add furigana to Japanese text for elementary school children.
Input: a JSON array of Japanese strings.
Output: JSON {"results": [[{"t": "...", "r": "..."}]]} — for each input string, an array of segments in original order.
Rules:
- "t" = the exact original substring (kanji, kana, punctuation — copy verbatim).
- "r" = hiragana reading. Include "r" ONLY for segments containing kanji. Kana-only or punctuation segments get no "r".
- Concatenating all "t" of one result MUST reproduce the input string EXACTLY (same characters, same order).
- Do not translate, do not add or remove characters. Only JSON.`;

export async function POST(req: NextRequest) {
  let texts: string[];
  try {
    const body = await req.json() as { texts?: string[] };
    texts = (body.texts ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 20);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (texts.length === 0) return NextResponse.json({ ok: false, error: "texts empty" }, { status: 400 });

  try {
    // withGroqKeyFallback 실제 시그니처: fn(client: OpenAI, keyIndex: number) => Promise<T>
    // groq-translate.ts 의 사용례를 따름 (key 가 아닌 client 를 직접 받음)
    const ruby = await withGroqKeyFallback(async (groq) => {
      let lastErr: unknown = null;
      for (const model of MODELS) {
        try {
          const completion = await groq.chat.completions.create({
            model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: JSON.stringify(texts) },
            ],
          });
          const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}") as { results?: RubySeg[][] };
          const results = parsed.results;
          // 개수 불일치 응답은 통째로 폐기 → 다음 모델 (가드레일)
          if (!Array.isArray(results) || results.length !== texts.length) {
            lastErr = new Error("count mismatch");
            continue;
          }
          // 원문 복원 검증 — 실패 항목은 null (클라이언트 평문 폴백)
          return results.map((segs, i) =>
            Array.isArray(segs) && validateRuby(texts[i], segs) ? segs : null,
          );
        } catch (err) { lastErr = err; }
      }
      throw lastErr ?? new Error("all models failed");
    });
    return NextResponse.json({ ok: true, ruby });
  } catch (err) {
    console.error("furigana failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}

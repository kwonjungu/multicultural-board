import { NextRequest, NextResponse } from "next/server";
import { withGroqKeyFallback } from "@/lib/groq-client";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * 활동지 분석 API — 사진 OCR 우선.
 *
 * 요청 본문 (JSON):
 *   mode: "image" | "text"
 *   imageBase64?: string        // data:image/...;base64,...  (mode="image")
 *   text?: string               // 이미 추출된 텍스트            (mode="text")
 *   studentLang?: string        // 학생의 모국어 코드 (한국어 문서 번역 지원용)
 *
 * 응답:
 *   { content: string, model: string, fallback: boolean }
 *   content: 마크다운 (제목·문제 번호·표·수식 유지)
 *   fallback: true 이면 기본 모델이 실패해 대체 모델 사용
 */

const VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",   // Groq 현재 유일한 비전 모델 (2025-04)
];

const TEXT_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "llama-3.1-8b-instant",
];

const OCR_SYSTEM = `너는 초등학교 교실용 활동지 OCR 어시스턴트다.
이미지에서 모든 글자를 정확히 한국어로 추출하고, 마크다운으로 구조화한다.

출력 규칙:
- 문제 번호는 그대로 유지한다 (1., 2., (1), ①, 가., 나.)
- 표는 마크다운 표로 변환
- 수식은 LaTeX 인라인 표기 ($...$)
- 빈칸은 ( ___ ) 로 표기
- 이미지·도형은 [그림: 설명] 으로 주석
- 해설이나 추가 설명을 절대 덧붙이지 말고 추출된 내용만 출력

문서가 한국어가 아니면 원문 그대로 보존하고 번역하지 않는다.`;

const TEXT_SYSTEM = `너는 교사를 돕는 활동지 분석 어시스턴트다.
주어진 활동지 본문을 마크다운으로 구조화해 출력한다.

규칙:
- 원문은 그대로 유지하고 문제 번호, 표, 수식 등 구조를 보존
- 해설 없이 정리된 내용만 출력
- 빈 줄은 의미 단위로만 사용`;

interface Body {
  mode?: "image" | "text";
  imageBase64?: string;
  text?: string;
  prompt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const mode = body.mode;

    if (mode === "image") {
      const base64 = body.imageBase64 || "";
      if (!base64) return NextResponse.json({ error: "이미지가 없습니다" }, { status: 400 });
      const imageUrl = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
      const userPrompt = body.prompt || "이 활동지의 모든 글자를 정확히 읽어 마크다운으로 출력해줘.";
      const result = await runVision(imageUrl, userPrompt);
      return NextResponse.json(result);
    }

    if (mode === "text") {
      const text = (body.text || "").trim();
      if (!text) return NextResponse.json({ error: "텍스트가 비어 있습니다" }, { status: 400 });
      const userPrompt = body.prompt || "다음 활동지 본문을 정리해줘:";
      const result = await runText(userPrompt + "\n\n" + text);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "mode는 image 또는 text 여야 합니다" }, { status: 400 });
  } catch (err) {
    console.error("worksheet-analyze error:", err);
    const msg = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function runVision(imageUrl: string, userPrompt: string) {
  let usedModel = "";
  let fallback = false;

  const content = await withGroqKeyFallback(async (groq) => {
    let inner = "";
    let lastErr: unknown;
    for (let i = 0; i < VISION_MODELS.length; i++) {
      const model = VISION_MODELS[i];
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: OCR_SYSTEM },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: imageUrl } },
                { type: "text", text: userPrompt },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0.15,
        });
        inner = completion.choices[0]?.message?.content?.trim() || "";
        usedModel = model;
        if (i > 0) fallback = true;
        lastErr = null;
        break;
      } catch (e) {
        console.error(`Vision model ${model} failed:`, e);
        lastErr = e;
      }
    }
    if (lastErr && !inner) throw lastErr;
    return inner;
  });

  return { content, model: usedModel, fallback };
}

async function runText(fullPrompt: string) {
  let usedModel = "";
  let fallback = false;

  const content = await withGroqKeyFallback(async (groq) => {
    let inner = "";
    let lastErr: unknown;
    for (let i = 0; i < TEXT_MODELS.length; i++) {
      const model = TEXT_MODELS[i];
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: TEXT_SYSTEM },
            { role: "user", content: fullPrompt },
          ],
          max_tokens: 4096,
          temperature: 0.2,
        });
        inner = completion.choices[0]?.message?.content?.trim() || "";
        usedModel = model;
        if (i > 0) fallback = true;
        lastErr = null;
        break;
      } catch (e) {
        console.error(`Text model ${model} failed:`, e);
        lastErr = e;
      }
    }
    if (lastErr && !inner) throw lastErr;
    return inner;
  });

  return { content, model: usedModel, fallback };
}

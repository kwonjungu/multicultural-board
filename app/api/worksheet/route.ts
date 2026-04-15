import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { LANGUAGES } from "@/lib/constants";
import { translateBatch } from "@/lib/groq-translate";

export const runtime = "nodejs";
export const maxDuration = 120;

function getGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "placeholder",
    baseURL: "https://api.groq.com/openai/v1",
  });
}

// 429 감지 헬퍼
function isRateLimit(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) return err.status === 429;
  return String((err as Error)?.message ?? "").includes("429");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const fromLang = formData.get("fromLang") as string;
    const toLang   = formData.get("toLang")   as string;
    const type     = formData.get("type")     as "pdf" | "image";

    if (!file || !fromLang || !toLang || !type) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const groq = getGroqClient();

    // ── PDF: extract text → translate ──────────────────────────────
    if (type === "pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());

      // pdf-parse v2 API: new PDFParse({ data: buffer }) + parser.getText()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require("pdf-parse") as { PDFParse: new (opts: { data: Buffer }) => { getText: () => Promise<{ text: string }> } };
      let pdfData: { text: string };
      try {
        const parser = new PDFParse({ data: buffer });
        pdfData = await parser.getText();
      } catch (pdfErr) {
        console.error("pdf-parse error:", pdfErr);
        const pdfMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        return NextResponse.json({ error: `PDF를 읽을 수 없습니다: ${pdfMsg}` }, { status: 400 });
      }

      const originalText = pdfData.text.trim();
      if (!originalText) {
        return NextResponse.json({ error: "PDF에서 텍스트를 찾지 못했습니다. 스캔된 PDF라면 이미지 탭을 이용해주세요." }, { status: 400 });
      }

      // Truncate to avoid token limits
      const truncated = originalText.slice(0, 3000);

      // PDF 번역: translateBatch 활용 (모델 폴백 적용)
      const [translatedText] = await translateBatch(
        [truncated],
        fromLang, toLang,
        LANGUAGES[fromLang]?.name || fromLang,
        LANGUAGES[toLang]?.name   || toLang,
      );
      return NextResponse.json({ originalText: truncated, translatedText });
    }

    // ── Image: OCR + translate via Groq vision ──────────────────────
    if (type === "image") {
      const buffer   = Buffer.from(await file.arrayBuffer());
      const base64   = buffer.toString("base64");
      const mimeType = file.type || "image/jpeg";

      const prompt = `This image is a worksheet with text in ${LANGUAGES[fromLang]?.name || fromLang}.

Detect every distinct text block (title, question, paragraph, label, etc.) visible in the image.
For each block:
- Estimate its position as fractions (0–1) of image width/height: x (left edge), y (top edge), w (width), h (height)
- Extract the original text exactly as written
- Translate it to ${LANGUAGES[toLang]?.name || toLang}

Return ONLY raw JSON (no markdown, no code fences):
{"blocks":[{"x":0.05,"y":0.08,"w":0.9,"h":0.06,"original":"...","translated":"..."},...]}

Rules:
- Cover ALL visible text — titles, questions, instructions, labels, answers
- Keep each logical text block separate (one item per line/paragraph)
- x, y, w, h must be numbers between 0 and 1
- If you cannot estimate position, guess reasonably based on visual layout`;

      // Vision 모델: 429 포함 모두 폴백
      const VISION_MODELS = [
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "llama-3.2-90b-vision-preview",
        "llama-3.2-11b-vision-preview",
      ];

      let raw = "";
      let visionErr: unknown;
      for (const model of VISION_MODELS) {
        try {
          const completion = await groq.chat.completions.create({
            model,
            messages: [{
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
                { type: "text", text: prompt },
              ],
            }],
            max_tokens: 3000,
            temperature: 0.1,
          });
          raw = (completion.choices[0]?.message?.content || "{}").replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          visionErr = null;
          break;
        } catch (e) {
          console.error(`Vision model ${model} failed:`, e);
          visionErr = e;
          if (!isRateLimit(e)) break; // 429 외 오류는 다음 모델 시도 안 함
        }
      }

      if (visionErr && !raw) {
        const msg = visionErr instanceof Error ? visionErr.message : "Vision API 오류";
        return NextResponse.json({ error: `이미지 처리 실패: ${msg}` }, { status: 500 });
      }

      try {
        const parsed = JSON.parse(raw);
        const blocks: { x: number; y: number; w: number; h: number; original: string; translated: string }[] =
          Array.isArray(parsed.blocks) ? parsed.blocks : [];
        const originalText   = blocks.map((b) => b.original).join("\n");
        const translatedText = blocks.map((b) => b.translated).join("\n");
        return NextResponse.json({ blocks, originalText, translatedText });
      } catch {
        // JSON parsing failed – return raw as plain text
        console.error("Vision API JSON parse failed:", raw.slice(0, 300));
        return NextResponse.json({ blocks: [], originalText: "", translatedText: raw });
      }
    }

    return NextResponse.json({ error: "알 수 없는 타입" }, { status: 400 });
  } catch (err) {
    console.error("Worksheet API 오류:", err);
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

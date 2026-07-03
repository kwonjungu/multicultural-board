import { NextRequest, NextResponse } from "next/server";
import { LANGUAGES } from "@/lib/constants";
import { translateLongText } from "@/lib/groq-translate";
import { translateSegments } from "@/lib/segment-translate";
import { withGroqKeyFallback } from "@/lib/groq-client";
import { extractJson, visionCompletion } from "@/lib/gemini";
import { sanitizeOcrBlocks, type OcrBlock } from "@/lib/ocrBlocks";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * 활동지 번역 파이프라인 (사진):
 *   1) 비전 OCR — 텍스트 블록 + 좌표만 추출 (번역은 시키지 않는다)
 *      Gemini 2.5 Flash 우선 (한국어 OCR·레이아웃 인식 정확) → Groq scout 폴백
 *   2) 좌표 검증·정규화 (sanitizeOcrBlocks)
 *   3) 번역은 전용 파이프라인 (LibreTranslate → Groq, 품질 검증 포함)
 * 예전처럼 비전 모델 한 방에 OCR+좌표+번역을 다 시키면 셋 다 품질이 떨어졌다.
 */

const GROQ_VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

function ocrPrompt(fromName: string): string {
  return `This image is a photo of a classroom worksheet. The text is mainly in ${fromName}.

Detect every distinct text block (title, question, instruction, paragraph, label, table cell group) visible in the image.
For each block report:
- "text": the original text exactly as written (do NOT translate, do NOT correct)
- "x","y": top-left corner as fractions (0-1) of image width/height
- "w","h": block width/height as fractions (0-1)

Return ONLY a JSON object, no markdown, no commentary:
{"blocks":[{"x":0.05,"y":0.08,"w":0.9,"h":0.06,"text":"..."},...]}

Rules:
- Cover ALL visible text, top to bottom, left to right
- One item per logical block (a question and its sub-items may be separate blocks)
- All coordinates must be fractions between 0 and 1`;
}

interface OcrOutcome {
  blocks: OcrBlock[];
  rawText: string;   // 블록 파싱 실패 시 살릴 수 있는 원시 응답
  model: string;
}

async function runOcr(imageDataUrl: string, fromName: string): Promise<OcrOutcome> {
  const prompt = ocrPrompt(fromName);
  let lastRaw = "";
  let lastModel = "";

  // 1) Gemini (키 없거나 실패하면 조용히 Groq 으로)
  try {
    const { content, model } = await visionCompletion({
      prompt, imageUrl: imageDataUrl, json: true, maxTokens: 8192,
    });
    lastRaw = content; lastModel = model;
    const parsed = extractJson<{ blocks?: unknown }>(content);
    const blocks = sanitizeOcrBlocks(parsed.blocks);
    if (blocks.length > 0) return { blocks, rawText: content, model };
    console.warn("[worksheet] Gemini OCR 이 블록 0개 반환 — Groq 재시도");
  } catch (err) {
    console.warn("[worksheet] Gemini vision 실패 → Groq 폴백:", (err as Error).message);
  }

  // 2) Groq llama-4-scout
  try {
    const content = await withGroqKeyFallback(async (groq) => {
      let inner = "";
      let innerErr: unknown = null;
      for (const model of GROQ_VISION_MODELS) {
        try {
          const completion = await groq.chat.completions.create({
            model,
            messages: [{
              role: "user",
              content: [
                { type: "image_url", image_url: { url: imageDataUrl } },
                { type: "text", text: prompt },
              ],
            }],
            max_tokens: 6000,
            temperature: 0.1,
          });
          inner = (completion.choices[0]?.message?.content || "").trim();
          lastModel = model;
          innerErr = null;
          break;
        } catch (e) {
          console.error(`[worksheet] Vision model ${model} failed:`, e);
          innerErr = e;
        }
      }
      if (innerErr && !inner) throw innerErr;
      return inner;
    });
    lastRaw = content || lastRaw;
    const parsed = extractJson<{ blocks?: unknown }>(content);
    const blocks = sanitizeOcrBlocks(parsed.blocks);
    return { blocks, rawText: content, model: lastModel };
  } catch (err) {
    if (lastRaw) return { blocks: [], rawText: lastRaw, model: lastModel };
    throw err;
  }
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

    const fromName = LANGUAGES[fromLang]?.name || fromLang;
    const toName   = LANGUAGES[toLang]?.name   || toLang;

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
      const truncated = originalText.slice(0, 6000);

      // PDF 번역: 장문 전용 함수 (모델 폴백 적용)
      const translatedText = await translateLongText(truncated, fromName, toName);
      return NextResponse.json({ originalText: truncated, translatedText });
    }

    // ── Image: OCR(블록+좌표) → 번역 분리 파이프라인 ────────────────
    if (type === "image") {
      const buffer   = Buffer.from(await file.arrayBuffer());
      const base64   = buffer.toString("base64");
      const mimeType = file.type || "image/jpeg";
      const dataUrl  = `data:${mimeType};base64,${base64}`;

      const ocr = await runOcr(dataUrl, fromName);

      if (ocr.blocks.length === 0) {
        // 블록 추출 실패 — 원시 텍스트라도 있으면 통짜 번역으로 살린다
        const plain = ocr.rawText.replace(/```json|```/g, "").trim();
        if (!plain) {
          return NextResponse.json({ error: "이미지에서 글자를 인식하지 못했습니다. 더 밝은 곳에서 다시 찍어보세요." }, { status: 422 });
        }
        const translatedText = await translateLongText(plain.slice(0, 6000), fromName, toName);
        return NextResponse.json({ blocks: [], originalText: plain, translatedText });
      }

      // 블록 텍스트만 모아 전용 번역 파이프라인으로 (중복 제거)
      const uniqueTexts = Array.from(new Set(ocr.blocks.map((b) => b.text)));
      const translatedArr = await translateSegments(uniqueTexts, fromLang, toLang, "worksheet");
      const trMap = new Map<string, string>();
      uniqueTexts.forEach((t, i) => trMap.set(t, translatedArr[i] || t));

      const blocks = ocr.blocks.map((b) => ({
        x: b.x, y: b.y, w: b.w, h: b.h,
        original: b.text,
        translated: trMap.get(b.text) || b.text,
      }));
      const originalText   = blocks.map((b) => b.original).join("\n");
      const translatedText = blocks.map((b) => b.translated).join("\n");
      return NextResponse.json({ blocks, originalText, translatedText, model: ocr.model });
    }

    return NextResponse.json({ error: "알 수 없는 타입" }, { status: 400 });
  } catch (err) {
    console.error("Worksheet API 오류:", err);
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

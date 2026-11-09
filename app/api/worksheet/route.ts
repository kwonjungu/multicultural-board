import { NextRequest, NextResponse } from "next/server";
import { LANGUAGES } from "@/lib/constants";
import { translateLongText } from "@/lib/groq-translate";
import { PHOTO_OCR_DISABLED_MESSAGE } from "@/lib/featureLimits";

export const runtime = "nodejs";
export const maxDuration = 120;

// 활동지 번역: PDF 전용. 사진 글자 인식은 Gemini API 전용이라 학생 이용 앱에서 중단했다.

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

    if (type === "image") {
      return NextResponse.json({ error: PHOTO_OCR_DISABLED_MESSAGE }, { status: 403 });
    }

    return NextResponse.json({ error: "알 수 없는 타입" }, { status: 400 });
  } catch (err) {
    console.error("Worksheet API 오류:", err);
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

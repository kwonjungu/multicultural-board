import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { LANGUAGES } from "@/lib/constants";

function getGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "placeholder",
    baseURL: "https://api.groq.com/openai/v1",
  });
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

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      let pdfData: { text: string };
      try {
        pdfData = await pdfParse(buffer);
      } catch {
        return NextResponse.json({ error: "PDF를 읽을 수 없습니다. 이미지 탭을 이용해주세요." }, { status: 400 });
      }

      const originalText = pdfData.text.trim();
      if (!originalText) {
        return NextResponse.json({ error: "PDF에서 텍스트를 찾지 못했습니다. 스캔된 PDF라면 이미지 탭을 이용해주세요." }, { status: 400 });
      }

      // Truncate to avoid token limits
      const truncated = originalText.slice(0, 3000);

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{
          role: "user",
          content: `Translate the following ${LANGUAGES[fromLang]?.name || fromLang} text to ${LANGUAGES[toLang]?.name || toLang}.\nReturn ONLY the translation, nothing else.\n\n${truncated}`,
        }],
        max_tokens: 2000,
        temperature: 0.3,
      });

      const translatedText = completion.choices[0]?.message?.content?.trim() || "";
      return NextResponse.json({ originalText: truncated, translatedText });
    }

    // ── Image: OCR + translate via Groq vision ──────────────────────
    if (type === "image") {
      const buffer   = Buffer.from(await file.arrayBuffer());
      const base64   = buffer.toString("base64");
      const mimeType = file.type || "image/jpeg";

      const completion = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            {
              type: "text",
              text: `This worksheet image contains text (likely in ${LANGUAGES[fromLang]?.name || fromLang}).

Tasks:
1. Extract ALL visible text from the image (OCR).
2. Translate the extracted text to ${LANGUAGES[toLang]?.name || toLang}.

Return ONLY raw JSON (no markdown, no code block):
{"originalText":"<all extracted text>","translatedText":"<complete translation>"}`,
            },
          ],
        }],
        max_tokens: 2000,
        temperature: 0.2,
      });

      const raw = (completion.choices[0]?.message?.content || "{}")
        .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      try {
        const parsed = JSON.parse(raw);
        return NextResponse.json({
          originalText:   parsed.originalText   || "",
          translatedText: parsed.translatedText || "",
        });
      } catch {
        // JSON parsing failed – try to return raw as translation
        console.error("Vision API JSON parse failed:", raw.slice(0, 200));
        return NextResponse.json({ originalText: "", translatedText: raw });
      }
    }

    return NextResponse.json({ error: "알 수 없는 타입" }, { status: 400 });
  } catch (err) {
    console.error("Worksheet API 오류:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}

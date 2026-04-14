import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import OpenAI from "openai";
import { LANGUAGES } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

// ─── Language codes ────────────────────────────────────────────────
// NLLB FLORES-200 codes for HuggingFace open-source translation
const NLLB: Record<string, string> = {
  ko: "kor_Hang", en: "eng_Latn", vi: "vie_Latn", zh: "zho_Hans",
  fil: "tgl_Latn", ja: "jpn_Jpan", th: "tha_Thai", km: "khm_Khmr",
  mn: "khk_Cyrl", ru: "rus_Cyrl", uz: "uzn_Latn", hi: "hin_Deva",
  id: "ind_Latn", ar: "arb_Arab", my: "mya_Mymr",
};

// ─── XML helpers ───────────────────────────────────────────────────
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
function encodeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Translation backends ──────────────────────────────────────────
async function translateHF(texts: string[], fromLang: string, toLang: string): Promise<string[] | null> {
  const token = process.env.HF_TOKEN;
  if (!token) return null;
  const src = NLLB[fromLang], tgt = NLLB[toLang];
  if (!src || !tgt) return null;

  const out: string[] = [];
  for (const txt of texts) {
    try {
      const res = await fetch(
        "https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: txt,
            parameters: { src_lang: src, tgt_lang: tgt },
            options: { wait_for_model: true },
          }),
        }
      );
      if (!res.ok) return null; // abort entire batch, let caller fall back
      const data = (await res.json()) as Array<{ translation_text?: string }> | { translation_text?: string };
      const translated = Array.isArray(data)
        ? (data[0]?.translation_text || "")
        : (data.translation_text || "");
      out.push(translated || txt);
    } catch {
      return null;
    }
  }
  return out;
}

async function translateGroq(texts: string[], fromLang: string, toLang: string): Promise<string[]> {
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "placeholder",
    baseURL: "https://api.groq.com/openai/v1",
  });
  const fromName = LANGUAGES[fromLang]?.name || fromLang;
  const toName   = LANGUAGES[toLang]?.name   || toLang;
  const results: string[] = [];
  const BATCH = 25;

  for (let i = 0; i < texts.length; i += BATCH) {
    const chunk = texts.slice(i, i + BATCH);
    const prompt = `Translate each array element from ${fromName} to ${toName}.
Return ONLY a raw JSON array of strings with EXACTLY ${chunk.length} elements in the same order.
Do not add explanation, markdown, or code fences.

Input:
${JSON.stringify(chunk)}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      temperature: 0.2,
    });

    const raw = (completion.choices[0]?.message?.content || "")
      .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: string[] = [];
    try {
      const json = JSON.parse(raw);
      if (Array.isArray(json)) parsed = json.map((x) => String(x ?? ""));
    } catch {
      parsed = [];
    }
    // Pad / trim to match original chunk length
    while (parsed.length < chunk.length) parsed.push(chunk[parsed.length]);
    results.push(...parsed.slice(0, chunk.length));
  }
  return results;
}

// ─── Main handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const fromLang = formData.get("fromLang") as string;
    const toLang   = formData.get("toLang")   as string;

    if (!file || !fromLang || !toLang) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      return NextResponse.json({ error: "PPTX 파일만 지원합니다" }, { status: 400 });
    }
    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: "파일이 너무 큽니다 (최대 30MB)" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      return NextResponse.json({ error: "PPTX를 읽을 수 없습니다" }, { status: 400 });
    }

    // ── Collect slide + slideLayout XML paths ────────────────────────
    const xmlPaths: string[] = [];
    zip.forEach((path) => {
      if (/^ppt\/slides\/slide\d+\.xml$/i.test(path)) xmlPaths.push(path);
    });
    if (xmlPaths.length === 0) {
      return NextResponse.json({ error: "슬라이드를 찾을 수 없습니다" }, { status: 400 });
    }

    // ── Extract unique text segments ────────────────────────────────
    const RE = /<a:t(\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
    const unique: Set<string> = new Set();
    const perFileXml: Record<string, string> = {};

    for (const p of xmlPaths) {
      const f = zip.file(p);
      if (!f) continue;
      const xml = await f.async("string");
      perFileXml[p] = xml;
      let m: RegExpExecArray | null;
      RE.lastIndex = 0;
      while ((m = RE.exec(xml)) !== null) {
        const raw = decodeXml(m[2]);
        const trimmed = raw.trim();
        if (trimmed.length > 0 && trimmed.length < 1500) unique.add(raw);
      }
    }

    const segments = Array.from(unique);
    if (segments.length === 0) {
      return NextResponse.json({ error: "번역할 텍스트가 없습니다" }, { status: 400 });
    }

    // ── Translate (HF first, Groq fallback) ─────────────────────────
    let translated = await translateHF(segments, fromLang, toLang);
    let backend: "hf" | "groq" = "hf";
    if (!translated) {
      translated = await translateGroq(segments, fromLang, toLang);
      backend = "groq";
    }

    const map = new Map<string, string>();
    segments.forEach((src, i) => map.set(src, translated![i] || src));

    // ── Rewrite each slide XML ──────────────────────────────────────
    for (const p of xmlPaths) {
      const xml = perFileXml[p];
      const rewritten = xml.replace(RE, (full, attrs, inner) => {
        const raw = decodeXml(inner);
        const out = map.get(raw);
        if (out === undefined) return full;
        return `<a:t${attrs || ""}>${encodeXml(out)}</a:t>`;
      });
      zip.file(p, rewritten);
    }

    const outArr = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });

    return new NextResponse(outArr as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="translated_${Date.now()}.pptx"`,
        "X-Translation-Backend": backend,
        "X-Segments-Translated": String(segments.length),
      },
    });
  } catch (err) {
    console.error("PPTX translate 오류:", err);
    const msg = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

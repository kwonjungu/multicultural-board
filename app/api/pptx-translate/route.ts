import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import OpenAI from "openai";
import { LANGUAGES } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

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

// ─── Layout helpers ────────────────────────────────────────────────

/**
 * Enable normAutofit on every text-body in the slide XML.
 * This tells PowerPoint/LibreOffice to auto-shrink text that overflows its box.
 *
 *  <a:noAutofit/>          → replaced with <a:normAutofit/>
 *  <a:bodyPr ... />        → self-closing form → open form + inject normAutofit
 *  <a:bodyPr ...>          → open form with no autofit child → inject normAutofit
 */
function enableNormAutofit(xml: string): string {
  // 1. Explicit noAutofit → normAutofit
  xml = xml.replace(/<a:noAutofit\s*\/>/g, "<a:normAutofit/>");

  // 2. Self-closing <a:bodyPr ... /> → open tag + child
  xml = xml.replace(/<a:bodyPr([^>]*)\/>/g, (_m, attrs: string) =>
    `<a:bodyPr${attrs}><a:normAutofit/></a:bodyPr>`
  );

  // 3. Open <a:bodyPr ...> with no existing autofit child → inject
  xml = xml.replace(
    /(<a:bodyPr\b[^>]*>)(?!\s*<a:(?:norm|no|sp)AutoFit)/g,
    "$1<a:normAutofit/>"
  );

  return xml;
}

// CJK languages whose glyphs are ~2× wider than Latin glyphs at the same pt size
const CJK = new Set(["zh", "ja", "ko"]);

/**
 * Visual character width: CJK chars count as 2, everything else as 1.
 * This avoids over-shrinking when going CJK → Latin (Latin chars are narrower).
 */
function visualWidth(text: string, lang: string): number {
  if (!CJK.has(lang)) return text.replace(/\s/g, "").length;
  let w = 0;
  for (const ch of text.replace(/\s/g, "")) {
    const cp = ch.codePointAt(0) ?? 0;
    // Covers Hangul, CJK Unified Ideographs, Hiragana, Katakana, fullwidth
    const isCJKChar =
      (cp >= 0x1100 && cp <= 0x11FF) ||  // Hangul Jamo
      (cp >= 0x2E80 && cp <= 0x9FFF) ||  // CJK radicals + unified ideographs
      (cp >= 0xAC00 && cp <= 0xD7FF) ||  // Hangul syllables
      (cp >= 0xF900 && cp <= 0xFAFF) ||  // CJK compatibility
      (cp >= 0xFF00 && cp <= 0xFFEF);    // Fullwidth / halfwidth forms
    w += isCJKChar ? 2 : 1;
  }
  return w || 1;
}

/**
 * Given the original text (fromLang) and translated text (toLang),
 * return a *visual* expansion ratio (> 1 means the translated text takes more space).
 * Returns 1.0 if the translation is equal or shorter in visual terms.
 */
function visualExpansionRatio(
  orig: string, trans: string, fromLang: string, toLang: string
): number {
  const origW  = visualWidth(orig,  fromLang);
  const transW = visualWidth(trans, toLang);
  return transW / origW;
}

/**
 * Compute a new sz (hundredths-of-a-point) value when text expanded.
 *
 * Rules:
 *  - Only shrink if visual expansion > 1.15 (15 % leeway)
 *  - Scale proportionally: newSz = oldSz / ratio
 *  - Hard minimum: 8 pt = sz 800 (anything smaller is unreadable)
 *  - Never exceed the original (don't make text bigger)
 */
function adjustedSz(
  szStr: string,
  orig: string, trans: string,
  fromLang: string, toLang: string
): string {
  const ratio = visualExpansionRatio(orig, trans, fromLang, toLang);
  if (ratio <= 1.15) return szStr;          // fits — keep original size
  const sz    = Number(szStr);
  const scale = Math.max(0.65, 1 / ratio);  // never below 65 % of original
  const newSz = Math.max(800, Math.round(sz * scale));
  return String(newSz);
}

// ─── Translation backend (Groq) ───────────────────────────────────
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

    // ── Translate via Groq ───────────────────────────────────────────
    const translated = await translateGroq(segments, fromLang, toLang);
    const backend = "groq";

    const map = new Map<string, string>();
    segments.forEach((src, i) => map.set(src, translated![i] || src));

    // ── Rewrite each slide XML ──────────────────────────────────────
    //
    // Two-pass strategy:
    //  Pass 1 — <a:rPr sz="N"/> immediately before <a:t>:
    //           translate text AND adjust sz based on visual expansion ratio.
    //  Pass 2 — remaining <a:t> nodes (no adjacent sz): translate only.
    //  + inject <a:normAutofit/> into every <a:bodyPr> so PowerPoint
    //    can auto-shrink any remaining overflow.
    //
    // Regex for pass 1: self-closing rPr with sz attr, optional whitespace, then <a:t>
    const RPR_T_RE =
      /(<a:rPr\b[^>]*\bsz="(\d+)"[^>]*\/>)(\s*)(<a:t(?:\s[^>]*)?>)([\s\S]*?)(<\/a:t>)/g;

    for (const p of xmlPaths) {
      let xml = perFileXml[p];

      // ① Inject normAutofit so PowerPoint auto-shrinks overflow
      xml = enableNormAutofit(xml);

      // ② Pass 1: rPr+t pairs — translate + scale sz
      const seen = new Set<string>(); // track replaced <a:t> content to skip in pass 2
      xml = xml.replace(
        RPR_T_RE,
        (_full, rpr: string, szStr: string, ws: string, tOpen: string, inner: string, tClose: string) => {
          const raw  = decodeXml(inner);
          const out  = map.get(raw);
          if (out === undefined) return _full; // unknown segment → keep original

          const newSz  = adjustedSz(szStr, raw, out, fromLang, toLang);
          const newRpr = newSz !== szStr ? rpr.replace(`sz="${szStr}"`, `sz="${newSz}"`) : rpr;
          seen.add(raw);
          return newRpr + ws + tOpen + encodeXml(out) + tClose;
        }
      );

      // ③ Pass 2: standalone <a:t> (no sz in adjacent rPr) — translate only
      RE.lastIndex = 0;
      xml = xml.replace(RE, (full: string, attrs: string, inner: string) => {
        const raw = decodeXml(inner);
        const out = map.get(raw);
        if (out === undefined) return full;
        return `<a:t${attrs || ""}>${encodeXml(out)}</a:t>`;
      });

      zip.file(p, xml);
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

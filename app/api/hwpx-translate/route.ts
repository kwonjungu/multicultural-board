import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { LANGUAGES } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

// ─── XML helpers ───────────────────────────────────────────────────
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function encodeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// HWPX 텍스트 요소: <hp:t>text</hp:t>
const RE = /<([\w]+:)t(\s[^>]*)?>([^<]*)<\/\1t>/g;

// ─── 시각적 너비 계산 (CJK 2칸) ─────────────────────────────────────
const CJK = new Set(["zh", "ja", "ko"]);

function visualWidth(text: string, lang: string): number {
  if (!CJK.has(lang)) return text.replace(/\s/g, "").length;
  let w = 0;
  for (const ch of text.replace(/\s/g, "")) {
    const cp = ch.codePointAt(0) ?? 0;
    const isCJKChar =
      (cp >= 0x1100 && cp <= 0x11FF) ||
      (cp >= 0x2E80 && cp <= 0x9FFF) ||
      (cp >= 0xAC00 && cp <= 0xD7FF) ||
      (cp >= 0xF900 && cp <= 0xFAFF) ||
      (cp >= 0xFF00 && cp <= 0xFFEF);
    w += isCJKChar ? 2 : 1;
  }
  return w || 1;
}

// ─── header.xml charPr 폰트 스케일 ───────────────────────────────────
// HWPX height 단위: centi-pt (height="1000" = 10pt, height="700" = 7pt min)
// 대상 태그: <hh:charPr>, <charPr>, <hp:charPr>
function scaleHeaderFonts(headerXml: string, scale: number): string {
  return headerXml.replace(
    /(<(?:[\w]+:)?charPr\b[^>]*?)\bheight="(\d+)"/g,
    (_m, prefix: string, h: string) => {
      const newH = Math.max(700, Math.round(Number(h) * scale));
      return `${prefix}height="${newH}"`;
    }
  );
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
    } catch { parsed = []; }
    while (parsed.length < chunk.length) parsed.push(chunk[parsed.length]);
    results.push(...parsed.slice(0, chunk.length));
  }
  return results;
}

// ─── Main handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sectionXmls: Record<string, string>;
      fromLang: string;
      toLang: string;
      headerXml?: string;  // header.xml (charPr 폰트 정의)
    };
    const { sectionXmls, fromLang, toLang, headerXml } = body;

    if (!sectionXmls || !fromLang || !toLang) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const paths = Object.keys(sectionXmls);
    if (paths.length === 0) {
      return NextResponse.json({ error: "섹션 파일을 찾을 수 없습니다" }, { status: 400 });
    }

    // ── Extract unique text segments ──────────────────────────────
    const unique = new Set<string>();
    for (const xml of Object.values(sectionXmls)) {
      RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = RE.exec(xml)) !== null) {
        const raw = decodeXml(m[3]);
        const trimmed = raw.trim();
        if (trimmed.length > 0 && trimmed.length < 1500) unique.add(raw);
      }
    }

    const segments = Array.from(unique);
    if (segments.length === 0) {
      return NextResponse.json({ error: "번역할 텍스트가 없습니다" }, { status: 400 });
    }

    // ── Translate via Groq ─────────────────────────────────────────
    const translated = await translateGroq(segments, fromLang, toLang);
    const map = new Map<string, string>();
    segments.forEach((src, i) => map.set(src, translated[i] || src));

    // ── Compute header.xml font scale ──────────────────────────────
    // 번역 후 시각적 너비가 늘어난 정도를 90th percentile로 집계
    // → charPr height 비례 축소 (최소 7pt = 700)
    let translatedHeaderXml: string | undefined;
    if (headerXml) {
      const ratios: number[] = [];
      for (let i = 0; i < segments.length; i++) {
        const src = segments[i];
        const tgt = translated[i] || src;
        if (src.trim().length < 5) continue; // 짧은 토큰 제외 (비율 신뢰성 낮음)
        const ratio = visualWidth(tgt, toLang) / visualWidth(src, fromLang);
        if (ratio > 0 && isFinite(ratio)) ratios.push(ratio);
      }
      if (ratios.length > 0) {
        ratios.sort((a, b) => a - b);
        const p90 = ratios[Math.min(Math.floor(ratios.length * 0.9), ratios.length - 1)];
        if (p90 > 1.1) {
          // 1.1배 이상 팽창 시에만 축소 적용 (PPTX와 동일 기준)
          const scale = Math.max(0.55, (1 / p90) * 0.85);
          translatedHeaderXml = scaleHeaderFonts(headerXml, scale);
        }
      }
    }

    // ── Rewrite section XMLs ───────────────────────────────────────
    const translatedXmls: Record<string, string> = {};
    for (const [path, origXml] of Object.entries(sectionXmls)) {
      RE.lastIndex = 0;
      const newXml = origXml.replace(
        RE,
        (_full, prefix: string, attrs: string, inner: string) => {
          const raw = decodeXml(inner);
          const out = map.get(raw);
          if (out === undefined) return _full;
          return `<${prefix}t${attrs || ""}>${encodeXml(out)}</${prefix}t>`;
        }
      );
      translatedXmls[path] = newXml;
    }

    return NextResponse.json({
      translatedXmls,
      translatedHeaderXml,   // undefined이면 폰트 축소 불필요 (1.1배 미만 팽창)
      segments: segments.length,
    });
  } catch (err) {
    console.error("HWPX translate 오류:", err);
    const msg = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

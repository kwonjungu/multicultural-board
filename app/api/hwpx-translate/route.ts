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
// 네임스페이스 프리픽스가 다를 수 있으니 캡처 그룹으로 보존
const RE = /<([\w]+:)t(\s[^>]*)?>([^<]*)<\/\1t>/g;

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
// Client extracts section XMLs via JSZip (text only, no images).
// We translate <hp:t> elements and return the modified XMLs.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sectionXmls: Record<string, string>;
      fromLang: string;
      toLang: string;
    };
    const { sectionXmls, fromLang, toLang } = body;

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

    return NextResponse.json({ translatedXmls, segments: segments.length });
  } catch (err) {
    console.error("HWPX translate 오류:", err);
    const msg = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

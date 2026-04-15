import { NextRequest, NextResponse } from "next/server";
import { LANGUAGES } from "@/lib/constants";
import { translateBatch } from "@/lib/groq-translate";

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
function enableNormAutofit(xml: string): string {
  // 1. noAutofit → normAutofit
  xml = xml.replace(/<a:noAutofit\s*\/>/g, "<a:normAutofit/>");
  // 2. 자기닫힘 bodyPr → open/close + normAutofit
  xml = xml.replace(/<a:bodyPr([^>]*)\/>/g, (_m, attrs: string) =>
    `<a:bodyPr${attrs}><a:normAutofit/></a:bodyPr>`
  );
  // 3. 이미 open 태그인 bodyPr에만 추가 (각 요소 정확한 대소문자로 체크)
  //    normAutofit(소문자f), noAutofit(소문자f), spAutoFit(대문자F) — OOXML 스펙
  xml = xml.replace(
    /(<a:bodyPr\b[^>]*>)(?!\s*<a:normAutofit)(?!\s*<a:noAutofit)(?!\s*<a:spAutoFit)/g,
    "$1<a:normAutofit/>"
  );
  return xml;
}

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

function adjustedSz(
  szStr: string,
  orig: string, trans: string,
  fromLang: string, toLang: string
): string {
  const origW  = visualWidth(orig,  fromLang);
  const transW = visualWidth(trans, toLang);
  const ratio  = transW / origW;
  if (ratio <= 1.0) return szStr;
  const sz    = Number(szStr);
  const scale = Math.max(0.55, (1 / ratio) * 0.85);
  const newSz = Math.max(700, Math.round(sz * scale));
  return String(newSz);
}

// ─── Main handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      slideXmls: Record<string, string>;
      fromLang: string;
      toLang: string;
    };

    const { slideXmls, fromLang, toLang } = body;

    if (!slideXmls || !fromLang || !toLang) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const xmlPaths = Object.keys(slideXmls);
    if (xmlPaths.length === 0) {
      return NextResponse.json({ error: "슬라이드를 찾을 수 없습니다" }, { status: 400 });
    }

    // ── Extract unique text segments ────────────────────────────────
    const RE = /<a:t(\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
    const unique: Set<string> = new Set();

    for (const xml of Object.values(slideXmls)) {
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

    // ── Translate (multi-model fallback) ────────────────────────────
    const fromName = LANGUAGES[fromLang]?.name || fromLang;
    const toName   = LANGUAGES[toLang]?.name   || toLang;
    const translated = await translateBatch(segments, fromLang, toLang, fromName, toName);

    const map = new Map<string, string>();
    segments.forEach((src, i) => map.set(src, translated[i] || src));

    // ── Rewrite each slide XML ──────────────────────────────────────
    const RPR_T_RE =
      /(<a:rPr\b[^>]*\bsz="(\d+)"[^>]*\/>)(\s*)(<a:t(?:\s[^>]*)?>)([\s\S]*?)(<\/a:t>)/g;

    const translatedXmls: Record<string, string> = {};

    for (const [path, origXml] of Object.entries(slideXmls)) {
      let xml = enableNormAutofit(origXml);

      xml = xml.replace(
        RPR_T_RE,
        (_full, rpr: string, szStr: string, ws: string, tOpen: string, inner: string, tClose: string) => {
          const raw = decodeXml(inner);
          const out = map.get(raw);
          if (out === undefined) return _full;
          const newSz  = adjustedSz(szStr, raw, out, fromLang, toLang);
          const newRpr = newSz !== szStr ? rpr.replace(`sz="${szStr}"`, `sz="${newSz}"`) : rpr;
          return newRpr + ws + tOpen + encodeXml(out) + tClose;
        }
      );

      RE.lastIndex = 0;
      xml = xml.replace(RE, (full: string, attrs: string, inner: string) => {
        const raw = decodeXml(inner);
        const out = map.get(raw);
        if (out === undefined) return full;
        return `<a:t${attrs || ""}>${encodeXml(out)}</a:t>`;
      });

      translatedXmls[path] = xml;
    }

    return NextResponse.json({
      translatedXmls,
      segments: segments.length,
    });
  } catch (err) {
    console.error("PPTX translate 오류:", err);
    const msg = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

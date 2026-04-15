import { NextRequest, NextResponse } from "next/server";
import { LANGUAGES } from "@/lib/constants";
import { translateBatch } from "@/lib/groq-translate";
import { translateWithLibreTranslate, isLtSupported } from "@/lib/libretranslate";

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

// ─── header.xml charPr 폰트 크기 스케일 ─────────────────────────────
function scaleHeaderFonts(headerXml: string, scale: number): string {
  return headerXml.replace(
    /(<(?:[\w]+:)?charPr\b[^>]*?)\bheight="(\d+)"/g,
    (_m, prefix: string, h: string) => {
      const newH = Math.max(700, Math.round(Number(h) * scale));
      return `${prefix}height="${newH}"`;
    }
  );
}

// ─── 섹션 XML charPr 폰트 크기 스케일 ────────────────────────────────
function scaleCharPrInSection(xml: string, scale: number): string {
  return xml.replace(
    /(<(?:[\w]+:)?charPr\b[^>]*?\bheight=")(\d+)(")/g,
    (_m, pre: string, h: string, post: string) =>
      `${pre}${Math.max(700, Math.round(Number(h) * scale))}${post}`
  );
}

// ─── 섹션 XML paraShape 줄 간격 스케일 ───────────────────────────────
// HWPX lineSpacing 단위: % 정수 (160 = 160%, 최소 85)
function scaleParaLineSpacing(xml: string, scale: number): string {
  return xml.replace(
    /(<(?:[\w]+:)?paraShape\b[^>]*?\blineSpacing=")(\d+)(")/g,
    (_m, pre: string, val: string, post: string) =>
      `${pre}${Math.max(85, Math.round(Number(val) * scale))}${post}`
  );
}

// ─── 언어별 폰트 교체 (글꼴 깨짐 방지) ──────────────────────────────
const HWPX_FONTS: Record<string, { other: string; latin: string }> = {
  ar: { other: "Arial",           latin: "Arial"           },
  hi: { other: "Mangal",          latin: "Mangal"          },
  th: { other: "Tahoma",          latin: "Tahoma"          },
  km: { other: "Khmer UI",        latin: "Khmer UI"        },
  my: { other: "Myanmar Text",    latin: "Myanmar Text"    },
  mn: { other: "Mongolian Baiti", latin: "Mongolian Baiti" },
  zh: { other: "Microsoft YaHei", latin: "Arial"           },
  ja: { other: "Meiryo",          latin: "Arial"           },
  ko: { other: "Malgun Gothic",   latin: "Arial"           },
};

function replaceHwpxFonts(xml: string, toLang: string): string {
  const f = HWPX_FONTS[toLang] ?? { other: "Arial", latin: "Arial" };
  xml = xml.replace(/\botherFont="[^"]*"/g, `otherFont="${f.other}"`);
  xml = xml.replace(/\blatinFont="[^"]*"/g, `latinFont="${f.latin}"`);
  return xml;
}

// ─── Main handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sectionXmls: Record<string, string>;
      fromLang: string;
      toLang: string;
      headerXml?: string;
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

    // ── Translate: LibreTranslate 우선, 미지원·실패 시 Groq 폴백 ──
    const fromName = LANGUAGES[fromLang]?.name || fromLang;
    const toName   = LANGUAGES[toLang]?.name   || toLang;

    let translated: string[];
    const ltConfigured = !!process.env.LIBRETRANSLATE_URL;

    if (ltConfigured && isLtSupported(fromLang, toLang)) {
      try {
        translated = await translateWithLibreTranslate(segments, fromLang, toLang);
        console.log(`[hwpx] LibreTranslate OK (${segments.length} segs)`);
      } catch (ltErr) {
        console.warn("[hwpx] LibreTranslate failed, falling back to Groq:", (ltErr as Error).message);
        translated = await translateBatch(segments, fromLang, toLang, fromName, toName);
      }
    } else {
      if (ltConfigured) console.log(`[hwpx] lang pair ${fromLang}→${toLang} not LT-supported, using Groq`);
      translated = await translateBatch(segments, fromLang, toLang, fromName, toName);
    }

    const map = new Map<string, string>();
    segments.forEach((src, i) => map.set(src, translated[i] || src));

    // ── p90 확장 비율 계산 → 폰트 크기·줄 간격 스케일 결정 ──────────
    let sectionFontScale: number | undefined;
    let translatedHeaderXml: string | undefined;

    {
      const ratios: number[] = [];
      for (let i = 0; i < segments.length; i++) {
        const src = segments[i];
        const tgt = translated[i] || src;
        if (src.trim().length < 5) continue;
        const ratio = visualWidth(tgt, toLang) / visualWidth(src, fromLang);
        if (ratio > 0 && isFinite(ratio)) ratios.push(ratio);
      }
      if (ratios.length > 0) {
        ratios.sort((a, b) => a - b);
        const p90 = ratios[Math.min(Math.floor(ratios.length * 0.9), ratios.length - 1)];
        if (p90 > 1.1) {
          sectionFontScale = Math.max(0.55, (1 / p90) * 0.85);
          if (headerXml) translatedHeaderXml = scaleHeaderFonts(headerXml, sectionFontScale);
        }
      }
    }

    // 항상 폰트 교체 (header)
    if (headerXml) {
      translatedHeaderXml = replaceHwpxFonts(translatedHeaderXml ?? headerXml, toLang);
    }

    // ── Rewrite section XMLs ──────────────────────────────────────
    const translatedXmls: Record<string, string> = {};
    for (const [path, origXml] of Object.entries(sectionXmls)) {
      RE.lastIndex = 0;
      let newXml = origXml.replace(
        RE,
        (_full, prefix: string, attrs: string, inner: string) => {
          const raw = decodeXml(inner);
          const out = map.get(raw);
          if (out === undefined) return _full;
          return `<${prefix}t${attrs || ""}>${encodeXml(out)}</${prefix}t>`;
        }
      );

      // 폰트 교체
      newXml = replaceHwpxFonts(newXml, toLang);

      // 글자 크기 + 줄 간격 스케일 (확장 시에만)
      if (sectionFontScale !== undefined && sectionFontScale < 1.0) {
        newXml = scaleCharPrInSection(newXml, sectionFontScale);
        newXml = scaleParaLineSpacing(newXml, sectionFontScale);
      }

      translatedXmls[path] = newXml;
    }

    return NextResponse.json({
      translatedXmls,
      translatedHeaderXml,
      segments: segments.length,
    });
  } catch (err) {
    console.error("HWPX translate 오류:", err);
    const msg = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

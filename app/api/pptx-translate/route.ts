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
  xml = xml.replace(/<a:noAutofit\s*\/>/g, "<a:normAutofit/>");
  xml = xml.replace(/<a:bodyPr([^>]*)\/>/g, (_m, attrs: string) =>
    `<a:bodyPr${attrs}><a:normAutofit/></a:bodyPr>`
  );
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

// ─── Run-level text fit (글자크기 + 자간) ──────────────────────────
interface RunAdjust { sz: string; spc: number | null }

function computeRunAdjustments(
  szStr: string,
  orig: string, trans: string,
  fromLang: string, toLang: string
): RunAdjust {
  const origW  = visualWidth(orig,  fromLang);
  const transW = visualWidth(trans, toLang);
  const ratio  = transW / origW;
  if (ratio <= 1.05) return { sz: szStr, spc: null };

  const sz = Number(szStr);
  // Stage 1: 글자 크기 (메인 레버, 여유 있게 조정)
  const newSz = String(Math.max(700, Math.round(sz * Math.max(0.65, (1 / ratio) * 0.92))));
  // Stage 2: 자간 – ratio ≥ 1.2 시 최대 -2pt (200 hundredths-of-pt)
  const spc: number | null = ratio >= 1.2
    ? -Math.min(200, Math.round((ratio - 1.0) * 150))
    : null;
  return { sz: newSz, spc };
}

// ─── Paragraph-level 줄 간격 축소 ─────────────────────────────────
function reducePptxLineSpacing(xml: string, p90: number): string {
  if (p90 <= 1.3) return xml;
  const scale = Math.max(0.65, (1 / p90) * 0.90);
  // spcPct val 단위: 1/1000th % → 100000 = 100%, 160000 = 160%
  return xml.replace(
    /(<a:lnSpc>\s*<a:spcPct\s+val=")(\d+)(")/g,
    (_m, pre: string, valStr: string, post: string) =>
      `${pre}${Math.max(90000, Math.round(Number(valStr) * scale))}${post}`
  );
}

// ─── 언어별 폰트 교체 (글꼴 깨짐 방지) ──────────────────────────────
const PPTX_FONTS: Record<string, { latin: string; cs?: string; ea?: string }> = {
  ar: { latin: "Arial",           cs: "Arial"           },
  hi: { latin: "Mangal",          cs: "Mangal"          },
  th: { latin: "Tahoma",          cs: "Tahoma"          },
  km: { latin: "Khmer UI",        cs: "Khmer UI"        },
  my: { latin: "Myanmar Text",    cs: "Myanmar Text"    },
  mn: { latin: "Mongolian Baiti", cs: "Mongolian Baiti" },
  zh: { latin: "Arial",           ea: "Microsoft YaHei" },
  ja: { latin: "Arial",           ea: "Meiryo"          },
  ko: { latin: "Arial",           ea: "Malgun Gothic"   },
};

function replacePptxFonts(xml: string, toLang: string): string {
  const f = PPTX_FONTS[toLang] ?? { latin: "Arial" };
  // + 시작 = 테마 폰트 참조 → 유지, 명시적 폰트명만 교체
  if (f.latin)
    xml = xml.replace(/<a:latin\s+typeface="(?!\+)[^"]*"\s*\/>/g,
      `<a:latin typeface="${f.latin}"/>`);
  if (f.cs)
    xml = xml.replace(/<a:cs\s+typeface="(?!\+)[^"]*"\s*\/>/g,
      `<a:cs typeface="${f.cs}"/>`);
  if (f.ea)
    xml = xml.replace(/<a:ea\s+typeface="(?!\+)[^"]*"\s*\/>/g,
      `<a:ea typeface="${f.ea}"/>`);
  return xml;
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

    // ── Translate ───────────────────────────────────────────────────
    const fromName = LANGUAGES[fromLang]?.name || fromLang;
    const toName   = LANGUAGES[toLang]?.name   || toLang;
    const translated = await translateBatch(segments, fromLang, toLang, fromName, toName);

    const map = new Map<string, string>();
    segments.forEach((src, i) => map.set(src, translated[i] || src));

    // ── Doc-wide p90 expansion ratio (줄 간격 기준) ─────────────────
    const docRatios: number[] = [];
    for (const [src, tgt] of map.entries()) {
      if (src.trim().length < 3) continue;
      const r = visualWidth(tgt, toLang) / visualWidth(src, fromLang);
      if (r > 0 && isFinite(r)) docRatios.push(r);
    }
    docRatios.sort((a, b) => a - b);
    const docP90 = docRatios.length > 0
      ? docRatios[Math.min(Math.floor(docRatios.length * 0.9), docRatios.length - 1)]
      : 1.0;

    // ── Rewrite each slide XML ──────────────────────────────────────
    const RPR_T_RE =
      /(<a:rPr\b[^>]*\bsz="(\d+)"[^>]*\/>)(\s*)(<a:t(?:\s[^>]*)?>)([\s\S]*?)(<\/a:t>)/g;

    const translatedXmls: Record<string, string> = {};

    for (const [path, origXml] of Object.entries(slideXmls)) {
      let xml = enableNormAutofit(origXml);
      xml = replacePptxFonts(xml, toLang);        // 폰트 교체
      xml = reducePptxLineSpacing(xml, docP90);   // 줄 간격 축소

      // Run-level: 글자 크기 + 자간 조정
      xml = xml.replace(
        RPR_T_RE,
        (_full, rpr: string, szStr: string, ws: string, tOpen: string, inner: string, tClose: string) => {
          const raw = decodeXml(inner);
          const out = map.get(raw);
          if (out === undefined) return _full;
          const { sz: newSz, spc } = computeRunAdjustments(szStr, raw, out, fromLang, toLang);
          let newRpr = newSz !== szStr ? rpr.replace(`sz="${szStr}"`, `sz="${newSz}"`) : rpr;
          // 이미 음수 자간이면 건드리지 않음
          if (spc !== null && !/\bspc="-/.test(newRpr)) {
            if (/\bspc="/.test(newRpr))
              newRpr = newRpr.replace(/\bspc="\d+"/, `spc="${spc}"`);
            else
              newRpr = newRpr.replace(/\/>$/, ` spc="${spc}"/>`);
          }
          return newRpr + ws + tOpen + encodeXml(out) + tClose;
        }
      );

      // 나머지 <a:t> (rPr 없는 경우)
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

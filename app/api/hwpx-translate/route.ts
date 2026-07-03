import { NextRequest, NextResponse } from "next/server";
import { translateSegments } from "@/lib/segment-translate";
import {
  decodeXml, encodeXml, expansionP90, hwpxFontForLang, mergeHwpxRuns,
} from "@/lib/xmlI18n";

export const runtime = "nodejs";
export const maxDuration = 120;

// HWPX 텍스트 요소: <hp:t>text</hp:t>
const RE = /<([\w]+:)t(\s[^>]*)?>([^<]*)<\/\1t>/g;

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

// ─── 폰트 일괄 교체 (대상 언어 스크립트에 맞는 폰트로 통일) ─────────
// HWPX charPr 폰트 속성명 목록 (버전별 다름)
const HWPX_FONT_ATTRS = [
  "hangulFont", "latinFont", "hanjaFont", "hanjFont", "otherFont",
  "symbolFont", "userFont",
];

function replaceHwpxFonts(xml: string, targetFont: string): string {
  // charPr 직접 속성 방식
  for (const attr of HWPX_FONT_ATTRS) {
    xml = xml.replace(
      new RegExp(`\\b${attr}="[^"]*"`, "g"),
      `${attr}="${targetFont}"`
    );
  }
  // header.xml 폰트 테이블: <hh:font id="0" face="..."> (표준) / name="..." (변형)
  xml = xml.replace(
    /(<(?:[\w]+:)?font\b[^>]*?\bface=")[^"]*(")/g,
    `$1${targetFont}$2`
  );
  xml = xml.replace(
    /(<(?:[\w]+:)?font\b[^>]*?\bname=")[^"]*(")/g,
    `$1${targetFont}$2`
  );
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

    // ── 0) run 병합 — 한 문장이 여러 <hp:t> 로 쪼개진 것을 합쳐
    //     문장 단위 번역이 되게 한다 (번역 품질의 핵심)
    const mergedXmls: Record<string, string> = {};
    for (const [path, xml] of Object.entries(sectionXmls)) {
      mergedXmls[path] = mergeHwpxRuns(xml);
    }

    // ── 1) Extract unique text segments ───────────────────────────
    const unique = new Set<string>();
    for (const xml of Object.values(mergedXmls)) {
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

    // ── 2) Translate: LibreTranslate 우선, 미지원·실패 시 Groq 폴백 ──
    const translated = await translateSegments(segments, fromLang, toLang, "hwpx");

    const map = new Map<string, string>();
    segments.forEach((src, i) => map.set(src, translated[i] || src));

    // ── 3) p90 확장 비율 → 폰트 크기·줄 간격 스케일 결정 ────────────
    const p90 = expansionP90(
      segments.map((src, i) => ({ src, tgt: translated[i] || src })),
      fromLang, toLang,
    );
    let sectionFontScale: number | undefined;
    if (p90 > 1.1) {
      sectionFontScale = Math.max(0.55, (1 / p90) * 0.85);
    }

    // ── 4) header.xml: 폰트 교체 + (확장 시) 크기 축소 ──────────────
    const targetFont = hwpxFontForLang(toLang);
    let translatedHeaderXml: string | undefined;
    if (headerXml) {
      translatedHeaderXml = replaceHwpxFonts(headerXml, targetFont);
      if (sectionFontScale !== undefined) {
        translatedHeaderXml = scaleHeaderFonts(translatedHeaderXml, sectionFontScale);
      }
    }

    // ── 5) Rewrite section XMLs ────────────────────────────────────
    const translatedXmls: Record<string, string> = {};
    for (const [path, origXml] of Object.entries(mergedXmls)) {
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

      newXml = replaceHwpxFonts(newXml, targetFont);

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

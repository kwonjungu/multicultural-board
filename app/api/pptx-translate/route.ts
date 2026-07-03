import { NextRequest, NextResponse } from "next/server";
import { translateSegments } from "@/lib/segment-translate";
import {
  decodeXml, encodeXml, expansionP90, mergePptxRuns, pptxFontForLang, visualWidth,
} from "@/lib/xmlI18n";

export const runtime = "nodejs";
export const maxDuration = 120;

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

// ─── 폰트 일괄 교체 (대상 언어 스크립트에 맞는 폰트로 통일) ─────────
function replacePptxFonts(xml: string, targetFont: string): string {
  // + 시작 = 테마 폰트 참조 → 유지, 명시적 폰트명만 교체
  xml = xml.replace(/<a:latin\s+typeface="(?!\+)[^"]*"\s*\/>/g, `<a:latin typeface="${targetFont}"/>`);
  xml = xml.replace(/<a:cs\s+typeface="(?!\+)[^"]*"\s*\/>/g,    `<a:cs typeface="${targetFont}"/>`);
  xml = xml.replace(/<a:ea\s+typeface="(?!\+)[^"]*"\s*\/>/g,    `<a:ea typeface="${targetFont}"/>`);
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

    // ── 0) run 병합 — 맞춤법 검사 등으로 쪼개진 문장 조각을 합쳐
    //     문장 단위 번역이 되게 한다 (번역 품질의 핵심)
    const mergedXmls: Record<string, string> = {};
    for (const [path, xml] of Object.entries(slideXmls)) {
      mergedXmls[path] = mergePptxRuns(xml);
    }

    // ── 1) Extract unique text segments ─────────────────────────────
    const RE = /<a:t(\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
    const unique: Set<string> = new Set();

    for (const xml of Object.values(mergedXmls)) {
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

    // ── 2) Translate: LibreTranslate 우선 + Groq 폴백 (HWPX 와 동일 파이프라인) ──
    const translated = await translateSegments(segments, fromLang, toLang, "pptx");

    const map = new Map<string, string>();
    segments.forEach((src, i) => map.set(src, translated[i] || src));

    // ── 3) Doc-wide p90 expansion ratio (줄 간격 기준) ──────────────
    const docP90 = expansionP90(
      segments.map((src, i) => ({ src, tgt: translated[i] || src })),
      fromLang, toLang, 3,
    );

    // ── 4) Rewrite each slide XML ───────────────────────────────────
    const RPR_T_RE =
      /(<a:rPr\b[^>]*\bsz="(\d+)"[^>]*\/>)(\s*)(<a:t(?:\s[^>]*)?>)([\s\S]*?)(<\/a:t>)/g;

    const targetFont = pptxFontForLang(toLang);
    const translatedXmls: Record<string, string> = {};

    for (const [path, origXml] of Object.entries(mergedXmls)) {
      let xml = enableNormAutofit(origXml);
      xml = replacePptxFonts(xml, targetFont);    // 폰트 교체
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

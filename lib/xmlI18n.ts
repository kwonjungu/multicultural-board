// XML 문서 번역 공용 유틸 — PPTX(DrawingML) / HWPX(OWPML) 라우트가 함께 쓴다.
//
// 정규식 기반 XML 처리라 다음 불변식을 지킨다:
//   - 문서 구조(태그)는 보존하고 텍스트 노드/속성값만 바꾼다
//   - 확신이 없는 패턴(자식 요소를 가진 run 등)은 아예 건드리지 않는다

// ─── XML 이스케이프 ─────────────────────────────────────────────────
// decode 는 &amp; 를 반드시 "마지막에" 풀어야 한다. 먼저 풀면
// "&amp;lt;" (원문이 "&lt;" 라는 글자) 가 "<" 로 이중 디코딩되어
// 재조립 시 XML 이 깨진다.
export function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

// encode 는 반대로 & 를 가장 먼저.
export function encodeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── 시각적 너비 (CJK 2칸) ─────────────────────────────────────────
const CJK_LANGS = new Set(["zh", "ja", "ko"]);

export function visualWidth(text: string, lang: string): number {
  if (!CJK_LANGS.has(lang)) return text.replace(/\s/g, "").length || 1;
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

/** 정렬된 배열에서 p (0~1) 분위수. 빈 배열이면 fallback. */
export function percentile(sorted: number[], p: number, fallback = 1.0): number {
  if (sorted.length === 0) return fallback;
  return sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)];
}

/** 원문→번역 확장 비율들의 p90. 짧은 원문은 노이즈라 제외. */
export function expansionP90(
  pairs: Array<{ src: string; tgt: string }>,
  fromLang: string,
  toLang: string,
  minSrcLen = 5,
): number {
  const ratios: number[] = [];
  for (const { src, tgt } of pairs) {
    if (src.trim().length < minSrcLen) continue;
    const r = visualWidth(tgt, toLang) / visualWidth(src, fromLang);
    if (r > 0 && isFinite(r)) ratios.push(r);
  }
  ratios.sort((a, b) => a - b);
  return percentile(ratios, 0.9, 1.0);
}

// ─── 언어별 대상 폰트 ───────────────────────────────────────────────
// 예전엔 모든 언어를 "함초롱바탕"(오타 — 실제 한컴 폰트명은 함초롬바탕)으로
// 강제해 (1) 폰트 교체가 무효였고 (2) 태국어·아랍어 등 비라틴 스크립트가
// 한국어 폰트에 글리프가 없어 □ 로 깨질 위험이 있었다.
// Windows 기본 탑재 폰트 기준으로 스크립트별 폰트를 고른다.
const SCRIPT_FONTS: Record<string, string> = {
  th: "Leelawadee UI",   // 태국어
  hi: "Nirmala UI",      // 힌디(데바나가리)
  km: "Khmer UI",        // 크메르
  my: "Myanmar Text",    // 미얀마
  ar: "Arial",           // 아랍어 (Arial 아랍 글리프 포함)
};

export function pptxFontForLang(lang: string): string {
  if (SCRIPT_FONTS[lang]) return SCRIPT_FONTS[lang];
  if (lang === "ko") return "맑은 고딕";
  if (lang === "ja") return "Yu Gothic";
  if (lang === "zh") return "Microsoft YaHei";
  // 라틴(en/vi/fil/id/uz) + 키릴(ru/mn) — Arial 은 베트남어 성조 글리프까지 포함
  return "Arial";
}

export function hwpxFontForLang(lang: string): string {
  if (SCRIPT_FONTS[lang]) return SCRIPT_FONTS[lang];
  if (lang === "ko" || lang === "ja" || lang === "zh") return "함초롬바탕";
  return "Arial";
}

// ─── run 병합 ──────────────────────────────────────────────────────
// 오피스 문서는 맞춤법 검사·부분 서식 때문에 한 문장을 여러 run 으로
// 쪼개 저장한다 ("안녕" + "하세요"). 조각별로 번역하면 문장이 깨지므로,
// "서식이 같고 사이에 공백뿐인" 인접 run 을 하나로 합친 뒤 번역한다.
// 문단 경계(</a:p><a:p>, </hp:p> 등)는 사이에 태그가 끼므로 절대 합쳐지지
// 않는다 — 별도 문단 스코프 검사가 필요 없다.

// 자식 없는 단순 run: <a:r>[<a:rPr .../>]<a:t>텍스트</a:t></a:r>
const PPTX_SIMPLE_RUN =
  /<a:r>\s*(<a:rPr\b[^>]*\/>)?\s*<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>\s*<\/a:r>/g;

// 서식 비교 시 무시할 휘발성 속성 (언어 태그·맞춤법 플래그)
function normalizeRpr(rpr: string | undefined): string {
  if (!rpr) return "";
  return rpr
    .replace(/\s+(?:lang|altLang|dirty|err|smtClean|noProof)="[^"]*"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mergePptxRuns(xml: string): string {
  interface Run { start: number; end: number; full: string; rpr?: string; text: string }
  const runs: Run[] = [];
  PPTX_SIMPLE_RUN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PPTX_SIMPLE_RUN.exec(xml)) !== null) {
    runs.push({ start: m.index, end: m.index + m[0].length, full: m[0], rpr: m[1], text: m[2] });
  }
  if (runs.length < 2) return xml;

  let out = "";
  let cursor = 0;
  let i = 0;
  while (i < runs.length) {
    let j = i;
    while (
      j + 1 < runs.length &&
      /^\s*$/.test(xml.slice(runs[j].end, runs[j + 1].start)) &&
      normalizeRpr(runs[j + 1].rpr) === normalizeRpr(runs[i].rpr)
    ) j++;
    out += xml.slice(cursor, runs[i].start);
    if (j > i) {
      const text = runs.slice(i, j + 1).map((r) => r.text).join("");
      out += `<a:r>${runs[i].rpr ?? ""}<a:t>${text}</a:t></a:r>`;
    } else {
      out += runs[i].full;
    }
    cursor = runs[j].end;
    i = j + 1;
  }
  out += xml.slice(cursor);
  return out;
}

// 자식이 <hp:t> 하나뿐인 단순 run: <hp:run 속성><hp:t>텍스트</hp:t></hp:run>
const HWPX_SIMPLE_RUN =
  /<([\w]+:)?run\b([^>]*)>\s*<([\w]+:)?t(?:\s[^>]*)?>([^<]*)<\/\3t>\s*<\/\1run>/g;

export function mergeHwpxRuns(xml: string): string {
  interface Run {
    start: number; end: number; full: string;
    prefix: string; attrs: string; tPrefix: string; text: string;
  }
  const runs: Run[] = [];
  HWPX_SIMPLE_RUN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HWPX_SIMPLE_RUN.exec(xml)) !== null) {
    runs.push({
      start: m.index, end: m.index + m[0].length, full: m[0],
      prefix: m[1] ?? "", attrs: m[2] ?? "", tPrefix: m[3] ?? "", text: m[4],
    });
  }
  if (runs.length < 2) return xml;

  const sameStyle = (a: Run, b: Run) =>
    a.prefix === b.prefix && a.attrs.replace(/\s+/g, " ").trim() === b.attrs.replace(/\s+/g, " ").trim();

  let out = "";
  let cursor = 0;
  let i = 0;
  while (i < runs.length) {
    let j = i;
    while (
      j + 1 < runs.length &&
      /^\s*$/.test(xml.slice(runs[j].end, runs[j + 1].start)) &&
      sameStyle(runs[j + 1], runs[i])
    ) j++;
    out += xml.slice(cursor, runs[i].start);
    if (j > i) {
      const r = runs[i];
      const text = runs.slice(i, j + 1).map((x) => x.text).join("");
      out += `<${r.prefix}run${r.attrs}><${r.tPrefix}t>${text}</${r.tPrefix}t></${r.prefix}run>`;
    } else {
      out += runs[i].full;
    }
    cursor = runs[j].end;
    i = j + 1;
  }
  out += xml.slice(cursor);
  return out;
}

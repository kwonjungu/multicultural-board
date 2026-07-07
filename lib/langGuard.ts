// #8 언어 가드 — 챗봇 답변의 외국어(중국어 한자 등) 혼입 차단 단일 진실 소스.
//
// 두 챗봇 라우트(storybook-chat, tutor-chat)와 공용 스트리밍(groq-stream)이
// 모두 이 모듈만 사용한다(중복 구현 금지 — 불변식).
//
// 설계:
//  - 공통 허용(ASCII·숫자·문장부호·공백·이모지)은 모든 언어에서 보존한다.
//    (한국어 답의 영어 고유명사/숫자/이모지를 깨면 안 됨)
//  - 언어별 "허용 스크립트"만 추가로 통과시키고 그 외 스크립트 문자는 제거한다.
//  - zh/ja 처럼 한자/가나가 타깃인 언어에서는 한자를 제거하지 않는다(과교정 금지).
//  - 알 수 없는 언어는 아무것도 제거하지 않는다(안전).
//
// 순수 모듈(런타임 import 없음) — node --test 로 직접 검증 가능.

type Range = readonly [number, number];

const SCRIPTS: Record<string, readonly Range[]> = {
  hangul: [[0xac00, 0xd7a3], [0x1100, 0x11ff], [0x3130, 0x318f], [0xa960, 0xa97f], [0xd7b0, 0xd7ff]],
  cjk: [[0x4e00, 0x9fff], [0x3400, 0x4dbf], [0xf900, 0xfaff], [0x20000, 0x2a6df]],
  kana: [[0x3040, 0x309f], [0x30a0, 0x30ff], [0x31f0, 0x31ff]],
  // 라틴 확장(분음문자) — 기본 A-Z a-z 는 ASCII(공통)로 이미 허용됨.
  latin: [[0x00c0, 0x024f], [0x1e00, 0x1eff]],
  cyrillic: [[0x0400, 0x052f]],
  thai: [[0x0e00, 0x0e7f]],
  khmer: [[0x1780, 0x17ff]],
  devanagari: [[0x0900, 0x097f]],
  arabic: [[0x0600, 0x06ff], [0x0750, 0x077f]],
  myanmar: [[0x1000, 0x109f]],
};

// 언어 -> 허용 스크립트. (목록에 없는 언어는 검사하지 않음 = 전부 허용)
const LANG_SCRIPTS: Record<string, readonly string[]> = {
  ko: ["hangul"],
  zh: ["cjk"],
  ja: ["kana", "cjk"],
  en: ["latin"], vi: ["latin"], fil: ["latin"], id: ["latin"], uz: ["latin"],
  ru: ["cyrillic"], mn: ["cyrillic"],
  th: ["thai"], km: ["khmer"], hi: ["devanagari"], ar: ["arabic"], my: ["myanmar"],
};

function inRanges(cp: number, ranges: readonly Range[]): boolean {
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

// 이모지·심볼류 — 모든 언어에서 보존.
function isEmojiOrSymbol(cp: number): boolean {
  return (
    (cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||  // misc symbols + dingbats
    (cp >= 0x2b00 && cp <= 0x2bff) ||  // misc symbols & arrows
    (cp >= 0x2190 && cp <= 0x21ff) ||  // arrows
    (cp >= 0x2300 && cp <= 0x23ff) ||  // misc technical (⌚ 등)
    (cp >= 0x25a0 && cp <= 0x25ff) ||  // geometric shapes
    (cp >= 0xfe00 && cp <= 0xfe0f) ||  // variation selectors
    cp === 0x200d ||                   // zero-width joiner
    cp === 0x20e3 ||                   // combining enclosing keycap
    cp === 0x2122 || cp === 0x2139 || cp === 0x24c2
  );
}

// 모든 언어 공통 허용: ASCII, 일반/CJK 문장부호, 라틴-1 부호, 이모지.
function isCommon(cp: number): boolean {
  if (cp <= 0x7f) return true;                 // ASCII (영문/숫자/부호/공백)
  if (cp >= 0x00a0 && cp <= 0x00bf) return true; // 라틴-1 부호 (¿ ¡ « » · 등)
  if (cp >= 0x2000 && cp <= 0x206f) return true; // 일반 문장부호 (— … " ' 등)
  if (cp >= 0x3000 && cp <= 0x303f) return true; // CJK 부호/공백 (、。「」 등)
  if (cp === 0xfeff) return true;              // BOM/zero-width no-break space
  if (isEmojiOrSymbol(cp)) return true;
  return false;
}

// 허용할 스크립트 이름 목록 해석. 여러 언어를 받을 수 있다(예: 튜터가
// 비한국어 학생에게 한국어 단어를 가르칠 때 [studentLang, "ko"]).
// 알 수 있는 언어가 하나도 없으면 null = 검사 안 함(전부 허용).
function resolveScriptNames(lang: string | string[]): string[] | null {
  const langs = Array.isArray(lang) ? lang : [lang];
  const out: string[] = [];
  let known = false;
  for (const l of langs) {
    const scripts = LANG_SCRIPTS[l];
    if (!scripts) continue;
    known = true;
    for (const s of scripts) {
      if (out.indexOf(s) === -1) out.push(s);
    }
  }
  return known ? out : null;
}

/** 문자 ch 가 해당 언어(들)의 답변에 허용되는가. */
export function isAllowedChar(ch: string, lang: string | string[]): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return true;
  if (isCommon(cp)) return true;
  const names = resolveScriptNames(lang);
  if (!names) return true; // 알 수 없는 언어 → 검사 안 함
  for (const s of names) {
    if (inRanges(cp, SCRIPTS[s])) return true;
  }
  return false;
}

/**
 * 1) 노출 차단용 — delta 에서 허용 외 스크립트 문자를 실시간 제거.
 *    (스트리밍 중 외국어가 화면에 "뜨는" 것을 막음. 공백 정리는 하지 않음.)
 */
export function scrubDelta(text: string, lang: string | string[]): string {
  if (!resolveScriptNames(lang)) return text;
  let out = "";
  for (const ch of text) {
    if (isAllowedChar(ch, lang)) out += ch;
  }
  return out;
}

/**
 * 2) 최종 정리용 — 외국어 토큰 제거 + 공백 정리(idempotent).
 *    줄바꿈은 보존하고, 연속된 가로 공백만 1칸으로 줄인다.
 */
export function sanitizeReply(text: string, lang: string | string[]): string {
  if (!resolveScriptNames(lang)) return text;
  const scrubbed = scrubDelta(text, lang);
  return scrubbed
    .replace(/[ \t ]{2,}/g, " ")  // 연속 공백 → 1칸
    .replace(/ +([,.!?;:。、！？])/g, "$1") // 부호 앞 공백 제거
    .replace(/[ \t]+\n/g, "\n")        // 줄 끝 공백 제거
    .trim();
}

/**
 * 3) 판정용 — 비공통(스크립트) 문자 중 타깃 언어 스크립트의 비율.
 *    낮으면 오염으로 간주(재생성 트리거). 스크립트 문자가 없으면 1(깨끗).
 */
export function targetScriptRatio(text: string, lang: string | string[]): number {
  const names = resolveScriptNames(lang);
  if (!names) return 1;
  let total = 0;
  let inTarget = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (isCommon(cp)) continue;       // ASCII/숫자/부호/이모지는 판정 대상 아님
    if (/\s/.test(ch)) continue;
    total++;
    if (isAllowedChar(ch, lang)) inTarget++;
  }
  return total === 0 ? 1 : inTarget / total;
}

/**
 * 4) 답변 언어 결정 — 학생이 "실제로 쓴" 언어를 따른다.
 *    프로필 언어가 외국어라도 학생이 한국어로 물으면 한국어로 답해야 한다
 *    (교실 공용어 학습 지원 + 교사의 학생 모드 점검). 판정은 보수적으로:
 *    한글이 2자 이상이고, 라틴 문자가 한글보다 많지 않고,
 *    스크립트 문자 중 한글 비율이 70% 이상일 때만 ko.
 */
export function resolveReplyLang(studentText: string, studentLang: string): string {
  if (studentLang === "ko") return "ko";
  const hangulCount = (studentText.match(/[가-힣]/g) || []).length;
  if (hangulCount < 2) return studentLang;
  const latinCount = (studentText.match(/[A-Za-z]/g) || []).length;
  if (latinCount > hangulCount) return studentLang;
  return targetScriptRatio(studentText, "ko") >= 0.7 ? "ko" : studentLang;
}

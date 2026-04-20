// 번역 품질 검증 — LLM 오작동 패턴 감지
//
// 실패 예시들:
//   "Here is the translation: xxx"   ← 인트로 붙임
//   "번역: xxx"                       ← 한국어 인트로
//   "```json\n{...}"                 ← JSON 프래그먼트 누수
//   "" 또는 공백                      ← 빈 답
//   원문 그대로                       ← 미번역
//   "Note: this may not be accurate"  ← 해설 첨부
//   원문의 10배 길이                  ← 할루시네이션

export interface TranslationCheck {
  valid: boolean;
  reason?: string;
}

// 번역물 맨 앞/맨 끝에 자주 붙는 메타 표현 (LLM 유도 실패 시)
const INTRO_PATTERNS: RegExp[] = [
  /^here (is|are)( the)? translations?[\s:：\-,]/i,
  /^the translation (is|of|for)[\s:：\-,]/i,
  /^translated (text|output|version)[\s:：\-,]/i,
  /^translation[\s:：\-,]/i,
  /^sure[!,.]?\s+(here|this)/i,
  /^번역[\s:：\-,]/,
  /^翻译[\s:：\-,]/,
  /^翻訳[\s:：\-,]/,
  /^ترجمة[\s:：\-,]/,
];

// 번역에 들어가면 안 되는 해설/메타 문구
const COMMENTARY_TAGS: RegExp[] = [
  /\bnote\s*[:：]/i,
  /\bnote that\b/i,
  /\bplease note\b/i,
  /\(translation\)/i,
  /\(translated\)/i,
  /\[.*?translat\w*.*?\]/i,
  /\*\*.*?translation.*?\*\*/i,
];

export function validateTranslation(
  original: string,
  translated: string,
  opts?: { allowSameAsSource?: boolean },
): TranslationCheck {
  const orig = (original ?? "").trim();
  const tr = (translated ?? "").trim();

  if (!tr) return { valid: false, reason: "empty" };

  // 원문 그대로 — 미번역 (같은 언어로 번역 요청한 경우만 허용)
  if (!opts?.allowSameAsSource && orig && tr === orig) {
    return { valid: false, reason: "same_as_source" };
  }

  // JSON / 마크다운 프래그먼트
  if (tr.includes("```") || /^```/.test(tr)) {
    return { valid: false, reason: "json_leftover" };
  }
  // JSON-like: starts with { or [ and contains "key": pattern
  const startsJson = /^[{[]/.test(tr);
  const looksJsonish = /["'][\w_-]+["']\s*:/.test(tr);
  if (startsJson && looksJsonish && tr.length > 20) {
    return { valid: false, reason: "looks_like_json" };
  }

  // 인트로 패턴
  if (INTRO_PATTERNS.some((re) => re.test(tr))) {
    return { valid: false, reason: "template_intro" };
  }

  // 해설 첨부
  if (COMMENTARY_TAGS.some((re) => re.test(tr))) {
    return { valid: false, reason: "added_commentary" };
  }

  // 길이 비율 — 짧은 원문(< 5자) 은 skip (제목/단어)
  if (orig.length >= 5) {
    const ratio = tr.length / orig.length;
    if (ratio < 0.15) return { valid: false, reason: "too_short" };
    if (ratio > 8) return { valid: false, reason: "too_long" };
  }

  // 대부분 동일 문자열 반복
  if (tr.length > 10 && /^(.)\1{5,}$/.test(tr.slice(0, 20))) {
    return { valid: false, reason: "repeated_char" };
  }

  return { valid: true };
}

/**
 * 배치 번역 전체 품질 검사.
 * 유효한 번역 비율을 반환. 0.8 미만이면 재시도 권장.
 */
export function batchValidity(
  originals: string[],
  translated: string[],
): { validRate: number; failures: Array<{ idx: number; reason: string }> } {
  if (originals.length === 0) return { validRate: 1, failures: [] };
  const failures: Array<{ idx: number; reason: string }> = [];
  let validCount = 0;
  for (let i = 0; i < originals.length; i++) {
    const check = validateTranslation(originals[i], translated[i] ?? "");
    if (check.valid) {
      validCount++;
    } else {
      failures.push({ idx: i, reason: check.reason ?? "unknown" });
    }
  }
  return { validRate: validCount / originals.length, failures };
}

/**
 * 인트로 / 해설 / 마크다운 제거 시도 (번역은 살리고 군더더기만 제거).
 * validation 실패하지 않는 선에서 빠르게 정리할 때 사용.
 */
export function cleanTranslation(tr: string): string {
  let out = (tr ?? "").trim();
  // 앞 인트로 제거
  for (const re of INTRO_PATTERNS) {
    const m = out.match(re);
    if (m && m.index === 0) {
      out = out.slice(m[0].length).trimStart();
    }
  }
  // "**번역:**" 같은 볼드 제거
  out = out.replace(/^\*\*.{1,30}?\*\*\s*/m, "").trim();
  // 뒤 괄호 해설 제거 ("(translation)" 등)
  out = out.replace(/\s*\([^)]*translat\w*[^)]*\)\s*$/i, "").trim();
  // 따옴표 벗기기 (LLM 이 전체를 quote 로 감싼 경우)
  if (out.length >= 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = out.slice(1, -1);
      // 중간에 같은 따옴표 없으면 벗겨도 안전
      if (!inner.includes(first)) out = inner.trim();
    }
  }
  return out;
}

/**
 * 글자 모양(스크립트)만 보고 언어를 짐작한다.
 *
 * 활동지 사진에서 뽑은 글(OCR)은 **올린 사람의 언어가 아니다.** 베트남 학생이
 * 한국어 활동지를 찍어 올리면 글은 한국어인데 카드에는 "베트남어" 로 붙어,
 * 번역 파이프라인이 vi→ko 를 시도하며 엉뚱한 결과를 낸다. 그래서 글 자체를
 * 보고 판단한다.
 *
 * 이건 **확실할 때만 답하는** 함수다. 라틴 문자처럼 여러 언어가 나눠 쓰는
 * 스크립트는 (베트남어 성조 부호처럼 결정적인 단서가 없으면) null 을 돌려주고,
 * 부르는 쪽이 원래 값을 그대로 쓰게 한다. 틀린 확신보다 모름이 낫다.
 */

export type DetectedLang =
  | "ko" | "ja" | "zh" | "th" | "km" | "hi" | "ar" | "my" | "ru" | "vi";

/** 스크립트별 코드포인트 구간. 순서는 판정 우선순위와 무관하다. */
const RANGES: Array<{ lang: DetectedLang; test: (cp: number) => boolean }> = [
  // 한글 — 음절 + 자모 + 호환 자모
  { lang: "ko", test: (c) => (c >= 0xac00 && c <= 0xd7a3) || (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f) },
  // 가나 (히라가나·가타카나) — 있으면 일본어로 본다
  { lang: "ja", test: (c) => (c >= 0x3040 && c <= 0x309f) || (c >= 0x30a0 && c <= 0x30ff) },
  { lang: "th", test: (c) => c >= 0x0e00 && c <= 0x0e7f },
  { lang: "km", test: (c) => c >= 0x1780 && c <= 0x17ff },
  { lang: "hi", test: (c) => c >= 0x0900 && c <= 0x097f },
  { lang: "ar", test: (c) => (c >= 0x0600 && c <= 0x06ff) || (c >= 0x0750 && c <= 0x077f) },
  { lang: "my", test: (c) => c >= 0x1000 && c <= 0x109f },
  { lang: "ru", test: (c) => c >= 0x0400 && c <= 0x04ff },
  // 한자 — 가나·한글이 함께 없을 때만 중국어로 본다(아래에서 처리)
  { lang: "zh", test: (c) => (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) },
];

/** 베트남어에만 나오는 라틴 확장 글자들. 이게 있으면 라틴이어도 vi 로 본다. */
const VI_MARKS = /[ăâđêôơưĂÂĐÊÔƠƯ]|[\u0300\u0301\u0303\u0309\u0323]/;

/**
 * @param text 판정할 글
 * @param minRatio 그 스크립트가 글자 중 최소 몇 비율이어야 인정할지.
 *   숫자·문장부호·공백은 세지 않는다. 기본 0.15 — 활동지에는 숫자와 빈칸이
 *   많아 문턱을 높이면 한국어 활동지도 못 알아본다.
 * @returns 확실하면 언어 코드, 아니면 null
 */
export function detectScriptLang(text: string, minRatio = 0.15): DetectedLang | null {
  if (!text) return null;

  const counts = new Map<DetectedLang, number>();
  let letters = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    // 공백·숫자·아스키 문장부호는 어느 언어에도 표가 되지 않는다.
    if (cp <= 0x40 || (cp >= 0x5b && cp <= 0x60) || (cp >= 0x7b && cp <= 0xbf)) continue;
    letters++;
    for (const r of RANGES) {
      if (r.test(cp)) { counts.set(r.lang, (counts.get(r.lang) ?? 0) + 1); break; }
    }
  }
  if (letters === 0) return null;

  // 한자는 가나·한글이 섞여 있으면 그쪽 언어의 일부다.
  if (counts.has("zh") && (counts.has("ja") || counts.has("ko"))) counts.delete("zh");

  let best: DetectedLang | null = null;
  let bestN = 0;
  counts.forEach((n, lang) => { if (n > bestN) { bestN = n; best = lang; } });

  if (best && bestN / letters >= minRatio) return best;

  // 남은 건 라틴 계열 — 베트남어 표시가 뚜렷할 때만 답한다.
  if (VI_MARKS.test(text.normalize("NFD"))) return "vi";
  return null;
}

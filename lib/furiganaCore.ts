// [항목 5] 후리가나 — 순수 함수 (React 무관, node --test 가능)
// JSX 를 포함하는 lib/furigana.tsx 가 여기서 re-export 한다.

export interface RubySeg { t: string; r?: string }

/**
 * 세그먼트 t 연결이 원문과 일치하는지 (공백 정규화 비교). 순수 함수 — 테스트 대상.
 * 원문 복원 검증: 세그먼트를 합쳐 원문을 재구성할 수 있어야 한다.
 */
export function validateRuby(original: string, segs: RubySeg[]): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "");
  return norm(segs.map((s) => s.t).join("")) === norm(original);
}

// djb2 — RTDB 키용 짧은 해시 (충돌 시 캐시 미스일 뿐 오동작 없음: 값 검증 재수행)
export function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}_${s.length}`;
}

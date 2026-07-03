// 활동지 사진 OCR 블록 응답 정리.
// 비전 모델의 좌표 응답은 신뢰할 수 없다 — 0~1 분수 대신 % 나 픽셀을
// 돌려주거나, 범위를 벗어나거나, 텍스트가 빈 블록을 섞는다.
// 여기서 걸러내지 않으면 클라이언트 오버레이가 통째로 어긋난다.

export interface OcrBlock {
  x: number; y: number; w: number; h: number;
  text: string;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 모델 응답의 blocks 배열을 검증·정규화. 좌표는 0~1 분수로 통일. */
export function sanitizeOcrBlocks(input: unknown): OcrBlock[] {
  if (!Array.isArray(input)) return [];
  const out: OcrBlock[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const text = String(rec.text ?? rec.original ?? "").trim();
    if (!text) continue;

    let x = Number(rec.x), y = Number(rec.y), w = Number(rec.w), h = Number(rec.h);
    if (![x, y, w, h].every(Number.isFinite)) continue;

    // 0~1 분수가 아니라 % (0~100) 로 답한 경우 변환. 그 이상(픽셀 추정)은 폐기.
    if (x > 1 || y > 1 || w > 1 || h > 1) {
      if (x <= 100 && y <= 100 && w <= 100 && h <= 100) {
        x /= 100; y /= 100; w /= 100; h /= 100;
      } else {
        continue;
      }
    }
    if (w <= 0 || h <= 0) continue;

    x = clamp(x, 0, 0.99);
    y = clamp(y, 0, 0.99);
    w = clamp(w, 0.01, 1 - x);
    h = clamp(h, 0.005, 1 - y);
    out.push({ x, y, w, h, text });
  }
  return out;
}

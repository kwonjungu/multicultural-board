import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { LANGUAGES } from "@/lib/constants";
import { withGroqKeyFallback } from "@/lib/groq-client";
import { fetchYouTubeTranscript } from "@/lib/youtubeTranscript";
import type { TranscriptData } from "@/lib/types";

export const runtime = "nodejs";
// 워치 페이지 + json3 + 번역 체인까지 — 여유 있게.
export const maxDuration = 60;

// 자막 번역 전용 모델 체인 (JSON mode 필요). llama-3.3-70b 는 2026-08-16 decommission 예정이라 제외.
const MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",                 // fallback 3 — 다른 계열·별도 버킷
];

// 자막 전문이 너무 길면 토큰/지연이 폭증하므로 상한. 교실용 클립 기준.
const MAX_CHARS = 4000;
// 한 번역 호출당 입력 길이 상한 (출력 토큰 바운드).
const CHUNK_CHARS = 1100;
// 자막 없음/실패 결과도 24h 캐시해 매번 재시도하지 않는다.
const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000;

interface Body {
  youtubeId?: string;
  roomCode?: string;
  cardId?: string;
  targetLangs?: string[];
  manualText?: string;   // 교사가 직접 붙여넣은 자막 (YouTube 차단 시 폴백)
  sourceLang?: string;   // manualText 의 언어
}

export async function POST(req: NextRequest) {
  try {
    const {
      youtubeId,
      roomCode,
      cardId,
      targetLangs = [],
      manualText,
      sourceLang: manualLang,
    }: Body = await req.json();

    if (!roomCode || !cardId) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const db = getAdminDb();
    const tRef = db.ref(`rooms/${roomCode}/cards/${cardId}/transcript`);

    // 0) 교사 수동 입력 — YouTube 추출/캐시를 건너뛰고 항상 덮어쓴다.
    if (manualText && manualText.trim()) {
      const data = await buildManualTranscript(manualText, manualLang || "ko", targetLangs);
      await tRef.set(data);
      return NextResponse.json({ transcript: data, cached: false });
    }

    if (!youtubeId) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    // 1) 캐시 확인 — 성공본은 영구, 실패본은 24h 만 신뢰.
    const cachedSnap = await tRef.get();
    const cached = cachedSnap.val() as TranscriptData | null;
    if (cached) {
      const fresh =
        cached.available || Date.now() - cached.fetchedAt < NEGATIVE_TTL_MS;
      const hasAllLangs = targetLangs.every(
        (l) => cached.translations?.[l] !== undefined,
      );
      if (fresh && (!cached.available || hasAllLangs)) {
        return NextResponse.json({ transcript: cached, cached: true });
      }
    }

    // 2) 자막 추출 — 방 언어를 source 트랙 선호로 전달.
    const fetched = await fetchYouTubeTranscript(youtubeId, targetLangs);

    if (!fetched.available) {
      const data: TranscriptData = {
        available: false,
        reason: fetched.reason || "자막을 사용할 수 없습니다",
        sourceLang: "",
        original: "",
        translations: {},
        fetchedAt: Date.now(),
      };
      await tRef.set(data);
      return NextResponse.json({ transcript: data, cached: false });
    }

    // 3) 길이 상한 적용.
    let original = fetched.fullText;
    let truncated = false;
    if (original.length > MAX_CHARS) {
      original = original.slice(0, MAX_CHARS);
      // 마지막 줄바꿈에서 깔끔하게 자르기
      const lastBreak = original.lastIndexOf("\n");
      if (lastBreak > MAX_CHARS * 0.6) original = original.slice(0, lastBreak);
      truncated = true;
    }

    // 4) 방 언어로 번역 (source 와 같은 언어는 원문 그대로).
    const langsToTranslate = targetLangs.filter((l) => l !== fetched.sourceLang);
    const translations: Record<string, string> = {};
    if (fetched.sourceLang) translations[fetched.sourceLang] = original;

    if (langsToTranslate.length > 0) {
      const result = await translateTranscript(
        original,
        fetched.sourceLang,
        langsToTranslate,
      );
      Object.assign(translations, result);
    }

    const data: TranscriptData = {
      available: true,
      sourceLang: fetched.sourceLang,
      original,
      translations,
      fetchedAt: Date.now(),
      ...(truncated ? { truncated: true } : {}),
    };

    await tRef.set(data);
    return NextResponse.json({ transcript: data, cached: false });
  } catch (err) {
    console.error("youtube-transcript API 오류:", err);
    return NextResponse.json(
      { error: "자막 처리 중 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}

/**
 * 교사가 붙여넣은 자막 텍스트를 정리 → 번역 → TranscriptData 로 만든다.
 */
async function buildManualTranscript(
  raw: string,
  sourceLang: string,
  targetLangs: string[],
): Promise<TranscriptData> {
  // 줄바꿈 정리: 빈 줄 제거, 연속 공백 축소
  let original = raw
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  let truncated = false;
  if (original.length > MAX_CHARS) {
    original = original.slice(0, MAX_CHARS);
    const lastBreak = original.lastIndexOf("\n");
    if (lastBreak > MAX_CHARS * 0.6) original = original.slice(0, lastBreak);
    truncated = true;
  }

  const translations: Record<string, string> = { [sourceLang]: original };
  const langsToTranslate = targetLangs.filter((l) => l !== sourceLang);
  if (langsToTranslate.length > 0) {
    const result = await translateTranscript(original, sourceLang, langsToTranslate);
    Object.assign(translations, result);
  }

  return {
    available: true,
    sourceLang,
    original,
    translations,
    fetchedAt: Date.now(),
    ...(truncated ? { truncated: true } : {}),
  };
}

/**
 * 자막 전문을 청크로 나눠 각 target 언어로 번역. 청크별 단일 JSON 호출.
 * 실패한 청크는 원문 유지(빈 화면보다 낫다).
 */
async function translateTranscript(
  text: string,
  sourceLang: string,
  targetLangs: string[],
): Promise<Record<string, string>> {
  const chunks = chunkByParagraph(text, CHUNK_CHARS);
  const acc: Record<string, string[]> = {};
  for (const l of targetLangs) acc[l] = [];

  for (const chunk of chunks) {
    const part = await translateChunk(chunk, sourceLang, targetLangs);
    for (const l of targetLangs) {
      acc[l].push(part[l] || chunk); // 실패 시 원문 폴백
    }
  }

  const out: Record<string, string> = {};
  for (const l of targetLangs) out[l] = acc[l].join("\n");
  return out;
}

function chunkByParagraph(text: string, limit: number): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    if (cur && cur.length + line.length + 1 > limit) {
      chunks.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function translateChunk(
  text: string,
  sourceLang: string,
  targetLangs: string[],
): Promise<Record<string, string>> {
  const targetList = targetLangs
    .map((l) => `${LANGUAGES[l]?.name ?? l} (key: "${l}")`)
    .join(", ");
  const emptyShape = targetLangs.map((l) => `"${l}": ""`).join(", ");

  const systemMsg = `You translate video subtitle transcripts for a Korean multicultural elementary classroom.
- Translate faithfully and naturally for children. Keep line breaks where they are.
- Do NOT add notes, explanations, or markdown. Do NOT summarize — translate everything.
- Preserve proper nouns and numbers.`;

  const userMsg = `Source (${LANGUAGES[sourceLang]?.name ?? (sourceLang || "unknown")}):
"""
${text}
"""

Translate into: ${targetList}

Respond with exactly this JSON shape (no extra keys, no markdown):
{"translations": {${emptyShape}}}`;

  try {
    return await withGroqKeyFallback(async (groq) => {
      for (const model of MODELS) {
        try {
          const completion = await groq.chat.completions.create({
            model,
            messages: [
              { role: "system", content: systemMsg },
              { role: "user", content: userMsg },
            ],
            max_tokens: 2000,
            temperature: 0.1,
            response_format: { type: "json_object" as const },
          });
          const raw = (completion.choices[0]?.message?.content || "{}").trim();
          const parsed = parseTranslations(raw, targetLangs);
          if (parsed) return parsed;
        } catch (err) {
          if (shouldSkipModel(err)) continue;
          throw err;
        }
      }
      return {};
    });
  } catch (err) {
    console.warn("[youtube-transcript] 청크 번역 실패:", describe(err));
    return {};
  }
}

function parseTranslations(
  raw: string,
  targetLangs: string[],
): Record<string, string> | null {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const json = JSON.parse(cleaned) as { translations?: Record<string, unknown> };
    const tr = json.translations;
    if (!tr || typeof tr !== "object") return null;
    const out: Record<string, string> = {};
    for (const l of targetLangs) {
      const v = tr[l];
      if (typeof v === "string" && v.trim()) out[l] = v;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

function shouldSkipModel(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") {
    return status === 429 || status === 404 || status === 400;
  }
  const msg = String((err as Error)?.message ?? "").toLowerCase();
  return msg.includes("rate") || msg.includes("not found") || msg.includes("not supported");
}

function describe(err: unknown): string {
  return String((err as Error)?.message ?? err ?? "unknown").slice(0, 80);
}

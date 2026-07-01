/**
 * 유튜브 자막(스크립트) 추출 — 외부 패키지 없이 fetch 만 사용 (서버 전용).
 *
 * 전략 (순서대로 시도):
 *  1. Innertube player API (ANDROID 클라이언트) — 서버 IP 에서 가장 안정적
 *  2. watch 페이지 HTML 의 ytInitialPlayerResponse → captionTracks 파싱
 *
 * 트랙 선택 우선순위: ko 수동 > ko 자동(asr) > en 수동 > en 자동 > 첫 수동 > 첫 자동
 * 자막 본문: baseUrl + fmt=json3 (JSON) → 실패 시 timedtext XML 파싱
 */

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  /** "asr" = 자동 생성 자막 */
  kind?: string;
}

export interface TranscriptResult {
  text: string;
  /** 실제 사용된 자막 트랙의 언어 코드 (예: "ko", "en", "zh-Hans") */
  languageCode: string;
  /** 자동 생성 자막 여부 */
  auto: boolean;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ANDROID_UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip";

/** 텍스트에서 유튜브 영상 ID 추출 (watch / youtu.be / embed / shorts / live) */
export function extractYouTubeIdFromText(text: string): string | null {
  if (!text) return null;
  const m = text.match(
    /(?:youtube\.com\/(?:watch\?[^\s]*?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

/** 3000자 제한 — 앞부분 위주, 단어 경계에서 자름 */
export function clipTranscript(text: string, maxChars = 3000): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const clipped = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
  return clipped.trim() + " …";
}

/** 메인 진입점: 자막 트랙 탐색 → 본문 추출. 자막이 없으면 null. */
export async function fetchYoutubeTranscript(videoId: string): Promise<TranscriptResult | null> {
  let tracks: CaptionTrack[] = [];
  try {
    tracks = await fetchTracksViaInnertube(videoId);
  } catch {
    /* 다음 전략으로 */
  }
  if (tracks.length === 0) {
    try {
      tracks = await fetchTracksViaWatchPage(videoId);
    } catch {
      /* 아래에서 null 처리 */
    }
  }
  if (tracks.length === 0) return null;

  // 우선순위 순서대로 본문 fetch 시도 (트랙은 있는데 본문이 비는 경우 대비)
  for (const track of rankTracks(tracks)) {
    const text = await fetchCaptionText(track.baseUrl);
    if (text.trim().length > 0) {
      return { text, languageCode: track.languageCode, auto: track.kind === "asr" };
    }
  }
  return null;
}

/* ───────────────────── 트랙 목록 가져오기 ───────────────────── */

interface PlayerCaptionsResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: Array<{ baseUrl?: string; languageCode?: string; kind?: string }>;
    };
  };
}

function normalizeTracks(
  raw: Array<{ baseUrl?: string; languageCode?: string; kind?: string }> | undefined
): CaptionTrack[] {
  return (raw ?? [])
    .filter((t): t is { baseUrl: string; languageCode: string; kind?: string } =>
      typeof t.baseUrl === "string" && typeof t.languageCode === "string")
    .map((t) => ({ baseUrl: t.baseUrl, languageCode: t.languageCode, kind: t.kind }));
}

/** 전략 1: Innertube player API (ANDROID 클라이언트) */
async function fetchTracksViaInnertube(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": ANDROID_UA,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38",
          androidSdkVersion: 30,
          hl: "ko",
          gl: "KR",
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as PlayerCaptionsResponse;
  return normalizeTracks(json.captions?.playerCaptionsTracklistRenderer?.captionTracks);
}

/** 전략 2: watch 페이지 HTML 에서 "captionTracks":[...] 배열을 괄호 균형으로 추출 */
async function fetchTracksViaWatchPage(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(
    `https://www.youtube.com/watch?v=${videoId}&hl=ko&bpctr=9999999999&has_verified=1`,
    {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept-Language": "ko,en;q=0.8",
      },
      cache: "no-store",
    }
  );
  if (!res.ok) return [];
  const html = await res.text();

  const marker = '"captionTracks":';
  const idx = html.indexOf(marker);
  if (idx === -1) return [];

  let start = idx + marker.length;
  while (start < html.length && html[start] !== "[") {
    // 마커와 '[' 사이는 공백뿐이어야 정상 — 다른 문자가 나오면 포기
    if (!/\s/.test(html[start])) return [];
    start++;
  }
  const arrStr = extractBalancedJson(html, start);
  if (!arrStr) return [];

  try {
    const parsed = JSON.parse(arrStr) as Array<{
      baseUrl?: string;
      languageCode?: string;
      kind?: string;
    }>;
    return normalizeTracks(parsed);
  } catch {
    return [];
  }
}

/** '[' 또는 '{' 에서 시작해 문자열 이스케이프를 존중하며 균형 잡힌 JSON 조각을 잘라낸다 */
function extractBalancedJson(src: string, start: number): string | null {
  const open = src[start];
  if (open !== "[" && open !== "{") return null;
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/* ───────────────────── 트랙 우선순위 ───────────────────── */

function langPrefix(track: CaptionTrack): string {
  return track.languageCode.toLowerCase().split("-")[0];
}

/** ko 수동 > ko asr > en 수동 > en asr > 첫 수동 > 첫 asr 순으로 정렬한 후보 목록 */
function rankTracks(tracks: CaptionTrack[]): CaptionTrack[] {
  const manual = tracks.filter((t) => t.kind !== "asr");
  const asr = tracks.filter((t) => t.kind === "asr");
  const ordered: CaptionTrack[] = [];
  const pushUnique = (t: CaptionTrack | undefined) => {
    if (t && !ordered.includes(t)) ordered.push(t);
  };
  pushUnique(manual.find((t) => langPrefix(t) === "ko"));
  pushUnique(asr.find((t) => langPrefix(t) === "ko"));
  pushUnique(manual.find((t) => langPrefix(t) === "en"));
  pushUnique(asr.find((t) => langPrefix(t) === "en"));
  manual.forEach(pushUnique);
  asr.forEach(pushUnique);
  return ordered;
}

/* ───────────────────── 자막 본문 fetch + 파싱 ───────────────────── */

async function fetchCaptionText(baseUrl: string): Promise<string> {
  // 1) json3 포맷
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("fmt", "json3");
    const res = await fetch(u.toString(), {
      headers: { "User-Agent": BROWSER_UA },
      cache: "no-store",
    });
    if (res.ok) {
      const raw = await res.text();
      if (raw.trim().startsWith("{")) {
        const text = parseJson3(raw);
        if (text) return text;
      }
    }
  } catch {
    /* XML 폴백 */
  }

  // 2) timedtext XML 폴백
  try {
    const u = new URL(baseUrl);
    u.searchParams.delete("fmt");
    const res = await fetch(u.toString(), {
      headers: { "User-Agent": BROWSER_UA },
      cache: "no-store",
    });
    if (res.ok) return parseTimedTextXml(await res.text());
  } catch {
    /* 빈 문자열 반환 */
  }
  return "";
}

function parseJson3(raw: string): string {
  try {
    const json = JSON.parse(raw) as {
      events?: Array<{ segs?: Array<{ utf8?: string }> }>;
    };
    const lines: string[] = [];
    for (const ev of json.events ?? []) {
      if (!ev.segs) continue;
      const line = ev.segs
        .map((s) => s.utf8 ?? "")
        .join("")
        .replace(/\n/g, " ")
        .trim();
      if (line) lines.push(line);
    }
    return lines.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function parseTimedTextXml(xml: string): string {
  const lines: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const line = decodeXmlEntities(m[1]).replace(/\s+/g, " ").trim();
    if (line) lines.push(line);
  }
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

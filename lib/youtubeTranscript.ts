// YouTube 자막(타임드텍스트) 추출 — 서버 전용.
//
// `youtube-transcript` npm 패키지는 스크래핑 구조가 자주 바뀌어 깨지므로,
// 같은 원리(워치 페이지 → captionTracks → timedtext)를 직접 구현해 의존성을 없앴다.
// 흐름:
//   1. https://www.youtube.com/watch?v={id} 를 브라우저 UA 로 GET
//   2. ytInitialPlayerResponse 에서 captionTracks 추출
//   3. 원하는 언어(없으면 첫 트랙)의 baseUrl 에 &fmt=json3 붙여 GET
//   4. json3 events → { text, offsetMs } 세그먼트로 파싱
//
// 주의: YouTube 가 막거나(봇 차단) 자막이 없는 영상이면 null 을 던지지 말고
//       구조화된 실패값을 반환해 호출부가 "자막 없음" UI 를 띄우게 한다.

export interface TranscriptSegment {
  text: string;
  offsetMs: number;
}

export interface FetchedTranscript {
  available: boolean;
  reason?: string;            // available=false 일 때 한국어 사유
  sourceLang: string;         // 자막 트랙의 언어 코드 (BCP-47 앞부분, 예: "ko")
  segments: TranscriptSegment[];
  fullText: string;           // 세그먼트를 문장 단위로 합친 읽기용 전문
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;              // "asr" = 자동 생성 자막
  name?: { simpleText?: string };
}

/**
 * 영상 ID 로 자막을 가져온다. 자막이 없거나 차단되면 available:false.
 * @param preferLangs 우선 선택할 언어 코드 목록 (방 언어 등). 없으면 첫 트랙.
 */
export async function fetchYouTubeTranscript(
  videoId: string,
  preferLangs: string[] = [],
): Promise<FetchedTranscript> {
  const empty = (reason: string): FetchedTranscript => ({
    available: false,
    reason,
    sourceLang: "",
    segments: [],
    fullText: "",
  });

  let tracks: CaptionTrack[];
  try {
    tracks = await listCaptionTracks(videoId);
  } catch (err) {
    return empty(`자막 정보를 불러오지 못했습니다 (${describe(err)})`);
  }

  if (tracks.length === 0) {
    return empty("이 영상에는 자막이 없습니다");
  }

  const track = pickTrack(tracks, preferLangs);
  const sourceLang = (track.languageCode || "").split("-")[0] || "";

  let segments: TranscriptSegment[];
  try {
    segments = await fetchTrackSegments(track.baseUrl);
  } catch (err) {
    return empty(`자막을 불러오지 못했습니다 (${describe(err)})`);
  }

  if (segments.length === 0) {
    return empty("자막 내용이 비어 있습니다");
  }

  return {
    available: true,
    sourceLang,
    segments,
    fullText: joinSegments(segments),
  };
}

async function listCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(
    `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`,
    {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
      // 워치 페이지는 캐시 의미가 없고 봇차단 회피용으로 매번 신선하게
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`watch ${res.status}`);
  const html = await res.text();

  // ytInitialPlayerResponse = {...};  형태에서 JSON 추출
  const player = extractPlayerResponse(html);
  if (!player) throw new Error("playerResponse 없음");

  const list =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(list)) return [];
  return list as CaptionTrack[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlayerResponse(html: string): any | null {
  // 가장 흔한 패턴 두 가지를 시도
  const markers = [
    "ytInitialPlayerResponse = ",
    'ytInitialPlayerResponse":',
  ];
  for (const marker of markers) {
    const idx = html.indexOf(marker);
    if (idx === -1) continue;
    const start = html.indexOf("{", idx);
    if (start === -1) continue;
    const json = sliceBalancedJson(html, start);
    if (!json) continue;
    try {
      return JSON.parse(json);
    } catch {
      // 다음 마커 시도
    }
  }
  return null;
}

// start 위치의 '{' 부터 균형 잡힌 JSON 객체 문자열을 잘라낸다(문자열/이스케이프 인지).
function sliceBalancedJson(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function pickTrack(tracks: CaptionTrack[], preferLangs: string[]): CaptionTrack {
  const byLang = (lang: string) =>
    tracks.find((t) => (t.languageCode || "").split("-")[0] === lang);

  // 1) 선호 언어의 수동 자막 → 2) 선호 언어의 임의 자막
  for (const lang of preferLangs) {
    const manual = tracks.find(
      (t) =>
        (t.languageCode || "").split("-")[0] === lang && t.kind !== "asr",
    );
    if (manual) return manual;
  }
  for (const lang of preferLangs) {
    const any = byLang(lang);
    if (any) return any;
  }
  // 3) 전체 중 수동 자막 우선 → 4) 첫 트랙
  return tracks.find((t) => t.kind !== "asr") || tracks[0];
}

async function fetchTrackSegments(baseUrl: string): Promise<TranscriptSegment[]> {
  // json3 포맷이 XML 보다 파싱이 안전(엔티티/태그 이슈 없음)
  const url = baseUrl.includes("fmt=")
    ? baseUrl
    : `${baseUrl}&fmt=json3`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`timedtext ${res.status}`);
  const data = (await res.json()) as {
    events?: Array<{
      tStartMs?: number;
      segs?: Array<{ utf8?: string }>;
    }>;
  };

  const segments: TranscriptSegment[] = [];
  for (const ev of data.events || []) {
    if (!ev.segs) continue;
    const text = ev.segs
      .map((s) => s.utf8 || "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    segments.push({ text, offsetMs: ev.tStartMs ?? 0 });
  }
  return segments;
}

// 세그먼트를 읽기용 전문으로 합친다. 자동자막은 줄바꿈이 잦아 한 칸으로 잇고,
// 문장부호로 끝나는 지점에서만 줄을 나눠 가독성을 높인다.
function joinSegments(segments: TranscriptSegment[]): string {
  const raw = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
  // 문장 끝(. ! ? 。 ! ?) 뒤에 줄바꿈 삽입
  return raw.replace(/([.!?。！？])\s+/g, "$1\n");
}

function describe(err: unknown): string {
  return String((err as Error)?.message ?? err ?? "unknown").slice(0, 60);
}

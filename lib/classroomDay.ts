// 📅 교실 날짜 (X05) — "오늘" 을 정하는 유일한 순수 모듈.
//
// 왜 별도 파일인가: 기존 quests.todayKey() 는 `new Date().getFullYear()` 처럼
// **기기 로컬 시간대**로 날짜를 만들었다. 공용 태블릿의 시간대가 어긋나 있거나
// 학생이 해외에서 접속하면 같은 수업 시간인데도 학생마다 dayKey 가 갈라져
// 퀘스트 목록·구독 경로·보상 귀속이 서로 다른 날에 흩어진다.
//
// 그래서 날짜의 기준은 **교실 timezone**(기본 Asia/Seoul, 방 설정으로 덮어쓰기)
// 이고, 이 파일은 그 계산만 한다 — Firebase·React·전역 상태를 모르는 순수 함수라
// fake clock 으로 자정 경계를 그대로 재현할 수 있다 (scripts/test-classroom-day.mjs).

/** 방 설정이 없을 때의 교실 기준 시간대. */
export const DEFAULT_CLASSROOM_TIME_ZONE = "Asia/Seoul";

/** 날짜 키 형식 — RTDB 경로 세그먼트로도 그대로 쓴다. */
export const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const tzValidCache = new Map<string, boolean>();

/** IANA 시간대 이름이 이 런타임에서 실제로 동작하는지. */
export function isValidTimeZone(tz: unknown): boolean {
  if (typeof tz !== "string" || !tz.trim()) return false;
  const key = tz.trim();
  const hit = tzValidCache.get(key);
  if (hit !== undefined) return hit;
  let ok = false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: key });
    ok = true;
  } catch {
    ok = false;
  }
  tzValidCache.set(key, ok);
  return ok;
}

/**
 * 설정값 → 실제로 쓸 시간대.
 * 오타·미설정·구형 런타임 미지원은 **조용히 기본값으로 떨어진다**. 날짜 계산이
 * 예외로 멈추면 퀘스트 화면 전체가 멈추기 때문이다. 대신 잘못된 값이었는지는
 * `describeTimeZone()` 로 확인할 수 있다.
 */
export function resolveTimeZone(tz?: string | null): string {
  if (typeof tz === "string" && isValidTimeZone(tz)) return tz.trim();
  return DEFAULT_CLASSROOM_TIME_ZONE;
}

export function describeTimeZone(tz?: string | null): { timeZone: string; fellBack: boolean } {
  const resolved = resolveTimeZone(tz);
  const asked = typeof tz === "string" ? tz.trim() : "";
  return { timeZone: resolved, fellBack: !!asked && asked !== resolved };
}

function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** 특정 시각의 교실 날짜 키(YYYY-MM-DD). */
export function dayKeyAt(epochMs: number, timeZone?: string | null): string {
  const tz = resolveTimeZone(timeZone);
  const parts = formatter(tz).formatToParts(new Date(epochMs));
  let y = "";
  let m = "";
  let d = "";
  for (const p of parts) {
    if (p.type === "year") y = p.value;
    else if (p.type === "month") m = p.value;
    else if (p.type === "day") d = p.value;
  }
  // en-US + 2-digit 은 "09" 를 주지만, 런타임에 따라 자릿수가 다를 수 있어 방어.
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const SEARCH_WINDOW_MS = 36 * 60 * 60 * 1000; // 하루는 어떤 tz 에서도 36h 를 넘지 않는다

/**
 * 다음 자정(교실 기준)의 정확한 epoch ms.
 *
 * "24시 - 현재 시:분" 산술을 쓰지 않는다 — DST 가 있는 시간대(교실이
 * America/… 로 설정될 수 있다)에서 하루가 23h/25h 가 되면 어긋난다. 대신
 * dayKeyAt 자체를 판정식으로 쓰는 이분 탐색이라 어떤 tz 규칙에도 맞는다.
 */
export function nextDayBoundaryAt(epochMs: number, timeZone?: string | null): number {
  const tz = resolveTimeZone(timeZone);
  const today = dayKeyAt(epochMs, tz);
  let lo = epochMs;
  let hi = epochMs + SEARCH_WINDOW_MS;
  if (dayKeyAt(hi, tz) === today) return hi; // 도달 불가 — 방어적 상한
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (dayKeyAt(mid, tz) === today) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** 다음 자정까지 남은 ms (최소 1 — setTimeout 0 루프 방지). */
export function msUntilNextDay(epochMs: number, timeZone?: string | null): number {
  return Math.max(1, nextDayBoundaryAt(epochMs, timeZone) - epochMs);
}

export function isDayKey(v: unknown): v is string {
  return typeof v === "string" && DAY_KEY_RE.test(v);
}

/** 날짜 키 문자열 산술 (시간대 무관 — 키 자체가 이미 교실 날짜다). */
export function shiftDayKey(dayKey: string, days: number): string {
  if (!isDayKey(dayKey)) return dayKey;
  const [y, m, d] = dayKey.split("-").map((s) => parseInt(s, 10));
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const dt = new Date(t);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export function previousDayKey(dayKey: string): string {
  return shiftDayKey(dayKey, -1);
}

/** ISO 키라 문자열 비교로 충분하다. a<b 면 음수. */
export function compareDayKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

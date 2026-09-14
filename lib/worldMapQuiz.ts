/**
 * 평면 세계지도 퀴즈 — 순수 로직 (U12 / 08 §2·§3·§4).
 *
 * React·Firebase 를 import 하지 않는다. 화면이 없어도 이 파일만으로 검사할 수
 * 있어야 한다(scripts/test-world-map-quiz.mjs 가 transpile 해서 그대로 돌린다).
 *
 * 여기 있는 것:
 *  - 정거원통(equirectangular) 투영과 **역변환**. 08 §3 "평면지도는 화면좌표 →
 *    투영 역변환 → 같은 국가 ID 판정".
 *  - alpha-3(지도) ↔ alpha-2(이름 사전) 코드 이음. 08 §3 이 "서로 다른 데이터
 *    소스 코드를 이름 문자열로만 join 하지 않는다" 고 못 박았으므로 **코드로만**
 *    잇는다. 이름이 같은지는 보지 않는다.
 *  - 시드 기반 문제 뽑기. 08 §2 "문제마다 랜덤 seed/정답 ID/선택/힌트 상태를
 *    분리해 화면 resize 가 문제를 다시 뽑지 않게 한다" — 그래서 문제 목록은
 *    시드에서 **한 번** 계산되는 순수 함수이고, 화면 크기는 입력이 아니다.
 *  - 힌트 단계. 08 "대륙 → 넓은 지역 강조 → 정답 위치 확인" 순서.
 */

/* ── 코드 이음 ──────────────────────────────────────────────
 * 지도(Natural Earth)는 alpha-3, 이름 사전(lib/gameData COUNTRIES)은 alpha-2 다.
 * 66개국뿐이므로 표를 눈으로 확인할 수 있게 통째로 적는다. 알고리즘으로 짐작하지
 * 않는다 — 짐작이 틀리면 아이에게 다른 나라 이름이 나간다. */
export const ISO3_TO_ISO2: Readonly<Record<string, string>> = {
  DZA: "DZ", EGY: "EG", ETH: "ET", GHA: "GH", KEN: "KE", MAR: "MA", NGA: "NG",
  SEN: "SN", TZA: "TZ", ZAF: "ZA", MDG: "MG", SAH: "EH",
  CHN: "CN", IND: "IN", IDN: "ID", JPN: "JP", KOR: "KR", PRK: "KP", THA: "TH",
  VNM: "VN", PHL: "PH", MYS: "MY", MNG: "MN", SAU: "SA", TUR: "TR", PSX: "PS", TWN: "TW",
  FRA: "FR", DEU: "DE", ITA: "IT", ESP: "ES", GBR: "GB", POL: "PL", UKR: "UA",
  RUS: "RU", SWE: "SE", GRC: "GR", PRT: "PT", NLD: "NL", CHE: "CH",
  USA: "US", CAN: "CA", MEX: "MX", CUB: "CU", JAM: "JM", GTM: "GT", PAN: "PA",
  CRI: "CR", HTI: "HT", DOM: "DO",
  BRA: "BR", ARG: "AR", CHL: "CL", COL: "CO", PER: "PE", VEN: "VE", ECU: "EC",
  BOL: "BO", PRY: "PY", URY: "UY",
  AUS: "AU", NZL: "NZ", FJI: "FJ", PNG: "PG", WSM: "WS", TON: "TO",
};

/**
 * COUNTRIES(15개 언어)에 없는 나라의 이름 보충.
 *
 * **한국어와 영어만 있다.** 나머지 13개 언어를 여기서 기계번역으로 채우면
 * 검수받지 않은 나라 이름이 아이에게 그대로 나간다. 없는 언어는 영어로
 * 떨어지게 두고, 이 목록을 선생님 검수 대상으로 남긴다.
 */
export const SUPPLEMENT_NAMES: Readonly<Record<string, { ko: string; en: string }>> = {
  MG: { ko: "마다가스카르", en: "Madagascar" },
  KP: { ko: "북한", en: "North Korea" },
  JM: { ko: "자메이카", en: "Jamaica" },
  GT: { ko: "과테말라", en: "Guatemala" },
  PA: { ko: "파나마", en: "Panama" },
  CR: { ko: "코스타리카", en: "Costa Rica" },
  HT: { ko: "아이티", en: "Haiti" },
  DO: { ko: "도미니카 공화국", en: "Dominican Republic" },
  EC: { ko: "에콰도르", en: "Ecuador" },
  BO: { ko: "볼리비아", en: "Bolivia" },
  PY: { ko: "파라과이", en: "Paraguay" },
  UY: { ko: "우루과이", en: "Uruguay" },
  FJ: { ko: "피지", en: "Fiji" },
  PG: { ko: "파푸아뉴기니", en: "Papua New Guinea" },
  WS: { ko: "사모아", en: "Samoa" },
  TO: { ko: "통가", en: "Tonga" },
};

/** 대륙 이름(Natural Earth 영문) → 아이가 읽는 한국어. */
export const CONTINENT_KO: Readonly<Record<string, string>> = {
  Africa: "아프리카",
  Asia: "아시아",
  Europe: "유럽",
  "North America": "북아메리카",
  "South America": "남아메리카",
  Oceania: "오세아니아",
};

/* ── 번들 타입 ─────────────────────────────────────────── */

export type Ring = readonly (readonly [number, number])[];
export type Polygon = readonly Ring[]; // [바깥, ...구멍]

export interface MapCountry {
  readonly countryId: string;      // alpha-3
  readonly isoA3: string;
  readonly continent: string;
  readonly quizEligible: boolean;
  readonly centroid: readonly [number, number] | null;
  readonly polygons: readonly Polygon[];
}

export interface MapBundle {
  readonly dataset: string;
  readonly datasetVersion: string;
  readonly license: string;
  readonly sourceUrl: string;
  readonly countries: readonly MapCountry[];
}

/* ── 투영 ──────────────────────────────────────────────────
 * 정거원통. 08 §4 가 "평면지도는 가로비를 유지" 라 했고 이 투영은 2:1 이다.
 * 무엇보다 **역변환이 정확하다** — 근사·반복 계산이 없으므로 클릭 좌표가
 * 어긋날 여지가 없다. 국가 선택 정확도가 이 화면의 전부라 그게 가장 중요하다. */

export const MAP_ASPECT = 2; // 너비 / 높이

/** 경위도 → 지도 안 0..1 좌표. y 는 위가 0. */
export function project(lng: number, lat: number): { x: number; y: number } {
  return { x: (lng + 180) / 360, y: (90 - lat) / 180 };
}

/** 지도 안 0..1 좌표 → 경위도. project 의 정확한 역함수다. */
export function unproject(x: number, y: number): { lng: number; lat: number } {
  return { lng: x * 360 - 180, lat: 90 - y * 180 };
}

/* ── 점-다각형 판정 ────────────────────────────────────── */

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInCountry(lng: number, lat: number, c: MapCountry): boolean {
  for (const poly of c.polygons) {
    if (!pointInRing(lng, lat, poly[0])) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) {
      if (pointInRing(lng, lat, poly[h])) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

export type HitResult =
  /** 바다(또는 이 번들에 없는 땅). 08 §3: 오답 처리하지 않고 다시 고르게 한다. */
  | { readonly status: "ocean" }
  | { readonly status: "country"; readonly countryId: string }
  /** 경계가 겹쳐 한 점이 두 나라에 들어가는 경우. 임의로 하나 고르지 않는다. */
  | { readonly status: "ambiguous"; readonly candidates: readonly string[] };

/**
 * 경위도 한 점이 어느 나라인가.
 *
 * 08 §3 "대표점과 가장 가까운 나라를 무조건 정답 처리하는 방식은 피한다" —
 * 그래서 가까운 나라를 찾지 않는다. 안에 들어갔을 때만 그 나라다.
 */
export function hitTest(lng: number, lat: number, countries: readonly MapCountry[]): HitResult {
  const hits: string[] = [];
  for (const c of countries) {
    if (pointInCountry(lng, lat, c)) hits.push(c.countryId);
  }
  if (hits.length === 0) return { status: "ocean" };
  if (hits.length === 1) return { status: "country", countryId: hits[0] };
  return { status: "ambiguous", candidates: hits };
}

/* ── 문제 뽑기 ─────────────────────────────────────────── */

/** mulberry32. 시드가 같으면 언제나 같은 문제가 나온다. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface QuizPlan {
  /** 실제로 낼 문제의 나라 ID들. 중복 없음. */
  readonly questions: readonly string[];
  /** 요청한 문제 수보다 적게 낼 수밖에 없었다면 그 사실. */
  readonly requested: number;
  readonly shortOf: boolean;
}

/**
 * 문제 목록을 만든다.
 *
 * 08 §2 "한 세션 국가 중복 출제 방지", "선택 범위가 요청 문제 수보다 적으면
 * 가능한 수로 안내하고 조정". 그래서 모자라면 조용히 채우지 않고 `shortOf` 로
 * 알린다 — 화면이 그 사실을 아이에게 말해야 한다.
 *
 * 시드와 범위만 입력이다. **화면 크기는 입력이 아니다** — resize 가 문제를 다시
 * 뽑을 수 없게 하려는 것이 08 §2 의 요구다.
 */
export function planQuiz(
  countries: readonly MapCountry[],
  opts: { seed: number; count: number; continents?: readonly string[] },
): QuizPlan {
  const pool = countries.filter(
    (c) => c.quizEligible && (!opts.continents?.length || opts.continents.includes(c.continent)),
  );
  const next = rng(opts.seed);
  // Fisher-Yates. 뽑고 나서 앞에서 자르므로 같은 나라가 두 번 나올 수 없다.
  const ids = pool.map((c) => c.countryId);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const questions = ids.slice(0, Math.min(opts.count, ids.length));
  return { questions, requested: opts.count, shortOf: questions.length < opts.count };
}

/* ── 힌트 ─────────────────────────────────────────────── */

/**
 * 힌트 단계. 08 "대륙 → 넓은 지역 강조 → 정답 위치 확인" 순서 그대로다.
 * 0 은 힌트를 쓰지 않은 상태다.
 */
export const HINT_STAGES = 3;

export interface HintView {
  readonly stage: number;
  /** 대륙 이름을 말해 준다 (1단계부터). */
  readonly continent: string | null;
  /** 지도에서 그 지역을 밝혀 준다 (2단계부터). */
  readonly highlightContinent: boolean;
  /** 정답 나라를 지도에 보여 준다 (3단계). */
  readonly revealAnswer: boolean;
}

export function hintView(stage: number, continent: string): HintView {
  const s = Math.max(0, Math.min(HINT_STAGES, Math.floor(stage)));
  return {
    stage: s,
    continent: s >= 1 ? continent : null,
    highlightContinent: s >= 2,
    revealAnswer: s >= 3,
  };
}

/* ── 이름 ─────────────────────────────────────────────── */

export interface NameSource {
  /** alpha-2 → 언어별 이름. lib/gameData 의 COUNTRIES 에서 만들어 넘긴다. */
  readonly byIso2: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/**
 * 나라 이름을 고른다. **코드로만** 잇는다(08 §3).
 *
 * 순서: 사전(15개 언어) → 보충표(한국어·영어) → 마지막으로 코드 자체.
 * 코드가 그대로 보이면 이름이 빠졌다는 뜻이고, 그건 숨기지 않는 편이 낫다.
 */
export function countryName(
  countryId: string,
  lang: string,
  src: NameSource,
): string {
  const iso2 = ISO3_TO_ISO2[countryId];
  if (!iso2) return countryId;
  const dict = src.byIso2[iso2];
  if (dict) {
    const hit = dict[lang] ?? dict.en ?? dict.ko;
    if (hit) return hit;
  }
  const sup = SUPPLEMENT_NAMES[iso2];
  if (sup) return lang === "ko" ? sup.ko : sup.en;
  return countryId;
}

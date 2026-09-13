/**
 * U12 지도 데이터 — 순수 판정 로직.
 *
 * React·Firebase 등 프레임워크 import 금지. 이 파일은 순수 함수만 담는다
 * (scripts/test-country-dataset.mjs 가 ts.transpileModule 로 이 파일을
 * 통째로 실행해 검사한다 — scripts/test-animals.mjs 와 같은 패턴).
 *
 * 이 모듈은 파일을 읽지 않는다. geometry 데이터(major-countries.json +
 * data/maps/natural-earth/countries/*.geojson)를 읽어오는 것은 호출부(앱)
 * 책임이고, 여기서는 이미 읽어 들인 데이터를 받아 판정만 한다 — 그래야
 * 브라우저/서버/테스트 어디서든 같은 로직을 쓸 수 있다.
 *
 * 정답 판정은 Natural Earth polygon 으로만 한다. 지형 texture(NASA Blue
 * Marble 등)는 시각 layer일 뿐 이 모듈의 입력이 아니다.
 */

export type Ring = readonly (readonly [number, number])[];
export type PolygonCoords = readonly Ring[]; // [exterior, ...holes]
export type MultiPolygonCoords = readonly PolygonCoords[];

export interface PolygonGeometry {
  readonly type: 'Polygon';
  readonly coordinates: PolygonCoords;
}
export interface MultiPolygonGeometry {
  readonly type: 'MultiPolygon';
  readonly coordinates: MultiPolygonCoords;
}
export type CountryGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface CountryMeta {
  readonly countryId: string;
  readonly isoA3: string;
  readonly continent: string;
  readonly nameKey: string;
  readonly quizEligible: boolean;
  readonly centroid: readonly [number, number] | null;
}

export interface CountryFeature extends CountryMeta {
  readonly geometry: CountryGeometry;
}

/** 해상 클릭. 가장 가까운 나라를 임의로 정답 처리하지 않는다. */
export interface OceanResult {
  readonly status: 'ocean';
}

/** 정확히 한 나라 안. */
export interface CountryHitResult {
  readonly status: 'country';
  readonly countryId: string;
}

/**
 * 경계 근처(허용오차 이내)에서 클릭 지점을 살짝 움직이면 다른 나라가 걸리는
 * 경우. 호출부가 후보 목록을 보여주고 사용자가 고르게 해야 한다 — 여기서
 * 임의로 하나를 고르지 않는다. `countryId` 가 있으면 클릭 지점 자체는 그
 * 나라 안이었다는 뜻이고, 없으면 해상이지만 국경에서 아주 가깝다는 뜻이다.
 */
export interface AmbiguousResult {
  readonly status: 'ambiguous';
  readonly countryId: string | null;
  readonly candidates: readonly string[];
}

export type PointLookupResult = OceanResult | CountryHitResult | AmbiguousResult;

export interface ResolveOptions {
  /**
   * 경계 모호성 판정에 쓰는 허용오차(도 단위, 경도/위도 평면 근사).
   * 기본값은 대략 1~3km 급 오차를 흡수하는 정도로 작게 잡는다.
   */
  readonly boundaryEpsilonDeg?: number;
}

const DEFAULT_EPSILON_DEG = 0.02;

function normalizeLng(lng: number): number {
  let x = lng;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

/**
 * 링 하나에 대한 point-in-ring 판정 (ray casting, 짝수-홀수 규칙).
 * 날짜변경선(경도 ±180) 을 건너는 링은 링 자체를 "풀어서"(unwrap) 연속된
 * 좌표로 만들고, 질의점의 경도도 필요하면 +360 해서 같은 좌표계에서 비교한다.
 */
function ringLngSpan(ring: Ring): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const [x] of ring) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return { min, max };
}

function unwrapRingIfCrossing(ring: Ring): { ring: Ring; crosses: boolean } {
  const { min, max } = ringLngSpan(ring);
  if (max - min <= 180) return { ring, crosses: false };
  // 날짜변경선을 건너는 것으로 추정 — 음수 경도에 360 을 더해 연속된 좌표로 만든다.
  const unwrapped = ring.map(([x, y]) => (x < 0 ? [x + 360, y] : [x, y]) as [number, number]);
  return { ring: unwrapped, crosses: true };
}

function rayCastPointInRing(px: number, py: number, ring: Ring): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInRingAntimeridianAware(lng: number, lat: number, ring: Ring): boolean {
  const { ring: prepared, crosses } = unwrapRingIfCrossing(ring);
  if (!crosses) {
    return rayCastPointInRing(lng, lat, prepared);
  }
  // 링이 unwrap 되었으니 질의점도 두 후보(lng, lng+360) 로 시도한다.
  return (
    rayCastPointInRing(lng, lat, prepared) || rayCastPointInRing(lng + 360, lat, prepared)
  );
}

function pointInPolygonCoords(lng: number, lat: number, coords: PolygonCoords): boolean {
  if (coords.length === 0) return false;
  const [exterior, ...holes] = coords;
  if (!pointInRingAntimeridianAware(lng, lat, exterior)) return false;
  for (const hole of holes) {
    if (pointInRingAntimeridianAware(lng, lat, hole)) return false;
  }
  return true;
}

/** MultiPolygon·Polygon·구멍·날짜변경선을 모두 지원하는 point-in-polygon. */
export function pointInGeometry(lng: number, lat: number, geometry: CountryGeometry): boolean {
  const normLng = normalizeLng(lng);
  if (geometry.type === 'Polygon') {
    return pointInPolygonCoords(normLng, lat, geometry.coordinates);
  }
  for (const poly of geometry.coordinates) {
    if (pointInPolygonCoords(normLng, lat, poly)) return true;
  }
  return false;
}

/** 위경도 한 점이 걸치는 나라 id 목록 (정상 데이터라면 보통 0개 또는 1개). */
export function countriesContainingPoint(
  lng: number,
  lat: number,
  countries: readonly CountryFeature[],
): string[] {
  const hits: string[] = [];
  for (const c of countries) {
    if (pointInGeometry(lng, lat, c.geometry)) hits.push(c.countryId);
  }
  return hits;
}

const PERTURBATIONS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7071, 0.7071],
  [-0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, -0.7071],
];

/**
 * 클릭 지점을 판정한다.
 *
 * - 바다 위(해상) 클릭 → `{ status: 'ocean' }`. 가장 가까운 나라를 임의로
 *   정답 처리하지 않는다.
 * - 정확히 한 나라 안이고 경계에서 충분히 떨어져 있으면 → `{ status: 'country' }`.
 * - 경계 근처(허용오차 이내에서 다른 나라가 걸리는 경우) → `{ status: 'ambiguous' }`.
 *   호출부가 후보를 보여주고 사용자가 고르게 한다.
 */
export function resolveCountryAtPoint(
  lng: number,
  lat: number,
  countries: readonly CountryFeature[],
  options: ResolveOptions = {},
): PointLookupResult {
  const epsilon = options.boundaryEpsilonDeg ?? DEFAULT_EPSILON_DEG;
  const exact = countriesContainingPoint(lng, lat, countries);

  const nearbySet = new Set<string>(exact);
  for (const [dx, dy] of PERTURBATIONS) {
    const hits = countriesContainingPoint(lng + dx * epsilon, lat + dy * epsilon, countries);
    for (const id of hits) nearbySet.add(id);
  }

  if (exact.length === 1) {
    if (nearbySet.size > 1) {
      return { status: 'ambiguous', countryId: exact[0], candidates: Array.from(nearbySet).sort() };
    }
    return { status: 'country', countryId: exact[0] };
  }

  if (exact.length > 1) {
    // 정상적인 데이터라면 일어나지 않아야 하지만(폴리곤 중첩), 임의로 하나를
    // 고르지 않고 후보로 넘긴다.
    return { status: 'ambiguous', countryId: exact[0], candidates: exact.slice().sort() };
  }

  // exact.length === 0: 클릭 자체는 바다.
  if (nearbySet.size > 0) {
    return { status: 'ambiguous', countryId: null, candidates: Array.from(nearbySet).sort() };
  }
  return { status: 'ocean' };
}

/** 출제(퀴즈) 대상만 거른다 — quizEligible:false 인 나라는 빠진다. */
export function getQuizEligibleCountries(
  countries: readonly CountryMeta[],
): CountryMeta[] {
  return countries.filter((c) => c.quizEligible);
}

/** countryId 로 찾기. 없으면 null. */
export function findCountryById(
  countries: readonly CountryMeta[],
  countryId: string,
): CountryMeta | null {
  return countries.find((c) => c.countryId === countryId) ?? null;
}

/**
 * major-countries.json 의 CountryMeta 배열과, 나라별로 로드한 geometry
 * 를 합쳐 판정에 쓸 CountryFeature 배열을 만든다. geometryById 에 없는
 * 나라는 결과에서 빠진다(조용히 무시하지 않도록 누락 목록을 함께 준다).
 */
export function assembleCountryFeatures(
  countryMeta: readonly CountryMeta[],
  geometryById: ReadonlyMap<string, CountryGeometry>,
): { features: CountryFeature[]; missing: string[] } {
  const features: CountryFeature[] = [];
  const missing: string[] = [];
  for (const meta of countryMeta) {
    const geometry = geometryById.get(meta.countryId);
    if (!geometry) {
      missing.push(meta.countryId);
      continue;
    }
    features.push({ ...meta, geometry });
  }
  return { features, missing };
}

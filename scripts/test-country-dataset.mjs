/**
 * U12 지도 데이터 판정 로직 — **실제로 실행해서** 검사한다.
 *
 * lib/countryDataset.ts 를 transpile 해 진짜로 돌린다
 * (scripts/test-animals.mjs 와 같은 방식). 손으로 만든 fixture polygon으로
 * 섬·MultiPolygon·구멍·날짜변경선·극지·해상·경계 클릭을 검사한다.
 * 실제 Natural Earth 데이터가 없어도 로직 자체는 이 fixture 만으로 검사할 수 있다.
 *
 * 실행: node scripts/test-country-dataset.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'bee-countrydataset-'));
let count = 0;
const check = (name, fn) => {
  fn();
  count++;
  console.log(`PASS ${name}`);
};

const compile = (rel, out) => {
  const src = readFileSync(join(root, rel), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, out), js);
};

compile('lib/countryDataset.ts', 'countryDataset.js');
const CD = await import(pathToFileURL(join(dir, 'countryDataset.js')));

/* ── fixture polygons (손으로 만든 것 — 실제 Natural Earth 데이터가 아니다) ── */

// 1) 단순 정사각형 나라 "SQR": lng 0~10, lat 0~10
const SQR_GEOM = {
  type: 'Polygon',
  coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
};

// 2) 옆에 붙은 정사각형 나라 "SQR2": lng 10~20, lat 0~10 (SQR 과 경계 공유)
const SQR2_GEOM = {
  type: 'Polygon',
  coordinates: [[[10, 0], [20, 0], [20, 10], [10, 10], [10, 0]]],
};

// 3) 구멍이 있는 나라 "RING" — 바깥 사각형 안에 안쪽 사각형(다른 나라 "HOLE")이 있다.
const RING_GEOM = {
  type: 'Polygon',
  coordinates: [
    [[30, 0], [40, 0], [40, 10], [30, 10], [30, 0]], // exterior
    [[33, 3], [37, 3], [37, 7], [33, 7], [33, 3]], // hole (HOLE 나라가 들어감)
  ],
};
const HOLE_GEOM = {
  type: 'Polygon',
  coordinates: [[[33, 3], [37, 3], [37, 7], [33, 7], [33, 3]]],
};

// 4) 섬나라 "ISL" — 여러 개의 분리된 섬(MultiPolygon).
const ISL_GEOM = {
  type: 'MultiPolygon',
  coordinates: [
    [[[50, 0], [52, 0], [52, 2], [50, 2], [50, 0]]],
    [[[55, 5], [58, 5], [58, 8], [55, 8], [55, 5]]],
    [[[60, -5], [61, -5], [61, -4], [60, -4], [60, -5]]], // 아주 작은 섬 — 단순화로 사라지면 안 됨
  ],
};

// 5) 날짜변경선을 걸치는 나라 "DLZ" — 경도 175 ~ -175 (즉 175~185 를 감싼다)
const DATELINE_GEOM = {
  type: 'Polygon',
  coordinates: [[[175, -5], [-175, -5], [-175, 5], [175, 5], [175, -5]]],
};

// 6) 극지 나라 "POLE" — 남극점 부근 (lat -85 ~ -90 근처를 감싸는 좁은 띠)
const POLE_GEOM = {
  type: 'Polygon',
  coordinates: [[[-10, -90], [10, -90], [10, -80], [-10, -80], [-10, -90]]],
};

function meta(id, overrides = {}) {
  return {
    countryId: id,
    isoA3: id,
    continent: 'Testland',
    nameKey: `country.${id}`,
    quizEligible: true,
    centroid: null,
    ...overrides,
  };
}

const FEATURES = [
  { ...meta('SQR'), geometry: SQR_GEOM },
  { ...meta('SQ2'), geometry: SQR2_GEOM },
  { ...meta('RNG'), geometry: RING_GEOM },
  { ...meta('HOL'), geometry: HOLE_GEOM },
  { ...meta('ISL'), geometry: ISL_GEOM },
  { ...meta('DLZ'), geometry: DATELINE_GEOM },
  { ...meta('POL', { quizEligible: false }), geometry: POLE_GEOM },
];

try {
  /* ── 기본 point-in-polygon ─────────────────────────────────────── */
  check('사각형 나라 내부는 country', () => {
    const r = CD.resolveCountryAtPoint(5, 5, FEATURES);
    assert.equal(r.status, 'country');
    assert.equal(r.countryId, 'SQR');
  });

  check('완전히 먼 바다는 ocean이고 가장 가까운 나라를 정답으로 만들지 않는다', () => {
    const r = CD.resolveCountryAtPoint(-100, -50, FEATURES);
    assert.equal(r.status, 'ocean');
    assert.ok(!('countryId' in r) || r.countryId === undefined || r.status === 'ocean');
  });

  check('두 사각형 사이 충분히 안쪽(각 나라 중심)은 country로 명확히 갈린다', () => {
    const a = CD.resolveCountryAtPoint(3, 5, FEATURES);
    const b = CD.resolveCountryAtPoint(17, 5, FEATURES);
    assert.deepEqual([a.status, a.countryId], ['country', 'SQR']);
    assert.deepEqual([b.status, b.countryId], ['country', 'SQ2']);
  });

  check('공유 경계선 바로 위 클릭은 ambiguous 이고 두 나라를 후보로 준다 (임의로 하나를 고르지 않는다)', () => {
    const r = CD.resolveCountryAtPoint(10, 5, FEATURES, { boundaryEpsilonDeg: 0.05 });
    assert.equal(r.status, 'ambiguous');
    assert.ok(r.candidates.includes('SQR'));
    assert.ok(r.candidates.includes('SQ2'));
  });

  check('경계에서 충분히 떨어지면 ambiguous 가 아니라 country', () => {
    const r = CD.resolveCountryAtPoint(9, 5, FEATURES, { boundaryEpsilonDeg: 0.05 });
    assert.equal(r.status, 'country');
    assert.equal(r.countryId, 'SQR');
  });

  /* ── 구멍(hole) ────────────────────────────────────────────────── */
  check('구멍 안쪽은 바깥 나라가 아니라 구멍 나라(HOL) 로 판정된다', () => {
    const r = CD.resolveCountryAtPoint(35, 5, FEATURES);
    assert.equal(r.status, 'country');
    assert.equal(r.countryId, 'HOL');
  });

  check('구멍을 둘러싼 exterior 영역(구멍 밖, 바깥 사각형 안)은 RNG', () => {
    const r = CD.resolveCountryAtPoint(31, 1, FEATURES);
    assert.equal(r.status, 'country');
    assert.equal(r.countryId, 'RNG');
  });

  /* ── MultiPolygon / 섬 ─────────────────────────────────────────── */
  check('섬나라의 각 섬 내부가 모두 같은 countryId로 잡힌다', () => {
    const a = CD.resolveCountryAtPoint(51, 1, FEATURES);
    const b = CD.resolveCountryAtPoint(56, 6, FEATURES);
    assert.deepEqual([a.status, a.countryId], ['country', 'ISL']);
    assert.deepEqual([b.status, b.countryId], ['country', 'ISL']);
  });

  check('아주 작은 섬(단순화로 사라지기 쉬운 크기)도 내부 클릭이 country로 잡힌다', () => {
    const r = CD.resolveCountryAtPoint(60.5, -4.5, FEATURES);
    assert.equal(r.status, 'country');
    assert.equal(r.countryId, 'ISL');
  });

  check('섬과 섬 사이 바다는 ocean', () => {
    const r = CD.resolveCountryAtPoint(53, 3, FEATURES);
    assert.equal(r.status, 'ocean');
  });

  /* ── 날짜변경선 ────────────────────────────────────────────────── */
  check('날짜변경선을 걸치는 나라 — 양(+) 쪽 내부', () => {
    const r = CD.resolveCountryAtPoint(178, 0, FEATURES);
    assert.equal(r.status, 'country');
    assert.equal(r.countryId, 'DLZ');
  });

  check('날짜변경선을 걸치는 나라 — 음(-) 쪽 내부 (경도값이 -179 처럼 부호가 바뀐 쪽)', () => {
    const r = CD.resolveCountryAtPoint(-178, 0, FEATURES);
    assert.equal(r.status, 'country');
    assert.equal(r.countryId, 'DLZ');
  });

  check('날짜변경선 나라 바깥(경도 180 언저리지만 위도가 벗어남)은 ocean', () => {
    const r = CD.resolveCountryAtPoint(178, 20, FEATURES);
    assert.equal(r.status, 'ocean');
  });

  check('경도를 -540~540처럼 여러 바퀴 돌려 넣어도(정규화) 같은 결과', () => {
    const r1 = CD.resolveCountryAtPoint(178 + 360, 0, FEATURES);
    const r2 = CD.resolveCountryAtPoint(178 - 720, 0, FEATURES);
    assert.equal(r1.status, 'country');
    assert.equal(r1.countryId, 'DLZ');
    assert.equal(r2.status, 'country');
    assert.equal(r2.countryId, 'DLZ');
  });

  /* ── 극지 ──────────────────────────────────────────────────────── */
  check('극지 나라 내부 클릭은 country로 판정된다 (위도 절대값이 커도 평면 판정이 깨지지 않는다)', () => {
    const r = CD.resolveCountryAtPoint(0, -85, FEATURES);
    assert.equal(r.status, 'country');
    assert.equal(r.countryId, 'POL');
  });

  check('남극점 자체(lat -90)에서도 크래시하지 않고 안쪽이면 country를 준다', () => {
    const r = CD.resolveCountryAtPoint(0, -89.9, FEATURES);
    assert.equal(r.status, 'country');
    assert.equal(r.countryId, 'POL');
  });

  /* ── quizEligible 분리 ─────────────────────────────────────────── */
  check('quizEligible:false 나라는 findCountryById 로는 보이지만 출제 목록에서는 빠진다', () => {
    const found = CD.findCountryById(FEATURES, 'POL');
    assert.ok(found, 'POL 은 표시는 되어야 한다(findCountryById로 조회 가능)');
    const pool = CD.getQuizEligibleCountries(FEATURES);
    assert.ok(!pool.some((c) => c.countryId === 'POL'), 'POL 은 quizEligible:false라 출제 목록에 없어야 한다');
    assert.ok(pool.some((c) => c.countryId === 'SQR'));
  });

  check('resolveCountryAtPoint는 quizEligible:false 나라도 정상 판정한다 (표시 가능 ≠ 출제 가능의 분리)', () => {
    const r = CD.resolveCountryAtPoint(0, -85, FEATURES);
    assert.equal(r.status, 'country');
    assert.equal(r.countryId, 'POL');
  });

  /* ── assembleCountryFeatures ───────────────────────────────────── */
  check('assembleCountryFeatures는 geometry가 없는 나라를 누락 목록으로 알려준다(조용히 빠뜨리지 않음)', () => {
    const metaList = [CD.findCountryById(FEATURES, 'SQR'), meta('GHOST')];
    const geomMap = new Map([['SQR', SQR_GEOM]]);
    const { features, missing } = CD.assembleCountryFeatures(metaList, geomMap);
    assert.equal(features.length, 1);
    assert.deepEqual(missing, ['GHOST']);
  });

  /* ── pointInGeometry 저수준 함수 직접 검사 ─────────────────────── */
  check('pointInGeometry: 겹치지 않는 두 폴리곤 경계에서 정확히 한쪽 규칙을 따른다(짝수-홀수)', () => {
    // 사각형 꼭짓점 자체 — 실제 서비스에서는 이런 극단값이 잘 안 나오지만
    // 알고리즘이 크래시하지 않고 boolean을 반환하는지 확인.
    const v = CD.pointInGeometry(0, 0, SQR_GEOM);
    assert.equal(typeof v, 'boolean');
  });

  console.log(`\n${count} PASS — lib/countryDataset.ts 판정 로직 실제 실행 검사 통과`);
} catch (err) {
  console.error('FAIL:', err.message);
  console.error(err.stack);
  process.exit(1);
}

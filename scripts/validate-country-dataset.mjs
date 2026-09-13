/**
 * U12 지도 데이터 — 실제 데이터 검증.
 *
 * data/maps/major-countries.json 과 data/maps/natural-earth/countries/*.geojson
 * 가 실제로 있는지, 있다면 내용이 유효한지 검증한다.
 *
 * 데이터가 없으면 "없다"고 말하고 exit 1 로 끝난다 — 통과시키지 않는다.
 * (scripts/build-country-dataset.mjs 를 먼저 실행해서 만들어야 한다.)
 *
 * 검증 항목:
 *   1. major-countries.json 이 있고 schema 필수 필드를 갖췄다
 *   2. verifiedCount 가 실제 geometry 파일 수와 일치한다 (부풀리지 않았다)
 *   3. countryId 중복 없음
 *   4. 각 geometry 파일이 존재하고, 비어있지 않고, 유효한 Polygon/MultiPolygon
 *   5. centroid 가 null 이 아니고, 실제로 그 나라 polygon 내부에 있다
 *      (lib/countryDataset.ts 의 판정 로직을 그대로 써서 재확인 — build
 *      스크립트가 스스로 계산한 값을 다시 자기가 검증하는 순환을 피하려
 *      centroid-in-polygon 판정은 이 스크립트가 lib을 직접 호출해서 한다)
 *   6. 작은 나라(섬나라 등)가 단순화로 비어버리지 않았다 — 좌표 개수 최소값 확인
 *
 * 실행: node scripts/validate-country-dataset.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const majorPath = join(root, 'data/maps/major-countries.json');
const countriesDir = join(root, 'data/maps/natural-earth/countries');

const errors = [];
const warnings = [];
let checked = 0;
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

if (!existsSync(majorPath)) {
  console.error('[validate] data/maps/major-countries.json 이 없다 — 데이터가 없다. 실패로 끝낸다.');
  process.exit(1);
}

const major = JSON.parse(readFileSync(majorPath, 'utf8'));

const REQUIRED_TOP_FIELDS = [
  'dataset', 'datasetVersion', 'scale', 'license', 'sourceUrl',
  'boundaryPolicy', 'verifiedAt', 'verifiedCount', 'countries',
];
for (const f of REQUIRED_TOP_FIELDS) {
  if (!(f in major)) fail(`major-countries.json 최상위 필드 누락: ${f}`);
}

if (!Array.isArray(major.countries) || major.countries.length === 0) {
  console.error('[validate] countries 배열이 없거나 비어있다 — 데이터가 없다. 실패로 끝낸다.');
  process.exit(1);
}

const REQUIRED_COUNTRY_FIELDS = [
  'countryId', 'isoA3', 'continent', 'nameKey', 'quizEligible', 'geometryFile', 'centroid',
];
const seenIds = new Set();
for (const c of major.countries) {
  for (const f of REQUIRED_COUNTRY_FIELDS) {
    if (!(f in c)) fail(`countries[${c.countryId ?? '?'}] 필드 누락: ${f}`);
  }
  if (c.countryId) {
    if (seenIds.has(c.countryId)) fail(`countryId 중복: ${c.countryId}`);
    seenIds.add(c.countryId);
  }
}

if (major.verifiedCount === 0 || major.verifiedAt == null) {
  console.error(
    `[validate] verifiedCount=${major.verifiedCount}, verifiedAt=${major.verifiedAt} — geometry 검증이 아직 안 됐다는 뜻이다.`,
  );
  console.error('scripts/build-country-dataset.mjs 를 먼저 실행해서 실제 Natural Earth geometry 를 채워야 한다.');
  process.exit(1);
}

if (!existsSync(countriesDir)) {
  console.error(`[validate] ${countriesDir} 가 없다 — geometry 파일이 없다. 실패로 끝낸다.`);
  process.exit(1);
}

const geometryFiles = existsSync(countriesDir) ? readdirSync(countriesDir).filter((f) => f.endsWith('.json')) : [];
if (geometryFiles.length !== major.verifiedCount) {
  fail(
    `verifiedCount(${major.verifiedCount})가 실제 geometry 파일 수(${geometryFiles.length})와 다르다 — 부풀려졌거나 파일이 빠졌다.`,
  );
}

/* ── lib/countryDataset.ts 를 transpile 해서 centroid-in-polygon 재검증에 쓴다 ── */
const dir = mkdtempSync(join(tmpdir(), 'bee-countryvalidate-'));
const src = readFileSync(join(root, 'lib/countryDataset.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
writeFileSync(join(dir, 'countryDataset.js'), js);
const CD = await import(pathToFileURL(join(dir, 'countryDataset.js')));

const MIN_QUIZ_ELIGIBLE = 60;
const quizEligibleCount = major.countries.filter((c) => c.quizEligible).length;
if (quizEligibleCount < MIN_QUIZ_ELIGIBLE) {
  warn(`quizEligible 국가 수(${quizEligibleCount})가 60 미만이다 — 설계 목표(대륙별 균형 60개국 이상)에 못 미친다.`);
}

const MIN_RING_POINTS = 4; // 닫힌 사각형 최소치. 이보다 적으면 단순화로 뭉개진 것.
const MIN_TOTAL_VERTICES_ISLAND_NATION = 3;

for (const c of major.countries) {
  const filePath = join(countriesDir, c.geometryFile ?? `countries.${c.countryId}.json`);
  if (!existsSync(filePath)) {
    fail(`${c.countryId}: geometry 파일이 없다 (${c.geometryFile})`);
    continue;
  }
  let fc;
  try {
    fc = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e) {
    fail(`${c.countryId}: geometry 파일 JSON 파싱 실패 — ${e.message}`);
    continue;
  }
  const feature = fc?.features?.[0];
  const geometry = feature?.geometry;
  if (!geometry) {
    fail(`${c.countryId}: FeatureCollection.features[0].geometry 가 없다`);
    continue;
  }
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
    fail(`${c.countryId}: geometry.type 이 Polygon/MultiPolygon 이 아니다 (${geometry.type})`);
    continue;
  }

  // 비어있지 않음 + 각 ring 이 유효(최소 4점, 닫힌 링)한지
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (polys.length === 0) {
    fail(`${c.countryId}: coordinates 가 비어있다`);
    continue;
  }
  let totalVertices = 0;
  for (const poly of polys) {
    if (!Array.isArray(poly) || poly.length === 0) {
      fail(`${c.countryId}: 빈 polygon(ring 없음)이 섞여 있다`);
      continue;
    }
    for (const ring of poly) {
      if (!Array.isArray(ring) || ring.length < MIN_RING_POINTS) {
        fail(`${c.countryId}: ring 점 개수가 ${ring?.length ?? 0}개 뿐이다(최소 ${MIN_RING_POINTS}) — 단순화로 뭉개졌을 수 있다`);
        continue;
      }
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        fail(`${c.countryId}: ring 이 닫혀있지 않다(첫 점과 끝 점이 다르다)`);
      }
      totalVertices += ring.length;
    }
  }
  if (totalVertices < MIN_TOTAL_VERTICES_ISLAND_NATION) {
    fail(`${c.countryId}: 전체 정점 수가 너무 적다(${totalVertices}) — 작은 나라가 단순화로 사라졌을 수 있다`);
  }

  // centroid 존재 + 실제로 폴리곤 내부인지
  if (!c.centroid || c.centroid.length !== 2) {
    fail(`${c.countryId}: centroid 가 없다`);
  } else {
    const [clng, clat] = c.centroid;
    const inside = CD.pointInGeometry(clng, clat, geometry);
    if (!inside) {
      fail(`${c.countryId}: centroid [${clng}, ${clat}] 가 실제 polygon 내부가 아니다`);
    }
  }

  checked++;
}

console.log(`[validate] geometry 파일 ${checked}개 검사 완료 (major-countries.json 기준 ${major.countries.length}개국 중)`);
console.log(`[validate] verifiedCount=${major.verifiedCount}, quizEligible=${quizEligibleCount}, datasetVersion=${major.datasetVersion}`);

if (warnings.length) {
  console.warn('\n--- 경고 ---');
  for (const w of warnings) console.warn('WARN:', w);
}

if (errors.length) {
  console.error('\n--- 실패 ---');
  for (const e of errors) console.error('FAIL:', e);
  console.error(`\n총 ${errors.length}건 실패`);
  process.exit(1);
}

console.log('\n검증 통과 — 모든 geometry 가 유효하고 centroid 가 실제로 내부에 있다.');

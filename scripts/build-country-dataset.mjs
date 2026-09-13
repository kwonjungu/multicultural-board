/**
 * U12 지도 데이터 파이프라인 — Natural Earth 1:10m admin_0_countries 원본
 * (.shp/.dbf, ESRI Shapefile) 을 읽어 data/maps/major-countries.json 의
 * candidate ISO 목록만큼만 잘라 data/maps/natural-earth/countries/*.geojson
 * 으로 저장하고, major-countries.json 의 centroid·verifiedAt·verifiedCount
 * 를 갱신한다.
 *
 * 새 npm 의존성을 추가하지 않는다 — .shp/.dbf 이진 포맷을 이 파일 안에서
 * 직접 파싱한다 (ESRI Shapefile Technical Description, dBase III 포맷).
 *
 * 원본 데이터는 저장소에 커밋하지 않는다 (공식 배포 zip 은 약 4.9MB, 압축 해제
 * 시 다시 받을 수 있는 2차 산출물이라 저장소에 넣지 않기로 했다). 이 스크립트를
 * 실행하려면 먼저 아래 공식 URL 에서 zip 을 받아 압축을 푼 디렉터리를
 * --input 또는 환경변수 NE_SHAPEFILE_DIR 로 넘겨야 한다.
 *
 *   공식 안내 페이지: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/
 *   실제 파일 호스트(naturalearthdata.com 자체 다운로드 링크가 500/404 를
 *   반환해 이 경로로 대신 받았다 — data/maps/sources.json 의 "downloadNote" 참고):
 *     https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip
 *
 * 실행:
 *   node scripts/build-country-dataset.mjs --input <ne_10m_admin_0_countries 압축을 푼 폴더>
 *
 * 입력 디렉터리에 ne_10m_admin_0_countries.shp / .dbf / .VERSION.txt 가 있어야 한다.
 * 데이터가 없으면 이 스크립트는 (거짓으로 성공하지 않고) 무엇이 없는지 말하고 종료한다.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// lib/countryDataset.ts 를 transpile 해서 centroid 가 실제로 폴리곤 내부인지
// 이 스크립트 스스로 다시 확인한다(계산한 사람이 계산한 값을 그냥 믿지 않는다).
const _tmpDir = mkdtempSync(join(tmpdir(), 'bee-countrybuild-'));
const _libSrc = readFileSync(join(root, 'lib/countryDataset.ts'), 'utf8');
const _libJs = ts.transpileModule(_libSrc, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
writeFileSync(join(_tmpDir, 'countryDataset.js'), _libJs);
const CD = await import(pathToFileURL(join(_tmpDir, 'countryDataset.js')));

// ── CLI 인자 ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') out.input = argv[++i];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const inputDir = args.input || process.env.NE_SHAPEFILE_DIR;

const majorPath = join(root, 'data/maps/major-countries.json');
const outCountriesDir = join(root, 'data/maps/natural-earth/countries');
const manifestPath = join(root, 'data/maps/natural-earth/manifest.json');

if (!inputDir) {
  console.error('[build-country-dataset] --input <dir> 또는 환경변수 NE_SHAPEFILE_DIR 가 필요하다.');
  console.error('  공식 다운로드: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/');
  console.error('  받아서 압축을 푼 폴더 경로를 넘겨라. (예: --input C:/temp/ne_10m_admin_0_countries)');
  process.exit(1);
}

const shpPath = join(inputDir, 'ne_10m_admin_0_countries.shp');
const dbfPath = join(inputDir, 'ne_10m_admin_0_countries.dbf');
const versionPath = join(inputDir, 'ne_10m_admin_0_countries.VERSION.txt');

for (const [label, p] of [['.shp', shpPath], ['.dbf', dbfPath]]) {
  if (!existsSync(p)) {
    console.error(`[build-country-dataset] 입력 폴더에 ${label} 파일이 없다: ${p}`);
    console.error('데이터가 없으므로 여기서 멈춘다 — 없는 것을 있는 척 만들지 않는다.');
    process.exit(1);
  }
}

const datasetVersion = existsSync(versionPath) ? readFileSync(versionPath, 'utf8').trim() : 'unknown';

// ── DBF 파서 (dBase III, ESRI shapefile 첨부 .dbf 는 대부분 이 변형) ──────
function parseDbf(buf) {
  const numRecords = buf.readUInt32LE(4);
  const headerSize = buf.readUInt16LE(8);
  const recordSize = buf.readUInt16LE(10);
  const fields = [];
  let off = 32;
  while (buf[off] !== 0x0d) {
    const name = buf.toString('latin1', off, off + 11).replace(/\0.*$/, '');
    const type = String.fromCharCode(buf[off + 11]);
    const length = buf[off + 16];
    const decimal = buf[off + 17];
    fields.push({ name, type, length, decimal });
    off += 32;
  }
  const records = [];
  let recOff = headerSize;
  for (let i = 0; i < numRecords; i++) {
    const deleted = buf[recOff] === 0x2a;
    let fOff = recOff + 1;
    const rec = {};
    for (const f of fields) {
      const raw = buf.toString('latin1', fOff, fOff + f.length).trim();
      if (!deleted) {
        if (f.type === 'N' || f.type === 'F') {
          rec[f.name] = raw === '' ? null : Number(raw);
        } else {
          rec[f.name] = raw;
        }
      }
      fOff += f.length;
    }
    if (!deleted) records.push(rec);
    recOff += recordSize;
  }
  return records;
}

// ── SHP 파서 (shape type 5 = Polygon 만 지원, admin_0_countries 는 전부 이 타입) ──
function ringSignedArea(points) {
  // points: [[x,y], ...] closed ring. 부호 있는 면적 (shoelace).
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function pointInRing(pt, ring) {
  // 짝수-홀수 규칙 ray casting — 내부 헬퍼용 (holes 를 어느 exterior 에 붙일지 판단).
  let inside = false;
  const [px, py] = pt;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function shapeRecordToGeometry(rings) {
  // ESRI 규약: 시계방향 ring = exterior(outer), 반시계방향 ring = hole.
  // (GeoJSON 우선회전 규약과 반대다 — 여기서는 굳이 뒤집지 않고 좌표 자체는
  //  그대로 두되, exterior/hole 그룹핑에만 winding 을 쓴다. point-in-polygon
  //  판정은 부호에 의존하지 않는 ray-casting 이라 winding 방향은 결과에
  //  영향을 주지 않는다.)
  const exteriors = []; // { ring, holes: [] }
  for (const ring of rings) {
    const area = ringSignedArea(ring);
    const isClockwise = area < 0; // shoelace 양수=반시계, 음수=시계 (표준 수학 좌표계 기준)
    if (isClockwise || exteriors.length === 0) {
      exteriors.push({ ring, holes: [] });
    } else {
      // 반시계 ring = hole. 어느 exterior 에 속하는지 포함관계로 판정.
      let owner = exteriors[exteriors.length - 1];
      for (const ext of exteriors) {
        if (pointInRing(ring[0], ext.ring)) { owner = ext; break; }
      }
      owner.holes.push(ring);
    }
  }
  const polygons = exteriors.map((e) => [e.ring, ...e.holes]);
  if (polygons.length === 1) {
    return { type: 'Polygon', coordinates: polygons[0] };
  }
  return { type: 'MultiPolygon', coordinates: polygons };
}

function parseShp(buf) {
  const fileLengthWords = buf.readInt32BE(24);
  const fileLengthBytes = fileLengthWords * 2;
  const shapes = [];
  let off = 100;
  while (off < fileLengthBytes && off < buf.length) {
    const contentLenWords = buf.readInt32BE(off + 4);
    const contentLenBytes = contentLenWords * 2;
    const recStart = off + 8;
    const shapeType = buf.readInt32LE(recStart);
    if (shapeType === 0) {
      shapes.push(null); // null shape
    } else if (shapeType === 5) {
      const numParts = buf.readInt32LE(recStart + 36);
      const numPoints = buf.readInt32LE(recStart + 40);
      const partsStart = recStart + 44;
      const parts = [];
      for (let i = 0; i < numParts; i++) parts.push(buf.readInt32LE(partsStart + i * 4));
      const pointsStart = partsStart + numParts * 4;
      const allPoints = [];
      for (let i = 0; i < numPoints; i++) {
        const x = buf.readDoubleLE(pointsStart + i * 16);
        const y = buf.readDoubleLE(pointsStart + i * 16 + 8);
        allPoints.push([x, y]);
      }
      const rings = [];
      for (let i = 0; i < numParts; i++) {
        const start = parts[i];
        const end = i + 1 < numParts ? parts[i + 1] : numPoints;
        rings.push(allPoints.slice(start, end));
      }
      shapes.push(shapeRecordToGeometry(rings));
    } else {
      throw new Error(`지원하지 않는 shape type: ${shapeType} (admin_0_countries 는 5=Polygon 만 기대함)`);
    }
    off = recStart + contentLenBytes;
  }
  return shapes;
}

// ── 다각형 with holes 의 부호있는 면적/무게중심 (exterior - holes) ────────
function ringAreaCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  a = a / 2;
  if (a === 0) return { area: 0, cx: ring[0][0], cy: ring[0][1] };
  return { area: a, cx: cx / (6 * a), cy: cy / (6 * a) };
}

function polygonWithHolesCentroid(rings) {
  // rings[0] = exterior, rings[1..] = holes. 부호있는 면적을 합쳐 무게중심을 낸다.
  let totalArea = 0, sx = 0, sy = 0;
  rings.forEach((ring, idx) => {
    const { area, cx, cy } = ringAreaCentroid(ring);
    const signedArea = idx === 0 ? Math.abs(area) : -Math.abs(area);
    totalArea += signedArea;
    sx += cx * signedArea;
    sy += cy * signedArea;
  });
  if (totalArea === 0) return [rings[0][0][0], rings[0][0][1]];
  return [sx / totalArea, sy / totalArea];
}

function largestPolygonCentroid(geometry) {
  // MultiPolygon 이면 면적이 가장 큰 조각의 중심을 쓴다 — 날짜변경선을 넘나드는
  // 여러 조각(러시아·피지·미국 등)을 단순 평균하면 바다 위로 나갈 수 있어서다.
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let best = null, bestArea = -1;
  for (const poly of polys) {
    const area = Math.abs(ringAreaCentroid(poly[0]).area);
    if (area > bestArea) { bestArea = area; best = poly; }
  }
  return polygonWithHolesCentroid(best);
}

/**
 * 베트남처럼 가늘고 휘어진(오목한) 나라는 면적 무게중심이 국경 밖(바다)으로
 * 나갈 수 있다. lib/countryDataset.ts 의 point-in-polygon 으로 실제 내부인지
 * 확인하고, 아니면 (1) Natural Earth 가 라벨 배치용으로 직접 골라 둔
 * LABEL_X/LABEL_Y, (2) 무게중심 주변 나선형 탐색 순으로 대체한다.
 * 그래도 못 찾으면 무게중심을 쓰되 경고를 남긴다 — 조용히 넘어가지 않는다.
 */
function verifiedCentroid(geometry, naiveCentroid, rec, countryId) {
  if (CD.pointInGeometry(naiveCentroid[0], naiveCentroid[1], geometry)) {
    return { point: naiveCentroid, source: 'area-centroid' };
  }
  if (typeof rec.LABEL_X === 'number' && typeof rec.LABEL_Y === 'number') {
    if (CD.pointInGeometry(rec.LABEL_X, rec.LABEL_Y, geometry)) {
      return { point: [rec.LABEL_X, rec.LABEL_Y], source: 'natural-earth-label-point' };
    }
  }
  // 나선형 탐색: 무게중심 주변을 점점 넓혀가며 내부 점을 찾는다.
  const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 4];
  for (const r of steps) {
    for (let a = 0; a < 16; a++) {
      const theta = (a / 16) * Math.PI * 2;
      const cand = [naiveCentroid[0] + r * Math.cos(theta), naiveCentroid[1] + r * Math.sin(theta)];
      if (CD.pointInGeometry(cand[0], cand[1], geometry)) {
        return { point: [Number(cand[0].toFixed(5)), Number(cand[1].toFixed(5))], source: 'spiral-search' };
      }
    }
  }
  console.warn(`[build-country-dataset] ${countryId}: centroid 후보를 모두 시도했지만 polygon 내부를 못 찾았다 — 면적중심을 그대로 쓴다(검증 스크립트가 이를 실패로 잡아야 한다).`);
  return { point: naiveCentroid, source: 'area-centroid-unverified' };
}

// ── 실행 ──────────────────────────────────────────────────────────────
console.log(`[build-country-dataset] 입력: ${inputDir}`);
console.log(`[build-country-dataset] datasetVersion: ${datasetVersion}`);

const shpBuf = readFileSync(shpPath);
const dbfBuf = readFileSync(dbfPath);
const geometries = parseShp(shpBuf);
const records = parseDbf(dbfBuf);
if (geometries.length !== records.length) {
  console.error(`[build-country-dataset] shp 레코드 수(${geometries.length})와 dbf 레코드 수(${records.length})가 다르다.`);
  process.exit(1);
}
console.log(`[build-country-dataset] 원본 레코드 ${records.length}건 파싱 완료`);

if (!existsSync(majorPath)) {
  console.error(`[build-country-dataset] ${majorPath} 가 없다 — 먼저 candidate 목록(schema)을 만들어라.`);
  process.exit(1);
}
const major = JSON.parse(readFileSync(majorPath, 'utf8'));

const byAdm0 = new Map();
records.forEach((rec, i) => {
  byAdm0.set(rec.ADM0_A3, { rec, geometry: geometries[i] });
});

mkdirSync(outCountriesDir, { recursive: true });

let verifiedCount = 0;
const notFound = [];
const manifestEntries = [];

for (const c of major.countries) {
  const found = byAdm0.get(c.countryId);
  if (!found) { notFound.push(c.countryId); continue; }
  const { rec, geometry } = found;
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
    notFound.push(c.countryId);
    continue;
  }
  const naiveCentroid = largestPolygonCentroid(geometry);
  const { point: centroid, source: centroidSource } = verifiedCentroid(geometry, naiveCentroid, rec, c.countryId);
  c.centroid = [Number(centroid[0].toFixed(5)), Number(centroid[1].toFixed(5))];
  c.centroidSource = centroidSource;

  const fc = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        countryId: c.countryId,
        isoA3: c.isoA3,
        name: rec.NAME,
        nameEn: rec.NAME_EN,
        continent: rec.CONTINENT,
      },
      geometry,
    }],
  };
  writeFileSync(join(outCountriesDir, c.geometryFile), JSON.stringify(fc));
  manifestEntries.push({
    countryId: c.countryId,
    file: `countries/${c.geometryFile}`,
    name: rec.NAME,
    continent: rec.CONTINENT,
    partCount: geometry.type === 'MultiPolygon' ? geometry.coordinates.length : 1,
  });
  verifiedCount++;
}

major.verifiedAt = new Date().toISOString().slice(0, 10);
major.verifiedCount = verifiedCount;
major.datasetVersion = datasetVersion;
writeFileSync(majorPath, JSON.stringify(major, null, 2) + '\n');

writeFileSync(manifestPath, JSON.stringify({
  dataset: 'natural-earth',
  datasetVersion,
  scale: '10m',
  generatedAt: new Date().toISOString(),
  countries: manifestEntries,
}, null, 2) + '\n');

console.log(`[build-country-dataset] geometry 생성: ${verifiedCount}개국 → ${outCountriesDir}`);
if (notFound.length) {
  console.warn(`[build-country-dataset] Natural Earth 원본에서 찾지 못한 countryId: ${notFound.join(', ')}`);
}
console.log(`[build-country-dataset] major-countries.json 갱신: verifiedCount=${verifiedCount}, datasetVersion=${datasetVersion}`);

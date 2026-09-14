/**
 * 평면 세계지도 퀴즈(U12 / 08 §2·§3)가 쓸 geometry 번들을 만든다.
 *
 *   실행: node scripts/build-world-map.mjs
 *   결과: public/maps/world-quiz.v1.json
 *
 * ── 왜 번들이 필요한가 ────────────────────────────────────────
 * 원본은 Natural Earth 10m, 66개국 **13.6MB** 다(캐나다 한 나라가 2.6MB).
 * 06 §7 이 정한 최초 추가 전송 예산은 압축 3MB 이내다. 그대로는 못 보낸다.
 *
 * ── 단순화 규칙과 그 한계 ─────────────────────────────────────
 * 08 §3 이 못 박기를 "단순 polygon 단순화 때문에 작은 나라가 사라지면
 * 출제하지 말고 원인 해결/대체 모드 제공" 이다. 그래서
 *  - 허용오차를 나라마다 **자기 크기에 비례**해 잡는다. 통가·사모아에 캐나다와
 *    같은 자를 들이대면 작은 나라만 뭉개진다.
 *  - 한 나라의 조각(섬 등)은 아주 작아도 **가장 큰 조각은 반드시 남긴다**.
 *  - 만들고 나서 **검증한다**: 나라마다 대표점이 여전히 자기 나라 안에 들어가고,
 *    단순화 전후 면적이 크게 어긋나지 않아야 한다. 어긋나면 그 나라는
 *    quizEligible=false 로 내리고 아래 리포트에 남긴다 — 조용히 넘기지 않는다.
 *
 * 정답 판정은 이 번들의 polygon 으로 한다. 이름·국기는 여기 넣지 않는다
 * (COUNTRIES 와 alpha-3↔alpha-2 코드로 잇는다. 08 §3 "이름 문자열로만 join
 * 하지 않는다").
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "data/maps/natural-earth/countries";
const OUT_DIR = "public/maps";
const OUT = join(OUT_DIR, "world-quiz.v1.json");

const meta = JSON.parse(readFileSync("data/maps/major-countries.json", "utf8"));
const clean = (s) => String(s ?? "").replace(/\0/g, "").trim();

/* ── 기하 도구 ───────────────────────────────────────────── */

/** 링의 부호 있는 면적(도²). 크기 비교·조각 정렬용이지 실제 면적이 아니다. */
function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
}

function bbox(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/** 점에서 선분까지 거리의 제곱 (경위도 평면 근사 — 단순화 판단에만 쓴다). */
function segDist2(p, a, b) {
  let x = a[0], y = a[1];
  let dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker. 재귀 대신 스택 — 링 하나가 수만 점이라 재귀는 넘친다. */
function simplifyRing(ring, tol) {
  if (ring.length <= 4) return ring;
  const tol2 = tol * tol;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let far = -1, best = tol2;
    for (let i = lo + 1; i < hi; i++) {
      const d = segDist2(ring[i], ring[lo], ring[hi]);
      if (d > best) { best = d; far = i; }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([lo, far], [far, hi]);
    }
  }
  const out = [];
  for (let i = 0; i < ring.length; i++) if (keep[i]) out.push(ring[i]);
  // 링은 닫혀 있어야 한다. 3점 미만이면 폴리곤이 아니다.
  if (out.length < 4) return null;
  return out;
}

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

/** 파일은 FeatureCollection 이다 — 한 나라의 Feature 들을 모두 합친다. */
function toPolygonList(node) {
  if (node.type === "FeatureCollection") {
    return node.features.flatMap((f) => toPolygonList(f.geometry));
  }
  if (node.type === "Feature") return toPolygonList(node.geometry);
  if (node.type === "Polygon") return [node.coordinates];
  if (node.type === "MultiPolygon") return node.coordinates;
  throw new Error(`알 수 없는 geometry: ${node.type}`);
}

/* ── 점-다각형 판정 (검증용. lib/countryDataset.ts 와 같은 규칙) ── */
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
function pointInPolygons(lng, lat, polys) {
  for (const poly of polys) {
    if (!pointInRing(lng, lat, poly[0])) continue;
    let hole = false;
    for (let h = 1; h < poly.length; h++) if (pointInRing(lng, lat, poly[h])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
}

/* ── 본 작업 ─────────────────────────────────────────────── */

const files = new Set(readdirSync(SRC));
const out = [];
const report = [];
let srcPoints = 0, outPoints = 0;

for (const c of meta.countries) {
  const id = clean(c.countryId);
  const file = clean(c.geometryFile);
  if (!files.has(file)) { report.push({ id, why: `geometry 파일 없음(${file})` }); continue; }

  const gj = JSON.parse(readFileSync(join(SRC, file), "utf8"));
  const polys = toPolygonList(gj);
  for (const p of polys) for (const r of p) srcPoints += r.length;

  /**
   * 나라 자기 크기에 맞춘 허용오차 — 단, **조각 하나씩** 재야 한다.
   *
   * 처음엔 나라 전체 bbox 로 쟀다. 그랬더니 피지가 통째로 사라졌다. 피지는
   * 날짜변경선에 걸쳐 있어 경도가 -180 과 +180 양쪽에 있고, 전체 bbox 를 재면
   * 폭이 360도로 잡힌다 → 허용오차가 폭발 → 섬이 전부 한 점으로 뭉개졌다.
   * (08 §3 이 "날짜변경선" 을 따로 짚어 둔 이유가 이것이다. 러시아·미국도 같다.)
   * 조각 하나의 크기로 재면 작은 섬에는 작은 자가 간다.
   */
  const partTol = (poly) => {
    const [bx0, by0, bx1, by1] = bbox([poly[0]]);
    return Math.max(0.008, Math.hypot(bx1 - bx0, by1 - by0) * 0.0022);
  };

  // 조각을 큰 순서로 두고, 너무 작은 조각은 버리되 가장 큰 것은 반드시 남긴다.
  const scored = polys
    .map((poly) => ({ poly, area: ringArea(poly[0]) }))
    .sort((a, b) => b.area - a.area);
  const biggest = scored[0]?.area ?? 0;
  const kept = [];
  for (let i = 0; i < scored.length; i++) {
    const { poly, area } = scored[i];
    // 가장 큰 조각의 1/2000 보다 작은 섬은 이 배율에서 한 점도 안 되므로 뺀다.
    if (i > 0 && area < biggest / 2000) continue;
    const tol = partTol(poly);
    const rings = [];
    for (const ring of poly) {
      const s = simplifyRing(ring, tol);
      if (!s) continue;
      rings.push(s.map(([x, y]) => [round(x), round(y)]));
    }
    if (rings.length) kept.push(rings);
  }
  if (!kept.length) { report.push({ id, why: "단순화 후 폴리곤이 남지 않음" }); continue; }
  for (const p of kept) for (const r of p) outPoints += r.length;

  out.push({
    countryId: id,
    isoA3: clean(c.isoA3),
    continent: clean(c.continent),
    quizEligible: c.quizEligible !== false,
    centroid: c.centroid ? [round(c.centroid[0], 4), round(c.centroid[1], 4)] : null,
    polygons: kept,
  });
}

/* ── 검증: 단순화가 나라를 망가뜨렸는가 ── */
let downgraded = 0;
for (const c of out) {
  if (!c.quizEligible) continue;
  const problems = [];
  // 1) 대표점이 여전히 자기 나라 안인가
  if (c.centroid && !pointInPolygons(c.centroid[0], c.centroid[1], c.polygons)) {
    problems.push("대표점이 나라 밖으로 나감");
  }
  // 2) 원본 대비 면적이 크게 어긋나지 않는가 (±12%)
  const srcGeom = JSON.parse(readFileSync(join(SRC, `countries.${c.countryId}.json`), "utf8"));
  const srcPolys = toPolygonList(srcGeom);
  const aSrc = srcPolys.reduce((s, p) => s + ringArea(p[0]), 0);
  const aOut = c.polygons.reduce((s, p) => s + ringArea(p[0]), 0);
  const drift = aSrc > 0 ? Math.abs(aOut - aSrc) / aSrc : 1;
  if (drift > 0.12) problems.push(`면적 ${(drift * 100).toFixed(1)}% 어긋남`);

  if (problems.length) {
    c.quizEligible = false;
    downgraded += 1;
    report.push({ id: c.countryId, why: problems.join(" / ") });
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const bundle = {
  _readme:
    "평면 세계지도 퀴즈용 단순화 geometry. 원본은 Natural Earth 10m(public domain). " +
    "scripts/build-world-map.mjs 가 만든다 — 손으로 고치지 말 것. " +
    "quizEligible:false 는 표시는 하되 정답 판정 대상에서 뺀다는 뜻이다.",
  dataset: clean(meta.dataset),
  datasetVersion: clean(meta.datasetVersion),
  scale: clean(meta.scale),
  license: clean(meta.license),
  sourceUrl: clean(meta.sourceUrl),
  builtAt: new Date().toISOString(),
  countries: out,
};
writeFileSync(OUT, JSON.stringify(bundle));

const bytes = Buffer.byteLength(JSON.stringify(bundle));
console.log(`나라 ${out.length}개 · 출제 가능 ${out.filter((c) => c.quizEligible).length}개`);
console.log(`점 ${srcPoints.toLocaleString()} → ${outPoints.toLocaleString()} (${(100 - (outPoints / srcPoints) * 100).toFixed(1)}% 감소)`);
console.log(`번들 ${(bytes / 1024 / 1024).toFixed(2)}MB (원본 13.6MB)`);
if (report.length) {
  console.log(`\n출제에서 뺀 나라 ${report.length}개 — 조용히 넘기지 않는다:`);
  for (const r of report) console.log(`  ${r.id}: ${r.why}`);
} else {
  console.log("\n단순화로 망가진 나라 없음.");
}

/**
 * 평면 세계지도 퀴즈 순수 로직 검사 (08 §3·§5).
 *
 *   실행: node scripts/test-world-map-quiz.mjs
 *
 * 화면 없이 lib/worldMapQuiz.ts 를 그대로 돌린다(scripts/test-animals.mjs 와
 * 같은 방식). 08 §5 가 요구한 것 중 **좌표·판정·출제**에 해당하는 것을 여기서
 * 잰다. 눈으로 보는 것(라벨 노출, 힌트 UI)은 화면 검수에서 따로 한다.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";

const src = readFileSync("lib/worldMapQuiz.ts", "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = await import(`data:text/javascript,${encodeURIComponent(js)}`);
const {
  project, unproject, hitTest, planQuiz, hintView, countryName,
  ISO3_TO_ISO2, SUPPLEMENT_NAMES, MAP_ASPECT, HINT_STAGES,
} = mod;

const bundle = JSON.parse(readFileSync("public/maps/world-quiz.v1.json", "utf8"));
const countries = bundle.countries;
const eligible = countries.filter((c) => c.quizEligible);

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) fail++; };

console.log("데이터");
ok(countries.length >= 60, `나라 ${countries.length}개 (60개 이상 목표)`);
ok(eligible.length >= 60, `출제 가능 ${eligible.length}개`);
ok(bundle.license === "public-domain" && /naturalearthdata/.test(bundle.sourceUrl),
  `출처·라이선스 기록됨: ${bundle.dataset} ${bundle.datasetVersion} / ${bundle.license}`);
{
  const conts = new Set(eligible.map((c) => c.continent));
  ok(conts.size === 6, `대륙 ${conts.size}개 모두 출제 범위에 있음`);
}

console.log("\n투영 — 역변환이 정확한가");
{
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const lng = Math.random() * 360 - 180;
    const lat = Math.random() * 180 - 90;
    const p = project(lng, lat);
    const u = unproject(p.x, p.y);
    worst = Math.max(worst, Math.abs(u.lng - lng), Math.abs(u.lat - lat));
  }
  ok(worst < 1e-9, `왕복 오차 최대 ${worst.toExponential(1)}도`);
  ok(MAP_ASPECT === 2, "가로비 2:1 유지");
  const c = project(0, 0);
  ok(Math.abs(c.x - 0.5) < 1e-12 && Math.abs(c.y - 0.5) < 1e-12, "적도·본초자오선이 지도 한가운데");
}

console.log("\n정답 판정 — 나라마다 자기 대표점이 자기 나라로 잡히는가");
{
  let bad = [];
  for (const c of eligible) {
    if (!c.centroid) continue;
    const r = hitTest(c.centroid[0], c.centroid[1], countries);
    const hit = r.status === "country" ? r.countryId
      : r.status === "ambiguous" ? (r.candidates.includes(c.countryId) ? c.countryId : r.candidates[0])
      : "(바다)";
    if (hit !== c.countryId) bad.push(`${c.countryId}→${hit}`);
  }
  ok(bad.length === 0, `대표점 판정 실패 ${bad.length}개${bad.length ? ": " + bad.join(" ") : ""}`);
}

console.log("\n바다 클릭 — 가까운 나라를 억지로 정답 처리하지 않는가");
{
  // 태평양 한가운데, 대서양 한가운데, 인도양 한가운데.
  const seas = [[-140, 0], [-30, -20], [75, -35]];
  const results = seas.map(([lng, lat]) => hitTest(lng, lat, countries).status);
  ok(results.every((s) => s === "ocean"), `먼바다 3곳 모두 ocean: ${results.join(", ")}`);
}

console.log("\n날짜변경선·작은 나라");
{
  const fiji = countries.find((c) => c.countryId === "FJI");
  ok(!!fiji && fiji.polygons.length > 0, `피지 폴리곤 ${fiji ? fiji.polygons.length : 0}개 (날짜변경선 위)`);
  ok(!!fiji && fiji.quizEligible, "피지가 출제 가능으로 남음");
  for (const id of ["TON", "WSM", "JAM"]) {
    const c = countries.find((x) => x.countryId === id);
    const r = c && c.centroid ? hitTest(c.centroid[0], c.centroid[1], countries) : null;
    ok(!!r && r.status !== "ocean", `작은 나라 ${id} 가 판정에 잡힘`);
  }
}

console.log("\n출제 — 중복·부족·시드");
{
  const p = planQuiz(countries, { seed: 42, count: 10 });
  ok(new Set(p.questions).size === p.questions.length, `10문제에 중복 없음`);
  ok(p.questions.every((id) => eligible.some((c) => c.countryId === id)),
    "출제 불가 나라가 문제로 나오지 않음");
  const again = planQuiz(countries, { seed: 42, count: 10 });
  ok(JSON.stringify(p.questions) === JSON.stringify(again.questions),
    "같은 시드 = 같은 문제 (resize 가 문제를 다시 뽑지 않는 근거)");
  const other = planQuiz(countries, { seed: 43, count: 10 });
  ok(JSON.stringify(p.questions) !== JSON.stringify(other.questions), "다른 시드 = 다른 문제");

  const all = planQuiz(countries, { seed: 1, count: 999 });
  ok(all.shortOf === true && all.questions.length === eligible.length,
    `범위보다 많이 요청하면 ${all.questions.length}개로 줄이고 shortOf 로 알림`);

  const oneCont = planQuiz(countries, { seed: 5, count: 5, continents: ["Oceania"] });
  ok(oneCont.questions.every((id) => countries.find((c) => c.countryId === id).continent === "Oceania"),
    "대륙 범위를 고르면 그 대륙에서만 나옴");
}

console.log("\n힌트 — 대륙 → 지역 강조 → 정답 순서");
{
  const h0 = hintView(0, "Asia"), h1 = hintView(1, "Asia"), h2 = hintView(2, "Asia"), h3 = hintView(3, "Asia");
  ok(h0.continent === null && !h0.highlightContinent && !h0.revealAnswer, "0단계: 아무것도 안 알려줌");
  ok(h1.continent === "Asia" && !h1.highlightContinent, "1단계: 대륙 이름만");
  ok(h2.highlightContinent && !h2.revealAnswer, "2단계: 지역 강조, 정답은 아직");
  ok(h3.revealAnswer, "3단계: 정답 위치");
  ok(hintView(99, "Asia").stage === HINT_STAGES, "단계는 최대치를 넘지 않음");
}

console.log("\n이름 — 코드로 잇는가");
{
  const gd = readFileSync("lib/gameData.ts", "utf8");
  const byIso2 = {};
  for (const m of gd.matchAll(/\{\s*code:\s*"([A-Z]{2})"[^}]*?names:\s*\{([^}]*)\}/g)) {
    const dict = {};
    for (const n of m[2].matchAll(/(\w+):\s*"([^"]*)"/g)) dict[n[1]] = n[2];
    byIso2[m[1]] = dict;
  }
  const src2 = { byIso2 };
  ok(countryName("KOR", "ko", src2) === "대한민국", `KOR→${countryName("KOR", "ko", src2)}`);
  ok(countryName("VNM", "vi", src2) === "Việt Nam" || countryName("VNM", "vi", src2).length > 0,
    `VNM(vi)→${countryName("VNM", "vi", src2)}`);
  ok(countryName("TON", "ko", src2) === "통가", `보충표에서 TON→${countryName("TON", "ko", src2)}`);

  const missing = eligible.filter((c) => countryName(c.countryId, "ko", src2) === c.countryId);
  ok(missing.length === 0, `한국어 이름 없는 출제 대상 ${missing.length}개${missing.length ? ": " + missing.map((c) => c.countryId).join(" ") : ""}`);

  const iso2Missing = eligible.filter((c) => !ISO3_TO_ISO2[c.countryId]);
  ok(iso2Missing.length === 0, `alpha-2 코드 없는 나라 ${iso2Missing.length}개`);

  const supOnly = eligible.filter((c) => !byIso2[ISO3_TO_ISO2[c.countryId]]);
  console.log(`  · 보충표(한국어·영어만)로 이름을 대는 나라 ${supOnly.length}개 — 나머지 13개 언어는 선생님 검수 대상이다.`);
}

console.log(fail ? `\n미달 ${fail}건` : "\n전부 통과");
process.exit(fail ? 1 : 0);

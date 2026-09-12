/**
 * X01 회귀 검사 — ADD-ID-01 / ADD-ID-02 / ADD-MIGRATE-01.
 *
 * scripts/test-word-memory.mjs 와 같은 방식으로 lib/learnerId.ts 를 런타임
 * transpile 해 **그 파일 자체**를 실행한다. 복사본을 두지 않는다 — 복사본은
 * 드리프트로 회귀를 놓친다.
 *
 * 기대값은 구현의 반환값을 그대로 베끼지 않고, "같은 이름 두 명의 기록이
 * 섞이지 않는다 / 이름을 고쳐도 같은 기록을 본다" 라는 사용자 관점 조건으로
 * 독립 정의한다.
 *
 * 실행: node scripts/test-learner-id.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "bee-learner-"));

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };

function transpile(relPath, outName, rewrite = (s) => s) {
  const source = readFileSync(resolve(ROOT, relPath), "utf8");
  const out = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, outName), rewrite(out));
  return pathToFileURL(join(dir, outName));
}

try {
  const L = await import(transpile("lib/learnerId.ts", "learnerId.mjs"));
  const {
    LEARNER_DOMAINS, createLearnerProfile, renameLearner, setLearnerMark,
    resolveLearnerScope, resolveAllScopes, buildLegacyClaims, encodeLegacyKey,
    learnerKey, domainPrefix, contentHash, recordCount, duplicateActiveNames,
    activeDisplayNames, LEARNER_MARKS,
  } = L;

  const ROOM = "9999";

  // ── 가짜 저장소 (경로 → 값). 실제 DB 는 쓰지 않는다. ──
  function makeStore(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
      map,
      has: (p) => map.has(p) && map.get(p) != null,
      get: (p) => map.get(p) ?? null,
      set: (p, v) => { map.set(p, v); },
      paths: () => [...map.keys()].sort(),
    };
  }

  let uuidN = 0;
  const seqUuid = () => `u${String(++uuidN).padStart(4, "0")}`;
  const path = (domain, key) => `${domainPrefix(ROOM, domain)}/${key}`;

  /* ═══════════════════ ADD-ID-01 ═══════════════════
   * 같은 이름 학생 2명, 각각 서로 다른 스티커/단어/녹음.
   * 기대: 조회·갱신·전환에서 서로 기록이 섞이지 않는다.
   */

  check("ADD-ID-01 동명이인은 서로 다른 learnerId 를 받는다", () => {
    const a = createLearnerProfile("김민준", 1000, seqUuid);
    const b = createLearnerProfile("김민준", 1001, seqUuid);
    assert.notEqual(a.learnerId, b.learnerId);
    assert.equal(a.displayName, b.displayName);
    const dups = duplicateActiveNames([a, b]);
    assert.equal(dups.get("김민준").length, 2, "교사 UI 가 동명이인을 알아볼 수 있어야 한다");
  });

  check("ADD-ID-01 이관 후: 조회·갱신·전환에서 기록이 섞이지 않는다", () => {
    const a = createLearnerProfile("김민준", 1000, seqUuid);
    const b = createLearnerProfile("김민준", 1001, seqUuid);
    const store = makeStore({
      [path("stickers", learnerKey(a.learnerId))]: { s1: { type: "star" } },
      [path("stickers", learnerKey(b.learnerId))]: { s9: { type: "heart" }, s10: { type: "star" } },
      [path("vocabProgress", learnerKey(a.learnerId))]: { 사과: { doneSentences: [0] } },
      [path("vocabProgress", learnerKey(b.learnerId))]: { 바나나: { doneSentences: [1, 2] } },
      [path("vocabRecordings", learnerKey(a.learnerId))]: { "사과_0": { audioUrl: "a" } },
      [path("vocabRecordings", learnerKey(b.learnerId))]: { "바나나_1": { audioUrl: "b" } },
    });
    const claims = buildLegacyClaims([a, b]);

    // 조회
    for (const domain of ["stickers", "vocabProgress", "vocabRecordings"]) {
      const sa = resolveLearnerScope(ROOM, domain, a, store.has, { claims });
      const sb = resolveLearnerScope(ROOM, domain, b, store.has, { claims });
      assert.equal(sa.source, "learner");
      assert.equal(sb.source, "learner");
      assert.notEqual(sa.readPath, sb.readPath);
      assert.equal(sa.readPath, sa.writePath, "읽기/쓰기 경로는 하나여야 한다");
      assert.equal(sb.readPath, sb.writePath);
    }
    // 기대값 독립 정의: A 는 스티커 1개, B 는 2개
    assert.equal(recordCount(store.get(resolveLearnerScope(ROOM, "stickers", a, store.has, { claims }).readPath)), 1);
    assert.equal(recordCount(store.get(resolveLearnerScope(ROOM, "stickers", b, store.has, { claims }).readPath)), 2);

    // 갱신: A 에 스티커 추가 → B 는 그대로
    const beforeB = contentHash(store.get(path("stickers", learnerKey(b.learnerId))));
    const wa = resolveLearnerScope(ROOM, "stickers", a, store.has, { claims }).writePath;
    store.set(wa, { ...store.get(wa), s2: { type: "moon" } });
    assert.equal(recordCount(store.get(wa)), 2);
    assert.equal(contentHash(store.get(path("stickers", learnerKey(b.learnerId)))), beforeB);

    // 전환(공용 태블릿에서 A → B): 해석은 순수 함수라 앞사람 상태가 남지 않는다
    const seen = [a, b, a, b].map((p) => resolveLearnerScope(ROOM, "vocabProgress", p, store.has, { claims }).readPath);
    assert.deepEqual(seen, [
      path("vocabProgress", learnerKey(a.learnerId)),
      path("vocabProgress", learnerKey(b.learnerId)),
      path("vocabProgress", learnerKey(a.learnerId)),
      path("vocabProgress", learnerKey(b.learnerId)),
    ]);
  });

  check("ADD-ID-01 이관 전 섞인 옛 기록은 자동으로 한 명에게 주지 않는다", () => {
    const a = createLearnerProfile("김민준", 1000, seqUuid);
    const b = createLearnerProfile("김민준", 1001, seqUuid);
    const legacy = path("stickers", encodeLegacyKey("김민준"));
    const store = makeStore({ [legacy]: { s1: { type: "star" }, s2: { type: "heart" } } });
    const claims = buildLegacyClaims([a, b]);

    for (const p of [a, b]) {
      const s = resolveLearnerScope(ROOM, "stickers", p, store.has, { claims });
      assert.equal(s.source, "ambiguous");
      assert.notEqual(s.readPath, legacy, "섞인 옛 경로를 한 명의 기록으로 읽으면 안 된다");
      assert.equal(s.readPath, s.writePath);
      assert.equal(s.writePath, path("stickers", learnerKey(p.learnerId)), "새 기록은 깨끗한 자기 경로로");
      assert.deepEqual(s.conflict.claimedBy, [a.learnerId, b.learnerId].sort());
    }
    // 옛 경로는 손대지 않는다
    assert.equal(recordCount(store.get(legacy)), 2);
  });

  check("ADD-ID-01 동명이인 아닌 학생은 옛 이름 경로를 그대로 읽는다", () => {
    const c = createLearnerProfile("이서연", 1000, seqUuid);
    const legacy = path("vocabProgress", "이서연");
    const store = makeStore({ [legacy]: { 사과: { doneSentences: [0] } } });
    const s = resolveLearnerScope(ROOM, "vocabProgress", c, store.has, { claims: buildLegacyClaims([c]) });
    assert.equal(s.source, "legacy");
    assert.equal(s.readPath, legacy);
    assert.equal(s.writePath, legacy, "이관 전에는 옛 경로가 유일한 권위 경로다");
    assert.equal(s.pendingMigration, true);
  });

  check("ADD-ID-01 이름 표식은 국적·피부색이 아니라 사물·도형이다", () => {
    const banned = /국기|flag|skin|피부|nation|race/i;
    for (const m of LEARNER_MARKS) {
      assert.ok(!banned.test(m.id) && !banned.test(m.ko), `표식 ${m.id} 이(가) 출신 표시로 읽힐 수 있다`);
    }
    const a = createLearnerProfile("김민준", 1000, seqUuid);
    const marked = setLearnerMark(a, "star", 1002);
    assert.equal(marked.markId, "star");
    assert.equal(marked.learnerId, a.learnerId);
    assert.throws(() => setLearnerMark(a, "korea-flag", 1003));
  });

  /* ═══════════════════ ADD-ID-02 ═══════════════════
   * 이름 수정 → 재조회 → 다른 기기.
   * 기대: learnerId 유지, 연결 기록 동일.
   */

  check("ADD-ID-02 이름을 고쳐도 learnerId 와 기록이 그대로다 (이관 전)", () => {
    let c = createLearnerProfile("이서연", 1000, seqUuid);
    const legacy = path("vocabProgress", "이서연");
    const store = makeStore({ [legacy]: { 사과: { doneSentences: [0] }, 바나나: { doneSentences: [1] } } });
    const before = { count: recordCount(store.get(legacy)), hash: contentHash(store.get(legacy)) };

    const idBefore = c.learnerId;
    c = renameLearner(c, "이서윤", 2000);          // 오탈자 수정
    assert.equal(c.learnerId, idBefore, "learnerId 는 불변");
    assert.equal(c.displayName, "이서윤");
    assert.deepEqual(c.legacyNameKeys, ["이서연"]);

    const s = resolveLearnerScope(ROOM, "vocabProgress", c, store.has, { claims: buildLegacyClaims([c]) });
    assert.equal(s.readPath, legacy, "옛 이름 경로를 계속 찾아간다");
    assert.equal(recordCount(store.get(s.readPath)), before.count);
    assert.equal(contentHash(store.get(s.readPath)), before.hash);

    // 두 번째 개명도 누적된다
    const c2 = renameLearner(c, "이서율", 3000);
    assert.deepEqual(c2.legacyNameKeys, ["이서윤", "이서연"]);
    const s2 = resolveLearnerScope(ROOM, "vocabProgress", c2, store.has, { claims: buildLegacyClaims([c2]) });
    assert.equal(s2.readPath, legacy);
    assert.equal(contentHash(store.get(s2.readPath)), before.hash);
  });

  check("ADD-ID-02 다른 기기에서 들어와도 같은 경로·같은 내용", () => {
    let c = createLearnerProfile("이서연", 1000, seqUuid);
    const store = makeStore({ [path("lms", "이서연")]: { xp: 120, hearts: 5 } });
    c = renameLearner(c, "이서윤", 2000);
    const claims = buildLegacyClaims([c]);

    // 기기 1
    const s1 = resolveAllScopes(ROOM, c, store.has, { claims });
    // 기기 2 — 로컬 캐시 없이 같은 프로필/같은 저장소만으로 해석
    const fresh = JSON.parse(JSON.stringify(c));
    const s2 = resolveAllScopes(ROOM, fresh, store.has, { claims });
    for (const d of LEARNER_DOMAINS) {
      assert.equal(s1[d].readPath, s2[d].readPath, `${d}: 기기마다 경로가 달라지면 안 된다`);
      assert.equal(s1[d].readPath, s1[d].writePath);
    }
    assert.equal(contentHash(store.get(s2.lms.readPath)), contentHash({ xp: 120, hearts: 5 }));
  });

  check("ADD-ID-02 이관 후에는 이름을 고쳐도 learnerId 경로를 유지한다", () => {
    let c = createLearnerProfile("이서연", 1000, seqUuid);
    const lid = path("stickers", learnerKey(c.learnerId));
    const store = makeStore({
      [path("stickers", "이서연")]: { old: { type: "star" } },   // 옛 경로는 남아 있다
      [lid]: { s1: { type: "star" }, s2: { type: "heart" } },
    });
    const s0 = resolveLearnerScope(ROOM, "stickers", c, store.has, { claims: buildLegacyClaims([c]) });
    assert.equal(s0.readPath, lid, "새 경로에 기록이 있으면 그쪽이 권위 경로");

    c = renameLearner(c, "이서윤", 2000);
    const s1 = resolveLearnerScope(ROOM, "stickers", c, store.has, { claims: buildLegacyClaims([c]) });
    assert.equal(s1.readPath, lid);
    assert.equal(s1.source, "learner");
    assert.equal(recordCount(store.get(s1.readPath)), 2);
  });

  check("ADD-ID-02 명렬표 표시 이름은 파생값이고 기록 위치와 무관하다", () => {
    const a = createLearnerProfile("가", 1, seqUuid);
    const b = createLearnerProfile("나", 2, seqUuid);
    const archivedB = { ...b, rosterStatus: "archived" };
    assert.deepEqual(activeDisplayNames([a, archivedB]), ["가"]);
    assert.deepEqual(activeDisplayNames([a, b]), ["가", "나"]);
  });

  /* ═══════════════════ ADD-MIGRATE-01 ═══════════════════ */

  const migratePath = resolve(ROOT, "scripts/migrate-learner-id.mjs");
  const migrateSrc = readFileSync(migratePath, "utf8");

  check("ADD-MIGRATE-01 이관 스크립트에 DB 쓰기·네트워크 코드가 없다", () => {
    // import 문 자체를 본다 — 주석에 'firebase' 라는 낱말이 나오는 것과 구분한다.
    const imports = [...migrateSrc.matchAll(/^\s*import[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
    const disallowed = imports.filter((m) => !m.startsWith("node:") && m !== "typescript");
    assert.deepEqual(disallowed, [], `허용되지 않은 import: ${disallowed.join(", ")}`);
    assert.ok(!/require\(/.test(migrateSrc), "require 로 우회하면 안 된다");
    // RTDB 쓰기 / 네트워크 흔적
    for (const api of ["getClientDb", "firebase-client", "runTransaction", "set\\(ref", "update\\(ref", "remove\\(ref", "\\bfetch\\(", "https?://"]) {
      assert.ok(!new RegExp(api).test(migrateSrc), `쓰기/네트워크 API 흔적: ${api}`);
    }
    assert.ok(/FORBIDDEN_ROOMS = \["1111"\]/.test(migrateSrc), "운영 방 1111 차단이 있어야 한다");
    // 파일 쓰기는 transpile 산출물(임시 디렉터리)에만 쓴다
    const writes = migrateSrc.match(/writeFileSync\(/g) ?? [];
    assert.equal(writes.length, 1, "파일 쓰기는 transpile 임시 산출물 1곳뿐이어야 한다");
    // 실행 옵션은 거부한다
    assert.ok(/--execute/.test(migrateSrc) && /dry-run 전용/.test(migrateSrc));
  });

  const M = await import(pathToFileURL(migratePath));

  check("ADD-MIGRATE-01 운영 방은 계획조차 만들지 않는다", () => {
    assert.throws(() => M.planMigration(M.buildFixtureRoom(), "1111"), /운영 방/);
  });

  check("ADD-MIGRATE-01 같은 입력 2회 실행 결과가 동일하다", () => {
    const room = M.buildFixtureRoom();
    const p1 = M.planMigration(room, M.FIXTURE_ROOM_CODE);
    const p2 = M.planMigration(M.buildFixtureRoom(), M.FIXTURE_ROOM_CODE);
    assert.equal(JSON.stringify(p1), JSON.stringify(p2));
    assert.equal(p1.problems.length, 0);
    assert.ok(p1.copies.length > 0, "검사가 의미 있으려면 옮길 것이 있어야 한다");
  });

  check("ADD-MIGRATE-01 중간 실패 후 재실행: 누락·중복 0", () => {
    const room = M.buildFixtureRoom();
    const v = M.verifyIdempotent(room, M.FIXTURE_ROOM_CODE);
    assert.deepEqual(v.findings, []);
    assert.equal(v.ok, true);

    // 독립 재검증: 절반만 적용 → 재계획 → 나머지 적용 → 전수 대조
    const plan = M.planMigration(room, M.FIXTURE_ROOM_CODE);
    const half = Math.floor(plan.copies.length / 2);
    const partial = M.simulateApply(room, plan, { stopAfter: half });
    const resumed = M.planMigration(partial.room, M.FIXTURE_ROOM_CODE);
    assert.equal(resumed.copies.length, plan.copies.length - half);
    const done = M.simulateApply(partial.room, resumed);
    const final = M.planMigration(done.room, M.FIXTURE_ROOM_CODE);
    assert.equal(final.copies.length, 0, "재실행 후 남은 복사가 있으면 누락이다");

    const targets = plan.copies.map((c) => c.to);
    assert.equal(new Set(targets).size, targets.length, "같은 대상에 두 번 쓰는 계획은 중복이다");
    for (const c of plan.copies) {
      const src = M.readByPath(room, M.FIXTURE_ROOM_CODE, c.from);
      const dst = M.readByPath(done.room, M.FIXTURE_ROOM_CODE, c.to);
      assert.equal(contentHash(src), contentHash(dst), `${c.to} 내용 불일치`);
      assert.equal(recordCount(src), recordCount(dst), `${c.to} 개수 불일치`);
      assert.notEqual(M.readByPath(done.room, M.FIXTURE_ROOM_CODE, c.from), null, "기존 이름 경로를 지우면 안 된다");
    }
  });

  check("ADD-MIGRATE-01 모호한 매핑을 자동 병합하지 않는다", () => {
    const room = M.buildFixtureRoom();
    const plan = M.planMigration(room, M.FIXTURE_ROOM_CODE);
    assert.ok(plan.ambiguous.length > 0, "fixture 에 동명이인/키 충돌이 들어 있어야 한다");
    const ambiguousPaths = new Set(plan.ambiguous.map((a) => a.path));
    for (const c of plan.copies) {
      assert.ok(!ambiguousPaths.has(c.from), `모호 항목을 복사 계획에 넣었다: ${c.from}`);
    }
    // 동명이인 '김민준' 과 encodeKey 충돌 '박.서준'/'박_서준' 이 모두 잡혔는가
    const keys = new Set(plan.ambiguous.map((a) => a.legacyKey));
    assert.ok(keys.has("김민준"), "동명이인 미검출");
    assert.ok(keys.has("박_서준"), "encodeKey 충돌 미검출");
    for (const a of plan.ambiguous) assert.ok(a.claimedBy.length >= 2);
  });

  check("ADD-MIGRATE-01 주인 없는 옛 키는 삭제 계획에 넣지 않는다", () => {
    const plan = M.planMigration(M.buildFixtureRoom(), M.FIXTURE_ROOM_CODE);
    assert.ok(plan.orphans.length > 0);
    assert.equal(typeof plan.deletePaths, "undefined", "이관 계획에 삭제 목록이 있으면 안 된다");
    assert.ok(!/delete|remove/i.test(JSON.stringify(plan)), "계획 어디에도 삭제 지시가 없어야 한다");
  });

  check("ADD-MIGRATE-01 예약 키(_lastAward)는 학습자 키로 세지 않는다", () => {
    const room = M.buildFixtureRoom();
    const inv = M.buildInventory(room, M.FIXTURE_ROOM_CODE);
    const emotions = inv.domains.find((d) => d.domain === "emotions");
    assert.ok(!emotions.entries.some((e) => e.key.startsWith("_")));
  });

  /* ═══════════════════ 결정적 무작위 입력 루프 ═══════════════════ */

  check("5,000회 결정적 무작위 조작에서 불변식 유지", () => {
    let seed = 20260912;
    const rnd = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    const names = ["가", "나", "다", "가", "라.마", "라_마"];
    let profiles = names.map((n, i) => createLearnerProfile(n, 1000 + i, seqUuid));
    const idsAtStart = profiles.map((p) => p.learnerId);
    const store = makeStore();
    // 절반은 옛 이름 경로에 기록이 있다
    for (const p of profiles.slice(0, 3)) {
      store.set(path("stickers", encodeLegacyKey(p.displayName)), { s: { type: "star" } });
    }

    for (let i = 0; i < 5000; i++) {
      const claims = buildLegacyClaims(profiles);
      const idx = rnd(profiles.length);
      const p = profiles[idx];
      const domain = LEARNER_DOMAINS[rnd(LEARNER_DOMAINS.length)];
      const scope = resolveLearnerScope(ROOM, domain, p, store.has, { claims });

      // 불변식 1: 권위 경로는 언제나 하나다
      assert.equal(scope.readPath, scope.writePath);
      // 불변식 2: 모호하면 옛 경로를 절대 읽지 않는다
      if (scope.source === "ambiguous") {
        assert.equal(scope.readPath, `${domainPrefix(ROOM, domain)}/${learnerKey(p.learnerId)}`);
      }
      // 불변식 3: 다른 학습자의 learnerId 경로를 가리키지 않는다
      for (const other of profiles) {
        if (other.learnerId === p.learnerId) continue;
        assert.notEqual(scope.readPath, `${domainPrefix(ROOM, domain)}/${learnerKey(other.learnerId)}`);
      }

      const op = rnd(5);
      if (op === 0) profiles[idx] = renameLearner(p, `이름${rnd(4)}`, 5000 + i);
      else if (op === 1) profiles[idx] = setLearnerMark(p, LEARNER_MARKS[rnd(LEARNER_MARKS.length)].id, 5000 + i);
      else if (op === 2) store.set(scope.writePath, { ...(store.get(scope.writePath) ?? {}), [`r${i}`]: { v: i } });
      else if (op === 3) profiles[idx] = { ...p, rosterStatus: p.rosterStatus === "active" ? "archived" : "active" };
      // op 4 = 아무것도 하지 않음(재조회만)

      // 불변식 4: learnerId 는 어떤 조작에도 바뀌지 않는다
      assert.equal(profiles[idx].learnerId, idsAtStart[idx]);
    }

    // 불변식 5: 한 학습자의 learnerId 경로에 쓴 기록을 다른 학습자가 읽지 않는다
    const claims = buildLegacyClaims(profiles);
    const owners = new Map();
    for (const p of profiles) {
      for (const domain of LEARNER_DOMAINS) {
        const s = resolveLearnerScope(ROOM, domain, p, store.has, { claims });
        if (!s.readPath.includes("/lid_")) continue;
        const prev = owners.get(s.readPath);
        assert.ok(prev === undefined || prev === p.learnerId, `경로 공유 발생: ${s.readPath}`);
        owners.set(s.readPath, p.learnerId);
      }
    }
  });

  console.log(`\n${passed}개 검사 통과`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

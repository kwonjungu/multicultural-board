/**
 * X02 회귀 검사 — ADD-ROSTER-01.
 *
 * 기대값: 명렬표에서 제거 → 보관 → 복원 후 원본 콘텐츠/개수/hash 가 동일하고,
 * **완전 삭제 어댑터 호출 횟수가 0** 이어야 한다. 삭제 어댑터에 spy 를 걸어
 * 호출 횟수를 직접 센다 — 함수가 "성공했다" 고 돌려주는 값을 믿지 않는다.
 *
 * 재현 대상(고치기 전 동작):
 *   components/RoomManagePanel.tsx 의 saveRoster 는 명렬표에서 빠진 이름의
 *   stickers/individual, stickers/cosmetics, gallery 를 update(ref, {…: null}) 로
 *   즉시 삭제했다. 이 검사는 같은 편집을 하고도 그 경로들이 삭제 목록에
 *   들어가지 않음을 확인한다.
 *
 * 실행: node scripts/test-roster-archive.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "bee-roster-"));

let passed = 0;
const checks = [];
const check = (name, fn) => { checks.push([name, fn]); };

function transpile(relPath, outName, rewrite = (s) => s) {
  const source = readFileSync(resolve(ROOT, relPath), "utf8");
  const out = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, outName), rewrite(out));
  return pathToFileURL(join(dir, outName));
}

try {
  transpile("lib/learnerId.ts", "learnerId.mjs");
  const R = await import(transpile("lib/rosterArchive.ts", "rosterArchive.mjs", (code) =>
    code.replace(/from ["']\.\/learnerId["']/g, 'from "./learnerId.mjs"')));
  const L = await import(pathToFileURL(join(dir, "learnerId.mjs")));

  const {
    applyRosterOps, planRosterText, createRosterService, promoteNamesToProfiles,
    fingerprint, verifyRestore, describeImpactKo, purgePathsFor,
  } = R;
  const { domainPrefix, encodeLegacyKey, learnerKey, contentHash, recordCount } = L;

  const ROOM = "9999";
  const p = (domain, key) => `${domainPrefix(ROOM, domain)}/${key}`;

  let uuidN = 0;
  const seqUuid = () => `u${String(++uuidN).padStart(4, "0")}`;

  /** 경로 → 값. 고치기 전 saveRoster 가 지웠을 경로를 그대로 포함한다. */
  function makeWorld(names) {
    const store = new Map();
    for (const name of names) {
      const k = encodeLegacyKey(name);
      store.set(p("stickers", k), { s1: { type: "star" }, s2: { type: "heart" }, s3: { type: "moon" } });
      store.set(p("cosmetics", k), { stage: "bee", hat: "party" });
      store.set(p("gallery", k), { g1: { url: `x://${k}/1` } });
      store.set(p("vocabProgress", k), { 사과: { doneSentences: [0] }, 바나나: { doneSentences: [1, 2] } });
      store.set(p("vocabRecordings", k), { "사과_0": { audioUrl: `x://${k}/rec`, duration: 3 } });
      store.set(p("lms", k), { xp: 120, hearts: 5, lessons: {} });
    }
    return store;
  }

  /** spy 가 달린 얇은 IO. 실제 DB 는 어디에도 없다. */
  function makeIo(store) {
    const spy = { read: 0, commit: 0, deleteCalls: 0, deletedPaths: [], committed: [] };
    const io = {
      async readNode(path) { spy.read++; return store.get(path) ?? null; },
      async commitRoster(input) { spy.commit++; spy.committed.push(input); },
      async deleteNodes(paths) { spy.deleteCalls++; spy.deletedPaths.push(...paths); for (const x of paths) store.delete(x); },
    };
    return { io, spy };
  }

  const NAMES = ["가나다", "라마바", "사아자"];

  /* ═══════════════════ ADD-ROSTER-01 ═══════════════════ */

  check("ADD-ROSTER-01 제거 → 보관 → 복원에서 내용·개수·hash 가 동일하다", async () => {
    const store = makeWorld(NAMES);
    const { io, spy } = makeIo(store);
    const svc = createRosterService(ROOM, io, { now: () => 5000, uuid: seqUuid });
    let profiles = promoteNamesToProfiles(NAMES, 1000, seqUuid);
    const victim = profiles.find((x) => x.displayName === "라마바");

    const before = await svc.loadSnapshot(profiles, victim.learnerId);
    const fpBefore = fingerprint(before.snapshot);
    assert.ok(fpBefore.total > 0, "검사가 의미 있으려면 기록이 있어야 한다");

    // 교사가 textarea 에서 '라마바' 를 지우고 저장
    const plan = planRosterText(profiles, "가나다\n사아자");
    assert.deepEqual(plan.toArchive.map((x) => x.displayName), ["라마바"]);
    assert.deepEqual(plan.toAdd, []);
    assert.deepEqual(plan.ops.map((o) => o.kind), ["archive"]);

    const applied = await svc.apply(profiles, plan.ops);
    profiles = applied.profiles;

    assert.equal(spy.deleteCalls, 0, "보관에서 삭제 어댑터가 호출됐다");
    assert.deepEqual(spy.deletedPaths, []);
    assert.deepEqual(applied.deletePaths, []);
    assert.deepEqual(applied.rosterNames, ["가나다", "사아자"]);
    assert.equal(profiles.find((x) => x.learnerId === victim.learnerId).rosterStatus, "archived");

    // 보관 중에도 기록은 그대로
    const during = await svc.loadSnapshot(profiles, victim.learnerId);
    assert.deepEqual(verifyRestore(before.snapshot, during.snapshot).mismatches, []);

    // 복원
    const restored = await svc.apply(profiles, [{ kind: "restore", learnerId: victim.learnerId }]);
    profiles = restored.profiles;
    assert.equal(spy.deleteCalls, 0, "복원에서도 삭제가 있으면 안 된다");
    assert.equal(profiles.find((x) => x.learnerId === victim.learnerId).rosterStatus, "active");
    // 복원하면 원래 자리로 돌아온다 (목록 끝에 새로 붙지 않는다)
    assert.deepEqual(restored.rosterNames, ["가나다", "라마바", "사아자"]);

    const after = await svc.loadSnapshot(profiles, victim.learnerId);
    const v = verifyRestore(before.snapshot, after.snapshot);
    assert.deepEqual(v.mismatches, []);
    assert.equal(v.ok, true);
    assert.equal(v.after.hash, fpBefore.hash, "복원 후 내용 hash 가 달라졌다");
    assert.equal(v.after.total, fpBefore.total, "복원 후 레코드 수가 달라졌다");
  });

  check("ADD-ROSTER-01 고치기 전 saveRoster 가 지웠을 경로가 삭제 목록에 없다", async () => {
    const store = makeWorld(NAMES);
    const { io, spy } = makeIo(store);
    const svc = createRosterService(ROOM, io, { now: () => 5000, uuid: seqUuid });
    const profiles = promoteNamesToProfiles(NAMES, 1000, seqUuid);

    // 고치기 전 동작이 지웠을 경로 (RoomManagePanel.saveRoster 의 deletes 맵)
    const legacyDeleteSet = [
      `rooms/${ROOM}/stickers/individual/라마바`,
      `rooms/${ROOM}/stickers/cosmetics/라마바`,
      `rooms/${ROOM}/gallery/라마바`,
    ];
    for (const path of legacyDeleteSet) assert.ok(store.has(path), `사전 조건: ${path} 가 있어야 한다`);

    const plan = planRosterText(profiles, "가나다\n사아자");
    const applied = await svc.apply(profiles, plan.ops);

    for (const path of legacyDeleteSet) {
      assert.ok(!applied.deletePaths.includes(path), `삭제 계획에 남아 있다: ${path}`);
      assert.ok(!spy.deletedPaths.includes(path), `실제로 삭제됐다: ${path}`);
      assert.ok(store.has(path), `저장소에서 사라졌다: ${path}`);
    }
    assert.equal(spy.deleteCalls, 0);
  });

  check("ADD-ROSTER-01 이름 고치기는 보관도 삭제도 아니다", async () => {
    const store = makeWorld(NAMES);
    const { io, spy } = makeIo(store);
    const svc = createRosterService(ROOM, io, { now: () => 6000, uuid: seqUuid });
    let profiles = promoteNamesToProfiles(NAMES, 1000, seqUuid);
    const target = profiles.find((x) => x.displayName === "라마바");
    const before = fingerprint((await svc.loadSnapshot(profiles, target.learnerId)).snapshot);

    const applied = await svc.apply(profiles, [
      { kind: "rename", learnerId: target.learnerId, displayName: "라마바봄" },
    ]);
    profiles = applied.profiles;
    const renamed = profiles.find((x) => x.learnerId === target.learnerId);

    assert.equal(spy.deleteCalls, 0);
    assert.deepEqual(applied.deletePaths, []);
    assert.equal(renamed.learnerId, target.learnerId, "learnerId 가 바뀌었다");
    assert.equal(renamed.rosterStatus, "active");
    assert.deepEqual(renamed.legacyNameKeys, ["라마바"]);
    assert.deepEqual(applied.rosterNames, ["가나다", "라마바봄", "사아자"]);

    const after = fingerprint((await svc.loadSnapshot(profiles, target.learnerId)).snapshot);
    assert.equal(after.hash, before.hash);
    assert.equal(after.total, before.total);
  });

  check("ADD-ROSTER-01 영향 범위를 미리 셀 수 있다", async () => {
    const store = makeWorld(NAMES);
    const { io } = makeIo(store);
    const svc = createRosterService(ROOM, io, { now: () => 7000, uuid: seqUuid });
    const profiles = promoteNamesToProfiles(NAMES, 1000, seqUuid);
    const target = profiles.find((x) => x.displayName === "사아자");

    const impact = await svc.loadImpact(profiles, target.learnerId);
    const byDomain = Object.fromEntries(impact.domains.map((d) => [d.domain, d.count]));
    // 기대값 독립 정의: makeWorld 가 심은 개수
    assert.equal(byDomain.stickers, 3);
    assert.equal(byDomain.cosmetics, 2);      // stage + hat
    assert.equal(byDomain.gallery, 1);
    assert.equal(byDomain.vocabProgress, 2);
    assert.equal(byDomain.vocabRecordings, 1);
    assert.equal(byDomain.emotions, 0);
    assert.equal(impact.total, 3 + 2 + 1 + 2 + 1 + 3);  // lms 는 xp/hearts/lessons 3개
    assert.match(describeImpactKo(impact), /칭찬 스티커 3개/);
    assert.ok(!describeImpactKo(impact).includes("감정"), "0개 도메인은 숨긴다");
    // 아직 이관 전이므로 옛 이름 경로를 읽고 있다
    assert.ok(impact.domains.every((d) => d.count === 0 || d.source === "legacy"));
  });

  /* ═══ 완전 삭제는 별도 경로 ═══ */

  check("기록 완전 삭제는 기본 편집 흐름에서 호출되지 않는다", async () => {
    const store = makeWorld(NAMES);
    const { io, spy } = makeIo(store);
    const svc = createRosterService(ROOM, io, { now: () => 8000, uuid: seqUuid });
    const profiles = promoteNamesToProfiles(NAMES, 1000, seqUuid);
    const target = profiles.find((x) => x.displayName === "가나다");

    // allowPurge 없이 purge 를 시도해도 거부된다
    const refused = await svc.apply(profiles, [
      { kind: "purge", learnerId: target.learnerId, confirmName: "가나다" },
    ]);
    assert.equal(spy.deleteCalls, 0, "허가 없이 삭제가 실행됐다");
    assert.deepEqual(refused.deletePaths, []);
    assert.equal(refused.profiles.length, 3);
    assert.match(refused.warnings.join(" "), /별도 확인 화면/);

    // 이름이 정확히 일치하지 않으면 허가가 있어도 거부
    const typo = await svc.apply(profiles, [
      { kind: "purge", learnerId: target.learnerId, confirmName: "가나닸" },
    ], { allowPurge: true });
    assert.equal(spy.deleteCalls, 0);
    assert.deepEqual(typo.deletePaths, []);
    assert.match(typo.warnings.join(" "), /정확히 일치하지 않아/);
  });

  check("완전 삭제는 허가 + 이름 일치일 때만, learnerId 경로만 지운다", async () => {
    const store = makeWorld(NAMES);
    const { io, spy } = makeIo(store);
    const svc = createRosterService(ROOM, io, { now: () => 9000, uuid: seqUuid });
    const profiles = promoteNamesToProfiles(NAMES, 1000, seqUuid);
    const target = profiles.find((x) => x.displayName === "가나다");

    const done = await svc.apply(profiles, [
      { kind: "purge", learnerId: target.learnerId, confirmName: "가나다" },
    ], { allowPurge: true });

    assert.equal(spy.deleteCalls, 1);
    assert.deepEqual(done.deletePaths.sort(), purgePathsFor(ROOM, target).sort());
    assert.equal(done.profiles.length, 2);
    assert.equal(done.learnerWrites[target.learnerId], null);
    // 옛 이름 경로는 다른 학생과 공유됐을 수 있으므로 자동으로 지우지 않는다
    for (const path of done.deletePaths) assert.ok(path.includes("/lid_"), `이름 경로를 지우려 한다: ${path}`);
    assert.ok(store.has(p("stickers", "가나다")), "옛 이름 경로가 지워졌다");
  });

  /* ═══ 자동 병합 금지 ═══ */

  check("일괄 붙여넣기는 이름 변경을 추측하지 않는다", () => {
    const profiles = promoteNamesToProfiles(NAMES, 1000, seqUuid);
    const plan = planRosterText(profiles, "가나다\n라마바봄\n사아자");  // '라마바' 를 고친 것처럼 보이지만
    assert.deepEqual(plan.toArchive.map((x) => x.displayName), ["라마바"]);
    assert.deepEqual(plan.toAdd, ["라마바봄"]);
    assert.ok(!plan.ops.some((o) => o.kind === "rename"), "이름 변경을 자동으로 만들면 안 된다");
    assert.match(plan.notes.join(" "), /이름 고치기/);
  });

  check("동명이인 한 명만 빼면 한 명만 보관된다", async () => {
    const names = ["김민준", "김민준", "이서연"];
    const store = makeWorld(names);
    const { io, spy } = makeIo(store);
    const svc = createRosterService(ROOM, io, { now: () => 9500, uuid: seqUuid });
    const profiles = promoteNamesToProfiles(names, 1000, seqUuid);

    const plan = planRosterText(profiles, "김민준\n이서연");
    assert.equal(plan.toArchive.length, 1);
    assert.equal(plan.toArchive[0].displayName, "김민준");
    assert.deepEqual(plan.toAdd, []);
    const applied = await svc.apply(profiles, plan.ops);
    assert.equal(spy.deleteCalls, 0);
    assert.deepEqual(applied.rosterNames, ["김민준", "이서연"]);
    assert.equal(applied.profiles.filter((x) => x.rosterStatus === "active").length, 2);
  });

  check("보관 중인 이름이 다시 등장하면 새로 만들지 않고 복원한다", () => {
    const profiles = promoteNamesToProfiles(NAMES, 1000, seqUuid);
    const archived = applyRosterOps(
      profiles,
      [{ kind: "archive", learnerId: profiles[1].learnerId }],
      { roomCode: ROOM, now: 2000, uuid: seqUuid },
    ).profiles;
    const plan = planRosterText(archived, NAMES.join("\n"));
    assert.deepEqual(plan.toAdd, []);
    assert.deepEqual(plan.restorable.map((x) => x.learnerId), [profiles[1].learnerId]);
    assert.deepEqual(plan.ops.map((o) => o.kind), ["restore"]);
  });

  /* ═══ 불변식 ═══ */

  check("purge 아닌 어떤 연산 조합도 삭제 경로를 만들지 않는다", () => {
    let seed = 424242;
    const rnd = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    let profiles = promoteNamesToProfiles(["가", "나", "다", "가"], 1000, seqUuid);
    for (let i = 0; i < 3000; i++) {
      const target = profiles[rnd(profiles.length)];
      const kinds = ["archive", "restore", "rename", "setMark", "add"];
      const kind = kinds[rnd(kinds.length)];
      const op = kind === "add"
        ? { kind, displayName: `새${rnd(3)}` }
        : kind === "rename"
          ? { kind, learnerId: target.learnerId, displayName: `이름${rnd(3)}` }
          : kind === "setMark"
            ? { kind, learnerId: target.learnerId, markId: "star" }
            : { kind, learnerId: target.learnerId };
      const res = applyRosterOps(profiles, [op], { roomCode: ROOM, now: 3000 + i, uuid: seqUuid });
      assert.deepEqual(res.deletePaths, [], `${kind} 가 삭제 경로를 만들었다`);
      assert.ok(Object.values(res.learnerWrites).every((v) => v !== null), `${kind} 가 프로필을 지웠다`);
      assert.deepEqual(res.rosterNames, res.profiles.filter((x) => x.rosterStatus === "active").map((x) => x.displayName));
      profiles = res.profiles;
      if (profiles.length > 12) profiles = profiles.slice(0, 8);
    }
    assert.ok(profiles.every((x) => x.learnerId && x.version === 1));
  });

  check("보관/복원을 여러 번 반복해도 기록 지문이 그대로다", async () => {
    const store = makeWorld(NAMES);
    const { io, spy } = makeIo(store);
    const svc = createRosterService(ROOM, io, { now: () => 11000, uuid: seqUuid });
    let profiles = promoteNamesToProfiles(NAMES, 1000, seqUuid);
    const target = profiles.find((x) => x.displayName === "사아자");
    const base = fingerprint((await svc.loadSnapshot(profiles, target.learnerId)).snapshot);

    for (let i = 0; i < 5; i++) {
      profiles = (await svc.apply(profiles, [{ kind: "archive", learnerId: target.learnerId }])).profiles;
      profiles = (await svc.apply(profiles, [{ kind: "restore", learnerId: target.learnerId }])).profiles;
      const fp = fingerprint((await svc.loadSnapshot(profiles, target.learnerId)).snapshot);
      assert.equal(fp.hash, base.hash, `${i + 1}회차에서 hash 가 달라졌다`);
      assert.equal(fp.total, base.total);
    }
    assert.equal(spy.deleteCalls, 0, "보관/복원 10회 동안 삭제 호출 0회여야 한다");
  });

  for (const [name, fn] of checks) {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  }
  console.log(`\n${passed}개 검사 통과`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

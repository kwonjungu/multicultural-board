/**
 * X01 이관 dry-run 도구 — **출력만 한다. 어떤 DB 에도 쓰지 않는다.**
 *
 * 이 파일에는 firebase import 도, 네트워크 호출도, 쓰기 코드도 없다.
 * scripts/test-learner-id.mjs 가 이 파일의 원문을 검사해 그 사실을 강제한다.
 *
 * 하는 일
 *   1. 기존 이름 경로 inventory (도메인별 키/개수/내용 hash)
 *   2. 이름 키 → learnerId 매핑 초안
 *   3. 모호한 항목 목록 (동명이인·encodeKey 충돌·주인 없는 키) — 자동 병합 금지
 *   4. 합계/콘텐츠 hash diff (원본 vs 이관 후 예상)
 *   5. 멱등성 검증 (같은 입력 2회 / 중간 실패 후 재실행)
 *
 * 사용법
 *   node scripts/migrate-learner-id.mjs --dry-run            (내장 fixture)
 *   node scripts/migrate-learner-id.mjs --dry-run --input x.json
 *   node scripts/migrate-learner-id.mjs --dry-run --json
 *
 * 입력 JSON 은 `rooms/{roomCode}` 노드를 그대로 덤프한 모양이다.
 * 운영 방 1111 은 입력으로도 받지 않는다 (읽기조차 하지 않는다).
 */
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 운영 방. 이 도구는 여기에 대해서는 읽기도 하지 않는다. */
export const FORBIDDEN_ROOMS = ["1111"];

// ── 계약 로드 ────────────────────────────────────────────────────────────
// lib/learnerId.ts 를 런타임 transpile 해서 그대로 쓴다. 도메인 목록·경로
// 조립·해시를 여기에 복사하면 드리프트로 회귀를 놓친다.
const tmp = mkdtempSync(join(tmpdir(), "bee-migrate-"));
process.on("exit", () => { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* noop */ } });

function transpile(relPath, outName) {
  const source = readFileSync(resolve(ROOT, relPath), "utf8");
  const out = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(tmp, outName), out);
  return pathToFileURL(join(tmp, outName));
}

export const contract = await import(transpile("lib/learnerId.ts", "learnerId.mjs"));

const {
  LEARNER_DOMAINS, domainPrefix, encodeLegacyKey, learnerKey,
  isLearnerKey, isReservedKey, buildLegacyClaims, resolveLearnerScope,
  contentHash, recordCount, DOMAIN_LABEL_KO,
} = contract;

/* ────────────────────────────────────────────────────────────────────────
 * 스냅샷 접근 (읽기 전용, 순수)
 * ──────────────────────────────────────────────────────────────────────── */

/** `rooms/{roomCode}/a/b` → room 객체 안의 a.b */
export function readByPath(room, roomCode, absPath) {
  const prefix = `rooms/${roomCode}/`;
  if (!absPath.startsWith(prefix)) throw new Error(`방 밖 경로: ${absPath}`);
  let node = room;
  for (const seg of absPath.slice(prefix.length).split("/")) {
    if (node == null || typeof node !== "object") return null;
    node = node[seg];
  }
  return node ?? null;
}

/** 도메인 prefix 밑의 키 목록. 예약 키(_lastAward 등)는 제외한다. */
export function domainKeys(room, roomCode, domain) {
  const node = readByPath(room, roomCode, domainPrefix(roomCode, domain));
  if (node == null || typeof node !== "object") return [];
  return Object.keys(node).filter((k) => !isReservedKey(k) && node[k] != null).sort();
}

/* ────────────────────────────────────────────────────────────────────────
 * 1. inventory
 * ──────────────────────────────────────────────────────────────────────── */

export function buildInventory(room, roomCode) {
  const domains = [];
  for (const domain of LEARNER_DOMAINS) {
    const prefix = domainPrefix(roomCode, domain);
    const entries = domainKeys(room, roomCode, domain).map((key) => {
      const value = readByPath(room, roomCode, `${prefix}/${key}`);
      return {
        key,
        kind: isLearnerKey(key) ? "learner" : "name",
        count: recordCount(value),
        hash: contentHash(value),
      };
    });
    domains.push({
      domain,
      labelKo: DOMAIN_LABEL_KO[domain],
      prefix,
      entries,
      total: entries.reduce((a, e) => a + e.count, 0),
    });
  }
  return { roomCode, domains, grandTotal: domains.reduce((a, d) => a + d.total, 0) };
}

/* ────────────────────────────────────────────────────────────────────────
 * 2. 프로필 / 매핑 초안
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * 결정적 임시 learnerId. 같은 입력이면 항상 같은 값이 나와야 dry-run 을
 * 두 번 돌려 비교할 수 있다. **실제 이관에서는 이 값을 쓰지 않는다** —
 * 그때는 crypto UUID 를 한 번 부여해 config/learners 에 저장한다.
 */
export function provisionalLearnerId(roomCode, displayName, index) {
  const a = contentHash(`${roomCode}|${displayName}|${index}`);
  const b = contentHash(`${index}|${displayName}|${roomCode}`);
  const hex = (a + b).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** config/learners 가 있으면 그대로, 없으면 config/roster 이름에서 임시 프로필. */
export function buildProfiles(room, roomCode) {
  const learners = readByPath(room, roomCode, `rooms/${roomCode}/config/learners`);
  if (learners && typeof learners === "object") {
    return Object.values(learners)
      .filter((p) => p && typeof p === "object" && p.learnerId)
      .map((p) => ({ ...p, provisional: false }))
      .sort((x, y) => String(x.learnerId).localeCompare(String(y.learnerId)));
  }
  const rosterRaw = readByPath(room, roomCode, `rooms/${roomCode}/config/roster`);
  const roster = Array.isArray(rosterRaw)
    ? rosterRaw
    : rosterRaw && typeof rosterRaw === "object" ? Object.values(rosterRaw) : [];
  return roster
    .map((n) => String(n ?? "").trim())
    .filter(Boolean)
    .map((displayName, index) => ({
      learnerId: provisionalLearnerId(roomCode, displayName, index),
      displayName,
      rosterStatus: "active",
      createdAt: 0,
      updatedAt: 0,
      version: 1,
      provisional: true,
    }));
}

/* ────────────────────────────────────────────────────────────────────────
 * 3~4. 계획
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * 이관 계획을 만든다. 복사 단위는 **(학습자 × 도메인) 하위 트리 전체**다.
 * 부분 복사를 허용하면 "새 경로에 기록이 있으면 그쪽을 읽는다" 규칙이
 * 반쪽짜리 데이터를 권위 경로로 만들어 버린다.
 */
export function planMigration(room, roomCode) {
  if (FORBIDDEN_ROOMS.includes(String(roomCode))) {
    throw new Error(`방 ${roomCode} 은(는) 운영 방이라 이 도구로 다루지 않는다`);
  }
  const inventory = buildInventory(room, roomCode);
  const profiles = buildProfiles(room, roomCode);
  const claims = buildLegacyClaims(profiles);

  const copies = [];
  const ambiguous = [];
  const ambiguousSeen = new Set();
  const alreadyMigrated = [];
  const nothingToDo = [];

  for (const profile of profiles) {
    for (const domain of LEARNER_DOMAINS) {
      const prefix = domainPrefix(roomCode, domain);
      const hasRecord = (p) => readByPath(room, roomCode, p) != null;
      const scope = resolveLearnerScope(roomCode, domain, profile, hasRecord, { claims });
      if (scope.source === "learner") {
        const value = readByPath(room, roomCode, scope.readPath);
        alreadyMigrated.push({
          learnerId: profile.learnerId, displayName: profile.displayName, domain,
          path: scope.readPath, count: recordCount(value), hash: contentHash(value),
        });
        continue;
      }
      if (scope.source === "ambiguous") {
        // (키 × 도메인) 하나에 대해 한 줄만 남긴다 — 주장자가 여럿이라고
        // 같은 충돌을 여러 번 보고하면 교사가 볼 목록이 부풀어 오른다.
        const path = `${prefix}/${scope.conflict.legacyKey}`;
        if (!ambiguousSeen.has(path)) {
          const value = readByPath(room, roomCode, path);
          ambiguousSeen.add(path);
          ambiguous.push({
            reason: "동명이인 또는 이름 키 충돌 — 옛 기록이 이미 한 경로에 섞여 있다",
            legacyKey: scope.conflict.legacyKey,
            claimedBy: scope.conflict.claimedBy,
            domain,
            path,
            count: recordCount(value),
            hash: contentHash(value),
          });
        }
        continue;
      }
      if (scope.source === "empty") {
        nothingToDo.push({ learnerId: profile.learnerId, displayName: profile.displayName, domain });
        continue;
      }
      const value = readByPath(room, roomCode, scope.readPath);
      copies.push({
        learnerId: profile.learnerId,
        displayName: profile.displayName,
        domain,
        from: scope.readPath,
        to: `${prefix}/${learnerKey(profile.learnerId)}`,
        count: recordCount(value),
        hash: contentHash(value),
      });
    }
  }

  // 주인 없는 옛 키 — 전학 간 학생, 자유 입력 이름, 오탈자 등. 교사 확인 대상.
  const orphans = [];
  for (const d of inventory.domains) {
    for (const e of d.entries) {
      if (e.kind === "learner") continue;
      const claimedBy = claims.get(e.key) ?? [];
      if (claimedBy.length > 0) continue;
      orphans.push({
        legacyKey: e.key, domain: d.domain, path: `${d.prefix}/${e.key}`,
        count: e.count, hash: e.hash,
        reason: "명렬표의 어떤 학생도 이 이름을 쓰지 않는다",
      });
    }
  }

  // ── 안전 검사 ──
  const problems = [];
  const seenTargets = new Map();
  for (const c of copies) {
    if (seenTargets.has(c.to)) problems.push(`같은 대상 경로에 두 번 복사: ${c.to}`);
    seenTargets.set(c.to, c);
    const existing = readByPath(room, roomCode, c.to);
    if (existing != null && contentHash(existing) !== c.hash) {
      problems.push(`대상 경로에 다른 내용이 이미 있다: ${c.to}`);
    }
  }

  const sourceTotals = {};
  for (const d of inventory.domains) sourceTotals[d.domain] = d.total;
  const targetTotals = { ...sourceTotals };
  for (const c of copies) targetTotals[c.domain] += c.count; // 옛 경로는 지우지 않으므로 그만큼 늘어난다

  const copyHashMismatch = copies.filter((c) => contentHash(readByPath(room, roomCode, c.from)) !== c.hash);
  if (copyHashMismatch.length) problems.push(`복사 원본 hash 불일치 ${copyHashMismatch.length}건`);

  return {
    roomCode,
    profileCount: profiles.length,
    provisionalIds: profiles.some((p) => p.provisional),
    inventory,
    copies: copies.sort((a, b) => (a.to + a.from).localeCompare(b.to + b.from)),
    ambiguous: ambiguous.sort((a, b) => (a.legacyKey + a.domain).localeCompare(b.legacyKey + b.domain)),
    orphans: orphans.sort((a, b) => (a.legacyKey + a.domain).localeCompare(b.legacyKey + b.domain)),
    alreadyMigrated: alreadyMigrated.sort((a, b) => (a.path).localeCompare(b.path)),
    nothingToDo,
    totals: { source: sourceTotals, plannedTarget: targetTotals },
    problems,
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * 5. 멱등성 검증 — 메모리 위 시뮬레이션
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * **DB 가 아니라 평범한 JS 객체 사본**에 계획을 적용해 본다.
 * 이관 실행이 아니라 "두 번 돌려도, 중간에 끊겨도 같은 결과인가" 를 확인하는
 * 계산이다. 이 함수는 파일도 네트워크도 건드리지 않는다.
 */
export function simulateApply(room, plan, { stopAfter = Infinity } = {}) {
  const next = JSON.parse(JSON.stringify(room));
  const prefix = `rooms/${plan.roomCode}/`;
  let applied = 0;
  for (const c of plan.copies) {
    if (applied >= stopAfter) break;
    const value = readByPath(room, plan.roomCode, c.from);
    const segs = c.to.slice(prefix.length).split("/");
    let node = next;
    for (const seg of segs.slice(0, -1)) {
      if (node[seg] == null || typeof node[seg] !== "object") node[seg] = {};
      node = node[seg];
    }
    node[segs[segs.length - 1]] = JSON.parse(JSON.stringify(value));
    applied++;
  }
  return { room: next, applied };
}

/** 계획 두 개가 같은 복사 집합인지 (순서 무관). */
export function sameCopySet(a, b) {
  const key = (c) => `${c.from}=>${c.to}#${c.hash}`;
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

/**
 * 같은 입력 2회 + 중간 실패 후 재실행 검증 (ADD-MIGRATE-01).
 * 반환: { ok, findings[] }
 */
export function verifyIdempotent(room, roomCode) {
  const findings = [];
  const p1 = planMigration(room, roomCode);
  const p2 = planMigration(room, roomCode);
  if (JSON.stringify(p1) !== JSON.stringify(p2)) findings.push("같은 입력 2회 실행 결과가 다르다");

  // 전체 적용 후 재계획 → 남은 복사 0, 이미 이관됨으로 이동
  const full = simulateApply(room, p1);
  const after = planMigration(full.room, roomCode);
  if (after.copies.length !== 0) findings.push(`전량 적용 후에도 복사 ${after.copies.length}건이 남는다`);
  if (after.alreadyMigrated.length !== p1.alreadyMigrated.length + p1.copies.length) {
    findings.push("적용 후 '이미 이관됨' 수가 원래 계획과 맞지 않는다");
  }
  if (after.ambiguous.length !== p1.ambiguous.length) findings.push("적용 후 모호 항목 수가 변했다");

  // 중간 실패 — 앞의 절반만 적용하고 다시 계획
  const half = Math.floor(p1.copies.length / 2);
  const partial = simulateApply(room, p1, { stopAfter: half });
  const resumed = planMigration(partial.room, roomCode);
  const expectedRemaining = p1.copies.slice(half);
  if (!sameCopySet(resumed.copies, expectedRemaining)) {
    findings.push(`중간 실패 후 재실행의 남은 복사 집합이 다르다 (${resumed.copies.length} vs ${expectedRemaining.length})`);
  }
  const resumedFull = simulateApply(partial.room, resumed);
  const finalPlan = planMigration(resumedFull.room, roomCode);
  if (finalPlan.copies.length !== 0) findings.push("재실행 후에도 누락된 복사가 남는다");

  // 누락·중복 0: 최종 상태의 learner 경로 내용이 원본 legacy 내용과 1:1 로 같은가
  for (const c of p1.copies) {
    const src = readByPath(room, roomCode, c.from);
    const dst = readByPath(resumedFull.room, roomCode, c.to);
    if (contentHash(src) !== contentHash(dst)) findings.push(`내용 불일치: ${c.from} → ${c.to}`);
    if (recordCount(src) !== recordCount(dst)) findings.push(`개수 불일치: ${c.from} → ${c.to}`);
    // 원본은 그대로 남아 있어야 한다 (기존 이름 경로 삭제 금지)
    if (readByPath(resumedFull.room, roomCode, c.from) == null) findings.push(`원본이 사라졌다: ${c.from}`);
  }

  // 모호 항목은 어떤 경우에도 복사되지 않는다 (자동 병합 금지)
  for (const a of p1.ambiguous) {
    if (p1.copies.some((c) => c.from === a.path)) findings.push(`모호 항목이 복사 계획에 들어갔다: ${a.path}`);
  }

  return { ok: findings.length === 0, findings, plan: p1 };
}

/* ────────────────────────────────────────────────────────────────────────
 * 내장 fixture — 가짜 데이터. 실명·운영 데이터 없음.
 * ──────────────────────────────────────────────────────────────────────── */

export const FIXTURE_ROOM_CODE = "9999";

export function buildFixtureRoom() {
  const names = [
    "가나다", "라마바", "김민준", "김민준", // 동명이인 2명
    "사아자", "차카타", "박.서준", "박_서준", // encodeKey 충돌 쌍
    "Nguyễn Thị Minh Khai", "อารีย์",
  ];
  const room = {
    config: { rosterMode: true, roster: names, languages: ["ko", "vi", "th"] },
    vocab: { progress: {}, recordings: {}, attempts: {}, rewards: {} },
    stickers: { individual: {}, cosmetics: {} },
    gallery: {},
    lms: {},
    emotions: { _lastAward: { 가나다: "2026-09-01" } },
    expressions: {},
  };
  const put = (domain, key, value) => {
    const map = {
      vocabProgress: () => (room.vocab.progress[key] = value),
      vocabRecordings: () => (room.vocab.recordings[key] = value),
      vocabAttempts: () => (room.vocab.attempts[key] = value),
      vocabRewards: () => (room.vocab.rewards[key] = value),
      lms: () => (room.lms[key] = value),
      stickers: () => (room.stickers.individual[key] = value),
      cosmetics: () => (room.stickers.cosmetics[key] = value),
      gallery: () => (room.gallery[key] = value),
      emotions: () => (room.emotions[key] = value),
      expressions: () => (room.expressions[key] = value),
    };
    map[domain]();
  };

  // 결정적 가짜 기록
  let seed = 7;
  const rnd = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (const name of Array.from(new Set(names))) {
    const key = encodeLegacyKey(name);
    put("vocabProgress", key, Object.fromEntries(
      Array.from({ length: 1 + rnd(3) }, (_, i) => [`w${i}`, { doneSentences: [0], listenCount: rnd(5), lastStudied: 1000 + i }]),
    ));
    put("stickers", key, Object.fromEntries(
      Array.from({ length: 1 + rnd(4) }, (_, i) => [`s${i}`, { id: `s${i}`, type: "star", ts: 2000 + i }]),
    ));
    put("cosmetics", key, { stage: "bee", hat: rnd(2) ? "party" : null });
    put("lms", key, { xp: 10 * (1 + rnd(9)), hearts: 5, lessons: {} });
    if (rnd(2)) put("vocabRecordings", key, { "w0_0": { audioUrl: `x://${key}/0`, timestamp: 3000, duration: 2, storagePath: `p/${key}` } });
    if (rnd(3) === 0) put("gallery", key, { g0: { url: `x://g/${key}` } });
  }
  // 주인 없는 옛 키 (전학)
  put("vocabProgress", "전학간학생", { w0: { doneSentences: [0, 1], listenCount: 2, lastStudied: 500 } });
  put("stickers", "전학간학생", { s0: { id: "s0", type: "heart", ts: 600 } });

  return room;
}

/* ────────────────────────────────────────────────────────────────────────
 * 보고서
 * ──────────────────────────────────────────────────────────────────────── */

export function formatReport(plan, verify) {
  const L = [];
  const line = (s = "") => L.push(s);
  line(`== X01 이관 dry-run (방 ${plan.roomCode}) ==`);
  line(`쓰기 없음. 아래는 계획과 계산 결과일 뿐이다.`);
  line();
  line(`[1] inventory — 도메인별 기존 키`);
  for (const d of plan.inventory.domains) {
    const names = d.entries.filter((e) => e.kind === "name").length;
    const lids = d.entries.filter((e) => e.kind === "learner").length;
    line(`  ${d.domain.padEnd(16)} 키 ${String(d.entries.length).padStart(3)}개 (이름 ${names} / learnerId ${lids})  레코드 ${d.total}`);
  }
  line(`  합계 레코드 ${plan.inventory.grandTotal}`);
  line();
  line(`[2] 매핑 초안 — 이름 경로 → learnerId 경로  (복사 ${plan.copies.length}건)`);
  if (plan.provisionalIds) line(`  * config/learners 가 없어 learnerId 는 결정적 임시값이다. 실제 이관 때 UUID 를 한 번 부여한다.`);
  for (const c of plan.copies.slice(0, 12)) {
    line(`  ${c.displayName} · ${c.domain}: ${c.from}  →  ${c.to}  (${c.count}건, ${c.hash})`);
  }
  if (plan.copies.length > 12) line(`  ... 외 ${plan.copies.length - 12}건`);
  line();
  line(`[3] 모호한 항목 — 교사 해결 대상 (자동 병합하지 않음): ${plan.ambiguous.length}건`);
  for (const a of plan.ambiguous.slice(0, 12)) {
    line(`  키 '${a.legacyKey}' · ${a.domain}: ${a.claimedBy.length}명이 주장 — ${a.reason}`);
    line(`    경로 ${a.path} (${a.count}건) / 주장자 ${a.claimedBy.join(", ")}`);
  }
  if (plan.ambiguous.length > 12) line(`  ... 외 ${plan.ambiguous.length - 12}건`);
  line();
  line(`[4] 주인 없는 옛 키: ${plan.orphans.length}건 (그대로 둔다 — 삭제 계획 없음)`);
  for (const o of plan.orphans.slice(0, 8)) line(`  ${o.path} (${o.count}건) — ${o.reason}`);
  line();
  line(`[5] 합계 / hash diff`);
  for (const domain of LEARNER_DOMAINS) {
    const s = plan.totals.source[domain] ?? 0;
    const t = plan.totals.plannedTarget[domain] ?? 0;
    const moved = plan.copies.filter((c) => c.domain === domain).reduce((a, c) => a + c.count, 0);
    line(`  ${domain.padEnd(16)} 원본 ${String(s).padStart(4)} → 이관 후 ${String(t).padStart(4)} (복사 ${moved}, 원본 보존)`);
  }
  line(`  이미 이관됨 ${plan.alreadyMigrated.length}건 / 옮길 것 없음 ${plan.nothingToDo.length}건`);
  line();
  line(`[6] 멱등성 검증`);
  line(`  같은 입력 2회 · 전량 적용 후 재계획 · 중간 실패 후 재실행: ${verify.ok ? "이상 없음 (누락·중복 0)" : "문제 발견"}`);
  for (const f of verify.findings) line(`  ! ${f}`);
  line();
  if (plan.problems.length) {
    line(`[!] 계획 자체의 문제 ${plan.problems.length}건`);
    for (const p of plan.problems) line(`  ! ${p}`);
  } else {
    line(`[7] 계획 무결성 이상 없음 (대상 경로 중복 0, 원본 hash 일치)`);
  }
  line();
  line(`다음 단계는 이 도구가 하지 않는다: 백업 → 테스트 프로젝트에서 복사 실행 →`);
  line(`합계/hash 재비교 → 읽기 전환. 기존 이름 경로는 그 뒤에도 즉시 삭제하지 않는다.`);
  return L.join("\n");
}

/* ────────────────────────────────────────────────────────────────────────
 * CLI
 * ──────────────────────────────────────────────────────────────────────── */

function main(argv) {
  const args = argv.slice(2);
  if (args.includes("--execute") || args.includes("--apply") || args.includes("--write")) {
    console.error("이 도구는 dry-run 전용이다. 실행 옵션은 없다. 실제 이관은 별도 승인 단계다.");
    return 2;
  }
  const inputIdx = args.indexOf("--input");
  let room;
  let roomCode;
  if (inputIdx >= 0) {
    const file = args[inputIdx + 1];
    if (!file) { console.error("--input 다음에 파일 경로가 필요하다"); return 2; }
    const parsed = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));
    roomCode = String(parsed.roomCode ?? parsed.code ?? "");
    room = parsed.room ?? parsed;
    if (!roomCode) { console.error("입력 JSON 에 roomCode 가 없다"); return 2; }
  } else {
    roomCode = FIXTURE_ROOM_CODE;
    room = buildFixtureRoom();
  }

  if (FORBIDDEN_ROOMS.includes(roomCode)) {
    console.error(`방 ${roomCode} 은(는) 운영 방이다. 이 도구는 운영 방을 읽지 않는다.`);
    return 2;
  }

  const verify = verifyIdempotent(room, roomCode);
  const plan = verify.plan;

  if (args.includes("--json")) {
    console.log(JSON.stringify({ plan, verify: { ok: verify.ok, findings: verify.findings } }, null, 2));
  } else {
    console.log(formatReport(plan, verify));
  }
  return verify.ok && plan.problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv));
}

/**
 * X04 보상 원장 재현 테스트 — ADD-CLAIM-01 / ADD-CLAIM-02.
 *
 * 실행: node scripts/test-reward-ledger.mjs
 *
 * 두 층으로 본다.
 *  (A) 순수 상태 기계(lib/rewardLedger.ts)를 **실패 주입 어댑터**로 돌린다.
 *      선점 성공/지급 실패, 지급 성공/기록 실패, 네트워크 끊김을 각각 주입한다.
 *  (B) 실제 Firebase 어댑터(lib/quests.ts createQuestStore)를 **가짜 RTDB**
 *      위에서 돌려 두 client 동시 claim(ADD-CLAIM-01)을 재현한다. 가짜 RTDB 는
 *      compare-and-set 재시도와 abort 를 진짜 runTransaction 처럼 흉내낸다.
 *
 * 기대값은 구현 함수의 반환값이 아니라 **행동에서 독립적으로** 정의한다:
 *   불변식 ① 지갑 잔액 = 지갑 rewardEvents 에 적힌 금액의 합
 *   불변식 ② 같은 eventKey 로 실제 가산이 일어난 횟수 ≤ 1  (중복 0)
 *   불변식 ③ 실패 주입을 끈 뒤 재처리하면 status=pending 인 항목 0 (영구 미지급 0)
 *   불변식 ④ 최종 잔액 = 수령을 시도한 퀘스트 보상의 합 (누락 0)
 *
 * 운영 DB 에 접속하지 않는다. 방 번호는 전부 가짜(9999)다.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "bee-ledger-"));

let count = 0;
const check = async (name, fn) => {
  await fn();
  count++;
  console.log(`PASS ${name}`);
};

// ── TS → mjs (test-word-memory.mjs 와 같은 방식) ───────────────────────────
function transpile(rel) {
  const src = readFileSync(join(root, rel), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  const rewritten = out
    .replace(/from\s+"firebase\/database"/g, 'from "./_fb.mjs"')
    .replace(/from\s+"\.\/firebase-client"/g, 'from "./_client.mjs"')
    .replace(/from\s+"\.\/([A-Za-z0-9_-]+)"/g, 'from "./$1.mjs"')
    .replace(/from\s+"@\/lib\/([A-Za-z0-9_-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(dir, basename(rel).replace(/\.ts$/, ".mjs")), rewritten);
}

// ── 가짜 RTDB — compare-and-set 재시도까지 흉내낸다 ────────────────────────
const FAKE_FB = `
let tree = {};
let rev = 0;
const stamps = new Map();
export const __db = { name: "fake" };
export const __ctl = {
  reset(){ tree = {}; rev = 0; stamps.clear(); __ctl.failWrites = new Set(); __ctl.interleave = null; },
  failWrites: new Set(),
  interleave: null,
  dump(){ return clone(tree); },
  seed(path, value){ writeAt(path, value); },
  read(path){ return readAt(path); },
};
function clone(v){ return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function segs(p){ return String(p).split("/").filter(Boolean); }
function readAt(p){
  let node = tree;
  for (const s of segs(p)) {
    if (node === null || typeof node !== "object" || !(s in node)) return null;
    node = node[s];
  }
  return clone(node);
}
function writeAt(p, value){
  const parts = segs(p);
  rev++;
  for (let i = 0; i <= parts.length; i++) stamps.set(parts.slice(0, i).join("/"), rev);
  if (parts.length === 0) { tree = clone(value) ?? {}; return; }
  let node = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    if (node[parts[i]] === null || typeof node[parts[i]] !== "object") node[parts[i]] = {};
    node = node[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (value === null || value === undefined) delete node[last];
  else node[last] = clone(value);
}
function versionOf(p){
  const parts = segs(p);
  let max = 0;
  for (let i = 0; i <= parts.length; i++) max = Math.max(max, stamps.get(parts.slice(0, i).join("/")) ?? 0);
  return max;
}
export function ref(_db, path){ return { path, key: segs(path).slice(-1)[0] ?? null }; }
export async function get(r){ const v = readAt(r.path); return { val: () => v, exists: () => v !== null }; }
export async function set(r, value){ guard(r.path); writeAt(r.path, value); }
export async function update(r, patch){
  guard(r.path);
  const cur = readAt(r.path);
  const base = cur && typeof cur === "object" ? cur : {};
  writeAt(r.path, { ...base, ...patch });
}
function guard(path){
  for (const p of __ctl.failWrites) if (path.startsWith(p)) throw new Error("fake-network-down: " + path);
}
export async function runTransaction(r, updater){
  for (let attempt = 0; attempt < 40; attempt++) {
    const before = versionOf(r.path);
    const cur = readAt(r.path);
    if (__ctl.interleave) await __ctl.interleave(r.path);
    else await Promise.resolve();
    const next = updater(clone(cur));
    if (next === undefined) {
      const nowVal = readAt(r.path);
      return { committed: false, snapshot: { val: () => nowVal } };
    }
    if (versionOf(r.path) !== before) continue;  // 낙관적 충돌 → 재시도
    guard(r.path);
    writeAt(r.path, next);
    const after = readAt(r.path);
    return { committed: true, snapshot: { val: () => after } };
  }
  throw new Error("fake-rtdb: transaction retry limit");
}
const listeners = new Map();
export function onValue(r, cb){
  const list = listeners.get(r.path) ?? [];
  const entry = { cb };
  list.push(entry);
  listeners.set(r.path, list);
  cb({ val: () => readAt(r.path) });
  const unsub = () => {
    const cur = listeners.get(r.path) ?? [];
    listeners.set(r.path, cur.filter((e) => e !== entry));
  };
  __ctl.notify = notify;
  return unsub;
}
export function off(r){ listeners.set(r.path, []); }
function notify(path){ for (const e of listeners.get(path) ?? []) e.cb({ val: () => readAt(path) }); }
`;

const FAKE_CLIENT = `
import { __db } from "./_fb.mjs";
export function getClientDb(){ return __db; }
export function getClientApp(){ return { name: "fake" }; }
`;

try {
  writeFileSync(join(dir, "_fb.mjs"), FAKE_FB);
  writeFileSync(join(dir, "_client.mjs"), FAKE_CLIENT);
  for (const f of ["lib/rewardLedger.ts", "lib/classroomDay.ts", "lib/lms.ts", "lib/quests.ts"]) transpile(f);

  const L = await import(pathToFileURL(join(dir, "rewardLedger.mjs")));
  const Q = await import(pathToFileURL(join(dir, "quests.mjs")));
  const FB = await import(pathToFileURL(join(dir, "_fb.mjs")));

  const ROOM = "9999"; // 운영 방 1111 아님 — 가짜 RTDB 라 실제 접속도 없다
  const T0 = 1_764_000_000_000;

  // ══════════════════════════════════════════════════════════════════════
  // (A) 순수 상태 기계 + 실패 주입 어댑터
  // ══════════════════════════════════════════════════════════════════════

  /**
   * 주입 가능한 가짜 store.
   * fail = { reserve, honey, xp, persist } — 남은 실패 횟수(0 이면 정상 동작).
   * xpMode = "ok" | "already" | "uncertain"
   */
  function makeStore(world, fail = {}, xpMode = "ok") {
    const budget = { reserve: 0, honey: 0, xp: 0, persist: 0, ...fail };
    const bite = (k) => {
      if (budget[k] > 0) {
        budget[k] -= 1;
        throw new Error(`injected-${k}-failure`);
      }
    };
    return {
      budget,
      now: () => world.clock,
      async reserve(draft) {
        bite("reserve");
        const key = `${draft.learnerId}|${draft.eventKey}`;
        const cur = world.ledger.get(key);
        if (cur) return JSON.parse(JSON.stringify(cur));
        world.ledger.set(key, JSON.parse(JSON.stringify(draft)));
        return JSON.parse(JSON.stringify(draft));
      },
      async applyHoney(entry) {
        bite("honey");
        const wallet = world.wallets.get(entry.learnerId) ?? {};
        // 실제 배포 코드의 updater 를 그대로 쓴다 (테스트용 복제본 금지).
        const next = L.walletApplyUpdater(entry.eventKey, entry.amount, world.clock)(wallet);
        if (next === undefined) return { state: "already" };
        world.wallets.set(entry.learnerId, next);
        // eventKey 는 학습자 범위 키다 — 테스트의 중복 계수는 학습자까지 포함한 eventId 로 센다.
        world.applied.set(entry.eventId, (world.applied.get(entry.eventId) ?? 0) + 1);
        return { state: "applied", paid: entry.amount };
      },
      async applyXp(entry) {
        bite("xp");
        if (xpMode === "already") return { state: "already" };
        if (xpMode === "uncertain") return { state: "uncertain", reason: "guard-reserved" };
        const cur = world.xp.get(entry.learnerId) ?? 0;
        if (world.xpApplied.has(entry.eventKey)) return { state: "already" };
        world.xpApplied.add(entry.eventKey);
        world.xp.set(entry.learnerId, cur + entry.xpAmount);
        return { state: "applied", paid: entry.xpAmount };
      },
      async persist(entry) {
        bite("persist");
        world.ledger.set(`${entry.learnerId}|${entry.eventKey}`, JSON.parse(JSON.stringify(entry)));
      },
    };
  }

  const newWorld = () => ({
    clock: T0,
    wallets: new Map(),
    ledger: new Map(),
    applied: new Map(),
    xp: new Map(),
    xpApplied: new Set(),
  });

  const honeyOf = (world, learner) => world.wallets.get(learner)?.honey ?? 0;
  const walletSum = (world, learner) =>
    Object.values(world.wallets.get(learner)?.rewardEvents ?? {}).reduce((n, e) => n + e.amount, 0);
  const invariants = (world, learner) => {
    assert.equal(honeyOf(world, learner), walletSum(world, learner), "불변식① 잔액 = 원장 합");
    for (const [k, n] of world.applied) assert.ok(n <= 1, `불변식② 중복 가산 ${k} = ${n}`);
  };

  const draft = (over = {}) =>
    L.createEntry({
      learnerId: "학생07",
      questId: "q-vocab",
      dayKey: "2026-09-11",
      amount: 15,
      xpAmount: 0,
      now: T0,
      ...over,
    });

  await check("① createEntry 는 pending·정책버전·결정적 eventKey 를 갖는다", () => {
    const e = draft();
    assert.equal(e.status, "pending");
    assert.equal(e.honey, "pending");
    assert.equal(e.xp, "applied", "XP 가 없는 보상은 XP 단계가 처음부터 끝난 상태");
    assert.equal(e.policyVersion, L.REWARD_POLICY_VERSION);
    assert.equal(e.eventKey, "2026-09-11__q-vocab__v1");
    assert.equal(e.eventId, "학생07|2026-09-11__q-vocab__v1");
    assert.equal(draft().eventKey, e.eventKey, "같은 (날짜,퀘스트,정책) 은 항상 같은 키");
    assert.notEqual(draft({ dayKey: "2026-09-12" }).eventKey, e.eventKey);
  });

  await check("② 옛 claimed=true 는 지급 완료로 승격되고 재지급되지 않는다", async () => {
    const legacy = L.normalizeEntry(true, { learnerId: "학생07", questId: "q-vocab", dayKey: "2026-09-11", amount: 15 });
    assert.equal(legacy.status, "applied");
    assert.equal(legacy.legacy, true);
    const world = newWorld();
    world.ledger.set(`학생07|${legacy.eventKey}`, legacy);
    const res = await L.settleReward(makeStore(world), draft());
    assert.equal(res.outcome, "already");
    assert.equal(res.honeyPaid, 0);
    assert.equal(honeyOf(world, "학생07"), 0, "옛 항목에 다시 지급하지 않는다");
  });

  await check("③ status=applied 인데 단계가 덜 끝난 기록은 pending 으로 되살아난다", () => {
    const bad = L.normalizeEntry(
      { ...draft(), status: "applied", honey: "pending" },
      { questId: "q-vocab", dayKey: "2026-09-11" },
    );
    assert.equal(bad.status, "pending", "재처리 대상으로 다시 올라와야 한다");
  });

  await check("④ walletApplyUpdater 는 같은 eventKey 를 두 번 반영하지 않는다", () => {
    const first = L.walletApplyUpdater("K1", 15, T0)({ honey: 5 });
    assert.equal(first.honey, 20);
    assert.equal(L.walletApplyUpdater("K1", 15, T0)(first), undefined, "두 번째는 abort");
    const other = L.walletApplyUpdater("K2", 10, T0)(first);
    assert.equal(other.honey, 30);
  });

  await check("⑤ 정상 경로: 꿀 1회 지급, 원장 1개, status=applied", async () => {
    const world = newWorld();
    const res = await L.settleReward(makeStore(world), draft());
    assert.equal(res.outcome, "settled");
    assert.equal(res.honeyPaid, 15);
    assert.equal(res.entry.status, "applied");
    assert.equal(world.ledger.size, 1);
    assert.equal(honeyOf(world, "학생07"), 15);
    invariants(world, "학생07");
  });

  await check("⑥ ADD-CLAIM-02(a) 선점 후 지급 실패 → pending 으로 보이고 재시도로 1회 지급", async () => {
    const world = newWorld();
    const store = makeStore(world, { honey: 1 });
    const first = await L.settleReward(store, draft());
    assert.equal(first.outcome, "failed");
    assert.equal(first.entry.status, "pending", "화면에 pending 으로 보여야 한다");
    assert.equal(first.entry.attempts, 1);
    assert.equal(honeyOf(world, "학생07"), 0, "지급은 아직 없다");
    assert.equal(L.pendingEntries([...world.ledger.values()]).length, 1);

    const again = await L.settleReward(store, draft());
    assert.equal(again.outcome, "settled");
    assert.equal(again.honeyPaid, 15);
    assert.equal(honeyOf(world, "학생07"), 15);
    assert.equal(world.applied.get(draft().eventId), 1, "중복 0");
    assert.equal(L.pendingEntries([...world.ledger.values()]).length, 0, "영구 미지급 0");
    invariants(world, "학생07");
  });

  await check("⑦ ADD-CLAIM-02(b) 지급 후 완료 기록 실패 → 재처리해도 다시 주지 않는다", async () => {
    const world = newWorld();
    // persist 를 2회 막는다 — 단계 기록과 실패 기록이 모두 끊긴 '프로세스 종료' 상황.
    const store = makeStore(world, { persist: 2 });
    const first = await L.settleReward(store, draft());
    assert.equal(first.outcome, "failed", "기록만 실패");
    assert.equal(honeyOf(world, "학생07"), 15, "지갑에는 이미 들어갔다");
    assert.equal(world.ledger.get(`학생07|${draft().eventKey}`).honey, "pending", "원장은 아직 pending");

    const again = await L.settleReward(store, draft());
    assert.equal(again.honeyPaid, 0, "두 번째 호출은 실제 지급 0 — 지갑이 멱등하다");
    assert.equal(again.entry.status, "applied");
    assert.equal(honeyOf(world, "학생07"), 15, "총 지급은 1회분 그대로");
    assert.equal(world.applied.get(draft().eventId), 1);
    invariants(world, "학생07");
  });

  await check("⑧ 네트워크 끊김(선점 자체 실패) → 원장도 지급도 생기지 않는다", async () => {
    const world = newWorld();
    const store = makeStore(world, { reserve: 1 });
    const first = await L.settleReward(store, draft());
    assert.equal(first.outcome, "failed");
    assert.equal(world.ledger.size, 0, "원장 0");
    assert.equal(honeyOf(world, "학생07"), 0);
    const again = await L.settleReward(store, draft());
    assert.equal(again.honeyPaid, 15);
    assert.equal(world.ledger.size, 1);
    invariants(world, "학생07");
  });

  await check("⑨ XP 가 묶인 보너스: 꿀만 성공하고 XP 가 실패하면 pending 으로 남는다", async () => {
    const world = newWorld();
    const bonus = draft({ questId: "bonus", amount: 20, xpAmount: 30 });
    const store = makeStore(world, { xp: 1 });
    const first = await L.settleReward(store, bonus);
    assert.equal(first.outcome, "failed");
    assert.equal(first.entry.honey, "applied");
    assert.equal(first.entry.xp, "pending");
    assert.equal(first.entry.status, "pending", "일부만 성공한 상태가 표현된다");
    assert.equal(L.describeEntry(first.entry), "XP 지급 대기");
    assert.equal(honeyOf(world, "학생07"), 20);
    assert.equal(world.xp.get("학생07") ?? 0, 0);

    const again = await L.settleReward(store, bonus);
    assert.equal(again.honeyPaid, 0, "꿀은 다시 주지 않는다");
    assert.equal(again.xpPaid, 30);
    assert.equal(again.entry.status, "applied");
    assert.equal(world.xp.get("학생07"), 30);
    assert.equal(honeyOf(world, "학생07"), 20);
    invariants(world, "학생07");
  });

  await check("⑩ XP 가 uncertain 이면 영구 pending 으로 굳지 않고 확인 대상으로 남는다", async () => {
    const world = newWorld();
    const bonus = draft({ questId: "bonus", amount: 20, xpAmount: 30 });
    const res = await L.settleReward(makeStore(world, {}, "uncertain"), bonus);
    assert.equal(res.entry.honey, "applied");
    assert.equal(res.entry.xp, "uncertain");
    assert.equal(res.entry.status, "applied", "영구 pending 금지");
    assert.equal(L.describeEntry(res.entry), "지급됨 (XP 확인 필요)");
    assert.equal(honeyOf(world, "학생07"), 20);
    invariants(world, "학생07");
  });

  await check("⑪ 같은 store 를 동시에 두 번 밀어도 지급은 1회 (원장 1개)", async () => {
    const world = newWorld();
    const store = makeStore(world);
    const [a, b] = await Promise.all([L.settleReward(store, draft()), L.settleReward(store, draft())]);
    assert.equal(world.ledger.size, 1, "원장 1개");
    assert.equal(honeyOf(world, "학생07"), 15);
    assert.equal(a.honeyPaid + b.honeyPaid, 15, "둘 중 하나만 실제로 지급");
    assert.equal(world.applied.get(draft().eventId), 1);
    invariants(world, "학생07");
  });

  await check("⑫ settleAll 은 밀린 항목 여러 개를 한 번에 끝낸다", async () => {
    const world = newWorld();
    const store = makeStore(world, { honey: 2 });
    const items = [draft(), draft({ questId: "q-board", amount: 15 }), draft({ questId: "q-game", amount: 10 })];
    await L.settleAll(store, items);
    assert.ok(L.pendingEntries([...world.ledger.values()]).length > 0, "주입한 실패로 일부가 밀렸다");
    await L.settleAll(store, items);
    assert.equal(L.pendingEntries([...world.ledger.values()]).length, 0, "재처리 후 영구 미지급 0");
    assert.equal(honeyOf(world, "학생07"), 40, "15+15+10 을 각각 1회씩");
    assert.equal(L.appliedHoneyTotal([...world.ledger.values()]), 40);
    invariants(world, "학생07");
  });

  // ══════════════════════════════════════════════════════════════════════
  // (B) 실제 Firebase 어댑터 + 가짜 RTDB — ADD-CLAIM-01
  // ══════════════════════════════════════════════════════════════════════

  const questOf = (id) => Q.QUEST_POOL.find((q) => q.id === id);

  await check("⑬ ADD-CLAIM-01 두 client 동시 claim → 잔액 1회, 원장 1개", async () => {
    FB.__ctl.reset();
    const day = "2026-09-11";
    const q = questOf("q-vocab");
    FB.__ctl.seed(`rooms/${ROOM}/quests/학생07/${day}/events/${q.event}`, 1);
    const state = { events: { [q.event]: 1 } };
    // 두 탭이 같은 상태를 보고 동시에 누른 상황. interleave 로 서로 끼어들게 한다.
    let flip = 0;
    FB.__ctl.interleave = async () => {
      flip++;
      await new Promise((r) => setTimeout(r, flip % 2));
    };
    const [a, b] = await Promise.all([
      Q.claimQuestReward(ROOM, "학생07", q, state, day),
      Q.claimQuestReward(ROOM, "학생07", q, state, day),
    ]);
    FB.__ctl.interleave = null;

    const wallet = FB.__ctl.read(`rooms/${ROOM}/village/학생07`);
    assert.equal(wallet.honey, q.reward, `잔액은 ${q.reward} 1회분`);
    assert.equal(Object.keys(wallet.rewardEvents).length, 1, "지갑 멱등 집합 1개");
    const claimed = FB.__ctl.read(`rooms/${ROOM}/quests/학생07/${day}/claimed`);
    assert.equal(Object.keys(claimed).length, 1, "원장 1개");
    assert.equal(claimed[q.id].status, "applied");
    assert.equal(claimed[q.id].dayKey, day, "보상은 완료한 날에 귀속");
    assert.equal(a.honey + b.honey, q.reward, "실제 지급은 한쪽에서만");
    assert.ok(a.status === "already" || b.status === "already" || a.honey === 0 || b.honey === 0);
  });

  await check("⑭ ADD-CLAIM-01 보너스: 꿀과 XP 가 각각 1회만 반영된다", async () => {
    FB.__ctl.reset();
    const day = "2026-09-11";
    const quests = Q.dailyQuestsFor(day, "학생08");
    const events = {};
    for (const q of quests) events[q.event] = 1;
    FB.__ctl.seed(`rooms/${ROOM}/quests/학생08/${day}/events`, events);
    const state = { events };
    let flip = 0;
    FB.__ctl.interleave = async () => {
      flip++;
      await new Promise((r) => setTimeout(r, flip % 2));
    };
    const res = await Promise.all([
      Q.claimBonusReward(ROOM, "학생08", quests, state, day),
      Q.claimBonusReward(ROOM, "학생08", quests, state, day),
    ]);
    FB.__ctl.interleave = null;

    const wallet = FB.__ctl.read(`rooms/${ROOM}/village/학생08`);
    assert.equal(wallet.honey, Q.BONUS_HONEY, "황금 이슬은 1회분");
    const lms = FB.__ctl.read(`rooms/${ROOM}/lms/학생08`);
    assert.equal(lms.xp, Q.BONUS_XP, "XP 도 1회분");
    assert.equal(Object.keys(lms.rewardEvents).length, 1, "XP 가드 1개");
    const bonus = FB.__ctl.read(`rooms/${ROOM}/quests/학생08/${day}/bonus`);
    assert.equal(bonus.status, "applied");
    assert.equal(bonus.xpAmount, Q.BONUS_XP, "XP 가 같은 지급 이벤트에 묶여 있다");
    assert.equal(res[0].honey + res[1].honey, Q.BONUS_HONEY);
  });

  await check("⑮ ADD-CLAIM-02 RTDB 판: 지급 직전 쓰기 차단 → 재처리로 1회 지급", async () => {
    FB.__ctl.reset();
    const day = "2026-09-11";
    const q = questOf("q-board");
    FB.__ctl.seed(`rooms/${ROOM}/quests/학생09/${day}/events/${q.event}`, 1);
    const state = { events: { [q.event]: 1 } };

    // (a) 선점은 되지만 지갑 쓰기가 끊긴다.
    FB.__ctl.failWrites = new Set([`rooms/${ROOM}/village`]);
    const first = await Q.claimQuestReward(ROOM, "학생09", q, state, day);
    assert.equal(first.status, "pending", "화면에 pending 으로");
    assert.equal(FB.__ctl.read(`rooms/${ROOM}/village/학생09`), null, "지급 없음");
    const ledger1 = FB.__ctl.read(`rooms/${ROOM}/quests/학생09/${day}/claimed/${q.id}`);
    assert.equal(ledger1.status, "pending");
    assert.equal(ledger1.honey, "pending");

    // 화면이 다시 계산하면 pending 으로 보이고 재시도 대상이 된다.
    const st2 = { events: state.events, claimed: { [q.id]: ledger1 } };
    assert.equal(Q.questClaimState(q, st2), "pending");
    assert.equal(Q.questClaimed(q, st2), false, "받았다고 표시하지 않는다");
    assert.equal(Q.pendingRewards([q], st2).length, 1);

    // (b) 지갑은 열리고 원장 기록만 끊긴 상태로 한 번 더.
    FB.__ctl.failWrites = new Set([`rooms/${ROOM}/quests/학생09/${day}/claimed`]);
    const second = await Q.claimQuestReward(ROOM, "학생09", q, st2, day);
    assert.equal(second.status, "pending", "기록 실패라 아직 pending");
    assert.equal(FB.__ctl.read(`rooms/${ROOM}/village/학생09`).honey, q.reward, "지갑에는 들어갔다");

    // 전부 정상화 후 재처리.
    FB.__ctl.failWrites = new Set();
    const results = await Q.recoverDayRewards(ROOM, "학생09", day, [q], st2);
    assert.equal(results.length, 1);
    assert.equal(results[0].honeyPaid, 0, "이미 들어간 꿀을 또 주지 않는다");
    const wallet = FB.__ctl.read(`rooms/${ROOM}/village/학생09`);
    assert.equal(wallet.honey, q.reward, "총 지급 = 1회분");
    assert.equal(Object.keys(wallet.rewardEvents).length, 1);
    const ledger3 = FB.__ctl.read(`rooms/${ROOM}/quests/학생09/${day}/claimed/${q.id}`);
    assert.equal(ledger3.status, "applied", "영구 미지급 0");
    const st3 = { events: state.events, claimed: { [q.id]: ledger3 } };
    assert.equal(Q.questClaimed(q, st3), true);
    assert.equal(Q.pendingRewards([q], st3).length, 0);
  });

  await check("⑯ 옛 true 데이터가 섞인 방에서도 재지급이 일어나지 않는다", async () => {
    FB.__ctl.reset();
    const day = "2026-09-10";
    const q = questOf("q-game");
    FB.__ctl.seed(`rooms/${ROOM}/quests/학생10/${day}/events/${q.event}`, 1);
    FB.__ctl.seed(`rooms/${ROOM}/quests/학생10/${day}/claimed/${q.id}`, true);
    FB.__ctl.seed(`rooms/${ROOM}/village/학생10`, { honey: 40 });
    const state = { events: { [q.event]: 1 }, claimed: { [q.id]: true } };
    assert.equal(Q.questClaimed(q, state), true, "옛 데이터도 '받았어요' 로 보인다");
    const res = await Q.claimQuestReward(ROOM, "학생10", q, state, day);
    assert.equal(res.status, "already");
    assert.equal(FB.__ctl.read(`rooms/${ROOM}/village/학생10`).honey, 40, "잔액 변화 없음");
  });

  await check("⑰ reportQuestEvent: 기본은 종전과 같고, eventKey 를 주면 중복 보고가 무시된다", async () => {
    FB.__ctl.reset();
    const day = "2026-09-11";
    Q.reportQuestEvent(ROOM, "학생11", "vocab_session", 1, { dayKey: day });
    Q.reportQuestEvent(ROOM, "학생11", "vocab_session", 1, { dayKey: day });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(FB.__ctl.read(`rooms/${ROOM}/quests/학생11/${day}/events/vocab_session`), 2, "기본 경로의 계수 의미 불변");

    Q.reportQuestEvent(ROOM, "학생11", "game_play", 1, { dayKey: day, eventKey: "sess-1" });
    await new Promise((r) => setTimeout(r, 5));
    Q.reportQuestEvent(ROOM, "학생11", "game_play", 1, { dayKey: day, eventKey: "sess-1" });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(FB.__ctl.read(`rooms/${ROOM}/quests/학생11/${day}/events/game_play`), 1, "같은 eventKey 는 1회만");
    Q.reportQuestEvent(ROOM, "학생11", "game_play", 1, { dayKey: day, eventKey: "sess-2" });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(FB.__ctl.read(`rooms/${ROOM}/quests/학생11/${day}/events/game_play`), 2);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 고정 seed 결정적 무작위 루프 20,000회
  // ══════════════════════════════════════════════════════════════════════
  await check("⑱ 고정 seed 20,000회 무작위 실패 주입에도 불변식이 깨지지 않는다", async () => {
    const world = newWorld();
    let seed = 20260912;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const learners = ["학생A", "학생B", "학생C"];
    const days = ["2026-09-10", "2026-09-11", "2026-09-12"];
    const specs = [
      { questId: "q-vocab", amount: 15, xpAmount: 0 },
      { questId: "q-board", amount: 15, xpAmount: 0 },
      { questId: "q-game", amount: 10, xpAmount: 0 },
      { questId: "bonus", amount: 20, xpAmount: 30 },
    ];
    const attempted = new Set();

    for (let i = 0; i < 20000; i++) {
      world.clock += 1000;
      const learnerId = learners[Math.floor(rnd() * learners.length)];
      const dayKey = days[Math.floor(rnd() * days.length)];
      const spec = specs[Math.floor(rnd() * specs.length)];
      const e = L.createEntry({ learnerId, dayKey, ...spec, now: world.clock });
      attempted.add(`${learnerId}|${e.eventKey}`);

      const r = rnd();
      const fail =
        r < 0.2 ? { reserve: 1 } : r < 0.45 ? { honey: 1 } : r < 0.7 ? { persist: 1 } : r < 0.85 ? { xp: 1 } : {};
      await L.settleReward(makeStore(world, fail), e);

      // 불변식 ①② 는 매 회 검사한다.
      for (const l of learners) {
        assert.equal(honeyOf(world, l), walletSum(world, l));
      }
      for (const [k, n] of world.applied) assert.ok(n <= 1, `중복 가산 ${k}`);
    }

    // 실패 주입을 끄고 끝까지 재처리 → 영구 pending 0, 누락 0.
    const healthy = makeStore(world);
    for (let pass = 0; pass < 3; pass++) {
      const stuck = L.pendingEntries([...world.ledger.values()]);
      if (stuck.length === 0) break;
      await L.settleAll(healthy, stuck);
    }
    assert.equal(L.pendingEntries([...world.ledger.values()]).length, 0, "불변식③ 영구 pending 0");

    // 불변식④ — 시도된 모든 사건이 정확히 1회분씩 지갑에 있다.
    let expected = new Map();
    for (const key of attempted) {
      const [learnerId] = key.split("|");
      const entry = world.ledger.get(key);
      assert.ok(entry, `원장에 ${key} 가 있어야 한다`);
      expected.set(learnerId, (expected.get(learnerId) ?? 0) + entry.amount);
    }
    for (const l of learners) {
      assert.equal(honeyOf(world, l), expected.get(l) ?? 0, `불변식④ ${l} 총 지급액`);
      assert.equal(
        L.appliedHoneyTotal([...world.ledger.values()].filter((e) => e.learnerId === l)),
        honeyOf(world, l),
        "총 지급액 = 적용된 원장 합",
      );
    }
    console.log(
      `      (원장 ${world.ledger.size}건 / 지급 ${[...world.applied.values()].reduce((a, b) => a + b, 0)}회 / 중복 0)`,
    );
  });

  console.log(`\n${count} checks passed. (ADD-CLAIM-01/02 재현 포함)`);
  console.log("남은 한계: XP 는 lms 트랜잭션 밖에서 가드하므로 '가드 기록 후 awardXp 전' 종료 시");
  console.log("           xp=\"uncertain\" 으로 남는다 — 중복은 없지만 누락 가능. 보고서 patch 참조.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}

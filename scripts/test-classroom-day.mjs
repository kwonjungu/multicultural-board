/**
 * X05 교실 날짜 재현 테스트 — ADD-DAY-01 / ADD-SUB-01.
 *
 * 실행: node scripts/test-classroom-day.mjs
 *
 * fake clock 으로 자정 경계를 넘긴다. **기대값은 구현 함수의 반환값이 아니라**
 * 손으로 계산한 UTC 순간에서 독립적으로 정의한다 (예: 2026-09-11 23:58 KST 는
 * Date.UTC(2026, 8, 11, 14, 58) 이고, 그때의 교실 날짜는 "2026-09-11" 이어야
 * 한다 — 이 문자열은 dayKeyAt 을 호출해서 얻은 값이 아니다).
 *
 * ADD-SUB-01 은 가짜 RTDB 로 listener 두 개를 실제로 붙였다 떼며 본다. 종전
 * cleanup(`off(r)`)과 새 cleanup(구독이 돌려준 unsubscribe)을 같은 조건에서
 * 나란히 돌려 차이를 증거로 남긴다.
 *
 * 운영 DB 에 접속하지 않는다. 방 번호는 가짜(9999)다.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "bee-day-"));

let count = 0;
const check = async (name, fn) => {
  await fn();
  count++;
  console.log(`PASS ${name}`);
};

function transpile(rel) {
  const src = readFileSync(join(root, rel), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(
    join(dir, basename(rel).replace(/\.ts$/, ".mjs")),
    out
      .replace(/from\s+"firebase\/database"/g, 'from "./_fb.mjs"')
      .replace(/from\s+"\.\/firebase-client"/g, 'from "./_client.mjs"')
      .replace(/from\s+"\.\/([A-Za-z0-9_-]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/([A-Za-z0-9_-]+)"/g, 'from "./$1.mjs"'),
  );
}

// 가짜 RTDB — 여기서는 쓰기 알림(listener)이 핵심이다.
const FAKE_FB = `
let tree = {};
export const __db = { name: "fake" };
const listeners = new Map();   // path -> [{cb}]
export const __ctl = {
  reset(){ tree = {}; listeners.clear(); },
  read(path){ return readAt(path); },
  seed(path, value){ writeAt(path, value); },
  listenerCount(path){ return (listeners.get(path) ?? []).length; },
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
  if (parts.length === 0) { tree = clone(value) ?? {}; notify(""); return; }
  let node = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    if (node[parts[i]] === null || typeof node[parts[i]] !== "object") node[parts[i]] = {};
    node = node[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (value === null || value === undefined) delete node[last];
  else node[last] = clone(value);
  notify(p);
}
/** 쓰기 경로 자신 + 조상 + 자손 listener 에게 알린다 (RTDB 와 같은 범위). */
function notify(p){
  const written = segs(p).join("/");
  for (const [path, list] of listeners) {
    const same = path === written;
    const ancestor = written.startsWith(path ? path + "/" : "");
    const descendant = path.startsWith(written ? written + "/" : "");
    if (!(same || ancestor || descendant)) continue;
    for (const e of [...list]) e.cb({ val: () => readAt(path) });
  }
}
export function ref(_db, path){ return { path }; }
export async function get(r){ const v = readAt(r.path); return { val: () => v, exists: () => v !== null }; }
export async function set(r, value){ writeAt(r.path, value); }
export async function update(r, patch){
  const cur = readAt(r.path);
  writeAt(r.path, { ...(cur && typeof cur === "object" ? cur : {}), ...patch });
}
export async function runTransaction(r, updater){
  const next = updater(clone(readAt(r.path)));
  if (next === undefined) { const v = readAt(r.path); return { committed: false, snapshot: { val: () => v } }; }
  writeAt(r.path, next);
  const after = readAt(r.path);
  return { committed: true, snapshot: { val: () => after } };
}
export function onValue(r, cb){
  const list = listeners.get(r.path) ?? [];
  const entry = { cb };
  list.push(entry);
  listeners.set(r.path, list);
  cb({ val: () => readAt(r.path) });
  return () => listeners.set(r.path, (listeners.get(r.path) ?? []).filter((e) => e !== entry));
}
/** 인자 없는 off 는 그 경로의 **모든** listener 를 끊는다 (진짜 RTDB 와 동일). */
export function off(r){ listeners.set(r.path, []); }
`;

const FAKE_CLIENT = `
import { __db } from "./_fb.mjs";
export function getClientDb(){ return __db; }
export function getClientApp(){ return { name: "fake" }; }
`;

// ── fake clock ──────────────────────────────────────────────────────────
const realNow = Date.now;
let fakeNow = null;
Date.now = () => (fakeNow === null ? realNow() : fakeNow);
const setNow = (ms) => {
  fakeNow = ms;
};

try {
  writeFileSync(join(dir, "_fb.mjs"), FAKE_FB);
  writeFileSync(join(dir, "_client.mjs"), FAKE_CLIENT);
  for (const f of ["lib/classroomDay.ts", "lib/rewardLedger.ts", "lib/lms.ts", "lib/quests.ts"]) transpile(f);

  const C = await import(pathToFileURL(join(dir, "classroomDay.mjs")));
  const Q = await import(pathToFileURL(join(dir, "quests.mjs")));
  const FB = await import(pathToFileURL(join(dir, "_fb.mjs")));

  const ROOM = "9999";
  const ME = "학생07";
  const SEOUL = "Asia/Seoul";

  // 손으로 정의한 시각들 (KST = UTC+9)
  const T_2358 = Date.UTC(2026, 8, 11, 14, 58); // 2026-09-11 23:58 KST
  const T_MIDNIGHT = Date.UTC(2026, 8, 11, 15, 0); // 2026-09-12 00:00 KST
  const T_0003 = Date.UTC(2026, 8, 11, 15, 3); // 2026-09-12 00:03 KST
  const DAY_BEFORE = "2026-09-11";
  const DAY_AFTER = "2026-09-12";

  await check("① 교실 날짜는 기기 시간대가 아니라 교실 시간대로 정해진다", () => {
    assert.equal(C.dayKeyAt(T_2358, SEOUL), DAY_BEFORE);
    assert.equal(C.dayKeyAt(T_MIDNIGHT, SEOUL), DAY_AFTER);
    // 같은 순간을 다른 교실 시간대로 보면 날짜가 다르다 — 그래서 기준이 필요하다.
    assert.equal(C.dayKeyAt(T_MIDNIGHT, "UTC"), DAY_BEFORE);
    assert.equal(C.dayKeyAt(T_MIDNIGHT, "America/New_York"), DAY_BEFORE);
    assert.equal(C.dayKeyAt(T_MIDNIGHT, "Pacific/Kiritimati"), DAY_AFTER);
  });

  await check("② 잘못된/빈 시간대는 조용히 Asia/Seoul 로 떨어진다", () => {
    assert.equal(C.DEFAULT_CLASSROOM_TIME_ZONE, SEOUL);
    assert.equal(C.resolveTimeZone(undefined), SEOUL);
    assert.equal(C.resolveTimeZone(""), SEOUL);
    assert.equal(C.resolveTimeZone("Asia/Seoul_오타"), SEOUL);
    assert.equal(C.resolveTimeZone("Asia/Ho_Chi_Minh"), "Asia/Ho_Chi_Minh");
    assert.deepEqual(C.describeTimeZone("없는/지역"), { timeZone: SEOUL, fellBack: true });
    assert.deepEqual(C.describeTimeZone("UTC"), { timeZone: "UTC", fellBack: false });
  });

  await check("③ 다음 자정까지 남은 시간 — 23:58 이면 정확히 2분", () => {
    assert.equal(C.nextDayBoundaryAt(T_2358, SEOUL), T_MIDNIGHT);
    assert.equal(C.msUntilNextDay(T_2358, SEOUL), 2 * 60 * 1000);
    // 자정 직후엔 24시간 - 3분.
    assert.equal(C.msUntilNextDay(T_0003, SEOUL), 24 * 60 * 60 * 1000 - 3 * 60 * 1000);
  });

  await check("④ DST 가 있는 시간대에서도 '24시 - 지금' 산술로 어긋나지 않는다", () => {
    // 2026-03-08 America/New_York 은 02:00 에 서머타임이 시작돼 23시간짜리 하루다.
    // 00:30 EST = 05:30 UTC, 다음 자정(03-09 00:00 EDT) = 04:00 UTC → 22.5시간.
    const t = Date.UTC(2026, 2, 8, 5, 30);
    assert.equal(C.dayKeyAt(t, "America/New_York"), "2026-03-08");
    assert.equal(C.msUntilNextDay(t, "America/New_York"), 22.5 * 60 * 60 * 1000);
  });

  await check("⑤ 날짜 키 산술 (어제/비교)", () => {
    assert.equal(C.previousDayKey(DAY_AFTER), DAY_BEFORE);
    assert.equal(C.shiftDayKey("2026-03-01", -1), "2026-02-28");
    assert.equal(C.shiftDayKey("2024-03-01", -1), "2024-02-29", "윤년");
    assert.equal(C.shiftDayKey("2026-12-31", 1), "2027-01-01");
    assert.ok(C.compareDayKeys(DAY_BEFORE, DAY_AFTER) < 0);
  });

  // ── ADD-DAY-01 ────────────────────────────────────────────────────────
  await check("⑥ ADD-DAY-01 자정 직전 열기: 목록·구독·수령이 모두 같은 dayKey", async () => {
    FB.__ctl.reset();
    setNow(T_2358);
    Q.setClassroomTimeZone(ROOM, SEOUL);

    // 화면이 여는 순간 정하는 값 하나로 셋을 모두 돌린다.
    const dayKey = Q.roomTodayKey(ROOM);
    assert.equal(dayKey, DAY_BEFORE, "23:58 KST 의 교실 날짜");

    const quests = Q.dailyQuestsFor(dayKey, ME);
    const seen = [];
    const unsub = Q.subscribeTodayQuests(ROOM, ME, (s) => seen.push(s), dayKey);

    // 첫 심부름을 끝냈다고 보고 (구독이 같은 경로를 보고 있어야 값이 올라온다).
    Q.reportQuestEvent(ROOM, ME, quests[0].event, 1, { dayKey });
    await new Promise((r) => setTimeout(r, 5));
    assert.ok(
      seen.some((s) => (s.events?.[quests[0].event] ?? 0) >= 1),
      "구독이 목록과 같은 날짜 경로를 보고 있다",
    );
    assert.equal(
      FB.__ctl.read(`rooms/${ROOM}/quests/${ME}/${DAY_BEFORE}/events/${quests[0].event}`),
      1,
      "쓰기도 같은 날짜에",
    );
    unsub();
  });

  await check("⑦ ADD-DAY-01 자정 → 탭 복귀: 목록·구독이 함께 새 날짜로 바뀐다", async () => {
    FB.__ctl.reset();
    setNow(T_2358);
    Q.setClassroomTimeZone(ROOM, SEOUL);

    // 화면 열림 (23:58)
    let dayKey = Q.roomTodayKey(ROOM);
    let quests = Q.dailyQuestsFor(dayKey, ME);
    let beforeState = {};
    let unsub = Q.subscribeTodayQuests(ROOM, ME, (s) => (beforeState = s), dayKey);
    const questsBefore = quests.map((q) => q.id);

    // 자정을 넘겨 탭 복귀 (00:03). QuestBoard 의 evaluateDay 와 같은 판정.
    setNow(T_0003);
    const next = C.dayKeyAt(Date.now(), SEOUL);
    assert.equal(next, DAY_AFTER);
    const dayChanged = next !== dayKey;
    assert.equal(dayChanged, true, "'새로운 하루가 시작됐어요' 를 띄울 조건");

    // 목록과 구독을 **함께** 교체한다.
    unsub();
    const prevKey = dayKey;
    dayKey = next;
    quests = Q.dailyQuestsFor(dayKey, ME);
    let afterState = {};
    unsub = Q.subscribeTodayQuests(ROOM, ME, (s) => (afterState = s), dayKey);

    assert.notDeepEqual(
      quests.map((q) => q.id),
      questsBefore,
      "결정적 회전이므로 날짜가 바뀌면 조합도 바뀐다",
    );
    Q.reportQuestEvent(ROOM, ME, quests[0].event, 1, { dayKey });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(FB.__ctl.read(`rooms/${ROOM}/quests/${ME}/${DAY_AFTER}/events/${quests[0].event}`), 1);
    assert.equal(
      FB.__ctl.read(`rooms/${ROOM}/quests/${ME}/${prevKey}/events/${quests[0].event}`),
      null,
      "옛 날짜 경로에 더 쓰지 않는다",
    );
    assert.ok((afterState.events?.[quests[0].event] ?? 0) >= 1, "새 구독이 값을 받는다");
    unsub();
  });

  await check("⑧ ADD-DAY-01 자정 뒤에 받는 어제 보상은 '어제' 에 귀속된다", async () => {
    FB.__ctl.reset();
    setNow(T_2358);
    Q.setClassroomTimeZone(ROOM, SEOUL);

    const prevKey = Q.roomTodayKey(ROOM);
    const prevQuests = Q.dailyQuestsFor(prevKey, ME);
    const q = prevQuests[0];
    Q.reportQuestEvent(ROOM, ME, q.event, 1, { dayKey: prevKey });
    await new Promise((r) => setTimeout(r, 5));
    const prevState = FB.__ctl.read(`rooms/${ROOM}/quests/${ME}/${prevKey}`);

    // 자정을 넘긴 뒤 '어제 것 받기'.
    setNow(T_0003);
    assert.equal(Q.roomTodayKey(ROOM), DAY_AFTER, "오늘은 이미 12일");
    const res = await Q.claimQuestReward(ROOM, ME, q, prevState, prevKey);
    assert.equal(res.status, "paid");
    assert.equal(res.honey, q.reward);

    const ledger = FB.__ctl.read(`rooms/${ROOM}/quests/${ME}/${prevKey}/claimed/${q.id}`);
    assert.ok(ledger, "원장은 어제 경로에 있다");
    assert.equal(ledger.dayKey, DAY_BEFORE, "보상 이벤트에 완료 당시 dayKey 가 고정된다");
    assert.equal(ledger.status, "applied");
    assert.equal(
      FB.__ctl.read(`rooms/${ROOM}/quests/${ME}/${DAY_AFTER}/claimed`),
      null,
      "오늘 경로에는 아무것도 생기지 않는다",
    );
    assert.equal(FB.__ctl.read(`rooms/${ROOM}/village/${ME}`).honey, q.reward);
    // 같은 보상을 오늘 날짜로 다시 시도해도 어제 것이 이미 반영됐으므로 지갑은 그대로.
    const eventKeys = Object.keys(FB.__ctl.read(`rooms/${ROOM}/village/${ME}`).rewardEvents);
    assert.deepEqual(eventKeys, [`${DAY_BEFORE}__${q.id}__v1`], "멱등 키에 어제 날짜가 박혀 있다");
  });

  await check("⑨ 방 설정 timeZone 이 dayKey 를 바꾼다 (같은 순간, 다른 교실)", async () => {
    FB.__ctl.reset();
    setNow(T_MIDNIGHT); // 2026-09-12 00:00 KST = 2026-09-11 10:00 ICT? (실제는 22:00 ICT 11일)
    Q.setClassroomTimeZone(ROOM, SEOUL);
    assert.equal(Q.roomTodayKey(ROOM), DAY_AFTER);
    Q.setClassroomTimeZone(ROOM, "Asia/Ho_Chi_Minh"); // UTC+7 → 아직 11일 23:00
    assert.equal(Q.roomTodayKey(ROOM), DAY_BEFORE, "베트남 기준 교실은 아직 어제");
    // 구독이 방 설정을 읽어 반영하는 경로도 확인.
    FB.__ctl.seed(`rooms/${ROOM}/config/timeZone`, "UTC");
    const got = [];
    const unsub = Q.subscribeClassroomTimeZone(ROOM, (tz) => got.push(tz));
    assert.deepEqual(got, ["UTC"]);
    assert.equal(Q.classroomTimeZone(ROOM), "UTC");
    assert.equal(Q.roomTodayKey(ROOM), DAY_BEFORE, "UTC 기준으로도 아직 11일 15:00");
    unsub();
    Q.setClassroomTimeZone(ROOM, SEOUL);
  });

  // ── ADD-SUB-01 ────────────────────────────────────────────────────────
  await check("⑩ ADD-SUB-01(재현) 옛 cleanup `off(r)` 은 남은 listener 까지 끊는다", async () => {
    FB.__ctl.reset();
    setNow(T_2358);
    const path = `rooms/${ROOM}/quests/${ME}/${DAY_BEFORE}`;
    const a = [];
    const b = [];
    // 종전 구현과 같은 모양: cleanup 이 경로 단위 off(r).
    const subOld = (sink) => {
      const r = FB.ref(FB.__db, path);
      FB.onValue(r, (snap) => sink.push(snap.val()));
      return () => FB.off(r);
    };
    const offA = subOld(a);
    subOld(b);
    assert.equal(FB.__ctl.listenerCount(path), 2);
    offA(); // 화면 하나만 unmount
    assert.equal(FB.__ctl.listenerCount(path), 0, "재현: 남의 listener 까지 사라진다");
    FB.__ctl.seed(`${path}/events/game_play`, 1);
    assert.equal(b.length, 1, "재현: 남은 화면이 갱신을 못 받는다 (최초 1회뿐)");
  });

  await check("⑪ ADD-SUB-01(수정 후) 하나를 unmount 해도 남은 listener 는 정상 수신", async () => {
    FB.__ctl.reset();
    setNow(T_2358);
    Q.setClassroomTimeZone(ROOM, SEOUL);
    const path = `rooms/${ROOM}/quests/${ME}/${DAY_BEFORE}`;
    const a = [];
    const b = [];
    const unsubA = Q.subscribeTodayQuests(ROOM, ME, (s) => a.push(s), DAY_BEFORE);
    const unsubB = Q.subscribeTodayQuests(ROOM, ME, (s) => b.push(s), DAY_BEFORE);
    assert.equal(FB.__ctl.listenerCount(path), 2);

    unsubA();
    assert.equal(FB.__ctl.listenerCount(path), 1, "내 것만 끊긴다");

    const beforeA = a.length;
    const beforeB = b.length;
    Q.reportQuestEvent(ROOM, ME, "game_play", 1, { dayKey: DAY_BEFORE });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(a.length, beforeA, "끊은 쪽은 더 받지 않는다");
    assert.ok(b.length > beforeB, "남은 쪽은 정상 수신");
    assert.equal(b[b.length - 1].events.game_play, 1);

    unsubB();
    assert.equal(FB.__ctl.listenerCount(path), 0);
  });

  await check("⑫ 같은 화면이 날짜를 바꿔 재구독해도 listener 가 새지 않는다", async () => {
    FB.__ctl.reset();
    setNow(T_2358);
    Q.setClassroomTimeZone(ROOM, SEOUL);
    const before = `rooms/${ROOM}/quests/${ME}/${DAY_BEFORE}`;
    const after = `rooms/${ROOM}/quests/${ME}/${DAY_AFTER}`;
    let unsub = Q.subscribeTodayQuests(ROOM, ME, () => {}, DAY_BEFORE);
    assert.equal(FB.__ctl.listenerCount(before), 1);
    unsub();
    setNow(T_0003);
    unsub = Q.subscribeTodayQuests(ROOM, ME, () => {}, Q.roomTodayKey(ROOM));
    assert.equal(FB.__ctl.listenerCount(before), 0, "옛 날짜 구독은 남지 않는다");
    assert.equal(FB.__ctl.listenerCount(after), 1);
    unsub();
    assert.equal(FB.__ctl.listenerCount(after), 0);
  });

  console.log(`\n${count} checks passed. (ADD-DAY-01 / ADD-SUB-01 재현 포함)`);
  console.log("React 배선(타이머·visibilitychange)은 이 스크립트가 아니라 QuestBoard 코드와");
  console.log("fixture 실측으로 확인한다 — 미검증 목록 참조.");
} finally {
  Date.now = realNow;
  rmSync(dir, { recursive: true, force: true });
}

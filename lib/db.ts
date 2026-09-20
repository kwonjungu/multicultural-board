/**
 * Firebase RTDB 호환 레이어 (온라인/오프라인 자동 전환)
 *
 * 심사용 USB가 인터넷 없는 환경에서도 구동되도록,
 * `firebase/database` 의 사용 표면(ref/get/set/update/push/remove/onValue/off/
 * query/limitToLast/runTransaction/serverTimestamp/onDisconnect/goOffline)을
 * 동일 시그니처로 감싼다.
 *
 * - 온라인: 실제 Firebase SDK에 그대로 위임 (기존 동작과 100% 동일)
 * - 오프라인(네트워크 없음 또는 RTDB 4초 내 미응답): localStorage 기반 목 DB.
 *   초기 데이터는 /offline-seed-1111.json (심사용 학급방 1111 스냅샷).
 *
 * 판정은 최초 1회만 수행하고 세션 내내 유지한다(중간 전환 시 상태 불일치 방지).
 */
import {
  getDatabase,
  ref as fbRef,
  get as fbGet,
  set as fbSet,
  update as fbUpdate,
  push as fbPush,
  remove as fbRemove,
  onValue as fbOnValue,
  onChildAdded as fbOnChildAdded,
  onChildChanged as fbOnChildChanged,
  onChildRemoved as fbOnChildRemoved,
  off as fbOff,
  query as fbQuery,
  limitToLast as fbLimitToLast,
  runTransaction as fbRunTransaction,
  serverTimestamp as fbServerTimestamp,
  onDisconnect as fbOnDisconnect,
  goOffline as fbGoOffline,
  Database,
  DatabaseReference,
} from "firebase/database";

export type { Database, DatabaseReference, DataSnapshot } from "firebase/database";
export { connectDatabaseEmulator } from "firebase/database";

/* ────────────────────────────── 모드 판정 ────────────────────────────── */

type Mode = "online" | "offline";
let resolvedMode: Mode | null = null;
let modePromise: Promise<Mode> | null = null;

const PROBE_TIMEOUT_MS = 4000;

function probeMode(): Promise<Mode> {
  if (resolvedMode) return Promise.resolve(resolvedMode);
  if (modePromise) return modePromise;
  modePromise = (async (): Promise<Mode> => {
    if (typeof window === "undefined") return "online"; // SSR: 실 SDK 경로
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "offline";
    }
    const base = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    if (!base) return "offline";
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      // 규칙상 읽기 거부여도 HTTP 응답 자체가 오면 "연결 가능"으로 본다.
      await fetch(`${base}/.json?shallow=true&timeout=3s`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      return "online";
    } catch {
      return "offline";
    }
  })().then((m) => {
    resolvedMode = m;
    if (m === "offline" && typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info("[db] 오프라인 모드: 로컬 목 DB로 동작합니다 (학급방 1111).");
      window.dispatchEvent(new CustomEvent("db-offline-mode"));
    }
    return m;
  });
  return modePromise;
}

/** 현재 오프라인 목 모드인지 (판정 전이면 null) */
export function isOfflineMode(): boolean | null {
  return resolvedMode === null ? null : resolvedMode === "offline";
}

/* ────────────────────────────── 목 DB 본체 ────────────────────────────── */

const SEED_URL = "/offline-seed-1111.json";
const OVERLAY_KEY = "mbb-offline-db-v1";
const SERVER_TS = { ".sv": "timestamp" } as const;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

class MockDb {
  private tree: { [k: string]: Json } = {};
  private listeners = new Map<string, Set<(snap: MockSnapshot) => void>>();
  private readyPromise: Promise<void> | null = null;

  ready(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        try {
          const res = await fetch(SEED_URL, { cache: "no-store" });
          if (res.ok) {
            this.tree = { rooms: { "1111": (await res.json()) as Json } };
          }
        } catch {
          /* 시드 없이도 빈 트리로 동작 */
        }
        try {
          const saved = localStorage.getItem(OVERLAY_KEY);
          if (saved) {
            const overlay = JSON.parse(saved) as Array<[string, Json]>;
            for (const [p, v] of overlay) this.writeAt(p, v, false);
          }
        } catch {
          /* overlay 손상 시 무시 */
        }
      })();
    }
    return this.readyPromise;
  }

  private overlay: Array<[string, Json]> = [];

  private persist(path: string, value: Json) {
    this.overlay.push([path, value]);
    try {
      localStorage.setItem(OVERLAY_KEY, JSON.stringify(this.overlay));
    } catch {
      /* 용량 초과 시 이번 세션 메모리로만 유지 */
    }
  }

  private segs(path: string): string[] {
    return path.split("/").filter(Boolean);
  }

  readAt(path: string): Json {
    let node: Json = this.tree;
    for (const s of this.segs(path)) {
      if (node === null || typeof node !== "object" || Array.isArray(node)) return null;
      node = (node as { [k: string]: Json })[s] ?? null;
    }
    return node === undefined ? null : node;
  }

  private replaceTimestamps(v: Json): Json {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const o = v as { [k: string]: Json };
      if (o[".sv"] === "timestamp") return Date.now();
      const out: { [k: string]: Json } = {};
      for (const k of Object.keys(o)) out[k] = this.replaceTimestamps(o[k]);
      return out;
    }
    if (Array.isArray(v)) return v.map((x) => this.replaceTimestamps(x));
    return v;
  }

  writeAt(path: string, value: Json, persist = true) {
    const val = this.replaceTimestamps(value);
    const parts = this.segs(path);
    if (parts.length === 0) {
      this.tree = (val as { [k: string]: Json }) ?? {};
    } else {
      let node = this.tree as { [k: string]: Json };
      for (let i = 0; i < parts.length - 1; i++) {
        const s = parts[i];
        const cur = node[s];
        if (cur === null || cur === undefined || typeof cur !== "object" || Array.isArray(cur)) {
          node[s] = {};
        }
        node = node[s] as { [k: string]: Json };
      }
      const leaf = parts[parts.length - 1];
      if (val === null) delete node[leaf];
      else node[leaf] = val;
    }
    if (persist) this.persist(path, val);
    this.notify(path);
  }

  updateAt(path: string, patch: { [k: string]: Json }) {
    // RTDB update: 각 키가 독립 경로 (슬래시 포함 키 지원)
    for (const k of Object.keys(patch)) {
      this.writeAt(path ? `${path}/${k}` : k, patch[k]);
    }
  }

  private lastPushTime = 0;
  private lastRand: number[] = [];

  pushKey(): string {
    // Firebase 공식 push id 알고리즘 재현 — 실제 키와 섞여도 시간순 정렬 유지
    const CHARS =
      "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
    let now = Date.now();
    const dup = now === this.lastPushTime;
    this.lastPushTime = now;
    const ts = new Array<string>(8);
    for (let i = 7; i >= 0; i--) {
      ts[i] = CHARS.charAt(now % 64);
      now = Math.floor(now / 64);
    }
    if (!dup) {
      this.lastRand = Array.from({ length: 12 }, () =>
        Math.floor(Math.random() * 64),
      );
    } else {
      let i = 11;
      for (; i >= 0 && this.lastRand[i] === 63; i--) this.lastRand[i] = 0;
      if (i >= 0) this.lastRand[i]++;
    }
    return ts.join("") + this.lastRand.map((n) => CHARS.charAt(n)).join("");
  }

  subscribe(path: string, cb: (snap: MockSnapshot) => void): () => void {
    const key = this.segs(path).join("/");
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(cb);
    // 즉시 1회 발화 (RTDB 규약)
    void this.ready().then(() => cb(new MockSnapshot(key, this.readAt(key))));
    return () => this.listeners.get(key)?.delete(cb);
  }

  unsubscribeAll(path: string) {
    this.listeners.delete(this.segs(path).join("/"));
  }

  private notify(changedPath: string) {
    const changed = this.segs(changedPath).join("/");
    for (const [lpath, cbs] of Array.from(this.listeners.entries())) {
      // 조상·자손·자기 자신 리스너 모두 재발화
      if (
        changed === lpath ||
        changed.startsWith(lpath + "/") ||
        lpath.startsWith(changed + "/") ||
        lpath === ""
      ) {
        const snap = new MockSnapshot(lpath, this.readAt(lpath));
        for (const cb of Array.from(cbs)) {
          try {
            cb(snap);
          } catch {
            /* 리스너 오류 격리 */
          }
        }
      }
    }
  }
}

class MockSnapshot {
  constructor(
    private path: string,
    private value: Json,
  ) {}
  val(): unknown {
    return this.value;
  }
  exists(): boolean {
    return this.value !== null && this.value !== undefined;
  }
  get key(): string | null {
    const parts = this.path.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  }
  forEach(action: (child: MockSnapshot) => boolean | void): boolean {
    const v = this.value;
    if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
    for (const k of Object.keys(v as object)) {
      const child = new MockSnapshot(
        `${this.path}/${k}`,
        (v as { [k: string]: Json })[k],
      );
      if (action(child) === true) return true;
    }
    return false;
  }
}

const mockDb = new MockDb();

/* ──────────────────────────── 참조(경로) 래퍼 ──────────────────────────── */

/** 실 SDK ref와 목 경로를 모두 표현하는 얇은 참조 */
export interface DbRef {
  __path: string;
  __limit?: number;
  get key(): string | null;
}

function makeRef(path: string, limit?: number): DbRef {
  const parts = path.split("/").filter(Boolean);
  return {
    __path: parts.join("/"),
    __limit: limit,
    get key() {
      return parts.length ? parts[parts.length - 1] : null;
    },
  };
}

function realRef(r: DbRef): DatabaseReference {
  return fbRef(getRealDb(), r.__path);
}

let realDbInstance: Database | null = null;
function getRealDb(): Database {
  if (!realDbInstance) {
    // firebase-client.ts 의 앱 초기화를 재사용
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getClientDb } = require("./firebase-client") as {
      getClientDb: () => Database;
    };
    realDbInstance = getClientDb();
  }
  return realDbInstance;
}

/* ──────────────────────────── 공개 API (동일 시그니처) ──────────────────────────── */

// 호출부는 ref(db, path) 형태 — 첫 인자는 무시해도 되도록 관용적으로 받는다.
export function ref(_db?: unknown, path?: string): DbRef {
  return makeRef(path ?? "");
}

export function query(r: DbRef, ...constraints: Array<{ __limitToLast?: number }>): DbRef {
  let limit: number | undefined;
  for (const c of constraints) {
    if (c && typeof c.__limitToLast === "number") limit = c.__limitToLast;
  }
  return makeRef(r.__path, limit);
}

export function limitToLast(n: number): { __limitToLast: number } {
  return { __limitToLast: n };
}

export function serverTimestamp(): object {
  // RTDB 와이어 포맷 — 실 SDK도 이 형태를 서버 치환 sentinel로 처리한다.
  return SERVER_TS;
}

export interface SnapLike {
  val(): unknown;
  exists(): boolean;
  key: string | null;
  forEach(action: (child: SnapLike) => boolean | void): boolean;
}

export async function get(r: DbRef): Promise<SnapLike> {
  const mode = await probeMode();
  if (mode === "online") {
    const q = r.__limit
      ? fbQuery(realRef(r), fbLimitToLast(r.__limit))
      : realRef(r);
    return (await fbGet(q as DatabaseReference)) as unknown as SnapLike;
  }
  await mockDb.ready();
  let v = mockDb.readAt(r.__path) as Json;
  if (r.__limit && v && typeof v === "object" && !Array.isArray(v)) {
    const keys = Object.keys(v).slice(-r.__limit);
    const trimmed: { [k: string]: Json } = {};
    for (const k of keys) trimmed[k] = (v as { [k: string]: Json })[k];
    v = trimmed;
  }
  return new MockSnapshot(r.__path, v);
}

export async function set(r: DbRef, value: unknown): Promise<void> {
  const mode = await probeMode();
  if (mode === "online") return fbSet(realRef(r), value);
  await mockDb.ready();
  mockDb.writeAt(r.__path, value as Json);
}

export async function update(r: DbRef, patch: object): Promise<void> {
  const mode = await probeMode();
  if (mode === "online") return fbUpdate(realRef(r), patch);
  await mockDb.ready();
  mockDb.updateAt(r.__path, patch as { [k: string]: Json });
}

export async function remove(r: DbRef): Promise<void> {
  const mode = await probeMode();
  if (mode === "online") return fbRemove(realRef(r));
  await mockDb.ready();
  mockDb.writeAt(r.__path, null);
}

export function push(r: DbRef, value?: unknown): DbRef & Promise<DbRef> {
  // 실 SDK처럼 "thenable ref"를 반환: 동기적으로 .key 사용 가능, await도 가능
  const key = mockDb.pushKey();
  const childPath = `${r.__path}/${key}`;
  const child = makeRef(childPath);
  const done: Promise<DbRef> = (async () => {
    const mode = await probeMode();
    if (mode === "online") {
      const real = fbPush(realRef(r));
      // 온라인에서는 실제 push 키를 쓰지 않고 우리가 만든 키로 set (키 일관성 유지)
      // → 대신 실제 push 를 그대로 쓰면 동기 key 와 달라지므로, set 으로 통일
      if (value !== undefined) await fbSet(fbRef(getRealDb(), childPath), value);
      else void real; // 빈 push 는 키 예약 용도로만
      return child;
    }
    await mockDb.ready();
    if (value !== undefined) mockDb.writeAt(childPath, value as Json);
    return child;
  })();
  const thenable = child as DbRef & Promise<DbRef>;
  (thenable as unknown as { then: typeof done.then }).then = done.then.bind(done);
  (thenable as unknown as { catch: typeof done.catch }).catch = done.catch.bind(done);
  (thenable as unknown as { finally: typeof done.finally }).finally = done.finally.bind(done);
  return thenable;
}

export function onValue(
  r: DbRef,
  cb: (snap: SnapLike) => void,
  errCbOrOptions?: ((e: Error) => void) | { onlyOnce?: boolean },
  maybeOptions?: { onlyOnce?: boolean },
): () => void {
  const errCb =
    typeof errCbOrOptions === "function" ? errCbOrOptions : undefined;
  const options =
    typeof errCbOrOptions === "object" && errCbOrOptions !== null
      ? errCbOrOptions
      : maybeOptions;
  const onlyOnce = !!options?.onlyOnce;
  let cancelled = false;
  let innerUnsub: (() => void) | null = null;
  void probeMode().then((mode) => {
    if (cancelled) return;
    if (mode === "online") {
      const q = r.__limit
        ? fbQuery(realRef(r), fbLimitToLast(r.__limit))
        : realRef(r);
      innerUnsub = fbOnValue(
        q as DatabaseReference,
        cb as Parameters<typeof fbOnValue>[1],
        errCb as (e: Error) => void,
        options as { onlyOnce?: boolean },
      );
    } else {
      const unsub = mockDb.subscribe(r.__path, (snap) => {
        cb(snap);
        if (onlyOnce) unsub();
      });
      innerUnsub = unsub;
    }
  });
  return () => {
    cancelled = true;
    if (innerUnsub) innerUnsub();
  };
}

export function off(
  r: DbRef,
  eventType?: string,
  callback?: (...args: unknown[]) => void,
): void {
  void probeMode().then((mode) => {
    if (mode === "online") {
      fbOff(
        realRef(r),
        eventType as Parameters<typeof fbOff>[1],
        callback as Parameters<typeof fbOff>[2],
      );
    } else {
      mockDb.unsubscribeAll(r.__path);
    }
  });
}

export async function runTransaction(
  r: DbRef,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateFn: (current: any) => unknown,
): Promise<{ committed: boolean; snapshot: { val(): unknown } }> {
  const mode = await probeMode();
  if (mode === "online") {
    return fbRunTransaction(realRef(r), updateFn as (c: unknown) => unknown) as Promise<{
      committed: boolean;
      snapshot: { val(): unknown };
    }>;
  }
  await mockDb.ready();
  const cur = mockDb.readAt(r.__path);
  const next = updateFn(cur === null ? null : cur);
  if (next === undefined) {
    return { committed: false, snapshot: new MockSnapshot(r.__path, cur) };
  }
  mockDb.writeAt(r.__path, next as Json);
  return {
    committed: true,
    snapshot: new MockSnapshot(r.__path, mockDb.readAt(r.__path)),
  };
}

export function onDisconnect(r: DbRef): {
  remove(): Promise<void>;
  set(v: unknown): Promise<void>;
  cancel(): Promise<void>;
} {
  // 오프라인 목에서는 no-op (단일 브라우저 세션이므로 presence 정리 불필요)
  return {
    remove: async () => {
      const mode = await probeMode();
      if (mode === "online") await fbOnDisconnect(realRef(r)).remove();
    },
    set: async (v: unknown) => {
      const mode = await probeMode();
      if (mode === "online") await fbOnDisconnect(realRef(r)).set(v);
    },
    cancel: async () => {
      const mode = await probeMode();
      if (mode === "online") await fbOnDisconnect(realRef(r)).cancel();
    },
  };
}

export function goOffline(_db?: unknown): void {
  if (resolvedMode === "online") fbGoOffline(getRealDb());
}


/* ─────────────── 자식 단위 이벤트 (whiteboard 등) ─────────────── */

type ChildEvent = "added" | "changed" | "removed";

function onChildEvent(
  ev: ChildEvent,
  r: DbRef,
  cb: (snap: SnapLike) => void,
): () => void {
  let cancelled = false;
  let innerUnsub: (() => void) | null = null;
  void probeMode().then((mode) => {
    if (cancelled) return;
    if (mode === "online") {
      const real = realRef(r);
      const fn =
        ev === "added"
          ? fbOnChildAdded
          : ev === "changed"
            ? fbOnChildChanged
            : fbOnChildRemoved;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      innerUnsub = fn(real, cb as any);
    } else {
      // 목: 부모 구독으로 자식 diff 를 계산해 child 이벤트를 흉내낸다
      let prev: { [k: string]: Json } | null = null;
      innerUnsub = mockDb.subscribe(r.__path, (snap) => {
        const raw = snap.val();
        const cur: { [k: string]: Json } =
          raw !== null && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as { [k: string]: Json })
            : {};
        const before = prev ?? {};
        const first = prev === null;
        prev = cur;
        if (ev === "added") {
          for (const k of Object.keys(cur)) {
            if (first || !(k in before)) {
              cb(new MockSnapshot(`${r.__path}/${k}`, cur[k]));
            }
          }
        } else if (ev === "changed" && !first) {
          for (const k of Object.keys(cur)) {
            if (k in before && JSON.stringify(before[k]) !== JSON.stringify(cur[k])) {
              cb(new MockSnapshot(`${r.__path}/${k}`, cur[k]));
            }
          }
        } else if (ev === "removed" && !first) {
          for (const k of Object.keys(before)) {
            if (!(k in cur)) {
              cb(new MockSnapshot(`${r.__path}/${k}`, before[k]));
            }
          }
        }
      });
    }
  });
  return () => {
    cancelled = true;
    if (innerUnsub) innerUnsub();
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onChildAdded(r: DbRef, cb: (snap: any) => void): () => void {
  return onChildEvent("added", r, cb);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onChildChanged(r: DbRef, cb: (snap: any) => void): () => void {
  return onChildEvent("changed", r, cb);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onChildRemoved(r: DbRef, cb: (snap: any) => void): () => void {
  return onChildEvent("removed", r, cb);
}

export { getDatabase };

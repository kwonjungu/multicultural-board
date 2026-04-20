import { ref, push, set, remove, onValue, off, update } from "firebase/database";
import { getClientDb } from "./firebase-client";
import type {
  IndividualSticker,
  TeamSticker,
  StickerType,
  StickerGoal,
  StudentCosmetics,
  StickerSource,
} from "./types";

export interface GiveStickerOptions {
  memo?: string;
  source?: StickerSource;
  missionId?: string;
}

// Path structure:
//   rooms/{roomCode}/stickers/individual/{clientId}/{stickerId}: IndividualSticker
//   rooms/{roomCode}/stickers/team/{stickerId}: TeamSticker
//   rooms/{roomCode}/stickers/goal: { target, seasonStart }
//   rooms/{roomCode}/stickers/cosmetics/{clientId}: StudentCosmetics

function basePath(roomCode: string): string {
  return `rooms/${roomCode}/stickers`;
}

// Firebase sometimes returns numeric-keyed objects as arrays. Normalize both
// arrays and objects into `[key, value]` pairs of non-null entries.
function entriesOf<T>(val: unknown): Array<[string, T]> {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return (val as Array<T | null | undefined>)
      .map((v, i) => [String(i), v] as [string, T | null | undefined])
      .filter(([, v]) => v != null) as Array<[string, T]>;
  }
  if (typeof val === "object") {
    return Object.entries(val as Record<string, T | null | undefined>)
      .filter(([, v]) => v != null) as Array<[string, T]>;
  }
  return [];
}

// === Give ===

export async function giveIndividualSticker(
  roomCode: string,
  studentClientId: string,
  type: StickerType,
  teacherName: string,
  teacherClientId: string,
  options?: GiveStickerOptions,
): Promise<string> {
  const db = getClientDb();
  const listRef = ref(db, `${basePath(roomCode)}/individual/${studentClientId}`);
  const newRef = push(listRef);
  const id = newRef.key as string;
  const sticker: IndividualSticker = {
    id,
    type,
    fromTeacherName: teacherName,
    fromTeacherId: teacherClientId,
    timestamp: Date.now(),
    source: options?.source ?? "teacher",
  };
  if (options?.memo && options.memo.trim()) sticker.memo = options.memo.trim();
  if (options?.missionId) sticker.missionId = options.missionId;
  await set(newRef, sticker);
  return id;
}

export async function giveTeamSticker(
  roomCode: string,
  contributorClientId: string,
  type: StickerType,
  teacherName: string,
  teacherClientId: string,
  options?: GiveStickerOptions,
): Promise<string> {
  const db = getClientDb();
  const listRef = ref(db, `${basePath(roomCode)}/team`);
  const newRef = push(listRef);
  const id = newRef.key as string;
  const sticker: TeamSticker = {
    id,
    type,
    fromTeacherName: teacherName,
    fromTeacherId: teacherClientId,
    contributorClientId,
    timestamp: Date.now(),
    source: options?.source ?? "teacher",
  };
  if (options?.memo && options.memo.trim()) sticker.memo = options.memo.trim();
  if (options?.missionId) sticker.missionId = options.missionId;
  await set(newRef, sticker);
  return id;
}

export async function giveStickersBatch(
  roomCode: string,
  target: { mode: "individual"; studentClientId: string } | { mode: "team"; contributorClientId: string },
  counts: Partial<Record<StickerType, number>>,
  teacherName: string,
  teacherClientId: string,
  options?: GiveStickerOptions,
): Promise<number> {
  const ops: Promise<string>[] = [];
  for (const [type, n] of Object.entries(counts) as [StickerType, number][]) {
    const qty = Math.max(0, Math.floor(n ?? 0));
    for (let i = 0; i < qty; i++) {
      if (target.mode === "individual") {
        ops.push(giveIndividualSticker(roomCode, target.studentClientId, type, teacherName, teacherClientId, options));
      } else {
        ops.push(giveTeamSticker(roomCode, target.contributorClientId, type, teacherName, teacherClientId, options));
      }
    }
  }
  await Promise.all(ops);
  return ops.length;
}

// === Remove ===

export async function removeIndividualSticker(
  roomCode: string,
  studentClientId: string,
  stickerId: string,
): Promise<void> {
  const db = getClientDb();
  await remove(ref(db, `${basePath(roomCode)}/individual/${studentClientId}/${stickerId}`));
}

export async function removeTeamSticker(roomCode: string, stickerId: string): Promise<void> {
  const db = getClientDb();
  await remove(ref(db, `${basePath(roomCode)}/team/${stickerId}`));
}

// === Subscriptions ===

export function subscribeStudentStickers(
  roomCode: string,
  studentClientId: string,
  cb: (list: IndividualSticker[]) => void,
): () => void {
  const db = getClientDb();
  const listRef = ref(db, `${basePath(roomCode)}/individual/${studentClientId}`);
  const unsub = onValue(listRef, (snap) => {
    const raw = snap.val();
    const list = entriesOf<IndividualSticker>(raw)
      .map(([, v]) => v)
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    cb(list);
  });
  return () => { off(listRef); void unsub; };
}

export function subscribeTeamStickers(
  roomCode: string,
  cb: (list: TeamSticker[]) => void,
): () => void {
  const db = getClientDb();
  const listRef = ref(db, `${basePath(roomCode)}/team`);
  const unsub = onValue(listRef, (snap) => {
    const raw = snap.val();
    const list = entriesOf<TeamSticker>(raw)
      .map(([, v]) => v)
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    cb(list);
  });
  return () => { off(listRef); void unsub; };
}

// Counts: returns map keyed by clientId → count. Updates on any individual change.
export function subscribeAllStudentCounts(
  roomCode: string,
  cb: (counts: Record<string, number>) => void,
): () => void {
  const db = getClientDb();
  const indRef = ref(db, `${basePath(roomCode)}/individual`);
  const unsub = onValue(indRef, (snap) => {
    const raw = snap.val();
    const counts: Record<string, number> = {};
    for (const [clientId, perStudent] of entriesOf<unknown>(raw)) {
      counts[clientId] = entriesOf<IndividualSticker>(perStudent).length;
    }
    cb(counts);
  });
  return () => { off(indRef); void unsub; };
}

// === Goal ===

export function subscribeGoal(
  roomCode: string,
  cb: (goal: StickerGoal | null) => void,
): () => void {
  const db = getClientDb();
  const goalRef = ref(db, `${basePath(roomCode)}/goal`);
  const unsub = onValue(goalRef, (snap) => {
    const val = snap.val() as StickerGoal | null;
    cb(val ?? null);
  });
  return () => { off(goalRef); void unsub; };
}

// Writes .target, preserves seasonStart (creates seasonStart if missing).
export async function setGoalTarget(roomCode: string, target: number): Promise<void> {
  const db = getClientDb();
  const goalRef = ref(db, `${basePath(roomCode)}/goal`);
  // update() merges fields; if seasonStart already exists it is untouched.
  // We also defensively initialize seasonStart only if it does not yet exist
  // by reading once via onValue.
  await new Promise<void>((resolve, reject) => {
    const unsub = onValue(
      goalRef,
      async (snap) => {
        try {
          off(goalRef);
          void unsub;
          const existing = snap.val() as StickerGoal | null;
          const patch: Partial<StickerGoal> = { target };
          if (!existing || typeof existing.seasonStart !== "number") {
            patch.seasonStart = Date.now();
          }
          await update(goalRef, patch);
          resolve();
        } catch (e) {
          reject(e);
        }
      },
      (err) => reject(err),
      { onlyOnce: true },
    );
  });
}

// === Cosmetics ===

export function subscribeCosmetics(
  roomCode: string,
  studentClientId: string,
  cb: (c: StudentCosmetics) => void,
): () => void {
  const db = getClientDb();
  const cosRef = ref(db, `${basePath(roomCode)}/cosmetics/${studentClientId}`);
  const unsub = onValue(cosRef, (snap) => {
    const val = snap.val() as Partial<StudentCosmetics> | null;
    const c: StudentCosmetics = {
      skin: (val?.skin as StudentCosmetics["skin"]) ?? "classic",
      hat: (val?.hat as StudentCosmetics["hat"]) ?? null,
      pet: (val?.pet as StudentCosmetics["pet"]) ?? null,
      trophy: (val?.trophy as StudentCosmetics["trophy"]) ?? null,
    };
    cb(c);
  });
  return () => { off(cosRef); void unsub; };
}

export async function setCosmetics(
  roomCode: string,
  studentClientId: string,
  c: StudentCosmetics,
): Promise<void> {
  const db = getClientDb();
  await set(ref(db, `${basePath(roomCode)}/cosmetics/${studentClientId}`), c);
}

// === Season reset ===
// Clears individual/* and team/*, sets goal.seasonStart = Date.now().
// KEEP goal.target. Does NOT touch cosmetics.
export async function resetSeason(roomCode: string): Promise<void> {
  const db = getClientDb();
  const root = basePath(roomCode);
  const goalRef = ref(db, `${root}/goal`);

  // Read existing goal to preserve target
  const existingTarget: number = await new Promise<number>((resolve, reject) => {
    const unsub = onValue(
      goalRef,
      (snap) => {
        off(goalRef);
        void unsub;
        const val = snap.val() as StickerGoal | null;
        resolve(typeof val?.target === "number" ? val.target : 0);
      },
      (err) => reject(err),
      { onlyOnce: true },
    );
  });

  // Clear individual/* and team/* and reset goal in one batch
  await update(ref(db, root), {
    individual: null,
    team: null,
    goal: {
      target: existingTarget,
      seasonStart: Date.now(),
    },
  });
}

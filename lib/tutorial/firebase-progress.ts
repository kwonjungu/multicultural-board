"use client";

import { ref, get, set, serverTimestamp } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import type { TutorialSectionId } from "./types";

/**
 * Firebase-backed completion tracking for *mandatory* tutorials (currently only
 * the main hub intro). Keyed by (roomCode, studentName) so the record follows
 * the user across devices — once they've watched it on tablet A, they won't
 * see it again on tablet B.
 *
 * Path: tutorialProgress/{roomCode}/{sanitizedName}/{sectionId} = serverTimestamp
 *
 * Non-mandatory section captions remain localStorage-only.
 */

function sanitizeKey(name: string): string {
  // Firebase keys can't contain . # $ [ ] /
  return name.replace(/[.#$\[\]\/]/g, "_").trim() || "anon";
}

function path(roomCode: string, name: string, sectionId: TutorialSectionId): string {
  return `tutorialProgress/${roomCode}/${sanitizeKey(name)}/${sectionId}`;
}

export async function hasCompletedRemote(
  roomCode: string,
  name: string,
  sectionId: TutorialSectionId,
): Promise<boolean> {
  try {
    const snap = await get(ref(getClientDb(), path(roomCode, name, sectionId)));
    return snap.exists();
  } catch {
    // Network / rules error → treat as "not completed" so tutorial shows.
    // Safer default: mandatory content runs when in doubt.
    return false;
  }
}

export async function markCompletedRemote(
  roomCode: string,
  name: string,
  sectionId: TutorialSectionId,
): Promise<void> {
  try {
    await set(ref(getClientDb(), path(roomCode, name, sectionId)), serverTimestamp());
  } catch {
    /* swallow — localStorage fallback still has the record */
  }
}

"use client";

import type { TutorialProgress, TutorialSectionId } from "./types";

const KEY = "honey.tutorial.progress.v1";

export function loadProgress(): TutorialProgress {
  if (typeof window === "undefined") return { completed: [], skippedGlobally: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { completed: [], skippedGlobally: false };
    const p = JSON.parse(raw) as TutorialProgress;
    return {
      completed: Array.isArray(p.completed) ? p.completed : [],
      skippedGlobally: !!p.skippedGlobally,
    };
  } catch {
    return { completed: [], skippedGlobally: false };
  }
}

export function saveProgress(p: TutorialProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full / private mode — silently ignore */
  }
}

export function markCompleted(id: TutorialSectionId): TutorialProgress {
  const p = loadProgress();
  if (!p.completed.includes(id)) p.completed.push(id);
  saveProgress(p);
  return p;
}

export function markSkippedGlobally(): TutorialProgress {
  const p = loadProgress();
  p.skippedGlobally = true;
  saveProgress(p);
  return p;
}

export function resetProgress(): TutorialProgress {
  const p: TutorialProgress = { completed: [], skippedGlobally: false };
  saveProgress(p);
  return p;
}

export function isCompleted(id: TutorialSectionId): boolean {
  return loadProgress().completed.includes(id);
}

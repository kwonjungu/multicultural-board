"use client";

/**
 * Lightweight event bus for tutorial waitFor:custom hooks.
 *
 * Callers emit a named event (e.g. "post-submitted") from app code when a
 * sandbox action completes. The TutorialHost subscribes to the current step's
 * waitFor id and advances when fired.
 */

type Listener = (payload?: unknown) => void;

const listeners = new Map<string, Set<Listener>>();

export const TutorialBus = {
  on(id: string, fn: Listener): () => void {
    let set = listeners.get(id);
    if (!set) { set = new Set(); listeners.set(id, set); }
    set.add(fn);
    return () => set!.delete(fn);
  },
  emit(id: string, payload?: unknown): void {
    const set = listeners.get(id);
    if (!set) return;
    set.forEach((fn) => fn(payload));
  },
};

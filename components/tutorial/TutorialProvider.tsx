"use client";

import { createContext, useContext, useMemo, useRef, useState, useCallback } from "react";
import TutorialHost from "./TutorialHost";
import { markSkippedGlobally, loadProgress, isCompleted } from "@/lib/tutorial/progress";
import type { TutorialScenario, TutorialSectionId } from "@/lib/tutorial/types";

interface Ctx {
  start: (scenario: TutorialScenario) => void;
  stop: () => void;
  startIfNotCompleted: (scenario: TutorialScenario) => void;
  running: boolean;
  activeId: TutorialSectionId | null;
}

const TutorialContext = createContext<Ctx | null>(null);

/**
 * Wrap the app root with this. Any child can call useTutorial().start(scenario)
 * to launch a scenario. Only one scenario runs at a time; starting a new one
 * pre-empts the prior.
 */
export function TutorialProvider({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  const [active, setActive] = useState<TutorialScenario | null>(null);
  const triggerOnceRef = useRef<Set<TutorialSectionId>>(new Set());

  const start = useCallback((scenario: TutorialScenario) => {
    setActive(scenario);
  }, []);
  const stop = useCallback(() => setActive(null), []);

  const startIfNotCompleted = useCallback((scenario: TutorialScenario) => {
    if (triggerOnceRef.current.has(scenario.id)) return;
    triggerOnceRef.current.add(scenario.id);
    const progress = loadProgress();
    if (progress.skippedGlobally) return;
    if (isCompleted(scenario.id)) return;
    setActive(scenario);
  }, []);

  const ctx = useMemo<Ctx>(() => ({
    start, stop, startIfNotCompleted,
    running: !!active,
    activeId: active?.id ?? null,
  }), [start, stop, startIfNotCompleted, active]);

  return (
    <TutorialContext.Provider value={ctx}>
      {children}
      {active && (
        <TutorialHost
          scenario={active}
          muted={muted}
          onExit={(reason) => {
            if (reason === "skipped" && !isCompleted(active.id)) {
              markSkippedGlobally();
            }
            setActive(null);
          }}
        />
      )}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): Ctx {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used inside <TutorialProvider>");
  return ctx;
}

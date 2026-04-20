"use client";

import { createContext, useContext, useMemo, useRef, useState, useCallback } from "react";
import TutorialHost from "./TutorialHost";
import { markSkippedGlobally, loadProgress, isCompleted, markCompleted } from "@/lib/tutorial/progress";
import { hasCompletedRemote } from "@/lib/tutorial/firebase-progress";
import type { TutorialScenario, TutorialSectionId } from "@/lib/tutorial/types";

interface Ctx {
  start: (scenario: TutorialScenario) => void;
  stop: () => void;
  /**
   * Launch the scenario if the user hasn't already completed it. For
   * mandatory scenarios, Firebase is consulted as the source of truth.
   */
  startIfNotCompleted: (scenario: TutorialScenario) => Promise<void>;
  running: boolean;
  activeId: TutorialSectionId | null;
}

const TutorialContext = createContext<Ctx | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  muted?: boolean;
  /** Provide these so mandatory tutorials can be tracked across devices. */
  roomCode?: string;
  userName?: string;
}

/**
 * Wrap a screen with this. Any child can call useTutorial().start(scenario)
 * to launch a scenario. Only one scenario runs at a time; starting a new one
 * pre-empts the prior.
 */
export function TutorialProvider({ children, muted = false, roomCode, userName }: ProviderProps) {
  const [active, setActive] = useState<TutorialScenario | null>(null);
  const triggerOnceRef = useRef<Set<TutorialSectionId>>(new Set());

  const start = useCallback((scenario: TutorialScenario) => {
    setActive(scenario);
  }, []);
  const stop = useCallback(() => setActive(null), []);

  const startIfNotCompleted = useCallback(async (scenario: TutorialScenario) => {
    if (triggerOnceRef.current.has(scenario.id)) return;
    triggerOnceRef.current.add(scenario.id);
    const progress = loadProgress();
    // skippedGlobally only suppresses optional tutorials; mandatory always considers Firebase
    if (!scenario.mandatory && progress.skippedGlobally) return;
    if (isCompleted(scenario.id)) return;
    if (scenario.mandatory && roomCode && userName) {
      const done = await hasCompletedRemote(roomCode, userName, scenario.id);
      if (done) {
        // Sync local cache so next call is fast
        markCompleted(scenario.id);
        return;
      }
    }
    setActive(scenario);
  }, [roomCode, userName]);

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
          roomCode={roomCode}
          userName={userName}
          onExit={(reason) => {
            if (reason === "skipped" && !isCompleted(active.id) && !active.mandatory) {
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

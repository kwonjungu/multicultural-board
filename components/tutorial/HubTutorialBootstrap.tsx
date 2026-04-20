"use client";

import { useEffect, useMemo } from "react";
import { useTutorial } from "./TutorialProvider";
import { getMainHubScenario } from "@/lib/tutorial/scenarios/main";

interface Props {
  isTeacher: boolean;
}

/**
 * Mount this inside the hub view. On first mount (once per session) it
 * launches the main-hub scenario appropriate for the user's role.
 * Teachers and students see separate content & tone.
 *
 * Also renders a small "?" button for manual re-run.
 */
export default function HubTutorialBootstrap({ isTeacher }: Props) {
  const { startIfNotCompleted, start, running } = useTutorial();
  const scenario = useMemo(() => getMainHubScenario(isTeacher), [isTeacher]);

  useEffect(() => {
    // Delay slightly so HomeHub has painted → selectors resolve
    const id = window.setTimeout(() => {
      void startIfNotCompleted(scenario);
    }, 400);
    return () => window.clearTimeout(id);
  }, [startIfNotCompleted, scenario]);

  if (running) return null;

  return (
    <button
      onClick={() => start(scenario)}
      aria-label="튜토리얼 다시 보기"
      style={{
        position: "fixed", bottom: 20, right: 20,
        width: 52, height: 52, borderRadius: "50%",
        background: "#F59E0B", color: "#fff",
        border: "4px solid #fff",
        fontSize: 22, fontWeight: 900,
        cursor: "pointer",
        boxShadow: "0 10px 24px rgba(180,83,9,0.35)",
        zIndex: 50,
      }}
    >
      ?
    </button>
  );
}

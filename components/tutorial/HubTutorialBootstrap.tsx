"use client";

import { useEffect } from "react";
import { useTutorial } from "./TutorialProvider";
import { mainHubScenario } from "@/lib/tutorial/scenarios/main";

/**
 * Mount this inside the hub view. On first mount (once per session) it
 * launches the main-hub scenario if the user hasn't completed/skipped it.
 *
 * Also renders a small "?" button for manual re-run.
 */
export default function HubTutorialBootstrap() {
  const { startIfNotCompleted, start, running } = useTutorial();

  useEffect(() => {
    // Delay slightly so HomeHub has painted → selectors resolve
    const id = window.setTimeout(() => startIfNotCompleted(mainHubScenario), 400);
    return () => window.clearTimeout(id);
  }, [startIfNotCompleted]);

  if (running) return null;

  return (
    <button
      onClick={() => start(mainHubScenario)}
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

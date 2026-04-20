"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BeeGuide, { type BeeExpression, type BeePosition } from "./BeeGuide";
import DialogueBox from "./DialogueBox";
import Spotlight from "./Spotlight";
import { TutorialBus } from "@/lib/tutorial/bus";
import { markCompleted } from "@/lib/tutorial/progress";
import type {
  AnchorSpec,
  DialogueLine,
  TutorialScenario,
  TutorialStep,
  WaitCondition,
} from "@/lib/tutorial/types";

interface Props {
  scenario: TutorialScenario;
  speakerName?: string;
  muted?: boolean;
  onExit: (reason: "completed" | "skipped") => void;
}

/**
 * Runs a tutorial scenario end-to-end: drives BeeGuide position/expression,
 * renders spotlight + dialogue, and listens for user actions that satisfy
 * each step's waitFor condition.
 */
export default function TutorialHost({
  scenario,
  speakerName = "꿀벌 선생님",
  muted = false,
  onExit,
}: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [dialogueDone, setDialogueDone] = useState(false);
  const [activeExpression, setActiveExpression] = useState<BeeExpression>("welcome");
  const [reward, setReward] = useState<{ emoji: string; label: string } | null>(null);
  const [wrongMsg, setWrongMsg] = useState<string | null>(null);
  const step = scenario.steps[stepIdx] as TutorialStep | undefined;
  const unmountedRef = useRef(false);

  useEffect(() => () => { unmountedRef.current = true; }, []);

  // Reset per-step state
  useEffect(() => {
    setDialogueDone(false);
    setWrongMsg(null);
    if (step) setActiveExpression(pickExpression(step));
  }, [stepIdx, step]);

  // Wire waitFor conditions
  useEffect(() => {
    if (!step) return;
    const wait = getWaitCondition(step);
    if (!wait) return;
    // Don't arm the wait condition until any dialogue has finished typing
    if (!dialogueDone && step.kind === "highlight") return;

    const cleanup = armWait(wait, {
      onMatch: advance,
      onMismatch: (ev) => {
        if (step.kind === "await" && step.onWrong) {
          setActiveExpression(step.onWrong.expression ?? "oops");
          setWrongMsg(step.onWrong.say);
          window.setTimeout(() => {
            if (!unmountedRef.current) {
              setWrongMsg(null);
              setActiveExpression(pickExpression(step));
            }
          }, 1800);
        }
      },
    });
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, dialogueDone]);

  // Auto-advance speak steps once the last line is read
  useEffect(() => {
    if (!step) return;
    if (step.kind === "speak" && dialogueDone) advance();
    if (step.kind === "highlight" && dialogueDone && !step.waitFor) advance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogueDone]);

  // Celebrate reward
  useEffect(() => {
    if (!step || step.kind !== "celebrate") return;
    setReward(step.reward ?? null);
  }, [step]);

  function advance() {
    if (unmountedRef.current) return;
    if (stepIdx >= scenario.steps.length - 1) {
      markCompleted(scenario.id);
      onExit("completed");
      return;
    }
    setStepIdx((i) => i + 1);
  }

  function onLineChange(_i: number, line: DialogueLine) {
    if (line.expression) setActiveExpression(line.expression);
  }

  // Derive BeeGuide position from step
  const position: BeePosition = useMemo(() => {
    if (!step) return { kind: "fixed", x: "50%", y: "50%" };
    if (step.kind === "highlight" || step.kind === "await") {
      return { kind: "follow", selector: step.target, side: step.side ?? "right", gap: 28 };
    }
    if (step.kind === "speak") return positionFromAnchor(step.anchor);
    // celebrate → center stage
    return { kind: "fixed", x: "50%", y: "45%" };
  }, [step]);

  if (!step) return null;

  const lines = getLines(step);
  const particles: "sparkle" | "hearts" | "confetti" | null =
    step.kind === "celebrate" ? "confetti"
    : step.kind === "speak" ? (step.particles ?? null)
    : null;

  const showSpotlight = step.kind === "highlight" || step.kind === "await";

  return (
    <>
      {/* Skip button — always available */}
      <button
        onClick={() => onExit("skipped")}
        style={{
          position: "fixed", top: 16, right: 16, zIndex: 10001,
          background: "rgba(255,255,255,0.9)",
          border: "2px solid #FDE68A",
          borderRadius: 999, padding: "8px 16px",
          fontSize: 13, fontWeight: 800, color: "#92400E",
          cursor: "pointer",
          boxShadow: "0 6px 16px rgba(180,83,9,0.2)",
        }}
      >
        튜토리얼 건너뛰기
      </button>

      {/* Spotlight overlay for highlight/await steps */}
      {showSpotlight && <Spotlight selector={(step as any).target} />}

      {/* Bee mascot */}
      <BeeGuide
        expression={activeExpression}
        position={position}
        size={130}
        particles={particles}
      />

      {/* Floating hint (await steps) */}
      {step.kind === "await" && step.hint && (
        <HintLabel selector={step.target}>{step.hint}</HintLabel>
      )}

      {/* Wrong-action toast */}
      {wrongMsg && (
        <div
          style={{
            position: "fixed", top: "22%", left: "50%",
            transform: "translateX(-50%)",
            background: "#FEE2E2", color: "#991B1B",
            padding: "10px 18px", borderRadius: 999,
            border: "2px solid #FCA5A5",
            fontWeight: 800, fontSize: 14,
            zIndex: 10002,
            boxShadow: "0 8px 22px rgba(185,28,28,0.2)",
          }}
        >
          {wrongMsg}
        </div>
      )}

      {/* Dialogue */}
      {lines.length > 0 && (
        <DialogueBox
          key={stepIdx}                    // remount per step for clean typewriter
          lines={lines}
          speakerName={speakerName}
          muted={muted}
          onLineChange={onLineChange}
          onDone={() => setDialogueDone(true)}
        />
      )}

      {/* Reward popup */}
      {step.kind === "celebrate" && reward && (
        <div
          style={{
            position: "fixed", top: "30%", left: "50%",
            transform: "translateX(-50%)",
            background: "#fff", border: "4px solid #F59E0B",
            borderRadius: 20, padding: "18px 28px",
            textAlign: "center", zIndex: 10002,
            boxShadow: "0 20px 50px rgba(180,83,9,0.35)",
            animation: "fadeSlideIn 500ms ease-out both",
          }}
        >
          <div style={{ fontSize: 56, lineHeight: 1 }}>{reward.emoji}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#92400E", marginTop: 6 }}>
            {reward.label}
          </div>
        </div>
      )}
    </>
  );
}

// --- helpers ---

function pickExpression(step: TutorialStep): BeeExpression {
  if (step.kind === "speak")      return step.expression ?? "welcome";
  if (step.kind === "highlight")  return step.expression ?? "cheer";
  if (step.kind === "await")      return step.expression ?? "think";
  return "celebrate";
}

function getLines(step: TutorialStep): DialogueLine[] {
  if (step.kind === "speak" || step.kind === "highlight" || step.kind === "celebrate")
    return step.lines;
  return [];
}

function getWaitCondition(step: TutorialStep): WaitCondition | null {
  if (step.kind === "await") return step.waitFor;
  if (step.kind === "highlight" && step.waitFor) return step.waitFor;
  return null;
}

function positionFromAnchor(anchor: AnchorSpec | undefined): BeePosition {
  if (!anchor) return { kind: "fixed", x: "50%", y: "50%" };
  if (anchor.selector) {
    return { kind: "follow", selector: anchor.selector, side: anchor.side ?? "right", gap: 28 };
  }
  const corner = anchor.corner ?? "center";
  if (corner === "top-left")     return { kind: "fixed", x: "10%", y: "15%" };
  if (corner === "top-right")    return { kind: "fixed", x: "90%", y: "15%" };
  if (corner === "bottom-left")  return { kind: "fixed", x: "10%", y: "80%" };
  if (corner === "bottom-right") return { kind: "fixed", x: "90%", y: "80%" };
  return { kind: "fixed", x: "50%", y: "50%" };
}

/**
 * Wire up a WaitCondition to DOM events. Returns a cleanup fn.
 * `onMatch` fires when the correct action occurred. `onMismatch` fires when a
 * plausibly-wrong action happens (currently only: global click that missed).
 */
function armWait(
  wait: WaitCondition,
  handlers: { onMatch: () => void; onMismatch?: (ev: Event) => void },
): () => void {
  if (wait.event === "click") {
    const onClick = (e: Event) => {
      const tgt = document.querySelector(wait.target);
      if (tgt && (e.target === tgt || tgt.contains(e.target as Node))) {
        handlers.onMatch();
      } else {
        handlers.onMismatch?.(e);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }
  if (wait.event === "input") {
    const min = wait.minLength ?? 1;
    const onInput = (e: Event) => {
      const tgt = document.querySelector(wait.target) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!tgt) return;
      if (e.target !== tgt) return;
      if ((tgt.value || "").length >= min) handlers.onMatch();
    };
    document.addEventListener("input", onInput, true);
    return () => document.removeEventListener("input", onInput, true);
  }
  if (wait.event === "submit") {
    const onSubmit = (e: Event) => {
      const tgt = document.querySelector(wait.target);
      if (tgt && (e.target === tgt || tgt.contains(e.target as Node))) handlers.onMatch();
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }
  // custom event via TutorialBus
  return TutorialBus.on(wait.id, () => handlers.onMatch());
}

function HintLabel({ selector, children }: { selector: string; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    function update() {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top - 10 });
    }
    update();
    const iv = window.setInterval(update, 200);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selector]);
  if (!pos) return null;
  return (
    <div
      style={{
        position: "fixed", left: pos.x, top: pos.y,
        transform: "translate(-50%, -100%)",
        background: "#F59E0B", color: "#fff",
        padding: "6px 12px", borderRadius: 999,
        fontSize: 13, fontWeight: 800,
        boxShadow: "0 6px 16px rgba(180,83,9,0.3)",
        zIndex: 9993, pointerEvents: "none",
        animation: "fadeSlideIn 500ms ease-in-out infinite alternate",
      }}
    >
      {children}
    </div>
  );
}

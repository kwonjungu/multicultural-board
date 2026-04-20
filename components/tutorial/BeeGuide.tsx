"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { beePng } from "@/lib/assets";

export type BeeExpression =
  | "welcome" | "cheer" | "think" | "oops" | "sleep"
  | "celebrate" | "loading" | "shh" | "student" | "teacher";

export type BeeParticles = "sparkle" | "hearts" | "confetti" | null;

type Anchor = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type BeePosition =
  | { kind: "fixed"; x: number | string; y: number | string; anchor?: Anchor }
  | { kind: "follow"; selector: string; side?: "left" | "right" | "top" | "bottom"; gap?: number };

interface Props {
  expression?: BeeExpression;
  position: BeePosition;
  size?: number;
  particles?: BeeParticles;
  visible?: boolean;
  flipX?: boolean;
  zIndex?: number;
}

interface Coords { left: number; top: number; flipToRight: boolean; }

function computeFollowCoords(
  selector: string,
  side: "left" | "right" | "top" | "bottom",
  gap: number,
  size: number,
): Coords | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = (el as HTMLElement).getBoundingClientRect();
  let left = 0, top = 0, flipToRight = false;
  switch (side) {
    case "right":
      left = r.right + gap;
      top = r.top + r.height / 2 - size / 2;
      flipToRight = false;
      break;
    case "left":
      left = r.left - gap - size;
      top = r.top + r.height / 2 - size / 2;
      flipToRight = true;
      break;
    case "top":
      left = r.left + r.width / 2 - size / 2;
      top = r.top - gap - size;
      flipToRight = false;
      break;
    case "bottom":
      left = r.left + r.width / 2 - size / 2;
      top = r.bottom + gap;
      flipToRight = false;
      break;
  }
  // Clamp to viewport so the bee never flies offscreen
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  left = Math.max(8, Math.min(left, vw - size - 8));
  top = Math.max(8, Math.min(top, vh - size - 8));
  return { left, top, flipToRight };
}

/**
 * Animal-crossing style mascot overlay. Flies between targets with
 * spring-ish easing, reacts to expression changes with a squash-stretch
 * bounce, and optionally emits particles.
 */
export default function BeeGuide({
  expression = "welcome",
  position,
  size = 120,
  particles = null,
  visible = true,
  flipX,
  zIndex = 9998,
}: Props) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [popKey, setPopKey] = useState(0);   // re-keys on expression change → squash-stretch
  const [mounted, setMounted] = useState(false);
  const expressionRef = useRef(expression);

  // Mount entrance
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Expression change → bounce
  useEffect(() => {
    if (expressionRef.current !== expression) {
      expressionRef.current = expression;
      setPopKey((k) => k + 1);
    }
  }, [expression]);

  // Position resolution (fixed or follow-target)
  useLayoutEffect(() => {
    if (!visible) return;
    if (position.kind === "fixed") {
      // Convert percent/number to absolute px relative to viewport
      const x = typeof position.x === "number" ? position.x : resolvePct(position.x, window.innerWidth);
      const y = typeof position.y === "number" ? position.y : resolvePct(position.y, window.innerHeight);
      const anchor = position.anchor ?? "center";
      let left = x, top = y;
      if (anchor === "center") { left = x - size / 2; top = y - size / 2; }
      if (anchor === "top-right" || anchor === "bottom-right") left = x - size;
      if (anchor === "bottom-left" || anchor === "bottom-right") top = y - size;
      setCoords({ left, top, flipToRight: false });
      return;
    }
    // follow
    const update = () => {
      const c = computeFollowCoords(
        position.selector,
        position.side ?? "right",
        position.gap ?? 24,
        size,
      );
      if (c) setCoords(c);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    // poll for layout shifts (images loading, etc.)
    const iv = window.setInterval(update, 500);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(iv);
    };
  }, [position, size, visible]);

  if (!visible || !coords) return null;

  const effectiveFlipX = flipX ?? coords.flipToRight;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: coords.left,
        top: coords.top,
        width: size,
        height: size,
        zIndex,
        pointerEvents: "none",
        // spring-ish easing for cross-screen flight
        transition: "left 620ms cubic-bezier(0.34, 1.56, 0.64, 1), top 620ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 320ms ease",
        transform: `scale(${mounted ? 1 : 0.3})`,
        willChange: "left, top, transform",
      }}
    >
      {/* Idle float + expression bounce */}
      <div
        key={popKey}
        style={{
          width: "100%", height: "100%",
          animation: `beeGuideIdle ${idleSpeed(expression)}s ease-in-out infinite, beeGuidePop 380ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
          transformOrigin: "50% 70%",
        }}
      >
        {/* Character sprite */}
        <img
          src={beePng(expression)}
          alt=""
          width={size}
          height={size}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            transform: effectiveFlipX ? "scaleX(-1)" : undefined,
            filter: expressionFilter(expression),
          }}
          draggable={false}
        />
        {/* Expression badge (tiny emoji floating beside head) */}
        <ExpressionHint expression={expression} size={size} />
      </div>
      {/* Particles */}
      {particles && <ParticleBurst kind={particles} size={size} key={`p-${popKey}-${particles}`} />}
    </div>
  );
}

function resolvePct(v: string, total: number): number {
  const m = /^(-?\d+(?:\.\d+)?)(%|px)?$/.exec(v.trim());
  if (!m) return 0;
  const num = parseFloat(m[1]);
  return m[2] === "%" ? (num / 100) * total : num;
}

function idleSpeed(e: BeeExpression): number {
  switch (e) {
    case "celebrate":
    case "cheer":
      return 1.4;     // faster, bouncier
    case "sleep":
      return 4.2;     // slow
    case "loading":
      return 2.0;
    default:
      return 2.8;
  }
}

function expressionFilter(e: BeeExpression): string | undefined {
  const base = "drop-shadow(0 8px 18px rgba(245,158,11,0.4))";
  switch (e) {
    case "celebrate":
      return `${base} drop-shadow(0 0 12px rgba(251,191,36,0.6))`;
    case "oops":
      return `${base} saturate(0.85)`;
    case "sleep":
      return `${base} brightness(0.95)`;
    default:
      return base;
  }
}

function ExpressionHint({ expression, size }: { expression: BeeExpression; size: number }) {
  const hint = hintFor(expression);
  if (!hint) return null;
  return (
    <span
      style={{
        position: "absolute",
        top: -size * 0.08,
        right: -size * 0.05,
        fontSize: size * 0.3,
        lineHeight: 1,
        animation: "beeGuideHintPop 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        textShadow: "0 2px 6px rgba(0,0,0,0.25)",
      }}
    >
      {hint}
    </span>
  );
}

function hintFor(e: BeeExpression): string | null {
  switch (e) {
    case "think":   return "❓";
    case "oops":    return "❗";
    case "celebrate": return "🎉";
    case "cheer":   return "✨";
    case "sleep":   return "💤";
    case "loading": return "⏳";
    case "shh":     return "🤫";
    default:        return null;
  }
}

function ParticleBurst({ kind, size }: { kind: BeeParticles; size: number }) {
  if (!kind) return null;
  const emoji =
    kind === "hearts"   ? ["💛", "🧡", "💖"] :
    kind === "confetti" ? ["🎊", "🌸", "⭐", "🍯"] :
                          ["✨", "⭐", "💫"];
  const count = 10;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const dist = size * (0.9 + Math.random() * 0.5);
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - size * 0.2; // bias upward
        const delay = Math.random() * 120;
        const em = emoji[i % emoji.length];
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              fontSize: size * 0.22,
              pointerEvents: "none",
              animation: `beeGuideParticle 900ms cubic-bezier(0.22, 0.61, 0.36, 1) both`,
              animationDelay: `${delay}ms`,
              ["--dx" as any]: `${dx}px`,
              ["--dy" as any]: `${dy}px`,
            }}
          >
            {em}
          </span>
        );
      })}
    </>
  );
}

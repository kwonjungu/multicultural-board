"use client";

import { useEffect, useState } from "react";

interface Rect { left: number; top: number; width: number; height: number; }

/**
 * Dim the whole viewport except for a rectangle cut out around the target.
 * Uses SVG mask so the spotlight hole has rounded corners and crisp edges
 * at any size without relying on box-shadow tricks.
 */
export default function Spotlight({ selector, padding = 10 }: { selector: string; padding?: number }) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    function measure() {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({
        left: r.left - padding,
        top: r.top - padding,
        width: r.width + padding * 2,
        height: r.height + padding * 2,
      });
    }
    measure();
    const iv = window.setInterval(measure, 200);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector, padding]);

  return (
    <>
      {/* Backdrop dimmer with hole */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: "fixed", inset: 0, zIndex: 9990,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <defs>
          <mask id="tutorial-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx={18}
                ry={18}
                fill="black"
                style={{ transition: "all 320ms cubic-bezier(0.22, 0.61, 0.36, 1)" }}
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(17, 24, 39, 0.55)"
          mask="url(#tutorial-spotlight-mask)"
        />
      </svg>

      {/* Pulsing border ring around the target */}
      {rect && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            borderRadius: 18,
            zIndex: 9991,
            pointerEvents: "none",
            transition: "all 320ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            animation: "tutorialTargetPulse 1.4s ease-in-out infinite",
          }}
        />
      )}
    </>
  );
}

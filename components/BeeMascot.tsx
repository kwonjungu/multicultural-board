"use client";

import { CSSProperties } from "react";
import { beePng } from "@/lib/assets";

export type Mood =
  | "happy" | "cheer" | "think" | "wave" | "sleep"
  | "welcome" | "loading" | "success" | "oops" | "confused" | "celebrate" | "shh"
  | "student" | "teacher";

type BeeKey =
  | "welcome" | "cheer" | "think" | "oops"
  | "sleep" | "celebrate" | "loading" | "shh"
  | "student" | "teacher";

function mapMood(mood: Mood): BeeKey {
  switch (mood) {
    case "happy":
    case "welcome":
    case "wave":
      return "welcome";
    case "cheer":
      return "cheer";
    case "think":
    case "confused":
      return "think";
    case "sleep":
      return "sleep";
    case "loading":
      return "loading";
    case "success":
    case "celebrate":
      return "celebrate";
    case "oops":
      return "oops";
    case "shh":
      return "shh";
    case "student":
      return "student";
    case "teacher":
      return "teacher";
  }
}

export default function BeeMascot({
  size = 96,
  mood = "happy",
  flying = true,
  style,
}: {
  size?: number;
  mood?: Mood;
  flying?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        animation: flying ? "heroBeeFloat 2.8s ease-in-out infinite" : undefined,
        ...style,
      }}
      aria-hidden="true"
    >
      <img
        src={beePng(mapMood(mood))}
        alt=""
        width={size}
        height={size}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          filter: "drop-shadow(0 6px 16px rgba(245,158,11,0.35))",
        }}
      />
    </span>
  );
}

// HoneyYut — board graph + stick probability + corner greetings.
//
// Node layout (29 total)
// ---------------------------------------------------------------
//   Outer ring: 0..19, clockwise. idx 0 = start/goal (east corner).
//     Corners at 0 (east), 5 (south), 10 (west), 15 (north).
//   Shortcut spurs from corners toward the center node 23:
//     5  -> 21 -> 22 -> 23
//     10 -> 24 -> 23
//     from center (23) toward goal (0):
//       23 -> 25 -> 26 -> 17   (via northeast)
//       23 -> 27 -> 28 -> 17   (via southeast — alt path)
//
// Movement:
//   - Normal outer step: nextMain(n) = (n+1) % 20.
//   - On a branch tile (5, 10, 23) the player is offered a choice (the UI
//     surfaces `branches[n]` which lists ALL forward neighbours, including
//     the outer-ring option so "straight" is always available).
//
// Coordinates are in a unit square [0..1000] used by the SVG viewBox.
// ---------------------------------------------------------------

import type { LangMap, Throw } from "./yutTypes";

export interface YutNode {
  idx: number;
  x: number;          // 0..1000
  y: number;          // 0..1000
  kind: "corner" | "edge" | "shortcut" | "center" | "start";
  // True for idx 0, 5, 10, 15 (corners) — used for culture card trigger.
  cornerRegion: "east" | "south" | "west" | "north" | null;
}

// Helper: build a 5-step edge between two corner nodes (exclusive of start,
// inclusive of end) given the corner's (x,y) and next corner's (x,y).
function buildEdge(
  from: { x: number; y: number },
  to: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let s = 1; s <= 5; s += 1) {
    pts.push({
      x: from.x + ((to.x - from.x) * s) / 5,
      y: from.y + ((to.y - from.y) * s) / 5,
    });
  }
  return pts;
}

const PAD = 110;
const MAX = 1000 - PAD;

// Corners (clockwise from east start). A square board oriented so the
// "start/goal" sits at the top-right corner, matching the traditional
// Korean yut layout.
const cornerEast  = { x: MAX, y: PAD };   // idx 0 (start / goal)
const cornerSouth = { x: MAX, y: MAX };   // idx 5
const cornerWest  = { x: PAD, y: MAX };   // idx 10
const cornerNorth = { x: PAD, y: PAD };   // idx 15

// Build outer ring 0..19.
const outer: Array<{ x: number; y: number }> = [];
outer.push(cornerEast);                           // 0
outer.push(...buildEdge(cornerEast,  cornerSouth)); // 1..5
outer.push(...buildEdge(cornerSouth, cornerWest));  // 6..10
outer.push(...buildEdge(cornerWest,  cornerNorth)); // 11..15
outer.push(...buildEdge(cornerNorth, cornerEast));  // 16..20
// buildEdge returns the endpoint, so idx 20 == cornerEast == idx 0. Trim it.
outer.length = 20;

// Shortcut nodes — 21..28
const CENTER = { x: 555, y: 555 };
// 5 -> 21 -> 22 -> 23 : southwest diagonal to center, 3 steps
const n21 = lerp(cornerSouth, CENTER, 1 / 3);
const n22 = lerp(cornerSouth, CENTER, 2 / 3);
// 10 -> 24 -> 23 : northeast diagonal to center, 2 steps
const n24 = lerp(cornerWest, CENTER, 1 / 2);
// 23 -> 25 -> 26 -> 17 : toward north-east edge
const n25 = lerp(CENTER, outer[17], 1 / 3);
const n26 = lerp(CENTER, outer[17], 2 / 3);
// 23 -> 27 -> 28 -> 17 : alt route (bowed outward) for visual variety
const bow = { x: (CENTER.x + outer[17].x) / 2 + 70, y: (CENTER.y + outer[17].y) / 2 - 70 };
const n27 = lerp(CENTER, bow, 2 / 3);
const n28 = lerp(bow, outer[17], 1 / 2);

function lerp(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export const TILE_GRAPH: YutNode[] = [
  ...outer.map((p, i) => ({
    idx: i,
    x: p.x,
    y: p.y,
    kind:
      i === 0
        ? ("start" as const)
        : i === 5 || i === 10 || i === 15
          ? ("corner" as const)
          : ("edge" as const),
    cornerRegion:
      i === 0 ? ("east" as const)
        : i === 5 ? ("south" as const)
          : i === 10 ? ("west" as const)
            : i === 15 ? ("north" as const)
              : null,
  })),
  { idx: 20, x: 0, y: 0, kind: "edge", cornerRegion: null }, // unused placeholder; kept so idx 21+ align
  { idx: 21, x: n21.x, y: n21.y, kind: "shortcut", cornerRegion: null },
  { idx: 22, x: n22.x, y: n22.y, kind: "shortcut", cornerRegion: null },
  { idx: 23, x: CENTER.x, y: CENTER.y, kind: "center", cornerRegion: null },
  { idx: 24, x: n24.x, y: n24.y, kind: "shortcut", cornerRegion: null },
  { idx: 25, x: n25.x, y: n25.y, kind: "shortcut", cornerRegion: null },
  { idx: 26, x: n26.x, y: n26.y, kind: "shortcut", cornerRegion: null },
  { idx: 27, x: n27.x, y: n27.y, kind: "shortcut", cornerRegion: null },
  { idx: 28, x: n28.x, y: n28.y, kind: "shortcut", cornerRegion: null },
];

// Node 20 doesn't actually exist on the graph — callers must never land
// there. It only occupies an array slot so we can index TILE_GRAPH[idx]
// directly for idx >= 21.
export const GOAL_SENTINEL = -2; // distinct from "home" so logic can detect goal crossings

// Next-node mapping. A branch node returns >= 2 options (first = primary,
// others = shortcut). Non-branch nodes return exactly one next node.
// For the outer ring the "next" is (n+1)%20, with special handling so
// step-from-19 -> 0 doesn't count as an orbital completion — callers decide
// what "crossing 0" means (goal).
export function forwardOptions(n: number): number[] {
  if (n === 5)  return [6, 21];              // corner south: straight or shortcut
  if (n === 10) return [11, 24];             // corner west: straight or shortcut
  if (n === 23) return [25, 27];             // center: two paths back to outer
  if (n === 21) return [22];
  if (n === 22) return [23];
  if (n === 24) return [23];
  if (n === 25) return [26];
  if (n === 26) return [17];
  if (n === 27) return [28];
  if (n === 28) return [17];
  // Outer ring default: clockwise by one.
  return [(n + 1) % 20];
}

// Backdo (백도): one step backward. Only meaningful on the outer ring. From
// shortcut tiles we send the piece back to the most-recent outer-ring entry
// (which is a simplification, but keeps the logic self-contained).
export function backwardStep(n: number): number {
  if (n >= 0 && n < 20) return (n + 19) % 20;
  if (n === 21) return 5;
  if (n === 22) return 21;
  if (n === 23) return 22;
  if (n === 24) return 10;
  if (n === 25) return 23;
  if (n === 26) return 25;
  if (n === 27) return 23;
  if (n === 28) return 27;
  return n;
}

// ---------------------------------------------------------------
// STICK_PROB — 4 sticks, flat (P=0.6) vs round (P=0.4) per stick.
// Derived outcomes:
//   0 flats → 모 (5)     : 0.4^4         = 0.0256  +extra throw
//   1 flat  → 도 (1)     : 4·0.6·0.4^3   = 0.1536
//     (special: if piece hasn't moved, "도" can be thrown as 백도. We leave
//     the mechanic out for simplicity; we expose a genuine backdo side
//     instead, replacing *one* of the 도 outcomes' 5% as 백도.)
//   2 flats → 개 (2)     : 6·0.6^2·0.4^2 = 0.3456
//   3 flats → 걸 (3)     : 4·0.6^3·0.4   = 0.3456
//   4 flats → 윷 (4)     : 0.6^4         = 0.1296  +extra throw
//   백도 (-1)            : 0.0256 (stolen from 도 share)
// ---------------------------------------------------------------

export interface ThrowOutcome {
  value: Throw;
  weight: number;
  label: string; // display name (Korean)
  extra: boolean; // grants another throw
}

export const STICK_PROB: ThrowOutcome[] = [
  { value: -1, weight: 0.0256, label: "백도",  extra: false },
  { value: 1,  weight: 0.1280, label: "도",    extra: false }, // 0.1536 - 0.0256
  { value: 2,  weight: 0.3456, label: "개",    extra: false },
  { value: 3,  weight: 0.3456, label: "걸",    extra: false },
  { value: 4,  weight: 0.1296, label: "윷",    extra: true  },
  { value: 5,  weight: 0.0256, label: "모",    extra: true  },
];

export function throwLabel(v: Throw): string {
  const hit = STICK_PROB.find(o => o.value === v);
  return hit ? hit.label : String(v);
}

// ---------------------------------------------------------------
// Corner greetings — shown as a CultureCard when a piece lands on a corner.
// Keys are language codes used across the app (ko/en/vi/ja/…).
// ---------------------------------------------------------------
export const CORNER_GREETINGS: Record<
  "east" | "south" | "west" | "north",
  Array<{ lang: string; greet: string; roman?: string }>
> = {
  east: [
    { lang: "ko", greet: "안녕하세요", roman: "Annyeonghaseyo" },
  ],
  south: [
    { lang: "vi", greet: "Xin chào" },
    { lang: "th", greet: "สวัสดี", roman: "Sawadee" },
  ],
  west: [
    { lang: "mn", greet: "Сайн байна уу", roman: "Sain baina uu" },
    { lang: "uz", greet: "Salom" },
  ],
  north: [
    { lang: "ru", greet: "Привет", roman: "Privet" },
    { lang: "en", greet: "Hello" },
  ],
};

// Flag emoji for regions, for UI flair.
export const REGION_EMOJI: Record<"east" | "south" | "west" | "north", string> = {
  east: "🇰🇷",
  south: "🌴",
  west: "🏜️",
  north: "❄️",
};

// Localised region display name. Very small LangMap — extend as needed.
export const REGION_NAME: Record<"east" | "south" | "west" | "north", LangMap> = {
  east:  { ko: "동쪽 마을", en: "East village" },
  south: { ko: "남쪽 마을", en: "South village" },
  west:  { ko: "서쪽 마을", en: "West village" },
  north: { ko: "북쪽 마을", en: "North village" },
};

// Is the tile index a corner that should fire a culture card?
export function cornerRegion(idx: number): "east" | "south" | "west" | "north" | null {
  if (idx < 0 || idx >= TILE_GRAPH.length) return null;
  return TILE_GRAPH[idx].cornerRegion;
}

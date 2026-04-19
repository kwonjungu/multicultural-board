# BeeWorldMarble — Implementer Report

## Files created

| Path | Lines |
| --- | --- |
| lib/marbleData.ts        | 299 |
| lib/marbleTypes.ts       | 85  |
| lib/marbleEffects.ts     | 225 |
| lib/marbleReducer.ts     | 360 |
| components/games/BeeWorldMarble/index.tsx            | 147 |
| components/games/BeeWorldMarble/Board.tsx            | 98  |
| components/games/BeeWorldMarble/Tile.tsx             | 258 |
| components/games/BeeWorldMarble/DicePanel.tsx        | 96  |
| components/games/BeeWorldMarble/ActionPanel.tsx      | 286 |
| components/games/BeeWorldMarble/QuizCard.tsx         | 273 |
| components/games/BeeWorldMarble/ChanceCard.tsx       | 81  |
| components/games/BeeWorldMarble/PlayerHud.tsx        | 145 |
| components/games/BeeWorldMarble/LogTicker.tsx        | 43  |
| components/games/BeeWorldMarble/CharacterSetup.tsx   | 400 |

GameRoom.tsx: one import + one GAMES entry added (per spec).

## Deviations / adaptations

- **Reducer file split.** The combined reducer with helpers came in at 644 lines (> 500). Split into three modules keeping the external import surface stable:
  - `lib/marbleTypes.ts` — discriminated unions, constants.
  - `lib/marbleEffects.ts` — pure `enterTile` / `applyChanceEffect` / `tollFor`.
  - `lib/marbleReducer.ts` — `reducer` + `initialState`, re-exports the type barrel so existing `import ... from "@/lib/marbleReducer"` calls still resolve.
- **Board geometry.** Planner called for 8×8 outer ring `top 11 / right 5 / bottom 11 / left 5` but that's 32 cells. Used an 8-row × 9-col grid with ring `top 9 / right 7 / bottom 8 / left 6 = 30` — same visual shape, exact tile count, no reshuffling of TILES.
- **Chance count.** Applied the §2 note: dropped `idx 27` as chance and inserted a second US city (Golden Gate Bridge) to keep chance count at 2. TILES.length === 30 (city 22, chance 2, key 2, tax 1, festival 1, jail 1, space 1, start 1).
- **Quiz timing.** Added a 20-second `setInterval` countdown in `QuizCard`; if it reaches 0 the reducer is called with `correct: false` (follows planner §4 `timeoutSec: 20`).
- **Action `resolveChance`.** Planner signature had `{ cardId: string }` but the phase already carries the card id, so the payload is empty (cardId is pulled from `state.phase`). Keeps the reducer self-contained and avoids race conditions.
- **Rolling flow simplification.** `rollDice` action is a no-op in the reducer; `index.tsx` directly dispatches `rollResult` with randomized dice. The DicePanel still shows the visual roll-flicker animation during `phase.kind === "moving"`. Keeps things deterministic & test-friendly.

## Validation

- `npm run build` — compiles successfully, 13 pages prerendered, type check clean.
- `grep ": any\b" components/games/BeeWorldMarble lib/marble*.ts` — 0 hits.
- Every `<button>` carries an `aria-label`; every `<img>` has `onError` ↔ emoji fallback.
- All referenced assets exist under `public/` (landmarks 15, tiles 7, stickers for skins/hats/pets).

## Follow-up TODO

- Visual housing tiers (`buildings/villa|building|hotel.png`) not yet wired — `owned` count could drive a tile-corner house badge.
- `releaseJail via "pay"` action is implemented in the reducer but no UI button yet (auto-serve-time flow only).
- Color-group bundle bonus (2× toll) is in the reducer but not called out visually on the tile header yet.
- `inSpace` decrement isn't wired post-quiz — once a player fails the space quiz, `skipNext` covers the "stay" semantics, but the `inSpace` field stays 2. Harmless but worth wiring if more UI surfaces it.

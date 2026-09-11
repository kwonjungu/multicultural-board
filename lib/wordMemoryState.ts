export interface MemoryCardIdentity { id: string; pairKey: string }
export interface MemoryState {
  flipped: string[];
  matched: string[];
  moves: number;
}
export type MemoryAction =
  | { type: "flip"; id: string; cards: readonly MemoryCardIdentity[] }
  | { type: "settle"; ids: readonly string[] };

export function initialMemoryState(): MemoryState {
  return { flipped: [], matched: [], moves: 0 };
}

// Resolve the pair in the same transition as the second flip. Effects only
// schedule visual settling, so replaying an effect cannot award another move.
export function memoryReducer(state: MemoryState, action: MemoryAction): MemoryState {
  if (action.type === "settle") {
    if (state.flipped.length !== 2 || action.ids.length !== 2 ||
        !action.ids.every((id, i) => state.flipped[i] === id)) return state;
    return { ...state, flipped: [] };
  }
  const card = action.cards.find((entry) => entry.id === action.id);
  if (!card || state.flipped.length >= 2 || state.flipped.includes(card.id) ||
      state.matched.includes(card.pairKey)) return state;
  const first = action.cards.find((entry) => entry.id === state.flipped[0]);
  const flipped = [...state.flipped, card.id];
  return {
    flipped,
    moves: state.moves + (flipped.length === 2 ? 1 : 0),
    matched: first?.pairKey === card.pairKey
      ? [...state.matched, card.pairKey] : state.matched,
  };
}

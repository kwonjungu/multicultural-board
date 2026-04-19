// HoneyYut — Web Audio synth sfx. Mirrors BeeWorldMarble/marbleSfx.ts:
// a fresh AudioContext per tone so overlapping calls don't starve each other,
// and every call is SSR-safe.

interface WindowWithAudio {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function getAC(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as WindowWithAudio;
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function playTone(
  freq: number,
  durationMs: number,
  type: OscillatorType = "sine",
  volume = 0.18,
): void {
  const AC = getAC();
  if (!AC) return;
  const ctx = new AC();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + durationMs / 1000);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000);
}

function playSequence(
  notes: Array<{
    freq: number;
    durationMs: number;
    delayMs: number;
    type?: OscillatorType;
    volume?: number;
  }>,
): void {
  if (typeof window === "undefined") return;
  for (const n of notes) {
    window.setTimeout(
      () => playTone(n.freq, n.durationMs, n.type ?? "sine", n.volume),
      n.delayMs,
    );
  }
}

export const sfx = {
  // Stick throw — four wooden clacks cascading.
  throwSticks: (): void =>
    playSequence([
      { freq: 220, durationMs: 70, delayMs: 0,   type: "square", volume: 0.14 },
      { freq: 260, durationMs: 70, delayMs: 80,  type: "square", volume: 0.14 },
      { freq: 200, durationMs: 70, delayMs: 160, type: "square", volume: 0.14 },
      { freq: 240, durationMs: 90, delayMs: 260, type: "square", volume: 0.14 },
    ]),

  // Piece lands on a tile.
  landing: (): void => playTone(520, 140, "triangle", 0.16),

  // Selecting a piece (tap feedback).
  pickPiece: (): void => playTone(680, 70, "sine", 0.14),

  // Capture an opponent.
  capture: (): void =>
    playSequence([
      { freq: 420, durationMs: 90, delayMs: 0,   type: "sawtooth", volume: 0.16 },
      { freq: 220, durationMs: 180, delayMs: 90, type: "sawtooth", volume: 0.16 },
    ]),

  // Win fanfare.
  win: (): void =>
    playSequence([
      { freq: 392, durationMs: 150, delayMs: 0,   type: "triangle", volume: 0.2 },
      { freq: 523, durationMs: 150, delayMs: 140, type: "triangle", volume: 0.2 },
      { freq: 659, durationMs: 150, delayMs: 280, type: "triangle", volume: 0.2 },
      { freq: 784, durationMs: 380, delayMs: 420, type: "triangle", volume: 0.22 },
    ]),
};

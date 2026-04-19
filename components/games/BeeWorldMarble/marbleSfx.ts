// BeeWorldMarble — Web Audio synth sfx (no audio files).
// Pattern mirrors HalliGalli.tsx `playTone`: one AudioContext per tone so
// overlapping calls don't fight over a single context. SSR-safe.
//
// IMPORTANT: browsers require a user gesture before the first AudioContext
// can play audio, so every sfx here is expected to be triggered from a
// dispatch that happens after the user's click/tap.

interface WindowWithAudio {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function getAC(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as WindowWithAudio;
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Play a single oscillator tone. New AudioContext per call so overlapping
 * invocations don't cut each other off.
 */
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

/**
 * Sequence of tones with relative delays (ms from the first call).
 */
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
  // Dice rattle — 4 quick clicks at varied pitch.
  diceRoll: (): void =>
    playSequence([
      { freq: 620, durationMs: 60, delayMs: 0,   type: "square", volume: 0.12 },
      { freq: 540, durationMs: 60, delayMs: 70,  type: "square", volume: 0.12 },
      { freq: 700, durationMs: 60, delayMs: 140, type: "square", volume: 0.12 },
      { freq: 480, durationMs: 90, delayMs: 210, type: "square", volume: 0.12 },
    ]),

  // Single-tile step.
  move: (): void => playTone(420, 90, "triangle", 0.12),

  // Cha-ching buy: two ascending notes.
  buy: (): void =>
    playSequence([
      { freq: 880,  durationMs: 140, delayMs: 0,  type: "sine", volume: 0.2 },
      { freq: 1320, durationMs: 220, delayMs: 110, type: "sine", volume: 0.2 },
    ]),

  // Toll — low growl.
  toll: (): void => playTone(180, 280, "sawtooth", 0.16),

  // Quiz correct — ascending arpeggio C–E–G.
  quizCorrect: (): void =>
    playSequence([
      { freq: 523, durationMs: 130, delayMs: 0,   type: "sine", volume: 0.18 },
      { freq: 659, durationMs: 130, delayMs: 120, type: "sine", volume: 0.18 },
      { freq: 784, durationMs: 220, delayMs: 240, type: "sine", volume: 0.2 },
    ]),

  // Quiz wrong — descending two notes.
  quizWrong: (): void =>
    playSequence([
      { freq: 392, durationMs: 180, delayMs: 0,   type: "sawtooth", volume: 0.16 },
      { freq: 262, durationMs: 260, delayMs: 170, type: "sawtooth", volume: 0.16 },
    ]),

  // Festival — bright major arpeggio C–E–G–C.
  festival: (): void =>
    playSequence([
      { freq: 523,  durationMs: 110, delayMs: 0,   type: "triangle", volume: 0.18 },
      { freq: 659,  durationMs: 110, delayMs: 90,  type: "triangle", volume: 0.18 },
      { freq: 784,  durationMs: 110, delayMs: 180, type: "triangle", volume: 0.18 },
      { freq: 1047, durationMs: 260, delayMs: 270, type: "triangle", volume: 0.2 },
    ]),

  // Jail — two bell-like strikes.
  jail: (): void =>
    playSequence([
      { freq: 880,  durationMs: 220, delayMs: 0,   type: "sine", volume: 0.18 },
      { freq: 660,  durationMs: 320, delayMs: 140, type: "sine", volume: 0.16 },
    ]),

  // Win fanfare — G–C–E–G rising.
  win: (): void =>
    playSequence([
      { freq: 392,  durationMs: 150, delayMs: 0,   type: "triangle", volume: 0.2 },
      { freq: 523,  durationMs: 150, delayMs: 140, type: "triangle", volume: 0.2 },
      { freq: 659,  durationMs: 150, delayMs: 280, type: "triangle", volume: 0.2 },
      { freq: 784,  durationMs: 380, delayMs: 420, type: "triangle", volume: 0.22 },
    ]),
};

// BeeWorldMarble — Web Audio synth sfx (no audio files).
// 공유 싱글턴 컨텍스트(lib/gameSfx) 사용 — 톤마다 new AudioContext() 하던
// 옛 패턴은 컨텍스트 누수로 장시간 플레이 시 소리가 멈췄다.

import { playTone, playSequence } from "@/lib/gameSfx";

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

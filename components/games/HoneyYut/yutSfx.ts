// HoneyYut — Web Audio synth sfx.
// 공유 싱글턴 컨텍스트(lib/gameSfx) 사용 — 톤마다 new AudioContext() 하던
// 옛 패턴은 컨텍스트 누수로 장시간 플레이 시 소리가 멈췄다.

import { playTone, playSequence } from "@/lib/gameSfx";

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

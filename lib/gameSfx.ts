// 게임 공용 Web Audio 신스 효과음.
//
// ⚠️ 과거 패턴("톤마다 new AudioContext()")은 컨텍스트를 닫지 않아 누적되고,
// Chrome 은 탭당 AudioContext 수를 제한하므로 게임을 오래 하면 소리가
// 통째로 멈추는 버그가 있었다. 오실레이터는 같은 컨텍스트 안에서 얼마든지
// 겹쳐 재생할 수 있으므로 싱글턴 컨텍스트 하나를 공유한다.
//
// 브라우저 자동재생 정책: 첫 사용자 제스처 이후에만 소리가 난다.
// 모든 호출이 클릭/탭 핸들러에서 출발하므로 resume() 만 챙기면 된다.

interface WindowWithAudio {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const w = window as unknown as WindowWithAudio;
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;
    sharedCtx = new AC();
  }
  // 사용자 제스처 전 생성됐거나 백그라운드로 suspend 된 경우 재개
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export function playTone(
  freq: number,
  durationMs: number,
  type: OscillatorType = "sine",
  volume = 0.18,
): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
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
    // 노드 정리 — 끝난 오실레이터/게인을 그래프에서 분리
    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch { /* noop */ } };
  } catch { /* audio unavailable */ }
}

export function playSequence(
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

// 단어카드 시험 등 세션 완료 축하 팡파레 (#6).
// 결과 강도에 따라 차등: full(별3) → good(별2) → soft(격려).
// 모두 공유 싱글턴 컨텍스트를 쓰므로 톤마다 new AudioContext 금지 (가드레일).
export type FanfareLevel = "full" | "good" | "soft";

export function playFanfare(level: FanfareLevel = "full"): void {
  if (typeof window === "undefined") return;
  if (level === "soft") {
    // 격려 — 부드러운 2음 상승 (저점수)
    playSequence([
      { freq: 523, durationMs: 160, delayMs: 0,   type: "sine", volume: 0.16 },
      { freq: 659, durationMs: 260, delayMs: 150, type: "sine", volume: 0.18 },
    ]);
    return;
  }
  if (level === "good") {
    // 잘했어요 — C–E–G–C 상승 아르페지오
    playSequence([
      { freq: 523,  durationMs: 130, delayMs: 0,   type: "triangle", volume: 0.18 },
      { freq: 659,  durationMs: 130, delayMs: 110, type: "triangle", volume: 0.18 },
      { freq: 784,  durationMs: 130, delayMs: 220, type: "triangle", volume: 0.18 },
      { freq: 1047, durationMs: 320, delayMs: 330, type: "triangle", volume: 0.2 },
    ]);
    return;
  }
  // full — 완벽! 화려한 팡파레: 상승 아르페지오 + 마무리 화음(C장조 트라이어드)
  playSequence([
    { freq: 523,  durationMs: 120, delayMs: 0,   type: "triangle", volume: 0.2 },
    { freq: 659,  durationMs: 120, delayMs: 110, type: "triangle", volume: 0.2 },
    { freq: 784,  durationMs: 120, delayMs: 220, type: "triangle", volume: 0.2 },
    { freq: 1047, durationMs: 160, delayMs: 330, type: "triangle", volume: 0.22 },
    { freq: 1319, durationMs: 160, delayMs: 470, type: "triangle", volume: 0.22 },
    // 마무리 트라이어드 한 방
    { freq: 523,  durationMs: 520, delayMs: 640, type: "triangle", volume: 0.16 },
    { freq: 784,  durationMs: 520, delayMs: 640, type: "triangle", volume: 0.16 },
    { freq: 1047, durationMs: 520, delayMs: 640, type: "triangle", volume: 0.18 },
    // 반짝이는 종소리 장식
    { freq: 1568, durationMs: 240, delayMs: 720, type: "sine", volume: 0.12 },
    { freq: 2093, durationMs: 320, delayMs: 880, type: "sine", volume: 0.1 },
  ]);
}

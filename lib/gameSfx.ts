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
